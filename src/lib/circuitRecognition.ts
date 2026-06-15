import type { RecognizedComponent } from '@/store/recognitionStore';
import { preprocessStrokes, denormalizePosition } from './strokePreprocessing';
import useDrawingStore from '@/store/drawingStore';

export interface AIComponent {
  id?: string;
  type: string;
  value?: string;
  position: { x: number; y: number };
  rotation: number;
  strokeIndices?: number[];
}

export interface AIWire {
  from: { componentId: string; terminal: string };
  to: { componentId: string; terminal: string };
  strokeIndices?: number[];
}

export interface AIResult {
  components: AIComponent[];
  wires: AIWire[];
  unrecognized: number[];
  raw?: string;
}

export function extractStrokesFromSketch(): {
  strokeData: { id: string; points: { x: number; y: number }[] }[];
  preprocessingResult: ReturnType<typeof preprocessStrokes>;
} {
  const strokes = useDrawingStore.getState().strokes;
  const penStrokes = strokes.filter((s) => s.tool === 'pen');
  const strokeData = penStrokes.map((s) => ({
    id: s.id,
    points: s.points.map((p) => ({ x: p.x, y: p.y })),
  }));
  const preprocessingResult = preprocessStrokes(strokeData);
  return { strokeData, preprocessingResult };
}

export async function recognizeCircuitFromStrokes(): Promise<{
  result: AIResult;
  originalBounds: { minX: number; minY: number; maxX: number; maxY: number };
  recognized: RecognizedComponent[];
}> {
  const { strokeData, preprocessingResult } = extractStrokesFromSketch();

  if (strokeData.length === 0) {
    console.warn('[recognizeCircuit] No pen strokes found');
    throw new Error('No pen strokes to recognize. Draw a circuit first.');
  }

  console.log('[recognizeCircuit]', strokeData.length, 'strokes, normalized text length:', preprocessingResult.normalizedText.length);

  // Try AI edge function first
  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
  const aiAvailable = !!(supabaseUrl && anonKey);

  let aiResult: AIResult | null = null;
  let aiError: string | null = null;

  if (aiAvailable) {
    try {
      console.log('[recognizeCircuit] Fetching edge function...');
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(`${supabaseUrl}/functions/v1/parse-circuit`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${anonKey}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ strokesText: preprocessingResult.normalizedText }),
        signal: controller.signal,
      });
      clearTimeout(timeout);
      console.log('[recognizeCircuit] Response status:', res.status);

      if (!res.ok) {
        const errBody = await res.text();
        console.error('[recognizeCircuit] Error body:', errBody);
        if (res.status === 404) {
          aiError = 'AI recognition edge function not deployed (404). Deploy with: supabase functions deploy parse-circuit';
        } else if (res.status === 401 || res.status === 403) {
          aiError = 'AI recognition unavailable — check your Supabase anon key.';
        } else {
          aiError = `Edge function error (${res.status}): ${errBody}`;
        }
      } else {
        const data = await res.json();
        console.log('[recognizeCircuit] Response data:', { components: data.components?.length, unrecognized: data.unrecognized?.length });
        if (data.error) {
          aiError = data.error;
        } else {
          aiResult = {
            components: data.components ?? [],
            wires: data.wires ?? [],
            unrecognized: data.unrecognized ?? [],
            raw: data.raw,
          };
        }
      }
    } catch (err: unknown) {
      if (err instanceof DOMException && err.name === 'AbortError') {
        aiError = 'Recognition request timed out after 15 seconds.';
      } else if (err instanceof TypeError && err.message === 'Failed to fetch') {
        aiError = 'Cannot reach recognition service. Ensure the parse-circuit edge function is deployed and CORS headers are set.';
      } else {
        aiError = err instanceof Error ? err.message : 'Unknown fetch error';
      }
      console.error('[recognizeCircuit] Fetch error:', aiError);
    }
  } else {
    aiError = 'AI recognition not configured — set VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in .env.local';
  }

  // If AI returned a result, use it
  if (aiResult) {
    const recognized: RecognizedComponent[] = [];
    const bounds = preprocessingResult.originalBounds;

    for (const comp of aiResult.components) {
      const position = denormalizePosition(comp.position, bounds);
      recognized.push({
        type: comp.type,
        position,
        rotation: comp.rotation ?? 0,
        scale: { x: 1, y: 1 },
        value: comp.value ? parseFloat(comp.value) || undefined : undefined,
        confidence: 0.8,
        kicadSymbolId: mapTypeToKicad(comp.type).kicadSymbolId,
        strokeIndices: comp.strokeIndices,
      });
    }

    console.log('[recognizeCircuit] AI recognized', recognized.length, 'components');
    return { result: aiResult, originalBounds: bounds, recognized };
  }

  // Fallback: use local rule-based recognition
  console.log('[recognizeCircuit] Falling back to local recognition. AI error:', aiError);
  const { recognizeStroke } = await import('@/recognition');

  const components: AIComponent[] = [];
  const unrecognized: number[] = [];
  const rawStrokes = useDrawingStore.getState().strokes.filter((s) => s.tool === 'pen');

  rawStrokes.forEach((stroke, idx) => {
    const result = recognizeStroke(stroke.points);
    if (result.type !== 'unknown') {
      components.push({
        id: `local-${idx}`,
        type: mapComponentType(result.type),
        position: result.position,
        rotation: result.rotation,
        strokeIndices: [idx],
      });
    } else {
      unrecognized.push(idx);
    }
  });

  const localResult: AIResult = {
    components,
    wires: [],
    unrecognized,
  };

  const recognized: RecognizedComponent[] = [];
  const bounds = preprocessingResult.originalBounds;

  for (const comp of localResult.components) {
    const position = denormalizePosition(comp.position, bounds);
    recognized.push({
      type: comp.type,
      position,
      rotation: comp.rotation ?? 0,
      scale: { x: 1, y: 1 },
      confidence: 0.6,
      kicadSymbolId: mapTypeToKicad(comp.type).kicadSymbolId,
      strokeIndices: comp.strokeIndices,
    });
  }

  return { result: localResult, originalBounds: bounds, recognized };
}

function mapComponentType(t: string): string {
  if (t === 'wire') return 'wire';
  if (t === 'unknown') return 'unknown';
  return t;
}

export async function recognizeCircuitFromImageUpload(
  file: Blob
): Promise<{ result: AIResult; originalBounds: { minX: number; minY: number; maxX: number; maxY: number }; recognized: RecognizedComponent[] }> {
  const strokes = await extractStrokesFromImage(file);
  const preprocessingResult = preprocessStrokes(strokes);

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
  const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

  if (!supabaseUrl || !anonKey) {
    throw new Error('AI recognition not configured.');
  }

  let aiResult: AIResult;

  try {
    const res = await fetch(`${supabaseUrl}/functions/v1/parse-circuit`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${anonKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ strokesText: preprocessingResult.normalizedText }),
    });

    if (!res.ok) {
      const errBody = await res.text();
      throw new Error(`Edge function error (${res.status}): ${errBody}`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    aiResult = {
      components: data.components ?? [],
      wires: data.wires ?? [],
      unrecognized: data.unrecognized ?? [],
      raw: data.raw,
    };
  } catch (err) {
    if (err instanceof TypeError && err.message === 'Failed to fetch') {
      throw new Error('Cannot reach recognition service. Check CORS headers on the edge function.');
    }
    throw err;
  }

  const recognized: RecognizedComponent[] = [];
  const bounds = preprocessingResult.originalBounds;

  for (const comp of aiResult.components) {
    const position = denormalizePosition(comp.position, bounds);
    recognized.push({
      type: comp.type,
      position,
      rotation: comp.rotation ?? 0,
      scale: { x: 1, y: 1 },
      value: comp.value ? parseFloat(comp.value) || undefined : undefined,
      confidence: 0.8,
      kicadSymbolId: mapTypeToKicad(comp.type).kicadSymbolId,
      strokeIndices: comp.strokeIndices,
    });
  }

  return { result: aiResult, originalBounds: bounds, recognized };
}

async function extractStrokesFromImage(file: Blob): Promise<{ id: string; points: { x: number; y: number }[] }[]> {
  const bitmap = await createImageBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = Math.min(bitmap.width, 800);
  canvas.height = Math.min(bitmap.height, 600);
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const { data, width, height } = imageData;

  const visited = new Uint8Array(width * height);
  const strokes: { id: string; points: { x: number; y: number }[] }[] = [];
  let strokeCounter = 0;

  const isDark = (x: number, y: number) => {
    if (x < 0 || x >= width || y < 0 || y >= height) return false;
    const idx = (y * width + x) * 4;
    const brightness = data[idx] * 0.299 + data[idx + 1] * 0.587 + data[idx + 2] * 0.114;
    return brightness < 160;
  };

  const neighbors = [
    { dx: 1, dy: 0 }, { dx: -1, dy: 0 }, { dx: 0, dy: 1 }, { dx: 0, dy: -1 },
    { dx: 1, dy: 1 }, { dx: -1, dy: -1 }, { dx: 1, dy: -1 }, { dx: -1, dy: 1 },
  ];

  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      const idx = y * width + x;
      if (visited[idx]) continue;
      if (!isDark(x, y)) continue;

      const points: { x: number; y: number }[] = [];
      const queue: { x: number; y: number }[] = [{ x, y }];
      visited[idx] = 1;

      while (queue.length > 0) {
        const p = queue.shift()!;
        points.push({ x: p.x, y: p.y });
        for (const n of neighbors) {
          const nx = p.x + n.dx;
          const ny = p.y + n.dy;
          const nIdx = ny * width + nx;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height && !visited[nIdx] && isDark(nx, ny)) {
            visited[nIdx] = 1;
            queue.push({ x: nx, y: ny });
          }
        }
      }

      if (points.length > 20) {
        strokes.push({
          id: `img-${strokeCounter++}`,
          points,
        });
      }
    }
  }

  return strokes;
}

export function mapTypeToKicad(type: string): { kicadSymbolId: string; simType?: string } {
  const t = type.toLowerCase();
  if (t === 'resistor' || t === 'r') return { kicadSymbolId: 'Device:R', simType: 'resistor' };
  if (t === 'capacitor' || t === 'c') return { kicadSymbolId: 'Device:C', simType: 'capacitor' };
  if (t === 'inductor' || t === 'l') return { kicadSymbolId: 'Device:L', simType: 'inductor' };
  if (t === 'battery' || t === 'bat') return { kicadSymbolId: 'Device:Battery', simType: 'battery' };
  if (t === 'diode' || t === 'd') return { kicadSymbolId: 'Device:D', simType: 'diode' };
  if (t === 'led') return { kicadSymbolId: 'Device:LED', simType: 'led' };
  if (t === 'ground' || t === 'gnd') return { kicadSymbolId: 'Device:GND', simType: 'ground' };
  if (t === 'switch' || t === 'sw') return { kicadSymbolId: 'Device:SW_Push', simType: 'switch' };
  if (t === 'wire' || t === 'voltage_source') return { kicadSymbolId: '' };
  return { kicadSymbolId: '' };
}
