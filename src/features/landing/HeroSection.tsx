import { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

function DotGrid() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const mouseRef = useRef({ x: -9999, y: -9999 });

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    const handleMouse = (e: MouseEvent) => {
      mouseRef.current = { x: e.clientX, y: e.clientY };
    };
    window.addEventListener('mousemove', handleMouse, { passive: true });

    let t = 0;
    let id: number;

    const draw = () => {
      t += 0.002;
      ctx.clearRect(0, 0, canvas.width, canvas.height);

      const spacing = 40;
      const cols = Math.ceil(canvas.width / spacing) + 1;
      const rows = Math.ceil(canvas.height / spacing) + 1;

      const points: { x: number; y: number; a: number }[] = [];

      for (let r = 0; r < rows; r++) {
        for (let c = 0; c < cols; c++) {
          const baseX = c * spacing + ((r % 2) * spacing) / 2;
          const baseY = r * spacing;
          const drift = Math.sin(t + c * 0.7 + r * 0.5) * 1.5;
          const x = baseX + drift;
          const y = baseY + Math.cos(t * 0.8 + c * 0.3 + r * 0.9) * 1.2;

          const cx = canvas.width / 2;
          const cy = canvas.height / 2;
          const dist = Math.hypot(x - cx, y - cy);
          const maxDist = Math.hypot(canvas.width, canvas.height) / 2;
          const alpha = Math.max(0, 0.35 * (1 - dist / maxDist));

          points.push({ x, y, a: alpha });

          ctx.beginPath();
          ctx.arc(x, y, 1, 0, Math.PI * 2);
          ctx.fillStyle = `rgba(255,255,255,${alpha})`;
          ctx.fill();
        }
      }

      // Connection lines near cursor
      const mx = mouseRef.current.x;
      const my = mouseRef.current.y;
      const connectRadius = 100;
      for (let i = 0; i < points.length; i++) {
        const p = points[i];
        const d = Math.hypot(p.x - mx, p.y - my);
        if (d < connectRadius && p.a > 0.05) {
          const lineAlpha = (1 - d / connectRadius) * 0.15;
          ctx.beginPath();
          ctx.moveTo(p.x, p.y);
          // connect to nearest neighbors
          for (let j = i + 1; j < points.length; j++) {
            const q = points[j];
            const d2 = Math.hypot(q.x - mx, q.y - my);
            if (d2 < connectRadius && q.a > 0.05) {
              const betweenDist = Math.hypot(p.x - q.x, p.y - q.y);
              if (betweenDist < spacing * 1.5) {
                const avgAlpha = lineAlpha * (1 - betweenDist / (spacing * 1.5));
                ctx.beginPath();
                ctx.moveTo(p.x, p.y);
                ctx.lineTo(q.x, q.y);
                ctx.strokeStyle = `rgba(255,214,10,${avgAlpha})`;
                ctx.lineWidth = 0.5;
                ctx.stroke();
              }
            }
          }
        }
      }

      id = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(id);
      window.removeEventListener('resize', resize);
      window.removeEventListener('mousemove', handleMouse);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 pointer-events-none" />;
}

export default function HeroSection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const headlineRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => {
    const el = headlineRef.current;
    if (!el) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.querySelectorAll('.headline-word').forEach((word, i) => {
            (word as HTMLElement).style.animationDelay = `${i * 150}ms`;
          });
          observer.disconnect();
        }
      },
      { threshold: 0.3 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section className="relative flex min-h-screen items-center justify-center overflow-hidden bg-base px-5 pt-14">
      <DotGrid />
      <div className="pointer-events-none absolute top-1/3 left-1/2 h-[500px] w-[900px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-accent/[0.04] blur-[150px] animate-pulse-glow" />

      {/* Floating circuit path decorations */}
      <svg
        className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.04]"
        viewBox="0 0 1440 900"
        preserveAspectRatio="none"
      >
        <path
          d="M 0 200 L 200 200 L 200 100 L 400 100 L 400 300 L 600 300 L 600 150 L 800 150"
          stroke="rgba(255,255,255,0.5)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-pulse-glow"
          style={{ animationDuration: '6s' }}
        />
        <path
          d="M 1440 600 L 1200 600 L 1200 700 L 1000 700 L 1000 500 L 800 500"
          stroke="rgba(255,255,255,0.3)"
          strokeWidth="1"
          fill="none"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="animate-pulse-glow"
          style={{ animationDuration: '8s', animationDelay: '2s' }}
        />
        <circle cx="200" cy="100" r="2" fill="rgba(255,214,10,0.4)" />
        <circle cx="400" cy="300" r="2" fill="rgba(255,214,10,0.4)" />
        <circle cx="600" cy="150" r="2" fill="rgba(255,214,10,0.4)" />
      </svg>

      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <div className="mb-6 inline-flex animate-fade-in items-center gap-2 rounded-full border border-default bg-surface px-4 py-1.5 text-[12px] font-medium text-text-tertiary" style={{ animationDelay: '200ms', opacity: 0 }}>
          <span className="h-1.5 w-1.5 rounded-full bg-accent" />
          Circuit design at the speed of sketching
        </div>

        <h1
          ref={headlineRef}
          className="mb-6 font-display text-[clamp(2.5rem,8vw,6rem)] font-bold leading-[0.95] tracking-tighter"
        >
          <span className="headline-word block animate-fade-slide-up text-text-primary" style={{ opacity: 0 }}>
            Draw.
          </span>
          <span className="headline-word block animate-fade-slide-up text-text-primary" style={{ opacity: 0 }}>
            Detect.
          </span>
          <span className="headline-word block animate-fade-slide-up" style={{ opacity: 0 }}>
            <span
              className="bg-gradient-to-r from-white via-accent to-accent bg-clip-text text-transparent"
              style={{
                backgroundSize: '200% 100%',
                animation: 'gradient-shift 4s ease-in-out infinite',
              }}
            >
              Simulate.
            </span>
          </span>
        </h1>

        <p
          className="mx-auto mb-10 max-w-xl animate-fade-in text-[clamp(0.95rem,2vw,1.15rem)] leading-relaxed text-text-secondary"
          style={{ animationDelay: '500ms', opacity: 0 }}
        >
          The fastest way to design circuits. Sketch components, connect wires, simulate instantly.
        </p>

        <div
          className="flex animate-fade-in flex-wrap justify-center gap-4"
          style={{ animationDelay: '700ms', opacity: 0 }}
        >
          <Link
            to={isAuthenticated ? '/editor' : '/signup'}
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md bg-accent px-7 py-3 text-[14px] font-semibold text-black transition hover:brightness-110 active:scale-[0.97] hover:shadow-[0_0_24px_rgba(255,214,10,0.25)]"
          >
            Start designing
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14M12 5l7 7-7 7" />
            </svg>
          </Link>
          <a
            href="#how-it-works"
            className="pointer-events-auto inline-flex items-center gap-2 rounded-md border border-default bg-surface px-7 py-3 text-[14px] font-medium text-text-secondary transition hover:bg-hover hover:text-text-primary active:scale-[0.97]"
          >
            See how it works
          </a>
        </div>

        <div className="mt-16 flex justify-center">
          <svg width="320" height="40" viewBox="0 0 320 40" fill="none" className="opacity-40">
            <path
              d="M10 20 L70 20 L70 10 L130 10 L130 30 L190 30 L190 10 L250 10 L250 20 L310 20"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
            <circle
              r="3"
              fill="#ffd60a"
              className="animate-pulse-glow"
              style={{
                offsetPath: "path('M10 20 L70 20 L70 10 L130 10 L130 30 L190 30 L190 10 L250 10 L250 20 L310 20')",
                offsetDistance: '0%',
                animation: 'dot-travel 4s ease-in-out infinite',
              }}
            />
          </svg>
        </div>
      </div>

      <div className="absolute bottom-12 left-1/2 flex -translate-x-1/2 flex-col items-center gap-2 text-white/20">
        <div className="flex flex-col items-center gap-1">
          <span className="font-mono text-[9px] uppercase tracking-[0.2em] text-white/15">Scroll</span>
          <div className="relative h-10 w-px overflow-hidden">
            <div className="absolute top-0 h-full w-full bg-gradient-to-b from-white/20 to-transparent animate-scroll-indicator" />
          </div>
        </div>
      </div>
    </section>
  );
}