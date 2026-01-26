import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import { fileURLToPath } from 'url';
import Anthropic from '@anthropic-ai/sdk';
import { SessionManager } from './session-manager.js';
import { agentManager } from './agent-manager.js';
import type { ExecutionMode, ChatMessage, ImageAttachment } from './types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;
const isProduction = process.env.NODE_ENV === 'production';

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const sessionManager = new SessionManager(agentManager);

// Middleware
app.use(express.json());

// CORS for development
app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'ok', sessions: sessionManager.getSessionCount() });
});

// Ready check endpoint
app.get('/ready', (_, res) => {
  res.json({ ready: true });
});

// API endpoint for remote execution
app.post('/api/chat', async (req, res) => {
  try {
    const { sessionId, content, cwd } = req.body;

    let session = sessionManager.getSession(sessionId);
    if (!session) {
      session = await sessionManager.createSession({
        cwd,
        executionMode: 'local' // Remote endpoint always executes locally
      });
    }

    // Collect messages during execution
    const messages: unknown[] = [];
    const clientId = uuidv4();

    session.subscribe(clientId, (event) => {
      if (event.type === 'message' && event.message) {
        messages.push(event.message);
      }
    });

    await session.send(content);
    session.unsubscribe(clientId);

    res.json({ messages });
  } catch (error) {
    console.error('[API] Chat error:', error);
    res.status(500).json({
      error: error instanceof Error ? error.message : 'Unknown error'
    });
  }
});

// Serve static files in production
if (isProduction) {
  const clientDist = path.resolve(__dirname, '../../client/dist');
  app.use(express.static(clientDist));
  app.get('*', (_, res) => {
    res.sendFile(path.join(clientDist, 'index.html'));
  });
}

// Broadcast agent status to all connected clients (excluding agents)
function broadcastAgentStatus() {
  const status = {
    type: 'agent_status',
    hasAgent: agentManager.hasConnectedAgent(),
    agents: agentManager.getAgentDetails(),
  };
  wss.clients.forEach(client => {
    // Don't send to agents
    if (client.readyState === WebSocket.OPEN && !agentManager.findAgentBySocket(client)) {
      client.send(JSON.stringify(status));
    }
  });
}

// Broadcast agent metrics update to all connected clients
function broadcastAgentMetrics() {
  const status = {
    type: 'agent_metrics',
    agents: agentManager.getAgentDetails(),
  };
  wss.clients.forEach(client => {
    if (client.readyState === WebSocket.OPEN && !agentManager.findAgentBySocket(client)) {
      client.send(JSON.stringify(status));
    }
  });
}

// WebSocket connection handling
wss.on('connection', (ws: WebSocket) => {
  const clientId = uuidv4();
  console.log(`[WS] Client connected: ${clientId}`);

  ws.on('message', async (data: Buffer) => {
    try {
      const message = JSON.parse(data.toString());
      console.log(`[WS] Received from ${clientId}:`, message.type);

      switch (message.type) {
        case 'create_session': {
          const { cwd, prompt, name, executionMode } = message;
          // Use /workspace as default - this runs on the SERVER, not user's local machine
          const workingDir = cwd && cwd.startsWith('/workspace') ? cwd : '/workspace';
          const session = await sessionManager.createSession({
            cwd: workingDir,
            name: name || 'New Session',
            executionMode: executionMode as ExecutionMode | undefined,
          });

          // Subscribe this client to the session
          session.subscribe(clientId, (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(event));
            }
          });

          // Send confirmation
          ws.send(JSON.stringify({
            type: 'session_created',
            sessionId: session.id,
            name: session.name,
            cwd: session.cwd,
            executionMode: session.executionMode,
          }));

          // If there's an initial prompt, send it
          if (prompt) {
            await session.send(prompt);
          }
          break;
        }

        case 'chat': {
          const { sessionId, content } = message;
          const session = sessionManager.getSession(sessionId);
          if (!session) {
            ws.send(JSON.stringify({
              type: 'error',
              sessionId,
              error: 'Session not found',
            }));
            return;
          }
          await session.send(content);
          break;
        }

        case 'interrupt': {
          const { sessionId } = message;
          const session = sessionManager.getSession(sessionId);
          if (session) {
            session.interrupt();
          }
          break;
        }

        case 'subscribe': {
          const { sessionId } = message;
          const session = sessionManager.getSession(sessionId);
          if (!session) {
            ws.send(JSON.stringify({
              type: 'error',
              sessionId,
              error: 'Session not found',
            }));
            return;
          }
          session.subscribe(clientId, (event) => {
            if (ws.readyState === WebSocket.OPEN) {
              ws.send(JSON.stringify(event));
            }
          });
          // Send current state
          ws.send(JSON.stringify({
            type: 'session_state',
            sessionId: session.id,
            name: session.name,
            state: session.state,
            executionMode: session.executionMode,
            messages: session.messages,
          }));
          break;
        }

        case 'set_execution_mode': {
          const { sessionId, executionMode } = message;
          const session = sessionManager.getSession(sessionId);
          if (!session) {
            ws.send(JSON.stringify({
              type: 'error',
              sessionId,
              error: 'Session not found',
            }));
            return;
          }
          try {
            session.setExecutionMode(executionMode as ExecutionMode);
            ws.send(JSON.stringify({
              type: 'execution_mode_changed',
              sessionId,
              executionMode: session.executionMode,
            }));
          } catch (error) {
            ws.send(JSON.stringify({
              type: 'error',
              sessionId,
              error: error instanceof Error ? error.message : 'Unknown error',
            }));
          }
          break;
        }

        case 'list_sessions': {
          const sessions = sessionManager.listSessions();
          ws.send(JSON.stringify({
            type: 'sessions_list',
            sessions: sessions.map(s => ({
              id: s.id,
              name: s.name,
              state: s.state,
              cwd: s.cwd,
              executionMode: s.executionMode,
            })),
          }));
          break;
        }

        case 'close_session': {
          const { sessionId } = message;
          sessionManager.closeSession(sessionId);
          ws.send(JSON.stringify({
            type: 'session_closed',
            sessionId,
          }));
          break;
        }

        // Agent registration
        case 'agent_register': {
          const { workingDir, platform, version, systemInfo } = message;
          const agentId = agentManager.registerAgent(ws, workingDir, platform, version, systemInfo);
          ws.send(JSON.stringify({
            type: 'agent_registered',
            agentId,
          }));
          // Notify all clients that an agent connected
          broadcastAgentStatus();
          break;
        }

        // Agent tool response
        case 'tool_response': {
          const { requestId, result, error } = message;
          agentManager.handleToolResponse(requestId, result, error);
          break;
        }

        // Agent status update (periodic metrics from agent)
        case 'agent_status_update': {
          const { metrics } = message;
          agentManager.updateAgentMetrics(ws, metrics);
          // Broadcast updated metrics to all clients
          broadcastAgentMetrics();
          break;
        }

        // Tool was queued by agent
        case 'tool_queued': {
          // Forward to all clients - they can filter by sessionId
          const { requestId, sessionId, queuePosition, reason } = message;
          wss.clients.forEach(client => {
            if (client.readyState === WebSocket.OPEN && !agentManager.findAgentBySocket(client)) {
              client.send(JSON.stringify({
                type: 'tool_queued',
                requestId,
                sessionId,
                queuePosition,
                reason
              }));
            }
          });
          break;
        }

        // Get agent status
        case 'get_agent_status': {
          ws.send(JSON.stringify({
            type: 'agent_status',
            hasAgent: agentManager.hasConnectedAgent(),
            agents: agentManager.getAgentDetails(),
          }));
          break;
        }

        // Direct chat (no tools, no session)
        case 'direct_chat': {
          const { conversationId, content, history, images } = message;
          console.log(`[WS] Direct chat for conversation: ${conversationId}${images?.length ? ` with ${images.length} image(s)` : ''}`);

          try {
            // Notify client that we're processing
            ws.send(JSON.stringify({
              type: 'chat_state_changed',
              conversationId,
              state: 'busy',
            }));

            const anthropic = new Anthropic();

            // Helper to build message content with images
            const buildMessageContent = (msg: ChatMessage): Anthropic.ContentBlockParam[] | string => {
              if (!msg.images || msg.images.length === 0) {
                return msg.content;
              }

              // Build multimodal content with images first, then text
              const contentBlocks: Anthropic.ContentBlockParam[] = [];

              for (const img of msg.images) {
                contentBlocks.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: img.mediaType,
                    data: img.data,
                  },
                });
              }

              if (msg.content) {
                contentBlocks.push({
                  type: 'text',
                  text: msg.content,
                });
              }

              return contentBlocks;
            };

            // Build messages from history
            const messages: Anthropic.MessageParam[] = (history || [])
              .filter((m: ChatMessage) => m.role === 'user' || m.role === 'assistant')
              .map((m: ChatMessage) => ({
                role: m.role as 'user' | 'assistant',
                content: buildMessageContent(m),
              }));

            // Add the new user message with any attached images
            const newMessageContent: Anthropic.ContentBlockParam[] = [];

            // Add images first
            if (images && images.length > 0) {
              for (const img of images as ImageAttachment[]) {
                newMessageContent.push({
                  type: 'image',
                  source: {
                    type: 'base64',
                    media_type: img.mediaType,
                    data: img.data,
                  },
                });
              }
            }

            // Add text content
            if (content) {
              newMessageContent.push({
                type: 'text',
                text: content,
              });
            }

            messages.push({
              role: 'user',
              content: newMessageContent.length > 0 ? newMessageContent : content || '',
            });

            const response = await anthropic.messages.create({
              model: 'claude-sonnet-4-20250514',
              max_tokens: 4096,
              system: 'You are a helpful AI assistant. You do not have access to any tools or file system. Provide helpful, concise responses to the user\'s questions.',
              messages,
            });

            // Extract text content from response
            let responseText = '';
            for (const block of response.content) {
              if (block.type === 'text') {
                responseText += block.text;
              }
            }

            // Send the assistant message
            ws.send(JSON.stringify({
              type: 'chat_message',
              conversationId,
              message: {
                id: uuidv4(),
                role: 'assistant',
                content: responseText,
                timestamp: Date.now(),
              },
            }));

            // Notify client we're done
            ws.send(JSON.stringify({
              type: 'chat_state_changed',
              conversationId,
              state: 'idle',
            }));
          } catch (error) {
            console.error('[WS] Direct chat error:', error);
            ws.send(JSON.stringify({
              type: 'chat_message',
              conversationId,
              message: {
                id: uuidv4(),
                role: 'system',
                content: `Error: ${error instanceof Error ? error.message : 'Unknown error'}`,
                timestamp: Date.now(),
              },
            }));
            ws.send(JSON.stringify({
              type: 'chat_state_changed',
              conversationId,
              state: 'error',
            }));
          }
          break;
        }

        default:
          console.warn(`[WS] Unknown message type: ${message.type}`);
      }
    } catch (error) {
      console.error('[WS] Error processing message:', error);
      ws.send(JSON.stringify({
        type: 'error',
        error: error instanceof Error ? error.message : 'Unknown error',
      }));
    }
  });

  ws.on('close', () => {
    console.log(`[WS] Client disconnected: ${clientId}`);
    sessionManager.unsubscribeClient(clientId);

    // Check if this was an agent
    const agent = agentManager.findAgentBySocket(ws);
    if (agent) {
      agentManager.unregisterAgent(agent.id);
      broadcastAgentStatus();
    }
  });

  ws.on('error', (error) => {
    console.error(`[WS] Client error ${clientId}:`, error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    version: '0.1.0',
    defaultExecutionMode: process.env.DEFAULT_EXECUTION_MODE || 'local',
    remoteAvailable: !!process.env.REMOTE_SERVER_URL,
    hasLocalAgent: agentManager.hasConnectedAgent(),
  }));
});

server.listen(PORT, () => {
  console.log(`
+===========================================================+
|           Expertly Vibecode Server v0.1.0                 |
+===========================================================+
|  WebSocket:  ws://localhost:${PORT}                          |
|  Health:     http://localhost:${PORT}/health                 |
|  Mode:       ${isProduction ? 'Production' : 'Development'}                                |
+===========================================================+
  `);
});
