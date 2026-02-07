import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, FileImage, FileSpreadsheet, File, Loader2, AlertCircle, CheckCircle, CheckCircle2, Link2, ExternalLink } from 'lucide-react'
import { Artifact, ArtifactVersion } from '@/api/client'
import { cn } from '@/lib/utils'

interface ArtifactCardProps {
  artifact: Artifact
  latestVersion?: ArtifactVersion
  onClick?: () => void
}

function getFileIcon(mimeType: string | null) {
  if (!mimeType) return File
  if (mimeType.startsWith('image/')) return FileImage
  if (mimeType.includes('spreadsheet') || mimeType.includes('excel')) return FileSpreadsheet
  if (mimeType.includes('pdf') || mimeType.includes('document') || mimeType.includes('word')) return FileText
  return File
}

function getStatusBadge(status: string) {
  switch (status) {
    case 'pending':
    case 'processing':
      return (
        <Badge variant="secondary" className="flex items-center gap-1">
          <Loader2 className="h-3 w-3 animate-spin" />
          Converting
        </Badge>
      )
    case 'completed':
      return (
        <Badge variant="success" className="flex items-center gap-1">
          <CheckCircle className="h-3 w-3" />
          Ready
        </Badge>
      )
    case 'failed':
      return (
        <Badge variant="danger" className="flex items-center gap-1">
          <AlertCircle className="h-3 w-3" />
          Failed
        </Badge>
      )
    default:
      return null
  }
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function getDomainFromUrl(url: string): string {
  try {
    const parsed = new URL(url)
    return parsed.hostname
  } catch {
    return url
  }
}

export function ArtifactCard({ artifact, latestVersion, onClick }: ArtifactCardProps) {
  const isLink = artifact.artifact_type === 'link'
  const FileIcon = isLink ? Link2 : getFileIcon(artifact.mime_type)

  function handleClick(e: React.MouseEvent) {
    // For links, allow Cmd/Ctrl+click to open in new tab
    if (isLink && artifact.url && (e.metaKey || e.ctrlKey)) {
      e.stopPropagation()
      window.open(artifact.url, '_blank', 'noopener,noreferrer')
      return
    }
    onClick?.()
  }

  function handleExternalLinkClick(e: React.MouseEvent) {
    e.stopPropagation()
    if (artifact.url) {
      window.open(artifact.url, '_blank', 'noopener,noreferrer')
    }
  }

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-primary-200',
        artifact.status === 'archived' && 'opacity-60'
      )}
      onClick={handleClick}
    >
      <CardContent className="p-3">
        <div className="flex items-start gap-2.5">
          <div className={cn(
            'p-1.5 rounded-lg',
            isLink ? 'bg-blue-50' : 'bg-gray-100'
          )}>
            <FileIcon className={cn(
              'h-5 w-5',
              isLink ? 'text-blue-600' : 'text-gray-600'
            )} />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <h3 className="font-medium text-gray-900 truncate">{artifact.name}</h3>
              {isLink && artifact.url && (
                <button
                  onClick={handleExternalLinkClick}
                  className="text-gray-400 hover:text-blue-600 transition-colors"
                  title="Open link in new tab"
                >
                  <ExternalLink className="h-4 w-4" />
                </button>
              )}
            </div>
            <p className="text-sm text-gray-500 truncate">
              {isLink ? getDomainFromUrl(artifact.url || '') : artifact.original_filename}
            </p>
            <div className="flex items-center gap-2 mt-1.5">
              {isLink ? (
                <Badge variant="outline" className="text-xs bg-blue-50 text-blue-700 border-blue-200">
                  Link
                </Badge>
              ) : (
                <>
                  <Badge variant="outline" className="text-xs">
                    v{artifact.current_version}
                  </Badge>
                  {latestVersion && getStatusBadge(latestVersion.conversion_status)}
                  {latestVersion && (
                    <span className="text-xs text-gray-400">
                      {formatFileSize(latestVersion.size_bytes)}
                    </span>
                  )}
                </>
              )}
              {artifact.context?.requirements_generated && (
                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3" />
                  Generated
                </Badge>
              )}
            </div>
          </div>
        </div>
        {artifact.description && (
          <p className="text-sm text-gray-600 mt-2 line-clamp-2">{artifact.description}</p>
        )}
      </CardContent>
    </Card>
  )
}
