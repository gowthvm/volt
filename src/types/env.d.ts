/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Supabase project URL (e.g. https://abc123.supabase.co) */
  readonly VITE_SUPABASE_URL: string;
  /** Supabase anon/public API key (safe for client-side use) */
  readonly VITE_SUPABASE_ANON_KEY: string;
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}
