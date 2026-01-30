import { useState } from 'react'
import { Eye, Edit2 } from 'lucide-react'

interface MarkdownEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  rows?: number
  className?: string
}

export default function MarkdownEditor({
  value,
  onChange,
  placeholder = 'Write your content here... (Markdown supported)',
  rows = 4,
  className = '',
}: MarkdownEditorProps) {
  const [showPreview, setShowPreview] = useState(false)

  // Simple markdown to HTML conversion for preview
  const renderMarkdown = (text: string) => {
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```([^`]+)```/g, '<pre class="bg-gray-100 p-2 rounded my-2 overflow-x-auto"><code>$1</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 rounded">$1</code>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-3 mb-1">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-4 mb-2">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-4 mb-2">$1</h1>')
      // Line breaks
      .replace(/\n/g, '<br />')

    return html
  }

  return (
    <div className={`border border-theme-border rounded-lg overflow-hidden ${className}`}>
      {/* Toolbar */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-theme-border bg-theme-bg-elevated">
        <span className="text-xs text-theme-text-secondary">Markdown supported</span>
        <button
          type="button"
          onClick={() => setShowPreview(!showPreview)}
          className="flex items-center gap-1 text-xs text-theme-text-secondary hover:text-theme-text-primary transition-colors"
        >
          {showPreview ? (
            <>
              <Edit2 className="w-3.5 h-3.5" />
              Edit
            </>
          ) : (
            <>
              <Eye className="w-3.5 h-3.5" />
              Preview
            </>
          )}
        </button>
      </div>

      {/* Content */}
      {showPreview ? (
        <div
          className="p-3 min-h-[100px] prose prose-sm max-w-none text-theme-text-primary"
          dangerouslySetInnerHTML={{ __html: renderMarkdown(value) || '<span class="text-theme-text-secondary">Nothing to preview</span>' }}
        />
      ) : (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={rows}
          className="w-full p-3 bg-transparent text-theme-text-primary placeholder-theme-text-secondary resize-none focus:outline-none"
        />
      )}
    </div>
  )
}
