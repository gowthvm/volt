import type { NormalizedPinPos } from '@/store/schematicStore';

interface CachedSymbolData {
  normalizedPinPositions: NormalizedPinPos[];
  symbolViewBox: { w: number; h: number };
}

interface RawNormalizedEntry {
  viewBox: { w: number; h: number };
  pins: Array<{ name: string; number: string; x: number; y: number }>;
}

interface RawPinsEntry {
  number: string;
  name: string;
  x: number;
  y: number;
  length: number;
  orientation: number;
  electricalType: string;
}

let normalizedCache: Record<string, RawNormalizedEntry> | null = null;
let normalizedPromise: Promise<void> | null = null;

let pinsCache: Record<string, RawPinsEntry[]> | null = null;
let pinsPromise: Promise<void> | null = null;

async function ensureNormalizedLoaded(): Promise<void> {
  if (normalizedCache) return;
  if (normalizedPromise) return normalizedPromise;
  normalizedPromise = (async () => {
    try {
      const resp = await fetch('/assets/symbols/normalized-pins.json');
      if (resp.ok) {
        normalizedCache = await resp.json();
      }
    } catch {
      normalizedCache = {};
    }
  })();
  return normalizedPromise;
}

async function ensurePinsLoaded(): Promise<void> {
  if (pinsCache) return;
  if (pinsPromise) return pinsPromise;
  pinsPromise = (async () => {
    try {
      const resp = await fetch('/assets/symbols/pins.json');
      if (resp.ok) {
        pinsCache = await resp.json();
      }
    } catch {
      pinsCache = {};
    }
  })();
  return pinsPromise;
}

export function getNormalizedPins(symId: string): CachedSymbolData | null {
  if (!normalizedCache) return null;
  const entry = normalizedCache[symId];
  if (!entry) return null;
  return {
    normalizedPinPositions: entry.pins.map((pd) => ({
      name: pd.name,
      number: pd.number,
      x: pd.x,
      y: pd.y,
    })),
    symbolViewBox: entry.viewBox,
  };
}

export function getKicadPins(symId: string): RawPinsEntry[] | null {
  if (!pinsCache) return null;
  return pinsCache[symId] ?? null;
}

export function preloadPinData(): Promise<void> {
  return ensureNormalizedLoaded();
}

export function preloadAllPinData(): Promise<void[]> {
  return Promise.all([ensureNormalizedLoaded(), ensurePinsLoaded()]);
}
