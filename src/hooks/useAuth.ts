import { useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuthStore } from '@/store/authStore';

let authInitialized = false;

export function useAuth() {
  const user = useAuthStore((state) => state.user);
  const session = useAuthStore((state) => state.session);
  const isAuthenticated = useAuthStore((state) => state.isAuthenticated);
  const loading = useAuthStore((state) => state.loading);
  const error = useAuthStore((state) => state.error);
  const signInWithEmail = useAuthStore((state) => state.signInWithEmail);
  const signUpWithEmail = useAuthStore((state) => state.signUpWithEmail);
  const signInWithProvider = useAuthStore((state) => state.signInWithProvider);
  const signOut = useAuthStore((state) => state.signOut);
  const setSession = useAuthStore((state) => state.setSession);
  const setLoading = useAuthStore((state) => state.setLoading);

  useEffect(() => {
    if (authInitialized) {
      return;
    }
    authInitialized = true;
    const initialize = async () => {
      setLoading(true);
      const { data } = await supabase.auth.getSession();
      setSession(data.session);
      setLoading(false);
    };

    initialize();

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
    });

    return () => {
      authListener?.subscription?.unsubscribe();
    };
  }, []);

  return useMemo(
    () => ({
      user,
      session,
      isAuthenticated,
      loading,
      error,
      signInWithEmail,
      signUpWithEmail,
      signInWithProvider,
      signOut,
    }),
    [
      user,
      session,
      isAuthenticated,
      loading,
      error,
      signInWithEmail,
      signUpWithEmail,
      signInWithProvider,
      signOut,
    ]
  );
}
