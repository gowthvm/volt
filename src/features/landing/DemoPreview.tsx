import { useEffect, useRef, useState } from 'react';
import GradualBlur from '@/components/ui/GradualBlur';

const MOCK_COMPONENTS = [
  { name: 'Resistor', ref: 'R1', symbol: 'R' },
  { name: 'Capacitor', ref: 'C1', symbol: 'C' },
  { name: 'Inductor', ref: 'L1', symbol: 'L' },
  { name: 'LED', ref: 'LED1', symbol: 'D' },
  { name: 'Battery', ref: 'BT1', symbol: 'B' },
  { name: 'Ground', ref: 'GND', symbol: 'G' },
  { name: 'NPN', ref: 'Q1', symbol: 'Q' },
  { name: 'Switch', ref: 'SW1', symbol: 'S' },
];

export default function DemoPreview() {
  const sectionRef = useRef<HTMLElement>(null);
  const [entered, setEntered] = useState(false);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setEntered(true); observer.disconnect(); } },
      { threshold: 0.3 }
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="relative -mt-16 pb-16">
      <div className="mx-auto max-w-6xl px-5">
        <div className="relative overflow-hidden rounded-lg border border-default bg-surface shadow-lg">
          <div className="flex h-[28px] items-center gap-1.5 border-b border-subtle px-4">
            <span className="h-2 w-2 rounded-full bg-red-500/60" />
            <span className="h-2 w-2 rounded-full bg-accent" />
            <span className="h-2 w-2 rounded-full bg-green-500/60" />
            <span className="ml-3 font-mono text-[10px] text-text-tertiary">volt.app — /editor</span>
          </div>
          <div className="aspect-[16/9] bg-surface p-3">
            <div className="flex h-full gap-3">
              {/* Left panel — component list mockup with bottom blur fade */}
              <div className="relative flex w-[140px] flex-col rounded-xl border border-subtle bg-black/40">
                <div className="flex-shrink-0 border-b border-subtle px-3 py-2">
                  <span className="text-[9px] font-medium uppercase tracking-[0.15em] text-text-tertiary">Components</span>
                </div>
                <div className="flex-1 overflow-y-auto px-2 py-2 space-y-1">
                  {MOCK_COMPONENTS.map((c, i) => (
                    <div
                      key={c.ref}
                      className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 transition hover:bg-white/5"
                      style={{
                        opacity: entered ? 1 : 0,
                        transform: entered ? 'translateY(0)' : 'translateY(8px)',
                        transition: `opacity 0.5s ease-out ${0.4 + i * 0.06}s, transform 0.5s ease-out ${0.4 + i * 0.06}s`,
                      }}
                    >
                      <div className="flex h-6 w-6 items-center justify-center rounded border border-default bg-hover text-[9px] font-mono text-text-secondary">
                        {c.symbol}
                      </div>
                      <div className="min-w-0 flex-1">
                        <div className="truncate text-[10px] font-medium text-text-primary">{c.name}</div>
                        <div className="text-[8px] text-text-tertiary">{c.ref}</div>
                      </div>
                    </div>
                  ))}
                </div>
                <GradualBlur position="bottom" height="3rem" strength={1.5} divCount={5} curve="bezier" opacity={1} zIndex={10} />
              </div>
              {/* Main canvas area — animated circuit */}
              <div className="relative flex-1 rounded-xl border border-subtle bg-black/60 p-4">
                <svg viewBox="0 0 400 250" className="h-full w-full opacity-80">
                  {/* Wires — draw in sequence using stroke-dasharray */}
                  <g>
                    <line x1="40" y1="125" x2="120" y2="125" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="80" strokeDashoffset={entered ? 0 : 80}
                      style={{ transition: 'stroke-dashoffset 0.6s ease-out 0.1s' }} />
                    <line x1="120" y1="125" x2="120" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="75" strokeDashoffset={entered ? 0 : 75}
                      style={{ transition: 'stroke-dashoffset 0.5s ease-out 0.25s' }} />
                    <line x1="120" y1="50" x2="200" y2="50" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="80" strokeDashoffset={entered ? 0 : 80}
                      style={{ transition: 'stroke-dashoffset 0.6s ease-out 0.35s' }} />
                    <line x1="200" y1="50" x2="200" y2="200" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="150" strokeDashoffset={entered ? 0 : 150}
                      style={{ transition: 'stroke-dashoffset 0.6s ease-out 0.5s' }} />
                    <line x1="200" y1="200" x2="280" y2="200" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="80" strokeDashoffset={entered ? 0 : 80}
                      style={{ transition: 'stroke-dashoffset 0.5s ease-out 0.65s' }} />
                    <line x1="280" y1="200" x2="280" y2="125" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="75" strokeDashoffset={entered ? 0 : 75}
                      style={{ transition: 'stroke-dashoffset 0.5s ease-out 0.8s' }} />
                    <line x1="280" y1="125" x2="360" y2="125" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5"
                      strokeDasharray="80" strokeDashoffset={entered ? 0 : 80}
                      style={{ transition: 'stroke-dashoffset 0.5s ease-out 0.9s' }} />
                  </g>

                  {/* Battery symbol */}
                  <g style={{
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 0.5s ease-out 0.3s',
                  }}>
                    <line x1="40" y1="125" x2="30" y2="125" stroke="rgba(255,255,255,0.15)" strokeWidth="1.5" />
                    <line x1="30" y1="118" x2="30" y2="132" stroke="#ffd60a" strokeWidth="1.5" strokeLinecap="round" />
                    <line x1="24" y1="120" x2="24" y2="130" stroke="#ffd60a" strokeWidth="3" strokeLinecap="round" />
                    <line x1="22" y1="124" x2="22" y2="126" stroke="rgba(255,255,255,0.15)" strokeWidth="1" />
                  </g>

                  {/* Resistor R1 zigzag */}
                  <g style={{
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 0.4s ease-out 0.5s',
                  }}>
                    <path d="M 120 125 L 126 125 L 132 113 L 138 125 L 144 113 L 150 125 L 156 113 L 162 125 L 168 113 L 174 125 L 180 113 L 186 125 L 192 113 L 194 125 L 200 125" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
                  </g>

                  {/* Resistor R2 zigzag */}
                  <g style={{
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 0.4s ease-out 0.7s',
                  }}>
                    <path d="M 200 200 L 206 200 L 212 188 L 218 200 L 224 188 L 230 200 L 236 188 L 242 200 L 248 188 L 254 200 L 260 188 L 266 200 L 272 188 L 274 200 L 280 200" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.5" strokeLinejoin="round" />
                  </g>

                  {/* Labels */}
                  <g style={{
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 0.5s ease-out 0.9s',
                  }}>
                    <text x="160" y="106" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">R1</text>
                    <text x="160" y="116" textAnchor="middle" fill="var(--accent)" fontSize="7" fontFamily="monospace">1kΩ</text>
                    <text x="240" y="218" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="8" fontFamily="monospace">R2</text>
                    <text x="240" y="228" textAnchor="middle" fill="var(--accent)" fontSize="7" fontFamily="monospace">2kΩ</text>
                  </g>

                  {/* Net labels + ground */}
                  <g style={{
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 0.4s ease-out 1.1s',
                  }}>
                    <text x="200" y="40" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="6" fontFamily="monospace">NET_1</text>
                    <text x="280" y="92" textAnchor="middle" fill="rgba(255,255,255,0.25)" fontSize="7" fontFamily="monospace">OUT</text>
                    <path d="M 360 125 L 356 131 M 360 125 L 360 131 M 360 125 L 364 131" stroke="rgba(255,255,255,0.2)" strokeWidth="1" strokeLinecap="round" />
                    <text x="160" y="236" textAnchor="middle" fill="rgba(255,255,255,0.15)" fontSize="6" fontFamily="monospace">Voltage Divider</text>
                  </g>

                  {/* Junction dots */}
                  <g style={{
                    opacity: entered ? 1 : 0,
                    transition: 'opacity 0.3s ease-out 1.2s',
                  }}>
                    <circle cx="120" cy="125" r="2.5" fill="var(--accent)" />
                    <circle cx="120" cy="50" r="2.5" fill="var(--accent)" />
                    <circle cx="200" cy="50" r="2.5" fill="var(--accent)" />
                    <circle cx="280" cy="200" r="2.5" fill="var(--accent)" />
                    <circle cx="360" cy="125" r="2.5" fill="var(--accent)" />
                  </g>

                  {/* Animated current flow — starts after everything draws */}
                  {entered && (
                    <g>
                      {/* Loop: Battery(+) → R1 → R2 → GND */}
                      <circle r="2.5" fill="var(--accent)" opacity={0.7}>
                        <animateMotion dur="4s" repeatCount="indefinite" begin="1.5s"
                          path="M30,125 L120,125 L120,50 L200,50 L200,200 L280,200 L280,125 L360,125" />
                      </circle>
                      <circle r="1.5" fill="var(--accent)" opacity={0.4}>
                        <animateMotion dur="4s" repeatCount="indefinite" begin="2.5s"
                          path="M30,125 L120,125 L120,50 L200,50 L200,200 L280,200 L280,125 L360,125" />
                      </circle>
                    </g>
                  )}

                  {/* Animated voltage reading — fades in last */}
                  {entered && (
                    <g style={{
                      opacity: 0,
                      animation: 'fade-in 0.5s ease-out 2s forwards',
                    }}>
                      <text x="160" y="145" textAnchor="middle" fill="var(--accent)" fontSize="7" fontFamily="monospace" opacity={0.6}>
                        V<animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" />=6.0V
                      </text>
                      <text x="240" y="145" textAnchor="middle" fill="var(--accent)" fontSize="7" fontFamily="monospace" opacity={0.6}>
                        I<animate attributeName="opacity" values="0.6;1;0.6" dur="2s" repeatCount="indefinite" begin="0.3s" />=3mA
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
