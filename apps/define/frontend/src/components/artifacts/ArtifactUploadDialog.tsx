import { useState, useRef } from 'react'
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
import { Upload, Loader2, File } from 'lucide-react'
import { artifactsApi } from '@/api/client'

interface ArtifactUploadDialogProps {
  productId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess: () => void
}

export function ArtifactUploadDialog({
  productId,
  open,
  onOpenChange,
  onSuccess,
}: ArtifactUploadDialogProps) {
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [uploading, setUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setName('')
    setDescription('')
    setFile(null)
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selectedFile = e.target.files?.[0]
    if (selectedFile) {
      setFile(selectedFile)
      if (!name) {
        // Auto-populate name from filename without extension
        const nameWithoutExt = selectedFile.name.replace(/\.[^/.]+$/, '')
        setName(nameWithoutExt)
      }
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!file || !name.trim()) return

    setUploading(true)
    setError(null)

    try {
      await artifactsApi.upload(productId, name.trim(), file, description.trim() || undefined)
      resetForm()
      onOpenChange(false)
      onSuccess()
    } catch (err) {
      console.error('Upload failed:', err)
      setError('Failed to upload artifact. Please try again.')
    } finally {
      setUploading(false)
    }
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) resetForm()
        onOpenChange(isOpen)
      }}
    >
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Upload Artifact</DialogTitle>
            <DialogDescription>
              Upload a document to be converted to markdown for easy viewing.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">File</label>
              <div
                className="border-2 border-dashed border-gray-200 rounded-lg p-6 text-center cursor-pointer hover:border-purple-300 transition-colors"
                onClick={() => fileInputRef.current?.click()}
              >
                {file ? (
                  <div className="flex items-center justify-center gap-2">
                    <File className="h-5 w-5 text-gray-500" />
                    <span className="text-sm text-gray-700">{file.name}</span>
                  </div>
                ) : (
                  <>
                    <Upload className="h-8 w-8 text-gray-400 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">Click to select a file</p>
                    <p className="text-xs text-gray-400 mt-1">
                      PDF, Word, Excel, PowerPoint, images, or text files
                    </p>
                  </>
                )}
              </div>
              <input
                ref={fileInputRef}
                type="file"
                className="hidden"
                onChange={handleFileChange}
                accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.png,.jpg,.jpeg,.gif,.webp,.txt,.md,.json,.xml,.html,.css,.js,.ts,.py,.java"
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
              <Input
                placeholder="e.g., Functional Specification"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div>
              <label className="text-sm font-medium text-gray-700 mb-1 block">
                Description (optional)
              </label>
              <Textarea
                placeholder="Brief description of this artifact..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </div>

            {error && <p className="text-sm text-red-600">{error}</p>}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={uploading}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={uploading || !file || !name.trim()}>
              {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
