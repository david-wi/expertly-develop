import { useState } from 'react'
import { FileText, Calendar, Plus, Wrench, Bug, Trash2, RefreshCw, GitCommit, BookOpen } from 'lucide-react'

export interface ChangelogEntry {
  date: string
  version?: string
  added?: string[]
  changed?: string[]
  fixed?: string[]
  removed?: string[]
  deprecated?: string[]
}

export interface GitCommitEntry {
  hash: string
  date: string
  message: string
}

export interface ChangelogPageProps {
  appName: string
  entries: ChangelogEntry[]
  appIcon?: React.ReactNode
  gitCommits?: GitCommitEntry[]
}

const categoryConfig = {
  added: { label: 'Added', icon: Plus, color: 'text-green-600', bg: 'bg-green-50' },
  changed: { label: 'Changed', icon: RefreshCw, color: 'text-blue-600', bg: 'bg-blue-50' },
  fixed: { label: 'Fixed', icon: Bug, color: 'text-orange-600', bg: 'bg-orange-50' },
  removed: { label: 'Removed', icon: Trash2, color: 'text-red-600', bg: 'bg-red-50' },
  deprecated: { label: 'Deprecated', icon: Wrench, color: 'text-yellow-600', bg: 'bg-yellow-50' },
} as const

type CategoryKey = keyof typeof categoryConfig

function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    })
  } catch {
    return dateStr
  }
}

export function ChangelogPage({ appName, entries, appIcon, gitCommits = [] }: ChangelogPageProps) {
  const [showGitCommits, setShowGitCommits] = useState(false)
  const sortedEntries = [...entries].sort((a, b) =>
    new Date(b.date).getTime() - new Date(a.date).getTime()
  )

  const hasGitCommits = gitCommits.length > 0

  return (
    <div className="min-h-screen bg-[var(--theme-bg)]">
      {/* Header */}
      <div className="bg-[var(--theme-bg-surface)] border-b border-[var(--theme-border-default)]">
        <div className="max-w-4xl mx-auto px-6 py-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {appIcon || <FileText className="w-8 h-8 text-[var(--theme-text-muted)]" />}
              <div>
                <h1 className="text-2xl font-bold text-[var(--theme-text-primary)]">
                  Change Log - {appName}
                </h1>
                <p className="text-[var(--theme-text-secondary)] mt-1">
                  Release history and version updates
                </p>
              </div>
            </div>

            {/* Toggle buttons */}
            {hasGitCommits && (
              <div className="flex gap-1 bg-[var(--theme-bg)] rounded-lg p-1">
                <button
                  onClick={() => setShowGitCommits(false)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    !showGitCommits
                      ? 'bg-[var(--theme-bg-surface)] text-[var(--theme-text-primary)] shadow-sm'
                      : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'
                  }`}
                >
                  <BookOpen className="w-4 h-4" />
                  Releases
                </button>
                <button
                  onClick={() => setShowGitCommits(true)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                    showGitCommits
                      ? 'bg-[var(--theme-bg-surface)] text-[var(--theme-text-primary)] shadow-sm'
                      : 'text-[var(--theme-text-secondary)] hover:text-[var(--theme-text-primary)]'
                  }`}
                >
                  <GitCommit className="w-4 h-4" />
                  Git Commits
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Content */}
      <div className="max-w-4xl mx-auto px-6 py-8">
        {showGitCommits ? (
          /* Git Commits View */
          gitCommits.length === 0 ? (
            <div className="text-center py-16">
              <GitCommit className="w-12 h-12 text-[var(--theme-text-muted)] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-2">
                No commits yet
              </h2>
              <p className="text-[var(--theme-text-secondary)]">
                Git history will appear here after deployment.
              </p>
            </div>
          ) : (
            <div className="bg-[var(--theme-bg-surface)] rounded-xl border border-[var(--theme-border-default)] overflow-hidden">
              <div className="divide-y divide-[var(--theme-border-default)]">
                {gitCommits.map((commit, index) => (
                  <div
                    key={`${commit.hash}-${index}`}
                    className="px-6 py-4 hover:bg-[var(--theme-bg-elevated)] transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      <code className="text-xs px-2 py-1 bg-[var(--theme-bg)] rounded font-mono text-[var(--theme-text-muted)] shrink-0">
                        {commit.hash}
                      </code>
                      <div className="flex-1 min-w-0">
                        <p className="text-[var(--theme-text-primary)] text-sm">
                          {commit.message}
                        </p>
                        <p className="text-[var(--theme-text-muted)] text-xs mt-1">
                          {formatDate(commit.date)}
                        </p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        ) : (
          /* Releases View */
          sortedEntries.length === 0 ? (
            <div className="text-center py-16">
              <FileText className="w-12 h-12 text-[var(--theme-text-muted)] mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-[var(--theme-text-primary)] mb-2">
                No changelog entries yet
              </h2>
              <p className="text-[var(--theme-text-secondary)]">
                Release notes will appear here as updates are made.
              </p>
            </div>
          ) : (
            <div className="space-y-8">
              {sortedEntries.map((entry, index) => (
                <div
                  key={`${entry.date}-${index}`}
                  className="bg-[var(--theme-bg-surface)] rounded-xl border border-[var(--theme-border-default)] overflow-hidden"
                >
                  {/* Entry header */}
                  <div className="px-6 py-4 bg-[var(--theme-bg-elevated)] border-b border-[var(--theme-border-default)]">
                    <div className="flex items-center gap-3">
                      <Calendar className="w-5 h-5 text-[var(--theme-text-muted)]" />
                      <span className="font-semibold text-[var(--theme-text-primary)]">
                        {formatDate(entry.date)}
                      </span>
                      {entry.version && (
                        <span className="px-2 py-0.5 bg-primary-100 text-primary-700 text-sm font-medium rounded">
                          {entry.version}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Entry content */}
                  <div className="px-6 py-4 space-y-4">
                    {(Object.keys(categoryConfig) as CategoryKey[]).map((category) => {
                      const items = entry[category]
                      if (!items || items.length === 0) return null

                      const config = categoryConfig[category]
                      const Icon = config.icon

                      return (
                        <div key={category}>
                          <div className="flex items-center gap-2 mb-2">
                            <span className={`p-1 rounded ${config.bg}`}>
                              <Icon className={`w-4 h-4 ${config.color}`} />
                            </span>
                            <span className={`text-sm font-semibold ${config.color}`}>
                              {config.label}
                            </span>
                          </div>
                          <ul className="space-y-1.5 ml-7">
                            {items.map((item, i) => (
                              <li
                                key={i}
                                className="text-[var(--theme-text-secondary)] text-sm leading-relaxed"
                              >
                                {item}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )
                    })}
                  </div>
                </div>
              ))}
            </div>
          )
        )}
      </div>
    </div>
  )
}
