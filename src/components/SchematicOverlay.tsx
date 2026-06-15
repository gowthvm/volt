import { useMemo, useRef } from 'react';
import type { SchematicComponent } from '@/store/schematicStore';
import { canvasToScreen } from '@/lib/canvas';
import {
  componentTerminalDefinitions,
  transformPoint,
  computeOrthogonalPath,
  isTerminalConnected,
} from '@/circuit/graph';
import { useCircuitStore } from '@/store/circuitStore';
import useSchematicStore from '@/store/schematicStore';
import { computeNetLabels } from '@/lib/netLabels';
import { useLayerStore } from '@/store/layerStore';

interface OverlayProps {
  components: SchematicComponent[];
  transitionStrokes: { id: string; points: { x: number; y: number }[]; fading: boolean }[];
  freshComponentIds: Set<string>;
  camera: { x: number; y: number; zoom: number };
  svgSize: { width: number; height: number };
  snapTerminals?: { x: number; y: number }[];
  selectedComponentId: string | null;
  wireLineStart?: { x: number; y: number } | null;
  wireLineEnd?: { x: number; y: number } | null;
  dragGhost?: { type: string; canvasPos: { x: number; y: number }; kicadSymbolId?: string } | null;
  selectionRect?: { x1: number; y1: number; x2: number; y2: number } | null;
  liveStroke?: { x: number; y: number; pressure?: number }[] | null;
  activeTool?: string;
  unrecognizedStrokes?: { id: string; points: { x: number; y: number }[] }[];
}

function pointToSegmentDist(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number
): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - ax, py - ay);
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return Math.hypot(px - (ax + t * dx), py - (ay + t * dy));
}

function formatValue(value: number, simType?: string): string {
  if (simType === 'resistor') {
    if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}MΩ`;
    if (value >= 1_000) return `${(value / 1_000).toFixed(1)}kΩ`;
    return `${value.toFixed(0)}Ω`;
  }
  if (simType === 'voltage_source' || simType === 'battery') return `${value.toFixed(2)}V`;
  if (simType === 'current_source') return `${value.toFixed(3)}A`;
  if (simType === 'led' || simType === 'diode') return `${value.toFixed(2)}V`;
  return `${value}`;
}

export default function SchematicOverlay({
  components,
  transitionStrokes,
  freshComponentIds,
  camera,
  svgSize,
  snapTerminals,
  selectedComponentId,
  wireLineStart,
  wireLineEnd,
  dragGhost,
  selectionRect,
  liveStroke,
  activeTool,
  unrecognizedStrokes,
}: OverlayProps) {
  const graph = useCircuitStore((s) => s.graph);
  const selectedWireId = useSchematicStore((s) => s.selectedWireId);
  const multiSelectedComponentIds = useSchematicStore((s) => s.multiSelectedComponentIds);
  const multiSelectedWireIds = useSchematicStore((s) => s.multiSelectedWireIds);
  const hoveredTerminalId = useSchematicStore((s) => s.hoveredTerminalId);

  const netLabels = useMemo(() => computeNetLabels(graph), [graph]);
  const imgErrors = useRef<Map<string, boolean | 'skip'>>(new Map());
  const visibleLayerIds = useLayerStore((s) => new Set(s.layers.filter((l) => l.visible).map((l) => l.id)));

  const wires = components.filter((c) => c.type === 'wire' && (!c.layer || visibleLayerIds.has(c.layer)));
  const nonWires = components.filter((c) => c.type !== 'wire' && (!c.layer || visibleLayerIds.has(c.layer)));

  const selectedComponentSet = new Set(multiSelectedComponentIds.length > 0 ? multiSelectedComponentIds : (selectedComponentId ? [selectedComponentId] : []));
  const selectedWireSet = new Set(multiSelectedWireIds.length > 0 ? multiSelectedWireIds : (selectedWireId ? [selectedWireId] : []));

  const toScreen = (wx: number, wy: number) =>
    canvasToScreen(wx, wy, svgSize.width, svgSize.height, camera.zoom, {
      x: camera.x,
      y: camera.y,
    });

  return (
    <g>
      {/* Selection rectangle */}
      {selectionRect && (() => {
        const x = Math.min(selectionRect.x1, selectionRect.x2);
        const y = Math.min(selectionRect.y1, selectionRect.y2);
        const w = Math.abs(selectionRect.x2 - selectionRect.x1);
        const h = Math.abs(selectionRect.y2 - selectionRect.y1);
        const sp = toScreen(x, y);
        const sw = w * camera.zoom;
        const sh = h * camera.zoom;
        return (
          <rect
            x={sp.x}
            y={sp.y}
            width={sw}
            height={sh}
            fill="var(--accent-muted)"
            stroke="var(--accent)"
            strokeWidth={1}
            strokeDasharray="4 3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        );
      })()}
      {/* Snap terminals */}
      {snapTerminals?.map((pos, i) => (
        <circle
          key={`snap-${i}`}
          cx={pos.x}
          cy={pos.y}
          r={5}
          fill="var(--accent)"
          stroke="var(--bg-base)"
          strokeWidth="1.5"
          opacity={0.9}
        />
      ))}
      {/* Transition strokes (fade-out) */}
      {transitionStrokes.map((stroke) => {
        const path = stroke.points
          .map((p, index) => {
            const sp = canvasToScreen(p.x, p.y, svgSize.width, svgSize.height, camera.zoom, {
              x: camera.x,
              y: camera.y,
            });
            return `${index === 0 ? 'M' : 'L'} ${sp.x} ${sp.y}`;
          })
          .join(' ');
        return (
          <path
            key={stroke.id}
            d={path}
            fill="none"
            stroke="rgba(255,255,255,0.55)"
            strokeWidth={4}
            strokeLinecap="round"
            strokeLinejoin="round"
            opacity={stroke.fading ? 0 : 1}
            style={{ transition: 'opacity 220ms ease-out' }}
          />
        );
      })}
      {/* Live wire line preview (dashed) */}
      {wireLineStart && wireLineEnd && (
        (() => {
          const s = toScreen(wireLineStart.x, wireLineStart.y);
          const e = toScreen(wireLineEnd.x, wireLineEnd.y);
          return (
            <line
              x1={s.x} y1={s.y} x2={e.x} y2={e.y}
              stroke="var(--accent)"
              strokeWidth={2 * camera.zoom}
              strokeLinecap="round"
              strokeDasharray="6 4"
              opacity={0.8}
            />
          );
        })()
      )}
      {/* Junction dots at wire-wire intersections */}
      {graph.junctions.map((j) => {
        const sp = toScreen(j.x, j.y);
        return (
          <circle
            key={j.id}
            cx={sp.x}
            cy={sp.y}
            r={4.5}
            fill="var(--accent)"
            stroke="var(--bg-base)"
            strokeWidth={1}
            opacity={0.9}
          />
        );
      })}
      {/* Wire paths */}
      {wires.map((wire) => {
        let pathPts: { x: number; y: number }[];
        if (wire.points && wire.points.length >= 2) {
          pathPts = wire.points.map((p) => ({ x: p.x, y: p.y }));
        } else {
          const tA = graph.terminalMap[wire.terminalA ?? ''];
          const tB = graph.terminalMap[wire.terminalB ?? ''];
          if (!tA || !tB) return null;
          pathPts = computeOrthogonalPath(tA.position, tB.position);
        }

        const screenPath = pathPts.map((p) => toScreen(p.x, p.y));
        const d = screenPath.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');

        const isSelected = wire.id === selectedWireId || multiSelectedWireIds.includes(wire.id);
        const aConnected = isTerminalConnected(wire.terminalA ?? '', graph.adjacency);
        const bConnected = isTerminalConnected(wire.terminalB ?? '', graph.adjacency);
        const isDangling = !aConnected || !bConnected;

        return (
          <g key={wire.id}>
            {isSelected && (
              <path
                d={d}
                fill="none"
                stroke="var(--accent)"
                strokeWidth={6 * camera.zoom}
                strokeLinecap="round"
                strokeLinejoin="round"
                opacity={0.25}
              />
            )}
            <path
              d={d}
              fill="none"
              stroke={isSelected ? 'var(--accent)' : isDangling ? 'rgba(255,100,100,0.6)' : 'rgba(255,255,255,0.55)'}
              strokeWidth={(isSelected ? 2.5 : 1.8) * camera.zoom}
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            {isSelected && wire.points && wire.points.length >= 3 &&
              wire.points.slice(1, -1).map((pt, idx) => {
                const sp = toScreen(pt.x, pt.y);
                return (
                  <circle
                    key={`bend-${idx}`}
                    cx={sp.x}
                    cy={sp.y}
                    r={4}
                    fill="var(--accent)"
                    stroke="var(--bg-base)"
                    strokeWidth={1.5}
                    opacity={0.95}
                  />
                );
              })}
            {pathPts.length >= 2 && (() => {
              const terminalId = wire.terminalA ? graph.terminalMap[wire.terminalA]?.id ?? wire.terminalA : wire.id;
              const netName = netLabels.get(terminalId);
              if (!netName) return null;
              const mid = pathPts[0];
              const next = pathPts[1];
              const angle = Math.atan2(next.y - mid.y, next.x - mid.x);
              const labelPos = {
                x: (mid.x + next.x) / 2 + Math.sin(angle) * 8,
                y: (mid.y + next.y) / 2 - Math.cos(angle) * 8,
              };
              const sp = toScreen(labelPos.x, labelPos.y);
              return (
                <text
                  x={sp.x}
                  y={sp.y}
                  fill="var(--text-tertiary)"
                  fontSize={10}
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {netName}
                </text>
              );
            })()}
          </g>
        );
      })}
      {/* Terminal dots for all non-wire components */}
      {nonWires.map((comp) =>
        componentTerminalDefinitions(comp).map((def) => {
          const terminalId = `${comp.id}:${def.name}`;
          const worldPt = transformPoint(def.point, comp);
          const sp = toScreen(worldPt.x, worldPt.y);
          const connected = isTerminalConnected(terminalId, graph.adjacency);
          const isHovered = terminalId === hoveredTerminalId;

          return (
            <circle
              key={terminalId}
              cx={sp.x}
              cy={sp.y}
              r={isHovered ? 6 : 4.5}
              fill={connected ? 'var(--accent)' : 'none'}
              stroke={isHovered ? 'var(--accent)' : connected ? 'var(--accent)' : 'rgba(255,255,255,0.3)'}
              strokeWidth={connected ? 1 : 1.5}
              opacity={isHovered ? 1 : 0.85}
              style={{
                transition: isHovered ? 'none' : 'r 120ms ease, fill 120ms ease, stroke 120ms ease',
              }}
            />
          );
        })
      )}
      {/* Component symbols */}
      {nonWires.map((component) => {
        const screen = toScreen(component.position.x, component.position.y);
        const scaleX = component.scale.x * camera.zoom;
        const scaleY = component.scale.y * camera.zoom;
        const isSelected = component.id === selectedComponentId || multiSelectedComponentIds.includes(component.id);
        if (!imgErrors.current.has(component.id)) {
          imgErrors.current.set(component.id, component.kicadSymbolId ? false : 'skip');
        }
        const svgFailed = imgErrors.current.get(component.id) ?? true;
        const setSvgFailed = (v: boolean | 'skip') => imgErrors.current.set(component.id, v);

        const defs = componentTerminalDefinitions(component);
        const halfW = component.symbolViewBox ? component.symbolViewBox.w / 2 : 40;
        const halfH = component.symbolViewBox ? component.symbolViewBox.h / 2 : 40;

        return (
          <g
            key={component.id}
            transform={`translate(${screen.x} ${screen.y}) rotate(${(component.rotation * 180) / Math.PI}) scale(${scaleX} ${scaleY}) translate(-50 -50)`}
            opacity={freshComponentIds.has(component.id) ? 0 : 1}
            style={{ transition: 'opacity 240ms ease-out' }}
          >
            {isSelected && (
              <circle
                cx="50"
                cy="50"
                r="48"
                fill="none"
                stroke="var(--accent)"
                strokeWidth="2"
                opacity={0.6}
              />
            )}
            {component.kicadSymbolId && (() => {
              const isSwitch = component.params?.simType === 'switch';
              const isOpen = isSwitch && component.params?.closed === false;
              const symId = isOpen && component.kicadSymbolId === 'sw_push'
                ? 'sw_push_open'
                : component.kicadSymbolId;
              return (
                <image
                  href={`/assets/symbols/previews/${symId}.svg`}
                  x="-20" y="-20"
                  width="140" height="140"
                  preserveAspectRatio="xMidYMid meet"
                  style={{ pointerEvents: 'none', display: svgFailed ? 'none' : undefined }}
                  onError={() => setSvgFailed(true)}
                  onLoad={() => setSvgFailed(false)}
                />
              );
            })()}
            {(svgFailed || !component.kicadSymbolId) && (
              <g>
                <rect
                  x={50 - halfW} y={50 - halfH}
                  width={halfW * 2} height={halfH * 2}
                  rx={6} ry={6}
                  fill="var(--bg-surface)"
                  stroke="var(--border-strong)"
                  strokeWidth="1.5"
                  style={{ pointerEvents: 'none' }}
                />
                {defs.map((def) => {
                  const x = 50 + (def.point.x - 50) * 0.8;
                  const y = 50 + (def.point.y - 50) * 0.8;
                  return (
                    <line
                      key={def.name}
                      x1={50 + (def.point.x - 50) * 1.1}
                      y1={50 + (def.point.y - 50) * 1.1}
                      x2={x} y2={y}
                      stroke="var(--border-strong)"
                      strokeWidth="1"
                      style={{ pointerEvents: 'none' }}
                    />
                  );
                })}
                <text
                  x="50" y="50"
                  fill="var(--text-tertiary)"
                  fontSize={9}
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {component.kicadSymbolId?.split(':').pop() ?? component.type}
                </text>
              </g>
            )}
            {component.value !== undefined && (
              <text
                x="50" y="105"
                fill="var(--accent)"
                fontSize={12 * camera.zoom}
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ pointerEvents: 'none', opacity: 0.8 }}
              >
                {formatValue(component.value, component.params?.simType as string | undefined)}
              </text>
            )}
            {component.refdes && (
              <text
                x="50" y={component.value !== undefined ? 118 : 105}
                fill="var(--text-tertiary)"
                fontSize={9 * camera.zoom}
                fontFamily="monospace"
                textAnchor="middle"
                dominantBaseline="middle"
                style={{ pointerEvents: 'none' }}
              >
                {component.refdes}
              </text>
            )}
            {component.params?.simType === 'switch' && (() => {
              const isOpen = component.params?.closed === false;
              const labelY = component.refdes
                ? (component.value !== undefined ? 131 : 118)
                : (component.value !== undefined ? 118 : 105);
              return (
                <text
                  x="50" y={labelY}
                  fill={isOpen ? 'var(--red)' : 'var(--green)'}
                  fontSize={7 * camera.zoom}
                  fontFamily="monospace"
                  textAnchor="middle"
                  dominantBaseline="middle"
                  style={{ pointerEvents: 'none', userSelect: 'none' }}
                >
                  {isOpen ? '○ OPEN' : '● CLOSED'}
                </text>
              );
            })()}
          </g>
        );
      })}
      {/* Wire preview during drag */}
      {/* Live stroke (pen/eraser preview on top of everything) */}
      {/* Live stroke (pen/eraser preview on top of everything) */}
      {liveStroke && liveStroke.length >= 2 && (() => {
        const thickness = activeTool === 'eraser' ? 20 : 2;
        const screenPts = liveStroke.map((p) => toScreen(p.x, p.y));
        const d = screenPts.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ');
        return (
          <path
            d={d}
            fill="none"
            stroke={activeTool === 'eraser' ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.55)'}
            strokeWidth={thickness * camera.zoom}
            strokeLinecap="round"
            strokeLinejoin="round"
            style={{ pointerEvents: 'none', userSelect: 'none' }}
          />
        );
      })()}
      {/* Unrecognized stroke highlights */}
      {unrecognizedStrokes?.map((stroke) => {
        const path = stroke.points
          .map((p, i) => {
            const sp = toScreen(p.x, p.y);
            return `${i === 0 ? 'M' : 'L'} ${sp.x} ${sp.y}`;
          })
          .join(' ');
        return (
          <g key={stroke.id}>
            <path
              d={path}
              fill="none"
              stroke="var(--red)"
              strokeOpacity={0.5}
              strokeWidth={6}
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ pointerEvents: 'none', userSelect: 'none' }}
            />
            <title>Could not identify</title>
          </g>
        );
      })}
      {/* Drag ghost */}
      {dragGhost &&
        (() => {
          const screen = toScreen(dragGhost.canvasPos.x, dragGhost.canvasPos.y);
          const ghostZoom = camera.zoom;
          return (
            <g
              transform={`translate(${screen.x} ${screen.y}) scale(${ghostZoom} ${ghostZoom}) translate(-50 -50)`}
              opacity={0.4}
            >
              {dragGhost.kicadSymbolId && (
                <image
                  href={`/assets/symbols/previews/${dragGhost.kicadSymbolId}.svg`}
                  x="-20" y="-20"
                  width="140" height="140"
                  preserveAspectRatio="xMidYMid meet"
                />
              )}
            </g>
          );
        })()}
    </g>
  );
}

export { pointToSegmentDist };
