import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { User, Salon } from '../types';
import { auth, salon, setAccessToken } from '../services/api';

interface AuthState {
  user: User | null;
  salon: Salon | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;

  login: (email: string, password: string) => Promise<void>;
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

      login: async (email: string, password: string) => {
        set({ isLoading: true, error: null });
        try {
          const response = await auth.login({ email, password });
          set({
            user: response.user,
            isAuthenticated: true,
            isLoading: false,
          });
          // Load salon data after login
          await get().loadSalon();
        } catch (error) {
          set({
            error: error instanceof Error ? error.message : 'Login failed',
            isLoading: false,
          });
          throw error;
        }
      },

      logout: () => {
        auth.logout();
        set({
          user: null,
          salon: null,
          isAuthenticated: false,
        });
      },

      loadUser: async () => {
        const token = localStorage.getItem('access_token');
        if (!token) {
          set({ isAuthenticated: false });
          return;
        }

        set({ isLoading: true });
        try {
          setAccessToken(token);
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
          setAccessToken(null);
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
