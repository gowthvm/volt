let type: string | null = null;
let kicadId: string | null = null;

export function setDragComponentType(t: string | null, kicadSymbolId?: string) {
  type = t;
  kicadId = kicadSymbolId ?? null;
}

export function getDragComponentType(): string | null {
  return type;
}

export function getDragKicadSymbolId(): string | null {
  return kicadId;
}

export function clearDragContext() {
  type = null;
  kicadId = null;
}

export function inferParams(symId: string): Record<string, string | number | boolean> | undefined {
  if (symId.startsWith('gnd')) return { simType: 'ground' };
  if (symId === 'r') return { simType: 'resistor' };
  if (symId === 'battery') return { simType: 'battery' };
  if (symId === 'led') return { simType: 'led' };
  if (symId === 'd') return { simType: 'diode' };
  if (symId.startsWith('sw_')) return { simType: 'switch', closed: true };
  if (symId === 'c') return { simType: 'capacitor' };
  if (symId === 'l') return { simType: 'inductor' };
  return undefined;
}
