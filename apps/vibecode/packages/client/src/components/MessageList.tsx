import { useEffect, useRef, useMemo, useState, type JSX } from 'react';
import { User, Bot, Wrench, AlertCircle, Loader2, X } from 'lucide-react';
import type { ChatMessage, ImageAttachment } from '../store/dashboard-store';

interface MessageListProps {
  messages: ChatMessage[];
  showStreaming?: boolean;
  isBusy?: boolean;
}

// ANSI color code to Tailwind class mapping
const ansiToClass: Record<number, string> = {
  // Regular colors
  30: 'text-gray-900',      // Black
  31: 'text-red-500',       // Red
  32: 'text-green-500',     // Green
  33: 'text-yellow-500',    // Yellow
  34: 'text-blue-500',      // Blue
  35: 'text-purple-500',    // Magenta
  36: 'text-cyan-500',      // Cyan
  37: 'text-gray-300',      // White
  // Bright colors
  90: 'text-gray-500',      // Bright Black (Gray)
  91: 'text-red-400',       // Bright Red
  92: 'text-green-400',     // Bright Green
  93: 'text-yellow-400',    // Bright Yellow
  94: 'text-blue-400',      // Bright Blue
  95: 'text-purple-400',    // Bright Magenta
  96: 'text-cyan-400',      // Bright Cyan
  97: 'text-white',         // Bright White
  // Styles
  1: 'font-bold',           // Bold
  2: 'opacity-75',          // Dim
  3: 'italic',              // Italic
  4: 'underline',           // Underline
};

// Parse ANSI escape codes and return styled spans
function parseAnsi(text: string): JSX.Element[] {
  const parts: JSX.Element[] = [];
  // Match ANSI escape sequences: ESC[ followed by numbers and 'm'
  const ansiRegex = /\x1b\[([0-9;]*)m/g;

  let lastIndex = 0;
  let currentClasses: string[] = [];
  let match;
  let keyIndex = 0;

  while ((match = ansiRegex.exec(text)) !== null) {
    // Add text before this escape sequence
    if (match.index > lastIndex) {
      const content = text.slice(lastIndex, match.index);
      if (content) {
        parts.push(
          <span key={keyIndex++} className={currentClasses.join(' ')}>
            {content}
          </span>
        );
      }
    }

    // Parse the escape codes
    const codes = match[1].split(';').map(Number);
    for (const code of codes) {
      if (code === 0) {
        // Reset
        currentClasses = [];
      } else if (ansiToClass[code]) {
        // Remove conflicting classes (e.g., previous colors)
        if (code >= 30 && code <= 37 || code >= 90 && code <= 97) {
          currentClasses = currentClasses.filter(c => !c.startsWith('text-'));
        }
        currentClasses.push(ansiToClass[code]);
      }
    }

    lastIndex = ansiRegex.lastIndex;
  }

  // Add remaining text
  if (lastIndex < text.length) {
    parts.push(
      <span key={keyIndex++} className={currentClasses.join(' ')}>
        {text.slice(lastIndex)}
      </span>
    );
  }

  return parts.length > 0 ? parts : [<span key={0}>{text}</span>];
}

// Terminal-styled content component
function TerminalContent({ content }: { content: string }) {
  return (
    <div className="bg-gray-900 text-gray-100 rounded-lg p-3 font-mono text-xs leading-relaxed overflow-x-auto">
      <pre className="whitespace-pre-wrap break-words m-0">
        {parseAnsi(content)}
      </pre>
    </div>
  );
}

// Message images component with thumbnails and preview modal
function MessageImages({ images }: { images: ImageAttachment[] }) {
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null);

  return (
    <>
      <div className="flex gap-2 flex-wrap mb-2">
        {images.map(img => (
          <img
            key={img.id}
            src={`data:${img.mediaType};base64,${img.data}`}
            alt={img.name || 'Attached image'}
            className="h-20 w-20 object-cover rounded border border-gray-200 cursor-pointer hover:border-blue-400 transition-colors"
            onClick={() => setPreviewImage(img)}
          />
        ))}
      </div>

      {/* Full Image Preview Modal */}
      {previewImage && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setPreviewImage(null)}
        >
          <div className="relative max-w-4xl max-h-[90vh]">
            <img
              src={`data:${previewImage.mediaType};base64,${previewImage.data}`}
              alt={previewImage.name || 'Preview'}
              className="max-w-full max-h-[90vh] object-contain rounded-lg"
            />
            <button
              onClick={() => setPreviewImage(null)}
              className="absolute top-2 right-2 w-8 h-8 bg-black/50 hover:bg-black/70 text-white rounded-full flex items-center justify-center"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
      )}
    </>
  );
}

export default function MessageList({ messages, showStreaming = true, isBusy = false }: MessageListProps) {
  const endRef = useRef<HTMLDivElement>(null);

  // Filter messages: when showStreaming=false and busy, hide recent assistant messages
  const displayMessages = useMemo(() => {
    if (showStreaming || !isBusy) {
      return messages;
    }

    // Find the index of the last user message
    let lastUserIndex = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === 'user') {
        lastUserIndex = i;
        break;
      }
    }

    // If no user message found, show all
    if (lastUserIndex === -1) {
      return messages;
    }

    // Hide assistant messages after the last user message (the current response)
    return messages.slice(0, lastUserIndex + 1);
  }, [messages, showStreaming, isBusy]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [displayMessages]);

  if (messages.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-gray-400 text-sm">
        No messages yet
      </div>
    );
  }

  const hiddenCount = messages.length - displayMessages.length;

  return (
    <div className="h-full overflow-y-auto p-3 space-y-3 bg-white">
      {displayMessages.map((message) => {
        // Use terminal styling for assistant messages when streaming is enabled
        const useTerminalStyle = showStreaming && message.role === 'assistant' && !message.toolUse;

        return (
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
                  ? 'bg-blue-500'
                  : message.role === 'system'
                  ? 'bg-amber-500'
                  : message.toolUse
                  ? 'bg-purple-500'
                  : 'bg-gray-700'
              }`}
            >
              {message.role === 'user' ? (
                <User className="w-4 h-4 text-white" />
              ) : message.role === 'system' ? (
                <AlertCircle className="w-4 h-4 text-white" />
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
              {useTerminalStyle ? (
                <TerminalContent content={message.content} />
              ) : (
                <div
                  className={`inline-block px-3 py-2 rounded-lg text-sm ${
                    message.role === 'user'
                      ? 'bg-blue-500 text-white'
                      : message.role === 'system'
                      ? 'bg-amber-50 border border-amber-200 text-amber-800'
                      : message.toolUse
                      ? 'bg-purple-50 border border-purple-200 text-purple-800'
                      : 'bg-gray-100 text-gray-800'
                  }`}
                >
                  {message.toolUse ? (
                    <div className="space-y-1">
                      <div className="flex items-center gap-2 text-purple-600 text-xs font-medium">
                        <Wrench className="w-3 h-3" />
                        {message.toolUse.name}
                      </div>
                      {message.content && (
                        <TerminalContent content={message.content} />
                      )}
                    </div>
                  ) : (
                    <>
                      {message.images && message.images.length > 0 && (
                        <MessageImages images={message.images} />
                      )}
                      {message.content && (
                        <div className="whitespace-pre-wrap break-words">
                          {message.content}
                        </div>
                      )}
                    </>
                  )}
                </div>
              )}
              <div className="text-xs text-gray-400 mt-1">
                {new Date(message.timestamp).toLocaleTimeString([], {
                  hour: '2-digit',
                  minute: '2-digit',
                })}
              </div>
            </div>
          </div>
        );
      })}
      {/* Show processing indicator when streaming messages are hidden */}
      {hiddenCount > 0 && isBusy && (
        <div className="flex gap-2 items-center">
          <div className="flex-none w-7 h-7 rounded-lg flex items-center justify-center bg-gray-700">
            <Bot className="w-4 h-4 text-white" />
          </div>
          <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-gray-100 text-gray-600 text-sm">
            <Loader2 className="w-4 h-4 animate-spin" />
            <span>Processing... ({hiddenCount} message{hiddenCount > 1 ? 's' : ''} hidden)</span>
          </div>
        </div>
      )}
      <div ref={endRef} />
    </div>
  );
}
