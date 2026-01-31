import { useEffect } from 'react'
import GridLayout from 'react-grid-layout'
import { Plus, Settings, RotateCcw, Check } from 'lucide-react'
import { useDashboardStore } from '../../stores/dashboardStore'
import { widgetRegistry } from './widgets/registry'
import 'react-grid-layout/css/styles.css'

interface DashboardGridProps {
  onAddWidget: () => void
}

const COLS = 12
const ROW_HEIGHT = 60
const GRID_WIDTH = 1200

export function DashboardGrid({ onAddWidget }: DashboardGridProps) {
  const { widgets, editMode, setEditMode, updateAllLayouts, resetToDefault, loadFromStorage } = useDashboardStore()

  useEffect(() => {
    loadFromStorage()
  }, [loadFromStorage])

  const layout = widgets.map(widget => ({
    i: widget.id,
    x: widget.layout.x,
    y: widget.layout.y,
    w: widget.layout.w,
    h: widget.layout.h,
    minW: widgetRegistry[widget.type]?.minSize?.w,
    minH: widgetRegistry[widget.type]?.minSize?.h,
    maxW: widgetRegistry[widget.type]?.maxSize?.w,
    maxH: widgetRegistry[widget.type]?.maxSize?.h,
  }))

  const handleLayoutChange = (newLayout: GridLayout.Layout[]) => {
    updateAllLayouts(newLayout.map(l => ({
      i: l.i,
      x: l.x,
      y: l.y,
      w: l.w,
      h: l.h,
    })))
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-end gap-2">
        {editMode ? (
          <>
            <button
              onClick={onAddWidget}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Add Widget
            </button>
            <button
              onClick={resetToDefault}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
            >
              <RotateCcw className="w-4 h-4" />
              Reset
            </button>
            <button
              onClick={() => setEditMode(false)}
              className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-white bg-primary-600 rounded-md hover:bg-primary-700 transition-colors"
            >
              <Check className="w-4 h-4" />
              Done
            </button>
          </>
        ) : (
          <button
            onClick={() => setEditMode(true)}
            className="inline-flex items-center gap-2 px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 transition-colors"
          >
            <Settings className="w-4 h-4" />
            Customize Dashboard
          </button>
        )}
      </div>

      <div className={`relative ${editMode ? 'ring-2 ring-primary-200 ring-offset-2 rounded-lg' : ''}`}>
        {editMode && (
          <div className="absolute inset-0 bg-gray-50/50 pointer-events-none rounded-lg" style={{ zIndex: 0 }} />
        )}
        <GridLayout
          className="layout"
          layout={layout}
          cols={COLS}
          rowHeight={ROW_HEIGHT}
          width={GRID_WIDTH}
          onLayoutChange={handleLayoutChange}
          isDraggable={editMode}
          isResizable={editMode}
          draggableHandle=".drag-handle"
          margin={[16, 16]}
          containerPadding={[0, 0]}
          useCSSTransforms={true}
        >
          {widgets.map(widget => {
            const definition = widgetRegistry[widget.type]
            if (!definition) {
              console.warn(`Unknown widget type: ${widget.type}`)
              return null
            }

            const Component = definition.component
            return (
              <div key={widget.id}>
                <Component
                  widgetId={widget.id}
                  layout={{ w: widget.layout.w, h: widget.layout.h }}
                  config={widget.config}
                />
              </div>
            )
          })}
        </GridLayout>
      </div>
    </div>
  )
}
