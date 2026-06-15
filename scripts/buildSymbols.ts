import { readFileSync, writeFileSync, mkdirSync, existsSync, readdirSync, rmSync, copyFileSync } from 'fs';
import { join, relative } from 'path';
import { parseSExpr } from './parseKicadSym';
import { extractSymbols, resolveExtends } from './extractSymbols';
import { generateSvg, computePinoutGeometry, SVG_PADDING, collectBodyPoints, computeNamePlacements } from './generateSvg';
import type { NormalizedSymbol, SymbolEntry, SymbolCatalog, SvgCoordPin, Point } from './types';

/** Compute normalized pin positions in SVG viewBox space (same coords as the rendered SVG) */
function computeSvgCoordPins(symbol: NormalizedSymbol): { pins: SvgCoordPin[]; viewBox: { w: number; h: number } } | null {
  if (symbol.pins.length === 0) return null;

  // Pinout-box symbols (>6 pins): use algorithmic positions that match the SVG exactly
  if (symbol.pins.length > 6) {
    const geo = computePinoutGeometry(symbol.pins);
    const pinMap = new Map(geo.pins.map((p) => [`${p.number}:${p.name}`, p.connectionPoint]));
    const pins: SvgCoordPin[] = symbol.pins.map((pin) => {
      const key = `${pin.number}:${pin.name}`;
      const cp = pinMap.get(key);
      return {
        name: pin.name,
        number: pin.number,
        x: cp ? cp.x : pin.pos.x,
        y: cp ? cp.y : pin.pos.y,
      };
    });
    return { pins, viewBox: { w: geo.fullW, h: geo.fullH } };
  }

  // For small symbols (≤6 pins): normalize raw KiCad positions
  const bodyPts = collectBodyPoints(symbol);
  if (bodyPts.length === 0) return null;
  let bodyMinX = Infinity, bodyMinY = Infinity, bodyMaxX = -Infinity, bodyMaxY = -Infinity;
  for (const p of bodyPts) {
    if (p.x < bodyMinX) bodyMinX = p.x;
    if (p.y < bodyMinY) bodyMinY = p.y;
    if (p.x > bodyMaxX) bodyMaxX = p.x;
    if (p.y > bodyMaxY) bodyMaxY = p.y;
  }
  const bodyBox = { minX: bodyMinX, minY: bodyMinY, maxX: bodyMaxX, maxY: bodyMaxY };
  const namePlacements = computeNamePlacements(symbol, bodyBox);
  const allPts = [...bodyPts];
  for (const np of namePlacements) {
    allPts.push(np.pos);
    const rad = (np.pin.orientation * Math.PI) / 180;
    const halfFont = np.fontSize / 2;
    allPts.push({ x: np.pos.x + Math.cos(rad) * halfFont, y: np.pos.y + Math.sin(rad) * halfFont });
  }
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of allPts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  const dx = -minX + SVG_PADDING;
  const dy = maxY + SVG_PADDING;
  const vw = maxX - minX + SVG_PADDING * 2;
  const vh = maxY - minY + SVG_PADDING * 2;
  const pins: SvgCoordPin[] = symbol.pins.map((pin) => {
    const rad = (pin.orientation * Math.PI) / 180;
    const tipX = pin.pos.x + pin.length * Math.cos(rad);
    const tipY = pin.pos.y + pin.length * Math.sin(rad);
    return {
      name: pin.name,
      number: pin.number,
      x: tipX + dx,
      y: -tipY + dy,
    };
  });
  return { pins, viewBox: { w: vw, h: vh } };
}

const KICAD_SYMBOLS_DIR = join(import.meta.dirname, '..', 'kicad-symbols');
const OUTPUT_DIR = join(import.meta.dirname, '..', 'src', 'assets', 'symbols');
const PREVIEWS_DIR = join(OUTPUT_DIR, 'previews');
const PUBLIC_DIR = join(import.meta.dirname, '..', 'public');
const CATALOG_PATH = join(OUTPUT_DIR, 'catalog.json');

function walkDir(dir: string): string[] {
  const results: string[] = [];
  try {
    const entries = readdirSync(dir, { withFileTypes: true });
    for (const entry of entries) {
      const full = join(dir, entry.name);
      if (entry.isDirectory()) {
        results.push(...walkDir(full));
      } else if (entry.isFile() && entry.name.endsWith('.kicad_sym')) {
        results.push(full);
      }
    }
  } catch {
    // permission issues, skip
  }
  return results;
}

function deduplicateSymbols(symbols: NormalizedSymbol[]): NormalizedSymbol[] {
  const seen = new Map<string, NormalizedSymbol>();
  for (const sym of symbols) {
    const key = sym.id;
    if (!seen.has(key) || sym.sourceFile.includes('Device')) {
      seen.set(key, sym);
    }
  }
  return Array.from(seen.values());
}

async function main() {
  console.log('[build-symbols] Scanning KiCad symbols library...');
  console.log(`[build-symbols] Library path: ${KICAD_SYMBOLS_DIR}`);

  if (!existsSync(KICAD_SYMBOLS_DIR)) {
    console.error(`[build-symbols] ERROR: KiCad symbols directory not found at ${KICAD_SYMBOLS_DIR}`);
    console.error('[build-symbols] Clone the repo into kicad-symbols/ or update KICAD_SYMBOLS_DIR');
    process.exit(1);
  }

  const files = walkDir(KICAD_SYMBOLS_DIR);
  console.log(`[build-symbols] Found ${files.length} .kicad_sym files`);

  mkdirSync(PREVIEWS_DIR, { recursive: true });

  // Clean old previews
  console.log('[build-symbols] Cleaning old previews...');
  if (existsSync(PREVIEWS_DIR)) {
    for (const f of readdirSync(PREVIEWS_DIR)) rmSync(join(PREVIEWS_DIR, f));
  }

  let totalSymbols = 0;
  let totalParsed = 0;
  let totalErrors = 0;
  const allSymbols: NormalizedSymbol[] = [];

  // --- Pass 1: extract raw symbols from all files ---
  for (let i = 0; i < files.length; i++) {
    const filePath = files[i];
    const relPath = relative(KICAD_SYMBOLS_DIR, filePath);
    if (i % 1000 === 0 && i > 0) {
      console.log(`[build-symbols] ... ${i}/${files.length} files processed (${totalSymbols} symbols extracted)`);
    }

    try {
      const content = readFileSync(filePath, 'utf-8');
      const sexprs = parseSExpr(content);
      const symbols = extractSymbols(sexprs, relPath);
      totalParsed++;
      totalSymbols += symbols.length;
      allSymbols.push(...symbols);
    } catch (err) {
      totalErrors++;
      if (totalErrors <= 10) {
        console.warn(`[warn] Failed to parse ${relPath}: ${err}`);
      }
    }
  }

  console.log(`[build-symbols] Parsed ${totalParsed} files, ${totalErrors} errors`);
  console.log(`[build-symbols] Extracted ${totalSymbols} raw symbols`);

  // --- Pass 2: resolve extends/inheritance ---
  const symbolIndex = new Map<string, NormalizedSymbol>();
  for (const sym of allSymbols) symbolIndex.set(sym.id, sym);
  // Resolve in passes to handle chains (A→B→C)
  let resolvedCount = 0;
  for (const sym of allSymbols) {
    if (sym.extends) {
      const chain = new Set<string>();
      let current: string | undefined = sym.extends;
      while (current) {
        if (chain.has(current)) break; // cycle guard
        chain.add(current);
        const parent = symbolIndex.get(current);
        current = parent?.extends;
      }
      resolveExtends([sym], symbolIndex);
      resolvedCount++;
    }
  }
  if (resolvedCount > 0) {
    console.log(`[build-symbols] Resolved ${resolvedCount} symbols via extends/inheritance`);
  }

  const unique = deduplicateSymbols(allSymbols);
  console.log(`[build-symbols] ${unique.length} unique symbols after dedup`);

  // Generate SVG previews + build lightweight entries
  let svgCount = 0;
  let svgErrors = 0;
  let placeholderCount = 0;
  const svgErrorReasons = new Map<string, number>();
  const entries: SymbolEntry[] = [];

  // Collect normalized pin data for all symbols (stored separately from catalog)
  const normalizedPinsMap: Record<string, { viewBox: { w: number; h: number }; pins: SvgCoordPin[] }> = {};

  for (const sym of unique) {
    let hasSvg = false;
    const noGraphics = sym.graphics.length === 0 && sym.pins.length === 0;
    let viewBox: { w: number; h: number } | undefined;
    try {
      const svg = generateSvg(sym);
      const svgPath = join(PREVIEWS_DIR, `${sym.id}.svg`);
      writeFileSync(svgPath, svg, 'utf-8');
      svgCount++;
      hasSvg = true;
      if (noGraphics) placeholderCount++;
    } catch (err) {
      svgErrors++;
      const reason = (err as Error)?.message?.slice(0, 60) ?? 'unknown';
      svgErrorReasons.set(reason, (svgErrorReasons.get(reason) ?? 0) + 1);
      if (svgErrors <= 10) console.warn(`[warn] SVG fail "${sym.id}": ${err}`);
    }

    // Compute normalized pin positions (SVG viewBox space) — stored separately from catalog
    const pinResult = computeSvgCoordPins(sym);
    if (pinResult) {
      normalizedPinsMap[sym.id] = { pins: pinResult.pins, viewBox: pinResult.viewBox };
    }

    entries.push({
      id: sym.id,
      name: sym.name,
      reference: sym.reference,
      description: sym.description,
      keywords: sym.keywords,
      fpFilters: sym.fpFilters,
      datasheet: sym.datasheet,
      units: sym.units,
      sourceFile: sym.sourceFile,
      hasSvg,
    });
  }
  console.log(`[build-symbols] Generated ${svgCount} SVG previews (${placeholderCount} placeholders, ${svgErrors} errors)`);
  if (svgErrorReasons.size > 0) {
    console.log('[build-symbols] SVG error breakdown:');
    for (const [reason, count] of svgErrorReasons) {
      console.log(`  ${reason}: ${count}`);
    }
  }

  // Build lightweight catalog
  const catalog: SymbolCatalog = {
    version: '1.0.0',
    generated: new Date().toISOString(),
    count: entries.length,
    symbols: entries,
  };

  writeFileSync(CATALOG_PATH, JSON.stringify(catalog), 'utf-8');
  console.log(`[build-symbols] Catalog written to ${CATALOG_PATH}`);
  console.log(`[build-symbols] Catalog size: ${(Buffer.byteLength(JSON.stringify(catalog)) / 1024 / 1024).toFixed(1)} MB`);

  // Write pins data for wire routing (to public/ so Vite serves without processing)
  type PinsMap = Record<string, Array<{ number: string; name: string; x: number; y: number; length: number; orientation: number; electricalType: string }>>;
  const pinsMap: PinsMap = {};
  for (const sym of allSymbols) {
    if (sym.pins.length > 0) {
      pinsMap[sym.id] = sym.pins.map((p) => ({
        number: p.number,
        name: p.name,
        x: p.pos.x,
        y: p.pos.y,
        length: p.length,
        orientation: p.orientation,
        electricalType: p.electricalType,
      }));
    }
  }
  const PUBLIC_SYMBOLS_DIR = join(PUBLIC_DIR, 'assets', 'symbols');
  mkdirSync(PUBLIC_SYMBOLS_DIR, { recursive: true });
  const PINS_PATH = join(PUBLIC_SYMBOLS_DIR, 'pins.json');
  writeFileSync(PINS_PATH, JSON.stringify(pinsMap), 'utf-8');
  console.log(`[build-symbols] Pins data written to ${PINS_PATH}`);
  console.log(`[build-symbols] Pins data size: ${(Buffer.byteLength(JSON.stringify(pinsMap)) / 1024 / 1024).toFixed(1)} MB (${Object.keys(pinsMap).length} symbols)`);

  // Write normalized pin positions ± viewBox for terminal dot alignment (separate from catalog)
  const NORMALIZED_PINS_PATH = join(PUBLIC_SYMBOLS_DIR, 'normalized-pins.json');
  writeFileSync(NORMALIZED_PINS_PATH, JSON.stringify(normalizedPinsMap), 'utf-8');
  const npSize = Buffer.byteLength(JSON.stringify(normalizedPinsMap)) / 1024 / 1024;
  console.log(`[build-symbols] Normalized pins + viewBox data written to ${NORMALIZED_PINS_PATH}`);
  console.log(`[build-symbols] Normalized pins size: ${npSize.toFixed(1)} MB (${Object.keys(normalizedPinsMap).length} symbols)`);

  // Copy SVG previews to public/ so they're served at runtime
  const PUBLIC_PREVIEWS_DIR = join(PUBLIC_SYMBOLS_DIR, 'previews');
  mkdirSync(PUBLIC_PREVIEWS_DIR, { recursive: true });
  if (existsSync(PREVIEWS_DIR)) {
    for (const f of readdirSync(PREVIEWS_DIR)) {
      copyFileSync(join(PREVIEWS_DIR, f), join(PUBLIC_PREVIEWS_DIR, f));
    }
  }
  console.log(`[build-symbols] SVG previews copied to ${PUBLIC_PREVIEWS_DIR}`);
  console.log('[build-symbols] Done.');
}

main().catch((err) => {
  console.error('[build-symbols] Fatal error:', err);
  process.exit(1);
});
