import {
  useEffect,
  useRef,
  useState,
  useCallback,
  useMemo,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { clamp, getDistance, getMidpoint, screenToCanvas, canvasToScreen } from '@/lib/canvas';
import useDrawingStore from '@/store/drawingStore';
import type { ComponentType } from '@/recognition/types';
import useSchematicStore, { type SchematicComponent, pushSnapshotHistory } from '@/store/schematicStore';
import { useCircuitStore } from '@/store/circuitStore';
import { useSimulationStore } from '@/store/simulationStore';
import {
  componentTerminalDefinitions,
  transformPoint,
  computeOrthogonalPath,
  computeObstacleAvoidingPath,
  getComponentBounds,
} from '@/circuit/graph';
import { getGridStyle } from '@/lib/renderUtils';
import SchematicOverlay from '@/components/SchematicOverlay';
import { GRID_SNAP, snapToGrid, flattenWirePath, moveBendPointInPath, updateWireEndpoint, dedupPoints } from '@/lib/wireUtils';
import { pointToSegmentDist, hitTestTerminal, hitTestWire, hitTestWireSegment, hitTestBendPoint, TERMINAL_HIT, WIRE_HIT } from '@/lib/hitTest';
import SimulationOverlay from '@/circuit/SimulationOverlay';
import ContextMenu, { type ContextMenuState } from '@/components/ContextMenu';
import { getDragComponentType, getDragKicadSymbolId, inferParams } from '@/lib/dragContext';
import { getNormalizedPins, getKicadPins, preloadAllPinData } from '@/lib/pinDataCache';
import { useRecognitionStore } from '@/store/recognitionStore';

const BASE_GRID_SIZE = 48;
const DEFAULT_DROP_SCALE = 1;
const MIN_POINT_SIZE = 0.75;
const MAX_POINT_SIZE = 2.5;

export default function CanvasEngine() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const camera = useRef({ x: 0, y: 0, zoom: 1 });
  const spacePan = useCanvasStore((s) => s.spacePan);
  const offset = useCanvasStore((s) => s.offset);
  const zoom = useCanvasStore((s) => s.zoom);
  const pointers = useRef<Map<number, PointerEvent>>(new Map());
  const lastPointer = useRef<{ x: number; y: number } | null>(null);
  const panAnchor = useRef<{ x: number; y: number; clientX: number; clientY: number } | null>(null);
  const isPanning = useRef(false);
  const pinch = useRef({ distance: 0, zoom: 1, center: { x: 0, y: 0 } });
  const frame = useRef<number | null>(null);
  const setCameraState = useCanvasStore((state) => state.setCamera);
  const minZoom = useCanvasStore((state) => state.minZoom);
  const maxZoom = useCanvasStore((state) => state.maxZoom);
  const setCanvasSize = useCanvasStore((state) => state.setCanvasSize);
  const strokes = useDrawingStore((s) => s.strokes);
  const tool = useDrawingStore((s) => s.tool);
  const sketchMode = useDrawingStore((s) => s.sketchMode);
  const addStroke = useDrawingStore((s) => s.addStroke);
  const eraseByPath = useDrawingStore((s) => s.eraseByPath);
  const addComponent = useSchematicStore((s) => s.addComponent);
  const components = useSchematicStore((s) => s.components);
  const setSelectedComponentId = useSchematicStore((s) => s.setSelectedComponentId);
  const setSelectedWireId = useSchematicStore((s) => s.setSelectedWireId);
  const setHoveredTerminalId = useSchematicStore((s) => s.setHoveredTerminalId);
  const clearSelection = useSchematicStore((s) => s.clearSelection);
  const selectedComponentId = useSchematicStore((s) => s.selectedComponentId);

  // Preload pin data into shared cache on mount
  useEffect(() => { preloadAllPinData(); }, []);

  const updateComponentPosition = useSchematicStore((s) => s.updateComponentPosition);
  const removeComponentById = useSchematicStore((s) => s.removeComponentById);
  const graph = useCircuitStore((s) => s.graph);
  const simResult = useSimulationStore((s) => s.result);

  const [svgSize, setSvgSize] = useState({ width: 0, height: 0 });
  const [liveStroke, setLiveStroke] = useState<
    { x: number; y: number; pressure?: number }[] | null
  >(null);
  const [transitionStrokes, setTransitionStrokes] = useState<
    { id: string; points: { x: number; y: number; pressure?: number }[]; fading: boolean }[]
  >([]);
  const [freshComponentIds, setFreshComponentIds] = useState<Set<string>>(new Set());
  const unrecognizedStrokeIndices = useRecognitionStore((s) => s.unrecognizedStrokeIndices);
  const unrecognizedStrokes = useMemo(
    () =>
      unrecognizedStrokeIndices
        .map((idx: number) => strokes.filter((s) => s.tool === 'pen')[idx])
        .filter(Boolean)
        .map((s) => ({ id: s.id, points: s.points.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y })) })),
    [unrecognizedStrokeIndices, strokes]
  );

  const [cursorStyle, setCursorStyle] = useState('default');
  useEffect(() => {
    if (tool === 'pan') setCursorStyle('grab');
    else if (tool === 'wire' || tool === 'select') setCursorStyle('default');
    else setCursorStyle('default');
  }, [tool, sketchMode]);
  const [snapTerminals, setSnapTerminals] = useState<{ x: number; y: number }[]>([]);
  const [wireLineStart, setWireLineStart] = useState<{ x: number; y: number } | null>(null);
  const [wireLineEnd, setWireLineEnd] = useState<{ x: number; y: number } | null>(null);
  const [dragGhost, setDragGhost] = useState<{
    type: string;
    canvasPos: { x: number; y: number };
    kicadSymbolId?: string;
  } | null>(null);
  const [contextMenu, setContextMenu] = useState<ContextMenuState | null>(null);
  const [selectionRect, setSelectionRect] = useState<{
    x1: number; y1: number; x2: number; y2: number;
  } | null>(null);

  const drawingRef = useRef<{ points: { x: number; y: number; pressure?: number }[] } | null>(null);
  const moveRef = useRef<{
    id: string;
    anchorX: number;
    anchorY: number;
    startX: number;
    startY: number;
  } | null>(null);
  const wireLineStartRef = useRef<{ x: number; y: number } | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const wireSegDragRef = useRef<{
    wireId: string;
    segIndex: number;
    originalPoints: { x: number; y: number }[];
  } | null>(null);
  const bendPointDragRef = useRef<{
    wireId: string;
    pointIndex: number;
    originalPoints: { x: number; y: number }[];
  } | null>(null);
  const selectionRectRef = useRef<{ startX: number; startY: number } | null>(null);
  const groupMoveRef = useRef<{
    anchorX: number;
    anchorY: number;
    originalComponentPositions: { id: string; x: number; y: number }[];
  } | null>(null);
  const drawCanvasRef = useRef<() => void>();

  const scheduleRender = useCallback(() => {
    if (frame.current != null) return;
    frame.current = window.requestAnimationFrame(() => {
      frame.current = null;
      drawCanvasRef.current?.();
    });
  }, []);

  const cancelWireRouting = useCallback(() => {
    wireLineStartRef.current = null;
    setWireLineStart(null);
    setWireLineEnd(null);
    setCursorStyle('default');
  }, [setCursorStyle]);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.style.maxWidth = '100%';
    canvas.style.maxHeight = '100%';
    canvas.style.boxSizing = 'border-box';
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    setSvgSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    setCanvasSize({ width: Math.floor(rect.width), height: Math.floor(rect.height) });
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scheduleRender();
  }, [setCanvasSize, scheduleRender]);

  const updateCamera = useCallback(
    (offsetX: number, offsetY: number, zoom: number) => {
      camera.current.x = offsetX;
      camera.current.y = offsetY;
      camera.current.zoom = clamp(zoom, minZoom, maxZoom);
      setCameraState({ x: camera.current.x, y: camera.current.y }, camera.current.zoom);
      scheduleRender();
    },
    [minZoom, maxZoom, setCameraState, scheduleRender]
  );

  const zoomAt = useCallback(
    (screenX: number, screenY: number, targetZoom: number) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const current = camera.current;
      const localX = screenX - rect.left;
      const localY = screenY - rect.top;
      const before = screenToCanvas(localX, localY, rect.width, rect.height, current.zoom, {
        x: current.x,
        y: current.y,
      });
      const zoom = clamp(targetZoom, minZoom, maxZoom);
      const offsetX = before.x - (localX - rect.width / 2) / zoom;
      const offsetY = before.y - (localY - rect.height / 2) / zoom;
      updateCamera(offsetX, offsetY, zoom);
    },
    [minZoom, maxZoom, updateCamera]
  );

  // ---- helper: local pointer-to-canvas ----
  const pointerToCanvas = useCallback((clientX: number, clientY: number) => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return null;
    const rect = wrapper.getBoundingClientRect();
    const localX = clientX - rect.left;
    const localY = clientY - rect.top;
    return screenToCanvas(localX, localY, rect.width, rect.height, camera.current.zoom, {
      x: camera.current.x,
      y: camera.current.y,
    });
  }, []);

  // ---- keyboard handler ----
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        const state = useSchematicStore.getState();
        const ids: string[] = [];
        if (state.multiSelectedWireIds.length > 0) ids.push(...state.multiSelectedWireIds);
        else if (state.selectedWireId) ids.push(state.selectedWireId);
        if (state.multiSelectedComponentIds.length > 0) ids.push(...state.multiSelectedComponentIds);
        else if (state.selectedComponentId) ids.push(state.selectedComponentId);
        if (ids.length > 0) useSchematicStore.getState().removeComponentsByIds(ids);
        return;
      }
      if (e.key === 'Escape') {
        if (wireSegDragRef.current) {
          useSchematicStore.setState((state) => ({
            components: state.components.map((c) =>
              c.id === wireSegDragRef.current!.wireId
                ? {
                    ...c,
                    points: wireSegDragRef.current!.originalPoints.map((pt) => ({
                      x: pt.x,
                      y: pt.y,
                      pressure: 0.5,
                    })),
                  }
                : c
            ),
          }));
          wireSegDragRef.current = null;
          setHoveredTerminalId(null);
          return;
        }
        if (bendPointDragRef.current) {
          const bd = bendPointDragRef.current;
          useSchematicStore.setState((state) => ({
            components: state.components.map((c) =>
              c.id === bd.wireId
                ? { ...c, points: bd.originalPoints.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) }
                : c
            ),
          }));
          bendPointDragRef.current = null;
          return;
        }
        if (wireLineStartRef.current) {
          cancelWireRouting();
          return;
        }
        setHoveredTerminalId(null);
        clearSelection();
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'c' || e.key === 'C')) {
        e.preventDefault();
        const state = useSchematicStore.getState();
        const ids = state.multiSelectedComponentIds.length > 0
          ? state.multiSelectedComponentIds
          : state.selectedComponentId
            ? [state.selectedComponentId]
            : [];
        if (ids.length > 0) {
          const copied = state.components.filter((c) => ids.includes(c.id));
          navigator.clipboard.writeText(JSON.stringify(copied.map((c) => ({
            type: c.type,
            confidence: c.confidence,
            rotation: c.rotation,
            scale: c.scale,
            value: c.value,
            params: c.params,
            kicadSymbolId: c.kicadSymbolId,
            kicadPins: c.kicadPins,
            normalizedPinPositions: c.normalizedPinPositions,
            symbolViewBox: c.symbolViewBox,
            points: c.points,
            terminalA: c.terminalA,
            terminalB: c.terminalB,
          }))));
        }
        return;
      }
      if ((e.ctrlKey || e.metaKey) && (e.key === 'v' || e.key === 'V')) {
        e.preventDefault();
        navigator.clipboard.readText().then((text) => {
          try {
            const pasted = JSON.parse(text);
            const arr = Array.isArray(pasted) ? pasted : [pasted];
            const camera = useCanvasStore.getState();
            const centerX = camera.offset.x + camera.canvasSize.width / 2 / camera.zoom;
            const centerY = camera.offset.y + camera.canvasSize.height / 2 / camera.zoom;
            const offset = GRID_SNAP * 2;
            for (let i = 0; i < arr.length; i++) {
              const comp = arr[i];
              useSchematicStore.getState().addComponent({
                type: comp.type,
                confidence: comp.confidence ?? 1,
                position: { x: snapToGrid(centerX + offset + i * GRID_SNAP), y: snapToGrid(centerY + offset + i * GRID_SNAP) },
                rotation: comp.rotation ?? 0,
                scale: comp.scale ?? { x: 1, y: 1 },
                value: comp.value,
                params: comp.params,
                kicadSymbolId: comp.kicadSymbolId,
                kicadPins: comp.kicadPins,
                normalizedPinPositions: comp.normalizedPinPositions,
                symbolViewBox: comp.symbolViewBox,
                points: comp.points,
                terminalA: comp.terminalA,
                terminalB: comp.terminalB,
              });
            }
          } catch { /* ignore parse errors */ }
        });
        return;
      }
      if (!(e.ctrlKey || e.metaKey) && ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        const comp = useSchematicStore.getState().components.find(
          (c) => c.id === useSchematicStore.getState().selectedComponentId
        );
        if (comp) {
          e.preventDefault();
          const delta = e.shiftKey ? GRID_SNAP / 2 : GRID_SNAP;
          const dir = e.key === 'ArrowUp' ? { x: 0, y: -delta } : e.key === 'ArrowDown' ? { x: 0, y: delta } : e.key === 'ArrowLeft' ? { x: -delta, y: 0 } : { x: delta, y: 0 };
          useSchematicStore.getState().updateComponentPosition(comp.id, {
            x: snapToGrid(comp.position.x + dir.x),
            y: snapToGrid(comp.position.y + dir.y),
          });
        }
        return;
      }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [removeComponentById, clearSelection, setHoveredTerminalId, cancelWireRouting]);

  // ==================== POINTER HANDLERS ====================

  const handlePointerDown = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const isMiddleButtonPan = event.button === 1;
    const isPanAction = spacePan || isMiddleButtonPan;

    // Pen / Eraser tools
    if ((tool === 'pen' || tool === 'eraser') && !isPanAction) {
      canvas.setPointerCapture(event.pointerId);
      drawingRef.current = { points: [] };
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      drawingRef.current.points.push({
        x: p.x,
        y: p.y,
        pressure: event.nativeEvent.pressure ?? 0.5,
      });
      setLiveStroke(drawingRef.current.points.slice());
      return;
    }

    // Wire tool — click-drag-release line drawing (blueprint-style)
    if (tool === 'wire' && !isPanAction && event.button === 0) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      canvas.setPointerCapture(event.pointerId);

      // Snap start to nearest terminal if close
      const terminalHit = hitTestTerminal(p.x, p.y, components, undefined, camera.current.zoom);
      const startPos = terminalHit ? terminalHit.pos : { x: snapToGrid(p.x), y: snapToGrid(p.y) };
      wireLineStartRef.current = startPos;
      setWireLineStart(startPos);
      if (terminalHit) setSelectedComponentId(terminalHit.componentId);
      setWireLineEnd(startPos);
      setCursorStyle('crosshair');
      return;
    }

    // Select tool (left-click only; right-click handled by onContextMenu)
    if (tool === 'select' && !isPanAction && event.button === 0) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      pointerDownPos.current = p;

      // 1. Bend point handle drag
      const bendHit = hitTestBendPoint(p.x, p.y, components, camera.current.zoom);
      if (bendHit) {
        canvas.setPointerCapture(event.pointerId);
        setSelectedWireId(bendHit.wireId);
        const wire = components.find((c) => c.id === bendHit.wireId);
        if (wire && wire.points && bendHit.pointIndex > 0 && bendHit.pointIndex < wire.points.length - 1) {
          bendPointDragRef.current = {
            wireId: bendHit.wireId,
            pointIndex: bendHit.pointIndex,
            originalPoints: wire.points.map((pt) => ({ x: pt.x, y: pt.y })),
          };
        }
        return;
      }

      // 2. Check wires — wire selection or segment drag
      const wireSegHit = hitTestWireSegment(p.x, p.y, components, graph, camera.current.zoom);
      if (wireSegHit) {
        setSelectedWireId(wireSegHit.wireId);
        canvas.setPointerCapture(event.pointerId);
        wireSegDragRef.current = {
          wireId: wireSegHit.wireId,
          segIndex: wireSegHit.segIndex,
          originalPoints: wireSegHit.originalPoints,
        };
        return;
      }
      const wireHit = hitTestWire(p.x, p.y, components, graph, camera.current.zoom);
      if (wireHit) {
        setSelectedWireId(wireHit);
        return;
      }

      // 3. Check component body (screen-space hit threshold)
      let foundComponent: string | null = null;
      const hitThreshold = 20 / camera.current.zoom;
      const hitThresholdSq = hitThreshold * hitThreshold;
      for (const comp of components) {
        if (comp.type === 'wire') continue;
        const dx = comp.position.x - p.x;
        const dy = comp.position.y - p.y;
        if (dx * dx + dy * dy <= hitThresholdSq) {
          foundComponent = comp.id;
          break;
        }
      }

      if (foundComponent) {
        const s = useSchematicStore.getState();
        const inMulti = s.multiSelectedComponentIds.includes(foundComponent);
        if (inMulti) {
          // Group move all selected items
          canvas.setPointerCapture(event.pointerId);
          groupMoveRef.current = {
            anchorX: p.x,
            anchorY: p.y,
            originalComponentPositions: s.multiSelectedComponentIds.map((id) => {
              const comp = components.find((c) => c.id === id)!;
              return { id, x: comp.position.x, y: comp.position.y };
            }),
          };
        } else if (foundComponent === selectedComponentId) {
          canvas.setPointerCapture(event.pointerId);
          const comp = components.find((c) => c.id === foundComponent)!;
          moveRef.current = {
            id: foundComponent,
            anchorX: p.x,
            anchorY: p.y,
            startX: comp.position.x,
            startY: comp.position.y,
          };
        } else {
          setSelectedComponentId(foundComponent);
        }
      } else {
        clearSelection();
        // Start selection rectangle
        canvas.setPointerCapture(event.pointerId);
        selectionRectRef.current = { startX: p.x, startY: p.y };
        setSelectionRect({ x1: p.x, y1: p.y, x2: p.x, y2: p.y });
      }
      return;
    }

    // Default: pan
    event.preventDefault();
    canvas.setPointerCapture(event.pointerId);
    pointers.current.set(event.pointerId, event.nativeEvent);
    isPanning.current = true;
    panAnchor.current = {
      x: camera.current.x,
      y: camera.current.y,
      clientX: event.clientX,
      clientY: event.clientY,
    };
    drawingRef.current = null;
    setLiveStroke(null);

    if (pointers.current.size === 1) {
      lastPointer.current = { x: event.clientX, y: event.clientY };
    }
    if (pointers.current.size === 2) {
      const points = Array.from(pointers.current.values());
      const [first, second] = points;
      pinch.current.distance = getDistance(
        { x: first.clientX, y: first.clientY },
        { x: second.clientX, y: second.clientY }
      );
      pinch.current.zoom = camera.current.zoom;
      pinch.current.center = getMidpoint(
        { x: first.clientX, y: first.clientY },
        { x: second.clientX, y: second.clientY }
      );
      lastPointer.current = null;
    }
  };

  const handlePointerMove = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    // Pen / Eraser
    if ((tool === 'pen' || tool === 'eraser') && !isPanning.current) {
      if (!drawingRef.current) return;
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      drawingRef.current.points.push({
        x: p.x,
        y: p.y,
        pressure: event.nativeEvent.pressure ?? 0.5,
      });
      setLiveStroke(drawingRef.current.points.slice());
      scheduleRender();
      return;
    }

    // Wire tool — live line preview (grid-snapped, terminal-snapped)
    if (tool === 'wire' && wireLineStartRef.current) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      const snapHit = hitTestTerminal(p.x, p.y, components, undefined, camera.current.zoom);
      const endPos = snapHit ? snapHit.pos : { x: snapToGrid(p.x), y: snapToGrid(p.y) };
      setWireLineEnd(endPos);
      return;
    }

    // Wire segment drag — insert single live point, no re-orthogonalization during drag
    const segDrag = wireSegDragRef.current;
    if (tool === 'select' && segDrag) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      const pts = segDrag.originalPoints;
      const before = pts.slice(0, segDrag.segIndex + 1);
      const after = pts.slice(segDrag.segIndex + 1);
      useSchematicStore.setState((state) => ({
        components: state.components.map((c) =>
          c.id === segDrag.wireId
            ? { ...c, points: [...before, { x: p.x, y: p.y }, ...after].map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) }
            : c
        ),
      }));
      return;
    }

    // Bend point drag — update single point in place, never create new points
    const bdDrag = bendPointDragRef.current;
    if (tool === 'select' && bdDrag) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      const wire = components.find((c) => c.id === bdDrag.wireId);
      if (!wire || !wire.points || wire.points.length < 3) return;
      useSchematicStore.setState((state) => ({
        components: state.components.map((c) =>
          c.id === bdDrag.wireId
            ? {
                ...c,
                points: (c.points ?? []).map((pt, i) =>
                  i === bdDrag.pointIndex
                    ? { x: p.x, y: p.y, pressure: pt.pressure ?? 0.5 }
                    : pt
                ),
              }
            : c
        ),
      }));
      return;
    }

    // Component move — live update position + wire endpoints, suppress circuitStore rebuild
    const mv = moveRef.current;
    if (tool === 'select' && mv) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      const dx = p.x - mv.anchorX;
      const dy = p.y - mv.anchorY;
      const rawX = mv.startX + dx;
      const rawY = mv.startY + dy;

      useCircuitStore.getState().setSuppressSync(true);

      // Update component position in schematic store only
      useSchematicStore.setState((state) => ({
        components: state.components.map((c) =>
          c.id === mv.id ? { ...c, position: { x: rawX, y: rawY } } : c
        ),
      }));

      // Live-update connected wire endpoints
      const getTermPos = (terminalId: string): { x: number; y: number } | null => {
        const [cid, tname] = terminalId.split(':');
        if (cid === mv.id) {
          const comp = useSchematicStore.getState().components.find((x) => x.id === cid);
          if (!comp) return null;
          const defs = componentTerminalDefinitions(comp);
          const def = defs.find((d) => d.name === tname);
          if (!def) return null;
          return transformPoint(def.point, comp);
        }
        const term = graph.terminalMap[terminalId];
        return term ? term.position : null;
      };

      useSchematicStore.setState((state) => ({
        components: state.components.map((c) => {
          if (c.type !== 'wire' || !c.terminalA || !c.terminalB || !c.points || c.points.length < 2) return c;
          const csA = c.terminalA.startsWith(mv.id + ':');
          const csB = c.terminalB.startsWith(mv.id + ':');
          if (!csA && !csB) return c;
          const pts = c.points.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y }));
          if (csA) { const pos = getTermPos(c.terminalA); if (pos) pts.splice(0, pts.length, ...updateWireEndpoint(pts, true, pos)); }
          if (csB) { const pos = getTermPos(c.terminalB); if (pos) pts.splice(0, pts.length, ...updateWireEndpoint(pts, false, pos)); }
          return { ...c, points: pts.map((p: { x: number; y: number }) => ({ x: p.x, y: p.y, pressure: 0.5 })) };
        }),
      }));

      // Show snap terminals near other components
      const nearby: { x: number; y: number }[] = [];
      const snapDist = 24;
      for (const other of components) {
        if (other.id === mv.id) continue;
        const otherTerminals = graph.componentTerminalMap[other.id] ?? [];
        for (const tid of otherTerminals) {
          const term = graph.terminalMap[tid];
          if (!term) continue;
          const d = Math.hypot(term.position.x - rawX, term.position.y - rawY);
          if (d < snapDist) {
            const wrapper = wrapperRef.current;
            if (wrapper) {
              const rect = wrapper.getBoundingClientRect();
              const sp = canvasToScreen(
                term.position.x, term.position.y,
                rect.width, rect.height, camera.current.zoom,
                { x: camera.current.x, y: camera.current.y }
              );
              nearby.push(sp);
            }
          }
        }
      }
      setSnapTerminals(nearby);
      return;
    }

    // Selection rectangle update
    if (tool === 'select' && selectionRectRef.current) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      setSelectionRect({
        x1: selectionRectRef.current.startX,
        y1: selectionRectRef.current.startY,
        x2: p.x,
        y2: p.y,
      });
      return;
    }

    // Group move (multi-selection)
    const gm = groupMoveRef.current;
    if (tool === 'select' && gm) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;
      const dx = p.x - gm.anchorX;
      const dy = p.y - gm.anchorY;

      useCircuitStore.getState().setSuppressSync(true);

      // Update component positions
      useSchematicStore.setState((state) => ({
        components: state.components.map((c) => {
          const orig = gm.originalComponentPositions.find((o) => o.id === c.id);
          if (!orig) return c;
          return { ...c, position: { x: orig.x + dx, y: orig.y + dy } };
        }),
      }));

      // Update connected wire endpoints for each moved component
      const movedIds = new Set(gm.originalComponentPositions.map((o) => o.id));
      const getTermPos = (terminalId: string): { x: number; y: number } | null => {
        const [cid, tname] = terminalId.split(':');
        if (movedIds.has(cid)) {
          const comp = useSchematicStore.getState().components.find((x) => x.id === cid);
          if (!comp) return null;
          const defs = componentTerminalDefinitions(comp);
          const def = defs.find((d) => d.name === tname);
          if (!def) return null;
          return transformPoint(def.point, comp);
        }
        const term = graph.terminalMap[terminalId];
        return term ? term.position : null;
      };

      useSchematicStore.setState((state) => ({
        components: state.components.map((c) => {
          if (c.type !== 'wire' || !c.terminalA || !c.terminalB || !c.points || c.points.length < 2) return c;
          const aMoved = movedIds.has(c.terminalA.split(':')[0]);
          const bMoved = movedIds.has(c.terminalB.split(':')[0]);
          if (!aMoved && !bMoved) return c;

          if (aMoved && bMoved) {
            // Both terminals on moved components — shift entire wire
            return {
              ...c,
              points: c.points.map((pt) => ({ x: pt.x + dx, y: pt.y + dy, pressure: pt.pressure ?? 0.5 })),
            };
          }

          // One terminal moved — stretch that endpoint
          const pts = c.points.map((pp) => ({ x: pp.x, y: pp.y }));
          if (aMoved) {
            const pos = getTermPos(c.terminalA);
            if (pos) pts.splice(0, pts.length, ...updateWireEndpoint(pts, true, pos));
          } else {
            const pos = getTermPos(c.terminalB);
            if (pos) pts.splice(0, pts.length, ...updateWireEndpoint(pts, false, pos));
          }
          return { ...c, points: pts.map((pp) => ({ x: pp.x, y: pp.y, pressure: 0.5 })) };
        }),
      }));
      return;
    }

    // Hover detection (select tool, no drag active)
    if (tool === 'select' && !mv && !groupMoveRef.current && !selectionRectRef.current && !isPanning.current) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (!p) return;

      // Check terminal hover
      const termHit = hitTestTerminal(p.x, p.y, components, undefined, camera.current.zoom);
      if (termHit) {
        setHoveredTerminalId(termHit.terminalId);
        setCursorStyle('crosshair');
        return;
      }

      // Check wire hover
      const wireHit = hitTestWire(p.x, p.y, components, graph, camera.current.zoom);
      if (wireHit) {
        setHoveredTerminalId(null);
        setCursorStyle('pointer');
        return;
      }

      // Check component body hover
      let overComponent = false;
      const hoverThreshold = 20 / camera.current.zoom;
      const hoverThresholdSq = hoverThreshold * hoverThreshold;
      for (const comp of components) {
        if (comp.type === 'wire') continue;
        const dx = comp.position.x - p.x;
        const dy = comp.position.y - p.y;
        if (dx * dx + dy * dy <= hoverThresholdSq) {
          overComponent = true;
          break;
        }
      }

      setHoveredTerminalId(null);
      setCursorStyle(overComponent ? 'grab' : 'default');
      return;
    }

    // Pan
    if (!pointers.current.has(event.pointerId)) return;
    pointers.current.set(event.pointerId, event.nativeEvent);

    if (pointers.current.size === 2 && !isPanning.current) {
      const points = Array.from(pointers.current.values());
      const [first, second] = points;
      const distance = getDistance(
        { x: first.clientX, y: first.clientY },
        { x: second.clientX, y: second.clientY }
      );
      if (pinch.current.distance > 0) {
        const scale = distance / pinch.current.distance;
        const nextZoom = clamp(pinch.current.zoom * scale, minZoom, maxZoom);
        zoomAt(pinch.current.center.x, pinch.current.center.y, nextZoom);
      }
      return;
    }

    if (isPanning.current && panAnchor.current) {
      event.preventDefault();
      const dx = event.clientX - panAnchor.current.clientX;
      const dy = event.clientY - panAnchor.current.clientY;
      updateCamera(
        panAnchor.current.x - dx / camera.current.zoom,
        panAnchor.current.y - dy / camera.current.zoom,
        camera.current.zoom
      );
    }
  };

  // ---- wire re-routing helper (preserves intermediate waypoints) ----
  const rerouteConnectedWires = useCallback(
    (componentId: string) => {
      const state = useSchematicStore.getState();
      const allComponents = state.components;

      const getNewPos = (terminalId: string): { x: number; y: number } | null => {
        const [cid, tname] = terminalId.split(':');
        if (cid === componentId) {
          const comp = useSchematicStore.getState().components.find((x) => x.id === cid);
          if (!comp) return null;
          const defs = componentTerminalDefinitions(comp);
          const def = defs.find((d) => d.name === tname);
          if (!def) return null;
          return transformPoint(def.point, comp);
        }
        const term = graph.terminalMap[terminalId];
        return term ? term.position : null;
      };

      const updated = allComponents.map((c) => {
        if (c.type !== 'wire' || !c.terminalA || !c.terminalB || !c.points || c.points.length < 2) return c;
        const connectsStart = c.terminalA.startsWith(componentId + ':');
        const connectsEnd = c.terminalB.startsWith(componentId + ':');
        if (!connectsStart && !connectsEnd) return c;

        const pts = c.points.map((p) => ({ x: p.x, y: p.y }));
        let changed = false;
        if (connectsStart) {
          const pA = getNewPos(c.terminalA);
          if (pA) { pts.splice(0, pts.length, ...updateWireEndpoint(pts, true, pA)); changed = true; }
        }
        if (connectsEnd) {
          const pB = getNewPos(c.terminalB);
          if (pB) { pts.splice(0, pts.length, ...updateWireEndpoint(pts, false, pB)); changed = true; }
        }
        if (!changed) return c;
        return { ...c, points: pts.map((p) => ({ x: p.x, y: p.y, pressure: 0.5 })) };
      }) as SchematicComponent[];

      useSchematicStore.setState({ components: updated });
    },
    [graph]
  );

  // ---- finalize pointer ----
  const stopPointer = (event: ReactPointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    try {
      canvas?.releasePointerCapture(event.pointerId);
    } catch {
      /* ignore */
    }

    // Finalize component move
    if (tool === 'select' && moveRef.current) {
      const mv = moveRef.current;
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (p) {
        const dx = p.x - mv.anchorX;
        const dy = p.y - mv.anchorY;
        const rawX = mv.startX + dx;
        const rawY = mv.startY + dy;
        const snappedX = snapToGrid(rawX);
        const snappedY = snapToGrid(rawY);

        // Check for auto-connect on drop near terminal
        const snapHit = hitTestTerminal(snappedX, snappedY, components, mv.id, camera.current.zoom);
        let finalX = snappedX;
        let finalY = snappedY;
        if (snapHit) {
          const d = Math.hypot(snapHit.pos.x - snappedX, snapHit.pos.y - snappedY);
          if (d < GRID_SNAP) {
            finalX = snapHit.pos.x;
            finalY = snapHit.pos.y;
          }
        }

        // Commit snapped position (still suppressed)
        useSchematicStore.setState((state) => ({
          components: state.components.map((c) =>
            c.id === mv.id ? { ...c, position: { x: finalX, y: finalY } } : c
          ),
        }));
        rerouteConnectedWires(mv.id);
      }

      // Re-enable circuitStore sync and rebuild graph
      useCircuitStore.getState().setSuppressSync(false);
      useCircuitStore.getState().rebuildGraph(useSchematicStore.getState().components);

      moveRef.current = null;
      setSnapTerminals([]);
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        isPanning.current = false;
        panAnchor.current = null;
      }
      return;
    }

    // Finalize group move (multi-selection)
    if (groupMoveRef.current) {
      const gm = groupMoveRef.current;
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (p) {
        const dx = p.x - gm.anchorX;
        const dy = p.y - gm.anchorY;
        const comps = useSchematicStore.getState().components;

        // Snap each moved component to grid
        const snappedPositions = gm.originalComponentPositions.map((o) => ({
          id: o.id,
          x: snapToGrid(o.x + dx),
          y: snapToGrid(o.y + dy),
        }));

        useSchematicStore.setState((state) => ({
          components: state.components.map((c) => {
            const sp = snappedPositions.find((s) => s.id === c.id);
            if (!sp) return c;
            return { ...c, position: { x: sp.x, y: sp.y } };
          }),
        }));

        // Reroute wires for each moved component
        for (const sp of snappedPositions) {
          rerouteConnectedWires(sp.id);
        }
      }

      useCircuitStore.getState().setSuppressSync(false);
      useCircuitStore.getState().rebuildGraph(useSchematicStore.getState().components);

      groupMoveRef.current = null;
      setSnapTerminals([]);
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        isPanning.current = false;
        panAnchor.current = null;
      }
      return;
    }

    // Finalize selection rectangle
    if (selectionRectRef.current) {
      const sr = selectionRectRef.current;
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (p) {
        const x1 = Math.min(sr.startX, p.x);
        const y1 = Math.min(sr.startY, p.y);
        const x2 = Math.max(sr.startX, p.x);
        const y2 = Math.max(sr.startY, p.y);
        const w = x2 - x1;
        const h = y2 - y1;

        if (w > 5 || h > 5) {
          // Determine which components intersect the rect
          const hitComponentIds: string[] = [];
          const hitWireIds: string[] = [];

          for (const comp of components) {
            if (comp.type === 'wire') continue;
            const bounds = getComponentBounds(comp);
            if (bounds.minX <= x2 && bounds.maxX >= x1 && bounds.minY <= y2 && bounds.maxY >= y1) {
              hitComponentIds.push(comp.id);
            }
          }

          for (const wire of components) {
            if (wire.type !== 'wire' || !wire.points) continue;
            for (const pt of wire.points) {
              if (pt.x >= x1 && pt.x <= x2 && pt.y >= y1 && pt.y <= y2) {
                hitWireIds.push(wire.id);
                break;
              }
            }
          }

          useSchematicStore.getState().setSelection(hitComponentIds, hitWireIds);
        }
      }

      selectionRectRef.current = null;
      setSelectionRect(null);
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        isPanning.current = false;
        panAnchor.current = null;
      }
      return;
    }

    // Finalize wire segment drag — snap to grid, re-orthogonalize, push history
    if (wireSegDragRef.current) {
      const segDrag = wireSegDragRef.current;
      const historyBefore = useSchematicStore.getState().captureSnapshot();
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (p) {
        const snappedPos = { x: snapToGrid(p.x), y: snapToGrid(p.y) };
        const pts = segDrag.originalPoints;
        const before = pts.slice(0, segDrag.segIndex + 1);
        const after = pts.slice(segDrag.segIndex + 1);
        const newWaypoints: { x: number; y: number }[] = [...before, snappedPos, ...after];
        const newPath = flattenWirePath(newWaypoints);
        const deduped = dedupPoints(newPath);
        useSchematicStore.setState((state) => ({
          components: state.components.map((c) =>
            c.id === segDrag.wireId
              ? { ...c, points: deduped.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) }
              : c
          ),
          isDirty: true,
        }));
      }
      const historyAfter = useSchematicStore.getState().captureSnapshot();
      pushSnapshotHistory('Edit wire', historyBefore, historyAfter);
      wireSegDragRef.current = null;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        isPanning.current = false;
        panAnchor.current = null;
      }
      return;
    }

    // Finalize bend point drag — snap to grid + re-orthogonalize from original neighbors + dedup + push history
    if (bendPointDragRef.current) {
      const bdDrag = bendPointDragRef.current;
      const historyBefore = useSchematicStore.getState().captureSnapshot();
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (p) {
        const snappedPos = { x: snapToGrid(p.x), y: snapToGrid(p.y) };
        const { result } = moveBendPointInPath(bdDrag.originalPoints, bdDrag.pointIndex, snappedPos);
        const deduped = dedupPoints(result);
        useSchematicStore.setState((state) => ({
          components: state.components.map((c) =>
            c.id === bdDrag.wireId
              ? { ...c, points: deduped.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) }
              : c
          ),
          isDirty: true,
        }));
      }
      const historyAfter = useSchematicStore.getState().captureSnapshot();
      pushSnapshotHistory('Edit wire bend', historyBefore, historyAfter);
      bendPointDragRef.current = null;
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        isPanning.current = false;
        panAnchor.current = null;
      }
      return;
    }

    // Finalize wire line drawing
    if (tool === 'wire' && wireLineStartRef.current) {
      const p = pointerToCanvas(event.clientX, event.clientY);
      if (p) {
        const start = wireLineStartRef.current;
        const end = wireLineEnd ?? { x: snapToGrid(p.x), y: snapToGrid(p.y) };
        const dist = Math.hypot(end.x - start.x, end.y - start.y);
        if (dist > 3) {
          // Detect terminals at both ends (use original cursor pos for start, last-move end for terminal)
          const startTermHit = hitTestTerminal(start.x, start.y, components, undefined, camera.current.zoom);
          const endTermHit = hitTestTerminal(end.x, end.y, components, undefined, camera.current.zoom);
          const startPos = startTermHit ? startTermHit.pos : start;
          const endPos = endTermHit ? endTermHit.pos : end;

          // Orthogonal L-shape path between endpoints
          const pathPts = computeOrthogonalPath(startPos, endPos);
          if (pathPts.length < 2) return;

          const midX = (startPos.x + endPos.x) / 2;
          const midY = (startPos.y + endPos.y) / 2;

          const historyBefore = useSchematicStore.getState().captureSnapshot();
          addComponent({
            type: 'wire',
            confidence: 1,
            position: { x: midX, y: midY },
            rotation: 0,
            scale: { x: 1, y: 1 },
            terminalA: startTermHit ? startTermHit.terminalId : undefined,
            terminalB: endTermHit ? endTermHit.terminalId : undefined,
            points: pathPts.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })),
          });
          const historyAfter = useSchematicStore.getState().captureSnapshot();
          pushSnapshotHistory('Draw wire', historyBefore, historyAfter);
          // Rebuild graph immediately so wire appears connected (not dimmed)
          useCircuitStore.getState().rebuildGraph(useSchematicStore.getState().components);
        }
      }

      cancelWireRouting();
      return;
    }

    // Finalize pen / eraser stroke
    if ((tool === 'pen' || tool === 'eraser') && !isPanning.current) {
      if (drawingRef.current) {
        if (tool === 'pen') {
          // In sketch mode, always keep strokes as raw freehand
          if (sketchMode) {
            console.log('[CanvasEngine] sketchMode=true, saving stroke with', drawingRef.current.points.length, 'points');
            addStroke({
              tool: 'pen',
              color: '#fff',
              width: 3,
              points: drawingRef.current.points,
            });
            drawingRef.current = null;
            setLiveStroke(null);
            scheduleRender();
            pointers.current.delete(event.pointerId);
            if (pointers.current.size === 0) {
              isPanning.current = false;
              panAnchor.current = null;
            }
            // Auto-zoom-to-fit on first sketch stroke so user sees what they drew
            if (useDrawingStore.getState().strokes.length === 1) {
              requestAnimationFrame(() => {
                const allStrokes = useDrawingStore.getState().strokes;
                const allComponents = useSchematicStore.getState().components;
                const points: { x: number; y: number }[] = [];
                for (const s of allStrokes) for (const p of s.points) points.push(p);
                for (const c of allComponents) points.push(c.position);
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
                let z = Math.min(zoomX, zoomY);
                z = Math.max(state.minZoom, Math.min(state.maxZoom, z));
                const cx = (minX + maxX) / 2;
                const cy = (minY + maxY) / 2;
                const offset = {
                  x: cx - (canvasSize.width / 2) / z,
                  y: cy - (canvasSize.height / 2) / z,
                };
                useCanvasStore.getState().setCamera(offset, z);
              });
            }
            return;
          }

          const pts = drawingRef.current.points;
          let snappedWire = false;
          if (pts.length >= 2) {
            const first = pts[0];
            const last = pts[pts.length - 1];
            const strokeLength = Math.hypot(last.x - first.x, last.y - first.y);
            if (strokeLength < 250) {
              const snapThreshold = 15 / camera.current.zoom;
              let startTerm: import('@/circuit/graph').TerminalNode | null = null;
              let endTerm: import('@/circuit/graph').TerminalNode | null = null;
              let bestStart = snapThreshold;
              let bestEnd = snapThreshold;
              for (const t of Object.values(graph.terminalMap)) {
                const d1 = Math.hypot(t.position.x - first.x, t.position.y - first.y);
                if (d1 < bestStart) {
                  bestStart = d1;
                  startTerm = t;
                }
                const d2 = Math.hypot(t.position.x - last.x, t.position.y - last.y);
                if (d2 < bestEnd) {
                  bestEnd = d2;
                  endTerm = t;
                }
              }
              if (startTerm && endTerm && startTerm.id !== endTerm.id) {
                fadeOutStroke(pts);
                const pathPts = computeObstacleAvoidingPath(
                  startTerm.position,
                  endTerm.position,
                  []
                );
                addComponent({
                  type: 'wire',
                  confidence: 1,
                  position: {
                    x: (startTerm.position.x + endTerm.position.x) / 2,
                    y: (startTerm.position.y + endTerm.position.y) / 2,
                  },
                  rotation: 0,
                  scale: { x: 1, y: 1 },
                  terminalA: startTerm.id,
                  terminalB: endTerm.id,
                  points: pathPts.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })),
                });
                snappedWire = true;
              }
            }
          }
          if (!snappedWire) {
            // In non-sketch mode, save non-wire strokes as raw freehand
            addStroke({
              tool: 'pen',
              color: '#fff',
              width: 2,
              points: drawingRef.current.points,
            });
          }
        } else if (tool === 'eraser') {
          const radius = 12 / camera.current.zoom;
          eraseByPath(drawingRef.current.points, radius);

          // Erase components and wires that intersect the eraser path
          const intersectPts = drawingRef.current.points;
          const toRemove = new Set<string>();

          // Check components
          for (const comp of components) {
            if (comp.type === 'wire') continue;
            for (const pt of intersectPts) {
              const d = Math.hypot(comp.position.x - pt.x, comp.position.y - pt.y);
              if (d < radius) {
                toRemove.add(comp.id);
                break;
              }
            }
          }

          // Check wires
          const wires = components.filter((c) => c.type === 'wire');
          for (const wire of wires) {
            if (!wire.terminalA || !wire.terminalB) continue;
            const tA = graph.terminalMap[wire.terminalA];
            const tB = graph.terminalMap[wire.terminalB];
            if (!tA || !tB) continue;
            let wirePts: { x: number; y: number }[];
            if (wire.points && wire.points.length >= 2) {
              wirePts = wire.points.map((p) => ({ x: p.x, y: p.y }));
            } else {
              wirePts = computeOrthogonalPath(tA.position, tB.position);
            }
            for (const ept of intersectPts) {
              for (let i = 0; i < wirePts.length - 1; i++) {
                const d = pointToSegmentDist(
                  ept.x,
                  ept.y,
                  wirePts[i].x,
                  wirePts[i].y,
                  wirePts[i + 1].x,
                  wirePts[i + 1].y
                );
                if (d < radius) {
                  toRemove.add(wire.id);
                  break;
                }
              }
              if (toRemove.has(wire.id)) break;
            }
          }

          // Remove connected wires for erased components
          if (toRemove.size > 0) {
            const allIds = new Set(toRemove);
            for (const compId of toRemove) {
              const comp = components.find((c) => c.id === compId);
              if (!comp || comp.type === 'wire') continue;
              for (const w of wires) {
                const prefix = compId + ':';
                if (
                  (w.terminalA && w.terminalA.startsWith(prefix)) ||
                  (w.terminalB && w.terminalB.startsWith(prefix))
                ) {
                  allIds.add(w.id);
                }
              }
            }

            useSchematicStore.setState({
              components: components.filter((c) => !allIds.has(c.id)),
              selectedComponentId: allIds.has(
                useSchematicStore.getState().selectedComponentId ?? ''
              )
                ? null
                : useSchematicStore.getState().selectedComponentId,
              selectedWireId: allIds.has(useSchematicStore.getState().selectedWireId ?? '')
                ? null
                : useSchematicStore.getState().selectedWireId,
              isDirty: true,
            });
          }
        }
        drawingRef.current = null;
        setLiveStroke(null);
        scheduleRender();
      }
      pointers.current.delete(event.pointerId);
      if (pointers.current.size === 0) {
        isPanning.current = false;
        panAnchor.current = null;
      }
      return;
    }

    pointers.current.delete(event.pointerId);
    if (pointers.current.size === 0) {
      isPanning.current = false;
      panAnchor.current = null;
    }
  };

  const fadeOutStroke = (points: { x: number; y: number; pressure?: number }[]) => {
    const id = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
    setTransitionStrokes((prev) => [...prev, { id, points, fading: false }]);
    window.requestAnimationFrame(() => {
      setTransitionStrokes((prev) =>
        prev.map((entry) => (entry.id === id ? { ...entry, fading: true } : entry))
      );
    });
    window.setTimeout(() => {
      setTransitionStrokes((prev) => prev.filter((entry) => entry.id !== id));
    }, 260);
  };

  const markComponentFresh = (id: string) => {
    setFreshComponentIds((prev) => new Set(prev).add(id));
    window.requestAnimationFrame(() => {
      setFreshComponentIds((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      });
    });
  };

  // ==================== WHEEL ====================
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const onWheel = (event: WheelEvent) => {
      event.preventDefault();
      const delta = -event.deltaY * 0.0012;
      const nextZoom = camera.current.zoom * Math.exp(delta);
      zoomAt(event.clientX, event.clientY, nextZoom);
    };
    canvas.addEventListener('wheel', onWheel, { passive: false });
    return () => canvas.removeEventListener('wheel', onWheel);
  }, [zoomAt]);

  // ==================== CANVAS DRAW ====================
  const drawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const width = wrapper.clientWidth;
    const height = wrapper.clientHeight;
    const { x: offsetX, y: offsetY, zoom } = camera.current;
    const { lineColor, dotColor } = getGridStyle(zoom);

    ctx.clearRect(0, 0, width, height);
    ctx.fillStyle = '#050505';
    ctx.fillRect(0, 0, width, height);
    // drawCanvas entry flag


    const gridStep = BASE_GRID_SIZE * zoom;
    const centerX = width / 2;
    const centerY = height / 2;
    const originX = centerX - offsetX * zoom;
    const originY = centerY - offsetY * zoom;
    const startX = originX % gridStep;
    const startY = originY % gridStep;
    const pointSize = clamp(zoom * 0.6, MIN_POINT_SIZE, MAX_POINT_SIZE);

    ctx.fillStyle = dotColor;
    for (let x = startX; x <= width; x += gridStep) {
      for (let y = startY; y <= height; y += gridStep) {
        ctx.fillRect(x - pointSize / 2, y - pointSize / 2, pointSize, pointSize);
      }
    }

    if (zoom > 0.35) {
      ctx.strokeStyle = lineColor;
      ctx.lineWidth = 1;
      ctx.beginPath();
      for (let x = startX; x <= width; x += gridStep) {
        ctx.moveTo(x, 0);
        ctx.lineTo(x, height);
      }
      for (let y = startY; y <= height; y += gridStep) {
        ctx.moveTo(0, y);
        ctx.lineTo(width, y);
      }
      ctx.stroke();
    }

    ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    const axisX = centerX + offsetX * zoom;
    const axisY = centerY + offsetY * zoom;
    ctx.moveTo(axisX, 0);
    ctx.lineTo(axisX, height);
    ctx.moveTo(0, axisY);
    ctx.lineTo(width, axisY);
    ctx.stroke();

    const drawSmoothPath = (
      points: { x: number; y: number }[],
      color: string,
      thickness: number
    ) => {
      if (points.length < 2) return;
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1, thickness * zoom);
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      const screenPoints = points.map((p) =>
        canvasToScreen(p.x, p.y, width, height, zoom, { x: offsetX, y: offsetY })
      );
      if (points.length === 2) {
        ctx.beginPath();
        ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
        ctx.lineTo(screenPoints[1].x, screenPoints[1].y);
        ctx.stroke();
        return;
      }
      ctx.beginPath();
      ctx.moveTo(screenPoints[0].x, screenPoints[0].y);
      for (let i = 0; i < points.length - 1; i++) {
        const p0 = i === 0 ? screenPoints[0] : screenPoints[i - 1];
        const p1 = screenPoints[i];
        const p2 = screenPoints[i + 1];
        const p3 = i + 2 >= screenPoints.length ? screenPoints[i + 1] : screenPoints[i + 2];
        const cp1x = p1.x + (p2.x - p0.x) / 6;
        const cp1y = p1.y + (p2.y - p0.y) / 6;
        const cp2x = p2.x - (p3.x - p1.x) / 6;
        const cp2y = p2.y - (p3.y - p1.y) / 6;
        ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
      }
      ctx.stroke();
    };

    // Read strokes directly from store to avoid stale closure issues
    const latestStrokes = useDrawingStore.getState().strokes;
    latestStrokes.forEach((stroke) => {
      const color = stroke.tool === 'pen' ? (stroke.color ?? 'rgba(255,255,255,0.55)') : 'rgba(255,255,255,0.35)';
      drawSmoothPath(stroke.points, color, stroke.width);
    });
    if (liveStroke && liveStroke.length > 0) {
      const color = tool === 'pen' ? 'rgba(255,255,255,0.55)' : 'rgba(255,255,255,0.35)';
      const thickness = tool === 'pen' ? 2 : 20;
      drawSmoothPath(liveStroke, color, thickness);
    }
  };
  drawCanvasRef.current = drawCanvas;

  // ==================== LIFECYCLE ====================
  useEffect(() => {
    resizeCanvas();
    const observer = new ResizeObserver(resizeCanvas);
    const wrapper = wrapperRef.current;
    if (wrapper) observer.observe(wrapper);
    return () => {
      if (frame.current) {
        window.cancelAnimationFrame(frame.current);
        frame.current = null;
      }
      observer.disconnect();
    };
  }, [resizeCanvas]);

  useEffect(() => {
    camera.current.x = offset.x;
    camera.current.y = offset.y;
    camera.current.zoom = zoom;
    scheduleRender();
  }, [offset.x, offset.y, zoom, scheduleRender]);

  useEffect(() => {
    scheduleRender();
  }, [scheduleRender]);
  useEffect(() => {
    scheduleRender();
  }, [strokes, svgSize.width, svgSize.height, scheduleRender]);

  // Mount-time dedup of accumulated ghost points in existing wires
  useEffect(() => {
    const state = useSchematicStore.getState();
    let changed = false;
    const cleaned = state.components.map((c) => {
      if (c.type !== 'wire' || !c.points || c.points.length < 3) return c;
      const pts = c.points.map((p) => ({ x: p.x, y: p.y }));
      const deduped = dedupPoints(pts);
      if (deduped.length !== pts.length) {
        changed = true;
        return { ...c, points: deduped.map((p) => ({ x: p.x, y: p.y, pressure: 0.5 })) };
      }
      return c;
    });
    if (changed) useSchematicStore.setState({ components: cleaned });
  }, []);

  // ==================== DOUBLE-CLICK (insert bend point in wire) ====================
  const handleDoubleClick = (event: React.MouseEvent<HTMLCanvasElement>) => {
    // Double-click on a wire segment → insert bend point
    const p = pointerToCanvas(event.clientX, event.clientY);
    if (!p) return;
    const segHit = hitTestWireSegment(p.x, p.y, components, graph, camera.current.zoom);
    if (segHit) {
      const wire = components.find((c) => c.id === segHit.wireId);
      if (!wire || !wire.points || wire.points.length < 2) return;
      const pts = wire.points.map((pt) => ({ x: pt.x, y: pt.y }));
      const newWaypoints: { x: number; y: number }[] = [
        ...pts.slice(0, segHit.segIndex + 1),
        segHit.clickPoint,
        ...pts.slice(segHit.segIndex + 1),
      ];
      const newPath = flattenWirePath(newWaypoints);
      useSchematicStore.setState((state) => ({
        components: state.components.map((c) =>
          c.id === segHit.wireId
            ? { ...c, points: newPath.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) }
            : c
        ),
      }));
    }

    // Not routing — double-click on a switch component to toggle open/closed
    const hitThreshold = 20 / camera.current.zoom;
    const hitThresholdSq = hitThreshold * hitThreshold;
    for (const comp of components) {
      if (comp.type === 'wire') continue;
      const isSwitch = comp.params?.simType === 'switch' || comp.kicadSymbolId?.startsWith('sw_');
      if (!isSwitch) continue;
      const dx = p.x - comp.position.x;
      const dy = p.y - comp.position.y;
      if (dx * dx + dy * dy <= hitThresholdSq) {
        const closed = comp.params?.closed !== false;
        useSchematicStore.getState().updateComponent(comp.id, {
          params: { ...comp.params, simType: 'switch', closed: !closed },
        });
        return;
      }
    }
  };

  // ==================== RIGHT-CLICK (context menu) ====================
  const handleContextMenu = (event: React.MouseEvent<HTMLCanvasElement>) => {
    event.preventDefault();
    if (wireLineStartRef.current) return;
    const p = pointerToCanvas(event.clientX, event.clientY);
    if (!p) return;

    // Check: component hit first
    const ctxMenuThreshold = 20 / camera.current.zoom;
    const ctxMenuThresholdSq = ctxMenuThreshold * ctxMenuThreshold;
    const compHit = components.find((c) => {
      const dx = p.x - c.position.x;
      const dy = p.y - c.position.y;
      return dx * dx + dy * dy <= ctxMenuThresholdSq;
    });
    if (compHit) {
      setSelectedComponentId(compHit.id);
      setContextMenu({
        x: event.clientX,
        y: event.clientY,
        items: [
          { label: 'Rotate', shortcut: 'R', action: () => { useSchematicStore.getState().rotateComponent(compHit.id); } },
          { label: 'Copy', shortcut: 'Ctrl+C', action: () => {
            navigator.clipboard.writeText(JSON.stringify([{
              type: compHit.type, confidence: compHit.confidence, rotation: compHit.rotation,
              scale: compHit.scale, value: compHit.value, params: compHit.params,
              kicadSymbolId: compHit.kicadSymbolId, normalizedPinPositions: compHit.normalizedPinPositions,
              symbolViewBox: compHit.symbolViewBox, points: compHit.points, terminalA: compHit.terminalA, terminalB: compHit.terminalB,
            }]));
          }},
          { label: 'Duplicate', action: () => {
            const cam = useCanvasStore.getState();
            const cx = cam.offset.x + cam.canvasSize.width / 2 / cam.zoom;
            const cy = cam.offset.y + cam.canvasSize.height / 2 / cam.zoom;
            useSchematicStore.getState().addComponent({
              type: compHit.type, confidence: compHit.confidence ?? 1,
              position: { x: snapToGrid(cx), y: snapToGrid(cy) },
              rotation: compHit.rotation ?? 0, scale: compHit.scale ?? { x: 1, y: 1 },
              value: compHit.value, params: compHit.params, kicadSymbolId: compHit.kicadSymbolId,
              normalizedPinPositions: compHit.normalizedPinPositions, symbolViewBox: compHit.symbolViewBox,
              points: compHit.points, terminalA: compHit.terminalA, terminalB: compHit.terminalB,
            });
          }},
          { label: 'Delete', shortcut: 'Del', action: () => { useSchematicStore.getState().removeComponentById(compHit.id); }, danger: true },
        ],
      });
      return;
    }

    // Check: bend point → delete it
    const bendHit = hitTestBendPoint(p.x, p.y, components, camera.current.zoom);
    if (bendHit) {
      setSelectedWireId(bendHit.wireId);
      setContextMenu({
        x: event.clientX, y: event.clientY,
        items: [{
          label: 'Delete bend point',
          danger: true,
          action: () => {
            const wire = components.find((c) => c.id === bendHit.wireId);
            if (wire && wire.points && wire.points.length > 2) {
              const pts = wire.points.map((pt) => ({ x: pt.x, y: pt.y }));
              const i = bendHit.pointIndex;
              if (i > 0 && i < pts.length - 1) {
                pts.splice(i, 1);
                const ortho = computeOrthogonalPath(pts[i - 1], pts[i]);
                pts.splice(i - 1, 2, ...ortho);
                useSchematicStore.setState((state) => ({
                  components: state.components.map((c) => c.id === bendHit.wireId ? { ...c, points: pts.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) } : c),
                }));
              }
            }
          },
        }],
      });
      return;
    }

    // Check: wire segment → insert bend point
    const segHit = hitTestWireSegment(p.x, p.y, components, graph, camera.current.zoom);
    if (segHit) {
      setSelectedWireId(segHit.wireId);
      setContextMenu({
        x: event.clientX, y: event.clientY,
        items: [{
          label: 'Insert bend point', action: () => {
            const wire = components.find((c) => c.id === segHit.wireId);
            if (!wire || !wire.points || wire.points.length < 2) return;
            const pts = wire.points.map((pt) => ({ x: pt.x, y: pt.y }));
            const newWaypoints: { x: number; y: number }[] = [
              ...pts.slice(0, segHit.segIndex + 1), segHit.clickPoint, ...pts.slice(segHit.segIndex + 1),
            ];
            const newPath = flattenWirePath(newWaypoints);
            useSchematicStore.setState((state) => ({
              components: state.components.map((c) => c.id === segHit.wireId ? { ...c, points: newPath.map((pt) => ({ x: pt.x, y: pt.y, pressure: 0.5 })) } : c),
            }));
          },
        }],
      });
      return;
    }

    // Empty canvas: paste / zoom to fit
    setContextMenu({
      x: event.clientX, y: event.clientY,
      items: [
        { label: 'Paste', shortcut: 'Ctrl+V', action: () => {
          navigator.clipboard.readText().then((text) => {
            try {
              const pasted = JSON.parse(text);
              const arr = Array.isArray(pasted) ? pasted : [pasted];
              const snappedX = snapToGrid(p.x);
              const snappedY = snapToGrid(p.y);
              for (let i = 0; i < arr.length; i++) {
                const comp = arr[i];
                useSchematicStore.getState().addComponent({
                  type: comp.type, confidence: comp.confidence ?? 1,
                  position: { x: snapToGrid(snappedX + i * GRID_SNAP), y: snapToGrid(snappedY + i * GRID_SNAP) },
                  rotation: comp.rotation ?? 0, scale: comp.scale ?? { x: 1, y: 1 },
                  value: comp.value, params: comp.params, kicadSymbolId: comp.kicadSymbolId,
                  normalizedPinPositions: comp.normalizedPinPositions, symbolViewBox: comp.symbolViewBox,
                  points: comp.points, terminalA: comp.terminalA, terminalB: comp.terminalB,
                });
              }
            } catch { /* ignore */ }
          });
        }},
        { label: 'Zoom to fit', shortcut: 'Ctrl+0', action: () => {
          const _strokes = useDrawingStore.getState().strokes;
          const _comps = useSchematicStore.getState().components;
          const _pts: { x: number; y: number }[] = [];
          for (const s of _strokes) { for (const sp of s.points) _pts.push(sp); }
          for (const c of _comps) { _pts.push(c.position); }
          if (_pts.length > 0) {
            const _cs = useCanvasStore.getState().canvasSize;
            if (_cs.width > 0 && _cs.height > 0) {
              const _pad = 100;
              const _minX = Math.min(..._pts.map(p2 => p2.x));
              const _minY = Math.min(..._pts.map(p2 => p2.y));
              const _maxX = Math.max(..._pts.map(p2 => p2.x));
              const _maxY = Math.max(..._pts.map(p2 => p2.y));
              let _z = Math.min((_cs.width - _pad * 2) / (_maxX - _minX || 1), (_cs.height - _pad * 2) / (_maxY - _minY || 1));
              const _csState = useCanvasStore.getState();
              _z = Math.max(_csState.minZoom, Math.min(_csState.maxZoom, _z));
              useCanvasStore.getState().setCamera({ x: (_minX + _maxX) / 2 - (_cs.width / 2) / _z, y: (_minY + _maxY) / 2 - (_cs.height / 2) / _z }, _z);
            }
          }
        }},
      ],
    });
  };

  // ==================== DRAG + DROP ====================
  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'copy';
    const ghostType = getDragComponentType();
    if (!ghostType) return;
    const p = pointerToCanvas(event.clientX, event.clientY);
    if (!p) return;
    const kicadId = getDragKicadSymbolId();
    setDragGhost({ type: ghostType, canvasPos: p, kicadSymbolId: kicadId ?? undefined });
  };

  const handleDragLeave = () => {
    setDragGhost(null);
  };

  const handleDrop = async (event: React.DragEvent) => {
    event.preventDefault();
    const p = pointerToCanvas(event.clientX, event.clientY);
    if (!p) return;
    const snappedX = snapToGrid(p.x);
    const snappedY = snapToGrid(p.y);

    // Check for KiCad symbol drop
    const kicadData = event.dataTransfer.getData('application/volt-kicad-symbol');
    if (kicadData) {
      try {
        const parsed = JSON.parse(kicadData);
        const symId: string = parsed.kicadSymbolId;

        // Look up pin definitions for wire routing from shared cache
        let kicadPins: import('@/store/schematicStore').KicadPinDef[] | undefined;
        try {
          const rawPins = getKicadPins(symId);
          if (rawPins && Array.isArray(rawPins)) {
            kicadPins = rawPins.map((pd: any) => ({
              name: pd.name ?? '',
              number: pd.number ?? '',
              x: pd.x ?? 0,
              y: pd.y ?? 0,
              length: pd.length ?? 2.54,
              orientation: pd.orientation ?? 270,
              electricalType: pd.electricalType ?? 'passive',
            }));
          }
        } catch {
          // proceed without pin data
        }

        // Fetch normalized pin positions + viewBox for terminal dot alignment from shared cache
        let normalizedPinPositions: import('@/store/schematicStore').NormalizedPinPos[] | undefined;
        let symbolViewBox: { w: number; h: number } | undefined;
        try {
          const pinData = getNormalizedPins(symId);
          if (pinData) {
            symbolViewBox = pinData.symbolViewBox;
            normalizedPinPositions = pinData.normalizedPinPositions;
          }
        } catch {
          // normalized-pins.json not available
        }

        const params = inferParams(symId);
        addComponent({
          type: 'unknown',
          confidence: 1,
          position: { x: snappedX, y: snappedY },
          rotation: 0,
          scale: { x: DEFAULT_DROP_SCALE, y: DEFAULT_DROP_SCALE },
          kicadSymbolId: symId,
          kicadPins,
          normalizedPinPositions,
          symbolViewBox,
          params,
        });
        setDragGhost(null);
        return;
      } catch {
        // fall through to regular component drop
      }
    }

    const type = event.dataTransfer.getData('text/plain') as ComponentType | '';
    if (!type) return;
    addComponent({
      type,
      confidence: 1,
      position: { x: snappedX, y: snappedY },
      rotation: 0,
      scale: { x: DEFAULT_DROP_SCALE, y: DEFAULT_DROP_SCALE },
    });
    setDragGhost(null);
  };

  // ==================== RENDER ====================
  return (
    <div
      ref={wrapperRef}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className="absolute inset-0 w-full h-full max-h-full box-border overflow-hidden rounded-xl border border-default bg-surface"
    >
      <canvas
        ref={canvasRef}
        className={`block h-full w-full touch-none`}
        style={{ cursor: cursorStyle }}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={stopPointer}
        onPointerCancel={stopPointer}
        onDoubleClick={handleDoubleClick}
        onContextMenu={handleContextMenu}
      />
      <svg
        width={svgSize.width}
        height={svgSize.height}
        className="absolute left-0 top-0 pointer-events-none"
        style={{ transform: 'translateZ(0)' }}
      >
        <SchematicOverlay
          components={components}
          transitionStrokes={transitionStrokes}
          freshComponentIds={freshComponentIds}
          camera={camera.current}
          svgSize={svgSize}
          snapTerminals={snapTerminals}
          selectedComponentId={selectedComponentId}
          wireLineStart={wireLineStart}
          wireLineEnd={wireLineEnd}
          dragGhost={dragGhost}
          selectionRect={selectionRect}
          liveStroke={liveStroke}
          activeTool={tool}
          unrecognizedStrokes={unrecognizedStrokes}
        />
        <SimulationOverlay
          result={simResult}
          graph={graph}
          components={components}
          camera={camera.current}
          svgSize={svgSize}
        />
      </svg>
      {contextMenu && (
        <ContextMenu menu={contextMenu} onClose={() => setContextMenu(null)} />
      )}
    </div>
  );
}
