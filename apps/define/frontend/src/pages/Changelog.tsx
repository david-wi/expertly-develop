import { ChangelogPage, type ChangelogEntry } from '@expertly/ui'
import { FileSpreadsheet } from 'lucide-react'

const changelog: ChangelogEntry[] = [
  {
    date: '2026-01-30',
    added: [
      'Artifact management with document conversion',
      'Version history tracking for all artifacts',
    ],
  },
  {
    date: '2026-01-28',
    added: [
      'AI-powered bulk requirements import (supports text, PDF, images)',
      'Jira integration for drafting and sending stories',
      'Release snapshots with verification stats',
    ],
  },
  {
    date: '2026-01-27',
    fixed: [
      'Theme colors and About links across all pages',
    ],
  },
  {
    date: '2026-01-25',
    added: [
      'Initial release of Expertly Define',
      'Product and requirements management with hierarchical tree structure',
      'Version history and change tracking',
      'Identity service authentication',
    ],
  },
]

export default function ChangelogRoute() {
  return (
    <ChangelogPage
      appName="Expertly Define"
      entries={changelog}
      appIcon={
        <div className="w-10 h-10 bg-primary-600 rounded-lg flex items-center justify-center">
          <FileSpreadsheet className="w-5 h-5 text-white" />
        </div>
      }
    />
  )
}
