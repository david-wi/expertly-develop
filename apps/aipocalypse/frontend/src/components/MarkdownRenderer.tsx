import ReactMarkdown from 'react-markdown'

/**
 * Pre-process markdown to improve structure:
 * - Standalone bold lines ("**Revenue by Geography:**") → h4 headings
 */
function preprocessMarkdown(content: string): string {
  return content.split('\n').map(line => {
    const trimmed = line.trim()
    // "**Some Label:**" (entire line is bold with trailing colon) → heading
    const boldColon = trimmed.match(/^\*\*(.+?):\*\*\s*$/)
    if (boldColon) return `#### ${boldColon[1]}`
    // "**Some Label**" (entire line is bold, no colon) → heading
    const boldPlain = trimmed.match(/^\*\*([^*]+)\*\*\s*$/)
    if (boldPlain) return `#### ${boldPlain[1]}`
    return line
  }).join('\n')
}

export function MarkdownRenderer({ content }: { content: string }) {
  if (!content) return null
  const processed = preprocessMarkdown(content)
  return (
    <div>
      <ReactMarkdown
        components={{
          h1: ({ children }) => (
            <h1 className="text-xl font-bold text-gray-900 mt-8 mb-3 pb-2 border-b border-gray-200 first:mt-0">
              {children}
            </h1>
          ),
          h2: ({ children }) => (
            <h2 className="text-lg font-semibold text-gray-900 mt-7 mb-3 pb-2 border-b border-gray-100 first:mt-0">
              {children}
            </h2>
          ),
          h3: ({ children }) => (
            <h3 className="text-[15px] font-semibold text-gray-900 mt-6 mb-2 pl-3 border-l-4 border-violet-400 first:mt-0">
              {children}
            </h3>
          ),
          h4: ({ children }) => (
            <h4 className="text-[13px] font-semibold text-gray-700 mt-5 mb-1.5 pl-2.5 border-l-2 border-gray-300 first:mt-0">
              {children}
            </h4>
          ),
          p: ({ children }) => (
            <p className="text-[13px] leading-[1.75] text-gray-600 my-2.5">
              {children}
            </p>
          ),
          strong: ({ children }) => (
            <strong className="font-semibold text-gray-900">{children}</strong>
          ),
          em: ({ children }) => (
            <em className="italic text-gray-500">{children}</em>
          ),
          ul: ({ children }) => (
            <ul className="my-3 ml-4 space-y-1.5 list-disc marker:text-violet-400">{children}</ul>
          ),
          ol: ({ children }) => (
            <ol className="my-3 ml-4 space-y-1.5 list-decimal marker:text-violet-400">{children}</ol>
          ),
          li: ({ children }) => (
            <li className="text-[13px] text-gray-600 leading-[1.75] pl-1">
              {children}
            </li>
          ),
          table: ({ children }) => (
            <div className="my-5 overflow-x-auto rounded-lg border border-gray-200 shadow-sm">
              <table className="w-full text-sm border-collapse">{children}</table>
            </div>
          ),
          thead: ({ children }) => (
            <thead className="bg-gray-50 border-b border-gray-200">{children}</thead>
          ),
          tbody: ({ children }) => (
            <tbody className="divide-y divide-gray-100">{children}</tbody>
          ),
          tr: ({ children }) => (
            <tr className="even:bg-gray-50/50">{children}</tr>
          ),
          th: ({ children }) => (
            <th className="px-4 py-2.5 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
              {children}
            </th>
          ),
          td: ({ children }) => (
            <td className="px-4 py-2.5 text-[13px] text-gray-700">{children}</td>
          ),
          blockquote: ({ children }) => (
            <blockquote className="my-4 pl-4 border-l-4 border-amber-300 bg-amber-50/50 rounded-r-lg py-2 pr-3">
              {children}
            </blockquote>
          ),
          hr: () => <hr className="my-6 border-gray-200" />,
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noopener noreferrer" className="text-violet-600 hover:text-violet-800 underline decoration-violet-200 underline-offset-2">
              {children}
            </a>
          ),
          code: ({ children }) => (
            <code className="bg-gray-100 text-gray-800 text-xs px-1.5 py-0.5 rounded font-mono">{children}</code>
          ),
          pre: ({ children }) => (
            <pre className="my-4 bg-gray-900 text-gray-100 rounded-lg p-4 overflow-x-auto text-xs leading-relaxed">
              {children}
            </pre>
          ),
        }}
      >
        {processed}
      </ReactMarkdown>
    </div>
  )
}
