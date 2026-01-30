import { ChangelogPage, type ChangelogEntry } from '@expertly/ui'
import { Settings } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-29',
    added: [
      'AI configuration management page',
      'Centralized AI model settings across all Expertly apps',
    ],
  },
  {
    date: '2026-01-28',
    added: [
      'Server metrics dashboard (CPU, memory, disk, network)',
      'Service health monitoring for all Expertly apps',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Error logs page with filtering and status tracking',
      'UserMenu with Developer Tools submenu',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-26',
    added: [
      'Theme version history with restore functionality',
      'Theme management CRUD operations',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Admin',
      'Theme management across all Expertly applications',
      'Public themes API for other apps',
    ],
  },
]

export function Changelog() {
  return (
    <ChangelogPage
      appName="Expertly Admin"
      entries={changelog}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Settings className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
