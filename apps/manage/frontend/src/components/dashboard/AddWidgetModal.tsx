import { useEffect } from 'react'
import { X } from 'lucide-react'
import { widgetList } from './widgets/registry'
import { useDashboardStore } from '../../stores/dashboardStore'

interface AddWidgetModalProps {
  isOpen: boolean
  onClose: () => void
}

export function AddWidgetModal({ isOpen, onClose }: AddWidgetModalProps) {
  const { widgets, addWidget } = useDashboardStore()

  // Handle escape key
  useEffect(() => {
    if (!isOpen) return
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }
    document.addEventListener('keydown', handleEscape)
    return () => document.removeEventListener('keydown', handleEscape)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const activeWidgetTypes = new Set(widgets.map(w => w.type))

  const handleAddWidget = (widgetType: string) => {
    addWidget(widgetType)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="flex items-center justify-center min-h-screen px-4">
        <div className="fixed inset-0 bg-black bg-opacity-30" onClick={onClose} />
        <div className="relative bg-white rounded-lg shadow-xl max-w-lg w-full">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Add Widget</h3>
            <button
              onClick={onClose}
              className="p-1 text-gray-400 hover:text-gray-600 rounded transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <div className="p-6">
            <div className="grid grid-cols-2 gap-4">
              {widgetList.map((widget) => {
                const isActive = activeWidgetTypes.has(widget.id)
                const Icon = widget.icon
                return (
                  <div
                    key={widget.id}
                    className={`p-4 border rounded-lg ${
                      isActive
                        ? 'border-gray-200 bg-gray-50 opacity-60'
                        : 'border-gray-200 hover:border-primary-300 hover:bg-primary-50 cursor-pointer'
                    }`}
                    onClick={() => !isActive && handleAddWidget(widget.id)}
                  >
                    <div className="flex items-start gap-3">
                      <div className={`p-2 rounded-lg ${isActive ? 'bg-gray-200' : 'bg-primary-100'}`}>
                        <Icon className={`w-5 h-5 ${isActive ? 'text-gray-500' : 'text-primary-600'}`} />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className={`font-medium ${isActive ? 'text-gray-500' : 'text-gray-900'}`}>
                          {widget.name}
                        </p>
                        <p className="text-sm text-gray-500 mt-1">{widget.description}</p>
                        {isActive && (
                          <span className="inline-block mt-2 text-xs text-gray-500 bg-gray-200 px-2 py-0.5 rounded">
                            Already added
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
