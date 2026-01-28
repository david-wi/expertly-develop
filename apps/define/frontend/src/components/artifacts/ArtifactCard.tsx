import { Badge } from '@/components/ui/badge'
import { Card, CardContent } from '@/components/ui/card'
import { FileText, FileImage, FileSpreadsheet, File, Loader2, AlertCircle, CheckCircle } from 'lucide-react'
import { Artifact, ArtifactVersion } from '@/api/client'
import { cn } from '@/lib/utils'

interface ArtifactCardProps {
  artifact: Artifact
  latestVersion?: ArtifactVersion
  onClick?: () => void
}

function getFileIcon(mimeType: string) {
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

export function ArtifactCard({ artifact, latestVersion, onClick }: ArtifactCardProps) {
  const FileIcon = getFileIcon(artifact.mime_type)

  return (
    <Card
      className={cn(
        'cursor-pointer transition-all hover:shadow-md hover:border-purple-200',
        artifact.status === 'archived' && 'opacity-60'
      )}
      onClick={onClick}
    >
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          <div className="p-2 bg-gray-100 rounded-lg">
            <FileIcon className="h-6 w-6 text-gray-600" />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-medium text-gray-900 truncate">{artifact.name}</h3>
            <p className="text-sm text-gray-500 truncate">{artifact.original_filename}</p>
            <div className="flex items-center gap-2 mt-2">
              <Badge variant="outline" className="text-xs">
                v{artifact.current_version}
              </Badge>
              {latestVersion && getStatusBadge(latestVersion.conversion_status)}
              {latestVersion && (
                <span className="text-xs text-gray-400">
                  {formatFileSize(latestVersion.size_bytes)}
                </span>
              )}
            </div>
          </div>
        </div>
        {artifact.description && (
          <p className="text-sm text-gray-600 mt-3 line-clamp-2">{artifact.description}</p>
        )}
      </CardContent>
    </Card>
  )
}
