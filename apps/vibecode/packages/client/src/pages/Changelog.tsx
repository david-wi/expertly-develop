import { useEffect, useState } from 'react'
import { ChangelogPage, type ChangelogEntry, type GitCommitEntry } from '@expertly/ui'
import { Code } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-29',
    added: [
      'Hybrid execution mode (local or remote)',
      'Download banner for desktop agent',
    ],
  },
  {
    date: '2026-01-28',
    added: [
      'Multi-session management with draggable widgets',
      'Real-time streaming of Claude responses',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Status indicators for at-a-glance monitoring',
      'Layout persistence across sessions',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Vibecode',
      'Web-based dashboard for Claude Code agent sessions',
      'Draggable and resizable chat widgets',
      'WebSocket-based real-time communication',
    ],
  },
]

export default function ChangelogRoute() {
  const [gitCommits, setGitCommits] = useState<GitCommitEntry[]>([])

  useEffect(() => {
    fetch('/commits.json')
      .then(res => res.ok ? res.json() : [])
      .then(setGitCommits)
      .catch(() => setGitCommits([]))
  }, [])

  return (
    <ChangelogPage
      appName="Expertly Vibecode"
      entries={changelog}
      gitCommits={gitCommits}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Code className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
