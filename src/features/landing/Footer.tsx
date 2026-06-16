import { Link } from 'react-router-dom';

const SOCIAL_LINKS = [
  { label: 'GitHub', href: 'https://github.com/volt' },
  { label: 'Twitter', href: 'https://twitter.com/volt' },
  { label: 'Documentation', href: '#' },
];

export default function Footer() {
  return (
    <footer className="border-t border-subtle bg-base py-12">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-col items-center justify-between gap-6 md:flex-row">
          <div className="flex items-center gap-3">
            <span className="flex h-7 w-7 items-center justify-center rounded-md bg-accent text-[11px] font-bold text-black">V</span>
            <span className="text-[13px] font-medium text-text-tertiary">Volt — Draw. Detect. Simulate.</span>
          </div>
          <div className="flex items-center gap-6">
            {SOCIAL_LINKS.map((l) => (
              <a key={l.label} href={l.href} className="text-[13px] text-text-tertiary transition hover:text-text-secondary">
                {l.label}
              </a>
            ))}
            <Link to="/editor" className="text-[13px] text-text-tertiary transition hover:text-text-secondary">
              Editor
            </Link>
          </div>
        </div>
        <div className="mt-8 text-center text-[11px] text-text-tertiary md:text-left">
          &copy; 2026 Volt. All rights reserved.
        </div>
      </div>
    </footer>
  );
}
