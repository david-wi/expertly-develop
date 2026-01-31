import { useEffect, useState } from 'react'
import { ChangelogPage, type ChangelogEntry, type GitCommitEntry } from '@expertly/ui'
import { TestTube } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-28',
    added: [
      'Environment setup page for test configurations',
      'Test run history and results viewer',
    ],
  },
  {
    date: '2026-01-27',
    added: [
      'Quick start guide for new users',
      'Project-level test organization',
    ],
    fixed: [
      'Theme colors and About links',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Vibetest',
      'Project and test case management',
      'Test execution with result tracking',
      'User authentication with JWT',
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
      appName="Expertly Vibetest"
      entries={changelog}
      gitCommits={gitCommits}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <TestTube className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
