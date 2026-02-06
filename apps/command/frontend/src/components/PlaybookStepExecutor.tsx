import { useState, useEffect, useCallback } from 'react'
import {
  CheckCircle,
  ChevronLeft,
  ChevronRight,
  Paperclip,
  Link as LinkIcon,
  Download,
  Trash2,
  ExternalLink,
  FileText,
  Image,
  Film,
  Music,
  SkipForward,
  Eye,
  Edit3,
} from 'lucide-react'
import { api, Playbook, PlaybookStep, StepResponse, TaskAttachment } from '../services/api'
import MarkdownEditor from './MarkdownEditor'
import FileUploadZone from './FileUploadZone'

interface PlaybookStepExecutorProps {
  taskId: string
  playbook: Playbook
  onStepComplete?: () => void
  onAllStepsComplete?: () => void
}

const getFileIcon = (mimeType?: string) => {
  if (!mimeType) return FileText
  if (mimeType.startsWith('image/')) return Image
  if (mimeType.startsWith('video/')) return Film
  if (mimeType.startsWith('audio/')) return Music
  return FileText
}

const formatFileSize = (bytes?: number) => {
  if (!bytes) return ''
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export default function PlaybookStepExecutor({
  taskId,
  playbook,
  onStepComplete,
  onAllStepsComplete,
}: PlaybookStepExecutorProps) {
  const [stepResponses, setStepResponses] = useState<StepResponse[]>([])
  const [currentStepIndex, setCurrentStepIndex] = useState(0)
  const [stepAttachments, setStepAttachments] = useState<TaskAttachment[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Edit state for current step
  const [editedNotes, setEditedNotes] = useState('')
  const [hasNotesChanges, setHasNotesChanges] = useState(false)
  const [previewMode, setPreviewMode] = useState(false)

  // Attachment state
  const [showAddAttachment, setShowAddAttachment] = useState(false)
  const [attachmentType, setAttachmentType] = useState<'file' | 'link'>('file')
  const [linkUrl, setLinkUrl] = useState('')
  const [linkTitle, setLinkTitle] = useState('')
  const [uploadingFile, setUploadingFile] = useState(false)

  const steps = playbook.steps || []
  const currentStep = steps[currentStepIndex]
  const currentStepResponse = stepResponses.find(sr => sr.step_id === currentStep?.id)

  const fetchStepResponses = useCallback(async () => {
    try {
      const responses = await api.getStepResponses(taskId)
      setStepResponses(responses)

      // Find the first non-completed step
      const firstIncompleteIndex = steps.findIndex(step => {
        const response = responses.find(r => r.step_id === step.id)
        return !response || (response.status !== 'completed' && response.status !== 'skipped')
      })
      if (firstIncompleteIndex >= 0) {
        setCurrentStepIndex(firstIncompleteIndex)
      }
    } catch (err) {
      console.error('Failed to fetch step responses:', err)
      setError('Failed to load step responses')
    }
  }, [taskId, steps])

  const fetchStepAttachments = useCallback(async () => {
    if (!currentStep) return
    try {
      const attachments = await api.getStepAttachments(taskId, currentStep.id)
      setStepAttachments(attachments)
    } catch (err) {
      console.error('Failed to fetch step attachments:', err)
    }
  }, [taskId, currentStep])

  useEffect(() => {
    const loadData = async () => {
      setLoading(true)
      await fetchStepResponses()
      setLoading(false)
    }
    loadData()
  }, [fetchStepResponses])

  useEffect(() => {
    fetchStepAttachments()
  }, [fetchStepAttachments])

  // Update notes state when step changes
  useEffect(() => {
    if (currentStepResponse) {
      setEditedNotes(currentStepResponse.notes || '')
      setHasNotesChanges(false)
      setPreviewMode(false)
    } else {
      setEditedNotes('')
      setHasNotesChanges(false)
      setPreviewMode(false)
    }
  }, [currentStepResponse])

  const handleNotesChange = (value: string) => {
    setEditedNotes(value)
    setHasNotesChanges(value !== (currentStepResponse?.notes || ''))
  }

  const handleSaveNotes = async () => {
    if (!currentStep || !hasNotesChanges) return

    setSaving(true)
    try {
      const updated = await api.updateStepResponse(taskId, currentStep.id, {
        notes: editedNotes,
      })
      setStepResponses(prev =>
        prev.map(sr => (sr.step_id === currentStep.id ? updated : sr))
      )
      setHasNotesChanges(false)
    } catch (err) {
      console.error('Failed to save notes:', err)
      setError('Failed to save notes')
    } finally {
      setSaving(false)
    }
  }

  const handleCompleteStep = async () => {
    if (!currentStep) return

    setSaving(true)
    try {
      // Save notes if changed
      const updated = await api.completeStep(taskId, currentStep.id, {
        notes: editedNotes || undefined,
      })
      setStepResponses(prev =>
        prev.map(sr => (sr.step_id === currentStep.id ? updated : sr))
      )
      setHasNotesChanges(false)
      onStepComplete?.()

      // Check if all steps are complete
      const allComplete = steps.every(step => {
        if (step.id === currentStep.id) return true // Just completed
        const response = stepResponses.find(r => r.step_id === step.id)
        return response?.status === 'completed' || response?.status === 'skipped'
      })

      if (allComplete) {
        onAllStepsComplete?.()
      } else {
        // Move to next step if available
        if (currentStepIndex < steps.length - 1) {
          setCurrentStepIndex(currentStepIndex + 1)
        }
      }
    } catch (err) {
      console.error('Failed to complete step:', err)
      setError('Failed to complete step')
    } finally {
      setSaving(false)
    }
  }

  const handleSkipStep = async () => {
    if (!currentStep) return

    setSaving(true)
    try {
      const updated = await api.skipStep(taskId, currentStep.id)
      setStepResponses(prev =>
        prev.map(sr => (sr.step_id === currentStep.id ? updated : sr))
      )

      // Move to next step if available
      if (currentStepIndex < steps.length - 1) {
        setCurrentStepIndex(currentStepIndex + 1)
      }
    } catch (err) {
      console.error('Failed to skip step:', err)
      setError('Failed to skip step')
    } finally {
      setSaving(false)
    }
  }

  const handleUploadFile = async (file: File) => {
    if (!currentStep) return

    setUploadingFile(true)
    try {
      const attachment = await api.uploadStepAttachment(taskId, currentStep.id, file)
      setStepAttachments(prev => [attachment, ...prev])
      setShowAddAttachment(false)
    } catch (err) {
      console.error('Failed to upload file:', err)
      setError('Failed to upload file')
    } finally {
      setUploadingFile(false)
    }
  }

  const handleAddLink = async () => {
    if (!currentStep || !linkUrl) return

    try {
      const attachment = await api.addTaskLink(taskId, {
        url: linkUrl,
        link_title: linkTitle || undefined,
        step_id: currentStep.id,
      })
      setStepAttachments(prev => [attachment, ...prev])
      setLinkUrl('')
      setLinkTitle('')
      setShowAddAttachment(false)
    } catch (err) {
      console.error('Failed to add link:', err)
      setError('Failed to add link')
    }
  }

  const handleDeleteAttachment = async (attachmentId: string) => {
    if (!confirm('Delete this attachment?')) return

    try {
      await api.deleteAttachment(attachmentId)
      setStepAttachments(prev => prev.filter(a => a.id !== attachmentId))
    } catch (err) {
      console.error('Failed to delete attachment:', err)
      setError('Failed to delete attachment')
    }
  }

  const getStepStatus = (step: PlaybookStep) => {
    const response = stepResponses.find(r => r.step_id === step.id)
    return response?.status || 'pending'
  }

  const renderStepTab = (step: PlaybookStep, index: number) => {
    const status = getStepStatus(step)
    const isActive = index === currentStepIndex
    const isPast = status === 'completed' || status === 'skipped'

    let bgColor = 'bg-gray-100 text-gray-600'
    let icon = <span className="text-xs font-medium">{index + 1}</span>

    if (status === 'completed') {
      bgColor = 'bg-green-100 text-green-700'
      icon = <CheckCircle className="w-3.5 h-3.5" />
    } else if (status === 'skipped') {
      bgColor = 'bg-gray-200 text-gray-500'
      icon = <SkipForward className="w-3.5 h-3.5" />
    } else if (isActive) {
      bgColor = 'bg-primary-100 text-primary-700 ring-2 ring-primary-500'
    }

    return (
      <button
        key={step.id}
        onClick={() => setCurrentStepIndex(index)}
        className={`flex items-center justify-center w-8 h-8 rounded-full transition-all ${bgColor} ${
          !isPast && !isActive ? 'opacity-50' : ''
        }`}
        title={`Step ${index + 1}: ${step.title}`}
      >
        {icon}
      </button>
    )
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-32">
        <div className="text-theme-text-secondary">Loading steps...</div>
      </div>
    )
  }

  if (!currentStep) {
    return (
      <div className="text-center text-theme-text-secondary py-8">
        No steps found in this playbook.
      </div>
    )
  }

  const isStepComplete = currentStepResponse?.status === 'completed' || currentStepResponse?.status === 'skipped'

  return (
    <div className="space-y-4">
      {/* Step Tabs */}
      <div className="flex items-center gap-2 overflow-x-auto pb-2">
        <div className="flex items-center gap-1.5">
          {steps.map((step, index) => renderStepTab(step, index))}
        </div>
        <div className="ml-auto text-xs text-theme-text-secondary whitespace-nowrap">
          Step {currentStepIndex + 1} of {steps.length}
        </div>
      </div>

      {/* Current Step Content */}
      <div className="border border-theme-border rounded-lg overflow-hidden">
        {/* Step Header */}
        <div className="px-4 py-3 bg-theme-bg-elevated border-b border-theme-border">
          <h3 className="font-medium text-theme-text-primary flex items-center gap-2">
            <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-primary-100 text-primary-700 text-xs font-medium">
              {currentStepIndex + 1}
            </span>
            {currentStep.title}
            {isStepComplete && (
              <span className="ml-auto text-xs px-2 py-0.5 rounded-full bg-green-100 text-green-700">
                {currentStepResponse?.status === 'skipped' ? 'Skipped' : 'Completed'}
              </span>
            )}
          </h3>
        </div>

        {/* Step Description */}
        {currentStep.description && (
          <div className="px-4 py-3 bg-theme-bg-surface border-b border-theme-border">
            <div className="text-xs text-theme-text-secondary mb-1 font-medium">Instructions</div>
            <div className="text-sm text-theme-text-primary prose prose-sm max-w-none">
              {currentStep.description}
            </div>
          </div>
        )}

        {/* When to Perform */}
        {currentStep.when_to_perform && (
          <div className="px-4 py-2 bg-amber-50 border-b border-theme-border">
            <div className="text-xs text-amber-700">
              <span className="font-medium">When:</span> {currentStep.when_to_perform}
            </div>
          </div>
        )}

        {/* Notes Section */}
        <div className="px-4 py-3 border-b border-theme-border">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-theme-text-secondary font-medium">Your Notes</div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPreviewMode(!previewMode)}
                className={`p-1 rounded transition-colors ${
                  previewMode ? 'bg-primary-100 text-primary-700' : 'text-theme-text-secondary hover:bg-theme-bg-elevated'
                }`}
                title={previewMode ? 'Edit' : 'Preview'}
              >
                {previewMode ? <Edit3 className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
              </button>
              {hasNotesChanges && (
                <button
                  onClick={handleSaveNotes}
                  disabled={saving}
                  className="text-xs px-2 py-0.5 bg-primary-600 text-white rounded hover:bg-primary-700 disabled:opacity-50"
                >
                  {saving ? 'Saving...' : 'Save'}
                </button>
              )}
            </div>
          </div>
          <MarkdownEditor
            value={editedNotes}
            onChange={handleNotesChange}
            placeholder="Add your notes, findings, or response here..."
            rows={4}
            previewMode={previewMode}
            disabled={isStepComplete}
          />
        </div>

        {/* Attachments Section */}
        <div className="px-4 py-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs text-theme-text-secondary font-medium flex items-center gap-1.5">
              <Paperclip className="w-3.5 h-3.5" />
              Attachments ({stepAttachments.length})
            </div>
            {!isStepComplete && (
              <button
                onClick={() => setShowAddAttachment(!showAddAttachment)}
                className="text-xs text-primary-600 hover:text-primary-700 font-medium"
              >
                {showAddAttachment ? 'Cancel' : 'Add'}
              </button>
            )}
          </div>

          {showAddAttachment && (
            <div className="mb-3 p-3 bg-theme-bg-elevated rounded-lg border border-theme-border">
              <div className="flex gap-2 mb-2">
                <button
                  onClick={() => setAttachmentType('file')}
                  className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                    attachmentType === 'file'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-theme-bg-surface text-theme-text-secondary hover:bg-theme-bg-elevated'
                  }`}
                >
                  File
                </button>
                <button
                  onClick={() => setAttachmentType('link')}
                  className={`flex-1 py-1.5 text-xs rounded-lg transition-colors ${
                    attachmentType === 'link'
                      ? 'bg-primary-100 text-primary-700'
                      : 'bg-theme-bg-surface text-theme-text-secondary hover:bg-theme-bg-elevated'
                  }`}
                >
                  Link
                </button>
              </div>

              {attachmentType === 'file' ? (
                <FileUploadZone onFileSelect={handleUploadFile} disabled={uploadingFile} />
              ) : (
                <div className="space-y-2">
                  <input
                    type="url"
                    value={linkUrl}
                    onChange={e => setLinkUrl(e.target.value)}
                    placeholder="https://..."
                    className="w-full px-3 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary text-sm"
                  />
                  <input
                    type="text"
                    value={linkTitle}
                    onChange={e => setLinkTitle(e.target.value)}
                    placeholder="Link title (optional)"
                    className="w-full px-3 py-1.5 border border-theme-border rounded-lg bg-theme-bg-surface text-theme-text-primary text-sm"
                  />
                  <button
                    onClick={handleAddLink}
                    disabled={!linkUrl}
                    className="w-full py-1.5 bg-primary-600 text-white rounded-lg hover:bg-primary-700 disabled:opacity-50 text-sm"
                  >
                    Add Link
                  </button>
                </div>
              )}
            </div>
          )}

          {stepAttachments.length > 0 ? (
            <div className="space-y-1.5">
              {stepAttachments.map(attachment => {
                const FileIcon = getFileIcon(attachment.mime_type)
                const isFile = attachment.attachment_type === 'file'

                return (
                  <div
                    key={attachment.id}
                    className="flex items-center gap-2 p-2 bg-theme-bg-elevated rounded-lg"
                  >
                    {isFile ? (
                      <FileIcon className="w-4 h-4 text-theme-text-secondary flex-shrink-0" />
                    ) : (
                      <LinkIcon className="w-4 h-4 text-theme-text-secondary flex-shrink-0" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-medium text-theme-text-primary truncate">
                        {isFile ? attachment.original_filename : attachment.link_title || attachment.url}
                      </p>
                      {isFile && attachment.size_bytes && (
                        <p className="text-[10px] text-theme-text-secondary">
                          {formatFileSize(attachment.size_bytes)}
                        </p>
                      )}
                    </div>
                    <div className="flex items-center gap-0.5">
                      {isFile ? (
                        <a
                          href={api.getAttachmentDownloadUrl(attachment.id)}
                          className="p-1 rounded hover:bg-theme-bg-surface transition-colors"
                          download
                        >
                          <Download className="w-3.5 h-3.5 text-theme-text-secondary" />
                        </a>
                      ) : (
                        <a
                          href={attachment.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="p-1 rounded hover:bg-theme-bg-surface transition-colors"
                        >
                          <ExternalLink className="w-3.5 h-3.5 text-theme-text-secondary" />
                        </a>
                      )}
                      {!isStepComplete && (
                        <button
                          onClick={() => handleDeleteAttachment(attachment.id)}
                          className="p-1 rounded hover:bg-red-100 transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-red-500" />
                        </button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-xs text-theme-text-secondary">No attachments for this step</p>
          )}
        </div>
      </div>

      {/* Navigation Footer */}
      <div className="flex items-center justify-between">
        <button
          onClick={() => setCurrentStepIndex(Math.max(0, currentStepIndex - 1))}
          disabled={currentStepIndex === 0}
          className="flex items-center gap-1 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          <ChevronLeft className="w-4 h-4" />
          Previous
        </button>

        <div className="flex items-center gap-2">
          {!isStepComplete && (
            <>
              <button
                onClick={handleSkipStep}
                disabled={saving}
                className="flex items-center gap-1 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg text-xs"
              >
                <SkipForward className="w-3.5 h-3.5" />
                Skip
              </button>
              <button
                onClick={handleCompleteStep}
                disabled={saving}
                className="flex items-center gap-1 px-4 py-1.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 text-xs font-medium"
              >
                <CheckCircle className="w-3.5 h-3.5" />
                {saving ? 'Saving...' : 'Complete Step'}
              </button>
            </>
          )}
        </div>

        <button
          onClick={() => setCurrentStepIndex(Math.min(steps.length - 1, currentStepIndex + 1))}
          disabled={currentStepIndex === steps.length - 1}
          className="flex items-center gap-1 px-3 py-1.5 text-theme-text-secondary hover:bg-theme-bg-elevated rounded-lg disabled:opacity-50 disabled:cursor-not-allowed text-xs"
        >
          Next
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Error display */}
      {error && (
        <div className="p-2 bg-red-50 border border-red-200 rounded-lg text-red-700 text-xs">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            Dismiss
          </button>
        </div>
      )}
    </div>
  )
}
