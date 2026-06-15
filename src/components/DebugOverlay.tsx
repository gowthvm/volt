import React, { useEffect, useState } from 'react';

export default function DebugOverlay() {
  const [info, setInfo] = useState<any>(null);

  useEffect(() => {
    let mounted = true;
    const tick = () => {
      const canvas = document.querySelector('canvas');
      const svg = document.querySelector('svg');
      const wrapper = canvas?.parentElement as HTMLElement | null;
      const body = document.body;
      const compute = () => {
        if (!canvas) return { canvas: null };
        const rect = canvas.getBoundingClientRect();
        const w = wrapper?.clientWidth ?? null;
        const h = wrapper?.clientHeight ?? null;
        return {
          dpr: window.devicePixelRatio,
          canvas: { clientW: canvas.clientWidth, clientH: canvas.clientHeight, widthProp: (canvas as any).width, rect: { w: rect.width, h: rect.height } },
          wrapper: { clientW: w, clientH: h, className: wrapper?.className },
          body: { clientW: body.clientWidth, clientH: body.clientHeight, scrollH: body.scrollHeight },
          svgExists: !!svg,
        };
      };
      if (mounted) setInfo(compute());
    };

    const id = window.setInterval(tick, 500);
    tick();
    return () => {
      mounted = false;
      window.clearInterval(id);
    };
  }, []);

  if (!info) return null;

  return (
    <div className="fixed right-3 bottom-3 z-[99999] bg-base/60 text-text-primary p-2.5 rounded-md text-xs">
      <div className="mb-1.5">DPR: {info.dpr}</div>
      <div>Canvas: {info.canvas ? `${info.canvas.clientW}x${info.canvas.clientH} (px buffer ${info.canvas.widthProp})` : 'no canvas'}</div>
      <div>Wrapper: {info.wrapper.clientW}x{info.wrapper.clientH}</div>
      <div>Body: {info.body.clientW}x{info.body.clientH} (scrollH {info.body.scrollH})</div>
      <div>SVG: {info.svgExists ? 'yes' : 'no'}</div>
    </div>
  );
}
