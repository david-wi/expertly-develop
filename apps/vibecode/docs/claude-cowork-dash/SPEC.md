# Claude Cowork Dash

## Vision
A web-based dashboard for managing multiple Claude Code agent sessions simultaneously. Replace noisy terminal windows with clean, draggable chat widgets that let you monitor, interact with, and control parallel AI coding tasks.

## Problem Statement
When vibecoding with Claude Code via the command line with multiple terminals:
1. **Visual noise**: Terminal output is distracting, especially when trying to focus on other work
2. **Limited UI**: Terminals have poor rendering, no rich formatting, hard-to-read scrollback
3. **No overview**: Difficult to see status of all running tasks at a glance
4. **Context switching friction**: Each terminal is a separate window to manage

## Solution
A browser-based dashboard where:
- Each Claude Code session appears as a **draggable, resizable widget**
- Widgets show **condensed status** by default (task name, status indicator, recent activity)
- **Expand to interact**: Click to see full conversation and send messages
- **Minimize distractions**: Collapse widgets to tiny status indicators while focusing elsewhere
- **Rich rendering**: Proper markdown, syntax highlighting, collapsible tool outputs

## Architecture

### Backend Options
```
┌─────────────────────────────────────────────────────────────┐
│  Claude Cowork Dash (Browser)                               │
│  ┌─────────┐ ┌─────────┐ ┌─────────┐                       │
│  │Widget 1 │ │Widget 2 │ │Widget 3 │ ...                   │
│  │WebSocket│ │WebSocket│ │WebSocket│                       │
│  └────┬────┘ └────┬────┘ └────┬────┘                       │
└───────┼──────────┼──────────┼───────────────────────────────┘
        │          │          │
        ▼          ▼          ▼
┌─────────────────────────────────────────────────────────────┐
│  Cowork Server (Local or Remote)                            │
│  ┌──────────────────────────────────────────────────────┐  │
│  │  Session Manager                                      │  │
│  │  ┌──────────┐ ┌──────────┐ ┌──────────┐             │  │
│  │  │Session 1 │ │Session 2 │ │Session 3 │             │  │
│  │  │Agent SDK │ │Agent SDK │ │Agent SDK │             │  │
│  │  └──────────┘ └──────────┘ └──────────┘             │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
        │          │          │
        ▼          ▼          ▼
   Claude API / Bedrock / Vertex
```

### Deployment Modes
1. **Local**: Node.js server running on localhost, connects to your local filesystem
2. **Remote Server**: Self-hosted on a VPS/cloud instance
3. **Sandboxed**: E2B or similar sandbox environment per session

## User Interface

### Dashboard Layout
```
┌────────────────────────────────────────────────────────────────────┐
│  Claude Cowork Dash                           [+ New] [Settings]   │
├────────────────────────────────────────────────────────────────────┤
│                                                                    │
│  ┌─────────────────────┐  ┌─────────────────────┐                 │
│  │ 🟢 API Refactor     │  │ 🔄 Test Suite       │                 │
│  │ ─────────────────── │  │ ─────────────────── │                 │
│  │ > Editing auth.ts   │  │ Running jest...     │                 │
│  │ > Fixed type errors │  │ 42/100 tests passed │                 │
│  │                     │  │                     │                 │
│  │ [─────────] [↗]     │  │ [─────────] [↗]     │                 │
│  └─────────────────────┘  └─────────────────────┘                 │
│                                                                    │
│  ┌─────────────────────┐  ┌──────┐                                │
│  │ 🟡 Docs Update      │  │🔵 DB │  <- minimized                  │
│  │ ─────────────────── │  └──────┘                                │
│  │ Waiting for input:  │                                          │
│  │ "Which sections?"   │                                          │
│  │                     │                                          │
│  │ [Type here...    ]  │                                          │
│  └─────────────────────┘                                          │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

### Widget States
1. **Minimized**: Just an icon + title + status dot
2. **Compact**: Title + last few lines of output + input field
3. **Expanded**: Full conversation history, tool outputs, input field
4. **Focused**: Full-screen takeover for deep interaction

### Status Indicators
- 🟢 **Active**: Agent is working
- 🔵 **Idle**: Completed, waiting for new input
- 🟡 **Waiting**: Needs user input or approval
- 🔴 **Error**: Something went wrong
- ⚪ **Disconnected**: Session lost

## Key Features

### Phase 1: MVP
- [ ] Single-page React app with draggable widgets (react-grid-layout or similar)
- [ ] WebSocket connection to local Node server per widget
- [ ] Start new sessions with initial prompt + working directory
- [ ] Stream messages in real-time with basic formatting
- [ ] Send follow-up messages
- [ ] Minimize/expand widgets
- [ ] Session persistence (survive page refresh)

### Phase 2: Polish
- [ ] Rich message rendering (markdown, syntax highlighting)
- [ ] Collapsible tool use sections
- [ ] Keyboard shortcuts (Cmd+1-9 to focus widgets, Cmd+N new, etc.)
- [ ] Dark/light theme
- [ ] Notification system (browser notifications when attention needed)
- [ ] Widget templates (pre-configured prompts/settings)

### Phase 3: Power Features
- [ ] Remote server deployment option
- [ ] Session forking (branch from a point in conversation)
- [ ] Cross-session context sharing
- [ ] MCP server configuration per widget
- [ ] Cost tracking per session
- [ ] Session recording/playback
- [ ] Team sharing (multiple users watching same session)

## Technical Stack

### Frontend
- **React 18+** with TypeScript
- **Tailwind CSS** for styling
- **react-grid-layout** for draggable/resizable widgets
- **zustand** for state management
- **WebSocket** for real-time communication

### Backend
- **Node.js** with **Express** or **Bun**
- **@anthropic-ai/claude-agent-sdk** for Claude Code integration
- **ws** or native Bun WebSocket
- Could leverage **@claude-agent-kit** packages for session management

### Alternative: Build on claude-agent-kit
The existing `claude-agent-kit` project provides:
- Session management
- WebSocket handlers
- Message parsing utilities

We could fork/extend their `examples/claude-code-web` as a starting point.

## File Structure
```
claude-cowork-dash/
├── packages/
│   ├── server/           # Backend server
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── session-manager.ts
│   │   │   └── websocket-handler.ts
│   │   └── package.json
│   └── client/           # React frontend
│       ├── src/
│       │   ├── App.tsx
│       │   ├── components/
│       │   │   ├── Dashboard.tsx
│       │   │   ├── Widget.tsx
│       │   │   ├── MessageList.tsx
│       │   │   └── InputField.tsx
│       │   ├── hooks/
│       │   │   ├── useSession.ts
│       │   │   └── useWebSocket.ts
│       │   └── store/
│       │       └── dashboard-store.ts
│       └── package.json
├── package.json          # Workspace root
└── README.md
```

## API Design

### WebSocket Messages (Client → Server)
```typescript
// Create new session
{ type: "create_session", sessionId: string, cwd: string, prompt: string }

// Send message to existing session
{ type: "chat", sessionId: string, content: string }

// Update session options
{ type: "set_options", sessionId: string, options: SessionOptions }

// Interrupt running task
{ type: "interrupt", sessionId: string }

// Resume/reconnect to session
{ type: "resume", sessionId: string }
```

### WebSocket Messages (Server → Client)
```typescript
// Session created
{ type: "session_created", sessionId: string }

// Message from Claude
{ type: "message", sessionId: string, message: SDKMessage }

// State change
{ type: "state_changed", sessionId: string, state: "busy" | "idle" | "waiting" | "error" }

// Session ended
{ type: "session_ended", sessionId: string, summary: string }

// Error
{ type: "error", sessionId: string, error: string }
```

## Configuration

### Server Config (cowork-server.config.json)
```json
{
  "port": 3001,
  "apiProvider": "anthropic",  // or "bedrock", "vertex"
  "defaultModel": "claude-sonnet-4-5-20250929",
  "allowedTools": ["Read", "Write", "Bash", "Glob", "Grep"],
  "maxSessions": 10,
  "defaultCwd": "~",
  "mcpServers": []
}
```

### Client Config (stored in localStorage)
```json
{
  "serverUrl": "ws://localhost:3001",
  "theme": "dark",
  "layout": [...],  // react-grid-layout state
  "widgets": [
    { "id": "w1", "sessionId": "...", "position": {...} }
  ]
}
```

## Getting Started (Target UX)

```bash
# Install globally
npm install -g claude-cowork-dash

# Start server (uses your ANTHROPIC_API_KEY)
cowork-server

# Open in browser
open http://localhost:3001
```

Or run via npx:
```bash
npx claude-cowork-dash
```

## Success Metrics
- Can manage 5+ concurrent sessions without UI lag
- < 100ms latency from server message to UI update
- Session state persists across browser refreshes
- Memory usage < 500MB for 10 active sessions
- Works on Chrome, Firefox, Safari

## Open Questions
1. Should widgets be able to share context (e.g., one agent's output feeds another)?
2. How to handle permission prompts that normally require terminal interaction?
3. Should we support voice input/output for hands-free interaction?
4. Integration with existing Claude.ai/Claude Code sessions?

## References
- [Claude Agent SDK Docs](https://platform.claude.com/docs/en/agent-sdk/overview)
- [claude-agent-kit](https://github.com/JimLiu/claude-agent-kit) - Existing open-source toolkit
- [claude-agent-server](https://github.com/dzhng/claude-agent-server) - WebSocket wrapper with E2B
