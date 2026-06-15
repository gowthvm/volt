import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { deserializeState } from '@/lib/serialize';
import type { SchematicComponent } from '@/store/schematicStore';
import type { Stroke } from '@/store/drawingStore';
import { componentTerminalDefinitions, transformPoint } from '@/circuit/graph';

interface SharedData {
  name: string;
  strokes: Stroke[];
  components: SchematicComponent[];
}

export default function SharedProjectViewer() {
  const { token } = useParams<{ token: string }>();
  const [data, setData] = useState<SharedData | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    (async () => {
      setLoading(true);
      const { data: project, error: err } = await supabase
        .from('projects')
        .select('name, schematic_json')
        .eq('share_token', token)
        .single();

      if (err || !project) {
        setError(err?.message ?? 'Project not found');
        setLoading(false);
        return;
      }

      const raw = typeof project.schematic_json === 'string'
        ? project.schematic_json
        : JSON.stringify(project.schematic_json);

      const state = deserializeState(raw);
      if (!state) {
        setError('Failed to parse circuit data');
        setLoading(false);
        return;
      }

      setData({
        name: project.name,
        strokes: state.strokes,
        components: state.components,
      });
      setLoading(false);
    })();
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-base">
        <p className="text-sm text-text-secondary">Loading shared circuit…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-base">
        <p className="text-sm text-red-400">{error}</p>
        <Link to="/" className="rounded-lg border border-subtle bg-surface px-4 py-2 text-sm text-text-primary transition hover:border-accent hover:text-accent">
          Back to Volt
        </Link>
      </div>
    );
  }

  if (!data) return null;

  const { name, components } = data;
  const padding = 60;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const comp of components) {
    const s = 60;
    minX = Math.min(minX, comp.position.x - s);
    minY = Math.min(minY, comp.position.y - s);
    maxX = Math.max(maxX, comp.position.x + s);
    maxY = Math.max(maxY, comp.position.y + s);
  }
  if (!isFinite(minX)) { minX = -200; minY = -200; maxX = 200; maxY = 200; }
  const vbW = maxX - minX + padding * 2;
  const vbH = maxY - minY + padding * 2;

  return (
    <div className="flex min-h-screen flex-col bg-base text-text-primary">
      <header className="flex items-center justify-between border-b border-subtle bg-surface px-6 py-4">
        <div className="flex items-center gap-4">
          <Link
            to="/"
            className="rounded-lg border border-subtle bg-base px-3 py-2 text-sm text-text-secondary transition hover:border-accent hover:text-accent"
          >
            Volt
          </Link>
          <span className="text-sm font-medium text-text-primary">{name}</span>
        </div>
        <p className="text-xs text-text-secondary/60">Shared circuit — read-only</p>
      </header>
      <main className="flex flex-1 items-center justify-center p-8">
        <div className="max-h-full max-w-full overflow-auto rounded-xl border border-subtle bg-surface p-4">
          <svg
            viewBox={`${minX - padding} ${minY - padding} ${vbW} ${vbH}`}
            className="h-auto w-full"
            style={{ maxHeight: '70vh', maxWidth: '90vw' }}
          >
            <rect x={minX - padding} y={minY - padding} width={vbW} height={vbH} fill="var(--bg-surface)" />
            {components.map((comp) => {
              if (comp.type === 'wire') {
                const defs = componentTerminalDefinitions(comp);
                const getWorld = (name: string) => {
                  const d = defs.find((x) => x.name === name);
                  return d ? transformPoint(d.point, comp) : null;
                };
                const a = getWorld('A');
                const b = getWorld('B');
                if (a && b) {
                  return (
                    <line
                      key={comp.id}
                      x1={a.x} y1={a.y}
                      x2={b.x} y2={b.y}
                      stroke="var(--text-primary)" strokeWidth={2} strokeLinecap="round"
                    />
                  );
                }
                return null;
              }
              const deg = (comp.rotation * 180) / Math.PI;
              return (
                <g
                  key={comp.id}
                  transform={`translate(${comp.position.x} ${comp.position.y}) rotate(${deg}) scale(${comp.scale.x} ${comp.scale.y}) translate(-50 -50)`}
                  color="var(--text-primary)"
                >
                  {comp.kicadSymbolId ? (
                    <image
                      href={`/assets/symbols/previews/${comp.kicadSymbolId}.svg`}
                      x="-20" y="-20"
                      width="140" height="140"
                      preserveAspectRatio="xMidYMid meet"
                    />
                  ) : (
                    <circle cx="50" cy="50" r="45" fill="none" stroke="currentColor" strokeWidth="2" />
                  )}
                </g>
              );
            })}
          </svg>
        </div>
      </main>
    </div>
  );
}
