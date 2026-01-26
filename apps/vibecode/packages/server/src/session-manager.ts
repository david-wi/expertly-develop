import { v4 as uuidv4 } from 'uuid';
import { ClaudeClient } from './claude-client.js';
import type { AgentManager } from './agent-manager.js';
import type {
  SessionState,
  SessionEvent,
  SessionOptions,
  ChatMessage,
  ExecutionMode
} from './types.js';

type EventCallback = (event: SessionEvent) => void;

// Global reference to agent manager (set by SessionManager)
let globalAgentManager: AgentManager | null = null;

export class Session {
  readonly id: string;
  readonly name: string;
  readonly cwd: string;
  private _state: SessionState = 'idle';
  private _messages: ChatMessage[] = [];
  private subscribers = new Map<string, EventCallback>();
  private client: ClaudeClient | null = null;
  private _executionMode: ExecutionMode;

  constructor(options: SessionOptions = {}) {
    this.id = uuidv4();
    this.name = options.name || 'New Session';
    this.cwd = options.cwd || process.cwd();
    this._executionMode = options.executionMode ||
      (process.env.DEFAULT_EXECUTION_MODE as ExecutionMode) || 'local';
    // Client is created lazily in sendLocal to pick up agent status
  }

  get state(): SessionState {
    return this._state;
  }

  get messages(): ChatMessage[] {
    return [...this._messages];
  }

  get executionMode(): ExecutionMode {
    return this._executionMode;
  }

  setExecutionMode(mode: ExecutionMode): void {
    if (this._state === 'busy') {
      throw new Error('Cannot change execution mode while session is busy');
    }
    this._executionMode = mode;

    // Recreate client for new mode
    if (mode === 'local' && !this.client) {
      this.client = new ClaudeClient({
        cwd: this.cwd,
        name: this.name
      });
    }
  }

  subscribe(clientId: string, callback: EventCallback): void {
    this.subscribers.set(clientId, callback);
  }

  unsubscribe(clientId: string): void {
    this.subscribers.delete(clientId);
  }

  private emit(event: SessionEvent): void {
    for (const callback of this.subscribers.values()) {
      try {
        callback(event);
      } catch (e) {
        console.error('[Session] Error in subscriber callback:', e);
      }
    }
  }

  private setState(state: SessionState): void {
    this._state = state;
    this.emit({
      type: 'state_changed',
      sessionId: this.id,
      state,
    });
  }

  private addMessage(message: ChatMessage): void {
    // Check if message already exists (for streaming updates)
    const existingIndex = this._messages.findIndex(m => m.id === message.id);
    if (existingIndex >= 0) {
      this._messages[existingIndex] = message;
    } else {
      this._messages.push(message);
    }

    this.emit({
      type: 'message',
      sessionId: this.id,
      message,
    });
  }

  async send(content: string): Promise<void> {
    if (this._state === 'busy') {
      throw new Error('Session is busy');
    }

    // Add user message
    const userMessage: ChatMessage = {
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    };
    this.addMessage(userMessage);

    if (this._executionMode === 'local') {
      await this.sendLocal(content);
    } else {
      await this.sendRemote(content);
    }
  }

  private async sendLocal(content: string): Promise<void> {
    if (!this.client) {
      const sessionId = this.id;
      // Use provider so agent connection is checked dynamically on each tool call
      const toolExecutorProvider = () => {
        if (globalAgentManager?.hasConnectedAgent()) {
          return async (tool: string, input: Record<string, unknown>, cwd: string) => {
            return globalAgentManager!.executeToolOnAgent(tool, input, cwd, sessionId);
          };
        }
        return undefined; // Use built-in executor
      };

      this.client = new ClaudeClient({
        cwd: this.cwd,
        name: this.name,
        toolExecutorProvider
      });
    }

    await this.client.sendMessage(
      content,
      (message) => this.addMessage(message),
      (state) => this.setState(state)
    );
  }

  private async sendRemote(content: string): Promise<void> {
    const remoteUrl = process.env.REMOTE_SERVER_URL;
    if (!remoteUrl) {
      this.addMessage({
        id: uuidv4(),
        role: 'system',
        content: 'Error: Remote server URL not configured. Set REMOTE_SERVER_URL environment variable.',
        timestamp: Date.now()
      });
      this.setState('error');
      return;
    }

    this.setState('busy');

    try {
      // Connect to remote server and proxy the request
      const response = await fetch(`${remoteUrl}/api/chat`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          sessionId: this.id,
          content,
          cwd: this.cwd
        })
      });

      if (!response.ok) {
        throw new Error(`Remote server error: ${response.statusText}`);
      }

      const result = await response.json() as { messages: ChatMessage[] };
      for (const message of result.messages) {
        this.addMessage(message);
      }

      this.setState('idle');
    } catch (error) {
      console.error('[Session] Remote execution error:', error);
      this.addMessage({
        id: uuidv4(),
        role: 'system',
        content: `Remote execution error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      });
      this.setState('error');
    }
  }

  interrupt(): void {
    if (this.client) {
      this.client.abort();
    }
    this.setState('idle');
  }

  close(): void {
    this.interrupt();
    this.setState('disconnected');
    this.subscribers.clear();
  }
}

export class SessionManager {
  private sessions = new Map<string, Session>();

  constructor(agentManager?: AgentManager) {
    if (agentManager) {
      globalAgentManager = agentManager;
    }
  }

  async createSession(options: SessionOptions = {}): Promise<Session> {
    const session = new Session(options);
    this.sessions.set(session.id, session);
    return session;
  }

  getSession(sessionId: string): Session | undefined {
    return this.sessions.get(sessionId);
  }

  listSessions(): Session[] {
    return Array.from(this.sessions.values());
  }

  getSessionCount(): number {
    return this.sessions.size;
  }

  closeSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (session) {
      session.close();
      this.sessions.delete(sessionId);
    }
  }

  unsubscribeClient(clientId: string): void {
    for (const session of this.sessions.values()) {
      session.unsubscribe(clientId);
    }
  }
}
