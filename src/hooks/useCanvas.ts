import { useCallback } from 'react';
import { useCanvasStore } from '@/store/canvasStore';
import { canvasToScreen, screenToCanvas } from '@/lib/canvas';

export function useCanvas() {
  const offset = useCanvasStore((state) => state.offset);
  const zoom = useCanvasStore((state) => state.zoom);
  const setOffset = useCanvasStore((state) => state.setOffset);
  const setZoom = useCanvasStore((state) => state.setZoom);
  const setCamera = useCanvasStore((state) => state.setCamera);

  const screenToCanvasPoint = useCallback(
    (screenX: number, screenY: number, width: number, height: number) =>
      screenToCanvas(screenX, screenY, width, height, zoom, offset),
    [offset, zoom]
  );

  const canvasToScreenPoint = useCallback(
    (canvasX: number, canvasY: number, width: number, height: number) =>
      canvasToScreen(canvasX, canvasY, width, height, zoom, offset),
    [offset, zoom]
  );

  return {
    offset,
    zoom,
    minZoom: useCanvasStore((state) => state.minZoom),
    maxZoom: useCanvasStore((state) => state.maxZoom),
    setOffset,
    setZoom,
    setCamera,
    screenToCanvasPoint,
    canvasToScreenPoint,
  };
}
