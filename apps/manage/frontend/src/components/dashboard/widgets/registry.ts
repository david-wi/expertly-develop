import { LayoutDashboard, ListTodo, Inbox, Activity } from 'lucide-react'
import { WidgetDefinition } from './types'
import { StatsOverviewWidget } from './StatsOverviewWidget'
import { MyActiveTasksWidget } from './MyActiveTasksWidget'
import { MyQueuesWidget } from './MyQueuesWidget'
import { MonitorsSummaryWidget } from './MonitorsSummaryWidget'

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'stats-overview': {
    id: 'stats-overview',
    name: 'Stats Overview',
    description: 'Quick overview of tasks and queues',
    icon: LayoutDashboard,
    defaultSize: { w: 12, h: 2 },
    minSize: { w: 6, h: 2 },
    maxSize: { w: 12, h: 3 },
    component: StatsOverviewWidget,
  },
  'my-active-tasks': {
    id: 'my-active-tasks',
    name: 'My Active Tasks',
    description: 'View and filter your active tasks',
    icon: ListTodo,
    defaultSize: { w: 8, h: 5 },
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 8 },
    component: MyActiveTasksWidget,
  },
  'my-queues': {
    id: 'my-queues',
    name: 'My Queues',
    description: 'Overview of all queues and their status',
    icon: Inbox,
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
    component: MyQueuesWidget,
  },
  'monitors-summary': {
    id: 'monitors-summary',
    name: 'Monitors Summary',
    description: 'Monitor status and activity',
    icon: Activity,
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 6, h: 2 },
    maxSize: { w: 12, h: 4 },
    component: MonitorsSummaryWidget,
  },
}

export const widgetList = Object.values(widgetRegistry)
