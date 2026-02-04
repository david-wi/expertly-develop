import { LucideIcon } from 'lucide-react'

export interface WidgetConfig {
  queueId?: string
  teamId?: string
  userId?: string
  limit?: number
  projectIds?: string[]  // Filter by one or more projects
  playbookId?: string    // Filter by playbook
  widgetTitle?: string   // Custom title for the widget
}

export interface WidgetProps {
  widgetId: string
  layout: { w: number; h: number }
  config: WidgetConfig
}

export interface WidgetDefinition {
  id: string
  name: string
  description: string
  icon: LucideIcon
  defaultSize: { w: number; h: number }
  minSize?: { w: number; h: number }
  maxSize?: { w: number; h: number }
  component: React.ComponentType<WidgetProps>
  requiresConfig?: 'queue' | 'team' | 'user' | 'active-tasks'
  allowMultiple?: boolean
  hidden?: boolean  // Hide from Add Widget modal but keep for backwards compatibility
}

export interface WidgetInstance {
  id: string
  type: string
  config: WidgetConfig
  layout: {
    x: number
    y: number
    w: number
    h: number
  }
}

export interface DashboardLayout {
  widgets: WidgetInstance[]
}
