import { describe, it, expect, beforeEach, vi } from 'vitest'
import { useDashboardStore } from './dashboardStore'

// Mock localStorage
const localStorageMock = (() => {
  let store: Record<string, string> = {}
  return {
    getItem: vi.fn((key: string) => store[key] || null),
    setItem: vi.fn((key: string, value: string) => {
      store[key] = value
    }),
    removeItem: vi.fn((key: string) => {
      delete store[key]
    }),
    clear: vi.fn(() => {
      store = {}
    }),
  }
})()

Object.defineProperty(global, 'localStorage', { value: localStorageMock })

describe('dashboardStore', () => {
  beforeEach(() => {
    localStorageMock.clear()
    vi.clearAllMocks()
    useDashboardStore.setState({
      widgets: [
        { id: 'stats-overview', type: 'stats-overview', config: {}, layout: { x: 0, y: 0, w: 12, h: 2 } },
        { id: 'my-active-tasks', type: 'my-active-tasks', config: {}, layout: { x: 0, y: 2, w: 8, h: 5 } },
        { id: 'my-queues', type: 'my-queues', config: {}, layout: { x: 8, y: 2, w: 4, h: 5 } },
        { id: 'monitors-summary', type: 'monitors-summary', config: {}, layout: { x: 0, y: 7, w: 12, h: 3 } },
      ],
      editMode: false,
    })
  })

  describe('initial state', () => {
    it('has default widgets', () => {
      const state = useDashboardStore.getState()
      expect(state.widgets).toHaveLength(4)
      expect(state.widgets.map(w => w.type)).toEqual([
        'stats-overview',
        'my-active-tasks',
        'my-queues',
        'monitors-summary',
      ])
    })

    it('starts with edit mode off', () => {
      const state = useDashboardStore.getState()
      expect(state.editMode).toBe(false)
    })
  })

  describe('setEditMode', () => {
    it('toggles edit mode on', () => {
      useDashboardStore.getState().setEditMode(true)
      expect(useDashboardStore.getState().editMode).toBe(true)
    })

    it('toggles edit mode off', () => {
      useDashboardStore.getState().setEditMode(true)
      useDashboardStore.getState().setEditMode(false)
      expect(useDashboardStore.getState().editMode).toBe(false)
    })
  })

  describe('removeWidget', () => {
    it('removes a widget by id', () => {
      useDashboardStore.getState().removeWidget('my-queues')
      const widgets = useDashboardStore.getState().widgets
      expect(widgets).toHaveLength(3)
      expect(widgets.find(w => w.id === 'my-queues')).toBeUndefined()
    })

    it('saves to localStorage after removing', () => {
      useDashboardStore.getState().removeWidget('my-queues')
      expect(localStorageMock.setItem).toHaveBeenCalledWith(
        'expertly-manage-dashboard-layout',
        expect.any(String)
      )
    })
  })

  describe('updateWidgetLayout', () => {
    it('updates widget layout', () => {
      useDashboardStore.getState().updateWidgetLayout('my-active-tasks', { x: 4, y: 4, w: 6, h: 4 })
      const widget = useDashboardStore.getState().widgets.find(w => w.id === 'my-active-tasks')
      expect(widget?.layout).toEqual({ x: 4, y: 4, w: 6, h: 4 })
    })
  })

  describe('updateAllLayouts', () => {
    it('updates all widget layouts at once', () => {
      useDashboardStore.getState().updateAllLayouts([
        { i: 'stats-overview', x: 0, y: 0, w: 6, h: 2 },
        { i: 'my-active-tasks', x: 6, y: 0, w: 6, h: 5 },
      ])

      const widgets = useDashboardStore.getState().widgets
      const stats = widgets.find(w => w.id === 'stats-overview')
      const tasks = widgets.find(w => w.id === 'my-active-tasks')

      expect(stats?.layout.w).toBe(6)
      expect(tasks?.layout.x).toBe(6)
    })
  })

  describe('resetToDefault', () => {
    it('restores default widgets', () => {
      useDashboardStore.getState().removeWidget('my-queues')
      useDashboardStore.getState().removeWidget('monitors-summary')
      expect(useDashboardStore.getState().widgets).toHaveLength(2)

      useDashboardStore.getState().resetToDefault()
      expect(useDashboardStore.getState().widgets).toHaveLength(4)
    })

    it('turns off edit mode', () => {
      useDashboardStore.getState().setEditMode(true)
      useDashboardStore.getState().resetToDefault()
      expect(useDashboardStore.getState().editMode).toBe(false)
    })
  })

  describe('loadFromStorage', () => {
    it('loads widgets from localStorage', () => {
      const customWidgets = [
        { id: 'custom-1', type: 'stats-overview', config: {}, layout: { x: 0, y: 0, w: 6, h: 2 } },
      ]
      localStorageMock.getItem.mockReturnValueOnce(JSON.stringify(customWidgets))

      useDashboardStore.getState().loadFromStorage()
      expect(useDashboardStore.getState().widgets).toHaveLength(1)
      expect(useDashboardStore.getState().widgets[0].id).toBe('custom-1')
    })

    it('keeps default widgets if storage is empty', () => {
      localStorageMock.getItem.mockReturnValueOnce(null)
      useDashboardStore.getState().loadFromStorage()
      expect(useDashboardStore.getState().widgets).toHaveLength(4)
    })
  })
})
