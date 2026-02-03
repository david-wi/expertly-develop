import { LucideIcon } from 'lucide-react'

export interface WidgetConfig {
  queueId?: string
  teamId?: string
  userId?: string
  limit?: number
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
  requiresConfig?: 'queue' | 'team' | 'user'
  allowMultiple?: boolean
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
