import { cn } from '@/lib/utils'

interface MarkdownViewerProps {
  content: string
  className?: string
}

export function MarkdownViewer({ content, className }: MarkdownViewerProps) {
  // Simple markdown parsing for common patterns
  const parseMarkdown = (text: string): string => {
    let html = text
      // Escape HTML
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      // Headers
      .replace(/^### (.+)$/gm, '<h3 class="text-lg font-semibold mt-4 mb-2">$1</h3>')
      .replace(/^## (.+)$/gm, '<h2 class="text-xl font-semibold mt-6 mb-3">$1</h2>')
      .replace(/^# (.+)$/gm, '<h1 class="text-2xl font-bold mt-6 mb-4">$1</h1>')
      // Bold
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      // Italic
      .replace(/\*(.+?)\*/g, '<em>$1</em>')
      // Code blocks
      .replace(/```(\w*)\n([\s\S]*?)```/g, '<pre class="bg-gray-100 rounded-md p-4 overflow-x-auto my-4"><code>$2</code></pre>')
      // Inline code
      .replace(/`([^`]+)`/g, '<code class="bg-gray-100 px-1 py-0.5 rounded text-sm">$1</code>')
      // Unordered lists
      .replace(/^- (.+)$/gm, '<li class="ml-4">$1</li>')
      // Links
      .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" class="text-primary-600 hover:underline" target="_blank" rel="noopener noreferrer">$1</a>')
      // Horizontal rules
      .replace(/^---$/gm, '<hr class="my-4 border-gray-200" />')
      // Paragraphs (double newlines)
      .replace(/\n\n/g, '</p><p class="my-2">')
      // Single newlines in content
      .replace(/\n/g, '<br />')

    // Wrap list items in ul
    html = html.replace(/(<li[^>]*>.*?<\/li>)+/gs, '<ul class="list-disc my-2">$&</ul>')

    return `<p class="my-2">${html}</p>`
  }

  return (
    <div
      className={cn('prose prose-sm max-w-none', className)}
      dangerouslySetInnerHTML={{ __html: parseMarkdown(content) }}
    />
  )
}
