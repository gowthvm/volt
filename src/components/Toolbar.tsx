import React from 'react';
import useDrawingStore from '@/store/drawingStore';

export default function Toolbar() {
  const tool = useDrawingStore((s) => s.tool);
  const setTool = useDrawingStore((s) => s.setTool);
  const undo = useDrawingStore((s) => s.undo);
  const redo = useDrawingStore((s) => s.redo);

  return (
    <div className="flex items-center gap-2" role="toolbar" aria-label="Drawing controls">
      <button
        aria-label="Pen tool"
        aria-pressed={tool === 'pen'}
        onClick={() => setTool('pen')}
        className={`px-3 py-2 rounded focus-visible:ring-2 focus-visible:ring-accent ${tool === 'pen' ? 'bg-accent' : 'bg-surface'}`}
      >
        Pen
      </button>
      <button
        aria-label="Eraser tool"
        aria-pressed={tool === 'eraser'}
        onClick={() => setTool('eraser')}
        className={`px-3 py-2 rounded focus-visible:ring-2 focus-visible:ring-accent ${tool === 'eraser' ? 'bg-accent' : 'bg-surface'}`}
      >
        Eraser
      </button>
      <button aria-label="Undo" onClick={undo} className="px-3 py-2 rounded bg-surface focus-visible:ring-2 focus-visible:ring-accent">
        Undo
      </button>
      <button aria-label="Redo" onClick={redo} className="px-3 py-2 rounded bg-surface focus-visible:ring-2 focus-visible:ring-accent">
        Redo
      </button>
    </div>
  );
}
