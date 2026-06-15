export interface CanvasOffset {
  x: number;
  y: number;
}

export const clamp = (value: number, min: number, max: number) =>
  Math.min(Math.max(value, min), max);

export const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(b.x - a.x, b.y - a.y);

export const getMidpoint = (a: { x: number; y: number }, b: { x: number; y: number }) => ({
  x: (a.x + b.x) / 2,
  y: (a.y + b.y) / 2,
});

export const screenToCanvas = (
  screenX: number,
  screenY: number,
  width: number,
  height: number,
  zoom: number,
  offset: CanvasOffset
) => ({
  x: (screenX - width / 2) / zoom + offset.x,
  y: (screenY - height / 2) / zoom + offset.y,
});

export const canvasToScreen = (
  canvasX: number,
  canvasY: number,
  width: number,
  height: number,
  zoom: number,
  offset: CanvasOffset
) => ({
  x: width / 2 + (canvasX - offset.x) * zoom,
  y: height / 2 + (canvasY - offset.y) * zoom,
});
