import 'dotenv/config';
import express from 'express';
import { createServer } from 'http';
import { WebSocketServer, WebSocket } from 'ws';
import { v4 as uuidv4 } from 'uuid';
import { SessionManager } from './session-manager.js';

const PORT = process.env.PORT ? parseInt(process.env.PORT) : 3001;

const app = express();
const server = createServer(app);
const wss = new WebSocketServer({ server });

const sessionManager = new SessionManager();

// Health check endpoint
app.get('/health', (_, res) => {
  res.json({ status: 'ok', sessions: sessionManager.getSessionCount() });
});

// CORS for development
app.use((_, res, next) => {
  res.header('Access-Control-Allow-Origin', '*');
  res.header('Access-Control-Allow-Headers', 'Origin, X-Requested-With, Content-Type, Accept');
  next();
});

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
          const { cwd, prompt, name } = message;
          const session = await sessionManager.createSession({
            cwd: cwd || process.cwd(),
            name: name || 'New Session',
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
            messages: session.messages,
          }));
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
    // Unsubscribe from all sessions
    sessionManager.unsubscribeClient(clientId);
  });

  ws.on('error', (error) => {
    console.error(`[WS] Client error ${clientId}:`, error);
  });

  // Send welcome message
  ws.send(JSON.stringify({
    type: 'connected',
    clientId,
    version: '0.1.0',
  }));
});

server.listen(PORT, () => {
  console.log(`
╔═══════════════════════════════════════════════════════════╗
║            Claude Cowork Dash Server v0.1.0               ║
╠═══════════════════════════════════════════════════════════╣
║  WebSocket:  ws://localhost:${PORT}                          ║
║  Health:     http://localhost:${PORT}/health                 ║
╚═══════════════════════════════════════════════════════════╝
  `);
});
