import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layout } from 'react-grid-layout';

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  toolUse?: {
    name: string;
    input: unknown;
    output?: string;
  };
}

export type SessionState = 'idle' | 'busy' | 'waiting' | 'error' | 'disconnected';

export interface Session {
  id: string;
  name: string;
  cwd: string;
  state: SessionState;
  messages: ChatMessage[];
}

export interface Widget {
  id: string;
  sessionId: string | null;
  minimized: boolean;
}

interface DashboardState {
  // Connection state
  connected: boolean;
  clientId: string | null;
  
  // Sessions
  sessions: Record<string, Session>;
  
  // Widgets
  widgets: Widget[];
  layout: Layout[];
  
  // Actions
  setConnected: (connected: boolean, clientId?: string | null) => void;
  addWidget: () => string;
  removeWidget: (widgetId: string) => void;
  setWidgetSession: (widgetId: string, sessionId: string) => void;
  toggleWidgetMinimized: (widgetId: string) => void;
  updateLayout: (layout: Layout[]) => void;
  
  // Session actions
  addSession: (session: Session) => void;
  updateSessionState: (sessionId: string, state: SessionState) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
}

let widgetCounter = 0;

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      connected: false,
      clientId: null,
      sessions: {},
      widgets: [],
      layout: [],

      setConnected: (connected, clientId = null) => {
        set({ connected, clientId });
      },

      addWidget: () => {
        const id = `widget-${++widgetCounter}`;
        const widgets = get().widgets;
        const layout = get().layout;
        
        // Find a good position for the new widget
        const cols = 12;
        const newLayout: Layout = {
          i: id,
          x: (widgets.length * 4) % cols,
          y: Math.floor((widgets.length * 4) / cols) * 6,
          w: 4,
          h: 6,
          minW: 2,
          minH: 3,
        };

        set({
          widgets: [...widgets, { id, sessionId: null, minimized: false }],
          layout: [...layout, newLayout],
        });
        
        return id;
      },

      removeWidget: (widgetId) => {
        set({
          widgets: get().widgets.filter(w => w.id !== widgetId),
          layout: get().layout.filter(l => l.i !== widgetId),
        });
      },

      setWidgetSession: (widgetId, sessionId) => {
        set({
          widgets: get().widgets.map(w =>
            w.id === widgetId ? { ...w, sessionId } : w
          ),
        });
      },

      toggleWidgetMinimized: (widgetId) => {
        set({
          widgets: get().widgets.map(w =>
            w.id === widgetId ? { ...w, minimized: !w.minimized } : w
          ),
        });
      },

      updateLayout: (layout) => {
        set({ layout });
      },

      addSession: (session) => {
        set({
          sessions: { ...get().sessions, [session.id]: session },
        });
      },

      updateSessionState: (sessionId, state) => {
        const sessions = get().sessions;
        if (sessions[sessionId]) {
          set({
            sessions: {
              ...sessions,
              [sessionId]: { ...sessions[sessionId], state },
            },
          });
        }
      },

      addMessage: (sessionId, message) => {
        const sessions = get().sessions;
        if (sessions[sessionId]) {
          // Check if message already exists (for streaming updates)
          const existingIndex = sessions[sessionId].messages.findIndex(
            m => m.id === message.id
          );
          
          let newMessages: ChatMessage[];
          if (existingIndex >= 0) {
            // Update existing message
            newMessages = [...sessions[sessionId].messages];
            newMessages[existingIndex] = message;
          } else {
            // Add new message
            newMessages = [...sessions[sessionId].messages, message];
          }
          
          set({
            sessions: {
              ...sessions,
              [sessionId]: { ...sessions[sessionId], messages: newMessages },
            },
          });
        }
      },

      setSessionMessages: (sessionId, messages) => {
        const sessions = get().sessions;
        if (sessions[sessionId]) {
          set({
            sessions: {
              ...sessions,
              [sessionId]: { ...sessions[sessionId], messages },
            },
          });
        }
      },
    }),
    {
      name: 'cowork-dash-storage',
      partialize: (state) => ({
        widgets: state.widgets,
        layout: state.layout,
      }),
    }
  )
);
