import { useEffect, useState } from 'react';
import type { SymbolEntry } from '../../scripts/types';

interface KicadSymbolProps {
  symbolId: string;
  width?: number;
  height?: number;
  className?: string;
}

export default function KicadSymbol({ symbolId, width = 100, height = 100, className }: KicadSymbolProps) {
  const [symbol, setSymbol] = useState<SymbolEntry | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        const mod: any = await import('@/assets/symbols/catalog.json');
        const catalog = mod.default || mod;
        const found = catalog.symbols?.find(
          (s: SymbolEntry) =>
            s.id === symbolId ||
            s.id === symbolId.toLowerCase() ||
            s.name === symbolId
        );
        if (!cancelled) setSymbol(found ?? null);
      } catch {
        if (!cancelled) setSymbol(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }
    load();
    return () => { cancelled = true; };
  }, [symbolId]);

  if (loading) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} style={{ background: 'transparent' }} />
    );
  }

  const name = symbol?.name ?? symbolId;

  if (symbol) {
    return (
      <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} style={{ background: 'transparent' }}>
        <image
          href={`/assets/symbols/previews/${symbol.id}.svg`}
          x="0" y="0"
          width={width} height={height}
          preserveAspectRatio="xMidYMid meet"
        />
      </svg>
    );
  }

  return (
    <svg width={width} height={height} viewBox={`0 0 ${width} ${height}`} className={className} style={{ background: 'transparent' }}>
      <text x="50%" y="50%" textAnchor="middle" dominantBaseline="central" fill="#666" fontSize="10" fontFamily="monospace">
        {name}
      </text>
    </svg>
  );
}
