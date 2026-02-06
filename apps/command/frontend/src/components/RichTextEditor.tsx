import { useRef, useEffect, useCallback } from 'react'
import { Bold, Italic, Link as LinkIcon } from 'lucide-react'

interface RichTextEditorProps {
  value: string
  onChange: (value: string) => void
  placeholder?: string
  className?: string
  disabled?: boolean
  minHeight?: number
}

export default function RichTextEditor({
  value,
  onChange,
  placeholder = 'Add a comment...',
  className = '',
  disabled = false,
  minHeight = 36,
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null)
  const isUpdatingRef = useRef(false)

  // Sync value to editor when it changes externally (e.g., clearing after submit)
  useEffect(() => {
    if (editorRef.current && !isUpdatingRef.current) {
      if (value === '' && editorRef.current.innerHTML !== '') {
        editorRef.current.innerHTML = ''
      }
    }
  }, [value])

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      isUpdatingRef.current = true
      onChange(editorRef.current.innerHTML)
      setTimeout(() => {
        isUpdatingRef.current = false
      }, 0)
    }
  }, [onChange])

  const execCommand = (command: string, value?: string) => {
    document.execCommand(command, false, value)
    editorRef.current?.focus()
    handleInput()
  }

  const handleBold = () => execCommand('bold')
  const handleItalic = () => execCommand('italic')

  const handleLink = () => {
    const url = prompt('Enter URL:')
    if (url) {
      execCommand('createLink', url)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    // Ctrl/Cmd + B for bold
    if ((e.ctrlKey || e.metaKey) && e.key === 'b') {
      e.preventDefault()
      handleBold()
    }
    // Ctrl/Cmd + I for italic
    if ((e.ctrlKey || e.metaKey) && e.key === 'i') {
      e.preventDefault()
      handleItalic()
    }
    // Ctrl/Cmd + K for link
    if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
      e.preventDefault()
      handleLink()
    }
  }

  const isEmpty = !value || value === '<br>' || value === '<div><br></div>'

  return (
    <div className={`relative ${className}`}>
      {/* Formatting toolbar */}
      <div className="flex items-center gap-0.5 mb-1">
        <button
          type="button"
          onClick={handleBold}
          disabled={disabled}
          className="p-1 rounded hover:bg-theme-bg-elevated text-theme-text-secondary hover:text-theme-text-primary transition-colors disabled:opacity-50"
          title="Bold (Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleItalic}
          disabled={disabled}
          className="p-1 rounded hover:bg-theme-bg-elevated text-theme-text-secondary hover:text-theme-text-primary transition-colors disabled:opacity-50"
          title="Italic (Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={handleLink}
          disabled={disabled}
          className="p-1 rounded hover:bg-theme-bg-elevated text-theme-text-secondary hover:text-theme-text-primary transition-colors disabled:opacity-50"
          title="Add Link (Ctrl+K)"
        >
          <LinkIcon className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Editable content area */}
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable={!disabled}
          onInput={handleInput}
          onKeyDown={handleKeyDown}
          className={`
            w-full px-3 py-2 bg-theme-bg-elevated border border-theme-border rounded-lg
            text-xs text-theme-text-primary
            focus:outline-none focus:ring-1 focus:ring-primary-500 focus:border-primary-500
            overflow-y-auto
            ${disabled ? 'opacity-50 cursor-not-allowed' : ''}
            [&_a]:text-primary-600 [&_a]:underline
          `}
          style={{
            minHeight: `${minHeight}px`,
            maxHeight: '150px',
          }}
          suppressContentEditableWarning
        />
        {/* Placeholder */}
        {isEmpty && (
          <div
            className="absolute top-2 left-3 text-xs text-theme-text-secondary pointer-events-none"
          >
            {placeholder}
          </div>
        )}
      </div>
    </div>
  )
}

// Helper to extract plain text from HTML for display purposes
export function htmlToPlainText(html: string): string {
  const div = document.createElement('div')
  div.innerHTML = html
  return div.textContent || div.innerText || ''
}

// Helper to check if content is empty
export function isRichTextEmpty(html: string): boolean {
  if (!html) return true
  const plainText = htmlToPlainText(html).trim()
  return plainText === ''
}
