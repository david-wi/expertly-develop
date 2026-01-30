import Anthropic from '@anthropic-ai/sdk';
import { v4 as uuidv4 } from 'uuid';
import type { ChatMessage, SessionOptions } from './types.js';
import { getModelForUseCase } from './ai-config.js';

// Tool definitions for Claude Code-like functionality
const TOOL_DEFINITIONS: Anthropic.Tool[] = [
  {
    name: 'read_file',
    description: 'Read the contents of a file at the specified path',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to read'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'write_file',
    description: 'Write content to a file at the specified path',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The path to the file to write'
        },
        content: {
          type: 'string',
          description: 'The content to write to the file'
        }
      },
      required: ['path', 'content']
    }
  },
  {
    name: 'list_files',
    description: 'List files in a directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        path: {
          type: 'string',
          description: 'The directory path to list'
        },
        pattern: {
          type: 'string',
          description: 'Optional glob pattern to filter files'
        }
      },
      required: ['path']
    }
  },
  {
    name: 'run_command',
    description: 'Run a shell command in the working directory',
    input_schema: {
      type: 'object' as const,
      properties: {
        command: {
          type: 'string',
          description: 'The command to run'
        }
      },
      required: ['command']
    }
  },
  {
    name: 'search_files',
    description: 'Search for a pattern in files',
    input_schema: {
      type: 'object' as const,
      properties: {
        pattern: {
          type: 'string',
          description: 'The regex pattern to search for'
        },
        path: {
          type: 'string',
          description: 'The directory to search in'
        }
      },
      required: ['pattern']
    }
  }
];

// Tool executor (runs tools locally)
import { execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import { glob } from 'glob';

async function executeTool(
  name: string,
  input: Record<string, unknown>,
  cwd: string
): Promise<string> {
  try {
    switch (name) {
      case 'read_file': {
        const filePath = path.resolve(cwd, input.path as string);
        if (!fs.existsSync(filePath)) {
          return `Error: File not found: ${filePath}`;
        }
        return fs.readFileSync(filePath, 'utf-8');
      }

      case 'write_file': {
        const filePath = path.resolve(cwd, input.path as string);
        const dir = path.dirname(filePath);
        if (!fs.existsSync(dir)) {
          fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(filePath, input.content as string, 'utf-8');
        return `Successfully wrote to ${filePath}`;
      }

      case 'list_files': {
        const dirPath = path.resolve(cwd, input.path as string);
        const pattern = input.pattern as string || '*';
        console.log(`[Tool] Listing files: ${pattern} in ${dirPath}`);
        if (!fs.existsSync(dirPath)) {
          return `Error: Directory not found: ${dirPath}`;
        }
        const files = await glob(pattern, { cwd: dirPath });
        return files.length > 0 ? files.join('\n') : '(no files found)';
      }

      case 'run_command': {
        const command = input.command as string;
        console.log(`[Tool] Running command: ${command} in ${cwd}`);
        const result = execSync(command, {
          cwd,
          encoding: 'utf-8',
          maxBuffer: 10 * 1024 * 1024,
          timeout: 60000,
          shell: '/bin/bash'
        });
        return result || '(command completed with no output)';
      }

      case 'search_files': {
        const searchPath = path.resolve(cwd, (input.path as string) || '.');
        const pattern = input.pattern as string;
        console.log(`[Tool] Searching for: ${pattern} in ${searchPath}`);
        try {
          const result = execSync(`grep -r "${pattern}" "${searchPath}" --include="*" -l 2>/dev/null || true`, {
            encoding: 'utf-8',
            maxBuffer: 10 * 1024 * 1024,
            shell: '/bin/bash'
          });
          return result || 'No matches found';
        } catch {
          return 'No matches found';
        }
      }

      default:
        return `Unknown tool: ${name}`;
    }
  } catch (error) {
    return `Error: ${error instanceof Error ? error.message : 'Unknown error'}`;
  }
}

export type MessageCallback = (message: ChatMessage) => void;
export type StateCallback = (state: 'idle' | 'busy' | 'error') => void;

export interface ConversationContext {
  messages: Anthropic.MessageParam[];
}

export type ToolExecutor = (
  tool: string,
  input: Record<string, unknown>,
  cwd: string
) => Promise<string>;

export type ToolExecutorProvider = () => ToolExecutor | undefined;

export interface ClaudeClientOptions extends SessionOptions {
  toolExecutor?: ToolExecutor;
  toolExecutorProvider?: ToolExecutorProvider;
}

export class ClaudeClient {
  private client: Anthropic;
  private model: string;
  private maxTokens: number;
  private cwd: string;
  private abortController: AbortController | null = null;
  private context: ConversationContext = { messages: [] };
  private toolExecutor: ToolExecutor | undefined;
  private toolExecutorProvider: ToolExecutorProvider | undefined;
  private modelConfigPromise: Promise<void> | null = null;

  constructor(options: ClaudeClientOptions) {
    this.client = new Anthropic();
    // Use provided model or default; will be updated from config asynchronously
    this.model = options.model || 'claude-sonnet-4-0-latest';
    this.maxTokens = 8192;
    this.cwd = options.cwd || process.cwd();
    // Use custom executor if provided, otherwise use built-in
    this.toolExecutor = options.toolExecutor;
    this.toolExecutorProvider = options.toolExecutorProvider;

    // Fetch model config asynchronously (don't await in constructor)
    this.modelConfigPromise = this.initModelConfig();
  }

  private async initModelConfig(): Promise<void> {
    try {
      const config = await getModelForUseCase('code_session');
      this.model = config.model_id;
      this.maxTokens = config.max_tokens;
      console.log(`[ClaudeClient] Using model ${this.model} from config`);
    } catch (error) {
      console.warn('[ClaudeClient] Failed to fetch model config, using defaults:', error);
    }
  }

  private async ensureModelConfig(): Promise<void> {
    if (this.modelConfigPromise) {
      await this.modelConfigPromise;
      this.modelConfigPromise = null;
    }
  }

  private getToolExecutor(): ToolExecutor {
    // Check provider first (for dynamic agent connection)
    if (this.toolExecutorProvider) {
      const provided = this.toolExecutorProvider();
      if (provided) return provided;
    }
    // Fall back to static executor or built-in
    return this.toolExecutor || ((tool, input, cwd) => executeTool(tool, input, cwd));
  }

  async sendMessage(
    content: string,
    onMessage: MessageCallback,
    onState: StateCallback
  ): Promise<void> {
    // Ensure model config is loaded
    await this.ensureModelConfig();

    this.abortController = new AbortController();
    onState('busy');

    // Add user message to context
    this.context.messages.push({
      role: 'user',
      content
    });

    try {
      let continueLoop = true;

      while (continueLoop) {
        const response = await this.client.messages.create({
          model: this.model,
          max_tokens: this.maxTokens,
          system: `You are a helpful coding assistant running in a server-side Docker container. You have access to tools to read/write files, run commands, and search code. The working directory is: ${this.cwd}

Important: You are running on a remote server, not on the user's local machine. Files you create or modify exist in the server's /workspace directory. If the user asks you to work on their local files, explain that you cannot access their local machine directly - they would need to upload files or clone a repository to the workspace.`,
          tools: TOOL_DEFINITIONS,
          messages: this.context.messages
        });

        // Process the response
        let assistantContent: Anthropic.ContentBlock[] = [];
        let hasToolUse = false;

        for (const block of response.content) {
          assistantContent.push(block);

          if (block.type === 'text') {
            onMessage({
              id: uuidv4(),
              role: 'assistant',
              content: block.text,
              timestamp: Date.now()
            });
          } else if (block.type === 'tool_use') {
            hasToolUse = true;

            // Report tool use to UI
            onMessage({
              id: uuidv4(),
              role: 'assistant',
              content: `Using tool: ${block.name}`,
              timestamp: Date.now(),
              toolUse: {
                name: block.name,
                input: block.input
              }
            });

            // Execute the tool (via agent if available, otherwise locally)
            const executor = this.getToolExecutor();
            const toolResult = await executor(
              block.name,
              block.input as Record<string, unknown>,
              this.cwd
            );

            // Add assistant response and tool result to context
            this.context.messages.push({
              role: 'assistant',
              content: assistantContent
            });

            this.context.messages.push({
              role: 'user',
              content: [{
                type: 'tool_result',
                tool_use_id: block.id,
                content: toolResult
              }]
            });

            // Report tool result
            onMessage({
              id: uuidv4(),
              role: 'system',
              content: `Tool result: ${toolResult.substring(0, 500)}${toolResult.length > 500 ? '...' : ''}`,
              timestamp: Date.now()
            });

            // Reset for next iteration
            assistantContent = [];
          }
        }

        // If no tool use, add the assistant message to context and exit loop
        if (!hasToolUse) {
          this.context.messages.push({
            role: 'assistant',
            content: assistantContent
          });
          continueLoop = false;
        }

        // Check for end conditions
        if (response.stop_reason === 'end_turn' && !hasToolUse) {
          continueLoop = false;
        }
      }

      onState('idle');
    } catch (error) {
      console.error('[ClaudeClient] Error:', error);
      onMessage({
        id: uuidv4(),
        role: 'system',
        content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
        timestamp: Date.now()
      });
      onState('error');
    } finally {
      this.abortController = null;
    }
  }

  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  getMessages(): ChatMessage[] {
    return this.context.messages.map((msg, i) => ({
      id: `ctx-${i}`,
      role: msg.role as 'user' | 'assistant' | 'system',
      content: typeof msg.content === 'string'
        ? msg.content
        : JSON.stringify(msg.content),
      timestamp: Date.now()
    }));
  }
}
