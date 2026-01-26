import { useState, useRef, useEffect } from 'react';
import {
  Minimize2,
  Maximize2,
  X,
  Send,
  Loader2,
  StopCircle,
  FolderOpen,
  Play,
  Monitor,
  Cloud,
  Pencil,
  Check,
  Eye,
  EyeOff,
  Copy,
  Terminal,
} from 'lucide-react';
import { useDashboardStore, type Session, type Widget as WidgetType, type ExecutionMode, type QueuedMessage } from '../store/dashboard-store';
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
  const [setupExecutionMode, setSetupExecutionMode] = useState<ExecutionMode>('local');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);

  const { removeWidget, toggleWidgetMinimized, setWidgetSession, renameWidget, serverConfig, addMessage, toggleShowStreaming, sessionNameHistory, addSessionNameToHistory, saveSessionConfig, getSessionConfig, addQueuedMessage } = useDashboardStore();
  const [showNameSuggestions, setShowNameSuggestions] = useState(false);
  const [copiedCommand, setCopiedCommand] = useState(false);
  const nameInputRef = useRef<HTMLInputElement>(null);

  // Check if local agent is needed but not connected
  const needsLocalAgent = session?.executionMode === 'local' && !serverConfig.hasLocalAgent;

  // Get agent command for copying
  const getAgentCommand = () => {
    const wsUrl = import.meta.env.DEV
      ? 'ws://localhost:3001'
      : `ws://${window.location.host}`;
    return `npx vibecode-agent -s ${wsUrl}`;
  };

  const handleCopyCommand = async () => {
    try {
      await navigator.clipboard.writeText(getAgentCommand());
      setCopiedCommand(true);
      setTimeout(() => setCopiedCommand(false), 2000);
    } catch (err) {
      console.error('Failed to copy:', err);
    }
  };

  // Filter suggestions based on input
  const nameSuggestions = sessionNameHistory.filter(
    name => name.toLowerCase().includes(setupName.toLowerCase()) && name.toLowerCase() !== setupName.toLowerCase()
  );

  const currentTitle = widget.customName || session?.name || 'New Widget';

  // Elapsed time tracker
  const [elapsedTime, setElapsedTime] = useState<string>('');

  useEffect(() => {
    if (session?.state !== 'busy' || !session.busyStartedAt) {
      setElapsedTime('');
      return;
    }

    const updateElapsed = () => {
      const elapsed = Math.floor((Date.now() - session.busyStartedAt!) / 1000);
      const mins = Math.floor(elapsed / 60);
      const secs = elapsed % 60;
      setElapsedTime(mins > 0 ? `${mins}m ${secs}s` : `${secs}s`);
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 1000);
    return () => clearInterval(interval);
  }, [session?.state, session?.busyStartedAt]);

  const handleSend = () => {
    if (!input.trim() || !session) return;

    const content = input.trim();

    // If session is busy, queue the message instead
    if (session.state === 'busy') {
      addQueuedMessage(session.id, content);
      setInput('');
      return;
    }

    // Add user message locally for immediate feedback
    addMessage(session.id, {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
    });

    ws.sendMessage(session.id, content);
    setInput('');
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handleCreateSession = () => {
    const sessionName = setupName || 'New Session';

    // Save the name to history if it's custom
    if (setupName.trim()) {
      addSessionNameToHistory(setupName);
      // Save the working directory config for this session name
      if (setupCwd.trim()) {
        saveSessionConfig(setupName, setupCwd);
      }
    }

    ws.createSession({
      name: sessionName,
      cwd: setupCwd || undefined,
      prompt: setupPrompt || undefined,
      executionMode: setupExecutionMode,
    });

    // Listen for session creation and link it to this widget
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

  const handleToggleExecutionMode = () => {
    if (!session || session.state === 'busy') return;
    const newMode: ExecutionMode = session.executionMode === 'local' ? 'remote' : 'local';
    ws.setExecutionMode(session.id, newMode);
  };

  const handleStartEditTitle = (e: React.MouseEvent) => {
    e.stopPropagation();
    setEditedTitle(currentTitle);
    setIsEditingTitle(true);
    setTimeout(() => titleInputRef.current?.select(), 0);
  };

  const handleSaveTitle = () => {
    if (editedTitle.trim()) {
      renameWidget(widget.id, editedTitle.trim());
    }
    setIsEditingTitle(false);
  };

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleSaveTitle();
    } else if (e.key === 'Escape') {
      setIsEditingTitle(false);
    }
  };

  const getStatusColor = () => {
    if (!session) return 'bg-gray-400';
    // If local execution mode but no agent connected, show warning color
    if (session.executionMode === 'local' && !serverConfig.hasLocalAgent) {
      return 'bg-yellow-500';
    }
    switch (session.state) {
      case 'busy': return 'bg-green-500 animate-pulse';
      case 'idle': return 'bg-blue-500';
      case 'waiting': return 'bg-yellow-500';
      case 'error': return 'bg-red-500';
      case 'disconnected': return 'bg-gray-400';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    if (!session) return 'No session';
    // If local execution mode but no agent connected, show that
    if (session.executionMode === 'local' && !serverConfig.hasLocalAgent) {
      return 'Agent Required';
    }
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
      <div className="widget-drag-handle h-full bg-white rounded-lg border border-gray-200 shadow-sm flex items-center gap-3 px-4 cursor-move">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <span className="text-sm font-medium text-gray-700 truncate flex-1">
          {currentTitle}
        </span>
        {session && (
          <span className="text-xs text-gray-400 flex items-center gap-1">
            {session.executionMode === 'local' ? (
              <Monitor className="w-3 h-3" />
            ) : (
              <Cloud className="w-3 h-3" />
            )}
          </span>
        )}
        <button
          onClick={(e) => { e.stopPropagation(); toggleWidgetMinimized(widget.id); }}
          className="p-1 hover:bg-gray-100 rounded"
        >
          <Maximize2 className="w-4 h-4 text-gray-500" />
        </button>
      </div>
    );
  }

  return (
    <div className="h-full flex flex-col bg-white rounded-lg border border-gray-200 shadow-sm overflow-hidden">
      {/* Header - entire bar is draggable */}
      <div className="widget-drag-handle flex-none h-10 flex items-center gap-2 px-3 border-b border-gray-100 bg-gray-50 cursor-move">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />

        {/* Editable title */}
        {isEditingTitle ? (
          <div className="flex-1 flex items-center gap-1" onClick={e => e.stopPropagation()}>
            <input
              ref={titleInputRef}
              type="text"
              value={editedTitle}
              onChange={(e) => setEditedTitle(e.target.value)}
              onKeyDown={handleTitleKeyDown}
              onBlur={handleSaveTitle}
              className="flex-1 px-1 py-0.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded focus:outline-none focus:border-blue-400"
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="p-0.5 hover:bg-gray-200 rounded"
            >
              <Check className="w-3 h-3 text-green-600" />
            </button>
          </div>
        ) : (
          <div className="flex-1 flex items-center gap-1 min-w-0">
            <span className="text-sm font-medium text-gray-700 truncate">
              {currentTitle}
            </span>
            <button
              onClick={handleStartEditTitle}
              className="p-0.5 hover:bg-gray-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit title"
            >
              <Pencil className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        )}

        <span className="text-xs text-gray-400">
          {getStatusText()}
          {elapsedTime && <span className="ml-1 text-gray-500">({elapsedTime})</span>}
        </span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
          {/* Streaming toggle */}
          {session && (
            <button
              onClick={() => toggleShowStreaming(widget.id)}
              className={`p-1 rounded ${widget.showStreaming ? 'bg-blue-100 text-blue-600' : 'hover:bg-gray-200 text-gray-400'}`}
              title={widget.showStreaming ? 'Hide streaming (show results only)' : 'Show streaming messages'}
            >
              {widget.showStreaming ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
            </button>
          )}
          {/* Execution mode toggle */}
          {session && serverConfig.remoteAvailable && (
            <button
              onClick={handleToggleExecutionMode}
              disabled={session.state === 'busy'}
              className={`p-1 rounded text-xs flex items-center gap-1 ${
                session.executionMode === 'local'
                  ? 'bg-gray-200 text-gray-600'
                  : 'bg-blue-100 text-blue-600'
              } disabled:opacity-50`}
              title={`Switch to ${session.executionMode === 'local' ? 'remote' : 'local'} execution`}
            >
              {session.executionMode === 'local' ? (
                <Monitor className="w-3 h-3" />
              ) : (
                <Cloud className="w-3 h-3" />
              )}
            </button>
          )}
          {session?.state === 'busy' && (
            <button
              onClick={() => ws.interruptSession(session.id)}
              className="p-1 hover:bg-gray-200 rounded text-orange-500"
              title="Stop"
            >
              <StopCircle className="w-4 h-4" />
            </button>
          )}
          <button
            onClick={() => toggleWidgetMinimized(widget.id)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <Minimize2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => removeWidget(widget.id)}
            className="p-1 hover:bg-gray-200 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Content */}
      {showSetup ? (
        <div className="flex-1 p-4 flex flex-col gap-3 overflow-auto bg-white">
          <div className="relative">
            <label className="block text-xs text-gray-500 mb-1">Session Name</label>
            <input
              ref={nameInputRef}
              type="text"
              value={setupName}
              onChange={(e) => {
                setSetupName(e.target.value);
                setShowNameSuggestions(true);
              }}
              onFocus={() => setShowNameSuggestions(true)}
              onBlur={() => setTimeout(() => setShowNameSuggestions(false), 150)}
              placeholder="My Task"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400"
              autoComplete="off"
            />
            {/* Autocomplete dropdown */}
            {showNameSuggestions && nameSuggestions.length > 0 && (
              <div className="absolute z-10 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-40 overflow-y-auto">
                {nameSuggestions.map((name, idx) => (
                  <button
                    key={idx}
                    type="button"
                    className="w-full px-3 py-2 text-left text-sm text-gray-700 hover:bg-gray-100 first:rounded-t-lg last:rounded-b-lg"
                    onMouseDown={(e) => {
                      e.preventDefault();
                      setSetupName(name);
                      // Auto-fill working directory from saved config
                      const config = getSessionConfig(name);
                      if (config?.cwd) {
                        setSetupCwd(config.cwd);
                      }
                      setShowNameSuggestions(false);
                    }}
                  >
                    {name}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">
              <FolderOpen className="w-3 h-3 inline mr-1" />
              Working Directory
            </label>
            <input
              type="text"
              value={setupCwd}
              onChange={(e) => setSetupCwd(e.target.value)}
              placeholder="/path/to/project"
              className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm font-mono placeholder:text-gray-400 focus:outline-none focus:border-blue-400"
            />
          </div>

          {/* Execution mode selector */}
          <div>
            <label className="block text-xs text-gray-500 mb-1">Execution Mode</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSetupExecutionMode('local')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  setupExecutionMode === 'local'
                    ? 'bg-gray-100 border-gray-300 text-gray-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
                }`}
              >
                <Monitor className="w-4 h-4" />
                Local
              </button>
              <button
                onClick={() => setSetupExecutionMode('remote')}
                disabled={!serverConfig.remoteAvailable}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-lg border text-sm transition-colors ${
                  setupExecutionMode === 'remote'
                    ? 'bg-blue-50 border-blue-200 text-blue-700'
                    : 'bg-white border-gray-200 text-gray-500 hover:text-gray-700'
                } disabled:opacity-50 disabled:cursor-not-allowed`}
              >
                <Cloud className="w-4 h-4" />
                Remote
              </button>
            </div>
            {!serverConfig.remoteAvailable && (
              <p className="text-xs text-gray-400 mt-1">
                Remote execution not configured
              </p>
            )}
          </div>

          <div className="flex-1">
            <label className="block text-xs text-gray-500 mb-1">Initial Prompt (optional)</label>
            <textarea
              value={setupPrompt}
              onChange={(e) => setSetupPrompt(e.target.value)}
              placeholder="What should Claude work on?"
              rows={3}
              className="w-full px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-gray-700 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 resize-none"
            />
          </div>
          <button
            onClick={handleCreateSession}
            className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-sm font-medium transition-colors"
          >
            <Play className="w-4 h-4" />
            Start Session
          </button>
        </div>
      ) : (
        <>
          {/* Messages or Agent Required message */}
          <div className="flex-1 overflow-hidden bg-white">
            {needsLocalAgent ? (
              <div className="h-full flex flex-col items-center justify-center p-6 text-center">
                <div className="w-12 h-12 rounded-full bg-yellow-100 flex items-center justify-center mb-4">
                  <Terminal className="w-6 h-6 text-yellow-600" />
                </div>
                <h3 className="text-lg font-medium text-gray-900 mb-2">Local Agent Required</h3>
                <p className="text-sm text-gray-500 mb-4 max-w-xs">
                  Run the agent command in your terminal to enable local execution.
                </p>
                <button
                  onClick={handleCopyCommand}
                  className="flex items-center gap-2 px-4 py-2.5 bg-gray-100 hover:bg-gray-200 rounded-lg text-sm font-mono text-gray-700 transition-colors group"
                  title="Click to copy"
                >
                  <code className="text-gray-800">npx vibecode-agent</code>
                  {copiedCommand ? (
                    <Check className="w-4 h-4 text-green-600 flex-shrink-0" />
                  ) : (
                    <Copy className="w-4 h-4 text-gray-400 group-hover:text-gray-600 flex-shrink-0" />
                  )}
                </button>
                {copiedCommand && (
                  <p className="text-xs text-green-600 mt-2">Copied to clipboard!</p>
                )}
              </div>
            ) : (
              <MessageList
                messages={session?.messages || []}
                showStreaming={widget.showStreaming}
                isBusy={session?.state === 'busy'}
              />
            )}
          </div>

          {/* Input */}
          <div className="flex-none p-3 border-t border-gray-100 bg-gray-50">
            {/* Show queued messages */}
            {session && session.queuedMessages && session.queuedMessages.length > 0 && (
              <div className="mb-2 flex items-center gap-2 text-xs text-amber-600">
                <Loader2 className="w-3 h-3 animate-spin" />
                <span>
                  {session.queuedMessages.length} message{session.queuedMessages.length > 1 ? 's' : ''} queued
                </span>
              </div>
            )}
            <div className="flex items-center gap-2">
              <input
                ref={inputRef}
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={session?.state === 'busy' ? 'Type to queue message...' : 'Send a message...'}
                disabled={!session}
                className="flex-1 px-3 py-2 rounded-lg bg-white border border-gray-200 text-gray-700 text-sm placeholder:text-gray-400 focus:outline-none focus:border-blue-400 disabled:opacity-50"
              />
              <button
                onClick={handleSend}
                disabled={!input.trim() || !session}
                className={`p-2 rounded-lg text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors ${
                  session?.state === 'busy'
                    ? 'bg-amber-500 hover:bg-amber-400'
                    : 'bg-blue-600 hover:bg-blue-500'
                }`}
                title={session?.state === 'busy' ? 'Queue message' : 'Send message'}
              >
                {session?.state === 'busy' ? (
                  <span className="text-xs font-medium px-1">Q</span>
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
