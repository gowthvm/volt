import { useMemo } from 'react';
import { useSchematicStore } from '@/store/schematicStore';
import { useCircuitStore } from '@/store/circuitStore';
import { runDRC, type DRCItem } from '@/circuit/drc';

export default function DRCPanel() {
  const components = useSchematicStore((s) => s.components);
  const graph = useCircuitStore((s) => s.graph);

  const report = useMemo(() => runDRC(components, graph), [components, graph]);
  const items = [...report.errors, ...report.warnings];
  if (items.length === 0) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 48, left: '50%', transform: 'translateX(-50%)',
      zIndex: 100, maxWidth: 560, width: '100%', padding: '0 12px',
    }}>
      <div style={{
        background: 'var(--bg-elevated)', border: '1px solid var(--border-default)',
        borderRadius: 'var(--radius-lg)', padding: '10px 14px', fontSize: 12, fontFamily: 'monospace',
        boxShadow: 'var(--shadow-md)',
      }}>
        {report.errors.length > 0 && (
          <>
            <div style={{ color: 'var(--red)', fontWeight: 600, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {report.errors.length} error{report.errors.length > 1 ? 's' : ''}
            </div>
            {report.errors.map((e, i) => (
              <div key={`err-${i}`} style={{ color: 'var(--text-secondary)', padding: '2px 0', display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--red)', flexShrink: 0 }}>✕</span>
                <span>{e.message}</span>
              </div>
            ))}
          </>
        )}
        {report.warnings.length > 0 && (
          <>
            <div style={{ color: 'var(--accent)', fontWeight: 600, marginTop: report.errors.length > 0 ? 6 : 0, marginBottom: 4, fontSize: 11, textTransform: 'uppercase', letterSpacing: '0.5px' }}>
              {report.warnings.length} warning{report.warnings.length > 1 ? 's' : ''}
            </div>
            {report.warnings.map((w, i) => (
              <div key={`warn-${i}`} style={{ color: 'var(--text-secondary)', padding: '2px 0', display: 'flex', gap: 6 }}>
                <span style={{ color: 'var(--accent)', flexShrink: 0 }}>▲</span>
                <span>{w.message}</span>
              </div>
            ))}
          </>
        )}
      </div>
    </div>
  );
}
