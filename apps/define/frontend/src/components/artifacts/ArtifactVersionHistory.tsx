import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { Download, RefreshCw, Loader2, CheckCircle, AlertCircle, Clock } from 'lucide-react'
import { ArtifactVersion, artifactsApi } from '@/api/client'
import { format } from 'date-fns'

interface ArtifactVersionHistoryProps {
  artifactId: string
  versions: ArtifactVersion[]
  selectedVersionId: string | null
  onSelectVersion: (versionId: string) => void
  onReconvert: (versionId: string) => void
}

function getStatusIcon(status: string) {
  switch (status) {
    case 'pending':
    case 'processing':
      return <Loader2 className="h-4 w-4 animate-spin text-gray-500" />
    case 'completed':
      return <CheckCircle className="h-4 w-4 text-green-500" />
    case 'failed':
      return <AlertCircle className="h-4 w-4 text-red-500" />
    default:
      return <Clock className="h-4 w-4 text-gray-400" />
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ArtifactVersionHistory({
  artifactId,
  versions,
  selectedVersionId,
  onSelectVersion,
  onReconvert,
}: ArtifactVersionHistoryProps) {
  return (
    <div className="space-y-2">
      <h4 className="text-sm font-medium text-gray-700 mb-3">Version History</h4>
      {versions.map((version) => (
        <div
          key={version.id}
          className={`p-3 rounded-lg border cursor-pointer transition-colors ${
            selectedVersionId === version.id
              ? 'border-primary-300 bg-primary-50'
              : 'border-gray-200 hover:border-gray-300'
          }`}
          onClick={() => onSelectVersion(version.id)}
        >
          <div className="flex items-center justify-between mb-1">
            <div className="flex items-center gap-2">
              <Badge variant="outline">v{version.version_number}</Badge>
              {getStatusIcon(version.conversion_status)}
            </div>
            <span className="text-xs text-gray-500">
              {formatFileSize(version.size_bytes)}
            </span>
          </div>
          <div className="text-xs text-gray-500">
            {format(new Date(version.created_at), 'MMM d, yyyy h:mm a')}
            {version.changed_by && <span> by {version.changed_by}</span>}
          </div>
          {version.change_summary && (
            <p className="text-xs text-gray-600 mt-1">{version.change_summary}</p>
          )}
          {version.conversion_error && (
            <p className="text-xs text-red-600 mt-1">{version.conversion_error}</p>
          )}
          <div className="flex gap-2 mt-2">
            <a
              href={artifactsApi.downloadOriginalUrl(artifactId, version.id)}
              onClick={(e) => e.stopPropagation()}
              target="_blank"
              rel="noopener noreferrer"
            >
              <Button size="sm" variant="outline" className="h-7 text-xs">
                <Download className="h-3 w-3 mr-1" />
                Original
              </Button>
            </a>
            {version.conversion_status === 'failed' && (
              <Button
                size="sm"
                variant="outline"
                className="h-7 text-xs"
                onClick={(e) => {
                  e.stopPropagation()
                  onReconvert(version.id)
                }}
              >
                <RefreshCw className="h-3 w-3 mr-1" />
                Retry
              </Button>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}
