import { useState, useRef, useCallback } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Badge } from '@/components/ui/badge'
import {
  Loader2,
  Upload,
  X,
  ChevronRight,
  ChevronDown,
  Trash2,
  Sparkles,
  Check,
  AlertCircle,
  CheckCircle,
  XCircle,
  Clock,
  RotateCcw,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { aiApi, requirementsApi, ParsedRequirement } from '@/api/client'
import { InlineVoiceTranscription } from '@expertly/ui'

interface ExistingRequirement {
  id: string
  stable_key: string
  title: string
  parent_id: string | null
}

type ApprovalStatus = 'pending' | 'approved' | 'rejected'

interface ParsedReqWithApproval extends ParsedRequirement {
  approval_status: ApprovalStatus
}

interface FileItem {
  name: string
  type: string
  size: number
  content: string
}

interface BulkImportDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  productName: string
  existingRequirements: ExistingRequirement[]
  onSuccess: () => void
}

type Step = 'input' | 'preview' | 'creating'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024 // 25MB total
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'text/markdown',
]

export function BulkImportDialog({
  open,
  onOpenChange,
  productId,
  productName,
  existingRequirements,
  onSuccess,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>('input')
  const [description, setDescription] = useState('')
  const [files, setFiles] = useState<FileItem[]>([])
  const [targetParentId, setTargetParentId] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [parsedRequirements, setParsedRequirements] = useState<ParsedReqWithApproval[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0 })
  const fileInputRef = useRef<HTMLInputElement>(null)

  const resetDialog = useCallback(() => {
    setStep('input')
    setDescription('')
    setFiles([])
    setTargetParentId('')
    setGenerating(false)
    setCreating(false)
    setError('')
    setParsedRequirements([])
    setExpandedItems(new Set())
    setEditingId(null)
    setCreateProgress({ current: 0, total: 0 })
  }, [])

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog()
      }
      onOpenChange(open)
    },
    [onOpenChange, resetDialog]
  )

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files
    if (!selectedFiles) return

    const newFiles: FileItem[] = []
    let totalSize = files.reduce((sum, f) => sum + f.size, 0)

    for (const file of Array.from(selectedFiles)) {
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`File type not supported: ${file.name}`)
        continue
      }

      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large: ${file.name} (max 10MB)`)
        continue
      }

      totalSize += file.size
      if (totalSize > MAX_TOTAL_SIZE) {
        setError('Total file size exceeds 25MB')
        break
      }

      const content = await readFileContent(file)
      newFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        content,
      })
    }

    setFiles((prev) => [...prev, ...newFiles])
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()

      if (file.type.startsWith('image/') || file.type === 'application/pdf') {
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1]
          resolve(base64)
        }
        reader.onerror = reject
        reader.readAsDataURL(file)
      } else {
        reader.onload = () => {
          resolve(reader.result as string)
        }
        reader.onerror = reject
        reader.readAsText(file)
      }
    })
  }

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  const handleGenerate = async () => {
    if (!description.trim() && files.length === 0) {
      setError('Please enter a description or upload files')
      return
    }

    setGenerating(true)
    setError('')

    try {
      const response = await aiApi.parseRequirements({
        description,
        files: files.map((f) => ({
          name: f.name,
          type: f.type,
          content: f.content,
        })),
        existing_requirements: existingRequirements.map((r) => ({
          id: r.id,
          stable_key: r.stable_key,
          title: r.title,
          parent_id: r.parent_id,
        })),
        target_parent_id: targetParentId || undefined,
        product_name: productName,
      })

      const requirementsWithApproval: ParsedReqWithApproval[] = response.requirements.map((req) => ({
        ...req,
        approval_status: 'pending' as ApprovalStatus,
      }))
      setParsedRequirements(requirementsWithApproval)
      setStep('preview')
      setExpandedItems(new Set(requirementsWithApproval.map((r) => r.temp_id)))
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate requirements')
    } finally {
      setGenerating(false)
    }
  }

  const approveRequirement = (tempId: string) => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.temp_id === tempId ? { ...r, approval_status: 'approved' as ApprovalStatus } : r))
    )
  }

  const rejectRequirement = (tempId: string) => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.temp_id === tempId ? { ...r, approval_status: 'rejected' as ApprovalStatus } : r))
    )
  }

  const setToPending = (tempId: string) => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.temp_id === tempId ? { ...r, approval_status: 'pending' as ApprovalStatus } : r))
    )
  }

  const approveAllPending = () => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.approval_status === 'pending' ? { ...r, approval_status: 'approved' as ApprovalStatus } : r))
    )
  }

  const rejectAllPending = () => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.approval_status === 'pending' ? { ...r, approval_status: 'rejected' as ApprovalStatus } : r))
    )
  }

  const pendingCount = parsedRequirements.filter((r) => r.approval_status === 'pending').length
  const approvedCount = parsedRequirements.filter((r) => r.approval_status === 'approved').length
  const rejectedCount = parsedRequirements.filter((r) => r.approval_status === 'rejected').length

  const handleCreateApproved = async () => {
    const approvedRequirements = parsedRequirements.filter((r) => r.approval_status === 'approved')
    if (approvedRequirements.length === 0) return

    setCreating(true)
    setStep('creating')
    setCreateProgress({ current: 0, total: approvedRequirements.length })
    setError('')

    try {
      await requirementsApi.createBatch({
        product_id: productId,
        requirements: approvedRequirements.map((req) => ({
          temp_id: req.temp_id,
          title: req.title,
          what_this_does: req.what_this_does || undefined,
          why_this_exists: req.why_this_exists || undefined,
          not_included: req.not_included || undefined,
          acceptance_criteria: req.acceptance_criteria || undefined,
          priority: req.priority,
          tags: req.tags,
          parent_ref: req.parent_ref || targetParentId || undefined,
        })),
      })

      setCreateProgress({ current: approvedRequirements.length, total: approvedRequirements.length })

      setTimeout(() => {
        handleClose(false)
        onSuccess()
      }, 500)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create requirements')
      setStep('preview')
    } finally {
      setCreating(false)
    }
  }

  const toggleExpand = (tempId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev)
      if (next.has(tempId)) {
        next.delete(tempId)
      } else {
        next.add(tempId)
      }
      return next
    })
  }

  const updateRequirement = (tempId: string, updates: Partial<ParsedReqWithApproval>) => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.temp_id === tempId ? { ...r, ...updates } : r))
    )
  }

  const deleteRequirement = (tempId: string) => {
    setParsedRequirements((prev) => {
      const toDelete = new Set([tempId])
      let changed = true
      while (changed) {
        changed = false
        prev.forEach((r) => {
          if (r.parent_ref && toDelete.has(r.parent_ref) && !toDelete.has(r.temp_id)) {
            toDelete.add(r.temp_id)
            changed = true
          }
        })
      }
      return prev.filter((r) => !toDelete.has(r.temp_id))
    })
  }

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  }

  const priorityColors: Record<string, 'default' | 'secondary' | 'success' | 'warning' | 'danger'> = {
    critical: 'danger',
    high: 'warning',
    medium: 'secondary',
    low: 'secondary',
  }

  const buildPreviewTree = (reqs: ParsedReqWithApproval[]) => {
    const roots: ParsedReqWithApproval[] = []
    const childrenMap = new Map<string, ParsedReqWithApproval[]>()

    reqs.forEach((req) => {
      if (!req.parent_ref || !reqs.find((r) => r.temp_id === req.parent_ref)) {
        roots.push(req)
      } else {
        const siblings = childrenMap.get(req.parent_ref) || []
        siblings.push(req)
        childrenMap.set(req.parent_ref, siblings)
      }
    })

    return { roots, childrenMap }
  }

  const renderPreviewItem = (
    req: ParsedReqWithApproval,
    childrenMap: Map<string, ParsedReqWithApproval[]>,
    level: number = 0
  ) => {
    const isExpanded = expandedItems.has(req.temp_id)
    const isEditing = editingId === req.temp_id
    const children = childrenMap.get(req.temp_id) || []

    const statusStyles = {
      pending: 'border-l-4 border-l-amber-400',
      approved: 'border-l-4 border-l-green-500 bg-green-50/50',
      rejected: 'border-l-4 border-l-red-400 opacity-60',
    }

    const statusIcons = {
      pending: <Clock className="h-4 w-4 text-amber-500" />,
      approved: <CheckCircle className="h-4 w-4 text-green-600" />,
      rejected: <XCircle className="h-4 w-4 text-red-500" />,
    }

    return (
      <div key={req.temp_id} className="border-b last:border-b-0">
        <div
          className={cn(
            'flex items-start gap-2 py-3 px-3 hover:bg-gray-50 transition-colors',
            statusStyles[req.approval_status],
            isEditing && 'bg-primary-50'
          )}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          <button
            className={cn(
              'p-0.5 rounded hover:bg-gray-200 transition-colors mt-1',
              children.length === 0 && 'invisible'
            )}
            onClick={() => toggleExpand(req.temp_id)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>

          <div className="mt-1">{statusIcons[req.approval_status]}</div>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={req.title}
                  onChange={(e) => updateRequirement(req.temp_id, { title: e.target.value })}
                  placeholder="Title"
                  className="font-medium"
                />
                <Textarea
                  value={req.what_this_does || ''}
                  onChange={(e) => updateRequirement(req.temp_id, { what_this_does: e.target.value })}
                  placeholder="What this does"
                  rows={2}
                />
                <Textarea
                  value={req.why_this_exists || ''}
                  onChange={(e) => updateRequirement(req.temp_id, { why_this_exists: e.target.value })}
                  placeholder="Why this exists"
                  rows={2}
                />
                <Textarea
                  value={req.acceptance_criteria || ''}
                  onChange={(e) => updateRequirement(req.temp_id, { acceptance_criteria: e.target.value })}
                  placeholder="Acceptance criteria"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Select
                    value={req.priority}
                    onValueChange={(value) => updateRequirement(req.temp_id, { priority: value })}
                  >
                    <SelectTrigger className="w-32">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="critical">Critical</SelectItem>
                      <SelectItem value="high">High</SelectItem>
                      <SelectItem value="medium">Medium</SelectItem>
                      <SelectItem value="low">Low</SelectItem>
                    </SelectContent>
                  </Select>
                  <Button size="sm" onClick={() => setEditingId(null)}>
                    <Check className="h-4 w-4 mr-1" />
                    Done
                  </Button>
                </div>
              </div>
            ) : (
              <div
                className="cursor-pointer"
                onClick={() => setEditingId(req.temp_id)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className={cn(
                    'font-medium truncate',
                    req.approval_status === 'rejected' ? 'text-gray-500' : 'text-gray-900'
                  )}>
                    {req.title}
                  </span>
                  <Badge variant={priorityColors[req.priority]} className="text-xs">
                    {req.priority}
                  </Badge>
                </div>
                <p className={cn(
                  'text-sm line-clamp-2',
                  req.approval_status === 'rejected' ? 'text-gray-400' : 'text-gray-600'
                )}>
                  {req.what_this_does}
                </p>
              </div>
            )}
          </div>

          {!isEditing && (
            <div className="flex items-center gap-1">
              {req.approval_status === 'pending' && (
                <>
                  <button
                    className="p-1.5 rounded hover:bg-green-100 text-gray-400 hover:text-green-600 transition-colors"
                    onClick={() => approveRequirement(req.temp_id)}
                    title="Approve"
                  >
                    <Check className="h-4 w-4" />
                  </button>
                  <button
                    className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                    onClick={() => rejectRequirement(req.temp_id)}
                    title="Reject"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </>
              )}
              {(req.approval_status === 'approved' || req.approval_status === 'rejected') && (
                <button
                  className="p-1.5 rounded hover:bg-gray-200 text-gray-400 hover:text-gray-600 transition-colors"
                  onClick={() => setToPending(req.temp_id)}
                  title="Undo"
                >
                  <RotateCcw className="h-4 w-4" />
                </button>
              )}
              <button
                className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
                onClick={() => deleteRequirement(req.temp_id)}
                title="Delete"
              >
                <Trash2 className="h-4 w-4" />
              </button>
            </div>
          )}
        </div>

        {isExpanded &&
          children.map((child) => renderPreviewItem(child, childrenMap, level + 1))}
      </div>
    )
  }

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary-600" />
            Import Requirements with AI
          </DialogTitle>
          <DialogDescription>
            Describe your requirements in plain English, upload documents, and let AI structure them for you.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {step === 'input' && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Describe your requirements
                </label>
                <div className="flex gap-2">
                  <Textarea
                    placeholder="Example: We need user authentication with login, registration, password reset, and email verification. There should also be role-based access control with admin and regular user roles."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={6}
                    className="resize-none flex-1"
                  />
                  <InlineVoiceTranscription
                    tokenUrl="https://identity-api.ai.devintensive.com/api/v1/transcription/token"
                    onTranscribe={(text) => setDescription(description ? description + ' ' + text : text)}
                    size="md"
                    className="self-start mt-1"
                  />
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  Be as detailed as you want. AI will parse this into structured requirements.
                </p>
              </div>

              <div>
                <label className="text-sm font-medium text-gray-700 mb-1 block">
                  Attach files (optional)
                </label>
                <div
                  className={cn(
                    'border-2 border-dashed rounded-lg p-4 text-center cursor-pointer hover:bg-gray-50 transition-colors',
                    files.length > 0 && 'border-primary-300 bg-primary-50'
                  )}
                  onClick={() => fileInputRef.current?.click()}
                >
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    accept=".pdf,.png,.jpg,.jpeg,.txt,.md"
                    className="hidden"
                    onChange={handleFileSelect}
                  />
                  <Upload className="h-6 w-6 text-gray-400 mx-auto mb-2" />
                  <p className="text-sm text-gray-600">
                    Click to upload PDFs, images, or text files
                  </p>
                  <p className="text-xs text-gray-500 mt-1">Max 10MB per file, 25MB total</p>
                </div>

                {files.length > 0 && (
                  <div className="mt-2 space-y-1">
                    {files.map((file, index) => (
                      <div
                        key={index}
                        className="flex items-center gap-2 text-sm bg-gray-100 rounded px-2 py-1"
                      >
                        <span className="flex-1 truncate">{file.name}</span>
                        <span className="text-gray-500">{formatFileSize(file.size)}</span>
                        <button
                          className="p-0.5 hover:bg-gray-200 rounded"
                          onClick={() => removeFile(index)}
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {existingRequirements.length > 0 && (
                <div>
                  <label className="text-sm font-medium text-gray-700 mb-1 block">
                    Target parent requirement (optional)
                  </label>
                  <Select
                    value={targetParentId || 'none'}
                    onValueChange={(value) => setTargetParentId(value === 'none' ? '' : value)}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="None (root level)" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="none">None (root level)</SelectItem>
                      {existingRequirements.map((req) => (
                        <SelectItem key={req.id} value={req.id}>
                          [{req.stable_key}] {req.title}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-gray-500 mt-1">
                    New requirements will be added under this parent.
                  </p>
                </div>
              )}
            </div>
          )}

          {step === 'preview' && (
            <div className="py-4">
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-4">
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={approveAllPending}
                    disabled={pendingCount === 0}
                    className="text-green-600 hover:text-green-700 hover:bg-green-50"
                  >
                    <Check className="h-4 w-4 mr-1" />
                    Approve All ({pendingCount})
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    onClick={rejectAllPending}
                    disabled={pendingCount === 0}
                    className="text-red-600 hover:text-red-700 hover:bg-red-50"
                  >
                    <X className="h-4 w-4 mr-1" />
                    Reject All
                  </Button>
                </div>
                <div className="flex items-center gap-3 text-sm text-gray-600">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3 text-amber-500" />
                    {pendingCount} pending
                  </span>
                  <span className="flex items-center gap-1">
                    <CheckCircle className="h-3 w-3 text-green-600" />
                    {approvedCount} approved
                  </span>
                  <span className="flex items-center gap-1">
                    <XCircle className="h-3 w-3 text-red-500" />
                    {rejectedCount} rejected
                  </span>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-3">
                {parsedRequirements.length} requirement{parsedRequirements.length !== 1 ? 's' : ''}{' '}
                generated. Approve or reject each, then create approved items.
              </div>
              <div className="border rounded-lg overflow-hidden">
                {(() => {
                  const { roots, childrenMap } = buildPreviewTree(parsedRequirements)
                  return roots.map((req) => renderPreviewItem(req, childrenMap))
                })()}
              </div>
            </div>
          )}

          {step === 'creating' && (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-primary-600 mx-auto mb-4" />
              <p className="text-gray-600">
                Creating requirements... {createProgress.current} / {createProgress.total}
              </p>
            </div>
          )}
        </div>

        <DialogFooter>
          {step === 'input' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating || (!description.trim() && files.length === 0)}>
                {generating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                <Sparkles className="h-4 w-4 mr-2" />
                Generate
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('input')}>
                Back
              </Button>
              <Button
                onClick={handleCreateApproved}
                disabled={creating || approvedCount === 0}
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create Approved ({approvedCount})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
