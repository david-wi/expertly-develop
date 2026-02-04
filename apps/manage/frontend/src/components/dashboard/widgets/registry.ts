import { LayoutDashboard, ListTodo, Inbox, Activity, Users, ListChecks, ClipboardList, Footprints, FileText } from 'lucide-react'
import { WidgetDefinition } from './types'
import { StatsOverviewWidget } from './StatsOverviewWidget'
import { MyActiveTasksWidget } from './MyActiveTasksWidget'
import { ActiveTasksWidget } from './ActiveTasksWidget'
import { MyQueuesWidget } from './MyQueuesWidget'
import { MonitorsSummaryWidget } from './MonitorsSummaryWidget'
import { TeamMembersWidget } from './TeamMembersWidget'
import { SingleQueueWidget } from './SingleQueueWidget'
import { ProjectNextStepsWidget } from './ProjectNextStepsWidget'
import { DashboardNotesWidget } from './DashboardNotesWidget'

export const widgetRegistry: Record<string, WidgetDefinition> = {
  'team-members': {
    id: 'team-members',
    name: 'My Team',
    description: 'View your team members with avatars',
    icon: Users,
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 6, h: 3 },
    maxSize: { w: 12, h: 4 },
    component: TeamMembersWidget,
  },
  'stats-overview': {
    id: 'stats-overview',
    name: 'Stats Overview',
    description: 'Quick overview of tasks and queues',
    icon: LayoutDashboard,
    defaultSize: { w: 12, h: 3 },
    minSize: { w: 6, h: 3 },
    maxSize: { w: 12, h: 4 },
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
    hidden: true, // Hidden from Add Widget modal - already in default layout
  },
  'active-tasks': {
    id: 'active-tasks',
    name: 'Active Tasks',
    description: 'Show active tasks filtered by project or playbook',
    icon: ClipboardList,
    defaultSize: { w: 6, h: 5 },
    minSize: { w: 4, h: 3 },
    maxSize: { w: 12, h: 8 },
    component: ActiveTasksWidget,
    requiresConfig: 'active-tasks',
    allowMultiple: true,
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
  'single-queue': {
    id: 'single-queue',
    name: 'Queue',
    description: 'View tasks for a specific queue',
    icon: ListChecks,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
    component: SingleQueueWidget,
    requiresConfig: 'queue',
    allowMultiple: true,
  },
  'project-next-steps': {
    id: 'project-next-steps',
    name: 'Project Next Steps',
    description: 'Display next steps for a specific project',
    icon: Footprints,
    defaultSize: { w: 4, h: 4 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 8 },
    component: ProjectNextStepsWidget,
    requiresConfig: 'project',
    allowMultiple: true,
  },
  'dashboard-notes': {
    id: 'dashboard-notes',
    name: 'Notes',
    description: 'Personal markdown notes with tabs and version history',
    icon: FileText,
    defaultSize: { w: 4, h: 5 },
    minSize: { w: 3, h: 3 },
    maxSize: { w: 12, h: 10 },
    component: DashboardNotesWidget,
    requiresConfig: 'notes',
    allowMultiple: true,
  },
}

// Filter out hidden widgets for the Add Widget modal
export const widgetList = Object.values(widgetRegistry).filter(w => !w.hidden)
