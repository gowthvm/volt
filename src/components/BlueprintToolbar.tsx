import { useRef } from 'react';
import useBlueprintStore, { type BlueprintTool, STROKE_COLORS, STROKE_WIDTHS } from '@/store/blueprintStore';

const DRAW_TOOLS: { id: BlueprintTool; label: string }[] = [
  { id: 'pen', label: 'Pen' },
  { id: 'line', label: 'Line' },
];

const SHAPE_TOOLS: { id: BlueprintTool; label: string }[] = [
  { id: 'rect', label: 'Rectangle' },
  { id: 'circle', label: 'Circle' },
];

const UTILITY_TOOLS: { id: BlueprintTool; label: string }[] = [
  { id: 'eraser', label: 'Eraser' },
  { id: 'text', label: 'Text' },
  { id: 'pan', label: 'Pan' },
];

const WIDTH_LABELS: Record<number, string> = { 2: 'Thin', 4: 'Medium', 8: 'Thick' };
const COLOR_NAMES: Record<string, string> = { '#ffffff': 'White', '#ffd60a': 'Yellow', '#ef4444': 'Red', '#22c55e': 'Green', '#3b82f6': 'Blue', '#6b7280': 'Gray' };

export default function BlueprintToolbar() {
  const tool = useBlueprintStore((s) => s.tool);
  const color = useBlueprintStore((s) => s.color);
  const width = useBlueprintStore((s) => s.width);
  const setTool = useBlueprintStore((s) => s.setTool);
  const setColor = useBlueprintStore((s) => s.setColor);
  const setWidth = useBlueprintStore((s) => s.setWidth);
  const setReferenceImage = useBlueprintStore((s) => s.setReferenceImage);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleUpload = () => fileInputRef.current?.click();
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => setReferenceImage(reader.result as string);
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const renderBtn = (t: { id: BlueprintTool; label: string }) => (
    <button
      key={t.id}
      title={t.label}
      onClick={() => setTool(t.id)}
      className={`flex h-11 w-11 items-center justify-center rounded-lg transition duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${
        tool === t.id ? 'bg-accent text-black' : 'text-text-tertiary hover:text-text-primary'
      }`}
    >
      {t.id === 'pen' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <path d="M12 1.5l2.5 2.5L5 13.5 1 15l1.5-4L12 1.5z" />
        </svg>
      ) : t.id === 'line' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
          <line x1="2" y1="14" x2="14" y2="2" />
        </svg>
      ) : t.id === 'rect' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <rect x="2" y="3" width="12" height="10" rx="1" />
        </svg>
      ) : t.id === 'circle' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="8" cy="8" r="6" />
        </svg>
      ) : t.id === 'eraser' ? (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 14l8-8M5 14l8-8M5 14H1v-4l4 4z" />
          <path d="M9 6l3.5-3.5a1 1 0 011.4 0l1.1 1.1a1 1 0 010 1.4L12 8.5" />
        </svg>
      ) : t.id === 'text' ? (
        <span className="text-sm font-bold">T</span>
      ) : (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5">
          <path d="M5 14l4-4 4 4M5 2l4 4 4-4" />
        </svg>
      )}
    </button>
  );

  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-default bg-surface/90 px-3 py-3 shadow-md backdrop-blur-lg">
      {/* Drawing tools */}
      <div className="flex flex-col items-center gap-1">{DRAW_TOOLS.map(renderBtn)}</div>
      <div className="h-px w-5 bg-border-subtle" />

      {/* Shape tools */}
      <div className="flex flex-col items-center gap-1">{SHAPE_TOOLS.map(renderBtn)}</div>
      <div className="h-px w-5 bg-border-subtle" />

      {/* Utility tools */}
      <div className="flex flex-col items-center gap-1">{UTILITY_TOOLS.map(renderBtn)}</div>
      <div className="h-px w-5 bg-border-subtle" />

      {/* Width */}
      <div className="flex flex-col items-center gap-1">
        {STROKE_WIDTHS.map((w) => (
          <button
            key={w}
            title={WIDTH_LABELS[w]}
            onClick={() => setWidth(w)}
             className={`flex h-8 w-8 items-center justify-center rounded-md transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${width === w ? 'text-accent' : 'text-text-tertiary hover:text-text-primary'}`}
          >
            <div className="rounded-full bg-current" style={{ width: Math.max(3, w), height: Math.max(3, w) }} />
          </button>
        ))}
      </div>
      <div className="h-px w-5 bg-border-subtle" />

      {/* Color */}
      <div className="flex flex-col items-center gap-1">
        {STROKE_COLORS.map((c) => (
          <button
            key={c}
            title={COLOR_NAMES[c]}
            onClick={() => setColor(c)}
             className={`flex h-6 w-6 items-center justify-center rounded-full transition focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${color === c ? 'ring-2 ring-accent ring-offset-1 ring-offset-black' : ''}`}
          >
            <div className="h-4 w-4 rounded-full border border-default" style={{ backgroundColor: c }} />
          </button>
        ))}
      </div>
      <div className="h-px w-5 bg-border-subtle" />

      {/* Upload */}
      <button
        title="Upload image"
        onClick={handleUpload}
        className="flex h-10 w-10 items-center justify-center rounded-lg text-text-tertiary hover:text-text-primary transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
      >
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
          <rect x="2" y="2" width="12" height="12" rx="2" />
          <circle cx="6" cy="5.5" r="1.5" fill="currentColor" stroke="none" />
          <path d="M2 11l3-3 2 2 2-2 3 3" />
        </svg>
      </button>
      <input ref={fileInputRef} type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} />
    </div>
  );
}
