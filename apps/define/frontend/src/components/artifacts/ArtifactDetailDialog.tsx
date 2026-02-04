import { useState, useEffect, useRef } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Loader2, Upload, Trash2, Save, File, Link2, ExternalLink } from 'lucide-react'
import { ArtifactWithVersions, artifactsApi } from '@/api/client'
import { ArtifactVersionHistory } from './ArtifactVersionHistory'
import { MarkdownViewer } from './MarkdownViewer'
import { InlineVoiceTranscription } from '@expertly/ui'

interface ArtifactDetailDialogProps {
  artifactId: string | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onUpdate: () => void
  onDelete: () => void
}

export function ArtifactDetailDialog({
  artifactId,
  open,
  onOpenChange,
  onUpdate,
  onDelete,
}: ArtifactDetailDialogProps) {
  const [artifact, setArtifact] = useState<ArtifactWithVersions | null>(null)
  const [loading, setLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [selectedVersionId, setSelectedVersionId] = useState<string | null>(null)
  const [markdownContent, setMarkdownContent] = useState<string | null>(null)
  const [markdownLoading, setMarkdownLoading] = useState(false)
  const [editForm, setEditForm] = useState({ name: '', description: '', status: '', url: '' })
  const [uploadFile, setUploadFile] = useState<File | null>(null)
  const [changeSummary, setChangeSummary] = useState('')
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (artifactId && open) {
      fetchArtifact()
    }
  }, [artifactId, open])

  useEffect(() => {
    if (selectedVersionId && artifactId) {
      fetchMarkdown()
    }
  }, [selectedVersionId, artifactId])

  async function fetchArtifact() {
    if (!artifactId) return
    setLoading(true)
    try {
      const data = await artifactsApi.get(artifactId)
      setArtifact(data)
      setEditForm({
        name: data.name,
        description: data.description || '',
        status: data.status,
        url: data.url || '',
      })
      // Select latest version by default
      if (data.versions.length > 0) {
        setSelectedVersionId(data.versions[0].id)
      }
    } catch (error) {
      console.error('Error fetching artifact:', error)
    } finally {
      setLoading(false)
    }
  }

  async function fetchMarkdown() {
    if (!artifactId || !selectedVersionId) return
    setMarkdownLoading(true)
    setMarkdownContent(null)
    try {
      const content = await artifactsApi.getMarkdown(artifactId, selectedVersionId)
      setMarkdownContent(content)
    } catch (error: unknown) {
      // 202 means conversion in progress
      if (error && typeof error === 'object' && 'response' in error) {
        const axiosError = error as { response?: { status: number } }
        if (axiosError.response?.status === 202) {
          setMarkdownContent('*Conversion in progress... Please wait.*')
          // Poll for completion
          setTimeout(fetchMarkdown, 2000)
          return
        }
      }
      console.error('Error fetching markdown:', error)
      setMarkdownContent('*Failed to load markdown content.*')
    } finally {
      setMarkdownLoading(false)
    }
  }

  async function handleSave() {
    if (!artifact) return
    setSaving(true)
    try {
      await artifactsApi.update(artifact.id, {
        name: editForm.name,
        description: editForm.description || undefined,
        status: editForm.status,
        url: artifact.artifact_type === 'link' ? editForm.url : undefined,
      })
      await fetchArtifact()
      onUpdate()
    } catch (error) {
      console.error('Error saving artifact:', error)
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!artifact || !confirm('Are you sure you want to delete this artifact?')) return
    setDeleting(true)
    try {
      await artifactsApi.delete(artifact.id)
      onOpenChange(false)
      onDelete()
    } catch (error) {
      console.error('Error deleting artifact:', error)
      setDeleting(false)
    }
  }

  async function handleUploadVersion() {
    if (!artifact || !uploadFile) return
    setUploading(true)
    try {
      await artifactsApi.uploadVersion(artifact.id, uploadFile, changeSummary || undefined)
      setUploadFile(null)
      setChangeSummary('')
      if (fileInputRef.current) fileInputRef.current.value = ''
      await fetchArtifact()
      onUpdate()
    } catch (error) {
      console.error('Error uploading version:', error)
    } finally {
      setUploading(false)
    }
  }

  async function handleReconvert(versionId: string) {
    if (!artifactId) return
    try {
      await artifactsApi.reconvert(artifactId, versionId)
      await fetchArtifact()
      if (selectedVersionId === versionId) {
        fetchMarkdown()
      }
    } catch (error) {
      console.error('Error reconverting:', error)
    }
  }

  if (!open) return null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle>{artifact?.name || 'Loading...'}</DialogTitle>
        </DialogHeader>

        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-primary-600" />
          </div>
        ) : artifact ? (
          <div className="flex-1 overflow-hidden grid grid-cols-3 gap-4">
            {/* Left panel - Details and versions */}
            <div className="col-span-1 overflow-y-auto space-y-4 pr-2">
              {/* Edit form */}
              <div className="space-y-3">
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Name</label>
                  <div className="flex gap-2">
                    <Input
                      value={editForm.name}
                      onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                      className="flex-1"
                    />
                    <InlineVoiceTranscription
                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                      onTranscribe={(text) => setEditForm({ ...editForm, name: editForm.name ? editForm.name + ' ' + text : text })}
                      size="sm"
                    />
                  </div>
                </div>
                {artifact.artifact_type === 'link' && (
                  <div>
                    <label className="text-sm font-medium text-gray-700 mb-1 block">URL</label>
                    <Input
                      type="url"
                      value={editForm.url}
                      onChange={(e) => setEditForm({ ...editForm, url: e.target.value })}
                      placeholder="https://..."
                    />
                  </div>
                )}
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Description</label>
                  <div className="flex gap-2">
                    <Textarea
                      value={editForm.description}
                      onChange={(e) => setEditForm({ ...editForm, description: e.target.value })}
                      rows={2}
                      className="flex-1"
                    />
                    <InlineVoiceTranscription
                      tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                      onTranscribe={(text) => setEditForm({ ...editForm, description: editForm.description ? editForm.description + ' ' + text : text })}
                      size="sm"
                      className="self-start mt-1"
                    />
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">Status</label>
                  <Select
                    value={editForm.status}
                    onValueChange={(value) => setEditForm({ ...editForm, status: value })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="archived">Archived</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex gap-2">
                  <Button onClick={handleSave} disabled={saving} size="sm">
                    {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Save className="h-4 w-4 mr-1" />
                    Save
                  </Button>
                  <Button
                    variant="outline"
                    onClick={handleDelete}
                    disabled={deleting}
                    size="sm"
                    className="text-red-600 border-red-300 hover:bg-red-50"
                  >
                    {deleting && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                    <Trash2 className="h-4 w-4 mr-1" />
                    Delete
                  </Button>
                </div>
              </div>

              {/* Upload new version - only for file artifacts */}
              {artifact.artifact_type !== 'link' && (
                <div className="border-t pt-4">
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Upload New Version</h4>
                  <div className="space-y-2">
                    <div
                      className="border-2 border-dashed border-gray-200 rounded-lg p-3 text-center cursor-pointer hover:border-primary-300 transition-colors"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      {uploadFile ? (
                        <div className="flex items-center justify-center gap-2">
                          <File className="h-4 w-4 text-gray-500" />
                          <span className="text-sm text-gray-700 truncate">{uploadFile.name}</span>
                        </div>
                      ) : (
                        <>
                          <Upload className="h-5 w-5 text-gray-400 mx-auto mb-1" />
                          <p className="text-xs text-gray-500">Click to select file</p>
                        </>
                      )}
                    </div>
                    <input
                      ref={fileInputRef}
                      type="file"
                      className="hidden"
                      onChange={(e) => setUploadFile(e.target.files?.[0] || null)}
                    />
                    <div className="flex gap-2">
                      <Input
                        placeholder="Change summary (optional)"
                        value={changeSummary}
                        onChange={(e) => setChangeSummary(e.target.value)}
                        className="flex-1"
                      />
                      <InlineVoiceTranscription
                        tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                        onTranscribe={(text) => setChangeSummary(changeSummary ? changeSummary + ' ' + text : text)}
                        size="sm"
                      />
                    </div>
                    <Button
                      onClick={handleUploadVersion}
                      disabled={uploading || !uploadFile}
                      size="sm"
                      className="w-full"
                    >
                      {uploading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Upload Version
                    </Button>
                  </div>
                </div>
              )}

              {/* Version history - only for file artifacts */}
              {artifact.artifact_type !== 'link' && (
                <div className="border-t pt-4">
                  <ArtifactVersionHistory
                    artifactId={artifact.id}
                    versions={artifact.versions}
                    selectedVersionId={selectedVersionId}
                    onSelectVersion={setSelectedVersionId}
                    onReconvert={handleReconvert}
                  />
                </div>
              )}
            </div>

            {/* Right panel - Markdown preview or Link preview */}
            <div className="col-span-2 overflow-y-auto border rounded-lg p-4 bg-white">
              {artifact.artifact_type === 'link' ? (
                <div className="flex flex-col items-center justify-center py-12">
                  <div className="p-4 bg-blue-50 rounded-full mb-4">
                    <Link2 className="h-12 w-12 text-blue-600" />
                  </div>
                  <h4 className="text-lg font-medium text-gray-900 mb-2">{artifact.name}</h4>
                  {artifact.description && (
                    <p className="text-gray-600 text-center mb-4 max-w-md">{artifact.description}</p>
                  )}
                  <a
                    href={artifact.url || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-blue-600 hover:text-blue-800 text-sm break-all max-w-md text-center mb-4"
                  >
                    {artifact.url}
                  </a>
                  <Button
                    onClick={() => window.open(artifact.url || '#', '_blank', 'noopener,noreferrer')}
                    className="mt-2"
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Open Link
                  </Button>
                </div>
              ) : (
                <>
                  <h4 className="text-sm font-medium text-gray-700 mb-3">Markdown Preview</h4>
                  {markdownLoading ? (
                    <div className="flex items-center justify-center py-12">
                      <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                    </div>
                  ) : markdownContent ? (
                    <MarkdownViewer content={markdownContent} />
                  ) : (
                    <p className="text-gray-500 text-sm text-center py-12">
                      Select a version to view its markdown content
                    </p>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <p className="text-gray-500 text-center py-12">Artifact not found</p>
        )}
      </DialogContent>
    </Dialog>
  )
}
