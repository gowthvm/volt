import type { SchematicComponent } from '@/store/schematicStore';
import type { CircuitGraph } from '@/circuit/graph';
import { componentTerminalDefinitions } from '@/circuit/graph';

export function generateKiCadNetlist(components: SchematicComponent[], graph: CircuitGraph): string {
  const parts: string[] = [];
  const nonWires = components.filter((c) => c.type !== 'wire');

  parts.push('<?xml version="1.0" encoding="utf-8"?>');
  parts.push('<export version="D">');
  parts.push('  <design>');
  parts.push('    <source>Volt</source>');
  parts.push('    <date>' + new Date().toISOString() + '</date>');
  parts.push('    <tool>Volt</tool>');
  parts.push('  </design>');
  parts.push('  <components>');

  for (const comp of nonWires) {
    const refdes = comp.refdes || comp.id;
    const libName = comp.kicadSymbolId ? comp.kicadSymbolId.replace(/:/g, '_') : 'unknown';
    parts.push(`    <comp ref="${refdes}">`);
    parts.push(`      <value>${comp.value != null ? comp.value : refdes}</value>`);
    parts.push(`      <libsource lib="${libName}" part="${libName}" description=""/>`);
    parts.push(`      <sheetpath names="/" tstamps="/"/>`);
    parts.push('      <tstamp>' + comp.id.replace(/[^a-f0-9]/g, '') + '</tstamp>');
    parts.push('    </comp>');
  }

  parts.push('  </components>');
  parts.push('  <libparts>');

  for (const comp of nonWires) {
    if (!comp.kicadSymbolId) continue;
    const libName = comp.kicadSymbolId.replace(/:/g, '_');
    parts.push(`    <libpart lib="${libName}" part="${libName}" description="">`);
    parts.push('      <footprints/>');
    const pinDefs = componentTerminalDefinitions(comp);
    for (const pin of pinDefs) {
      parts.push(`      <pin num="${pin.name}" name="${pin.name}" type="${pin.role}"/>`);
    }
    parts.push('    </libpart>');
  }

  parts.push('  </libparts>');
  parts.push('  <nets>');

  // Group connected terminals into nets
  const visited = new Set<string>();
  let netIndex = 0;

  for (const terminal of graph.terminals) {
    if (visited.has(terminal.id)) continue;
    const stack = [terminal.id];
    const group: string[] = [];
    while (stack.length > 0) {
      const tid = stack.pop()!;
      if (visited.has(tid)) continue;
      visited.add(tid);
      group.push(tid);
      const neighbors = graph.adjacency[tid] ?? [];
      for (const n of neighbors) {
        if (!visited.has(n)) stack.push(n);
      }
    }

    const netName = `NET_${++netIndex}`;
    parts.push(`    <net code="${netIndex}" name="${netName}">`);
    for (const tid of group) {
      const [compId, termName] = tid.split(':');
      const comp = nonWires.find((c) => c.id === compId);
      if (comp) {
        const refdes = comp.refdes || compId;
        parts.push(`      <node ref="${refdes}" pin="${termName}"/>`);
      }
    }
    parts.push('    </net>');
  }

  parts.push('  </nets>');
  parts.push('</export>');

  return parts.join('\n');
}

export function downloadKiCadNetlist(components: SchematicComponent[], graph: CircuitGraph): void {
  const xml = generateKiCadNetlist(components, graph);
  const blob = new Blob([xml], { type: 'application/xml' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'circuit.net';
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
