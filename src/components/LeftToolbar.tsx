import { useCallback } from 'react';
import useDrawingStore from '@/store/drawingStore';
import { useCanvasStore } from '@/store/canvasStore';
import { useSimulationStore } from '@/store/simulationStore';
import useSchematicStore from '@/store/schematicStore';
import { useProjectStore } from '@/store/projectStore';

const TOOLS: { id: 'select' | 'wire' | 'pan'; label: string; shortcut: string; icon: React.ReactNode }[] = [
  {
    id: 'select',
    label: 'Select',
    shortcut: 'V',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 2v12l4-4 4 4 1-3-4-2 4-3-4-2z" />
      </svg>
    ),
  },
  {
    id: 'wire',
    label: 'Wire',
    shortcut: 'W',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
        <path d="M2 14L7 9" />
        <path d="M7 9l3-3" />
        <path d="M10 6l4-4" />
        <circle cx="7" cy="9" r="1.5" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
  {
    id: 'pan',
    label: 'Pan',
    shortcut: 'H',
    icon: (
      <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M8 2v12M2 8h12M5 5l3-3 3 3M5 11l3 3 3-3M11 5l3 3-3 3M5 5l-3 3 3 3" />
      </svg>
    ),
  },
];

export default function LeftToolbar() {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);
  const drawUndo = useDrawingStore((s) => s.undo);
  const drawRedo = useDrawingStore((s) => s.redo);
  const schematicUndo = useSchematicStore((s) => s.undo);
  const schematicRedo = useSchematicStore((s) => s.redo);
  const handleUndo = () => { try { schematicUndo(); } catch { drawUndo(); } };
  const handleRedo = () => { try { schematicRedo(); } catch { drawRedo(); } };
  const zoom = useCanvasStore((s) => s.zoom);
  const setCamera = useCanvasStore((s) => s.setCamera);
  const runSimulation = useSimulationStore((s) => s.runSimulation);
  const isRunning = useSimulationStore((s) => s.isRunning);
  const hasRun = useSimulationStore((s) => s.hasRun);
  const simResult = useSimulationStore((s) => s.result);
  const clearResults = useSimulationStore((s) => s.clearResults);

  const zoomToFit = useCallback(() => {
    const strokes = useDrawingStore.getState().strokes;
    const components = useSchematicStore.getState().components;
    const points: { x: number; y: number }[] = [];
    for (const s of strokes) for (const p of s.points) points.push(p);
    for (const c of components) points.push(c.position);
    if (points.length === 0) return;
    const canvasSize = useCanvasStore.getState().canvasSize;
    if (canvasSize.width === 0 || canvasSize.height === 0) return;
    const padding = 100;
    const minX = Math.min(...points.map((p) => p.x));
    const minY = Math.min(...points.map((p) => p.y));
    const maxX = Math.max(...points.map((p) => p.x));
    const maxY = Math.max(...points.map((p) => p.y));
    const contentW = maxX - minX || 1;
    const contentH = maxY - minY || 1;
    const zoomX = (canvasSize.width - padding * 2) / contentW;
    const zoomY = (canvasSize.height - padding * 2) / contentH;
    const state = useCanvasStore.getState();
    let zoom = Math.min(zoomX, zoomY);
    zoom = Math.max(state.minZoom, Math.min(state.maxZoom, zoom));
    const cx = (minX + maxX) / 2;
    const cy = (minY + maxY) / 2;
    useCanvasStore.getState().setCamera({ x: cx - (canvasSize.width / 2) / zoom, y: cy - (canvasSize.height / 2) / zoom }, zoom);
  }, []);

  return (
    <div
      className="flex flex-col items-center gap-2 rounded-xl border border-default bg-surface px-2.5 py-3 shadow-md"
      role="toolbar"
      aria-label="CAD tools"
    >
      {/* Tool buttons */}
      {TOOLS.map((t) => (
        <button
          key={t.id}
          title={`${t.label} (${t.shortcut})`}
          aria-label={t.label}
          aria-pressed={tool === t.id}
          onClick={() => setTool(t.id as any)}
          className={`flex h-9 w-9 items-center justify-center rounded-md transition-all duration-150 ${
            tool === t.id
              ? 'bg-accent text-black'
              : 'text-text-tertiary hover:text-white'
          }`}
        >
          {t.icon}
        </button>
      ))}

      {/* Divider */}
      <div className="my-1 h-px w-6 bg-border-subtle" />

      {/* Zoom controls */}
      <div className="flex flex-col items-center gap-1.5">
        <button
          title="Zoom in"
          aria-label="Zoom in"
          onClick={() => setCamera(useCanvasStore.getState().offset, Math.min(4, zoom * 1.15))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:text-white transition-colors text-lg leading-none"
        >
          +
        </button>
        <div className="text-xs text-text-tertiary tabular-nums">{Math.round(zoom * 100)}%</div>
        <button
          title="Zoom out"
          aria-label="Zoom out"
          onClick={() => setCamera(useCanvasStore.getState().offset, Math.max(0.25, zoom / 1.15))}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:text-white transition-colors text-lg leading-none"
        >
          −
        </button>
        <button
          title="Zoom to fit (Ctrl+0)"
          aria-label="Zoom to fit"
          onClick={zoomToFit}
          className="flex h-8 w-8 items-center justify-center rounded-md text-text-tertiary hover:text-white transition-colors text-xs"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <rect x="2" y="2" width="5" height="5" rx="1" />
            <rect x="9" y="2" width="5" height="5" rx="1" />
            <rect x="2" y="9" width="5" height="5" rx="1" />
            <rect x="9" y="9" width="5" height="5" rx="1" />
          </svg>
        </button>
      </div>

      {/* Divider */}
      <div className="my-1 h-px w-6 bg-border-subtle" />

      {/* Simulate */}
      <button
        title={simResult?.error ? `Error: ${simResult.error}` : 'Simulate'}
        aria-label="Run simulation"
        onClick={isRunning ? undefined : (hasRun ? clearResults : runSimulation)}
        className={`flex h-9 w-9 items-center justify-center rounded-md transition-all duration-150 ${
          isRunning ? 'opacity-50 cursor-wait'
          : simResult?.error ? 'text-red'
          : simResult?.success ? 'text-accent'
          : 'text-text-tertiary hover:text-white'
        }`}
      >
        {isRunning ? (
          <svg className="animate-spin h-4 w-4" viewBox="0 0 16 16" fill="none">
            <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
          </svg>
        ) : simResult?.success ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="4 8 7 11 12 5" />
          </svg>
        ) : simResult?.error ? (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <circle cx="8" cy="8" r="6" />
            <line x1="6" y1="6" x2="10" y2="10" />
            <line x1="10" y1="6" x2="6" y2="10" />
          </svg>
        ) : (
          <svg width="18" height="18" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
            <polygon points="5,3 13,8 5,13" />
          </svg>
        )}
      </button>

      {/* Divider */}
      <div className="my-1 h-px w-6 bg-border-subtle" />

      {/* Undo/Redo */}
      <div className="flex flex-col items-center gap-1">
        <button
          onClick={handleUndo}
          aria-label="Undo (Ctrl+Z)"
          title="Undo (Ctrl+Z)"
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="6 3 2 7 6 11" />
            <path d="M2 7h8a4 4 0 010 8H7" />
          </svg>
        </button>
        <button
          onClick={handleRedo}
          aria-label="Redo (Ctrl+Shift+Z)"
          title="Redo (Ctrl+Shift+Z)"
          className="flex h-9 w-9 items-center justify-center rounded-md text-text-tertiary hover:text-white transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="10 3 14 7 10 11" />
            <path d="M14 7H6a4 4 0 000 8h3" />
          </svg>
        </button>
      </div>
    </div>
  );
}
