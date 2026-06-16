import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useAuthStore } from '@/store/authStore';

const NAV_LINKS = [
  { label: 'Features', href: '#features' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '#' },
];

export default function Navbar() {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 100);
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-colors duration-slow ${
        scrolled ? 'bg-black/80 backdrop-blur-xl border-b border-subtle' : 'bg-transparent'
      }`}
    >
      <div className="mx-auto flex h-14 max-w-7xl items-center justify-between px-5 lg:px-8">
        <Link to="/" className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-black">V</span>
          <span className="text-[15px] font-bold tracking-tight text-text-primary">Volt</span>
        </Link>

        <div className="hidden items-center gap-8 md:flex">
          {NAV_LINKS.map((l) => (
            <a
              key={l.label}
              href={l.href}
              className="group relative text-[13px] text-text-secondary transition hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              {l.label}
              <span className="absolute -bottom-0.5 left-0 h-px w-full origin-left scale-x-0 bg-accent transition-transform duration-base group-hover:scale-x-100" />
            </a>
          ))}
        </div>

        <div className="hidden items-center gap-3 md:flex">
          {isAuthenticated ? (
            <Link
              to="/editor"
              className="rounded-md border border-default bg-surface px-4 py-1.5 text-[13px] font-medium text-text-secondary transition hover:bg-white/5 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
            >
              Open Editor
            </Link>
          ) : (
            <>
              <Link
                to="/login"
                className="rounded-md px-4 py-1.5 text-[13px] font-medium text-text-secondary transition hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Log in
              </Link>
              <Link
                to="/signup"
                className="animate-pulse-glow-signup rounded-md bg-accent px-4 py-1.5 text-[13px] font-medium text-black transition hover:brightness-110 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                Sign up
              </Link>
            </>
          )}
        </div>

        <button
          onClick={() => setOpen(!open)}
          className="relative z-50 flex h-8 w-8 items-center justify-center md:hidden"
          aria-label="Menu"
        >
          <div className="flex flex-col gap-1">
            <span
              className={`block h-px w-5 bg-white/60 transition ${
                open ? 'translate-y-[5px] rotate-45' : ''
              }`}
            />
            <span
              className={`block h-px w-5 bg-white/60 transition ${
                open ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block h-px w-5 bg-white/60 transition ${
                open ? '-translate-y-[5px] -rotate-45' : ''
              }`}
            />
          </div>
        </button>
      </div>

      {open && (
        <div className="border-t border-subtle bg-black/95 backdrop-blur-xl md:hidden">
          <div className="space-y-1 px-5 py-4">
            {NAV_LINKS.map((l) => (
              <a
                key={l.label}
                href={l.href}
                onClick={() => setOpen(false)}
                className="block rounded-md px-3 py-2 text-[14px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
              >
                {l.label}
              </a>
            ))}
            <hr className="my-3 border-subtle" />
            {isAuthenticated ? (
              <Link
                to="/editor"
                onClick={() => setOpen(false)}
                className="block rounded-md bg-accent px-3 py-2 text-center text-[14px] font-medium text-black"
              >
                Open Editor
              </Link>
            ) : (
              <>
                <Link
                  to="/login"
                  onClick={() => setOpen(false)}
                  className="block rounded-md px-3 py-2 text-[14px] text-text-secondary transition hover:bg-white/5 hover:text-text-primary focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Log in
                </Link>
                <Link
                  to="/signup"
                  onClick={() => setOpen(false)}
                  className="block rounded-md bg-accent px-3 py-2 text-center text-[14px] font-medium text-black focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent"
                >
                  Sign up
                </Link>
              </>
            )}
          </div>
        </div>
      )}
    </nav>
  );
}
