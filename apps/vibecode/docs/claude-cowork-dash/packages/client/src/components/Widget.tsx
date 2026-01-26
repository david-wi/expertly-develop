import { useState, useRef, useEffect } from 'react';
import {
  GripVertical,
  Minimize2,
  Maximize2,
  X,
  Send,
  Loader2,
  StopCircle,
  FolderOpen,
  Play,
} from 'lucide-react';
import { useDashboardStore, type Session, type Widget as WidgetType } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';
import MessageList from './MessageList';

interface WidgetProps {
  widget: WidgetType;
  session: Session | null;
  ws: ReturnType<typeof useWebSocket>;
}

export default function Widget({ widget, session, ws }: WidgetProps) {
  const [input, setInput] = useState('');
  const [showSetup, setShowSetup] = useState(!widget.sessionId);
  const [setupPrompt, setSetupPrompt] = useState('');
  const [setupCwd, setSetupCwd] = useState('');
  const [setupName, setSetupName] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  
  const { removeWidget, toggleWidgetMinimized, setWidgetSession } = useDashboardStore();

  const handleSend = () => {
    if (!input.trim() || !session) return;
    ws.sendMessage(session.id, input);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateSession = () => {
    ws.createSession({
      name: setupName || 'New Session',
      cwd: setupCwd || undefined,
      prompt: setupPrompt || undefined,
    });
    
    // Listen for session creation and link it to this widget
    // This is a bit hacky - in a real app we'd have proper session → widget linking
    const unsubscribe = useDashboardStore.subscribe((state, prevState) => {
      const newSessions = Object.values(state.sessions).filter(
        s => !prevState.sessions[s.id]
      );
      if (newSessions.length > 0) {
        setWidgetSession(widget.id, newSessions[0].id);
        setShowSetup(false);
        unsubscribe();
      }
    });
  };

  const getStatusColor = () => {
    if (!session) return 'bg-gray-500';
    switch (session.state) {
      case 'busy': return 'bg-green-500 animate-pulse';
      case 'idle': return 'bg-blue-500';
      case 'waiting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-500';
      default: return 'bg-gray-500';
    }
  };

  const getStatusText = () => {
    if (!session) return 'No session';
    switch (session.state) {
      case 'busy': return 'Working...';
      case 'idle': return 'Ready';
      case 'waiting': return 'Waiting';
      case 'error': return 'Error';
      case 'disconnected': return 'Disconnected';
      default: return session.state;
    }
  };

  // Minimized view
  if (widget.minimized) {
    return (
      <div className="h-full bg-panel-900 rounded-lg border border-panel-700 flex items-center gap-3 px-4">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-sm font-medium text-panel-200 truncate flex-1">
          {session?.name || 'New Widget'}
        </span>
        <button
          onClick={() => toggleWidgetMinimized(widget.id)}
          className="p-1 hover:bg-panel-700 rounded"
        >
          <Maximize2 className="w-4 h-4 text-panel-400" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-panel-900 rounded-lg border border-panel-700 overflow-hidden">
      {/* Header */}
      <div className="flex-none h-10 flex items-center gap-2 px-3 border-b border-panel-800 bg-panel-800/50">
        <div className="widget-drag-handle cursor-move p-1 -ml-1 hover:bg-panel-700 rounded">
          <GripVertical className="w-4 h-4 text-panel-500" />
        </div>
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-sm font-medium text-panel-200 truncate flex-1">
          {session?.name || 'New Widget'}
        </span>
        <span className="text-xs text-panel-500">{getStatusText()}</span>
        <div className="flex items-center gap-1">
          {session?.state === 'busy' && (
            <button
              onClick={() => ws.interruptSession(session.id)}
              className="p-1 hover:bg-panel-700 rounded text-orange-400"
              title="Stop"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => toggleWidgetMinimized(widget.id)}
            className="p-1 hover:bg-panel-700 rounded"
          >
            <Minimize2 className="w-4 h-4 text-panel-400" />
          </button>
          <button
            onClick={() => removeWidget(widget.id)}
            className="p-1 hover:bg-panel-700 rounded"
          >
            <X className="w-4 h-4 text-panel-400" />
          </button>
        </div>
      </div>

      {/* Content */}
      {showSetup ? (
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-auto">
          <div>
            <label className="block text-xs text-panel-400 mb-1">Session Name</label>
            <input
              type="text"
              value={setupName}
              onChange={(e) => setSetupName(e.target.value)}
              placeholder="My Task"
              className="w-full px-3 py-2 rounded-lg bg-panel-800 border border-panel-700 text-panel-100 text-sm placeholder:text-panel-500 focus:outline-none focus:border-panel-600"
            />
          </div>
          <div>
            <label className="block text-xs text-panel-400 mb-1">
              <FolderOpen className="w-3 h-3 inline mr-1" />
              Working Directory
            </label>
            <input
              type="text"
              value={setupCwd}
              onChange={(e) => setSetupCwd(e.target.value)}
              placeholder="/path/to/project"
              className="w-full px-3 py-2 rounded-lg bg-panel-800 border border-panel-700 text-panel-100 text-sm font-mono placeholder:text-panel-500 focus:outline-none focus:border-panel-600"
            />
          </div>
          <div className="flex-1">
            <label className="block text-xs text-panel-400 mb-1">Initial Prompt (optional)</label>
            <textarea
              value={setupPrompt}
              onChange={(e) => setSetupPrompt(e.target.value)}
              placeholder="What should Claude work on?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-panel-800 border border-panel-700 text-panel-100 text-sm placeholder:text-panel-500 focus:outline-none focus:border-panel-600 resize-none"
            />
          </div>
          <button
            onClick={handleCreateSession}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Session
          </button>
        </div>
      ) : (
        <>
          {/* Messages */}
          <div className="flex-1 overflow-hidden">
            <MessageList messages={session?.messages || []} />
          </div>

          {/* Input */}
          <div className="flex-none p-3 border-t border-panel-800">
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={session?.state === 'busy' ? 'Working...' : 'Send a message...'}
                disabled={!session || session.state === 'busy'}
                className="flex-1 px-3 py-2 rounded-lg bg-panel-800 border border-panel-700 text-panel-100 text-sm placeholder:text-panel-500 focus:outline-none focus:border-panel-600 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !session || session.state === 'busy'}
                className="p-2 rounded-lg bg-orange-600 hover:bg-orange-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {session?.state === 'busy' ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Send className="w-4 h-4" />
                )}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
