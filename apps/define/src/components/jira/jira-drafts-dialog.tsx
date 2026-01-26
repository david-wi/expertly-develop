'use client';

import { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Loader2,
  Send,
  Settings,
  Trash2,
  Edit2,
  Check,
  X,
  ExternalLink,
  AlertCircle,
  Sparkles,
  RefreshCw,
} from 'lucide-react';
import { JiraSettingsDialog } from './jira-settings-dialog';

interface JiraDraft {
  id: string;
  productId: string;
  requirementId: string | null;
  summary: string;
  description: string | null;
  issueType: string;
  priority: string;
  labels: string[];
  storyPoints: number | null;
  status: string;
  jiraIssueKey: string | null;
  jiraUrl: string | null;
  errorMessage: string | null;
  requirement: {
    id: string;
    stableKey: string;
    title: string;
  } | null;
}

interface JiraDraftsDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  productId: string;
  productName: string;
  requirementId?: string;
  requirementTitle?: string;
}

export function JiraDraftsDialog({
  open,
  onOpenChange,
  productId,
  productName,
  requirementId,
  requirementTitle,
}: JiraDraftsDialogProps) {
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [sendingId, setSendingId] = useState<string | null>(null);
  const [sendingAll, setSendingAll] = useState(false);
  const [drafts, setDrafts] = useState<JiraDraft[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<Partial<JiraDraft>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [hasSettings, setHasSettings] = useState(false);

  useEffect(() => {
    if (open) {
      checkSettings();
      fetchDrafts();
    }
  }, [open, productId]);

  async function checkSettings() {
    try {
      const response = await fetch(`/api/jira/settings/${productId}`);
      if (response.ok) {
        const data = await response.json();
        setHasSettings(!!data.settings);
      }
    } catch (error) {
      console.error('Error checking settings:', error);
    }
  }

  async function fetchDrafts() {
    setLoading(true);
    try {
      const response = await fetch(`/api/jira/drafts?productId=${productId}`);
      if (response.ok) {
        const data = await response.json();
        setDrafts(data.drafts || []);
      }
    } catch (error) {
      console.error('Error fetching drafts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function generateDrafts() {
    if (!requirementId) return;
    setGenerating(true);
    try {
      const response = await fetch('/api/jira/drafts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ requirementId, productId }),
      });

      if (response.ok) {
        const data = await response.json();
        setDrafts([...drafts, ...data.drafts]);
      }
    } catch (error) {
      console.error('Error generating drafts:', error);
    } finally {
      setGenerating(false);
    }
  }

  async function deleteDraft(id: string) {
    try {
      const response = await fetch(`/api/jira/drafts/${id}`, {
        method: 'DELETE',
      });
      if (response.ok) {
        setDrafts(drafts.filter((d) => d.id !== id));
      }
    } catch (error) {
      console.error('Error deleting draft:', error);
    }
  }

  async function sendDraft(id: string) {
    setSendingId(id);
    try {
      const response = await fetch('/api/jira/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ draftId: id }),
      });

      if (response.ok) {
        const data = await response.json();
        setDrafts(
          drafts.map((d) =>
            d.id === id
              ? {
                  ...d,
                  status: 'sent',
                  jiraIssueKey: data.jiraIssueKey,
                  jiraUrl: data.jiraUrl,
                  errorMessage: null,
                }
              : d
          )
        );
      } else {
        const data = await response.json();
        setDrafts(
          drafts.map((d) =>
            d.id === id
              ? { ...d, status: 'failed', errorMessage: data.error }
              : d
          )
        );
      }
    } catch (error) {
      console.error('Error sending draft:', error);
    } finally {
      setSendingId(null);
    }
  }

  async function sendAllDrafts() {
    setSendingAll(true);
    try {
      const response = await fetch('/api/jira/send-all', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ productId }),
      });

      if (response.ok) {
        // Refresh drafts to get updated statuses
        await fetchDrafts();
      }
    } catch (error) {
      console.error('Error sending all drafts:', error);
    } finally {
      setSendingAll(false);
    }
  }

  function startEditing(draft: JiraDraft) {
    setEditingId(draft.id);
    setEditForm({
      summary: draft.summary,
      description: draft.description,
      issueType: draft.issueType,
      priority: draft.priority,
      storyPoints: draft.storyPoints,
    });
  }

  async function saveEdit() {
    if (!editingId) return;
    try {
      const response = await fetch(`/api/jira/drafts/${editingId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editForm),
      });

      if (response.ok) {
        setDrafts(
          drafts.map((d) =>
            d.id === editingId ? { ...d, ...editForm } : d
          )
        );
        setEditingId(null);
        setEditForm({});
      }
    } catch (error) {
      console.error('Error saving edit:', error);
    }
  }

  const pendingDrafts = drafts.filter((d) => d.status === 'draft');
  const sentDrafts = drafts.filter((d) => d.status === 'sent');
  const failedDrafts = drafts.filter((d) => d.status === 'failed');

  return (
    <>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <div>
                <DialogTitle className="flex items-center gap-2">
                  Draft Jira Stories
                </DialogTitle>
                <DialogDescription>
                  {requirementTitle
                    ? `Generate and manage Jira stories for "${requirementTitle}"`
                    : `Manage Jira story drafts for ${productName}`}
                </DialogDescription>
              </div>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setSettingsOpen(true)}
              >
                <Settings className="h-4 w-4 mr-1" />
                Settings
              </Button>
            </div>
          </DialogHeader>

          {!hasSettings && !loading && (
            <div className="bg-amber-50 border border-amber-200 rounded-lg p-4 mb-4">
              <div className="flex items-start gap-3">
                <AlertCircle className="h-5 w-5 text-amber-600 mt-0.5" />
                <div>
                  <p className="font-medium text-amber-800">
                    Jira not configured
                  </p>
                  <p className="text-sm text-amber-700 mt-1">
                    Configure your Jira settings to send stories.
                  </p>
                  <Button
                    size="sm"
                    variant="outline"
                    className="mt-2"
                    onClick={() => setSettingsOpen(true)}
                  >
                    Configure Jira
                  </Button>
                </div>
              </div>
            </div>
          )}

          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
            </div>
          ) : (
            <div className="space-y-6">
              {/* Actions bar */}
              <div className="flex items-center justify-between gap-4">
                <div className="flex items-center gap-2">
                  {requirementId && (
                    <Button
                      onClick={generateDrafts}
                      disabled={generating}
                    >
                      {generating ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <Sparkles className="h-4 w-4 mr-2" />
                      )}
                      Generate Stories
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    onClick={fetchDrafts}
                    disabled={loading}
                  >
                    <RefreshCw className="h-4 w-4 mr-1" />
                    Refresh
                  </Button>
                </div>
                {pendingDrafts.length > 0 && hasSettings && (
                  <Button
                    onClick={sendAllDrafts}
                    disabled={sendingAll}
                  >
                    {sendingAll ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Send className="h-4 w-4 mr-2" />
                    )}
                    Send All ({pendingDrafts.length})
                  </Button>
                )}
              </div>

              {/* Drafts list */}
              {drafts.length === 0 ? (
                <div className="text-center py-12 text-gray-500">
                  <p>No draft stories yet.</p>
                  {requirementId && (
                    <p className="text-sm mt-1">
                      Click "Generate Stories" to create drafts from this requirement.
                    </p>
                  )}
                </div>
              ) : (
                <div className="space-y-4">
                  {/* Pending drafts */}
                  {pendingDrafts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-gray-700 mb-2">
                        Pending ({pendingDrafts.length})
                      </h3>
                      <div className="space-y-3">
                        {pendingDrafts.map((draft) => (
                          <DraftCard
                            key={draft.id}
                            draft={draft}
                            isEditing={editingId === draft.id}
                            editForm={editForm}
                            setEditForm={setEditForm}
                            onStartEdit={() => startEditing(draft)}
                            onSaveEdit={saveEdit}
                            onCancelEdit={() => {
                              setEditingId(null);
                              setEditForm({});
                            }}
                            onDelete={() => deleteDraft(draft.id)}
                            onSend={() => sendDraft(draft.id)}
                            isSending={sendingId === draft.id}
                            canSend={hasSettings}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Failed drafts */}
                  {failedDrafts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-red-700 mb-2">
                        Failed ({failedDrafts.length})
                      </h3>
                      <div className="space-y-3">
                        {failedDrafts.map((draft) => (
                          <DraftCard
                            key={draft.id}
                            draft={draft}
                            isEditing={editingId === draft.id}
                            editForm={editForm}
                            setEditForm={setEditForm}
                            onStartEdit={() => startEditing(draft)}
                            onSaveEdit={saveEdit}
                            onCancelEdit={() => {
                              setEditingId(null);
                              setEditForm({});
                            }}
                            onDelete={() => deleteDraft(draft.id)}
                            onSend={() => sendDraft(draft.id)}
                            isSending={sendingId === draft.id}
                            canSend={hasSettings}
                          />
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Sent drafts */}
                  {sentDrafts.length > 0 && (
                    <div>
                      <h3 className="text-sm font-medium text-green-700 mb-2">
                        Sent ({sentDrafts.length})
                      </h3>
                      <div className="space-y-3">
                        {sentDrafts.map((draft) => (
                          <DraftCard
                            key={draft.id}
                            draft={draft}
                            isEditing={false}
                            editForm={{}}
                            setEditForm={() => {}}
                            onStartEdit={() => {}}
                            onSaveEdit={() => {}}
                            onCancelEdit={() => {}}
                            onDelete={() => deleteDraft(draft.id)}
                            onSend={() => {}}
                            isSending={false}
                            canSend={false}
                          />
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>

      <JiraSettingsDialog
        open={settingsOpen}
        onOpenChange={setSettingsOpen}
        productId={productId}
        onSaved={() => {
          setHasSettings(true);
        }}
      />
    </>
  );
}

function DraftCard({
  draft,
  isEditing,
  editForm,
  setEditForm,
  onStartEdit,
  onSaveEdit,
  onCancelEdit,
  onDelete,
  onSend,
  isSending,
  canSend,
}: {
  draft: JiraDraft;
  isEditing: boolean;
  editForm: Partial<JiraDraft>;
  setEditForm: (form: Partial<JiraDraft>) => void;
  onStartEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onDelete: () => void;
  onSend: () => void;
  isSending: boolean;
  canSend: boolean;
}) {
  const statusColors: Record<string, string> = {
    draft: 'secondary',
    sent: 'success',
    failed: 'danger',
  };

  return (
    <div className="border border-gray-200 rounded-lg p-4 bg-white">
      {isEditing ? (
        <div className="space-y-3">
          <Input
            value={editForm.summary || ''}
            onChange={(e) => setEditForm({ ...editForm, summary: e.target.value })}
            placeholder="Story summary"
          />
          <Textarea
            value={editForm.description || ''}
            onChange={(e) =>
              setEditForm({ ...editForm, description: e.target.value })
            }
            placeholder="Description"
            rows={4}
          />
          <div className="flex gap-3">
            <Select
              value={editForm.issueType || 'Story'}
              onValueChange={(value) =>
                setEditForm({ ...editForm, issueType: value })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Story">Story</SelectItem>
                <SelectItem value="Task">Task</SelectItem>
                <SelectItem value="Bug">Bug</SelectItem>
                <SelectItem value="Epic">Epic</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={editForm.priority || 'Medium'}
              onValueChange={(value) =>
                setEditForm({ ...editForm, priority: value })
              }
            >
              <SelectTrigger className="w-32">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Highest">Highest</SelectItem>
                <SelectItem value="High">High</SelectItem>
                <SelectItem value="Medium">Medium</SelectItem>
                <SelectItem value="Low">Low</SelectItem>
                <SelectItem value="Lowest">Lowest</SelectItem>
              </SelectContent>
            </Select>
            <Input
              type="number"
              min="1"
              max="21"
              placeholder="Points"
              className="w-20"
              value={editForm.storyPoints || ''}
              onChange={(e) =>
                setEditForm({
                  ...editForm,
                  storyPoints: e.target.value ? parseInt(e.target.value) : null,
                })
              }
            />
          </div>
          <div className="flex gap-2">
            <Button size="sm" onClick={onSaveEdit}>
              <Check className="h-4 w-4 mr-1" />
              Save
            </Button>
            <Button size="sm" variant="outline" onClick={onCancelEdit}>
              <X className="h-4 w-4 mr-1" />
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <>
          <div className="flex items-start justify-between gap-4">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-1">
                <Badge variant={statusColors[draft.status] as any}>
                  {draft.status}
                </Badge>
                <Badge variant="outline">{draft.issueType}</Badge>
                <Badge variant="outline">{draft.priority}</Badge>
                {draft.storyPoints && (
                  <Badge variant="outline">{draft.storyPoints} pts</Badge>
                )}
                {draft.jiraIssueKey && (
                  <a
                    href={draft.jiraUrl || '#'}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-purple-600 hover:text-purple-700 text-sm font-medium flex items-center gap-1"
                  >
                    {draft.jiraIssueKey}
                    <ExternalLink className="h-3 w-3" />
                  </a>
                )}
              </div>
              <h4 className="font-medium text-gray-900">{draft.summary}</h4>
              {draft.requirement && (
                <p className="text-xs text-gray-500 mt-1">
                  From: {draft.requirement.stableKey} - {draft.requirement.title}
                </p>
              )}
              {draft.description && (
                <p className="text-sm text-gray-600 mt-2 whitespace-pre-wrap line-clamp-3">
                  {draft.description}
                </p>
              )}
              {draft.errorMessage && (
                <p className="text-sm text-red-600 mt-2 flex items-center gap-1">
                  <AlertCircle className="h-4 w-4" />
                  {draft.errorMessage}
                </p>
              )}
            </div>
            <div className="flex items-center gap-1">
              {draft.status !== 'sent' && (
                <>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={onStartEdit}
                    title="Edit"
                  >
                    <Edit2 className="h-4 w-4" />
                  </Button>
                  {canSend && (
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={onSend}
                      disabled={isSending}
                      title="Send to Jira"
                    >
                      {isSending ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  )}
                </>
              )}
              <Button
                variant="ghost"
                size="sm"
                onClick={onDelete}
                title="Delete"
                className="text-red-600 hover:text-red-700 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
