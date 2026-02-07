import { create } from 'zustand';
import { api, IDENTITY_URL } from '../api/client';
import type { User } from '../types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

export interface AuthState {
  /** Currently authenticated user (null when logged out or not yet loaded). */
  user: User | null;
  /** Whether the initial session check is still in progress. */
  isLoading: boolean;
  /** Convenience getter backed by user presence. */
  isAuthenticated: boolean;

  /** Clear user state and redirect to Identity logout. */
  logout: () => void;
  /** Attempt to restore a session from the Identity session cookie. */
  loadUser: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  isAuthenticated: false,

  // ── logout ──────────────────────────────────────────────────────────
  logout() {
    set({
      user: null,
      isAuthenticated: false,
      isLoading: false,
    });
    const returnUrl = encodeURIComponent(window.location.origin);
    window.location.href = `${IDENTITY_URL}/logout?returnUrl=${returnUrl}`;
  },

  // ── loadUser ────────────────────────────────────────────────────────
  async loadUser() {
    try {
      const user = await api.auth.me();
      set({
        user,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // No valid session — the 401 interceptor will redirect to Identity
      // login if needed. Here we just clear state.
      set({
        user: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
