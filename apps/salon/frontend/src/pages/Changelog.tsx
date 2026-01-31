import { useEffect, useState } from 'react'
import { ChangelogPage, type ChangelogEntry, type GitCommitEntry } from '@expertly/ui'
import { Scissors } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-28',
    added: [
      'Website builder for salon landing pages',
      'Promotion management system',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Waitlist management',
      'Client feedback collection',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-26',
    added: [
      'Service category management',
      'Staff schedule management',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Salon',
      'Appointment booking and calendar management',
      'Client management with history',
      'Staff and services configuration',
      'Reports and analytics dashboard',
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
      appName="Expertly Salon"
      entries={changelog}
      gitCommits={gitCommits}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <Scissors className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
