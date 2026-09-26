import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';
import * as authService from '../../services/auth.service';

const AuthContext = createContext(null);

/**
 * Holds the Supabase session and the application profile (public.profiles).
 * Also raises `recovery` when the user arrives from a password-reset link.
 */
export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);
  const [recovery, setRecovery] = useState(false);
  const profileUserRef = useRef(null);

  const loadProfile = useCallback(async (userId) => {
    if (!userId) {
      setProfile(null);
      profileUserRef.current = null;
      return null;
    }
    try {
      const p = await authService.getProfile(userId);
      setProfile(p);
      profileUserRef.current = userId;
      return p;
    } catch (err) {
      console.error('Failed to load profile', err);
      setProfile(null);
      return null;
    }
  }, []);

  useEffect(() => {
    if (!isSupabaseConfigured) return undefined;
    let mounted = true;

    supabase.auth
      .getSession()
      .then(async ({ data }) => {
        if (!mounted) return;
        setSession(data.session);
        await loadProfile(data.session?.user?.id);
      })
      .finally(() => mounted && setLoading(false));

    const { data: sub } = supabase.auth.onAuthStateChange((event, newSession) => {
      setSession(newSession);
      if (event === 'PASSWORD_RECOVERY') setRecovery(true);
      if (event === 'SIGNED_OUT') {
        setProfile(null);
        profileUserRef.current = null;
        setRecovery(false);
      }
      const uid = newSession?.user?.id;
      if (uid && uid !== profileUserRef.current) {
        // defer: Supabase warns against awaiting inside the callback
        setTimeout(() => loadProfile(uid), 0);
      }
    });
    return () => {
      mounted = false;
      sub.subscription.unsubscribe();
    };
  }, [loadProfile]);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      session,
      user: session?.user ?? null,
      profile,
      role: profile?.role ?? null,
      isManager: profile?.role === 'INVENTORY_MANAGER',
      recovery,
      clearRecovery: () => setRecovery(false),
      refreshProfile: () => loadProfile(session?.user?.id),
      signIn: authService.signIn,
      requestLoginOtp: authService.requestLoginOtp,
      verifyLoginOtp: authService.verifyLoginOtp,
      signUp: authService.signUp,
      signOut: authService.signOut,
    }),
    [loading, session, profile, recovery, loadProfile]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
