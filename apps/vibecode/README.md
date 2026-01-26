# Expertly Vibecode

A web-based dashboard for managing multiple Claude Code agent sessions. Replace noisy terminal windows with clean, draggable chat widgets.

## Why?

When vibecoding with Claude Code across multiple terminals:
- Visual noise: Terminal output is distracting when focusing on other work
- Limited UI: Terminals have poor rendering and hard-to-read scrollback
- No overview: Hard to see status of all running tasks at a glance
- Context switching: Each terminal is a separate window to manage

**Expertly Vibecode** gives you a single browser tab with draggable, resizable widgets - each connected to a Claude Code session. Minimize widgets to tiny status indicators when you don't need to see the details.

## Features

- **Multi-session management** - Run parallel Claude Code tasks
- **Draggable/resizable widgets** - Organize your workspace
- **Real-time streaming** - See Claude's responses as they come in
- **Status indicators** - Know at a glance which sessions need attention
- **Minimize widgets** - Reduce distractions while tasks run
- **Persist layout** - Your widget arrangement survives page refresh
- **Hybrid execution** - Run processing locally OR on a remote server per widget

## Prerequisites

- Node.js 20+
- `ANTHROPIC_API_KEY` environment variable set

## Quick Start

```bash
# Clone the repo
git clone <your-repo-url>
cd expertly-vibecode

# Install dependencies
npm install

# Copy environment file
cp .env.example .env
# Edit .env and add your ANTHROPIC_API_KEY

# Start both server and client
npm run dev
```

Then open http://localhost:5173

## Architecture

```
+-------------------------------------------------------------+
|  Browser (localhost:5173)                                   |
|  +---------+ +---------+ +---------+                        |
|  |Widget 1 | |Widget 2 | |Widget 3 | ...                    |
|  | Local   | | Remote  | | Local   |                        |
|  +---------+ +---------+ +---------+                        |
+---------|---------|---------|-------------------------------+
          |         |         |  WebSocket
          v         |         v
+-----------------+ | +-----------------------------------------+
| Local Server    | | | Remote Server (optional)                |
| localhost:3001  | | | your-server:3001                        |
+-----------------+ | +-----------------------------------------+
          |         |         |
          v         v         v
            Claude API (Anthropic)
```

### Hybrid Execution

Each widget can be configured to run either:
- **Local**: Processing happens on your machine (default)
- **Remote**: Processing happens on a configured remote server

This allows you to:
- Keep heavy tasks on a powerful remote server
- Run quick tasks locally for lower latency
- Mix and match based on your needs

## Development

```bash
# Run server only
npm run dev:server

# Run client only
npm run dev:client

# Build for production
npm run build
```

## Docker Deployment

```bash
# Build and run with docker-compose
docker-compose up --build

# For production (on Coolify or similar)
docker-compose -f docker-compose.prod.yml up --build
```

## Configuration

### Server

Set environment variables or create a `.env` file:

```bash
PORT=3001                    # WebSocket server port
ANTHROPIC_API_KEY=sk-...     # Your API key
REMOTE_SERVER_URL=           # Optional: URL of remote execution server
DEFAULT_EXECUTION_MODE=local # 'local' or 'remote'
```

### Client

The client connects to `ws://localhost:3001` in development. For production, configure via environment.

## Roadmap

- [ ] Rich message rendering (markdown, syntax highlighting)
- [ ] Collapsible tool use sections
- [ ] Keyboard shortcuts
- [ ] Browser notifications when attention needed
- [ ] Session templates
- [ ] Cost tracking per session

## Built With

- [Anthropic SDK](https://github.com/anthropics/anthropic-sdk-typescript) - Claude API integration
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) - Draggable/resizable grid
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## License

MIT
