import { useCallback, useEffect, useRef, useState } from 'react';
import useBlueprintStore, {
  type BlueprintPrimitive,
  type PenStroke,
  type LinePrimitive,
  type RectPrimitive,
  type CirclePrimitive,
  type TextPrimitive,
} from '@/store/blueprintStore';

const BASE_GRID_SIZE = 30;
const MIN_ZOOM = 0.25;
const MAX_ZOOM = 4;
const MIN_POINT_SIZE = 0.5;
const MAX_POINT_SIZE = 3;

function clamp(v: number, min: number, max: number) {
  return Math.max(min, Math.min(max, v));
}

function canvasToScreen(wx: number, wy: number, cw: number, ch: number, zoom: number, cam: { x: number; y: number }) {
  return { x: cw / 2 + (wx - cam.x) * zoom, y: ch / 2 + (wy - cam.y) * zoom };
}

function screenToCanvas(sx: number, sy: number, cw: number, ch: number, zoom: number, cam: { x: number; y: number }) {
  return { x: (sx - cw / 2) / zoom + cam.x, y: (sy - ch / 2) / zoom + cam.y };
}

function drawSmoothPath(ctx: CanvasRenderingContext2D, points: { x: number; y: number }[], color: string, thickness: number) {
  if (points.length < 2) return;
  ctx.strokeStyle = color;
  ctx.lineWidth = Math.max(1, thickness);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  if (points.length === 2) {
    ctx.beginPath();
    ctx.moveTo(points[0].x, points[0].y);
    ctx.lineTo(points[1].x, points[1].y);
    ctx.stroke();
    return;
  }
  ctx.beginPath();
  ctx.moveTo(points[0].x, points[0].y);
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = i === 0 ? points[0] : points[i - 1];
    const p1 = points[i];
    const p2 = points[i + 1];
    const p3 = i + 2 >= points.length ? points[i + 1] : points[i + 2];
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    ctx.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, p2.x, p2.y);
  }
  ctx.stroke();
}

function distToSegmentSq(px: number, py: number, ax: number, ay: number, bx: number, by: number): number {
  const dx = bx - ax;
  const dy = by - ay;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return (px - ax) ** 2 + (py - ay) ** 2;
  let t = ((px - ax) * dx + (py - ay) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  return (px - (ax + t * dx)) ** 2 + (py - (ay + t * dy)) ** 2;
}

function shouldErase(prim: BlueprintPrimitive, point: { x: number; y: number }, radius: number): boolean {
  const r2 = radius * radius;
  switch (prim.type) {
    case 'pen':
      for (const p of prim.points) {
        if ((p.x - point.x) ** 2 + (p.y - point.y) ** 2 < r2) return true;
      }
      return false;
    case 'line':
      return distToSegmentSq(point.x, point.y, prim.x1, prim.y1, prim.x2, prim.y2) < r2;
    case 'rect':
      return (
        (Math.abs(point.x - prim.x) < radius ||
          Math.abs(point.x - (prim.x + prim.rectW)) < radius ||
          Math.abs(point.y - prim.y) < radius ||
          Math.abs(point.y - (prim.y + prim.rectH)) < radius) &&
        point.x >= prim.x - radius &&
        point.x <= prim.x + prim.rectW + radius &&
        point.y >= prim.y - radius &&
        point.y <= prim.y + prim.rectH + radius
      );
    case 'circle':
      return Math.abs(Math.hypot(point.x - prim.cx, point.y - prim.cy) - prim.rx) < radius;
    case 'text':
      return Math.hypot(point.x - prim.x, point.y - prim.y) < radius;
    default:
      return false;
  }
}

interface InlineTextEdit {
  worldX: number;
  worldY: number;
  screenX: number;
  screenY: number;
  text: string;
}

export default function BlueprintCanvas() {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const frameRef = useRef<number | null>(null);
  const cameraRef = useRef({ x: 0, y: 0, zoom: 1 });
  const imgCacheRef = useRef<HTMLImageElement | null>(null);

  const primitives = useBlueprintStore((s) => s.primitives);
  const tool = useBlueprintStore((s) => s.tool);
  const color = useBlueprintStore((s) => s.color);
  const width = useBlueprintStore((s) => s.width);
  const refImage = useBlueprintStore((s) => s.referenceImage);
  const setCamera = useBlueprintStore((s) => s.setCamera);
  const addPrimitive = useBlueprintStore((s) => s.addPrimitive);
  const removePrimitive = useBlueprintStore((s) => s.removePrimitive);
  const pushUndoState = useBlueprintStore((s) => s.pushUndoState);
  const blueprintUndo = useBlueprintStore((s) => s.undo);
  const blueprintRedo = useBlueprintStore((s) => s.redo);

  const [livePoints, setLivePoints] = useState<{ x: number; y: number }[] | null>(null);
  const [inlineEdit, setInlineEdit] = useState<InlineTextEdit | null>(null);
  const [spacePan, setSpacePan] = useState(false);
  const [shiftHeld, setShiftHeld] = useState(false);

  const drawingRef = useRef<{ points: { x: number; y: number }[] } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const panStartRef = useRef<{ x: number; y: number; camX: number; camY: number } | null>(null);
  const pointerDownPos = useRef<{ x: number; y: number } | null>(null);
  const drawRef = useRef<() => void>(() => {});

  // Cache reference image
  useEffect(() => {
    if (refImage) {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        imgCacheRef.current = img;
        scheduleRender();
      };
      img.src = refImage;
    } else {
      imgCacheRef.current = null;
    }
  }, [refImage]);

  const scheduleRender = useCallback(() => {
    if (frameRef.current != null) return;
    frameRef.current = requestAnimationFrame(() => {
      frameRef.current = null;
      drawRef.current();
    });
  }, []);

  const syncCamera = useCallback(
    (x: number, y: number, z: number) => {
      const zz = clamp(z, MIN_ZOOM, MAX_ZOOM);
      cameraRef.current = { x, y, zoom: zz };
      setCamera({ x, y, zoom: zz });
      scheduleRender();
    },
    [setCamera, scheduleRender]
  );

  // Sync camera ref with store
  useEffect(() => {
    cameraRef.current = { x: useBlueprintStore.getState().camera.x, y: useBlueprintStore.getState().camera.y, zoom: useBlueprintStore.getState().camera.zoom };
  }, []);

  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const wrapper = wrapperRef.current;
    if (!canvas || !wrapper) return;
    const rect = wrapper.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.style.width = `${rect.width}px`;
    canvas.style.height = `${rect.height}px`;
    canvas.width = Math.max(1, Math.floor(rect.width * dpr));
    canvas.height = Math.max(1, Math.floor(rect.height * dpr));
    const ctx = canvas.getContext('2d');
    if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    scheduleRender();
  }, []);

  useEffect(() => {
    resizeCanvas();
    const obs = new ResizeObserver(resizeCanvas);
    const w = wrapperRef.current;
    if (w) obs.observe(w);
    return () => obs.disconnect();
  }, [resizeCanvas]);

  useEffect(() => {
    scheduleRender();
  }, [primitives, livePoints, tool, refImage]);

  // Keyboard
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === ' ' && !inlineEdit) {
        e.preventDefault();
        setSpacePan(true);
        return;
      }
      if (e.key === 'Shift') {
        setShiftHeld(true);
      }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey) && e.shiftKey) {
        e.preventDefault();
        blueprintRedo();
        return;
      }
      if ((e.key === 'z' || e.key === 'Z') && (e.ctrlKey || e.metaKey)) {
        e.preventDefault();
        blueprintUndo();
        return;
      }
      if (e.key === 'Escape') {
        if (inlineEdit) {
          setInlineEdit(null);
        } else {
          setLivePoints(null);
          drawingRef.current = null;
          dragStartRef.current = null;
        }
      }
    };
    const keyUp = (e: KeyboardEvent) => {
      if (e.key === ' ') {
        setSpacePan(false);
      }
      if (e.key === 'Shift') {
        setShiftHeld(false);
      }
    };
    window.addEventListener('keydown', handler);
    window.addEventListener('keyup', keyUp);
    return () => {
      window.removeEventListener('keydown', handler);
      window.removeEventListener('keyup', keyUp);
    };
  }, [inlineEdit, blueprintUndo, blueprintRedo]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const w = wrapper.clientWidth;
    const h = wrapper.clientHeight;
    const cam = cameraRef.current;

    ctx.clearRect(0, 0, w, h);
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, w, h);

    const gridStep = BASE_GRID_SIZE * cam.zoom;
    const originX = w / 2 - cam.x * cam.zoom;
    const originY = h / 2 - cam.y * cam.zoom;
    const startX = originX % gridStep;
    const startY = originY % gridStep;

    const dotSize = clamp(cam.zoom * 0.6, MIN_POINT_SIZE, MAX_POINT_SIZE);
    ctx.fillStyle = 'rgba(255,255,255,0.12)';
    for (let x = startX; x <= w; x += gridStep) {
      for (let y = startY; y <= h; y += gridStep) {
        ctx.fillRect(x - dotSize / 2, y - dotSize / 2, dotSize, dotSize);
      }
    }

    // Reference image
    const cachedImg = imgCacheRef.current;
    if (cachedImg && refImage) {
      ctx.save();
      ctx.globalAlpha = 0.3;
      const sx = w / 2 - cam.x * cam.zoom;
      const sy = h / 2 - cam.y * cam.zoom;
      ctx.drawImage(cachedImg, sx, sy, cachedImg.naturalWidth * cam.zoom, cachedImg.naturalHeight * cam.zoom);
      ctx.restore();
    }

    const toScreen = (wx: number, wy: number) => canvasToScreen(wx, wy, w, h, cam.zoom, cam);

    for (const p of primitives) {
      switch (p.type) {
        case 'pen': {
          const pts = p.points.map((pt) => toScreen(pt.x, pt.y));
          drawSmoothPath(ctx, pts, p.color, p.strokeWidth);
          break;
        }
        case 'line': {
          const s1 = toScreen(p.x1, p.y1);
          const s2 = toScreen(p.x2, p.y2);
          ctx.strokeStyle = p.color;
      ctx.lineWidth = Math.max(1, p.strokeWidth);
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s1.x, s1.y);
      ctx.lineTo(s2.x, s2.y);
      ctx.stroke();
          break;
        }
        case 'rect': {
          const s1 = toScreen(p.x, p.y);
          const s2 = toScreen(p.x + p.rectW, p.y + p.rectH);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.strokeWidth);
          ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
          break;
        }
        case 'circle': {
          const sc = toScreen(p.cx, p.cy);
          ctx.strokeStyle = p.color;
          ctx.lineWidth = Math.max(1, p.strokeWidth);
          ctx.beginPath();
          ctx.ellipse(sc.x, sc.y, p.rx * cam.zoom, p.ry * cam.zoom, 0, 0, Math.PI * 2);
          ctx.stroke();
          break;
        }
        case 'text': {
          const st = toScreen(p.x, p.y);
          ctx.fillStyle = p.color;
          ctx.font = `${Math.max(10, p.fontSize * cam.zoom)}px Inter, sans-serif`;
          ctx.textBaseline = 'top';
          ctx.fillText(p.text, st.x, st.y);
          break;
        }
      }
    }

    // Live preview
    if (livePoints && livePoints.length > 0) {
      if (tool === 'line' && livePoints.length === 2) {
        const s1 = toScreen(livePoints[0].x, livePoints[0].y);
        let endPt = livePoints[1];
        if (shiftHeld) {
          const dx = endPt.x - livePoints[0].x;
          const dy = endPt.y - livePoints[0].y;
          const angle = Math.atan2(dy, dx);
          const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
          const len = Math.hypot(dx, dy);
          endPt = { x: livePoints[0].x + Math.cos(snapped) * len, y: livePoints[0].y + Math.sin(snapped) * len };
        }
        const s2 = toScreen(endPt.x, endPt.y);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, width);
        ctx.lineCap = 'round';
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.moveTo(s1.x, s1.y);
        ctx.lineTo(s2.x, s2.y);
        ctx.stroke();
        ctx.setLineDash([]);
      } else if (tool === 'rect' && livePoints.length === 2) {
        const s1 = toScreen(livePoints[0].x, livePoints[0].y);
        const s2 = toScreen(livePoints[1].x, livePoints[1].y);
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, width);
        ctx.setLineDash([6, 4]);
        ctx.strokeRect(s1.x, s1.y, s2.x - s1.x, s2.y - s1.y);
        ctx.setLineDash([]);
      } else if (tool === 'circle' && livePoints.length === 2) {
        const s1 = toScreen(livePoints[0].x, livePoints[0].y);
        const s2 = toScreen(livePoints[1].x, livePoints[1].y);
        const cx = (s1.x + s2.x) / 2;
        const cy = (s1.y + s2.y) / 2;
        const r = Math.max(Math.abs(s2.x - s1.x), Math.abs(s2.y - s1.y)) / 2;
        ctx.strokeStyle = color;
        ctx.lineWidth = Math.max(1, width);
        ctx.setLineDash([6, 4]);
        ctx.beginPath();
        ctx.arc(cx, cy, r, 0, Math.PI * 2);
        ctx.stroke();
        ctx.setLineDash([]);
      } else {
        const pts = livePoints.map((pt) => toScreen(pt.x, pt.y));
        drawSmoothPath(ctx, pts, color, width);
      }
    }
  }, [primitives, livePoints, tool, color, width, refImage, shiftHeld]);
  drawRef.current = draw;

  // ============ POINTER ============

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      const wrapper = wrapperRef.current;
      if (!canvas || !wrapper) return;
      canvas.setPointerCapture(e.pointerId);

      const rect = wrapper.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = cameraRef.current;
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      const canvasPt = screenToCanvas(sx, sy, cw, ch, cam.zoom, cam);
      pointerDownPos.current = { x: sx, y: sy };

      if (spacePan || tool === 'pan') {
        panStartRef.current = { x: sx, y: sy, camX: cam.x, camY: cam.y };
        return;
      }

      if (tool === 'pen') {
        pushUndoState();
        drawingRef.current = { points: [canvasPt] };
        setLivePoints([canvasPt]);
      } else if (tool === 'line' || tool === 'rect' || tool === 'circle') {
        pushUndoState();
        dragStartRef.current = canvasPt;
        setLivePoints([canvasPt]);
      } else if (tool === 'eraser') {
        pushUndoState();
        drawingRef.current = { points: [canvasPt] };
      } else if (tool === 'text') {
        setInlineEdit({
          worldX: canvasPt.x,
          worldY: canvasPt.y,
          screenX: sx,
          screenY: sy,
          text: '',
        });
      }
    },
    [tool, spacePan, pushUndoState]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = cameraRef.current;
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      const canvasPt = screenToCanvas(sx, sy, cw, ch, cam.zoom, cam);

      if (panStartRef.current) {
        const dx = sx - panStartRef.current.x;
        const dy = sy - panStartRef.current.y;
        syncCamera(panStartRef.current.camX - dx / cam.zoom, panStartRef.current.camY - dy / cam.zoom, cam.zoom);
        return;
      }

      if (tool === 'pen' && drawingRef.current) {
        drawingRef.current.points.push(canvasPt);
        setLivePoints([...drawingRef.current.points]);
      } else if ((tool === 'line' || tool === 'rect' || tool === 'circle') && dragStartRef.current) {
        setLivePoints([dragStartRef.current, canvasPt]);
      } else if (tool === 'eraser' && drawingRef.current) {
        drawingRef.current.points.push(canvasPt);
        const store = useBlueprintStore.getState();
        const eraseRadius = 20 / cam.zoom;
        const toRemove: string[] = [];
        for (const prim of store.primitives) {
          if (shouldErase(prim, canvasPt, eraseRadius)) {
            toRemove.push(prim.id);
          }
        }
        for (const id of toRemove) {
          store.removePrimitive(id);
        }
      }
    },
    [tool, syncCamera]
  );

  const handlePointerUp = useCallback(
    (e: React.PointerEvent<HTMLCanvasElement>) => {
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const sx = e.clientX - rect.left;
      const sy = e.clientY - rect.top;
      const cam = cameraRef.current;
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      const canvasPt = screenToCanvas(sx, sy, cw, ch, cam.zoom, cam);

      panStartRef.current = null;

      if (tool === 'pen' && drawingRef.current) {
        const pts = drawingRef.current.points;
        if (pts.length >= 2) {
          addPrimitive({ id: '', type: 'pen', points: pts, color, strokeWidth: width } as PenStroke);
        }
        drawingRef.current = null;
        setLivePoints(null);
      } else if ((tool === 'line' || tool === 'rect' || tool === 'circle') && dragStartRef.current) {
        const start = dragStartRef.current;
        const diff = Math.hypot(canvasPt.x - start.x, canvasPt.y - start.y);
        if (diff > 3) {
          let endPt = canvasPt;
          if (tool === 'line' && shiftHeld) {
            const dx = endPt.x - start.x;
            const dy = endPt.y - start.y;
            const angle = Math.atan2(dy, dx);
            const snapped = Math.round(angle / (Math.PI / 4)) * (Math.PI / 4);
            const len = Math.hypot(dx, dy);
            endPt = { x: start.x + Math.cos(snapped) * len, y: start.y + Math.sin(snapped) * len };
          }
          if (tool === 'line') {
            addPrimitive({ id: '', type: 'line', x1: start.x, y1: start.y, x2: endPt.x, y2: endPt.y, color, strokeWidth: width } as LinePrimitive);
          } else if (tool === 'rect') {
            addPrimitive({
              id: '', type: 'rect', x: Math.min(start.x, endPt.x), y: Math.min(start.y, endPt.y),
              rectW: Math.abs(endPt.x - start.x), rectH: Math.abs(endPt.y - start.y), color, strokeWidth: width,
            } as RectPrimitive);
          } else if (tool === 'circle') {
            const cx = (start.x + endPt.x) / 2;
            const cy = (start.y + endPt.y) / 2;
            const r = Math.abs(endPt.x - start.x) / 2;
            addPrimitive({ id: '', type: 'circle', cx, cy, rx: r, ry: r, color, strokeWidth: width } as CirclePrimitive);
          }
        }
        dragStartRef.current = null;
        setLivePoints(null);
      } else if (tool === 'eraser') {
        drawingRef.current = null;
      }
    },
    [tool, color, width, addPrimitive, shiftHeld]
  );

  const handleTextConfirm = useCallback(
    (text: string) => {
      if (!inlineEdit) return;
      if (text.trim()) {
        pushUndoState();
        addPrimitive({ id: '', type: 'text', x: inlineEdit.worldX, y: inlineEdit.worldY, text: text.trim(), color, fontSize: 16 } as TextPrimitive);
      }
      setInlineEdit(null);
    },
    [inlineEdit, color, pushUndoState, addPrimitive]
  );

  const handleWheel = useCallback(
    (e: React.WheelEvent<HTMLCanvasElement>) => {
      e.preventDefault();
      const wrapper = wrapperRef.current;
      if (!wrapper) return;
      const rect = wrapper.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const cam = cameraRef.current;
      const cw = wrapper.clientWidth;
      const ch = wrapper.clientHeight;
      const factor = e.deltaY > 0 ? 0.9 : 1.1;
      const newZoom = clamp(cam.zoom * factor, MIN_ZOOM, MAX_ZOOM);
      const worldPos = screenToCanvas(mx, my, cw, ch, cam.zoom, cam);
      const newX = worldPos.x - (mx - cw / 2) / newZoom;
      const newY = worldPos.y - (my - ch / 2) / newZoom;
      syncCamera(newX, newY, newZoom);
    },
    [syncCamera]
  );

  return (
    <div ref={wrapperRef} className="absolute inset-0 w-full h-full overflow-hidden" style={{ background: '#000000' }}>
      <canvas
        ref={canvasRef}
        className="block h-full w-full touch-none"
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={() => {
          drawingRef.current = null;
          dragStartRef.current = null;
          panStartRef.current = null;
          setLivePoints(null);
        }}
        onWheel={handleWheel}
        style={{
          cursor:
            tool === 'pan' || spacePan ? 'grab'
            : tool === 'pen' || tool === 'line' || tool === 'rect' || tool === 'circle' || tool === 'eraser' ? 'crosshair'
            : tool === 'text' ? 'text'
            : 'default',
        }}
      />
      {inlineEdit && (
        <input
          autoFocus
          type="text"
          className="absolute rounded border border-accent bg-base px-2 py-1 text-sm text-text-primary outline-none"
          style={{ left: inlineEdit.screenX, top: inlineEdit.screenY, minWidth: 120 }}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleTextConfirm((e.target as HTMLInputElement).value);
            if (e.key === 'Escape') setInlineEdit(null);
          }}
          onBlur={(e) => handleTextConfirm(e.target.value)}
        />
      )}
    </div>
  );
}
