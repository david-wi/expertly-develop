import { useEffect, useState } from 'react'
import { ChangelogPage, type ChangelogEntry, type GitCommitEntry } from '@expertly/ui'
import { Users } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-28',
    added: [
      'Magic link authentication',
      'Password reset flow',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Organization management',
      'Team management within organizations',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-26',
    added: [
      'User profile management',
      'Bot user support for API access',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Identity',
      'Centralized user authentication for all Expertly apps',
      'JWT-based session management',
      'User and team management',
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
      appName="Expertly Identity"
      entries={changelog}
      gitCommits={gitCommits}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Users className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
