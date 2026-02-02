import { create } from 'zustand'
import { WidgetInstance, WidgetConfig } from '../components/dashboard/widgets/types'

const STORAGE_KEY = 'expertly-manage-dashboard-layout'

export interface DashboardState {
  widgets: WidgetInstance[]
  editMode: boolean
  isLoaded: boolean  // Tracks if we've loaded from storage to prevent race condition

  setEditMode: (editMode: boolean) => void
  addWidget: (type: string, config?: WidgetConfig) => void
  removeWidget: (widgetId: string) => void
  updateWidgetLayout: (widgetId: string, layout: { x: number; y: number; w: number; h: number }) => void
  updateWidgetConfig: (widgetId: string, config: Partial<WidgetConfig>) => void
  updateAllLayouts: (layouts: Array<{ i: string; x: number; y: number; w: number; h: number }>) => void
  resetToDefault: () => void
  loadFromStorage: () => void
}

const DEFAULT_WIDGETS: WidgetInstance[] = [
  {
    id: 'team-members',
    type: 'team-members',
    config: {},
    layout: { x: 0, y: 0, w: 12, h: 3 },
  },
  {
    id: 'stats-overview',
    type: 'stats-overview',
    config: {},
    layout: { x: 0, y: 3, w: 12, h: 2 },
  },
  {
    id: 'my-active-tasks',
    type: 'my-active-tasks',
    config: {},
    layout: { x: 0, y: 5, w: 8, h: 5 },
  },
  {
    id: 'my-queues',
    type: 'my-queues',
    config: {},
    layout: { x: 8, y: 5, w: 4, h: 5 },
  },
  {
    id: 'monitors-summary',
    type: 'monitors-summary',
    config: {},
    layout: { x: 0, y: 10, w: 12, h: 3 },
  },
]

function generateWidgetId(type: string): string {
  return `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`
}

function saveToStorage(widgets: WidgetInstance[]): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(widgets))
  } catch (error) {
    console.error('Failed to save dashboard layout:', error)
  }
}

function loadFromLocalStorage(): WidgetInstance[] | null {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) {
      return JSON.parse(stored)
    }
  } catch (error) {
    console.error('Failed to load dashboard layout:', error)
  }
  return null
}

function findNextPosition(widgets: WidgetInstance[]): { x: number; y: number } {
  if (widgets.length === 0) {
    return { x: 0, y: 0 }
  }

  const maxY = Math.max(...widgets.map(w => w.layout.y + w.layout.h))
  return { x: 0, y: maxY }
}

export const useDashboardStore = create<DashboardState>((set, get) => ({
  widgets: DEFAULT_WIDGETS,
  editMode: false,
  isLoaded: false,

  setEditMode: (editMode) => set({ editMode }),

  addWidget: (type, config = {}) => {
    const { widgets } = get()
    const { widgetRegistry } = require('../components/dashboard/widgets/registry')
    const definition = widgetRegistry[type]

    if (!definition) {
      console.error(`Unknown widget type: ${type}`)
      return
    }

    const position = findNextPosition(widgets)
    const newWidget: WidgetInstance = {
      id: generateWidgetId(type),
      type,
      config,
      layout: {
        ...position,
        w: definition.defaultSize.w,
        h: definition.defaultSize.h,
      },
    }

    const newWidgets = [...widgets, newWidget]
    saveToStorage(newWidgets)
    set({ widgets: newWidgets })
  },

  removeWidget: (widgetId) => {
    const { widgets } = get()
    const newWidgets = widgets.filter(w => w.id !== widgetId)
    saveToStorage(newWidgets)
    set({ widgets: newWidgets })
  },

  updateWidgetLayout: (widgetId, layout) => {
    const { widgets } = get()
    const newWidgets = widgets.map(w =>
      w.id === widgetId ? { ...w, layout } : w
    )
    saveToStorage(newWidgets)
    set({ widgets: newWidgets })
  },

  updateWidgetConfig: (widgetId, config) => {
    const { widgets } = get()
    const newWidgets = widgets.map(w =>
      w.id === widgetId ? { ...w, config: { ...w.config, ...config } } : w
    )
    saveToStorage(newWidgets)
    set({ widgets: newWidgets })
  },

  updateAllLayouts: (layouts) => {
    const { widgets, isLoaded } = get()
    // Don't save during initial load to prevent race condition overwriting saved state
    if (!isLoaded) {
      return
    }
    const newWidgets = widgets.map(w => {
      const layoutUpdate = layouts.find(l => l.i === w.id)
      if (layoutUpdate) {
        return {
          ...w,
          layout: {
            x: layoutUpdate.x,
            y: layoutUpdate.y,
            w: layoutUpdate.w,
            h: layoutUpdate.h,
          },
        }
      }
      return w
    })
    saveToStorage(newWidgets)
    set({ widgets: newWidgets })
  },

  resetToDefault: () => {
    saveToStorage(DEFAULT_WIDGETS)
    set({ widgets: DEFAULT_WIDGETS, editMode: false })
  },

  loadFromStorage: () => {
    const stored = loadFromLocalStorage()
    if (stored && stored.length > 0) {
      set({ widgets: stored, isLoaded: true })
    } else {
      set({ isLoaded: true })
    }
  },
}))
