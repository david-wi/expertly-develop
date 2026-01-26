# Claude Cowork Dash

A web-based dashboard for managing multiple Claude Code agent sessions. Replace noisy terminal windows with clean, draggable chat widgets.

![Screenshot placeholder]

## Why?

When vibecoding with Claude Code across multiple terminals:
- 🔇 **Visual noise**: Terminal output is distracting when focusing on other work
- 📺 **Limited UI**: Terminals have poor rendering and hard-to-read scrollback  
- 👁️ **No overview**: Hard to see status of all running tasks at a glance
- 🔀 **Context switching**: Each terminal is a separate window to manage

**Cowork Dash** gives you a single browser tab with draggable, resizable widgets - each connected to a Claude Code session. Minimize widgets to tiny status indicators when you don't need to see the details.

## Features

- ✅ **Multi-session management** - Run parallel Claude Code tasks
- ✅ **Draggable/resizable widgets** - Organize your workspace  
- ✅ **Real-time streaming** - See Claude's responses as they come in
- ✅ **Status indicators** - Know at a glance which sessions need attention
- ✅ **Minimize widgets** - Reduce distractions while tasks run
- ✅ **Persist layout** - Your widget arrangement survives page refresh

## Prerequisites

- Node.js 20+
- [Claude Code CLI](https://docs.anthropic.com/claude-code) installed
- `ANTHROPIC_API_KEY` environment variable set

## Quick Start

```bash
# Clone the repo
git clone <your-repo-url>
cd claude-cowork-dash

# Install dependencies
npm install

# Start both server and client
npm run dev
```

Then open http://localhost:5173

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│  Browser (localhost:5173)                                   │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │Widget 1 │ │Widget 2 │ │Widget 3 │ ...                   │
│  └────┬────┘ └────┬────┘ └────┬────┘                       │
└───────┼──────────┼──────────┼───────────────────────────────┘
        │          │          │  WebSocket
        └──────────┼──────────┘
                   ▼
┌─────────────────────────────────────────────────────────────┐
│  Server (localhost:3001)                                    │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  SessionManager                                       │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │  │Session 1 │ │Session 2 │ │Session 3 │             │  │
│  │  │Agent SDK │ │Agent SDK │ │Agent SDK │             │  │
│  │  └──────────┘ └──────────┘ └──────────┘             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                   │
                   ▼
            Claude API
```

## Development

```bash
# Run server only
npm run dev:server

# Run client only  
npm run dev:client

# Build for production
npm run build
```

## Configuration

### Server

Set environment variables or create a `.env` file:

```bash
PORT=3001                    # WebSocket server port
ANTHROPIC_API_KEY=sk-...     # Your API key
```

### Client

The client connects to `ws://localhost:3001` in development. For production, configure `WS_URL` in your environment.

## Roadmap

- [ ] Rich message rendering (markdown, syntax highlighting)
- [ ] Collapsible tool use sections
- [ ] Keyboard shortcuts
- [ ] Browser notifications when attention needed
- [ ] Session templates
- [ ] Remote server deployment
- [ ] Cost tracking per session

## Built With

- [Claude Agent SDK](https://platform.claude.com/docs/en/agent-sdk/overview) - The same tools that power Claude Code
- [React](https://react.dev/) + [Vite](https://vitejs.dev/)
- [react-grid-layout](https://github.com/react-grid-layout/react-grid-layout) - Draggable/resizable grid
- [Zustand](https://github.com/pmndrs/zustand) - State management
- [Tailwind CSS](https://tailwindcss.com/) - Styling

## Related Projects

- [claude-agent-kit](https://github.com/JimLiu/claude-agent-kit) - Comprehensive toolkit with session management
- [claude-agent-server](https://github.com/dzhng/claude-agent-server) - WebSocket server with E2B sandbox support

## License

MIT
