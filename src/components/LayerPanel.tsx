import { useLayerStore } from '@/store/layerStore';

export default function LayerPanel() {
  const layers = useLayerStore((s) => s.layers);
  const activeLayerId = useLayerStore((s) => s.activeLayerId);
  const setActiveLayer = useLayerStore((s) => s.setActiveLayer);
  const toggleVisibility = useLayerStore((s) => s.toggleVisibility);
  const toggleLocked = useLayerStore((s) => s.toggleLocked);

  return (
    <div style={{
      position: 'absolute',
      right: 12,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      gap: 4,
      zIndex: 30,
    }}>
      {layers.map((layer) => (
        <div
          key={layer.id}
          onClick={() => setActiveLayer(layer.id)}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 6,
            padding: '6px 10px',
            borderRadius: 6,
            cursor: 'pointer',
            background: layer.id === activeLayerId ? 'var(--accent-muted)' : 'color-mix(in srgb, var(--text-primary) 4%, transparent)',
            border: layer.id === activeLayerId ? '1px solid color-mix(in srgb, var(--accent) 30%, transparent)' : '1px solid var(--border-subtle)',
            transition: 'background 120ms ease, border 120ms ease',
          }}
        >
          <button
            onClick={(e) => { e.stopPropagation(); toggleVisibility(layer.id); }}
            style={{
              width: 14, height: 14, borderRadius: 3, border: '1px solid var(--border-strong)',
              background: layer.visible ? layer.color : 'transparent',
              cursor: 'pointer', padding: 0, flexShrink: 0, opacity: layer.visible ? 1 : 0.3,
            }}
            title={layer.visible ? 'Hide layer' : 'Show layer'}
          />
          <button
            onClick={(e) => { e.stopPropagation(); toggleLocked(layer.id); }}
            style={{
              background: 'none', border: 'none', cursor: 'pointer', padding: 0,
              color: layer.locked ? 'var(--text-tertiary)' : 'var(--text-secondary)',
              fontSize: 10, fontFamily: 'monospace', lineHeight: 1,
            }}
            title={layer.locked ? 'Unlock layer' : 'Lock layer'}
          >
            {layer.locked ? '🔒' : '🔓'}
          </button>
          <span style={{
            fontSize: 10, fontFamily: 'monospace', color: 'var(--text-secondary)',
            whiteSpace: 'nowrap',
          }}>
            {layer.name}
          </span>
        </div>
      ))}
    </div>
  );
}
