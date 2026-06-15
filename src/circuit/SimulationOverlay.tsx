import { canvasToScreen } from '@/lib/canvas';
import type { SimulationResult } from '@/circuit/simulation';
import type { CircuitGraph } from '@/circuit/graph';
import type { SchematicComponent } from '@/store/schematicStore';

interface Props {
  result: SimulationResult | null;
  graph: CircuitGraph;
  components: SchematicComponent[];
  camera: { x: number; y: number; zoom: number };
  svgSize: { width: number; height: number };
}

function formatVoltage(v: number): string {
  if (Math.abs(v) < 1e-12) return '0 V';
  if (Math.abs(v) >= 1) return `${v.toFixed(2)} V`;
  if (Math.abs(v) >= 0.001) return `${(v * 1000).toFixed(1)} mV`;
  return `${(v * 1e6).toFixed(0)} µV`;
}

function formatCurrent(i: number): string {
  if (Math.abs(i) < 1e-12) return '0 A';
  if (Math.abs(i) >= 1) return `${i.toFixed(2)} A`;
  if (Math.abs(i) >= 0.001) return `${(i * 1000).toFixed(1)} mA`;
  return `${(i * 1e6).toFixed(0)} µA`;
}

function formatPower(p: number): string {
  if (Math.abs(p) < 1e-12) return '0 W';
  if (Math.abs(p) >= 1) return `${p.toFixed(2)} W`;
  if (Math.abs(p) >= 0.001) return `${(p * 1000).toFixed(1)} mW`;
  return `${(p * 1e6).toFixed(0)} µW`;
}

function PillLabel({ x, y, text, color, zoom }: { x: number; y: number; text: string; color: string; zoom: number }) {
  const fs = Math.max(8, 11 * zoom);
  const pad = 4 * zoom + 2;
  const approxW = text.length * fs * 0.6;
  return (
    <g>
      <rect
        x={x - pad}
        y={y - fs * 0.75}
        width={approxW + pad * 2}
        height={fs + pad * 0.5}
        rx={4 * zoom}
        fill="rgba(0,0,0,0.7)"
      />
      <text
        x={x}
        y={y}
        fontSize={fs}
        textAnchor="start"
        fill={color}
        fontFamily="monospace"
        fontWeight="bold"
      >
        {text}
      </text>
    </g>
  );
}

export default function SimulationOverlay({ result, graph, components, camera, svgSize }: Props) {
  const { zoom, x: ox, y: oy } = camera;
  const { width: svgW, height: svgH } = svgSize;

  if (result && !result.success && result.error) {
    const sp = canvasToScreen(0, 0, svgW, svgH, zoom, { x: ox, y: oy });
    return (
      <g>
        <rect x={sp.x} y={sp.y + 8} width={svgW} height={36} fill="var(--red)" fillOpacity={0.12} rx={6} />
        <text x={sp.x + 16} y={sp.y + 30} fontSize="14px" fontFamily="monospace" fontWeight="bold" fill="var(--red)">
          ⚠ {result.error}
        </text>
      </g>
    );
  }

  if (!result || !result.success) return null;

  const nodeGroups = new Map<number, { terminalIds: string[]; voltage: number }>();
  for (const [terminalId, nodeIdx] of Object.entries(result.terminalNodes)) {
    let group = nodeGroups.get(nodeIdx);
    if (!group) {
      group = { terminalIds: [], voltage: result.nodeVoltages[terminalId] ?? 0 };
      nodeGroups.set(nodeIdx, group);
    }
    group.terminalIds.push(terminalId);
  }

  return (
    <g>
      {Array.from(nodeGroups.entries()).map(([nodeIdx, group]) => {
        let cx = 0;
        let cy = 0;
        let count = 0;
        for (const tid of group.terminalIds) {
          const term = graph.terminalMap[tid];
          if (term) { cx += term.position.x; cy += term.position.y; count++; }
        }
        if (count === 0) return null;
        cx /= count;
        cy /= count;

        const sp = canvasToScreen(cx, cy, svgW, svgH, zoom, { x: ox, y: oy });

        return (
          <g key={`node-${nodeIdx}`}>
            <circle cx={sp.x} cy={sp.y} r={Math.max(2, 3 * zoom)} fill="var(--accent)" opacity={0.5} />
            <PillLabel x={sp.x + 6 * zoom + 2} y={sp.y + 4} text={formatVoltage(group.voltage)} color="var(--accent)" zoom={zoom} />
          </g>
        );
      })}

      {components.map((comp) => {
        if (comp.type === 'wire' || comp.type === 'unknown' || comp.type === 'ground') return null;
        const current = result.componentCurrents[comp.id];
        if (current === undefined) return null;
        const power = result.componentPowers[comp.id] ?? 0;
        const sp = canvasToScreen(comp.position.x, comp.position.y, svgW, svgH, zoom, { x: ox, y: oy });

        return (
          <g key={`comp-${comp.id}`}>
            <PillLabel x={sp.x} y={sp.y - 14 * zoom} text={formatCurrent(current)} color="var(--text-primary)" zoom={zoom} />
            <text
              x={sp.x}
              y={sp.y + 2}
              fontSize={Math.max(7, 9 * zoom)}
              textAnchor="middle"
              fill="var(--accent)"
              opacity={0.6}
              fontFamily="monospace"
            >
              {formatPower(power)}
            </text>
          </g>
        );
      })}
    </g>
  );
}
