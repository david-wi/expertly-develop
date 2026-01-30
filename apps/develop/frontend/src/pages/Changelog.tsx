import { ChangelogPage, type ChangelogEntry } from '@expertly/ui'
import { Play } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-28',
    added: [
      'Walkthrough artifact generation',
      'Job queue for processing walkthrough requests',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Project management with visual walkthrough tracking',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Develop',
      'Automated visual walkthrough generation',
      'Project and job management',
      'Artifact storage and viewing',
    ],
  },
]

export default function ChangelogRoute() {
  return (
    <ChangelogPage
      appName="Expertly Develop"
      entries={changelog}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Play className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
