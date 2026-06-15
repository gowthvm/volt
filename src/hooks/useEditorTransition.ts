import { useState, useCallback, useEffect, useRef } from 'react';
import useEditorModeStore from '@/store/editorModeStore';
import useDrawingStore from '@/store/drawingStore';

export type TransitionPhase = 'idle' | 'outgoing' | 'incoming';

export function useEditorTransition() {
  const [phase, setPhase] = useState<TransitionPhase>('idle');
  const mode = useEditorModeStore((s) => s.mode);
  const setMode = useEditorModeStore((s) => s.setMode);
  const setTool = useDrawingStore((s) => s.setTool);
  const prefersReducedMotionRef = useRef(false);

  const [targetMode, setTargetMode] = useState<'cad' | 'blueprint'>(mode);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    prefersReducedMotionRef.current = mq.matches;
    const handler = (e: MediaQueryListEvent) => { prefersReducedMotionRef.current = e.matches; };
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  const isTransitioning = phase !== 'idle';

  const startTransition = useCallback(
    (newMode: 'cad' | 'blueprint') => {
      if (phase !== 'idle' || newMode === mode) return;

      setTargetMode(newMode);

      if (prefersReducedMotionRef.current) {
        setTool(newMode === 'cad' ? 'select' : 'pen');
        setMode(newMode);
        return;
      }

      setPhase('outgoing');

      // Phase 1: outgoing (200ms) — fade out, panels slide out
      // Phase 2: swap at 200ms
      const swapTimeout = setTimeout(() => {
        setTool(newMode === 'cad' ? 'select' : 'pen');
        setMode(newMode);
        setPhase('incoming');
      }, 200);

      // Phase 3: incoming ends at 500ms
      const doneTimeout = setTimeout(() => {
        setPhase('idle');
      }, 500);

      return () => {
        clearTimeout(swapTimeout);
        clearTimeout(doneTimeout);
      };
    },
    [phase, mode, setMode, setTool],
  );

  return { phase, isTransitioning, targetMode, startTransition };
}
