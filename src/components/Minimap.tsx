import React, { useMemo } from 'react';
import useDrawingStore from '@/store/drawingStore';
import { useCanvasStore } from '@/store/canvasStore';
import useSchematicStore from '@/store/schematicStore';
import { useCircuitStore } from '@/store/circuitStore';

interface MinimapProps {
  rightPanelOpen?: boolean;
}

export default function Minimap({ rightPanelOpen }: MinimapProps) {
  const strokes = useDrawingStore((s) => s.strokes);
  const components = useSchematicStore((s) => s.components);
  const graph = useCircuitStore((s) => s.graph);
  const camera = useCanvasStore((s) => ({ offset: s.offset, zoom: s.zoom, size: s.canvasSize }));

  const padding = 8;
  const width = 220;
  const height = 140;

  const bounds = useMemo(() => {
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
    const visit = (x: number, y: number) => {
      minX = Math.min(minX, x); minY = Math.min(minY, y);
      maxX = Math.max(maxX, x); maxY = Math.max(maxY, y);
    };
    strokes.forEach((s) => s.points.forEach((p) => visit(p.x, p.y)));
    components.forEach((c) => {
      if (c.type === 'wire') {
        if (c.points) c.points.forEach((p) => visit(p.x, p.y));
      } else {
        visit(c.position.x, c.position.y);
      }
    });
    if (minX === Infinity) return { minX: -500, minY: -300, maxX: 500, maxY: 300 };
    const mar = 100;
    return { minX: minX - mar, minY: minY - mar, maxX: maxX + mar, maxY: maxY + mar };
  }, [strokes, components]);

  const view = useMemo(() => {
    const canvasWidth = Math.max(1, camera.size.width || 800);
    const canvasHeight = Math.max(1, camera.size.height || 500);
    const viewW = canvasWidth / camera.zoom;
    const viewH = canvasHeight / camera.zoom;
    const cx = camera.offset.x;
    const cy = camera.offset.y;
    return { left: cx - viewW / 2, top: cy - viewH / 2, width: viewW, height: viewH };
  }, [camera]);

  const scaleX = (width - padding * 2) / Math.max(1, bounds.maxX - bounds.minX);
  const scaleY = (height - padding * 2) / Math.max(1, bounds.maxY - bounds.minY);
  const scaleVal = Math.min(scaleX, scaleY);
  const lineCountX = 4;
  const lineCountY = 3;
  const gridLinesX = Array.from({ length: lineCountX }, (_, index) => padding + ((index + 1) * (width - padding * 2)) / (lineCountX + 1));
  const gridLinesY = Array.from({ length: lineCountY }, (_, index) => padding + ((index + 1) * (height - padding * 2)) / (lineCountY + 1));

  const toMini = (x: number, y: number) => ({
    x: padding + (x - bounds.minX) * scaleVal,
    y: padding + (y - bounds.minY) * scaleVal,
  });

  const wirePaths = useMemo(() => {
    return components.filter((c) => c.type === 'wire').map((wire) => {
      let pts: { x: number; y: number }[];
      if (wire.points && wire.points.length >= 2) {
        pts = wire.points.map((p) => ({ x: p.x, y: p.y }));
      } else if (wire.terminalA && wire.terminalB) {
        const tA = graph.terminalMap[wire.terminalA];
        const tB = graph.terminalMap[wire.terminalB];
        if (tA && tB) {
          const dx = Math.abs(tB.position.x - tA.position.x);
          const dy = Math.abs(tB.position.y - tA.position.y);
          if (dx < 2 || dy < 2) {
            pts = [tA.position, tB.position];
          } else {
            pts = [tA.position, { x: tB.position.x, y: tA.position.y }, tB.position];
          }
        } else { pts = []; }
      } else { pts = []; }
      return pts;
    });
  }, [components, graph]);

  return (
    <div className={`absolute bottom-20 z-50 transition duration-150 ease-out ${rightPanelOpen ? 'right-[296px]' : 'right-4'}`}>
      <svg width={width} height={height} className="rounded-lg border border-default bg-elevated p-1" role="img" aria-label="Circuit minimap">
        <rect x={0} y={0} width={width} height={height} fill="var(--bg-surface)" rx={8} />
        <g stroke="var(--bg-active)" strokeWidth={0.5} fill="none">
          {gridLinesX.map((x) => (
            <line key={`gx-${x}`} x1={x} y1={padding} x2={x} y2={height - padding} />
          ))}
          {gridLinesY.map((y) => (
            <line key={`gy-${y}`} x1={padding} y1={y} x2={width - padding} y2={y} />
          ))}
        </g>
        <g stroke="var(--bg-hover)" strokeWidth={0.8} fill="none">
          {strokes.map((s) => {
            const d = s.points.map((p) => {
              const pt = toMini(p.x, p.y);
              return `${pt.x},${pt.y}`;
            });
            if (d.length === 0) return null;
            return <polyline key={s.id} points={d.join(' ')} stroke={s.tool === 'pen' ? 'var(--border-default)' : 'var(--border-subtle)'} strokeWidth={1} fill="none" />;
          })}
        </g>
        {wirePaths.map((pts, i) => {
          if (pts.length < 2) return null;
          const d = pts.map((p) => { const pt = toMini(p.x, p.y); return `${pt.x},${pt.y}`; }).join(' ');
          return <polyline key={`wire-${i}`} points={d} stroke="rgba(255,255,255,0.35)" strokeWidth={1.2} fill="none" opacity={0.6} />;
        })}
        {components.filter((c) => c.type !== 'wire').map((c) => {
          const pt = toMini(c.position.x, c.position.y);
          return <circle key={c.id} cx={pt.x} cy={pt.y} r={2.5} fill="var(--accent)" opacity={0.7} />;
        })}
        {(() => {
          const tl = toMini(view.left, view.top);
          const br = toMini(view.left + view.width, view.top + view.height);
          return (
            <rect
              x={tl.x} y={tl.y}
              width={Math.max(2, br.x - tl.x)} height={Math.max(2, br.y - tl.y)}
              stroke="var(--accent)" strokeWidth={1}
              fill="none"
            />
          );
        })()}
      </svg>
    </div>
  );
}
