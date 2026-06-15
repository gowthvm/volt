import { useEffect } from 'react';

interface SeoProps {
  title?: string;
  description?: string;
  path?: string;
}

export default function Seo({ title, description, path }: SeoProps) {
  useEffect(() => {
    const prev = document.title;
    document.title = title ?? 'Volt — Draw. Detect. Simulate.';
    return () => { document.title = prev; };
  }, [title]);

  useEffect(() => {
    if (!description) return;
    const el = document.querySelector('meta[name="description"]');
    const prev = el?.getAttribute('content');
    el?.setAttribute('content', description);
    return () => { if (el && prev) el.setAttribute('content', prev); };
  }, [description]);

  useEffect(() => {
    if (!path) return;
    const el = document.querySelector('link[rel="canonical"]');
    const prev = el?.getAttribute('href');
    el?.setAttribute('href', `https://volt.circuits${path}`);
    return () => { if (el && prev) el.setAttribute('href', prev); };
  }, [path]);

  return null;
}
