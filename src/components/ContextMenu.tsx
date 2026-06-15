import { useEffect, useRef } from 'react';

export interface ContextMenuState {
  x: number;
  y: number;
  items: { label: string; shortcut?: string; action: () => void; danger?: boolean }[];
}

export default function ContextMenu({ menu, onClose }: { menu: ContextMenuState; onClose: () => void }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    };
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    // Delay to avoid the right-click that opened it from closing it
    setTimeout(() => {
      document.addEventListener('mousedown', handleClick);
      document.addEventListener('keydown', handleKey);
    }, 0);
    return () => {
      document.removeEventListener('mousedown', handleClick);
      document.removeEventListener('keydown', handleKey);
    };
  }, [onClose]);

  // Constrain to viewport
  const adjustedX = Math.min(menu.x, window.innerWidth - 180);
  const adjustedY = Math.min(menu.y, window.innerHeight - menu.items.length * 36 - 16);

  return (
    <div
      ref={ref}
      className="fixed z-50 min-w-[140px] rounded-md border border-default bg-surface py-1 shadow-lg backdrop-blur-lg"
      style={{ left: adjustedX, top: adjustedY }}
    >
      {menu.items.map((item, i) => (
        <button
          key={i}
          onClick={() => { item.action(); onClose(); }}
          className={`flex w-full items-center justify-between px-3 py-1.5 text-left text-xs transition ${
            item.danger
              ? 'text-red hover:bg-red/10'
              : 'text-text-primary hover:bg-accent/10'
          }`}
        >
          <span>{item.label}</span>
          {item.shortcut && <span className="ml-4 text-[10px] text-text-secondary/40">{item.shortcut}</span>}
        </button>
      ))}
    </div>
  );
}
