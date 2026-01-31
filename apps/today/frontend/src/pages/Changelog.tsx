import { useEffect, useState } from 'react'
import { ChangelogPage, type ChangelogEntry, type GitCommitEntry } from '@expertly/ui'
import { Calendar } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-29',
    added: [
      'Artifacts page for document management',
      'Settings page for user preferences',
    ],
  },
  {
    date: '2026-01-28',
    added: [
      'Instructions page for workflow documentation',
      'Playbooks for repeatable processes',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Client management',
      'Questions tracking system',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Today',
      'Task and workflow management',
      'Project organization',
      'People directory',
      'Dashboard with daily overview',
    ],
  },
]

export function Changelog() {
  const [gitCommits, setGitCommits] = useState<GitCommitEntry[]>([])

  useEffect(() => {
    fetch('/commits.json')
      .then(res => res.ok ? res.json() : [])
      .then(setGitCommits)
      .catch(() => setGitCommits([]))
  }, [])

  return (
    <ChangelogPage
      appName="Expertly Today"
      entries={changelog}
      gitCommits={gitCommits}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Calendar className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
