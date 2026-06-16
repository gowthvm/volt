import { useEffect, useRef } from 'react';

const FEATURES = [
  {
    title: 'Infinite canvas',
    desc: 'Pan and zoom freely across your entire schematic. No boundaries, no limits.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
        <path d="M16 5h3v3" />
        <path d="M5 8V5h3" />
        <path d="M8 19H5v-3" />
        <path d="M19 16v3h-3" />
      </svg>
    ),
  },
  {
    title: 'KiCad symbol library',
    desc: 'Thousands of verified IEEE standard components from the KiCad library, ready to use.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M4 19.5A2.5 2.5 0 016.5 17H20" />
        <path d="M6.5 2H20v20H6.5A2.5 2.5 0 014 19.5v-15A2.5 2.5 0 016.5 2z" />
        <path d="M8 7h8M8 11h6M8 15h4" />
      </svg>
    ),
  },
  {
    title: 'Orthogonal wiring',
    desc: 'Precise wire routing with automatic junction detection and bend points.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="4 17 10 11 14 15 20 9" />
        <circle cx="4" cy="17" r="1.5" fill="currentColor" />
        <circle cx="20" cy="9" r="1.5" fill="currentColor" />
      </svg>
    ),
  },
  {
    title: 'DC simulation',
    desc: 'Nodal analysis with real-time voltage, current, and power results overlaid on your circuit.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
        <line x1="2" y1="20" x2="22" y2="20" />
      </svg>
    ),
  },
  {
    title: 'Auto-save',
    desc: 'Your work is always saved to the cloud. Never lose a schematic again.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M19 21H5a2 2 0 01-2-2V5a2 2 0 012-2h11l5 5v11a2 2 0 01-2 2z" />
        <polyline points="17 21 17 13 7 13 7 21" />
        <polyline points="7 3 7 8 15 8" />
        <circle cx="12" cy="16" r="1" />
      </svg>
    ),
  },
  {
    title: 'Export',
    desc: 'Download your schematic as SVG, PNG, or JSON for use in documentation or other tools.',
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
        <polyline points="7 10 12 15 17 10" />
        <line x1="12" y1="15" x2="12" y2="3" />
        <circle cx="12" cy="3" r="1" />
      </svg>
    ),
  },
];

export default function FeaturesSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const cards = el.querySelectorAll('.feature-card');
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          cards.forEach((card, i) => {
            (card as HTMLElement).style.animationDelay = `${i * 80}ms`;
          });
          observer.disconnect();
        }
      },
      { threshold: 0.15 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section id="features" ref={sectionRef} className="border-t border-subtle bg-base py-24">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-default bg-surface px-4 py-1.5 text-[12px] font-medium text-text-tertiary">
            Features
          </span>
          <h2 className="mt-4 text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-text-primary">
            Everything you need to design circuits
          </h2>
        </div>

        <div className="grid gap-px overflow-hidden rounded-lg border border-default bg-border-subtle sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="feature-card animate-fade-slide-up group relative bg-base p-8 transition-transform duration-base hover:-translate-y-1 hover:shadow-lg"
              style={{ opacity: 0 }}
            >
              <div className="mb-4 flex h-9 w-9 items-center justify-center rounded-lg border border-default bg-surface text-text-tertiary transition-colors duration-base group-hover:-translate-y-0.5 group-hover:border-default group-hover:text-text-primary">
                {f.icon}
              </div>
              <div className="pointer-events-none absolute inset-0 rounded-lg opacity-0 transition-opacity duration-base group-hover:opacity-100">
                <div className="animate-shimmer h-full w-full rounded-lg" />
              </div>
              <h3 className="relative mb-1.5 text-[15px] font-medium text-text-primary">{f.title}</h3>
              <p className="relative text-[13px] leading-normal text-text-tertiary">{f.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
