import { createClient } from '@supabase/supabase-js';

// ============================================================
//  src/lib/supabase.js
//
//  Single Supabase client instance shared across the entire app.
//
//  SECURITY RULES:
//  - Use ONLY the anon key here. Never the service_role key.
//  - All access control is enforced by Postgres RLS policies.
//  - The frontend never decides who sees what — Postgres does.
//
//  STACKBLITZ NOTE:
//  If you edit .env after the dev server started, you must
//  restart the server for Vite to pick up the new values.
// ============================================================

const SUPABASE_URL     = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

// ── Fail loud, fail early ───────────────────────────────────
if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error(
    '[FOMS] Supabase env vars missing.\n' +
    '1. Create a .env file at project root.\n' +
    '2. Add VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY.\n' +
    '3. Get values from: Supabase → Project Settings → API.\n' +
    '4. Restart the dev server after editing .env.'
  );
}

// ── Client ──────────────────────────────────────────────────
export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession:    true,   // Keep user logged in across reloads
    autoRefreshToken:  true,   // Silently refresh expired tokens
    detectSessionInUrl: true   // Handle magic-link / password-reset redirects
  },
  realtime: {
    params: {
      eventsPerSecond: 10      // Prevent noisy tables from flooding the UI
    }
  }
});

// ── Dev-only connectivity check ─────────────────────────────
// Runs once at startup. Catches wrong URL/key immediately in
// the browser console instead of failing silently later.
if (import.meta.env.DEV) {
  supabase.auth.getSession().then(({ error }) => {
    if (error) {
      console.error('[FOMS] Supabase connection failed:', error.message);
    } else {
      console.info('[FOMS] Supabase connected ✓');
    }
  });
}
