import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  MinusCircle,
  Save,
  RotateCcw,
  FileText,
  Link as LinkIcon,
  Mic,
  AlertTriangle,
  Loader2,
  ChevronDown,
  ChevronRight,
  Copy,
  Check,
} from 'lucide-react';
import { axiosInstance } from '@/api/client';
import type {
  IntakeQuestionInstanceResponse,
  AnswerRevisionResponse,
  EvidenceResponse,
  QuestionInstanceStatus,
  RevisionType,
} from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  QuestionInstanceStatus,
  { label: string; bg: string; text: string; icon: React.ComponentType<{ className?: string }> }
> = {
  answered: { label: 'Answered', bg: 'bg-green-100', text: 'text-green-700', icon: CheckCircle2 },
  skipped: { label: 'Skipped', bg: 'bg-yellow-100', text: 'text-yellow-700', icon: SkipForward },
  later: { label: 'Later', bg: 'bg-orange-100', text: 'text-orange-700', icon: Clock },
  notApplicable: { label: 'Not Applicable', bg: 'bg-gray-100', text: 'text-gray-500', icon: MinusCircle },
  unanswered: { label: 'Unanswered', bg: 'bg-gray-100', text: 'text-gray-600', icon: Circle },
};

const REVISION_TYPE_LABELS: Record<RevisionType, { label: string; bg: string; text: string }> = {
  proposedFromCall: { label: 'From Call', bg: 'bg-blue-100', text: 'text-blue-700' },
  proposedFromUpload: { label: 'From Upload', bg: 'bg-purple-100', text: 'text-purple-700' },
  proposedFromUrlRefresh: { label: 'From URL', bg: 'bg-teal-100', text: 'text-teal-700' },
  confirmed: { label: 'Confirmed', bg: 'bg-green-100', text: 'text-green-700' },
  manualEdit: { label: 'Manual Edit', bg: 'bg-gray-100', text: 'text-gray-700' },
};

const EVIDENCE_TYPE_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  transcriptExcerpt: Mic,
  documentExcerpt: FileText,
  urlContent: LinkIcon,
  image: FileText,
  other: FileText,
};

function formatTimestamp(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function QuestionStatusBadge({ status }: { status: QuestionInstanceStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.unanswered;
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function RevisionTypeBadge({ type }: { type: RevisionType }) {
  const cfg = REVISION_TYPE_LABELS[type] ?? REVISION_TYPE_LABELS.manualEdit;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function QuestionSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-3/4 rounded bg-gray-200" />
      <div className="h-4 w-1/2 rounded bg-gray-200" />
      <div className="h-32 rounded-xl bg-gray-200" />
      <div className="h-24 rounded-xl bg-gray-200" />
      <div className="h-48 rounded-xl bg-gray-200" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function QuestionDetailPage() {
  const { intakeId, sectionInstanceId, questionInstanceId } = useParams<{
    intakeId: string;
    sectionInstanceId: string;
    questionInstanceId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [editMode, setEditMode] = useState(false);
  const [editedAnswer, setEditedAnswer] = useState('');
  const [showRevisions, setShowRevisions] = useState(false);
  const [answerCopied, setAnswerCopied] = useState(false);

  // ---- Queries ----

  const { data: question, isLoading, isError } = useQuery<IntakeQuestionInstanceResponse>({
    queryKey: ['questionInstance', questionInstanceId],
    queryFn: async () => {
      const res = await axiosInstance.get<IntakeQuestionInstanceResponse>(
        `/intakes/${intakeId}/sectionInstances/${sectionInstanceId}/questionInstances/${questionInstanceId}`,
      );
      return res.data;
    },
    enabled: !!intakeId && !!sectionInstanceId && !!questionInstanceId,
  });

  const { data: revisions } = useQuery<AnswerRevisionResponse[]>({
    queryKey: ['answerRevisions', questionInstanceId],
    queryFn: async () => {
      const res = await axiosInstance.get<AnswerRevisionResponse[]>(
        `/intakes/${intakeId}/questionInstances/${questionInstanceId}/revisions`,
      );
      return res.data;
    },
    enabled: !!intakeId && !!questionInstanceId,
  });

  const { data: evidence } = useQuery<EvidenceResponse[]>({
    queryKey: ['questionEvidence', questionInstanceId],
    queryFn: async () => {
      const res = await axiosInstance.get<EvidenceResponse[]>(
        `/intakes/${intakeId}/questionInstances/${questionInstanceId}/evidence`,
      );
      return res.data;
    },
    enabled: !!intakeId && !!questionInstanceId,
  });

  // ---- Mutations ----

  const saveRevisionMutation = useMutation({
    mutationFn: async (answerText: string) => {
      const res = await axiosInstance.post<AnswerRevisionResponse>(
        `/intakes/${intakeId}/questionInstances/${questionInstanceId}/revisions`,
        {
          intakeQuestionInstanceId: questionInstanceId,
          revisionType: 'manualEdit',
          answerText,
          makeCurrent: true,
        },
      );
      return res.data;
    },
    onSuccess: () => {
      setEditMode(false);
      setEditedAnswer('');
      queryClient.invalidateQueries({ queryKey: ['questionInstance', questionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['answerRevisions', questionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['sectionQuestions', sectionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['sectionInstance', sectionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['intake', intakeId] });
    },
  });

  const markStatusMutation = useMutation({
    mutationFn: async (newStatus: QuestionInstanceStatus) => {
      const res = await axiosInstance.patch<IntakeQuestionInstanceResponse>(
        `/intakes/${intakeId}/sectionInstances/${sectionInstanceId}/questionInstances/${questionInstanceId}`,
        { status: newStatus },
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionInstance', questionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['sectionQuestions', sectionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['sectionInstance', sectionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['intake', intakeId] });
    },
  });

  const makeCurrentMutation = useMutation({
    mutationFn: async (revisionId: string) => {
      await axiosInstance.post(`/intakes/${intakeId}/questionInstances/${questionInstanceId}/chooseCurrent`, {
        intakeQuestionInstanceId: questionInstanceId,
        answerRevisionId: revisionId,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['questionInstance', questionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['answerRevisions', questionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['sectionQuestions', sectionInstanceId] });
    },
  });

  // ---- Handlers ----

  function startEditing() {
    setEditedAnswer(question?.currentAnswer ?? '');
    setEditMode(true);
  }

  function handleSaveRevision() {
    if (!editedAnswer.trim()) return;
    saveRevisionMutation.mutate(editedAnswer.trim());
  }

  async function copyAnswer() {
    if (!question?.currentAnswer) return;
    try {
      await navigator.clipboard.writeText(question.currentAnswer);
      setAnswerCopied(true);
      setTimeout(() => setAnswerCopied(false), 2000);
    } catch {
      // Fallback
    }
  }

  // ---- Derived data ----

  const currentRevision = revisions?.find((r) => r.isCurrent);

  // Check for conflicts (multiple revisions with different answers)
  const uniqueAnswers = revisions
    ? new Set(revisions.filter((r) => r.answerText).map((r) => r.answerText)).size
    : 0;
  const hasConflict = uniqueAnswers > 1;

  // Sorted revisions (newest first)
  const sortedRevisions = revisions
    ? [...revisions].sort(
        (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
      )
    : [];

  // ---- Render ----

  if (isLoading) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
        <QuestionSkeleton />
      </div>
    );
  }

  if (isError || !question) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">Failed to load question.</p>
        <button
          onClick={() => navigate(`/intakes/${intakeId}/sections/${sectionInstanceId}`)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Back to Section
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-start gap-3">
        <button
          onClick={() => navigate(`/intakes/${intakeId}/sections/${sectionInstanceId}`)}
          className="mt-1 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <h1 className="text-xl font-bold text-gray-900 leading-snug">
            {question.questionText}
          </h1>
          <div className="mt-2 flex items-center gap-3">
            <QuestionStatusBadge status={question.status} />
            {question.isRequired && (
              <span className="text-xs font-medium text-red-500">Required</span>
            )}
            <span className="text-xs text-gray-400">
              Key: {question.questionKey}
            </span>
          </div>
        </div>
      </div>

      {/* Conflict warning */}
      {hasConflict && (
        <div className="mt-4 flex items-start gap-3 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 flex-shrink-0 text-amber-600" />
          <div>
            <p className="text-sm font-medium text-amber-800">Conflicting answers detected</p>
            <p className="mt-0.5 text-xs text-amber-700">
              Multiple sources provided different answers. Review the revision history to resolve.
            </p>
          </div>
        </div>
      )}

      {/* Current answer card */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-900">Current Answer</h2>
          <div className="flex items-center gap-2">
            {question.currentAnswer && (
              <button
                onClick={copyAnswer}
                className="rounded p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
                title="Copy answer"
              >
                {answerCopied ? (
                  <Check className="h-4 w-4 text-green-600" />
                ) : (
                  <Copy className="h-4 w-4" />
                )}
              </button>
            )}
            {!editMode && (
              <button
                onClick={startEditing}
                className="text-xs font-medium text-blue-600 hover:text-blue-700"
              >
                Edit
              </button>
            )}
          </div>
        </div>

        {editMode ? (
          <div className="mt-3">
            <textarea
              value={editedAnswer}
              onChange={(e) => setEditedAnswer(e.target.value)}
              rows={4}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
              placeholder="Type the answer..."
              autoFocus
            />
            <div className="mt-3 flex items-center gap-2">
              <button
                onClick={handleSaveRevision}
                disabled={saveRevisionMutation.isPending || !editedAnswer.trim()}
                className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition"
              >
                {saveRevisionMutation.isPending ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Save className="h-3.5 w-3.5" />
                )}
                Save as New Revision
              </button>
              <button
                onClick={() => {
                  setEditMode(false);
                  setEditedAnswer('');
                }}
                className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : question.currentAnswer ? (
          <div className="mt-3">
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
              {question.currentAnswer}
            </p>

            {/* Structured data */}
            {currentRevision?.answerStructuredData && (
              <div className="mt-3 rounded-lg bg-gray-50 p-3">
                <p className="text-xs font-medium text-gray-500 mb-1">Structured Data</p>
                <pre className="text-xs text-gray-600 overflow-x-auto">
                  {JSON.stringify(currentRevision.answerStructuredData, null, 2)}
                </pre>
              </div>
            )}

            {/* Evidence links */}
            {currentRevision?.sourceEvidenceItemId && evidence && (
              <div className="mt-3">
                {evidence
                  .filter((e) => e.evidenceItemId === currentRevision.sourceEvidenceItemId)
                  .map((ev) => {
                    const EvidenceIcon = EVIDENCE_TYPE_ICONS[ev.evidenceType] ?? FileText;
                    return (
                      <div
                        key={ev.evidenceItemId}
                        className="flex items-start gap-2 rounded-lg border border-gray-100 bg-gray-50 p-3"
                      >
                        <EvidenceIcon className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                        <div className="text-xs text-gray-600">
                          {ev.excerptText && (
                            <p className="italic">"{ev.excerptText}"</p>
                          )}
                          {ev.startMs != null && ev.endMs != null && (
                            <p className="mt-1 text-gray-400">
                              {formatTimestamp(ev.startMs)} - {formatTimestamp(ev.endMs)}
                            </p>
                          )}
                        </div>
                      </div>
                    );
                  })}
              </div>
            )}
          </div>
        ) : (
          <p className="mt-3 text-sm italic text-gray-400">No answer yet.</p>
        )}
      </div>

      {/* Status actions */}
      <div className="mt-4 flex flex-wrap gap-2">
        {question.status !== 'notApplicable' && (
          <button
            onClick={() => markStatusMutation.mutate('notApplicable')}
            disabled={markStatusMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <MinusCircle className="h-3.5 w-3.5" />
            Mark Not Applicable
          </button>
        )}
        {question.status !== 'later' && (
          <button
            onClick={() => markStatusMutation.mutate('later')}
            disabled={markStatusMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <Clock className="h-3.5 w-3.5" />
            Mark for Later
          </button>
        )}
        {question.status !== 'skipped' && (
          <button
            onClick={() => markStatusMutation.mutate('skipped')}
            disabled={markStatusMutation.isPending}
            className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            <SkipForward className="h-3.5 w-3.5" />
            Skip
          </button>
        )}
      </div>

      {/* Revision history */}
      <div className="mt-8">
        <button
          onClick={() => setShowRevisions(!showRevisions)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm hover:bg-gray-50 transition"
        >
          <span className="text-sm font-semibold text-gray-900">
            Revision History ({sortedRevisions.length})
          </span>
          {showRevisions ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {showRevisions && sortedRevisions.length > 0 && (
          <div className="mt-2 space-y-2">
            {sortedRevisions.map((rev) => (
              <div
                key={rev.answerRevisionId}
                className={`rounded-xl border bg-white p-4 shadow-sm ${
                  rev.isCurrent
                    ? 'border-blue-300 ring-1 ring-blue-100'
                    : 'border-gray-200'
                }`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <RevisionTypeBadge type={rev.revisionType} />
                    {rev.isCurrent && (
                      <span className="inline-flex items-center rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Current
                      </span>
                    )}
                    {rev.confidenceScore != null && (
                      <span className="text-xs text-gray-400">
                        {Math.round(rev.confidenceScore * 100)}% confidence
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-gray-400">
                    {formatDateTime(rev.createdAt)}
                  </span>
                </div>

                {rev.answerText && (
                  <p className="mt-2 text-sm text-gray-700 whitespace-pre-wrap">
                    {rev.answerText}
                  </p>
                )}

                {rev.createdBy && (
                  <p className="mt-2 text-xs text-gray-400">
                    By: {rev.createdBy}
                  </p>
                )}

                {!rev.isCurrent && (
                  <button
                    onClick={() => makeCurrentMutation.mutate(rev.answerRevisionId)}
                    disabled={makeCurrentMutation.isPending}
                    className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-700 disabled:opacity-50"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Make Current
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {showRevisions && sortedRevisions.length === 0 && (
          <div className="mt-2 rounded-xl border border-gray-200 bg-white p-6 text-center shadow-sm">
            <p className="text-sm text-gray-500">No revisions yet.</p>
          </div>
        )}
      </div>

      {/* Evidence panel */}
      {evidence && evidence.length > 0 && (
        <div className="mt-8">
          <h2 className="text-sm font-semibold text-gray-900 mb-3">Evidence</h2>
          <div className="space-y-3">
            {evidence.map((ev) => {
              const EvidenceIcon = EVIDENCE_TYPE_ICONS[ev.evidenceType] ?? FileText;
              return (
                <div
                  key={ev.evidenceItemId}
                  className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm"
                >
                  <div className="flex items-center gap-2">
                    <EvidenceIcon className="h-4 w-4 text-gray-500" />
                    <span className="text-xs font-medium text-gray-700 capitalize">
                      {ev.evidenceType === 'transcriptExcerpt'
                        ? 'Transcript Excerpt'
                        : ev.evidenceType === 'documentExcerpt'
                          ? 'Document Excerpt'
                          : ev.evidenceType === 'urlContent'
                            ? 'URL Content'
                            : ev.evidenceType}
                    </span>
                    {ev.startMs != null && ev.endMs != null && (
                      <span className="ml-auto text-xs text-gray-400 tabular-nums">
                        {formatTimestamp(ev.startMs)} - {formatTimestamp(ev.endMs)}
                      </span>
                    )}
                  </div>
                  {ev.excerptText && (
                    <blockquote className="mt-2 border-l-2 border-gray-200 pl-3 text-sm italic text-gray-600">
                      {ev.excerptText}
                    </blockquote>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mutation error display */}
      {(saveRevisionMutation.isError || markStatusMutation.isError || makeCurrentMutation.isError) && (
        <div className="mt-4 rounded-lg border border-red-200 bg-red-50 p-3">
          <p className="text-sm text-red-700">
            An error occurred. Please try again.
          </p>
        </div>
      )}
    </div>
  );
}
