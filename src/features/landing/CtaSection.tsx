import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';
import GradualBlur from '@/components/ui/GradualBlur';

export default function CtaSection() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  return (
    <section className="relative border-t border-subtle bg-base py-16 overflow-hidden">
      <GradualBlur position="top" height="5rem" strength={2} divCount={6} curve="bezier" opacity={1} zIndex={10} />
      {/* Glow rings */}
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div className="h-[500px] w-[500px] animate-pulse-glow rounded-full bg-white/[0.03] blur-[120px]" style={{ animationDuration: '6s' }} />
        <div className="absolute h-[300px] w-[300px] animate-pulse-glow rounded-full bg-white/[0.02] blur-[80px]" style={{ animationDuration: '8s', animationDelay: '2s' }} />
      </div>
      <div className="relative mx-auto max-w-3xl px-5 text-center">
        <h2 className="mb-4 text-[clamp(1.8rem,5vw,3rem)] font-bold tracking-[-0.03em] text-text-primary">
          Start designing circuits today
        </h2>
        <p className="mb-10 text-[15px] text-text-secondary">
          Free to use. No installation required. Works in your browser.
        </p>
        <Link
          to={isAuthenticated ? '/editor' : '/signup'}
          className="relative inline-flex items-center gap-2 rounded-md bg-accent px-8 py-4 text-[15px] font-medium text-black transition hover:brightness-110 active:scale-[0.97] hover:shadow-[0_0_32px_rgba(255,214,10,0.3)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
        >
          Open Volt
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14M12 5l7 7-7 7" />
          </svg>
        </Link>
      </div>
    </section>
  );
}
