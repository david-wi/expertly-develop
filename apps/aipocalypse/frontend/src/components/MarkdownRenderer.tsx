import ReactMarkdown from 'react-markdown'

export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
