import type { SchematicComponent } from '@/store/schematicStore';

export type TerminalRole = 'left' | 'right' | 'top' | 'bottom' | 'ground';

export interface TerminalNode {
  id: string;
  componentId: string;
  terminalName: string;
  role: TerminalRole;
  position: { x: number; y: number };
}

export type EdgeType = 'wire' | 'implicit' | 'junction';

export interface JunctionNode {
  id: string;
  x: number;
  y: number;
  connectedTerminalIds: string[];
  connectedWireIds: string[];
}

export interface GraphEdge {
  id: string;
  sourceTerminalId: string;
  targetTerminalId: string;
  type: EdgeType;
  wireId?: string;
}

export interface CircuitGraph {
  terminals: TerminalNode[];
  terminalMap: Record<string, TerminalNode>;
  componentTerminalMap: Record<string, string[]>;
  edges: GraphEdge[];
  adjacency: Record<string, string[]>;
  junctions: JunctionNode[];
}

const distance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const toId = (componentId: string, terminalName: string) => `${componentId}:${terminalName}`;

export const transformPoint = (
  point: { x: number; y: number },
  component: SchematicComponent
): { x: number; y: number } => {
  const cos = Math.cos(component.rotation);
  const sin = Math.sin(component.rotation);
  const centeredX = point.x - 50;
  const centeredY = point.y - 50;
  const scaledX = centeredX * component.scale.x;
  const scaledY = centeredY * component.scale.y;
  return {
    x: component.position.x + scaledX * cos - scaledY * sin,
    y: component.position.y + scaledX * sin + scaledY * cos,
  };
};

export const componentTerminalDefinitions = (
  component: SchematicComponent
): Array<{ name: string; role: TerminalRole; point: { x: number; y: number } }> => {
  switch (component.type) {
    case 'wire':
      return [
        { name: 'A', role: 'left', point: { x: 0, y: 50 } },
        { name: 'B', role: 'right', point: { x: 100, y: 50 } },
      ];
    default:
      // Use normalized pin positions (SVG viewBox space → 0-100 canvas space)
      if (component.normalizedPinPositions && component.normalizedPinPositions.length > 0 && component.symbolViewBox) {
        const { w: vw, h: vh } = component.symbolViewBox;
        // SVG renders with preserveAspectRatio="xMidYMid meet" — scale uniformly, center offsets
        const meetScale = Math.min(140 / vw, 140 / vh);
        const hOff = (140 - vw * meetScale) / 2;
        const vOff = (140 - vh * meetScale) / 2;
        const isGround = component.params?.simType === 'ground';
        return component.normalizedPinPositions.map((pin) => ({
          name: pin.number,
          role: isGround ? 'ground' : 'left',
          point: {
            x: -20 + pin.x * meetScale + hOff,
            y: -20 + pin.y * meetScale + vOff,
          },
        }));
      }
      // Fallback for legacy KiCad pins (raw coordinates, old transform)
      if (component.kicadPins && component.kicadPins.length > 0) {
        const SCALE = 5;
        const OX = 50;
        const OY = 50;
        return component.kicadPins.map((pin) => ({
          name: pin.number,
          role: 'left',
          point: {
            x: pin.x * SCALE + OX,
            y: -pin.y * SCALE + OY,
          },
        }));
      }
      const st = component.params?.simType as string | undefined;
      if (st === 'resistor') return [{ name: 'A', role: 'left', point: { x: 10, y: 50 } }, { name: 'B', role: 'right', point: { x: 90, y: 50 } }];
      if (st === 'battery' || st === 'voltage_source') return [{ name: 'A', role: 'left', point: { x: 10, y: 50 } }, { name: 'B', role: 'right', point: { x: 90, y: 50 } }];
      if (st === 'current_source') return [{ name: 'A', role: 'left', point: { x: 10, y: 50 } }, { name: 'B', role: 'right', point: { x: 90, y: 50 } }];
      if (st === 'led') return [{ name: 'A', role: 'left', point: { x: 8, y: 50 } }, { name: 'B', role: 'right', point: { x: 80, y: 50 } }];
      if (st === 'diode') return [{ name: 'A', role: 'left', point: { x: 5, y: 50 } }, { name: 'B', role: 'right', point: { x: 95, y: 50 } }];
      if (st === 'ground') return [{ name: 'G', role: 'ground', point: { x: 50, y: 20 } }];
      return [];
  }
};

const makeTerminals = (component: SchematicComponent) => {
  return componentTerminalDefinitions(component).map((definition) => {
    const position = transformPoint(definition.point, component);
    return {
      id: toId(component.id, definition.name),
      componentId: component.id,
      terminalName: definition.name,
      role: definition.role,
      position,
    };
  });
};

const buildTerminalMap = (terminals: TerminalNode[]) => {
  return terminals.reduce<Record<string, TerminalNode>>((map, terminal) => {
    map[terminal.id] = terminal;
    return map;
  }, {});
};

const buildComponentTerminalMap = (terminals: TerminalNode[]) => {
  return terminals.reduce<Record<string, string[]>>((map, terminal) => {
    map[terminal.componentId] ||= [];
    map[terminal.componentId].push(terminal.id);
    return map;
  }, {});
};

const addEdge = (
  edges: GraphEdge[],
  sourceTerminalId: string,
  targetTerminalId: string,
  type: EdgeType,
  wireId?: string
) => {
  const existing = edges.find(
    (edge) =>
      (edge.sourceTerminalId === sourceTerminalId && edge.targetTerminalId === targetTerminalId) ||
      (edge.sourceTerminalId === targetTerminalId && edge.targetTerminalId === sourceTerminalId)
  );
  if (existing) {
    return;
  }

  edges.push({
    id: `${sourceTerminalId}-${targetTerminalId}-${type}`,
    sourceTerminalId,
    targetTerminalId,
    type,
    wireId,
  });
};

const makeAdjacency = (edges: GraphEdge[]) => {
  return edges.reduce<Record<string, string[]>>((adj, edge) => {
    adj[edge.sourceTerminalId] ||= [];
    adj[edge.targetTerminalId] ||= [];
    adj[edge.sourceTerminalId].push(edge.targetTerminalId);
    adj[edge.targetTerminalId].push(edge.sourceTerminalId);
    return adj;
  }, {});
};

/** Compute an orthogonal (90-degree) path between two points */
export function computeOrthogonalPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  horizontalFirst = true
): { x: number; y: number }[] {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);

  // Straight line if nearly aligned
  if (dy < 2) return [start, end];
  if (dx < 2) return [start, end];

  if (horizontalFirst) {
    // L-shape: horizontal then vertical
    return [start, { x: end.x, y: start.y }, end];
  }
  // L-shape: vertical then horizontal
  return [start, { x: start.x, y: end.y }, end];
}

export function isTerminalConnected(
  terminalId: string,
  adjacency: Record<string, string[]>
): boolean {
  return (adjacency[terminalId]?.length ?? 0) > 0;
}

export interface BoundingBox {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
}

export function getComponentBounds(component: SchematicComponent): BoundingBox {
  const corners = [
    { x: 0, y: 0 },
    { x: 100, y: 0 },
    { x: 100, y: 100 },
    { x: 0, y: 100 },
  ];
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity;
  for (const c of corners) {
    const w = transformPoint(c, component);
    if (w.x < minX) minX = w.x;
    if (w.y < minY) minY = w.y;
    if (w.x > maxX) maxX = w.x;
    if (w.y > maxY) maxY = w.y;
  }
  return { minX, minY, maxX, maxY };
}

function segmentHitsRect(
  p1: { x: number; y: number },
  p2: { x: number; y: number },
  rect: BoundingBox
): boolean {
  const eps = 1;
  const inRect = (px: number, py: number) =>
    px >= rect.minX - eps &&
    px <= rect.maxX + eps &&
    py >= rect.minY - eps &&
    py <= rect.maxY + eps;
  if (inRect(p1.x, p1.y) || inRect(p2.x, p2.y)) return true;

  const horiz = Math.abs(p1.y - p2.y) < eps;
  const vert = Math.abs(p1.x - p2.x) < eps;

  if (horiz) {
    if (p1.y >= rect.minY - eps && p1.y <= rect.maxY + eps) {
      const minX = Math.min(p1.x, p2.x);
      const maxX = Math.max(p1.x, p2.x);
      return maxX >= rect.minX - eps && minX <= rect.maxX + eps;
    }
    return false;
  }
  if (vert) {
    if (p1.x >= rect.minX - eps && p1.x <= rect.maxX + eps) {
      const minY = Math.min(p1.y, p2.y);
      const maxY = Math.max(p1.y, p2.y);
      return maxY >= rect.minY - eps && minY <= rect.maxY + eps;
    }
    return false;
  }
  // General case (rare for orthogonal paths)
  const dx = p2.x - p1.x;
  const dy = p2.y - p1.y;
  let tMin = 0,
    tMax = 1;
  const edges = [
    { p: -dx, q: p1.x - rect.minX },
    { p: dx, q: rect.maxX - p1.x },
    { p: -dy, q: p1.y - rect.minY },
    { p: dy, q: rect.maxY - p1.y },
  ];
  for (const e of edges) {
    if (Math.abs(e.p) < 1e-10) {
      if (e.q < 0) return false;
    } else {
      const t = e.q / e.p;
      if (e.p < 0) tMin = Math.max(tMin, t);
      else tMax = Math.min(tMax, t);
    }
  }
  return tMin <= tMax;
}

function pathHitsAny(path: { x: number; y: number }[], rects: BoundingBox[]): boolean {
  for (let i = 0; i < path.length - 1; i++) {
    for (const r of rects) {
      if (segmentHitsRect(path[i], path[i + 1], r)) return true;
    }
  }
  return false;
}

const GRID_SNAP = 30;

/**
 * Compute an orthogonal path that tries to avoid obstacles.
 * Returns an L-shape or Z-shape depending on what clears the obstacles.
 */
export function computeObstacleAvoidingPath(
  start: { x: number; y: number },
  end: { x: number; y: number },
  obstacles: BoundingBox[],
  horizontalFirst = true
): { x: number; y: number }[] {
  const dx = Math.abs(end.x - start.x);
  const dy = Math.abs(end.y - start.y);
  if (dy < 2 || dx < 2) return [start, end];

  const lH = [start, { x: end.x, y: start.y }, end];
  const lV = [start, { x: start.x, y: end.y }, end];

  if (!pathHitsAny(horizontalFirst ? lH : lV, obstacles)) {
    return horizontalFirst ? lH : lV;
  }
  if (!pathHitsAny(horizontalFirst ? lV : lH, obstacles)) {
    return horizontalFirst ? lV : lH;
  }

  // Generate Z-shape candidates
  const candidates: { x: number; y: number }[][] = [];
  const dir = end.x >= start.x ? 1 : -1;
  const dirY = end.y >= start.y ? 1 : -1;

  for (let step = 1; step <= 4; step++) {
    const off = GRID_SNAP * step * dir;
    const offY = GRID_SNAP * step * dirY;
    // HVH: start → (mx, sy) → (mx, ey) → end
    candidates.push([start, { x: start.x + off, y: start.y }, { x: start.x + off, y: end.y }, end]);
    candidates.push([start, { x: end.x - off, y: start.y }, { x: end.x - off, y: end.y }, end]);
    // VHV: start → (sx, my) → (ex, my) → end
    candidates.push([
      start,
      { x: start.x, y: start.y + offY },
      { x: end.x, y: start.y + offY },
      end,
    ]);
    candidates.push([start, { x: start.x, y: end.y - offY }, { x: end.x, y: end.y - offY }, end]);
  }

  for (const c of candidates) {
    if (!pathHitsAny(c, obstacles)) return c;
  }

  return horizontalFirst ? lH : lV;
}

/**
 * Check intersection between two axis-aligned line segments.
 * Returns the intersection point or null.
 */
function segmentIntersection(
  a: { x: number; y: number },
  b: { x: number; y: number },
  c: { x: number; y: number },
  d: { x: number; y: number }
): { x: number; y: number } | null {
  const eps = 1;
  const aMinX = Math.min(a.x, b.x) - eps;
  const aMaxX = Math.max(a.x, b.x) + eps;
  const aMinY = Math.min(a.y, b.y) - eps;
  const aMaxY = Math.max(a.y, b.y) + eps;
  const cMinX = Math.min(c.x, d.x) - eps;
  const cMaxX = Math.max(c.x, d.x) + eps;
  const cMinY = Math.min(c.y, d.y) - eps;
  const cMaxY = Math.max(c.y, d.y) + eps;

  const aHoriz = Math.abs(a.y - b.y) < eps;
  const aVert = Math.abs(a.x - b.x) < eps;
  const cHoriz = Math.abs(c.y - d.y) < eps;
  const cVert = Math.abs(c.x - d.x) < eps;

  // Parallel segments don't produce a point intersection
  if ((aHoriz && cHoriz) || (aVert && cVert)) return null;

  // AB horizontal, CD vertical
  if (aHoriz && cVert) {
    const y = a.y;
    const x = c.x;
    if (x >= aMinX && x <= aMaxX && y >= cMinY && y <= cMaxY) {
      return { x, y };
    }
  }

  // AB vertical, CD horizontal
  if (aVert && cHoriz) {
    const x = a.x;
    const y = c.y;
    if (x >= cMinX && x <= cMaxX && y >= aMinY && y <= aMaxY) {
      return { x, y };
    }
  }

  return null;
}

export function detectJunctions(components: SchematicComponent[]): JunctionNode[] {
  const wires = components.filter((c) => c.type === 'wire' && c.points && c.points.length >= 2);
  type RawJunction = { x: number; y: number; wireIds: Set<string> };
  const raw: RawJunction[] = [];
  const KEY_EPS = 4;

  for (let i = 0; i < wires.length; i++) {
    for (let j = i + 1; j < wires.length; j++) {
      const wi = wires[i];
      const wj = wires[j];
      if (!wi.points || !wj.points) continue;

      for (let si = 0; si < wi.points.length - 1; si++) {
        for (let sj = 0; sj < wj.points.length - 1; sj++) {
          const pt = segmentIntersection(
            wi.points[si],
            wi.points[si + 1],
            wj.points[sj],
            wj.points[sj + 1]
          );
          if (!pt) continue;

          // Deduplicate by position
          let match = raw.find(
            (r) => Math.abs(r.x - pt.x) < KEY_EPS && Math.abs(r.y - pt.y) < KEY_EPS
          );
          if (!match) {
            match = { x: pt.x, y: pt.y, wireIds: new Set() };
            raw.push(match);
          }
          match.wireIds.add(wi.id);
          match.wireIds.add(wj.id);
        }
      }
    }
  }

  const wireMap = new Map(components.map((c) => [c.id, c]));
  return raw.map((r, idx) => {
    const termIds: string[] = [];
    for (const wid of r.wireIds) {
      const w = wireMap.get(wid);
      if (w) {
        if (w.terminalA) termIds.push(w.terminalA);
        if (w.terminalB) termIds.push(w.terminalB);
      }
    }
    return {
      id: `junction-${idx}`,
      x: r.x,
      y: r.y,
      connectedTerminalIds: [...new Set(termIds)],
      connectedWireIds: [...r.wireIds],
    };
  });
}

const findClosestTerminal = (
  terminals: TerminalNode[],
  point: { x: number; y: number },
  threshold: number
) => {
  let best: TerminalNode | null = null;
  let bestDistance = threshold;
  for (const terminal of terminals) {
    const dist = distance(terminal.position, point);
    if (dist < bestDistance) {
      best = terminal;
      bestDistance = dist;
    }
  }
  return best;
};

const getWireEndpoints = (wireComponent: SchematicComponent) => {
  if (!wireComponent.points || wireComponent.points.length < 2) {
    return [];
  }
  return [wireComponent.points[0], wireComponent.points[wireComponent.points.length - 1]];
};

export const buildCircuitGraph = (
  components: SchematicComponent[],
  snapThreshold = 12
): CircuitGraph => {
  // Wires are edges, not nodes — skip creating terminals for wire components
  const terminals = components
    .filter((component) => component.type !== 'wire')
    .flatMap((component) => makeTerminals(component));
  const terminalMap = buildTerminalMap(terminals);
  const componentTerminalMap = buildComponentTerminalMap(terminals);
  const edges: GraphEdge[] = [];

  const wireComponents = components.filter((component) => component.type === 'wire');
  for (const wire of wireComponents) {
    // prefer stored terminal IDs, but fall back to proximity for legacy wires
    let startTerminal: TerminalNode | null = null;
    let endTerminal: TerminalNode | null = null;

    if (wire.terminalA && wire.terminalB) {
      startTerminal = terminalMap[wire.terminalA] ?? null;
      endTerminal = terminalMap[wire.terminalB] ?? null;
    }

    if (!startTerminal || !endTerminal) {
      const endpoints = getWireEndpoints(wire);
      if (endpoints.length === 2) {
        startTerminal = findClosestTerminal(terminals, endpoints[0], snapThreshold);
        endTerminal = findClosestTerminal(terminals, endpoints[1], snapThreshold);
      }
    }

    if (startTerminal && endTerminal && startTerminal.id !== endTerminal.id) {
      addEdge(edges, startTerminal.id, endTerminal.id, 'wire', wire.id);
    }
  }

  for (let i = 0; i < terminals.length; i += 1) {
    for (let j = i + 1; j < terminals.length; j += 1) {
      const source = terminals[i];
      const target = terminals[j];
      if (source.componentId === target.componentId) {
        continue;
      }
      if (distance(source.position, target.position) <= snapThreshold) {
        addEdge(edges, source.id, target.id, 'implicit');
      }
    }
  }

  const junctions = detectJunctions(components);
  for (const junction of junctions) {
    const termIds = junction.connectedTerminalIds;
    for (let i = 0; i < termIds.length; i++) {
      for (let j = i + 1; j < termIds.length; j++) {
        addEdge(edges, termIds[i], termIds[j], 'junction');
      }
    }
  }

  const adjacency = makeAdjacency(edges);
  return { terminals, terminalMap, componentTerminalMap, edges, adjacency, junctions };
};

export const findConnectedComponent = (graph: CircuitGraph, startId: string) => {
  const result: string[] = [];
  const visited = new Set<string>();
  const queue = [startId];

  while (queue.length > 0) {
    const current = queue.shift()!;
    if (visited.has(current)) continue;
    visited.add(current);
    result.push(current);
    const neighbors = graph.adjacency[current] ?? [];
    for (const neighbor of neighbors) {
      if (!visited.has(neighbor)) {
        queue.push(neighbor);
      }
    }
  }

  return result;
};

export const findAllConnectedComponents = (graph: CircuitGraph) => {
  const remaining = new Set(graph.terminals.map((terminal) => terminal.id));
  const components: string[][] = [];

  for (const terminal of graph.terminals) {
    if (!remaining.has(terminal.id)) continue;
    const group = findConnectedComponent(graph, terminal.id);
    group.forEach((id) => remaining.delete(id));
    components.push(group);
  }

  return components;
};

const detectCycleFrom = (
  graph: CircuitGraph,
  startId: string,
  visited: Set<string>,
  parent: string | null
) => {
  visited.add(startId);
  const neighbors = graph.adjacency[startId] ?? [];
  for (const neighbor of neighbors) {
    if (neighbor === parent) continue;
    if (visited.has(neighbor)) {
      return true;
    }
    if (detectCycleFrom(graph, neighbor, visited, startId)) {
      return true;
    }
  }
  return false;
};

export const detectLoops = (graph: CircuitGraph) => {
  const visited = new Set<string>();
  for (const terminal of graph.terminals) {
    if (visited.has(terminal.id)) continue;
    if (detectCycleFrom(graph, terminal.id, visited, null)) {
      return true;
    }
  }
  return false;
};

export const identifyOpenCircuits = (graph: CircuitGraph) => {
  const openTerminals = graph.terminals.filter((terminal) => {
    const degree = (graph.adjacency[terminal.id] ?? []).length;
    return degree <= 1;
  });

  const connectedGroups = findAllConnectedComponents(graph);
  const openNets = connectedGroups.filter((group) => {
    return group.some((terminalId) => {
      const degree = (graph.adjacency[terminalId] ?? []).length;
      return degree <= 1;
    });
  });

  return {
    openTerminals,
    openNets,
  };
};
