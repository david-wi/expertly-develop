import { X, GripVertical } from 'lucide-react'
import { useDashboardStore } from '../../stores/dashboardStore'

interface WidgetWrapperProps {
  widgetId: string
  title: string
  children: React.ReactNode
  headerAction?: React.ReactNode
  titleUnderline?: boolean
}

export function WidgetWrapper({ widgetId, title, children, headerAction, titleUnderline }: WidgetWrapperProps) {
  const { editMode, removeWidget } = useDashboardStore()

  return (
    <div className="bg-white shadow rounded-lg h-full flex flex-col overflow-hidden">
      <div className={`px-4 py-3 border-b border-gray-200 flex items-center justify-between flex-shrink-0 ${editMode ? 'drag-handle cursor-grab active:cursor-grabbing' : ''}`}>
        <div className="flex items-center gap-2">
          {editMode && (
            <div className="text-gray-400 hover:text-gray-600 p-1 -ml-1 rounded hover:bg-gray-100">
              <GripVertical className="w-5 h-5" />
            </div>
          )}
          <div className="flex flex-col">
            <h3 className="text-lg font-medium text-gray-900">{title}</h3>
            {titleUnderline && <div className="w-16 h-0.5 bg-blue-400 mt-1 rounded-full" />}
          </div>
        </div>
        <div className="flex items-center gap-2">
          {headerAction}
          {editMode && (
            <button
              onClick={(e) => {
                e.stopPropagation()
                removeWidget(widgetId)
              }}
              onMouseDown={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              className="p-1 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors"
              title="Remove widget"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>
      <div className="flex-1 overflow-auto">
        {children}
      </div>
    </div>
  )
}
