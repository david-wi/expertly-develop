# CLAUDE.md - Expertly Vibecode

Please review additional general instructions at /Users/david/Code/_common/CLAUDE.md, requesting access if needed.

## Project Overview

**Expertly Vibecode** is a web-based dashboard for managing multiple Claude Code agent sessions. It replaces noisy terminal windows with clean, draggable chat widgets.

### Key Features
- Multi-session management with draggable/resizable widgets
- Real-time streaming of Claude responses
- **Hybrid execution**: Each widget can run locally OR on a remote server
- Status indicators for at-a-glance monitoring
- Layout persistence across sessions

## Why Node.js (Not Python)

This is intentional. Vibecode's architecture benefits from Node.js:

- **Real-time WebSocket streaming** - Core feature is streaming Claude responses to multiple browser clients. Node's event-driven model handles concurrent WebSocket connections efficiently.
- **Full-stack TypeScript** - Same language across React frontend, Express backend, and Tauri desktop agent. Shared types reduce bugs at client/server boundary.
- **Event-driven architecture** - The app is fundamentally event-based (messages, broadcasts, tool execution callbacks). Maps naturally to Node's execution model.
- **Tool execution bridge** - Server receives tool requests from Claude API, executes locally via `child_process`, returns results. Straightforward in Node.
- **Lightweight deployment** - `node:20-slim` image is ~150MB vs Python at 200-300MB+.

## Architecture

```
packages/
├── server/          # WebSocket server + Claude API integration
│   └── src/
│       ├── index.ts           # Express + WebSocket server
│       ├── session-manager.ts # Session lifecycle management
│       ├── claude-client.ts   # Anthropic SDK integration with tools
│       └── types.ts           # Shared type definitions
└── client/          # React dashboard
    └── src/
        ├── App.tsx
        ├── components/        # React components
        ├── hooks/             # useWebSocket hook
        └── store/             # Zustand store
```

## Development

```bash
# Install dependencies
npm install

# Run both server and client
npm run dev

# Server only (port 3001)
npm run dev:server

# Client only (port 5173)
npm run dev:client
```

## Environment Variables

- `ANTHROPIC_API_KEY` - Required for Claude API access
- `PORT` - Server port (default: 3001)
- `REMOTE_SERVER_URL` - Optional URL for remote execution server
- `DEFAULT_EXECUTION_MODE` - 'local' or 'remote' (default: local)

## Deployment

### Local Development
```bash
npm run dev
# Open http://localhost:5173
```

### Docker
```bash
docker-compose up --build
```

### Coolify (Production)
Use `docker-compose.prod.yml` with Coolify dashboard.

## Hybrid Execution

Each widget can be configured to run either locally or remotely:
- **Local**: Processing happens on your machine
- **Remote**: Processing happens on a configured remote server

This allows mixing:
- Keep heavy tasks on a powerful remote server
- Run quick tasks locally for lower latency
