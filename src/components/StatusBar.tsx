import { useState, useEffect } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import useDrawingStore from '@/store/drawingStore';

const TOOL_NAMES: Record<string, string> = {
  select: 'Select',
  wire: 'Wire',
  pen: 'Pen',
  line: 'Line',
  rect: 'Rectangle',
  circle: 'Circle',
  eraser: 'Eraser',
  text: 'Text',
  pan: 'Pan',
};

export default function StatusBar() {
  const zoom = useCanvasStore((s) => s.zoom);
  const tool = useDrawingStore((s) => s.tool);
  const [coords, setCoords] = useState({ x: 0, y: 0 });

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      setCoords({ x: e.clientX, y: e.clientY });
    };
    window.addEventListener('mousemove', handler);
    return () => window.removeEventListener('mousemove', handler);
  }, []);

  return (
    <div className="flex h-6 items-center justify-between border-t border-subtle bg-base px-4 text-xs text-text-tertiary font-mono">
      <div className="flex items-center gap-3">
        <span>{TOOL_NAMES[tool] || tool}</span>
      </div>
      <div className="flex items-center gap-4">
        <span className="tabular-nums">x: {coords.x}, y: {coords.y}</span>
        <span className="tabular-nums">{Math.round(zoom * 100)}%</span>
      </div>
    </div>
  );
}
