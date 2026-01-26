import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { History, RotateCcw, Check } from 'lucide-react'
import { themesApi } from '@/services/api'

interface VersionHistoryProps {
  themeId: string
  currentVersion: number
}

export function VersionHistory({ themeId, currentVersion }: VersionHistoryProps) {
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['theme-versions', themeId],
    queryFn: () => themesApi.getVersions(themeId),
  })

  const restoreMutation = useMutation({
    mutationFn: (versionId: string) => themesApi.restoreVersion(themeId, versionId, 'admin'),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['theme', themeId] })
      queryClient.invalidateQueries({ queryKey: ['theme-versions', themeId] })
      queryClient.invalidateQueries({ queryKey: ['themes'] })
    },
  })

  const handleRestore = (versionId: string, versionNumber: number) => {
    if (confirm(`Restore to version ${versionNumber}? This will create a new version with that snapshot.`)) {
      restoreMutation.mutate(versionId)
    }
  }

  return (
    <div className="bg-theme-bg-surface rounded-xl border border-theme-border p-6">
      <div className="flex items-center gap-2 mb-4">
        <History className="w-5 h-5 text-theme-text-muted" />
        <h2 className="text-lg font-semibold text-theme-text-primary">Version History</h2>
      </div>

      {isLoading ? (
        <div className="text-center py-4 text-theme-text-muted">Loading...</div>
      ) : data && data.versions.length > 0 ? (
        <div className="space-y-2 max-h-80 overflow-y-auto">
          {data.versions.map((version) => {
            const isCurrent = version.version_number === currentVersion

            return (
              <div
                key={version.id}
                className={`p-3 rounded-lg border transition-colors ${
                  isCurrent
                    ? 'border-primary-500 bg-primary-50 dark:bg-primary-900/20'
                    : 'border-theme-border hover:border-theme-text-muted'
                }`}
              >
                <div className="flex items-start justify-between">
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-theme-text-primary">
                        v{version.version_number}
                      </span>
                      {isCurrent && (
                        <span className="flex items-center gap-1 text-xs text-primary-600 dark:text-primary-400">
                          <Check className="w-3 h-3" />
                          Current
                        </span>
                      )}
                    </div>
                    {version.change_summary && (
                      <p className="text-xs text-theme-text-secondary mt-0.5">
                        {version.change_summary}
                      </p>
                    )}
                    <p className="text-xs text-theme-text-muted mt-1">
                      {new Date(version.changed_at).toLocaleDateString()}
                      {version.changed_by && ` by ${version.changed_by}`}
                    </p>
                  </div>

                  {!isCurrent && (
                    <button
                      onClick={() => handleRestore(version.id, version.version_number)}
                      disabled={restoreMutation.isPending}
                      className="p-1.5 text-theme-text-muted hover:text-primary-600 hover:bg-primary-50 dark:hover:bg-primary-900/20 rounded transition-colors"
                      title="Restore this version"
                    >
                      <RotateCcw className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      ) : (
        <div className="text-center py-4 text-theme-text-muted">No version history</div>
      )}
    </div>
  )
}
