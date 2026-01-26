export type SessionState = 'idle' | 'busy' | 'waiting' | 'error' | 'disconnected';
export type ExecutionMode = 'local' | 'remote';

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

export interface SessionEvent {
  type: 'message' | 'state_changed' | 'error';
  sessionId: string;
  message?: ChatMessage;
  state?: SessionState;
  error?: string;
}

export type ToolExecutor = (
  tool: string,
  input: Record<string, unknown>,
  cwd: string
) => Promise<string>;

export interface SessionOptions {
  cwd?: string;
  name?: string;
  model?: string;
  executionMode?: ExecutionMode;
  allowedTools?: string[];
  toolExecutor?: ToolExecutor;
}

export interface SessionInfo {
  id: string;
  name: string;
  cwd: string;
  state: SessionState;
  executionMode: ExecutionMode;
}

// WebSocket message types
export interface WSMessage {
  type: string;
  [key: string]: unknown;
}

export interface CreateSessionMessage extends WSMessage {
  type: 'create_session';
  cwd?: string;
  name?: string;
  prompt?: string;
  executionMode?: ExecutionMode;
}

export interface ChatWSMessage extends WSMessage {
  type: 'chat';
  sessionId: string;
  content: string;
}

export interface InterruptMessage extends WSMessage {
  type: 'interrupt';
  sessionId: string;
}

export interface SubscribeMessage extends WSMessage {
  type: 'subscribe';
  sessionId: string;
}

export interface SetExecutionModeMessage extends WSMessage {
  type: 'set_execution_mode';
  sessionId: string;
  executionMode: ExecutionMode;
}
