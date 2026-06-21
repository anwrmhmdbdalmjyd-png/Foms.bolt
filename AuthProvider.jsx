import { createContext, useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';

// ============================================================
//  src/auth/AuthProvider.jsx
//
//  Provides authentication state to the entire app via Context.
//
//  What this file manages:
//  - Supabase Auth session (JWT token lifecycle)
//  - User profile row from the `users` table (carries `role`)
//  - Global loading / error states during auth initialization
//
//  SECURITY NOTE:
//  Role checks here are UI-only (what to render / where to
//  redirect). Real access control is enforced by Postgres RLS.
//  Even if someone manipulates client-side state, Supabase will
//  refuse to return rows their JWT isn't authorized to see.
//
//  ARCHITECTURE:
//  AuthProvider  →  AuthContext
//  useAuth.js    →  consumes AuthContext
//  useRole.js    →  derives role booleans from useAuth
//  ProtectedRoute →  uses useAuth to guard routes
// ============================================================

export const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [session, setSession]   = useState(null);
  const [profile, setProfile]   = useState(null);
  const [loading, setLoading]   = useState(true);
  const [error,   setError]     = useState(null);

  // ── Load user profile from `users` table ─────────────────
  // Called every time the Supabase auth state changes.
  // We fetch from `users` (not `users_profile`) because `users`
  // carries the `role` column needed for RBAC.
  // Adjust the select fields if your schema differs.
  const loadProfile = useCallback(async (authUser) => {
    if (!authUser) {
      setProfile(null);
      return;
    }

    const { data, error: profileError } = await supabase
      .from('users')
      .select('id, full_name, phone, email, role, status')
      .eq('id', authUser.id)
      .single();

    if (profileError) {
      setError('تعذّر تحميل بيانات المستخدم. تواصل مع الإدارة.');
      setProfile(null);
      return;
    }

    // Block suspended accounts at the UI level
    // (RLS blocks them at the data level too)
    if (data.status !== 'active') {
      setError('هذا الحساب موقوف. تواصل مع الإدارة.');
      setProfile(null);
      await supabase.auth.signOut();
      return;
    }

    setProfile(data);
  }, []);

  // ── Initialize session on mount ──────────────────────────
  useEffect(() => {
    let mounted = true;

    async function init() {
      // Get existing session from localStorage (persisted by Supabase client)
      const { data: { session: existingSession } } = await supabase.auth.getSession();

      if (!mounted) return;

      setSession(existingSession ?? null);
      await loadProfile(existingSession?.user ?? null);

      if (mounted) setLoading(false);
    }

    init();

    // ── Listen for auth state changes ──────────────────────
    // Fires on: login, logout, token refresh, tab focus
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (_event, newSession) => {
        if (!mounted) return;

        setSession(newSession ?? null);
        setLoading(true);
        setError(null);

        await loadProfile(newSession?.user ?? null);

        if (mounted) setLoading(false);
      }
    );

    return () => {
      mounted = false;
      subscription?.unsubscribe();
    };
  }, [loadProfile]);

  // ── Login ────────────────────────────────────────────────
  const login = useCallback(async (email, password) => {
    setError(null);

    const { data, error: signInError } = await supabase.auth.signInWithPassword({
      email,
      password
    });

    if (signInError) {
      const msg = 'بيانات الدخول غير صحيحة. تحقق من البريد الإلكتروني وكلمة المرور.';
      setError(msg);
      throw new Error(msg);
    }

    return data;
  }, []);

  // ── Logout ───────────────────────────────────────────────
  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setProfile(null);
    setSession(null);
    setError(null);
  }, []);

  // ── Context value ────────────────────────────────────────
  const value = {
    // Raw Supabase session (contains JWT, expires_at, etc.)
    session,

    // Auth user object (id, email — from Supabase Auth)
    user: session?.user ?? null,

    // Profile row from `users` table (full_name, role, status, etc.)
    profile,

    // Shortcut to role string: 'admin' | 'supervisor' | 'agent' | null
    role: profile?.role ?? null,

    // True only when session exists AND profile loaded successfully
    isAuthenticated: !!session && !!profile,

    // Global auth loading state (used by ProtectedRoute to avoid
    // flashing the login page while session is being restored)
    loading,

    // Auth-level error message (wrong credentials, suspended account)
    error,

    // Actions
    login,
    logout
  };

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}
