import { readFileSync, writeFileSync, readdirSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { parseSExpr } from './parseKicadSym';
import { extractSymbols } from './extractSymbols';
import { generateSvg } from './generateSvg';

const KICAD_DIR = join(import.meta.dirname, '..', 'kicad-symbols');
const PREVIEWS_DIR = join(import.meta.dirname, '..', 'public', 'assets', 'symbols', 'previews');
const AUDIT_DIR = join(import.meta.dirname, '..', 'audit-output');
const CATALOG_PATH = join(import.meta.dirname, '..', 'src', 'assets', 'symbols', 'catalog.json');

interface Issue {
  id: string;
  file?: string;
  category: string;
  severity: 'high' | 'medium' | 'low';
  description: string;
  suggestion: string;
}

const issues: Issue[] = [];

function checkSvg(id: string, svg: string) {
  // Check for common issues
  const vboxMatch = svg.match(/viewBox="([^"]+)"/);
  if (!vboxMatch) return;

  const vb = vboxMatch[1];
  const [_, vw, vh] = vb.split(/\s+/).map(Number);

  // Issue: placeholder symbols (no graphics, no pins) - should show text
  if (svg.includes('<text')) {
    const textCount = (svg.match(/<text/g) || []).length;
    // Check if text has font-size > 0
    if (svg.match(/font-size="0"/)) {
      issues.push({ id, category: 'text', severity: 'high', description: 'Text has font-size 0', suggestion: 'Fix font size' });
    }
  }

  // Issue: check hidden pins still visible
  if (svg.includes('fill="none"') && !svg.includes('<text')) {
    // Symbols with no graphics and no text might be issues
  }

  // Issue: arc rendering
  if (svg.includes('A ')) {
    // Verify arc params exist
    const arcPath = svg.match(/<path[^>]*A\s+[\d.]+\s+[\d.]+\s+0\s+[01]\s+[01]/);
    if (!arcPath) {
      issues.push({ id, category: 'arc', severity: 'high', description: 'Arc path malformed', suggestion: 'Check computeArcParams output' });
    }
  }
}

// Audit from previews first
console.log('Scanning preview SVGs for common issues...');
let count = 0;
for (const f of readdirSync(PREVIEWS_DIR)) {
  if (!f.endsWith('.svg')) continue;
  count++;
  const svg = readFileSync(join(PREVIEWS_DIR, f), 'utf-8');
  checkSvg(f.replace('.svg', ''), svg);
  if (count % 1000 === 0) console.log(`  ... ${count} checked`);
}

console.log(`\nChecked ${count} SVGs, found ${issues.length} issues:`);
for (const iss of issues) {
  console.log(`  [${iss.severity}] ${iss.id}: ${iss.description}`);
}

// Now do deep-dive on specific known symbols
console.log('\n--- Deep-dive on specific symbols ---\n');

const deepDives = [
  // Inductor - check arc rendering
  { file: join(KICAD_DIR, 'Device.kicad_symdir', 'L.kicad_sym'), id: 'L' },
  // Battery - check fill=outline
  { file: join(KICAD_DIR, 'Device.kicad_symdir', 'Battery.kicad_sym'), id: 'Battery' },
  // LED - check fill=outline  
  { file: join(KICAD_DIR, 'Device.kicad_symdir', 'LED.kicad_sym'), id: 'LED' },
  // NPN
  { file: join(KICAD_DIR, 'Device.kicad_symdir', 'Q_NPN_ECB.kicad_sym'), id: 'Q_NPN_ECB' },
  // PNP
  { file: join(KICAD_DIR, 'Device.kicad_symdir', 'Q_PNP_ECB.kicad_sym'), id: 'Q_PNP_ECB' },
  // NMOS
  { file: join(KICAD_DIR, 'Device.kicad_symdir', 'Q_NMOS_GDS.kicad_sym'), id: 'Q_NMOS_GDS' },
  // VCC power symbol
  { file: join(KICAD_DIR, 'power.kicad_symdir', 'VCC.kicad_sym'), id: 'VCC' },
  // GND power symbol
  { file: join(KICAD_DIR, 'power.kicad_symdir', 'GND.kicad_sym'), id: 'GND' },
  // BQ297xy pinout-box
  { file: join(KICAD_DIR, 'Battery_Management.kicad_symdir', 'BQ297xy.kicad_sym'), id: 'BQ297xy' },
];

mkdirSync(AUDIT_DIR, { recursive: true });

for (const dd of deepDives) {
  if (!existsSync(dd.file)) {
    console.log(`\n=== ${dd.id}: FILE NOT FOUND ===`);
    continue;
  }
  try {
    const content = readFileSync(dd.file, 'utf-8');
    const sexprs = parseSExpr(content);
    const symbols = extractSymbols(sexprs, dd.file);
    const sym = symbols.find((s: any) => s.id === dd.id);
    if (!sym) {
      console.log(`\n=== ${dd.id}: NOT FOUND in ${dd.file} ===`);
      console.log(`  Available: ${symbols.map((s: any) => s.id).join(', ')}`);
      continue;
    }
    const svg = generateSvg(sym);
    const outPath = join(AUDIT_DIR, `${dd.id}.svg`);
    writeFileSync(outPath, svg, 'utf-8');

    const pinNames = sym.pins.filter((p: any) => p.name).map((p: any) => `${p.number}="${p.name}"`);
    const hasFill = svg.includes('fill="') && !svg.includes('fill="none"');
    const hasArc = svg.includes('A ');
    console.log(`\n=== ${dd.id}: ${sym.pins.length} pins, ${sym.graphics.length} graphics ===`);
    console.log(`  Pin names: ${pinNames.join(', ')}`);
    console.log(`  viewBox: ${svg.match(/viewBox="([^"]+)"/)?.[1]}`);
    console.log(`  Has fill: ${hasFill}, Has arcs: ${hasArc}`);
    console.log(`  Saved to: ${outPath}`);
    // Print SVG content
    console.log(svg);
  } catch (e: any) {
    console.log(`\n=== ${dd.id}: ERROR ${e.message} ===`);
  }
}
