import { ChangelogPage, type ChangelogEntry } from '@expertly/ui'
import { Layers } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-30',
    added: [
      'BotMessageSquare icon for Users and Bots section',
    ],
    fixed: [
      'Entire table row now draggable in Projects page',
      'Improved drag handle behavior in Projects page',
    ],
  },
  {
    date: '2026-01-29',
    added: [
      'Unlimited project nesting depth with drag-and-drop reparenting',
      'Icon buttons for project actions in Projects view',
    ],
    changed: [
      'Use centralized ai-config package for AI Assist',
    ],
  },
  {
    date: '2026-01-28',
    added: [
      'AI-assisted step generation for playbooks',
      'Connections feature with OAuth providers (GitHub, Linear, Jira)',
      'Setup instructions for unconfigured connection providers',
    ],
    fixed: [
      'Bot icon display in sidebar',
      'Sidebar subproject display',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Backlog and Idea Backlog pages for task management',
      'UserMenu submenu support for developer tools',
      'Project Detail page with tabbed interface',
    ],
    changed: [
      'Simplified default queues to just Inbox',
    ],
    fixed: [
      'Theme colors across the application',
      'Added About links to all pages',
    ],
  },
  {
    date: '2026-01-26',
    fixed: [
      'Sidebar alphabetization and project serialization',
      'Nginx cache headers to prevent stale HTML after deployments',
      'Tailwind content paths for UI package class scanning',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Manage',
      'Queue-driven task management system',
      'Team and user management',
      'Recurring task scheduling',
      'Real-time WebSocket updates',
    ],
  },
]

export default function ChangelogRoute() {
  return (
    <ChangelogPage
      appName="Expertly Manage"
      entries={changelog}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Layers className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
