import { useState, useCallback, useRef, useEffect } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
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
  FileText,
  Link2,
  AlertTriangle,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { aiApi, requirementsApi, artifactsApi, ParsedRequirement, ArtifactWithVersions } from '@/api/client'

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

interface GenerateFromArtifactsDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  productId: string
  productName: string
  existingRequirements: ExistingRequirement[]
  artifacts: ArtifactWithVersions[]
  onSuccess: () => void
}

type Step = 'select' | 'preview' | 'creating'

export function GenerateFromArtifactsDialog({
  open,
  onOpenChange,
  productId,
  existingRequirements,
  artifacts,
  onSuccess,
}: GenerateFromArtifactsDialogProps) {
  const [step, setStep] = useState<Step>('select')
  const [selectedArtifactIds, setSelectedArtifactIds] = useState<Set<string>>(new Set())
  const [targetParentId, setTargetParentId] = useState<string>('')
  const [generating, setGenerating] = useState(false)
  const [creating, setCreating] = useState(false)
  const [error, setError] = useState('')
  const [parsedRequirements, setParsedRequirements] = useState<ParsedReqWithApproval[]>([])
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set())
  const [editingId, setEditingId] = useState<string | null>(null)
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0 })
  const [generatingStartTime, setGeneratingStartTime] = useState<number | null>(null)
  const [elapsedSeconds, setElapsedSeconds] = useState(0)
  const [progressMessage, setProgressMessage] = useState<string | null>(null)

  // Determine which artifacts have completed markdown conversion
  const getArtifactStatus = (artifact: ArtifactWithVersions) => {
    const latestVersion = artifact.versions?.[0]
    if (!latestVersion) return 'no_version'
    return latestVersion.conversion_status
  }

  const readyArtifacts = artifacts.filter((a) => getArtifactStatus(a) === 'completed')

  // Polling ref and cleanup
  const pollingRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const stopPolling = useCallback(() => {
    if (pollingRef.current) {
      clearInterval(pollingRef.current)
      pollingRef.current = null
    }
  }, [])

  useEffect(() => {
    return () => {
      if (pollingRef.current) {
        clearInterval(pollingRef.current)
        pollingRef.current = null
      }
    }
  }, [])

  // Initialize selected artifacts when dialog opens — de-select already-generated ones
  const initializeSelection = useCallback(() => {
    const notYetGenerated = readyArtifacts.filter((a) => !a.context?.requirements_generated)
    setSelectedArtifactIds(new Set(notYetGenerated.map((a) => a.id)))
  }, [artifacts])

  // Auto-initialize selection when dialog opens
  useEffect(() => {
    if (open) {
      initializeSelection()
    }
  }, [open, initializeSelection])

  // Elapsed timer for generation progress
  useEffect(() => {
    if (!generatingStartTime) {
      setElapsedSeconds(0)
      return
    }
    const timer = setInterval(() => {
      setElapsedSeconds(Math.floor((Date.now() - generatingStartTime) / 1000))
    }, 1000)
    return () => clearInterval(timer)
  }, [generatingStartTime])

  const resetDialog = useCallback(() => {
    stopPolling()
    setStep('select')
    setSelectedArtifactIds(new Set())
    setTargetParentId('')
    setGenerating(false)
    setCreating(false)
    setError('')
    setParsedRequirements([])
    setExpandedItems(new Set())
    setEditingId(null)
    setCreateProgress({ current: 0, total: 0 })
    setGeneratingStartTime(null)
    setElapsedSeconds(0)
  }, [stopPolling])

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog()
      } else {
        initializeSelection()
      }
      onOpenChange(open)
    },
    [onOpenChange, resetDialog, initializeSelection]
  )

  const toggleArtifact = (artifactId: string) => {
    setSelectedArtifactIds((prev) => {
      const next = new Set(prev)
      if (next.has(artifactId)) {
        next.delete(artifactId)
      } else {
        next.add(artifactId)
      }
      return next
    })
  }

  const handleGenerate = async () => {
    if (selectedArtifactIds.size === 0) {
      setError('Please select at least one artifact')
      return
    }

    setGenerating(true)
    setGeneratingStartTime(Date.now())
    setError('')

    try {
      const { job_id } = await aiApi.generateFromArtifacts({
        product_id: productId,
        artifact_ids: Array.from(selectedArtifactIds),
        target_parent_id: targetParentId || undefined,
      })

      // Poll for results every 2 seconds with retry logic
      let consecutiveErrors = 0
      const MAX_POLL_RETRIES = 5

      pollingRef.current = setInterval(async () => {
        try {
          const status = await aiApi.getGenerationStatus(job_id)
          consecutiveErrors = 0 // Reset on success

          if (status.status === 'completed') {
            stopPolling()
            setGenerating(false)
            setGeneratingStartTime(null)
            setProgressMessage(null)

            // Nodes are already saved to DB — just close and refresh
            handleClose(false)
            onSuccess()
          } else if (status.status === 'failed') {
            stopPolling()
            setGenerating(false)
            setGeneratingStartTime(null)
            setProgressMessage(null)
            setError(status.error || 'Generation failed')
          } else {
            // Processing — update progress
            if (status.progress) {
              setProgressMessage(status.progress)
            }
          }
        } catch {
          consecutiveErrors++
          if (consecutiveErrors >= MAX_POLL_RETRIES) {
            stopPolling()
            setGenerating(false)
            setGeneratingStartTime(null)
            setError(
              'Lost connection while generating requirements. ' +
              'Generation may still be running — refresh the page to see any created nodes.'
            )
          }
          // Otherwise silently retry on next interval
        }
      }, 2000)
    } catch (err: unknown) {
      setGenerating(false)
      setGeneratingStartTime(null)
      const errorMsg = err instanceof Error ? err.message : 'Failed to start generation'
      const axiosErr = err as { response?: { data?: { detail?: string } } }
      setError(axiosErr?.response?.data?.detail || errorMsg)
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

      // Mark selected artifacts as having had requirements generated
      await Promise.all(
        Array.from(selectedArtifactIds).map((artifactId) =>
          artifactsApi.update(artifactId, {
            context: {
              requirements_generated: true,
              requirements_generated_at: new Date().toISOString(),
            },
          })
        )
      )

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
            Generate Requirements from Artifacts
          </DialogTitle>
          <DialogDescription>
            Select artifacts to analyze and AI will generate structured requirements from their content.
          </DialogDescription>
        </DialogHeader>

        {error && (
          <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 p-3 rounded-lg">
            <AlertCircle className="h-4 w-4 flex-shrink-0" />
            {error}
          </div>
        )}

        <div className="flex-1 overflow-y-auto">
          {step === 'select' && (
            <div className="space-y-4 py-4">
              <div>
                <label className="text-sm font-medium text-gray-700 mb-2 block">
                  Select artifacts to include
                </label>
                {artifacts.length === 0 ? (
                  <div className="text-center py-8 border rounded-lg bg-gray-50">
                    <FileText className="h-8 w-8 text-gray-300 mx-auto mb-2" />
                    <p className="text-sm text-gray-500">No artifacts available</p>
                  </div>
                ) : (
                  <div className="border rounded-lg divide-y">
                    {artifacts.map((artifact) => {
                      const status = getArtifactStatus(artifact)
                      const isReady = status === 'completed'
                      const isSelected = selectedArtifactIds.has(artifact.id)

                      return (
                        <label
                          key={artifact.id}
                          className={cn(
                            'flex items-center gap-3 px-4 py-3 cursor-pointer hover:bg-gray-50 transition-colors',
                            !isReady && 'opacity-50 cursor-not-allowed'
                          )}
                        >
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => isReady && toggleArtifact(artifact.id)}
                            disabled={!isReady}
                            className="h-4 w-4 rounded border-gray-300 text-primary-600 focus:ring-primary-500"
                          />
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2">
                              {artifact.artifact_type === 'link' ? (
                                <Link2 className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              ) : (
                                <FileText className="h-4 w-4 text-gray-400 flex-shrink-0" />
                              )}
                              <span className="text-sm font-medium text-gray-900 truncate">
                                {artifact.name}
                              </span>
                              {artifact.context?.requirements_generated && (
                                <Badge variant="outline" className="text-xs bg-green-50 text-green-700 border-green-200 flex-shrink-0">
                                  Previously generated
                                </Badge>
                              )}
                            </div>
                            {artifact.description && (
                              <p className="text-xs text-gray-500 mt-0.5 truncate ml-6">
                                {artifact.description}
                              </p>
                            )}
                          </div>
                          <div className="flex-shrink-0">
                            {status === 'completed' && (
                              <Badge variant="success" className="text-xs">Ready</Badge>
                            )}
                            {status === 'pending' && (
                              <Badge variant="secondary" className="text-xs">
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Converting
                              </Badge>
                            )}
                            {status === 'processing' && (
                              <Badge variant="secondary" className="text-xs">
                                <Loader2 className="h-3 w-3 animate-spin mr-1" />
                                Processing
                              </Badge>
                            )}
                            {status === 'failed' && (
                              <Badge variant="danger" className="text-xs">
                                <AlertTriangle className="h-3 w-3 mr-1" />
                                Failed
                              </Badge>
                            )}
                            {status === 'no_version' && (
                              <Badge variant="secondary" className="text-xs">No content</Badge>
                            )}
                          </div>
                        </label>
                      )
                    })}
                  </div>
                )}
                <p className="text-xs text-gray-500 mt-2">
                  {selectedArtifactIds.size} of {readyArtifacts.length} ready artifact{readyArtifacts.length !== 1 ? 's' : ''} selected
                </p>
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
                generated from {selectedArtifactIds.size} artifact{selectedArtifactIds.size !== 1 ? 's' : ''}. Approve or reject each, then create approved items.
              </div>
              <div className="border rounded-lg overflow-hidden">
                {(() => {
                  const { roots, childrenMap } = buildPreviewTree(parsedRequirements)
                  return roots.map((req) => renderPreviewItem(req, childrenMap))
                })()}
              </div>
            </div>
          )}

          {step === 'select' && generating && (
            <div className="py-8">
              <div className="max-w-md mx-auto">
                <div className="flex items-center justify-center gap-3 mb-4">
                  <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
                  <span className="text-gray-700 font-medium">
                    Analyzing {selectedArtifactIds.size} artifact{selectedArtifactIds.size !== 1 ? 's' : ''}...
                  </span>
                </div>

                {/* Progress bar — asymptotic approach so it never reaches 100% until done */}
                <div className="w-full bg-gray-200 rounded-full h-2 mb-3">
                  <div
                    className="bg-primary-500 h-2 rounded-full transition-all duration-1000 ease-out"
                    style={{
                      width: `${Math.min(95, (1 - 1 / (1 + elapsedSeconds / 20)) * 100)}%`,
                    }}
                  />
                </div>

                <div className="flex items-center justify-between text-xs text-gray-500">
                  <span>{progressMessage || 'AI is reading and structuring requirements'}</span>
                  <span>
                    {Math.floor(elapsedSeconds / 60) > 0
                      ? `${Math.floor(elapsedSeconds / 60)}m ${elapsedSeconds % 60}s`
                      : `${elapsedSeconds}s`}
                  </span>
                </div>
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
          {step === 'select' && (
            <>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button onClick={handleGenerate} disabled={generating || selectedArtifactIds.size === 0}>
                {generating ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Analyzing documents...
                  </>
                ) : (
                  <>
                    <Sparkles className="h-4 w-4 mr-2" />
                    Generate
                  </>
                )}
              </Button>
            </>
          )}

          {step === 'preview' && (
            <>
              <Button variant="outline" onClick={() => setStep('select')}>
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
