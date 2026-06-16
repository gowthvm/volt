import { useEffect, useRef } from 'react';

const TRADITIONAL = [
  'Steep learning curve',
  'Cluttered legacy UI',
  'Slow and heavy',
  'Desktop only',
  'Expensive licenses',
];

const VOLT = [
  'Intuitive modern interface',
  'Clean minimal design',
  'Fast and lightweight',
  'Works in any browser',
  'Free to get started',
];

export default function ComparisonSection() {
  const sectionRef = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = sectionRef.current;
    if (!el) return;
    const traditionalCol = el.querySelector('.comparison-traditional');
    const voltCol = el.querySelector('.comparison-volt');
    const strikethroughs = el.querySelectorAll('.strikethrough-line');
    const checkmarks = el.querySelectorAll('.checkmark-path');

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          (traditionalCol as HTMLElement).style.animationDelay = '0ms';
          (voltCol as HTMLElement).style.animationDelay = '150ms';

          strikethroughs.forEach((line, i) => {
            (line as HTMLElement).style.animationDelay = `${300 + i * 100}ms`;
          });
          checkmarks.forEach((mark, i) => {
            (mark as HTMLElement).style.animationDelay = `${300 + i * 100}ms`;
          });

          observer.disconnect();
        }
      },
      { threshold: 0.2 },
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <section ref={sectionRef} className="border-t border-subtle bg-base py-16">
      <div className="mx-auto max-w-6xl px-5">
        <div className="mb-16 text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-default bg-surface px-4 py-1.5 text-[12px] font-medium text-text-tertiary">
            Comparison
          </span>
          <h2 className="mt-4 text-[clamp(1.5rem,4vw,2.5rem)] font-bold tracking-[-0.03em] text-text-primary">
            Built different
          </h2>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div
            className="comparison-traditional animate-fade-slide-up rounded-lg border border-subtle bg-surface p-8"
            style={{ opacity: 0 }}
          >
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-subtle bg-surface">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-tertiary">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-tertiary">Traditional CAD</span>
            </div>
            <ul className="space-y-4">
              {TRADITIONAL.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-text-tertiary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-tertiary">
                    <line x1="18" y1="6" x2="6" y2="18" />
                    <line x1="6" y1="6" x2="18" y2="18" />
                    <line x1="18" y1="6" x2="6" y2="18" stroke="red" strokeWidth="1.5" strokeDasharray="200" strokeDashoffset="200" className="strikethrough-line animate-strikethrough" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>

          <div
            className="comparison-volt animate-fade-slide-up relative rounded-lg border border-default bg-white/[0.02] p-8"
            style={{ opacity: 0 }}
          >
            <div className="absolute right-6 top-0 -translate-y-1/2 rounded-full border border-default bg-surface px-3 py-1 font-mono text-[10px] font-medium uppercase tracking-wider text-text-secondary">
              Better
            </div>
            <div className="mb-6 flex items-center gap-3">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-default bg-surface">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="text-text-secondary">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              </div>
              <span className="text-sm font-medium text-text-primary">Volt</span>
            </div>
            <ul className="space-y-4">
              {VOLT.map((item) => (
                <li key={item} className="flex items-center gap-3 text-sm text-text-secondary">
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" className="shrink-0 text-text-secondary">
                    <polyline points="20 6 9 17 4 12" stroke="currentColor" strokeWidth="2" strokeDasharray="20" strokeDashoffset="20" className="checkmark-path animate-checkmark" />
                  </svg>
                  {item}
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
