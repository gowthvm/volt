import { Link } from 'react-router-dom';
import Seo from '@/components/Seo';

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-base px-6 text-center">
      <Seo title="404 — Page Not Found | Volt" description="The page you're looking for doesn't exist." />
      <h1 className="text-[10rem] font-bold leading-none tracking-tighter text-text-primary">404</h1>
      <p className="mt-4 text-xl text-text-secondary">Page not found</p>
      <p className="mt-2 text-sm text-text-tertiary">The page you're looking for doesn't exist.</p>
      <Link
        to="/"
        className="mt-10 rounded-full bg-accent px-6 py-3 text-sm font-semibold text-black transition hover:bg-accent-hover"
      >
        Back to home
      </Link>
    </div>
  );
}
