import { clamp } from '@/lib/canvas';

export const getGridStyle = (zoom: number) => {
  const lineAlpha = clamp((zoom - 0.4) / 2, 0.08, 0.2);
  const dotAlpha = clamp((zoom - 0.15) / 1.2, 0.08, 0.22);
  return {
    lineColor: `rgba(255,255,255,${lineAlpha})`,
    dotColor: `rgba(255,255,255,${dotAlpha})`,
  };
};
