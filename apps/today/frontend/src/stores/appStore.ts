import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import api from '../services/api';

interface AppState {
  apiKey: string | null;
  isAuthenticated: boolean;
  sidebarOpen: boolean;

  setApiKey: (key: string) => void;
  logout: () => void;
  toggleSidebar: () => void;
  setSidebarOpen: (open: boolean) => void;
}

export const useAppStore = create<AppState>()(
  persist(
    (set) => ({
      apiKey: null,
      isAuthenticated: false,
      sidebarOpen: true,

      setApiKey: (key: string) => {
        api.setApiKey(key);
        set({ apiKey: key, isAuthenticated: true });
      },

      logout: () => {
        localStorage.removeItem('api_key');
        set({ apiKey: null, isAuthenticated: false });
      },

      toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),

      setSidebarOpen: (open: boolean) => set({ sidebarOpen: open }),
    }),
    {
      name: 'expertly-storage',
      partialize: (state) => ({ apiKey: state.apiKey, isAuthenticated: state.isAuthenticated }),
      onRehydrateStorage: () => (state) => {
        // Restore API key to axios after rehydration
        if (state?.apiKey) {
          api.setApiKey(state.apiKey);
        }
      },
    }
  )
);
