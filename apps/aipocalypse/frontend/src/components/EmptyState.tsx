import type { LucideIcon } from 'lucide-react'

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
}: {
  icon: LucideIcon
  title: string
  description: string
  action?: { label: string; onClick: () => void }
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-12 text-center">
      <Icon className="w-12 h-12 text-gray-300 mx-auto mb-4" />
      <h2 className="text-lg font-semibold text-gray-700 mb-2">{title}</h2>
      <p className="text-gray-500 max-w-md mx-auto mb-6">{description}</p>
      {action && (
        <button
          onClick={action.onClick}
          className="px-4 py-2 bg-violet-600 text-white rounded-lg hover:bg-violet-700 transition-colors text-sm font-medium"
        >
          {action.label}
        </button>
      )}
    </div>
  )
}
