import { useContext } from 'react';
import { AuthContext } from './AuthProvider';

// ============================================================
//  src/auth/useAuth.js
//
//  Simple hook that consumes AuthContext.
//  Throws a clear error if used outside <AuthProvider> so
//  misconfigured component trees are caught immediately.
// ============================================================

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error(
      '[FOMS] useAuth must be used inside <AuthProvider>. ' +
      'Make sure <AuthProvider> wraps your component tree in main.jsx.'
    );
  }

  return ctx;
}
