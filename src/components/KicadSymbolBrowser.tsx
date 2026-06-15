import { useState, useEffect, useMemo, useCallback, useRef, type DragEvent } from 'react';
import Fuse from 'fuse.js';
import type { SymbolEntry } from '../../scripts/types';
import { setDragComponentType, clearDragContext, inferParams } from '@/lib/dragContext';
import useSchematicStore from '@/store/schematicStore';
import { getNormalizedPins, preloadPinData } from '@/lib/pinDataCache';

const PREVIEW_BASE = '/assets/symbols/previews/';

interface CatalogModule {
  symbols: SymbolEntry[];
}

function extractLibrary(sourceFile: string): string {
  const parts = sourceFile.split(/[\\/]/);
  return parts.length > 0 ? parts[0].replace('.kicad_symdir', '') : 'Other';
}

/** Format a library name for display: "Battery_Management" → "Battery Management" */
function formatLibName(lib: string): string {
  return lib.replace(/_/g, ' ').replace(/\.kicad_sym$/i, '');
}

type Category = 'basic' | 'diodes' | 'transistors' | 'logic_gates' | 'power' | 'ics_chips' | 'all';

interface CategoryDef {
  id: Category;
  label: string;
}

const CATEGORIES: CategoryDef[] = [
  { id: 'basic', label: 'Basic' },
  { id: 'diodes', label: 'Diodes' },
  { id: 'transistors', label: 'Transistors' },
  { id: 'logic_gates', label: 'Logic Gates' },
  { id: 'power', label: 'Power' },
  { id: 'ics_chips', label: 'ICs & Chips' },
  { id: 'all', label: 'All' },
];

/** Map library names to categories */
function categoryForLib(lib: string): Category {
  const l = lib.toLowerCase();
  if (l === 'device' || l === 'switch' || l === 'relay' || l === 'jumper' || l === 'battery_management') return 'basic';
  if (l === 'diode' || l === 'diode_bridge' || l === 'diode_laser' || l === 'led') return 'diodes';
  if (l.startsWith('transistor') || l === 'triac_thyristor') return 'transistors';
  if (l === 'buffer' || l.startsWith('74xx') || l.startsWith('74xg') || l.startsWith('logic_')) return 'logic_gates';
  if (l.startsWith('regulator') || l.startsWith('converter') || l.startsWith('power') || l.startsWith('reference_') || l === 'power') return 'power';
  return 'ics_chips';
}

/** Clean display names for Device library symbols */
const BASIC_DISPLAY_NAMES: Record<string, string> = {
  'r': 'Resistor',
  'r_small': 'Resistor (Small)',
  'r_us': 'Resistor (US)',
  'r_small_us': 'Resistor (Small US)',
  'r_45deg': 'Resistor (Angled)',
  'r_potentiometer': 'Potentiometer',
  'r_potentiometer_us': 'Potentiometer (US)',
  'r_potentiometer_small': 'Potentiometer (Small)',
  'r_potentiometer_trim': 'Trimmer Potentiometer',
  'r_potentiometer_trim_us': 'Trimmer Potentiometer (US)',
  'r_trim': 'Trimmer Resistor',
  'r_variable': 'Variable Resistor',
  'r_variable_us': 'Variable Resistor (US)',
  'r_photo': 'Photoresistor',
  'r_shunt': 'Shunt Resistor',
  'r_shunt_us': 'Shunt Resistor (US)',
  'c': 'Capacitor',
  'c_small': 'Capacitor (Small)',
  'c_us': 'Capacitor (US)',
  'c_small_us': 'Capacitor (Small US)',
  'c_45deg': 'Capacitor (Angled)',
  'c_polarized': 'Capacitor (Polarized)',
  'c_polarized_small': 'Capacitor (Polarized Small)',
  'c_polarized_us': 'Capacitor (Polarized US)',
  'c_polarized_small_us': 'Capacitor (Polarized Small US)',
  'c_variable': 'Variable Capacitor',
  'c_trim': 'Trimmer Capacitor',
  'c_trim_small': 'Trimmer Capacitor (Small)',
  'c_trim_differential': 'Trimmer Capacitor (Differential)',
  'l': 'Inductor',
  'l_small': 'Inductor (Small)',
  'l_45deg': 'Inductor (Angled)',
  'l_iron': 'Inductor (Iron Core)',
  'l_iron_small': 'Inductor (Iron Core Small)',
  'l_ferrite': 'Inductor (Ferrite)',
  'l_ferrite_small': 'Inductor (Ferrite Small)',
  'l_trim': 'Trimmer Inductor',
  'l_coupled': 'Coupled Inductor',
  'l_coupled_small': 'Coupled Inductor (Small)',
  'battery': 'Battery',
  'battery_cell': 'Battery Cell',
  'led': 'LED',
  'led_small': 'LED (Small)',
  'led_filled': 'LED (Filled)',
  'd': 'Diode',
  'd_small': 'Diode (Small)',
  'd_filled': 'Diode (Filled)',
  'd_45deg': 'Diode (Angled)',
  'd_zener': 'Zener Diode',
  'd_zener_small': 'Zener Diode (Small)',
  'd_schottky': 'Schottky Diode',
  'd_schottky_small': 'Schottky Diode (Small)',
  'd_tvs': 'TVS Diode',
  'd_tvs_small': 'TVS Diode (Small)',
  'd_tunnel': 'Tunnel Diode',
  'd_photo': 'Photodiode',
  'd_photo_filled': 'Photodiode (Filled)',
  'd_laser_1a3c': 'Laser Diode',
  'd_laser_1c2a': 'Laser Diode (Alt)',
  'q_npn': 'NPN Transistor',
  'q_npn_darlington': 'NPN Darlington',
  'q_npn_brt': 'NPN Digital Transistor',
  'q_npn_currentmirror': 'NPN Current Mirror',
  'q_pnp': 'PNP Transistor',
  'q_pnp_darlington': 'PNP Darlington',
  'q_pnp_brt': 'PNP Digital Transistor',
  'q_pnp_currentmirror': 'PNP Current Mirror',
  'q_nmos': 'N-Channel MOSFET',
  'q_nmos_depletion': 'N-Channel MOSFET (Depletion)',
  'q_pmos': 'P-Channel MOSFET',
  'q_pmos_depletion': 'P-Channel MOSFET (Depletion)',
  'q_njfet_dgs': 'N-JFET (DGS)',
  'q_njfet_gds': 'N-JFET (GDS)',
  'q_pjfet_dgs': 'P-JFET (DGS)',
  'q_pjfet_gds': 'P-JFET (GDS)',
  'q_nigbt_ceg': 'N-IGBT (CEG)',
  'q_pigbt_ceg': 'P-IGBT (CEG)',
  'q_scr_agk': 'SCR Thyristor',
  'q_triac': 'TRIAC',
  'q_photo_npn': 'Phototransistor (NPN)',
  'gnd': 'Ground',
  'gnda': 'Ground (Analog)',
  'gndd': 'Ground (Digital)',
  'sw_push': 'Push Button',
  'sw_push_dual': 'Push Button (Dual)',
  'sw_spst': 'Switch (SPST)',
  'sw_spdt': 'Switch (SPDT)',
  'sw_dpst': 'Switch (DPST)',
  'sw_dip_x01': 'DIP Switch (1)',
  'sw_dip_x02': 'DIP Switch (2)',
  'sw_dip_x03': 'DIP Switch (3)',
  'sw_dip_x04': 'DIP Switch (4)',
  'sw_dip_x05': 'DIP Switch (5)',
  'sw_dip_x06': 'DIP Switch (6)',
  'sw_dip_x07': 'DIP Switch (7)',
  'sw_dip_x08': 'DIP Switch (8)',
  'sw_rotary': 'Rotary Switch',
  'sw_slide': 'Slide Switch',
  'sw_tactile': 'Tactile Switch',
  'sw_toggle': 'Toggle Switch',
  'opamp_dual': 'Op-Amp (Dual)',
  'opamp_quad': 'Op-Amp (Quad)',
  'fuse': 'Fuse',
  'fuse_small': 'Fuse (Small)',
  'fuse_polarized': 'Fuse (Polarized)',
  'polyfuse': 'PTC Resettable Fuse',
  'polyfuse_small': 'PTC Resettable Fuse (Small)',
  'crystal': 'Crystal Oscillator',
  'crystal_small': 'Crystal Oscillator (Small)',
  'resonator': 'Ceramic Resonator',
  'resonator_small': 'Ceramic Resonator (Small)',
  'ferritebead': 'Ferrite Bead',
  'ferritebead_small': 'Ferrite Bead (Small)',
  'antenna': 'Antenna',
  'antenna_dipole': 'Antenna (Dipole)',
  'antenna_loop': 'Antenna (Loop)',
  'speaker': 'Speaker',
  'microphone': 'Microphone',
  'microphone_condenser': 'Microphone (Condenser)',
  'transformer_1p_1s': 'Transformer (1:1)',
  'transformer_1p_2s': 'Transformer (1:2)',
  'transformer_audio': 'Audio Transformer',
  'thermistor': 'Thermistor',
  'thermistor_ntc': 'NTC Thermistor',
  'thermistor_ptc': 'PTC Thermistor',
  'potentiometer': 'Potentiometer',
  'varistor': 'Varistor',
  'solar_cell': 'Solar Cell',
  'solar_cells': 'Solar Cells (Panel)',
  'motor': 'Motor',
  'lamp': 'Lamp',
  'lamp_neon': 'Neon Lamp',
  'buzzer': 'Buzzer',
  'heater': 'Heater',
  'peltierelement': 'Peltier Element',
  'sparkgap': 'Spark Gap',
  'jumper': 'Jumper',
  'nettie_2': 'Net Tie (2)',
  'nettie_3': 'Net Tie (3)',
  'nettie_4': 'Net Tie (4)',
  'testpoint': 'Test Point',
  'voltagedivider': 'Voltage Divider',
};

/** The 10 most common components for quick-access toolbar */
const QUICK_ITEMS: { id: string; label: string; kicadId: string }[] = [
  { id: 'r', label: 'Resistor', kicadId: 'r' },
  { id: 'c', label: 'Capacitor', kicadId: 'c' },
  { id: 'l', label: 'Inductor', kicadId: 'l' },
  { id: 'battery', label: 'Battery', kicadId: 'battery' },
  { id: 'gnd', label: 'Ground', kicadId: 'gnd' },
  { id: 'led', label: 'LED', kicadId: 'led' },
  { id: 'd', label: 'Diode', kicadId: 'd' },
  { id: 'q_npn', label: 'NPN', kicadId: 'q_npn' },
  { id: 'sw_push', label: 'Switch', kicadId: 'sw_push' },
  { id: 'opamp_dual', label: 'Op-Amp', kicadId: 'opamp_dual' },
];

export default function KicadSymbolBrowser() {
  const [catalog, setCatalog] = useState<SymbolEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [category, setCategory] = useState<Category>('basic');

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const mod: CatalogModule = (await import('@/assets/symbols/catalog.json')).default || await import('@/assets/symbols/catalog.json');
        const symbols = 'symbols' in mod ? mod.symbols : (mod as any).default?.symbols ?? [];
        if (!cancelled) setCatalog(symbols.filter((s: SymbolEntry) => s.hasSvg));
      } catch (e) {
        console.warn('Failed to load KiCad catalog:', e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    preloadPinData();
    return () => { cancelled = true; };
  }, []);

  // Debounce search input
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 200);
    return () => clearTimeout(t);
  }, [search]);

  /** Get display name for a symbol */
  const displayName = useCallback((entry: SymbolEntry): string => {
    if (extractLibrary(entry.sourceFile) === 'Device') {
      return BASIC_DISPLAY_NAMES[entry.id] ?? (entry.name || entry.id);
    }
    return entry.name || entry.id;
  }, []);

  /** Add a component to the canvas */
  const handleAddComponent = useCallback(async (entry: SymbolEntry) => {
    setDragComponentType('unknown');
    await preloadPinData();
    const pinData = getNormalizedPins(entry.id);
    const params = inferParams(entry.id);
    useSchematicStore.getState().addComponent({
      type: 'unknown',
      confidence: 1,
      position: { x: 0, y: 0 },
      rotation: 0,
      scale: { x: 1, y: 1 },
      kicadSymbolId: entry.id,
      normalizedPinPositions: pinData?.normalizedPinPositions,
      symbolViewBox: pinData?.symbolViewBox,
      params,
    });
  }, []);

  const handleDragStart = useCallback((e: DragEvent, entry: SymbolEntry) => {
    setDragComponentType('unknown', entry.id);
    e.dataTransfer.setData('application/volt-kicad-symbol', JSON.stringify({
      kicadSymbolId: entry.id,
      name: entry.name,
      reference: entry.reference,
    }));
    e.dataTransfer.effectAllowed = 'copy';
  }, []);

  const handleDragEnd = useCallback(() => {
    clearDragContext();
  }, []);

  /** Category-filtered catalog (pre-filter before fuzzy search) */
  const categoryFiltered = useMemo(() => {
    if (category === 'all') return catalog;
    return catalog.filter((s) => {
      const lib = extractLibrary(s.sourceFile);
      if (categoryForLib(lib) === category) return true;
      // Ground symbols from power library are basic essentials
      if (category === 'basic' && s.id.startsWith('gnd')) return true;
      return false;
    });
  }, [catalog, category]);

  /** Fuse instance for fuzzy search */
  const fuse = useMemo(() => {
    return new Fuse(categoryFiltered, {
      keys: [
        { name: 'id', weight: 3 },
        { name: 'name', weight: 2 },
        { name: 'reference', weight: 1.5 },
        { name: 'description', weight: 1 },
        { name: 'keywords', weight: 0.5 },
      ],
      threshold: 0.4,
      distance: 200,
      minMatchCharLength: 1,
    });
  }, [categoryFiltered]);

  /** Filtered and categorized symbol list */
  const filtered = useMemo(() => {
    const q = debouncedSearch.trim();
    if (!q) return categoryFiltered;
    const results = fuse.search(q);
    return results.map((r) => r.item);
  }, [categoryFiltered, debouncedSearch, fuse]);

  /** Quick-access toolbar items (only shown when no search and category is basic) */
  const quickItems = useMemo(() => {
    if (search || category !== 'basic') return null;
    return QUICK_ITEMS.map((qi) => {
      const entry = catalog.find((s) => s.id === qi.kicadId);
      return entry ? { ...qi, entry } : null;
    }).filter(Boolean) as { id: string; label: string; kicadId: string; entry: SymbolEntry }[];
  }, [catalog, search, category]);

  return (
    <div className="rounded-xl border border-default bg-base p-6">
      <input
        type="text"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        placeholder="Search components..."
        className="w-full rounded-md border border-default bg-surface px-3.5 py-2.5 text-xs text-text-primary outline-none placeholder:text-text-secondary/40 focus:border-accent focus:ring-1 focus:ring-accent/40"
      />

      {/* Category tabs */}
      <div className="mt-4 flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setCategory(cat.id)}
            className={`rounded-md px-3 py-1.5 text-[11px] font-medium transition ${
              category === cat.id
                ? 'bg-accent text-black'
                : 'bg-surface text-text-secondary hover:text-text-primary border border-default'
            }`}
          >
            {cat.label}
          </button>
        ))}
      </div>

      {/* Quick-access toolbar (10 most common) */}
      {quickItems && quickItems.length > 0 && (
        <div className="mt-5 grid grid-cols-5 gap-2">
          {quickItems.map((item) => (
            <div
              key={item.id}
              draggable
              onDragStart={(e) => handleDragStart(e, item.entry)}
              onDragEnd={handleDragEnd}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddComponent(item.entry); }
              }}
              onClick={() => handleAddComponent(item.entry)}
              title={item.label}
              className="flex cursor-grab flex-col items-center gap-1 rounded-lg border border-default bg-surface px-2 py-2.5 transition hover:border-accent hover:bg-accent/5 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent"
            >
              <img
                src={`${PREVIEW_BASE}${item.entry.id}.svg`}
                alt={item.label}
                width={26}
                height={26}
                className="h-[26px] w-[26px] object-contain"
                loading="lazy"
              />
              <span className="truncate text-[9px] text-text-secondary">{item.label}</span>
            </div>
          ))}
        </div>
      )}

      {/* Results count */}
      {!loading && (
        <p className="mt-3 text-[11px] text-text-secondary/40">
          {filtered.length} component{filtered.length !== 1 ? 's' : ''}
          {filtered.length > 200 && ' (showing first 200)'}
        </p>
      )}

      {/* Results list */}
      <div className="mt-2 max-h-72 space-y-1 overflow-y-auto">
        {loading && (
          <p className="py-6 text-center text-xs text-text-secondary/60">Loading…</p>
        )}
        {!loading && filtered.length === 0 && (
          <p className="py-6 text-center text-xs text-text-secondary/60">
            {search ? 'No matching components' : 'No components loaded'}
          </p>
        )}
        {filtered.slice(0, 200).map((entry) => {
          const dName = displayName(entry);
          const lib = extractLibrary(entry.sourceFile);
          const libDisplay = formatLibName(lib);
          return (
            <div
              key={entry.id}
              draggable
              onDragStart={(e) => handleDragStart(e, entry)}
              onDragEnd={handleDragEnd}
              role="button"
              tabIndex={0}
              onKeyDown={(e) => {
                if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleAddComponent(entry); }
              }}
              className="flex cursor-grab items-center gap-3 rounded-lg px-3 py-2 transition hover:bg-accent/10 active:cursor-grabbing focus-visible:ring-2 focus-visible:ring-accent"
            >
              <div className="h-10 w-10 flex-shrink-0">
                <img
                  src={`${PREVIEW_BASE}${entry.id}.svg`}
                  alt={dName}
                  width={40}
                  height={40}
                  className="h-full w-full object-contain"
                  loading="lazy"
                />
              </div>
              <div className="min-w-0 flex-1">
                <div className="truncate text-xs font-medium text-text-primary" title={dName}>
                  {dName}
                </div>
                <div className="truncate text-[11px] text-text-secondary/60">
                  {entry.reference} &middot; {lib === 'Device' ? 'Basic' : libDisplay}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
