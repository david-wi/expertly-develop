import { create } from 'zustand';
import { api } from '../api/client';
import type { User } from '../types';

// ---------------------------------------------------------------------------
// State shape
// ---------------------------------------------------------------------------

interface AuthState {
  /** Currently authenticated user (null when logged out or not yet loaded). */
  user: User | null;
  /** JWT bearer token. */
  token: string | null;
  /** Whether the initial token check / user fetch is still in progress. */
  isLoading: boolean;
  /** Convenience getter backed by user + token presence. */
  isAuthenticated: boolean;

  /** Authenticate with email + password. Stores token in localStorage. */
  login: (email: string, password: string) => Promise<void>;
  /** Clear token, user state, and localStorage. */
  logout: () => void;
  /** Attempt to restore a session from a token saved in localStorage. */
  loadUser: () => Promise<void>;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const TOKEN_KEY = 'intake_token';

// ---------------------------------------------------------------------------
// Store
// ---------------------------------------------------------------------------

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  token: localStorage.getItem(TOKEN_KEY),
  isLoading: true,
  isAuthenticated: false,

  // ── login ───────────────────────────────────────────────────────────
  async login(email: string, password: string) {
    const response = await api.auth.login(email, password);
    localStorage.setItem(TOKEN_KEY, response.token);
    set({
      user: response.user,
      token: response.token,
      isAuthenticated: true,
      isLoading: false,
    });
  },

  // ── logout ──────────────────────────────────────────────────────────
  logout() {
    localStorage.removeItem(TOKEN_KEY);
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      isLoading: false,
    });
  },

  // ── loadUser ────────────────────────────────────────────────────────
  async loadUser() {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) {
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
      return;
    }

    try {
      const user = await api.auth.me();
      set({
        user,
        token,
        isAuthenticated: true,
        isLoading: false,
      });
    } catch {
      // Token expired or invalid
      localStorage.removeItem(TOKEN_KEY);
      set({
        user: null,
        token: null,
        isAuthenticated: false,
        isLoading: false,
      });
    }
  },
}));
