import { create } from 'zustand';
import { Session, User, AuthError, Provider } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';

export interface AuthState {
  user: User | null;
  session: Session | null;
  isAuthenticated: boolean;
  loading: boolean;
  error: string | null;
  signInWithEmail: (email: string, password: string) => Promise<AuthError | null>;
  signUpWithEmail: (email: string, password: string) => Promise<AuthError | null>;
  signInWithProvider: (provider: Provider) => Promise<{ url?: string; error: AuthError | null }>;
  signOut: () => Promise<AuthError | null>;
  setSession: (session: Session | null) => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  session: null,
  isAuthenticated: false,
  loading: true,
  error: null,
  signInWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    const {
      data: { session },
      error,
    } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      set({ loading: false, error: error.message });
      return error;
    }

    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      loading: false,
    });

    return null;
  },
  signUpWithEmail: async (email, password) => {
    set({ loading: true, error: null });
    const {
      data: { session },
      error,
    } = await supabase.auth.signUp({ email, password });

    if (error) {
      set({ loading: false, error: error.message });
      return error;
    }

    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      loading: false,
    });

    return null;
  },
  signInWithProvider: async (provider) => {
    set({ loading: true, error: null });
    const { data, error } = await supabase.auth.signInWithOAuth({
      provider,
      options: {
        redirectTo: `${window.location.origin}/editor`,
      },
    });

    if (error) {
      set({ loading: false, error: error.message });
      return { url: undefined, error };
    }

    return { url: data.url ?? undefined, error: null };
  },
  signOut: async () => {
    set({ loading: true, error: null });
    const { error } = await supabase.auth.signOut();

    if (error) {
      set({ loading: false, error: error.message });
      return error;
    }

    set({ user: null, session: null, isAuthenticated: false, loading: false });
    return null;
  },
  setSession: (session) => {
    set({
      session,
      user: session?.user ?? null,
      isAuthenticated: Boolean(session),
      loading: false,
    });
  },
  setLoading: (loading) => set({ loading }),
  setError: (error) => set({ error }),
}));
