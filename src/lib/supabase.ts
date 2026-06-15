import { createClient } from '@supabase/supabase-js';

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL;
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing Supabase environment variables. Check VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.'
  );
}

const normalizedSupabaseUrl = supabaseUrl
  .replace(/\/?rest\/v1\/?$/, '')
  .replace(/\/$/, '');

if (normalizedSupabaseUrl !== supabaseUrl) {
  console.warn(
    'Normalized VITE_SUPABASE_URL to remove /rest/v1 or trailing slash:',
    normalizedSupabaseUrl
  );
}

export const supabase = createClient(normalizedSupabaseUrl, supabaseAnonKey);
