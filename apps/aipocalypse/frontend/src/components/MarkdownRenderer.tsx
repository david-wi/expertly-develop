import ReactMarkdown from 'react-markdown'

export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null
  return (
    <div className="prose prose-sm max-w-none prose-headings:text-gray-900 prose-p:text-gray-700 prose-li:text-gray-700 prose-strong:text-gray-900 prose-table:text-sm prose-th:bg-gray-50 prose-th:px-3 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-gray-700 prose-th:border-b prose-th:border-gray-200 prose-td:px-3 prose-td:py-2 prose-td:border-b prose-td:border-gray-100 prose-table:w-full prose-table:border-collapse prose-h3:text-base prose-h3:mt-4 prose-h3:mb-2 prose-p:my-2 prose-ul:my-2 prose-ol:my-2 prose-li:my-0.5 prose-hr:my-4">
      <ReactMarkdown>{content}</ReactMarkdown>
    </div>
  )
}
