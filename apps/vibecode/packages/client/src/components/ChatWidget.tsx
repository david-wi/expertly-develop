import { useState, useRef, useEffect, useCallback } from 'react';
import {
  Minimize2,
  Maximize2,
  X,
  Send,
  Loader2,
  Pencil,
  Check,
  MessageCircle,
  Image as ImageIcon,
} from 'lucide-react';
import { useDashboardStore, type Widget as WidgetType, type ChatConversation, type ImageAttachment } from '../store/dashboard-store';
import type { useWebSocket } from '../hooks/useWebSocket';
import MessageList from './MessageList';

interface ChatWidgetProps {
  widget: WidgetType;
  conversation: ChatConversation | null;
  ws: ReturnType<typeof useWebSocket>;
}

export default function ChatWidget({ widget, conversation, ws }: ChatWidgetProps) {
  const [input, setInput] = useState('');
  const [isEditingTitle, setIsEditingTitle] = useState(false);
  const [editedTitle, setEditedTitle] = useState('');
  const [pendingImages, setPendingImages] = useState<ImageAttachment[]>([]);
  const [previewImage, setPreviewImage] = useState<ImageAttachment | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const titleInputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const { removeWidget, toggleWidgetMinimized, renameWidget, addChatMessage } = useDashboardStore();

  const currentTitle = widget.customName || 'Chat';

  // Handle paste events for images
  const handlePaste = useCallback((e: ClipboardEvent) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) continue;

        const reader = new FileReader();
        reader.onload = (event) => {
          const base64 = event.target?.result as string;
          // Extract just the base64 data without the data URL prefix
          const base64Data = base64.split(',')[1];
          const mediaType = item.type as ImageAttachment['mediaType'];

          const newImage: ImageAttachment = {
            id: `img-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
            data: base64Data,
            mediaType,
            name: file.name || `pasted-image-${Date.now()}`,
          };

          setPendingImages(prev => [...prev, newImage]);
        };
        reader.readAsDataURL(file);
      }
    }
  }, []);

  // Add paste listener to the container
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    container.addEventListener('paste', handlePaste);
    return () => container.removeEventListener('paste', handlePaste);
  }, [handlePaste]);

  const removeImage = (imageId: string) => {
    setPendingImages(prev => prev.filter(img => img.id !== imageId));
  };

  const handleSend = () => {
    if ((!input.trim() && pendingImages.length === 0) || !conversation) return;

    const content = input.trim();

    // Don't allow sending while busy
    if (conversation.state === 'busy') return;

    // Add user message locally for immediate feedback
    addChatMessage(conversation.id, {
      id: `local-${Date.now()}`,
      role: 'user',
      content,
      timestamp: Date.now(),
      images: pendingImages.length > 0 ? pendingImages : undefined,
    });

    // Send to server via WebSocket
    ws.sendDirectChat(conversation.id, content, conversation.messages, pendingImages.length > 0 ? pendingImages : undefined);
    setInput('');
    setPendingImages([]);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
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
    if (!conversation) return 'bg-gray-400';
    switch (conversation.state) {
      case 'busy': return 'bg-green-500 animate-pulse';
      case 'idle': return 'bg-violet-500';
      case 'error': return 'bg-red-500';
      default: return 'bg-gray-400';
    }
  };

  const getStatusText = () => {
    if (!conversation) return 'No conversation';
    switch (conversation.state) {
      case 'busy': return 'Thinking...';
      case 'idle': return 'Ready';
      case 'error': return 'Error';
      default: return conversation.state;
    }
  };

  // Minimized view
  if (widget.minimized) {
    return (
      <div className="widget-drag-handle h-full bg-white rounded-lg border border-gray-200 shadow-sm flex items-center gap-3 px-4 cursor-move">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <MessageCircle className="w-4 h-4 text-violet-500" />
        <span className="text-sm font-medium text-gray-700 truncate flex-1">
          {currentTitle}
        </span>
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
    <div
      ref={containerRef}
      tabIndex={0}
      className="h-full flex flex-col bg-white rounded-lg border border-violet-200 shadow-sm overflow-hidden focus:outline-none">
      {/* Header */}
      <div className="widget-drag-handle flex-none h-10 flex items-center gap-2 px-3 border-b border-violet-100 bg-violet-50 cursor-move">
        <div className={`w-2 h-2 rounded-full ${getStatusColor()}`} />
        <MessageCircle className="w-4 h-4 text-violet-500" />

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
              className="flex-1 px-1 py-0.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded focus:outline-none focus:border-violet-400"
              autoFocus
            />
            <button
              onClick={handleSaveTitle}
              className="p-0.5 hover:bg-violet-200 rounded"
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
              className="p-0.5 hover:bg-violet-200 rounded opacity-0 group-hover:opacity-100 transition-opacity"
              title="Edit title"
            >
              <Pencil className="w-3 h-3 text-gray-400" />
            </button>
          </div>
        )}

        <span className="text-xs text-gray-400">
          {getStatusText()}
        </span>
        <div className="flex items-center gap-1" onClick={e => e.stopPropagation()} onMouseDown={e => e.stopPropagation()}>
          <button
            onClick={() => toggleWidgetMinimized(widget.id)}
            className="p-1 hover:bg-violet-200 rounded"
          >
            <Minimize2 className="w-4 h-4 text-gray-500" />
          </button>
          <button
            onClick={() => removeWidget(widget.id)}
            className="p-1 hover:bg-violet-200 rounded"
          >
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-hidden bg-white">
        {conversation && conversation.messages.length > 0 ? (
          <MessageList
            messages={conversation.messages}
            showStreaming={widget.showStreaming}
            isBusy={conversation.state === 'busy'}
          />
        ) : (
          <div className="h-full flex flex-col items-center justify-center p-6 text-center">
            <div className="w-12 h-12 rounded-full bg-violet-100 flex items-center justify-center mb-4">
              <MessageCircle className="w-6 h-6 text-violet-600" />
            </div>
            <h3 className="text-lg font-medium text-gray-900 mb-2">Direct Chat</h3>
            <p className="text-sm text-gray-500 max-w-xs">
              Chat directly with Claude without agent tools. Great for questions, brainstorming, and discussions.
            </p>
          </div>
        )}
      </div>

      {/* Pending Images Preview */}
      {pendingImages.length > 0 && (
        <div className="flex-none px-3 py-2 border-t border-violet-100 bg-violet-50/50">
          <div className="flex items-center gap-1 mb-1">
            <ImageIcon className="w-3 h-3 text-violet-500" />
            <span className="text-xs text-violet-600 font-medium">
              {pendingImages.length} image{pendingImages.length > 1 ? 's' : ''} attached
            </span>
          </div>
          <div className="flex gap-2 flex-wrap">
            {pendingImages.map(img => (
              <div key={img.id} className="relative group">
                <img
                  src={`data:${img.mediaType};base64,${img.data}`}
                  alt={img.name || 'Pasted image'}
                  className="h-16 w-16 object-cover rounded border border-violet-200 cursor-pointer hover:border-violet-400 transition-colors"
                  onClick={() => setPreviewImage(img)}
                />
                <button
                  onClick={() => removeImage(img.id)}
                  className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
                  title="Remove image"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Input */}
      <div className="flex-none p-3 border-t border-violet-100 bg-violet-50">
        <div className="flex items-center gap-2">
          <input
            ref={inputRef}
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={conversation?.state === 'busy' ? 'Waiting for response...' : pendingImages.length > 0 ? 'Add a message or press Enter...' : 'Paste images or type a message...'}
            disabled={!conversation || conversation.state === 'busy'}
            className="flex-1 px-3 py-2 rounded-lg bg-white border border-violet-200 text-gray-700 text-sm placeholder:text-gray-400 focus:outline-none focus:border-violet-400 disabled:opacity-50"
          />
          <button
            onClick={handleSend}
            disabled={(!input.trim() && pendingImages.length === 0) || !conversation || conversation.state === 'busy'}
            className="p-2 rounded-lg bg-violet-600 hover:bg-violet-500 text-white disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            title="Send message"
          >
            {conversation?.state === 'busy' ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              <Send className="w-4 h-4" />
            )}
          </button>
        </div>
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
    </div>
  );
}
