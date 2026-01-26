'use client';

import { useState, useRef, useCallback } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
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
} from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Requirement {
  id: string;
  stableKey: string;
  title: string;
  parentId: string | null;
}

interface ParsedRequirement {
  tempId: string;
  title: string;
  whatThisDoes: string;
  whyThisExists: string;
  notIncluded: string;
  acceptanceCriteria: string;
  priority: string;
  tags: string[];
  parentRef: string | null;
}

interface FileItem {
  name: string;
  type: string;
  size: number;
  content: string; // base64 for images, text for others
}

interface BulkImportDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  existingRequirements: Requirement[];
  onSuccess: () => void;
}

type Step = 'input' | 'preview' | 'creating';

const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB per file
const MAX_TOTAL_SIZE = 25 * 1024 * 1024; // 25MB total
const ALLOWED_TYPES = [
  'application/pdf',
  'image/png',
  'image/jpeg',
  'image/jpg',
  'text/plain',
  'text/markdown',
];

export function BulkImportDialog({
  open,
  onOpenChange,
  productId,
  productName,
  existingRequirements,
  onSuccess,
}: BulkImportDialogProps) {
  const [step, setStep] = useState<Step>('input');
  const [description, setDescription] = useState('');
  const [files, setFiles] = useState<FileItem[]>([]);
  const [targetParentId, setTargetParentId] = useState<string>('');
  const [generating, setGenerating] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState('');
  const [parsedRequirements, setParsedRequirements] = useState<ParsedRequirement[]>([]);
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [createProgress, setCreateProgress] = useState({ current: 0, total: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetDialog = useCallback(() => {
    setStep('input');
    setDescription('');
    setFiles([]);
    setTargetParentId('');
    setGenerating(false);
    setCreating(false);
    setError('');
    setParsedRequirements([]);
    setExpandedItems(new Set());
    setEditingId(null);
    setCreateProgress({ current: 0, total: 0 });
  }, []);

  const handleClose = useCallback(
    (open: boolean) => {
      if (!open) {
        resetDialog();
      }
      onOpenChange(open);
    },
    [onOpenChange, resetDialog]
  );

  const handleFileSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFiles = e.target.files;
    if (!selectedFiles) return;

    const newFiles: FileItem[] = [];
    let totalSize = files.reduce((sum, f) => sum + f.size, 0);

    for (const file of Array.from(selectedFiles)) {
      // Validate type
      if (!ALLOWED_TYPES.includes(file.type)) {
        setError(`File type not supported: ${file.name}`);
        continue;
      }

      // Validate size
      if (file.size > MAX_FILE_SIZE) {
        setError(`File too large: ${file.name} (max 10MB)`);
        continue;
      }

      totalSize += file.size;
      if (totalSize > MAX_TOTAL_SIZE) {
        setError('Total file size exceeds 25MB');
        break;
      }

      // Read file content
      const content = await readFileContent(file);
      newFiles.push({
        name: file.name,
        type: file.type,
        size: file.size,
        content,
      });
    }

    setFiles((prev) => [...prev, ...newFiles]);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const readFileContent = async (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();

      if (file.type.startsWith('image/')) {
        // Read as base64 for images
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else if (file.type === 'application/pdf') {
        // For PDFs, read as base64 and let the server extract text
        reader.onload = () => {
          const base64 = (reader.result as string).split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      } else {
        // Read as text
        reader.onload = () => {
          resolve(reader.result as string);
        };
        reader.onerror = reject;
        reader.readAsText(file);
      }
    });
  };

  const removeFile = (index: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== index));
  };

  const handleGenerate = async () => {
    if (!description.trim()) {
      setError('Please enter a description');
      return;
    }

    setGenerating(true);
    setError('');

    try {
      const response = await fetch('/api/ai/parse-requirements', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description,
          files: files.map((f) => ({
            name: f.name,
            type: f.type,
            content: f.content,
          })),
          existingRequirements: existingRequirements.map((r) => ({
            id: r.id,
            stableKey: r.stableKey,
            title: r.title,
            parentId: r.parentId,
          })),
          targetParentId: targetParentId || null,
          productName,
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to generate requirements');
      }

      const data = await response.json();
      setParsedRequirements(data.requirements);
      setStep('preview');

      // Expand all items by default
      setExpandedItems(new Set(data.requirements.map((r: ParsedRequirement) => r.tempId)));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to generate requirements');
    } finally {
      setGenerating(false);
    }
  };

  const handleCreateAll = async () => {
    if (parsedRequirements.length === 0) return;

    setCreating(true);
    setStep('creating');
    setCreateProgress({ current: 0, total: parsedRequirements.length });
    setError('');

    try {
      const response = await fetch('/api/requirements/batch', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productId,
          requirements: parsedRequirements.map((req) => ({
            tempId: req.tempId,
            title: req.title,
            whatThisDoes: req.whatThisDoes,
            whyThisExists: req.whyThisExists,
            notIncluded: req.notIncluded,
            acceptanceCriteria: req.acceptanceCriteria,
            priority: req.priority,
            tags: req.tags,
            parentRef: req.parentRef || targetParentId || null,
          })),
        }),
      });

      if (!response.ok) {
        const data = await response.json();
        throw new Error(data.error || 'Failed to create requirements');
      }

      const data = await response.json();
      setCreateProgress({ current: data.created.length, total: parsedRequirements.length });

      // Success - close dialog and refresh
      setTimeout(() => {
        handleClose(false);
        onSuccess();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create requirements');
      setStep('preview');
    } finally {
      setCreating(false);
    }
  };

  const toggleExpand = (tempId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(tempId)) {
        next.delete(tempId);
      } else {
        next.add(tempId);
      }
      return next;
    });
  };

  const updateRequirement = (tempId: string, updates: Partial<ParsedRequirement>) => {
    setParsedRequirements((prev) =>
      prev.map((r) => (r.tempId === tempId ? { ...r, ...updates } : r))
    );
  };

  const deleteRequirement = (tempId: string) => {
    setParsedRequirements((prev) => {
      // Remove the requirement and any children that reference it
      const toDelete = new Set([tempId]);
      let changed = true;
      while (changed) {
        changed = false;
        prev.forEach((r) => {
          if (r.parentRef && toDelete.has(r.parentRef) && !toDelete.has(r.tempId)) {
            toDelete.add(r.tempId);
            changed = true;
          }
        });
      }
      return prev.filter((r) => !toDelete.has(r.tempId));
    });
  };

  const formatFileSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const priorityColors: Record<string, string> = {
    critical: 'danger',
    high: 'warning',
    medium: 'secondary',
    low: 'secondary',
  };

  // Build tree from parsed requirements for preview
  const buildPreviewTree = (reqs: ParsedRequirement[]) => {
    const roots: ParsedRequirement[] = [];
    const childrenMap = new Map<string, ParsedRequirement[]>();

    // First pass: identify roots and group children
    reqs.forEach((req) => {
      if (!req.parentRef || !reqs.find((r) => r.tempId === req.parentRef)) {
        roots.push(req);
      } else {
        const siblings = childrenMap.get(req.parentRef) || [];
        siblings.push(req);
        childrenMap.set(req.parentRef, siblings);
      }
    });

    return { roots, childrenMap };
  };

  const renderPreviewItem = (
    req: ParsedRequirement,
    childrenMap: Map<string, ParsedRequirement[]>,
    level: number = 0
  ) => {
    const isExpanded = expandedItems.has(req.tempId);
    const isEditing = editingId === req.tempId;
    const children = childrenMap.get(req.tempId) || [];

    return (
      <div key={req.tempId} className="border-b last:border-b-0">
        <div
          className={cn(
            'flex items-start gap-2 py-3 px-3 hover:bg-gray-50 transition-colors',
            isEditing && 'bg-purple-50'
          )}
          style={{ paddingLeft: `${level * 20 + 12}px` }}
        >
          <button
            className={cn(
              'p-0.5 rounded hover:bg-gray-200 transition-colors mt-1',
              children.length === 0 && 'invisible'
            )}
            onClick={() => toggleExpand(req.tempId)}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4 text-gray-500" />
            ) : (
              <ChevronRight className="h-4 w-4 text-gray-500" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {isEditing ? (
              <div className="space-y-3">
                <Input
                  value={req.title}
                  onChange={(e) => updateRequirement(req.tempId, { title: e.target.value })}
                  placeholder="Title"
                  className="font-medium"
                />
                <Textarea
                  value={req.whatThisDoes}
                  onChange={(e) => updateRequirement(req.tempId, { whatThisDoes: e.target.value })}
                  placeholder="What this does (Users can...)"
                  rows={2}
                />
                <Textarea
                  value={req.whyThisExists}
                  onChange={(e) => updateRequirement(req.tempId, { whyThisExists: e.target.value })}
                  placeholder="Why this exists"
                  rows={2}
                />
                <Textarea
                  value={req.acceptanceCriteria}
                  onChange={(e) =>
                    updateRequirement(req.tempId, { acceptanceCriteria: e.target.value })
                  }
                  placeholder="Acceptance criteria (one per line with - prefix)"
                  rows={3}
                />
                <div className="flex gap-2">
                  <Select
                    value={req.priority}
                    onValueChange={(value) => updateRequirement(req.tempId, { priority: value })}
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
                onClick={() => setEditingId(req.tempId)}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-gray-900 truncate">{req.title}</span>
                  <Badge variant={priorityColors[req.priority] as any} className="text-xs">
                    {req.priority}
                  </Badge>
                </div>
                <p className="text-sm text-gray-600 line-clamp-2">{req.whatThisDoes}</p>
              </div>
            )}
          </div>

          {!isEditing && (
            <button
              className="p-1.5 rounded hover:bg-red-100 text-gray-400 hover:text-red-600 transition-colors"
              onClick={() => deleteRequirement(req.tempId)}
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {isExpanded &&
          children.map((child) => renderPreviewItem(child, childrenMap, level + 1))}
      </div>
    );
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl max-h-[90vh] overflow-hidden flex flex-col">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-purple-600" />
            Import Requirements with AI
          </DialogTitle>
          <DialogDescription>
            Describe your requirements in plain English and let AI structure them for you.
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
                <Textarea
                  placeholder="Example: We need user authentication with login, registration, password reset, and email verification. There should also be role-based access control with admin and regular user roles."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  rows={6}
                  className="resize-none"
                />
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
                    files.length > 0 && 'border-purple-300 bg-purple-50'
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
                          [{req.stableKey}] {req.title}
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
              <div className="text-sm text-gray-600 mb-3">
                {parsedRequirements.length} requirement{parsedRequirements.length !== 1 ? 's' : ''}{' '}
                generated. Click to edit, then create all.
              </div>
              <div className="border rounded-lg overflow-hidden">
                {(() => {
                  const { roots, childrenMap } = buildPreviewTree(parsedRequirements);
                  return roots.map((req) => renderPreviewItem(req, childrenMap));
                })()}
              </div>
            </div>
          )}

          {step === 'creating' && (
            <div className="py-12 text-center">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600 mx-auto mb-4" />
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
              <Button onClick={handleGenerate} disabled={generating || !description.trim()}>
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
                onClick={handleCreateAll}
                disabled={creating || parsedRequirements.length === 0}
              >
                {creating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                Create All ({parsedRequirements.length})
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
