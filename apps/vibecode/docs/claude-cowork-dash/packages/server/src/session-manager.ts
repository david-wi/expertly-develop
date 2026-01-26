import { v4 as uuidv4 } from 'uuid';
import { query, type SDKMessage } from '@anthropic-ai/claude-agent-sdk';

export type SessionState = 'idle' | 'busy' | 'waiting' | 'error' | 'disconnected';

export interface SessionEvent {
  type: 'message' | 'state_changed' | 'error';
  sessionId: string;
  message?: ChatMessage;
  state?: SessionState;
  error?: string;
}

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

type EventCallback = (event: SessionEvent) => void;

export interface SessionOptions {
  cwd?: string;
  name?: string;
  model?: string;
  allowedTools?: string[];
}

export class Session {
  readonly id: string;
  readonly name: string;
  readonly cwd: string;
  private _state: SessionState = 'idle';
  private _messages: ChatMessage[] = [];
  private subscribers = new Map<string, EventCallback>();
  private abortController: AbortController | null = null;
  private model: string;
  private allowedTools: string[];

  constructor(options: SessionOptions = {}) {
    this.id = uuidv4();
    this.name = options.name || 'New Session';
    this.cwd = options.cwd || process.cwd();
    this.model = options.model || 'claude-sonnet-4-5-20250929';
    this.allowedTools = options.allowedTools || ['Read', 'Write', 'Edit', 'Bash', 'Glob', 'Grep'];
  }

  get state(): SessionState {
    return this._state;
  }

  get messages(): ChatMessage[] {
    return [...this._messages];
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
    this._messages.push(message);
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
    this.addMessage({
      id: uuidv4(),
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    this.setState('busy');
    this.abortController = new AbortController();

    try {
      let assistantContent = '';
      let currentMessageId = uuidv4();

      const q = query({
        prompt: content,
        options: {
          cwd: this.cwd,
          model: this.model,
          allowedTools: this.allowedTools,
          permissionMode: 'acceptEdits', // Auto-accept file edits
          abortController: this.abortController,
        },
      });

      for await (const message of q) {
        if (this.abortController.signal.aborted) {
          break;
        }

        // Handle different message types from SDK
        if (message.type === 'assistant') {
          // Extract text content
          for (const block of message.message.content) {
            if (block.type === 'text') {
              assistantContent += block.text;
              // Stream update
              this.addMessage({
                id: currentMessageId,
                role: 'assistant',
                content: assistantContent,
                timestamp: Date.now(),
              });
            } else if (block.type === 'tool_use') {
              // Tool invocation
              this.addMessage({
                id: uuidv4(),
                role: 'assistant',
                content: `Using tool: ${block.name}`,
                timestamp: Date.now(),
                toolUse: {
                  name: block.name,
                  input: block.input,
                },
              });
            }
          }
        } else if (message.type === 'result') {
          // Final result
          if (message.result && assistantContent !== message.result) {
            assistantContent = message.result;
            this.addMessage({
              id: currentMessageId,
              role: 'assistant',
              content: assistantContent,
              timestamp: Date.now(),
            });
          }
        }
      }

      this.setState('idle');
    } catch (error) {
      console.error('[Session] Error during query:', error);
      this.setState('error');
      this.emit({
        type: 'error',
        sessionId: this.id,
        error: error instanceof Error ? error.message : 'Unknown error',
      });
    } finally {
      this.abortController = null;
    }
  }

  interrupt(): void {
    if (this.abortController) {
      this.abortController.abort();
      this.setState('idle');
    }
  }

  close(): void {
    this.interrupt();
    this.setState('disconnected');
    this.subscribers.clear();
  }
}

export class SessionManager {
  private sessions = new Map<string, Session>();

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
