import { useState, useCallback } from 'react';
import useSchematicStore from '@/store/schematicStore';
import { useSimulationStore } from '@/store/simulationStore';
import { useDrawingStore } from '@/store/drawingStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useProjectStore } from '@/store/projectStore';
import { downloadSVG, downloadPNG, downloadJSON } from '@/lib/export';

function formatVoltage(v: number): string {
  if (Math.abs(v) < 1e-12) return '0 V';
  if (Math.abs(v) >= 1) return `${v.toFixed(2)} V`;
  if (Math.abs(v) >= 0.001) return `${(v * 1000).toFixed(1)} mV`;
  return `${(v * 1e6).toFixed(0)} µV`;
}

function formatCurrent(i: number): string {
  if (Math.abs(i) < 1e-12) return '0 A';
  if (Math.abs(i) >= 1) return `${i.toFixed(2)} A`;
  if (Math.abs(i) >= 0.001) return `${(i * 1000).toFixed(1)} mA`;
  return `${(i * 1e6).toFixed(0)} µA`;
}

function formatPower(p: number): string {
  if (Math.abs(p) < 1e-12) return '0 W';
  if (Math.abs(p) >= 1) return `${p.toFixed(2)} W`;
  if (Math.abs(p) >= 0.001) return `${(p * 1000).toFixed(1)} mW`;
  return `${(p * 1e6).toFixed(0)} µW`;
}
interface FieldProps {
  label: string;
  unit?: string;
  children: React.ReactNode;
}

function Field({ label, unit, children }: FieldProps) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-text-secondary">{label}</span>
      <div className="flex items-center gap-1">
        {children}
        {unit && <span className="w-5 text-xs text-text-secondary/60">{unit}</span>}
      </div>
    </div>
  );
}

function NumInput({
  value,
  onChange,
  min,
  max,
  step,
  placeholder,
}: {
  value: number;
  onChange: (v: number) => void;
  min?: number;
  max?: number;
  step?: number;
  placeholder?: string;
}) {
  return (
    <input
      type="number"
      value={value}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!isNaN(v)) onChange(v);
      }}
      min={min}
      max={max}
      step={step}
      placeholder={placeholder}
      className="w-20 rounded-md border border-subtle bg-surface px-2 py-1 text-right text-sm font-mono text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/40"
    />
  );
}

const SIM_TYPES = [
  { value: '', label: 'None (visual only)' },
  { value: 'resistor', label: 'Resistor' },
  { value: 'battery', label: 'Battery' },
  { value: 'voltage_source', label: 'Voltage Source' },
  { value: 'current_source', label: 'Current Source' },
  { value: 'led', label: 'LED' },
  { value: 'diode', label: 'Diode' },
  { value: 'ground', label: 'Ground' },
  { value: 'switch', label: 'Switch' },
];

export default function ComponentProperties() {
  const [showShare, setShowShare] = useState(false);
  const [shareUrl, setShareUrl] = useState('');
  const [sharing, setSharing] = useState(false);

  const selectedComponentId = useSchematicStore((s) => s.selectedComponentId);
  const components = useSchematicStore((s) => s.components);
  const updateComponent = useSchematicStore((s) => s.updateComponent);
  const rotateComponent = useSchematicStore((s) => s.rotateComponent);
  const simResult = useSimulationStore((s) => s.result);
  const strokes = useDrawingStore((s) => s.strokes);
  const camera = useCanvasStore((s) => ({ offset: { x: s.offset.x, y: s.offset.y }, zoom: s.zoom }));
  const generateShareToken = useProjectStore((s) => s.generateShareToken);
  const currentProjectId = useProjectStore((s) => s.currentProjectId);

  const comp = components.find((c) => c.id === selectedComponentId);
  const p = comp?.params ?? {};

  const updateParams = useCallback(
    (key: string, value: number | string | boolean) => {
      if (!comp) return;
      const newParams = { ...comp.params, [key]: value } as Record<string, number | string | boolean>;
      const st = (key === 'simType' ? value : (comp.params?.simType as string | undefined)) ?? '';
      const partial: Record<string, unknown> = { params: newParams };
      if (st === 'resistor' && key === 'resistance') partial.value = value as number;
      else if (st === 'battery' && key === 'voltage') partial.value = value as number;
      else if (st === 'voltage_source' && key === 'voltage') partial.value = value as number;
      else if (st === 'current_source' && key === 'current') partial.value = value as number;
      updateComponent(comp.id, partial);
    },
    [comp, updateComponent]
  );

  const handleExportSVG = () => downloadSVG(components, strokes);
  const handleExportPNG = () => downloadPNG(components, strokes);
  const handleExportJSON = () => downloadJSON(strokes, components, camera);

  const handleShare = async () => {
    if (!currentProjectId) return;
    setSharing(true);
    try {
      const token = await generateShareToken(currentProjectId);
      setShareUrl(`${window.location.origin}/shared/${token}`);
      setShowShare(true);
    } catch (e) {
      console.error('Failed to share project:', e);
    } finally {
      setSharing(false);
    }
  };

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
    } catch {
      const input = document.querySelector<HTMLInputElement>('[data-share-url]');
      input?.select();
    }
  };

  const renderBody = () => {
    if (!comp) {
      return (
        <div className="rounded-lg border border-subtle bg-base p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Properties</p>
          <p className="mt-4 text-sm text-text-secondary">Select a component</p>
        </div>
      );
    }

    const st = (p.simType as string) ?? '';

    return (
      <>
        <div className="rounded-lg border border-subtle bg-base p-5">
          <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Properties</p>
          <div className="mt-4 space-y-3">
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Type</span>
              <span className="text-text-primary">KiCad Symbol</span>
            </div>

            {comp.kicadSymbolId && (
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Symbol</span>
                <span className="max-w-[140px] truncate text-right text-xs text-text-primary font-mono" title={comp.kicadSymbolId}>
                  {comp.kicadSymbolId}
                </span>
              </div>
            )}

            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Simulation Type</span>
              <select
                value={st}
                onChange={(e) => updateParams('simType', e.target.value)}
                className="w-36 rounded-md border border-subtle bg-surface px-2 py-1 text-right text-sm text-text-primary outline-none transition focus:border-accent focus:ring-1 focus:ring-accent/40"
              >
                {SIM_TYPES.map((t) => (
                  <option key={t.value} value={t.value}>{t.label}</option>
                ))}
              </select>
            </div>

            {renderSimProperties(st, p, updateParams)}

            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Rotation</span>
              <div className="flex items-center gap-2">
                <span className="text-text-primary font-mono">
                  {((comp.rotation * 180 / Math.PI) % 360 + 360) % 360}°
                </span>
                <button
                  onClick={() => { rotateComponent(comp.id); }}
                  className="rounded-md border border-subtle bg-surface px-2 py-1 text-xs font-medium text-text-primary transition hover:border-accent hover:text-accent"
                  title="Rotate 90° clockwise (R)"
                >
                  ↻
                </button>
              </div>
            </div>
            <div className="flex items-center justify-between text-sm">
              <span className="text-text-secondary">Position</span>
              <span className="text-text-primary font-mono">
                ({comp.position.x.toFixed(0)}, {comp.position.y.toFixed(0)})
              </span>
            </div>
          </div>
        </div>

        {simResult && simResult.success && (
          <div className="rounded-lg border border-subtle bg-base p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Simulation</p>
            <div className="mt-4 space-y-3">
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Voltage</span>
                <span className="font-mono text-accent">
                  {simResult.componentVoltages[comp.id] !== undefined
                    ? formatVoltage(simResult.componentVoltages[comp.id])
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Current</span>
                <span className="font-mono text-accent">
                  {simResult.componentCurrents[comp.id] !== undefined
                    ? formatCurrent(simResult.componentCurrents[comp.id])
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <span className="text-text-secondary">Power</span>
                <span className="font-mono text-accent">
                  {simResult.componentPowers[comp.id] !== undefined
                    ? formatPower(simResult.componentPowers[comp.id])
                    : '—'}
                </span>
              </div>
            </div>
          </div>
        )}

        {simResult && !simResult.success && (
          <div className="rounded-lg border border-red/30 bg-red/10 p-5">
            <p className="text-xs uppercase tracking-[0.3em] text-red">Simulation Error</p>
            <p className="mt-2 text-sm text-red-300">{simResult.error ?? 'Unknown error'}</p>
          </div>
        )}
      </>
    );
  };

  return (
    <div className="space-y-5">
      <div className="rounded-lg border border-subtle bg-base p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Export</p>
        <div className="mt-4 grid grid-cols-3 gap-2">
          <button onClick={handleExportSVG}
            className="rounded-md border border-subtle bg-surface px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent hover:text-accent">SVG</button>
          <button onClick={handleExportPNG}
            className="rounded-md border border-subtle bg-surface px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent hover:text-accent">PNG</button>
          <button onClick={handleExportJSON}
            className="rounded-md border border-subtle bg-surface px-3 py-2 text-xs font-medium text-text-primary transition hover:border-accent hover:text-accent">JSON</button>
        </div>
      </div>

      <div className="rounded-lg border border-subtle bg-base p-5">
        <p className="text-xs uppercase tracking-[0.3em] text-text-secondary">Share</p>
        <div className="mt-4">
          {!showShare ? (
            <button
              onClick={handleShare}
              disabled={sharing || !currentProjectId}
              className="w-full rounded-md border border-subtle bg-surface px-4 py-2 text-sm font-medium text-text-primary transition hover:border-accent hover:text-accent disabled:opacity-40"
            >
              {sharing ? 'Generating…' : !currentProjectId ? 'Save project first' : 'Generate share link'}
            </button>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <input
                  data-share-url
                  readOnly
                  value={shareUrl}
                  className="flex-1 rounded-md border border-subtle bg-surface px-2 py-1.5 text-xs text-text-primary outline-none"
                  onClick={(e) => e.currentTarget.select()}
                />
                <button
                  onClick={handleCopyLink}
                  className="rounded-md border border-subtle bg-surface px-2.5 py-1.5 text-xs font-medium text-text-primary transition hover:border-accent hover:text-accent"
                >
                  Copy
                </button>
              </div>
              <p className="text-[10px] text-text-secondary/60">Anyone with this link can view your circuit.</p>
            </div>
          )}
        </div>
      </div>

      {renderBody()}
    </div>
  );
}

function renderSimProperties(
  simType: string,
  params: Record<string, number | string | boolean>,
  update: (key: string, value: number | string | boolean) => void
) {
  switch (simType) {
    case 'resistor':
      return (
        <>
          <Field label="Resistance" unit="Ω">
            <NumInput value={typeof params.resistance === 'number' ? params.resistance : 1000}
              onChange={(v) => update('resistance', v)} min={0} step={1} />
          </Field>
          <Field label="Tolerance" unit="%">
            <NumInput value={typeof params.tolerance === 'number' ? params.tolerance : 5}
              onChange={(v) => update('tolerance', v)} min={0} max={100} step={0.1} />
          </Field>
        </>
      );
    case 'battery':
      return (
        <>
          <Field label="Voltage" unit="V">
            <NumInput value={typeof params.voltage === 'number' ? params.voltage : 9}
              onChange={(v) => update('voltage', v)} min={0} step={0.1} />
          </Field>
          <Field label="Internal R" unit="Ω">
            <NumInput value={typeof params.internalResistance === 'number' ? params.internalResistance : 0.1}
              onChange={(v) => update('internalResistance', v)} min={0} step={0.01} />
          </Field>
        </>
      );
    case 'voltage_source':
      return (
        <>
          <Field label="Voltage" unit="V">
            <NumInput value={typeof params.voltage === 'number' ? params.voltage : 5}
              onChange={(v) => update('voltage', v)} min={0} step={0.1} />
          </Field>
          <Field label="Frequency" unit="Hz">
            <NumInput value={typeof params.frequency === 'number' ? params.frequency : 0}
              onChange={(v) => update('frequency', v)} min={0} step={1} />
          </Field>
        </>
      );
    case 'current_source':
      return (
        <Field label="Current" unit="A">
          <NumInput value={typeof params.current === 'number' ? params.current : 0.001}
            onChange={(v) => update('current', v)} min={0} step={0.0001} />
        </Field>
      );
    case 'led':
      return (
        <>
          <Field label="Forward V" unit="V">
            <NumInput value={typeof params.forwardVoltage === 'number' ? params.forwardVoltage : 2}
              onChange={(v) => update('forwardVoltage', v)} min={0} step={0.1} />
          </Field>
          <Field label="Max Current" unit="mA">
            <NumInput value={typeof params.maxCurrent === 'number' ? params.maxCurrent : 20}
              onChange={(v) => update('maxCurrent', v)} min={0} step={1} />
          </Field>
        </>
      );
    case 'diode':
      return (
        <Field label="Forward V" unit="V">
          <NumInput value={typeof params.forwardVoltage === 'number' ? params.forwardVoltage : 0.7}
            onChange={(v) => update('forwardVoltage', v)} min={0} step={0.01} />
        </Field>
      );
    case 'switch':
      return (
        <Field label="State">
          <button
            onClick={() => update('closed', params.closed === false ? true : false)}
            className={`rounded-md border px-3 py-1 text-xs font-medium transition ${
              params.closed === false
                ? 'border-red/40 bg-red/10 text-red hover:border-red'
                : 'border-green/40 bg-green/10 text-green hover:border-green'
            }`}
          >
            {params.closed === false ? '○ OPEN' : '● CLOSED'}
          </button>
        </Field>
      );
    default:
      return null;
  }
}
