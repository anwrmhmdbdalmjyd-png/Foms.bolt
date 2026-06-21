import { useAuth } from './useAuth';

// ============================================================
//  src/auth/useRole.js
//
//  Derives clean role booleans from useAuth.
//  Use this hook in components instead of comparing role
//  strings manually everywhere in the codebase.
//
//  Usage:
//    const { isAdmin, isSupervisor, isAgent } = useRole();
//
//  hasRole(...roles) lets you check multiple roles at once:
//    const { hasRole } = useRole();
//    hasRole('admin', 'supervisor') // true if either role matches
//
//  REMINDER: These booleans control UI rendering only.
//  Data-level access is always enforced by Postgres RLS.
// ============================================================

export function useRole() {
  const { role, profile } = useAuth();

  return {
    // Raw role string — 'admin' | 'supervisor' | 'agent' | null
    role,

    // Full profile row from `users` table
    profile,

    // Role booleans — use these in components
    isAdmin:      role === 'admin',
    isSupervisor: role === 'supervisor',
    isAgent:      role === 'agent',

    // Check against multiple roles at once
    hasRole: (...roles) => roles.includes(role),

    // Convenience: can manage campaigns and teams
    canManage: role === 'admin' || role === 'supervisor',

    // Convenience: field-level access only
    isFieldUser: role === 'agent'
  };
}
