import { useState, useCallback } from 'react';
import useBlueprintStore from '@/store/blueprintStore';
import { recognizeCircuitFromImageUpload } from '@/lib/circuitRecognition';
import useEditorModeStore from '@/store/editorModeStore';
import useSchematicStore from '@/store/schematicStore';

export default function ConvertOverlay({
  onClose,
}: {
  onClose: () => void;
}) {
  const [phase, setPhase] = useState<'idle' | 'analysing' | 'success' | 'error'>('idle');
  const [result, setResult] = useState<{ count: number } | null>(null);
  const [errorMsg, setErrorMsg] = useState('');
  const primitives = useBlueprintStore((s) => s.primitives);
  const setMode = useEditorModeStore((s) => s.setMode);

  const handleConvert = useCallback(async () => {
    if (primitives.length === 0) return;
    setPhase('analysing');

    try {
      // Format primitives as strokes text for the edge function
      const strokesText = primitives
        .map((p) => {
          switch (p.type) {
            case 'pen':
              return `Stroke: ${p.points.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(' ')}`;
            case 'line':
              return `Line: ${p.x1.toFixed(1)},${p.y1.toFixed(1)} ${p.x2.toFixed(1)},${p.y2.toFixed(1)}`;
            case 'rect':
              return `Rect: ${p.x.toFixed(1)},${p.y.toFixed(1)} ${(p.x + p.rectW).toFixed(1)},${(p.y + p.rectH).toFixed(1)}`;
            case 'circle':
              return `Circle: center ${p.cx.toFixed(1)},${p.cy.toFixed(1)} radius ${p.rx.toFixed(1)}`;
            case 'text':
              return `Label: "${p.text}" at ${p.x.toFixed(1)},${p.y.toFixed(1)}`;
            default:
              return '';
          }
        })
        .filter(Boolean)
        .join('\n');

      // Call the edge function via circuitRecognition
      // We reuse recognizeCircuitFromImageUpload which handles the full pipeline
      // But for vector data, we call the edge function directly with strokesText
      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/parse-circuit`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({ strokesText }),
        }
      );

      if (!response.ok) {
        const text = await response.text();
        throw new Error(text || `HTTP ${response.status}`);
      }

      const data = await response.json();
      const components = data.components ?? [];
      const wires = data.wires ?? [];

      setResult({ count: components.length + wires.length });
      setPhase('success');
    } catch (err: any) {
      console.error('[ConvertOverlay]', err);
      setErrorMsg(err?.message || 'Could not recognise circuit — try drawing more clearly or simplify');
      setPhase('error');
    }
  }, [primitives]);

  const handleSwitchToCad = () => {
    setMode('cad');
    onClose();
  };

  // On first render, start conversion automatically
  const [started, setStarted] = useState(false);
  if (!started && primitives.length > 0) {
    setStarted(true);
    // Use setTimeout to let the render complete first, then start
    setTimeout(handleConvert, 100);
  }

  if (phase === 'idle') return null;

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-base/80 backdrop-blur-sm">
      {phase === 'analysing' && (
        <div className="flex flex-col items-center gap-6">
          <div className="h-10 w-10 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          <p className="text-lg text-accent">Analysing your circuit...</p>
        </div>
      )}

      {phase === 'success' && result && (
        <div className="w-96 rounded-xl border border-default bg-surface p-6 shadow-md">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-green/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--green)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <polyline points="20 6 9 17 4 12" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-medium text-text-primary">Circuit recognised</h2>
          <p className="mt-1 text-sm text-text-secondary">
            {result.count} component{result.count !== 1 ? 's' : ''} found. Switch to CAD mode to view and simulate?
          </p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleSwitchToCad}
              className="flex-1 rounded-md bg-accent px-4 py-3 text-sm font-medium text-black transition-opacity hover:opacity-90"
            >
              Switch to CAD
            </button>
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-default px-4 py-3 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Keep editing
            </button>
          </div>
        </div>
      )}

      {phase === 'error' && (
        <div className="w-96 rounded-xl border border-default bg-surface p-6 shadow-md">
          <div className="mb-2 flex h-12 w-12 items-center justify-center rounded-full bg-red/20">
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <circle cx="12" cy="12" r="10" />
              <line x1="15" y1="9" x2="9" y2="15" />
              <line x1="9" y1="9" x2="15" y2="15" />
            </svg>
          </div>
          <h2 className="mt-4 text-lg font-medium text-text-primary">Could not recognise circuit</h2>
          <p className="mt-1 text-sm text-text-secondary">{errorMsg}</p>
          <div className="mt-6 flex gap-3">
            <button
              onClick={onClose}
              className="flex-1 rounded-md border border-default px-4 py-3 text-sm text-text-secondary transition-colors hover:border-accent hover:text-accent focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Dismiss
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
