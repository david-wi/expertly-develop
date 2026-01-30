import { useState, useRef, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Upload, Loader2, File, X, CheckCircle, AlertCircle } from 'lucide-react'
import { artifactsApi } from '@/api/client'
import { cn } from '@/lib/utils'

interface ArtifactUploadDialogProps {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

interface FileToUpload {
  file: File
  name: string
  description: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  error?: string
}

/**
 * Suggests a description based on the filename.
 * Parses common naming conventions and generates human-readable descriptions.
 */
function suggestDescription(filename: string): string {
  // Remove extension
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '')

  // Return empty if filename is too short or generic
  if (nameWithoutExt.length < 3) return ''
  if (/^(file|document|image|untitled|new|temp)/i.test(nameWithoutExt)) return ''

  // Replace common separators with spaces
  let description = nameWithoutExt
    .replace(/[-_]+/g, ' ')
    .replace(/([a-z])([A-Z])/g, '$1 $2') // camelCase to spaces
    .replace(/([A-Z]+)([A-Z][a-z])/g, '$1 $2') // Handle acronyms like "APISpec" -> "API Spec"

  // Handle version numbers (v1, v2, V1.0, etc.)
  description = description.replace(/\s*[vV](\d+(?:\.\d+)?)\s*/g, ' v$1 ')

  // Handle dates in various formats
  description = description
    .replace(/(\d{4})[.\s](\d{2})[.\s](\d{2})/g, (_, y, m, d) => {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      }
      return `${y}-${m}-${d}`
    })
    .replace(/(\d{2})[.\s](\d{2})[.\s](\d{4})/g, (_, m, d, y) => {
      const date = new Date(parseInt(y), parseInt(m) - 1, parseInt(d))
      if (!isNaN(date.getTime())) {
        return date.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
      }
      return `${m}/${d}/${y}`
    })

  // Expand common abbreviations
  const abbreviations: Record<string, string> = {
    'spec': 'specification',
    'specs': 'specifications',
    'req': 'requirements',
    'reqs': 'requirements',
    'doc': 'document',
    'docs': 'documents',
    'img': 'image',
    'imgs': 'images',
    'cfg': 'configuration',
    'config': 'configuration',
    'api': 'API',
    'ui': 'UI',
    'ux': 'UX',
    'db': 'database',
    'auth': 'authentication',
    'admin': 'administration',
    'mgmt': 'management',
    'dev': 'development',
    'prod': 'production',
    'env': 'environment',
    'info': 'information',
    'ref': 'reference',
    'tech': 'technical',
    'prd': 'PRD',
    'brd': 'BRD',
    'srs': 'SRS',
    'erd': 'ERD',
  }

  description = description
    .split(' ')
    .map(word => {
      const lower = word.toLowerCase()
      if (abbreviations[lower]) {
        return abbreviations[lower]
      }
      return word
    })
    .join(' ')

  // Clean up whitespace and capitalize first letter of each sentence
  description = description
    .replace(/\s+/g, ' ')
    .trim()

  // Capitalize first letter, lowercase the rest unless it's an acronym
  if (description.length > 0) {
    description = description.charAt(0).toUpperCase() + description.slice(1)
  }

  // Don't return if it's basically just the filename cleaned up minimally
  if (description.toLowerCase() === nameWithoutExt.toLowerCase()) {
    return ''
  }

  return description
}

export function ArtifactUploadDialog({
  productId,
  open,
  onOpenChange,
  onSuccess,
}: ArtifactUploadDialogProps) {
  const [files, setFiles] = useState<FileToUpload[]>([])
  const [uploading, setUploading] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setFiles([])
    setIsDragging(false)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const addFiles = useCallback((selectedFiles: FileList | File[]) => {
    const newFiles: FileToUpload[] = Array.from(selectedFiles).map((file) => ({
      file,
      name: file.name.replace(/\.[^/.]+$/, ''), // Remove extension
      description: suggestDescription(file.name),
      status: 'pending' as const,
    }))
    setFiles((prev) => [...prev, ...newFiles])
  }, [])

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFiles = e.target.files
    if (selectedFiles && selectedFiles.length > 0) {
      addFiles(selectedFiles)
    }
    // Clear input so same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  function updateFile(index: number, updates: Partial<FileToUpload>) {
    setFiles((prev) =>
      prev.map((f, i) => (i === index ? { ...f, ...updates } : f))
    )
  }

  const handleDragEnter = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    if (!e.currentTarget.contains(e.relatedTarget as Node)) {
      setIsDragging(false)
    }
  }, [])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)

    const droppedFiles = e.dataTransfer.files
    if (droppedFiles && droppedFiles.length > 0) {
      addFiles(droppedFiles)
    }
  }, [addFiles])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (files.length === 0) return

    setUploading(true)
    let anySuccess = false

    for (let i = 0; i < files.length; i++) {
      const fileItem = files[i]
      if (fileItem.status !== 'pending') continue

      updateFile(i, { status: 'uploading' })

      try {
        await artifactsApi.upload(
          productId,
          fileItem.name.trim() || fileItem.file.name.replace(/\.[^/.]+$/, ''),
          fileItem.file,
          fileItem.description.trim() || undefined
        )
        updateFile(i, { status: 'success' })
        anySuccess = true
      } catch (err: any) {
        console.error('Upload failed:', err)
        let errorMessage = 'Upload failed'
        if (err.response?.data?.detail) {
          errorMessage = typeof err.response.data.detail === 'string'
            ? err.response.data.detail
            : JSON.stringify(err.response.data.detail)
        } else if (err.message) {
          errorMessage = err.message
        }
        updateFile(i, { status: 'error', error: errorMessage })
      }
    }

    setUploading(false)

    if (anySuccess) {
      onSuccess()
    }

    // Check if all files are done (success or error)
    const allDone = files.every((f) => f.status === 'success' || f.status === 'error')
    const allSuccess = files.every((f) => f.status === 'success')

    if (allDone && allSuccess) {
      // Close dialog after a brief delay to show success
      setTimeout(() => {
        resetForm()
        onOpenChange(false)
      }, 500)
    }
  }

  const pendingCount = files.filter((f) => f.status === 'pending').length
  const successCount = files.filter((f) => f.status === 'success').length
  const errorCount = files.filter((f) => f.status === 'error').length

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-lg max-h-[90vh] overflow-hidden flex flex-col">
        <form onSubmit={handleSubmit} className="flex flex-col flex-1 overflow-hidden">
          <DialogHeader>
            <DialogTitle>Upload Artifacts</DialogTitle>
            <DialogDescription>
              Upload documents to be converted to markdown for easy viewing.
              You can upload multiple files at once.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4 flex-1 overflow-y-auto">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Files</label>
              <div
                className={cn(
                  'border-2 border-dashed rounded-lg p-6 text-center cursor-pointer transition-colors',
                  isDragging
                    ? 'border-purple-500 bg-purple-50'
                    : 'border-gray-200 hover:border-purple-300'
                )}
                onClick={() => fileInputRef.current?.click()}
                onDragEnter={handleDragEnter}
                onDragLeave={handleDragLeave}
                onDragOver={handleDragOver}
                onDrop={handleDrop}
              >
                {isDragging ? (
                  <>
                    <Upload className="h-8 w-8 text-purple-500 mx-auto mb-2" />
                    <p className="text-sm text-purple-600 font-medium">Drop files here</p>
                  </>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Drag and drop or click to select files</p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, Word, Excel, PowerPoint, images, or text files
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                multiple
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json,.xml,.html,.css,.js,.ts,.py,.java"
              />
            </div>

            {files.length > 0 && (
              <div className="space-y-3">
                <div className="flex items-center justify-between text-sm text-gray-500">
                  <span>{files.length} file{files.length !== 1 ? 's' : ''} selected</span>
                  {(successCount > 0 || errorCount > 0) && (
                    <span>
                      {successCount > 0 && <span className="text-green-600">{successCount} uploaded</span>}
                      {successCount > 0 && errorCount > 0 && ', '}
                      {errorCount > 0 && <span className="text-red-600">{errorCount} failed</span>}
                    </span>
                  )}
                </div>

                {files.map((fileItem, index) => (
                  <div
                    key={index}
                    className={cn(
                      'border rounded-lg p-3 space-y-2',
                      fileItem.status === 'success' && 'border-green-200 bg-green-50',
                      fileItem.status === 'error' && 'border-red-200 bg-red-50',
                      fileItem.status === 'uploading' && 'border-purple-200 bg-purple-50'
                    )}
                  >
                    <div className="flex items-center gap-2">
                      {fileItem.status === 'pending' && <File className="h-4 w-4 text-gray-500 flex-shrink-0" />}
                      {fileItem.status === 'uploading' && <Loader2 className="h-4 w-4 text-purple-600 animate-spin flex-shrink-0" />}
                      {fileItem.status === 'success' && <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />}
                      {fileItem.status === 'error' && <AlertCircle className="h-4 w-4 text-red-600 flex-shrink-0" />}
                      <span className="text-sm text-gray-700 truncate flex-1">{fileItem.file.name}</span>
                      {fileItem.status === 'pending' && (
                        <button
                          type="button"
                          onClick={() => removeFile(index)}
                          className="p-1 hover:bg-gray-200 rounded"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      )}
                    </div>

                    {fileItem.status === 'pending' && (
                      <>
                        <Input
                          placeholder="Name (optional, defaults to filename)"
                          value={fileItem.name}
                          onChange={(e) => updateFile(index, { name: e.target.value })}
                          className="text-sm"
                        />
                        <Textarea
                          placeholder="Description (optional)"
                          value={fileItem.description}
                          onChange={(e) => updateFile(index, { description: e.target.value })}
                          rows={1}
                          className="text-sm"
                        />
                      </>
                    )}

                    {fileItem.status === 'error' && fileItem.error && (
                      <p className="text-xs text-red-600">{fileItem.error}</p>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              {successCount > 0 && errorCount === 0 ? 'Done' : 'Cancel'}
            </Button>
            <Button type="submit" disabled={uploading || pendingCount === 0}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload {pendingCount > 0 ? `(${pendingCount})` : ''}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
