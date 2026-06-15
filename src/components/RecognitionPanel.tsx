import { useEffect, useRef } from 'react';
import { useRecognitionStore } from '@/store/recognitionStore';
import useSchematicStore from '@/store/schematicStore';
import { mapTypeToKicad } from '@/lib/circuitRecognition';

export default function RecognitionPanel() {
  const { recognitionResult, panelOpen, error, rawAiOutput, togglePanel, closePanel, setResult, setError, clearAll } =
    useRecognitionStore();

  const addComponent = useSchematicStore((s) => s.addComponent);
  const components = useSchematicStore((s) => s.components);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (panelOpen && error) {
      console.log('[RecognitionPanel] Showing error:', error);
    }
    if (panelOpen && recognitionResult) {
      console.log('[RecognitionPanel] Showing', recognitionResult.length, 'components');
    }
  }, [panelOpen, error, recognitionResult]);

  // Always render the DOM, just hide with opacity to avoid React mount/unmount timing issues
  const hidden = !panelOpen;

  const handleApplyAll = () => {
    if (!recognitionResult) return;
    for (const comp of recognitionResult) {
      const mapping = mapTypeToKicad(comp.type);
      addComponent({
        type: 'unknown',
        confidence: 0.8,
        kicadSymbolId: mapping.kicadSymbolId,
        position: { x: comp.position.x, y: comp.position.y },
        rotation: comp.rotation,
        scale: { x: 1, y: 1 },
        value: comp.value,
      });
    }
    closePanel();
  };

  const handleDiscard = () => {
    clearAll();
  };

  const handleDismissError = () => {
    setError(null);
    closePanel();
  };

  const currentRefdes = components.filter((c) => c.type !== 'wire').length;
  const suggestedIndex = currentRefdes + 1;

  return (
    <div ref={panelRef} className={`absolute right-4 top-20 w-80 bg-surface border border-default rounded-xl shadow-lg z-50 overflow-hidden transition-opacity duration-150 ${hidden ? 'opacity-0 pointer-events-none' : ''}`}>
      <div className="bg-accent text-black px-4 py-2.5 flex items-center justify-between">
        <h2 className="text-sm font-semibold tracking-tight">Recognition Result</h2>
        <button
          onClick={handleDiscard}
          className="p-1 rounded-sm hover:bg-base/10 transition"
          aria-label="Close panel"
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>

      <div className="p-3 max-h-80 overflow-y-auto">
        {error && (
          <div className="flex items-start gap-2 p-2.5 bg-red/10 border border-red/30 rounded-lg mb-3">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--red)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mt-0.5 shrink-0">
              <circle cx="12" cy="12" r="10"/>
              <line x1="12" y1="8" x2="12" y2="12"/>
              <line x1="12" y1="16" x2="12.01" y2="16"/>
            </svg>
            <div className="flex-1 text-xs text-red leading-relaxed">{error}</div>
            <button
              onClick={handleDismissError}
              className="p-0.5 rounded-sm hover:bg-red/20 transition"
              aria-label="Dismiss error"
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        )}

        {recognitionResult && recognitionResult.length > 0 ? (
          <ul className="space-y-1.5 mb-3">
            {recognitionResult.map((comp, i) => (
              <li
                key={i}
                className="flex items-center justify-between px-2.5 py-2 rounded-lg bg-surface border border-subtle"
              >
                <div className="flex items-center gap-2">
                  <span className="text-xs font-medium text-text-primary uppercase tracking-wider">
                    {comp.type}
                  </span>
                  <span className="text-xs text-text-secondary font-mono">
                    R{suggestedIndex + i}
                  </span>
                </div>
                <span className="text-xs text-text-tertiary">
                  ({Math.round(comp.position.x)}, {Math.round(comp.position.y)})
                </span>
              </li>
            ))}
          </ul>
        ) : recognitionResult && recognitionResult.length === 0 ? (
          <p className="text-xs text-text-secondary text-center py-3">No components recognized.</p>
        ) : (
          <p className="text-xs text-text-secondary text-center py-3">No recognition data.</p>
        )}

        {rawAiOutput && false && (
          <details className="mt-3">
            <summary className="text-xs text-text-tertiary cursor-pointer hover:text-text-secondary">
              Raw AI output
            </summary>
            <pre className="mt-1 p-2 bg-base/30 rounded-lg text-[10px] text-text-secondary font-mono whitespace-pre-wrap leading-relaxed max-h-32 overflow-y-auto">
              {rawAiOutput}
            </pre>
          </details>
        )}
      </div>

      {recognitionResult && recognitionResult.length > 0 && (
        <div className="flex gap-2 px-3 pb-3">
          <button
            onClick={handleApplyAll}
            className="flex-1 px-3 py-1.5 text-xs font-medium bg-accent text-black rounded-md hover:brightness-110 transition"
          >
            Apply All
          </button>
          <button
            onClick={handleDiscard}
            className="px-3 py-1.5 text-xs font-medium border border-default rounded-md hover:border-red/50 hover:text-red transition"
          >
            Discard
          </button>
        </div>
      )}
    </div>
  );
}
