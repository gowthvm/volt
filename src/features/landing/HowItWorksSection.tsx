import { useEffect, useRef } from 'react';

const STEPS = [
  {
    num: '01',
    title: 'Place',
    desc: 'Drag components from the panel onto the infinite canvas',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="18" height="18" rx="3" />
        <path d="M12 3v18M3 12h18" />
        <circle cx="12" cy="12" r="2" />
      </svg>
    ),
  },
  {
    num: '02',
    title: 'Connect',
    desc: 'Draw orthogonal wires between terminals with precision snap',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 12h6l2-4 4 8 2-4h2" />
        <circle cx="4" cy="12" r="1.5" fill="currentColor" />
        <circle cx="20" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    num: '03',
    title: 'Simulate',
    desc: 'Run DC simulation instantly and see voltage, current, and power on the canvas',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        <circle cx="22" cy="12" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
];

export default function HowItWorksSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.step-card');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          cards.forEach((card, i) => {
            (card as HTMLElement).style.animationDelay = `${i * 80}ms`;
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
    <section id="how-it-works" ref={sectionRef} className="relative border-t border-subtle bg-base py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-default bg-surface px-4 py-1.5 text-[12px] font-medium text-text-tertiary">
            How it works
          </span>
          <h2 className="mt-4 text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-text-primary">
            Three steps to a working circuit
          </h2>
        </div>

        <div className="relative grid gap-6 md:grid-cols-3">
          <svg
            className="pointer-events-none absolute left-0 right-0 top-16 hidden h-px w-full md:block"
            viewBox="0 0 800 1"
            preserveAspectRatio="none"
          >
            <line
              x1="0"
              y1="0.5"
              x2="800"
              y2="0.5"
              stroke="rgba(255,255,255,0.06)"
              strokeWidth="1"
              strokeDasharray="800"
              strokeDashoffset="800"
              className="animate-draw-line"
            />
          </svg>

          {STEPS.map((s) => (
            <div
              key={s.num}
              className="step-card animate-fade-slide-up group relative rounded-lg border border-default bg-surface p-8 transition-transform duration-base hover:-translate-y-0.5 hover:border-default hover:bg-white/5"
              style={{ opacity: 0 }}
            >
              <div className="mb-5 flex h-10 w-10 items-center justify-center rounded-xl border border-default bg-surface text-text-secondary transition-colors duration-base group-hover:border-default group-hover:text-text-primary">
                {s.icon}
              </div>
              <span className="mb-2 block font-mono text-[11px] font-medium tracking-wider text-text-tertiary">{s.num}</span>
              <h3 className="mb-2 text-[17px] font-medium text-text-primary">{s.title}</h3>
              <p className="text-[14px] leading-normal text-text-tertiary">{s.desc}</p>
              <div className="absolute left-0 top-0 h-full w-0.5 rounded-l-xl bg-accent/0 transition-colors duration-base group-hover:bg-white/5" />
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
