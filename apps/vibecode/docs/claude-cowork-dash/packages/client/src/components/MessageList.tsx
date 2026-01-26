import { useEffect, useRef } from 'react';
import { User, Bot, Wrench } from 'lucide-react';
import type { ChatMessage } from '../store/dashboard-store';

interface MessageListProps {
  messages: ChatMessage[];
}

export default function MessageList({ messages }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-panel-500 text-sm">
        No messages yet
      </div>
    );
  }

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3">
      {messages.map((message) => (
        <div
          key={message.id}
          className={`message-enter flex gap-2 ${
            message.role === 'user' ? 'flex-row-reverse' : ''
          }`}
        >
          {/* Avatar */}
          <div
            className={`flex-none w-7 h-7 rounded-lg flex items-center justify-center ${
              message.role === 'user'
                ? 'bg-blue-600'
                : message.toolUse
                ? 'bg-purple-600'
                : 'bg-orange-600'
            }`}
          >
            {message.role === 'user' ? (
              <User className="w-4 h-4 text-white" />
            ) : message.toolUse ? (
              <Wrench className="w-4 h-4 text-white" />
            ) : (
              <Bot className="w-4 h-4 text-white" />
            )}
          </div>

          {/* Content */}
          <div
            className={`flex-1 max-w-[85%] ${
              message.role === 'user' ? 'text-right' : ''
            }`}
          >
            <div
              className={`inline-block px-3 py-2 rounded-lg text-sm ${
                message.role === 'user'
                  ? 'bg-blue-600 text-white'
                  : message.toolUse
                  ? 'bg-panel-800 border border-purple-600/30'
                  : 'bg-panel-800 text-panel-100'
              }`}
            >
              {message.toolUse ? (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 text-purple-400 text-xs font-medium">
                    <Wrench className="w-3 h-3" />
                    {message.toolUse.name}
                  </div>
                  {message.content && (
                    <div className="text-panel-300">{message.content}</div>
                  )}
                </div>
              ) : (
                <div className="whitespace-pre-wrap break-words">
                  {message.content}
                </div>
              )}
            </div>
            <div className="text-xs text-panel-600 mt-1">
              {new Date(message.timestamp).toLocaleTimeString([], {
                hour: '2-digit',
                minute: '2-digit',
              })}
            </div>
          </div>
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
}
