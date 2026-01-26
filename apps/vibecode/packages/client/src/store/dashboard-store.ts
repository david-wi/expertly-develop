import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { Layout } from 'react-grid-layout';

export interface ImageAttachment {
  id: string;
  data: string;  // base64 encoded image data
  mediaType: 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp';
  name?: string;
}

export interface ChatMessage {
  id: string;
  role: 'user' | 'assistant' | 'system';
  content: string;
  timestamp: number;
  images?: ImageAttachment[];
  toolUse?: {
    name: string;
    input: unknown;
    output?: string;
  };
}

export type SessionState = 'idle' | 'busy' | 'waiting' | 'error' | 'disconnected';
export type ExecutionMode = 'local' | 'remote';
export type WidgetType = 'session' | 'chat';
export type ChatState = 'idle' | 'busy' | 'error';

export interface QueuedMessage {
  id: string;
  content: string;
  timestamp: number;
}

export interface ChatConversation {
  id: string;
  messages: ChatMessage[];
  state: ChatState;
}

export interface Session {
  id: string;
  name: string;
  cwd: string;
  state: SessionState;
  executionMode: ExecutionMode;
  messages: ChatMessage[];
  queuedMessages: QueuedMessage[]; // Messages queued while busy
  busyStartedAt?: number; // Timestamp when session became busy
}

export interface Widget {
  id: string;
  type: WidgetType;
  sessionId: string | null;  // Only used for 'session' type
  conversationId: string | null;  // Only used for 'chat' type
  minimized: boolean;
  customName?: string;
  showStreaming: boolean; // Whether to show streaming/in-progress messages
}

interface ServerConfig {
  defaultExecutionMode: ExecutionMode;
  remoteAvailable: boolean;
  hasLocalAgent: boolean;
}

export interface AgentMetrics {
  cpuPercent: number;
  memoryUsedMB: number;
  memoryTotalMB: number;
  memoryPercent: number;
  loadAvg: number[];
  activeCommands: number;
  queuedTasks: number;
}

export interface AgentInfo {
  id: string;
  workingDir: string;
  platform: string;
  version: string;
  connectedAt: string;
  systemInfo?: {
    cpus: number;
    totalMemoryMB: number;
    hostname: string;
  };
  metrics?: AgentMetrics;
  metricsAt?: string;
}

interface DashboardState {
  // Connection state
  connected: boolean;
  clientId: string | null;
  serverConfig: ServerConfig;

  // Agents
  agents: AgentInfo[];

  // Sessions
  sessions: Record<string, Session>;
  sessionNameHistory: string[]; // Previously used session names
  sessionConfigs: Record<string, { cwd: string }>; // Saved configs per session name

  // Chat conversations (for chat widgets)
  chatConversations: Record<string, ChatConversation>;

  // Widgets
  widgets: Widget[];
  layout: Layout[];

  // Actions
  setConnected: (connected: boolean, clientId?: string | null, config?: ServerConfig) => void;
  setAgents: (agents: AgentInfo[]) => void;
  addWidget: (type?: WidgetType) => string;
  addChatWidget: () => string;
  removeWidget: (widgetId: string) => void;
  setWidgetSession: (widgetId: string, sessionId: string) => void;
  toggleWidgetMinimized: (widgetId: string) => void;
  renameWidget: (widgetId: string, name: string) => void;
  toggleShowStreaming: (widgetId: string) => void;
  updateLayout: (layout: Layout[]) => void;

  // Chat conversation actions
  addChatMessage: (conversationId: string, message: ChatMessage) => void;
  setChatState: (conversationId: string, state: ChatState) => void;

  // Session actions
  addSession: (session: Session) => void;
  updateSessionState: (sessionId: string, state: SessionState) => void;
  updateSessionExecutionMode: (sessionId: string, mode: ExecutionMode) => void;
  addMessage: (sessionId: string, message: ChatMessage) => void;
  setSessionMessages: (sessionId: string, messages: ChatMessage[]) => void;
  markAllSessionsDisconnected: () => void;
  getSessionIds: () => string[];
  removeSession: (sessionId: string) => void;
  clearDisconnectedSessions: () => void;
  addSessionNameToHistory: (name: string) => void;
  saveSessionConfig: (name: string, cwd: string) => void;
  getSessionConfig: (name: string) => { cwd: string } | undefined;
  // Queue actions
  addQueuedMessage: (sessionId: string, content: string) => QueuedMessage | null;
  getNextQueuedMessage: (sessionId: string) => QueuedMessage | null;
  removeQueuedMessage: (sessionId: string, messageId: string) => void;
  clearQueue: (sessionId: string) => void;
}

// Generate unique widget ID
const generateWidgetId = () => `widget-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

export const useDashboardStore = create<DashboardState>()(
  persist(
    (set, get) => ({
      connected: false,
      clientId: null,
      serverConfig: {
        defaultExecutionMode: 'local',
        remoteAvailable: false,
        hasLocalAgent: false,
      },
      agents: [],
      sessions: {},
      sessionNameHistory: [],
      sessionConfigs: {},
      chatConversations: {},
      widgets: [],
      layout: [],

      setConnected: (connected, clientId = null, config) => {
        set({
          connected,
          clientId,
          ...(config ? { serverConfig: config } : {}),
        });
      },

      setAgents: (agents) => {
        set({
          agents,
          serverConfig: {
            ...get().serverConfig,
            hasLocalAgent: agents.length > 0,
          },
        });
      },

      addWidget: (type: WidgetType = 'session') => {
        const id = generateWidgetId();
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
          widgets: [...widgets, { id, type, sessionId: null, conversationId: null, minimized: false, showStreaming: false }],
          layout: [...layout, newLayout],
        });

        return id;
      },

      addChatWidget: () => {
        const widgetId = generateWidgetId();
        const conversationId = `chat-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
        const widgets = get().widgets;
        const layout = get().layout;
        const chatConversations = get().chatConversations;

        // Find a good position for the new widget
        const cols = 12;
        const newLayout: Layout = {
          i: widgetId,
          x: (widgets.length * 4) % cols,
          y: Math.floor((widgets.length * 4) / cols) * 6,
          w: 4,
          h: 6,
          minW: 2,
          minH: 3,
        };

        // Create the conversation
        const newConversation: ChatConversation = {
          id: conversationId,
          messages: [],
          state: 'idle',
        };

        set({
          widgets: [...widgets, {
            id: widgetId,
            type: 'chat',
            sessionId: null,
            conversationId,
            minimized: false,
            showStreaming: true,
          }],
          layout: [...layout, newLayout],
          chatConversations: {
            ...chatConversations,
            [conversationId]: newConversation,
          },
        });

        return widgetId;
      },

      removeWidget: (widgetId) => {
        const widget = get().widgets.find(w => w.id === widgetId);
        const chatConversations = { ...get().chatConversations };

        // Clean up associated chat conversation if it's a chat widget
        if (widget?.type === 'chat' && widget.conversationId) {
          delete chatConversations[widget.conversationId];
        }

        set({
          widgets: get().widgets.filter(w => w.id !== widgetId),
          layout: get().layout.filter(l => l.i !== widgetId),
          chatConversations,
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

      renameWidget: (widgetId, name) => {
        set({
          widgets: get().widgets.map(w =>
            w.id === widgetId ? { ...w, customName: name } : w
          ),
        });
      },

      toggleShowStreaming: (widgetId) => {
        set({
          widgets: get().widgets.map(w =>
            w.id === widgetId ? { ...w, showStreaming: !w.showStreaming } : w
          ),
        });
      },

      updateLayout: (layout) => {
        set({ layout });
      },

      addSession: (session) => {
        const sessions = get().sessions;
        const existingSession = sessions[session.id];

        // Set busyStartedAt if becoming busy
        let busyStartedAt = session.busyStartedAt;
        if (session.state === 'busy' && (!existingSession || existingSession.state !== 'busy')) {
          busyStartedAt = Date.now();
        } else if (session.state !== 'busy') {
          busyStartedAt = undefined;
        }

        // Preserve existing queue or initialize empty
        const queuedMessages = existingSession?.queuedMessages || session.queuedMessages || [];

        set({
          sessions: {
            ...sessions,
            [session.id]: { ...session, busyStartedAt, queuedMessages },
          },
        });
      },

      updateSessionState: (sessionId, state) => {
        const sessions = get().sessions;
        if (sessions[sessionId]) {
          const session = sessions[sessionId];
          const updates: Partial<Session> = { state };

          // Track when session becomes busy
          if (state === 'busy' && session.state !== 'busy') {
            updates.busyStartedAt = Date.now();
          } else if (state === 'idle' || state === 'error' || state === 'disconnected') {
            // Clear busyStartedAt when no longer busy
            updates.busyStartedAt = undefined;
          }

          set({
            sessions: {
              ...sessions,
              [sessionId]: { ...session, ...updates },
            },
          });
        }
      },

      updateSessionExecutionMode: (sessionId, mode) => {
        const sessions = get().sessions;
        if (sessions[sessionId]) {
          set({
            sessions: {
              ...sessions,
              [sessionId]: { ...sessions[sessionId], executionMode: mode },
            },
          });
        }
      },

      addMessage: (sessionId, message) => {
        const sessions = get().sessions;
        if (!sessions[sessionId]) {
          console.warn('[Store] addMessage: session not found:', sessionId, 'Available sessions:', Object.keys(sessions));
          return;
        }

        // Skip duplicate user messages (local message already added)
        if (message.role === 'user' && !message.id.startsWith('local-')) {
          const existingUserMsg = sessions[sessionId].messages.find(
            m => m.role === 'user' && m.content === message.content &&
                 Math.abs(m.timestamp - message.timestamp) < 5000
          );
          if (existingUserMsg) {
            console.log('[Store] Skipping duplicate user message');
            return;
          }
        }

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

        console.log('[Store] Adding message to session:', sessionId, 'Total messages:', newMessages.length);
        set({
          sessions: {
            ...sessions,
            [sessionId]: { ...sessions[sessionId], messages: newMessages },
          },
        });
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

      markAllSessionsDisconnected: () => {
        const sessions = get().sessions;
        const updated: Record<string, Session> = {};
        for (const [id, session] of Object.entries(sessions)) {
          updated[id] = { ...session, state: 'disconnected' };
        }
        set({ sessions: updated });
      },

      getSessionIds: () => {
        return Object.keys(get().sessions);
      },

      removeSession: (sessionId) => {
        const sessions = { ...get().sessions };
        delete sessions[sessionId];
        set({ sessions });
      },

      clearDisconnectedSessions: () => {
        const sessions = get().sessions;
        const widgets = get().widgets;
        const activeSessionIds = new Set(widgets.map(w => w.sessionId).filter(Boolean));

        const updated: Record<string, Session> = {};
        for (const [id, session] of Object.entries(sessions)) {
          // Keep sessions that are active or connected to a widget
          if (session.state !== 'disconnected' || activeSessionIds.has(id)) {
            updated[id] = session;
          }
        }
        set({ sessions: updated });
      },

      addSessionNameToHistory: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const history = get().sessionNameHistory;
        // Add to front, remove duplicates, keep max 20
        const updated = [trimmed, ...history.filter(n => n !== trimmed)].slice(0, 20);
        set({ sessionNameHistory: updated });
      },

      saveSessionConfig: (name, cwd) => {
        const trimmed = name.trim();
        if (!trimmed) return;

        const configs = get().sessionConfigs;
        set({
          sessionConfigs: {
            ...configs,
            [trimmed]: { cwd: cwd.trim() },
          },
        });
      },

      getSessionConfig: (name) => {
        const trimmed = name.trim();
        if (!trimmed) return undefined;
        return get().sessionConfigs[trimmed];
      },

      addQueuedMessage: (sessionId, content) => {
        const sessions = get().sessions;
        if (!sessions[sessionId]) return null;

        const queuedMessage: QueuedMessage = {
          id: `queued-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          content: content.trim(),
          timestamp: Date.now(),
        };

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessions[sessionId],
              queuedMessages: [...(sessions[sessionId].queuedMessages || []), queuedMessage],
            },
          },
        });

        return queuedMessage;
      },

      getNextQueuedMessage: (sessionId) => {
        const sessions = get().sessions;
        if (!sessions[sessionId]) return null;
        const queue = sessions[sessionId].queuedMessages || [];
        return queue.length > 0 ? queue[0] : null;
      },

      removeQueuedMessage: (sessionId, messageId) => {
        const sessions = get().sessions;
        if (!sessions[sessionId]) return;

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessions[sessionId],
              queuedMessages: (sessions[sessionId].queuedMessages || []).filter(m => m.id !== messageId),
            },
          },
        });
      },

      clearQueue: (sessionId) => {
        const sessions = get().sessions;
        if (!sessions[sessionId]) return;

        set({
          sessions: {
            ...sessions,
            [sessionId]: {
              ...sessions[sessionId],
              queuedMessages: [],
            },
          },
        });
      },

      // Chat conversation actions
      addChatMessage: (conversationId, message) => {
        const chatConversations = get().chatConversations;
        if (!chatConversations[conversationId]) {
          console.warn('[Store] addChatMessage: conversation not found:', conversationId);
          return;
        }

        const conversation = chatConversations[conversationId];

        // Check if message already exists (for streaming updates)
        const existingIndex = conversation.messages.findIndex(m => m.id === message.id);

        let newMessages: ChatMessage[];
        if (existingIndex >= 0) {
          newMessages = [...conversation.messages];
          newMessages[existingIndex] = message;
        } else {
          newMessages = [...conversation.messages, message];
        }

        set({
          chatConversations: {
            ...chatConversations,
            [conversationId]: { ...conversation, messages: newMessages },
          },
        });
      },

      setChatState: (conversationId, state) => {
        const chatConversations = get().chatConversations;
        if (!chatConversations[conversationId]) return;

        set({
          chatConversations: {
            ...chatConversations,
            [conversationId]: { ...chatConversations[conversationId], state },
          },
        });
      },
    }),
    {
      name: 'expertly-vibecode-storage',
      partialize: (state) => ({
        widgets: state.widgets,
        layout: state.layout,
        sessions: state.sessions,
        sessionNameHistory: state.sessionNameHistory,
        sessionConfigs: state.sessionConfigs,
        chatConversations: state.chatConversations,
      }),
    }
  )
);
