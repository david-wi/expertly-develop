import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Salon } from '../types';
import { auth, salon } from '../services/api';

const IDENTITY_URL = import.meta.env.VITE_IDENTITY_URL || 'https://identity.ai.devintensive.com';

interface AuthState {
  user: User | null;
  salon: Salon | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  checkAuth: () => Promise<void>;
  logout: () => void;
  loadUser: () => Promise<void>;
  loadSalon: () => Promise<void>;
  clearError: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      salon: null,
      isAuthenticated: false,
      isLoading: false,
      error: null,

      checkAuth: async () => {
        set({ isLoading: true, error: null });
        try {
          // Check if we have a valid Identity session by calling /auth/me
          const user = await auth.me();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          // Load salon data after confirming auth
          await get().loadSalon();
        } catch (error) {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      logout: () => {
        // Redirect to Identity logout
        const returnUrl = encodeURIComponent(window.location.origin + '/login');
        window.location.href = `${IDENTITY_URL}/logout?returnUrl=${returnUrl}`;
      },

      loadUser: async () => {
        set({ isLoading: true });
        try {
          const user = await auth.me();
          set({
            user,
            isAuthenticated: true,
            isLoading: false,
          });
          await get().loadSalon();
        } catch {
          set({
            user: null,
            isAuthenticated: false,
            isLoading: false,
          });
        }
      },

      loadSalon: async () => {
        try {
          const salonData = await salon.getCurrent();
          set({ salon: salonData });
        } catch (error) {
          console.error('Failed to load salon:', error);
        }
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-storage',
      partialize: (state) => ({
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
