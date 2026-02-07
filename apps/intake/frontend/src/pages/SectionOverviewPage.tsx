import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  CheckCircle2,
  Circle,
  Clock,
  SkipForward,
  MinusCircle,
  ChevronDown,
  ChevronRight,
  UserPlus,
  Plus,
  Loader2,
  BookOpen,
} from 'lucide-react';
import { api, axiosInstance } from '@/api/client';
import type {
  IntakeResponse,
  IntakeSectionInstanceResponse,
  IntakeQuestionInstanceResponse,
  SectionInstanceStatus,
  QuestionInstanceStatus,
  SectionNarrativeSummary,
} from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const SECTION_STATUS_CONFIG: Record<
  SectionInstanceStatus,
  { label: string; bg: string; text: string }
> = {
  notStarted: { label: 'Not Started', bg: 'bg-gray-100', text: 'text-gray-600' },
  inProgress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  complete: { label: 'Complete', bg: 'bg-green-100', text: 'text-green-700' },
  notApplicable: { label: 'N/A', bg: 'bg-gray-100', text: 'text-gray-500' },
};

const QUESTION_STATUS_ICON: Record<
  QuestionInstanceStatus,
  { icon: React.ComponentType<{ className?: string }>; color: string }
> = {
  answered: { icon: CheckCircle2, color: 'text-green-500' },
  skipped: { icon: SkipForward, color: 'text-yellow-500' },
  later: { icon: Clock, color: 'text-orange-500' },
  notApplicable: { icon: MinusCircle, color: 'text-gray-400' },
  unanswered: { icon: Circle, color: 'text-gray-300' },
};

function SectionStatusBadge({ status }: { status: SectionInstanceStatus }) {
  const cfg = SECTION_STATUS_CONFIG[status] ?? SECTION_STATUS_CONFIG.notStarted;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function SectionSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="h-4 w-48 rounded bg-gray-200" />
      <div className="h-24 rounded-xl bg-gray-200" />
      <div className="h-32 rounded-xl bg-gray-200" />
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function SectionOverviewPage() {
  const { intakeId, sectionId: sectionInstanceId } = useParams<{
    intakeId: string;
    sectionId: string;
  }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [showQuestions, setShowQuestions] = useState(false);
  const [showCompleteConfirm, setShowCompleteConfirm] = useState(false);
  const [activeRepeatTab, setActiveRepeatTab] = useState<string | null>(null);

  // ---- Queries ----

  const { data: intake } = useQuery<IntakeResponse>({
    queryKey: ['intake', intakeId],
    queryFn: () => api.intakes.get(intakeId!),
    enabled: !!intakeId,
  });

  const { data: section, isLoading: sectionLoading, isError: sectionError } = useQuery<IntakeSectionInstanceResponse>({
    queryKey: ['sectionInstance', sectionInstanceId],
    queryFn: () => api.sections.get(intakeId!, sectionInstanceId!),
    enabled: !!intakeId && !!sectionInstanceId,
  });

  // Fetch all section instances for the same template section (for repeatable tabs)
  const { data: allSections } = useQuery<IntakeSectionInstanceResponse[]>({
    queryKey: ['intakeSections', intakeId],
    queryFn: () => api.sections.list(intakeId!),
    enabled: !!intakeId,
  });

  const { data: questions } = useQuery<IntakeQuestionInstanceResponse[]>({
    queryKey: ['sectionQuestions', sectionInstanceId],
    queryFn: async () => {
      const res = await axiosInstance.get<IntakeQuestionInstanceResponse[]>(
        `/intakes/${intakeId}/sections/${sectionInstanceId}/questions`,
      );
      return res.data;
    },
    enabled: !!intakeId && !!sectionInstanceId,
  });

  const { data: narrative } = useQuery<SectionNarrativeSummary>({
    queryKey: ['sectionNarrative', sectionInstanceId],
    queryFn: async () => {
      const res = await axiosInstance.get<SectionNarrativeSummary>(
        `/intakes/${intakeId}/sections/${sectionInstanceId}/narrative`,
      );
      return res.data;
    },
    enabled: !!intakeId && !!sectionInstanceId,
  });

  // ---- Mutations ----

  const markCompleteMutation = useMutation({
    mutationFn: () => api.sections.markComplete(intakeId!, sectionInstanceId!),
    onSuccess: () => {
      setShowCompleteConfirm(false);
      queryClient.invalidateQueries({ queryKey: ['sectionInstance', sectionInstanceId] });
      queryClient.invalidateQueries({ queryKey: ['intakeSections', intakeId] });
      queryClient.invalidateQueries({ queryKey: ['intake', intakeId] });
    },
  });

  const addRepeatMutation = useMutation({
    mutationFn: () =>
      api.sections.addRepeatInstance(intakeId!, section!.templateSectionId, {}),
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ['intakeSections', intakeId] });
      navigate(`/intakes/${intakeId}/sections/${data.intakeSectionInstanceId}`);
    },
  });

  // ---- Derived data ----

  const repeatSiblings = allSections?.filter(
    (s) => section && s.templateSectionId === section.templateSectionId,
  );
  const isRepeatable = repeatSiblings && repeatSiblings.length > 1;

  // Question stats
  const stats = questions
    ? {
        total: questions.length,
        answered: questions.filter((q) => q.status === 'answered').length,
        skipped: questions.filter((q) => q.status === 'skipped').length,
        later: questions.filter((q) => q.status === 'later').length,
        unanswered: questions.filter((q) => q.status === 'unanswered').length,
        notApplicable: questions.filter((q) => q.status === 'notApplicable').length,
      }
    : null;

  const unansweredRequired = questions
    ? questions.filter((q) => q.isRequired && q.status === 'unanswered').length
    : 0;

  // Active section for repeatable tabs
  const currentSectionId = activeRepeatTab ?? sectionInstanceId;

  // ---- Render ----

  if (sectionLoading) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
        <SectionSkeleton />
      </div>
    );
  }

  if (sectionError || !section) {
    return (
      <div className="mx-auto max-w-4xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">Failed to load section.</p>
        <button
          onClick={() => navigate(`/intakes/${intakeId}`)}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Back to Dashboard
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button
          onClick={() => navigate(`/intakes/${intakeId}`)}
          className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
        >
          <ArrowLeft className="h-5 w-5" />
        </button>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-3">
            <h1 className="truncate text-2xl font-bold text-gray-900">
              {section.instanceLabel ?? section.sectionName}
            </h1>
            <SectionStatusBadge status={section.status} />
          </div>
          {intake && (
            <p className="mt-0.5 text-sm text-gray-500">{intake.intakeName}</p>
          )}
        </div>
      </div>

      {/* Repeatable section tabs */}
      {isRepeatable && repeatSiblings && (
        <div className="mt-4 flex gap-1 overflow-x-auto rounded-lg bg-gray-100 p-1">
          {repeatSiblings
            .sort((a, b) => a.repeatIndex - b.repeatIndex)
            .map((s) => (
              <button
                key={s.intakeSectionInstanceId}
                onClick={() => {
                  setActiveRepeatTab(s.intakeSectionInstanceId);
                  if (s.intakeSectionInstanceId !== sectionInstanceId) {
                    navigate(
                      `/intakes/${intakeId}/sections/${s.intakeSectionInstanceId}`,
                      { replace: true },
                    );
                  }
                }}
                className={`rounded-md px-3 py-1.5 text-sm font-medium whitespace-nowrap transition ${
                  (currentSectionId === s.intakeSectionInstanceId)
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {s.instanceLabel ?? `${s.sectionName} ${s.repeatIndex + 1}`}
              </button>
            ))}
        </div>
      )}

      {/* Progress bar + stats */}
      <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
        <div className="flex items-center justify-between text-sm">
          <span className="font-medium text-gray-700">Progress</span>
          <span className="font-bold text-gray-900 tabular-nums">
            {Math.round(section.percentComplete)}%
          </span>
        </div>
        <div className="mt-2 h-2.5 rounded-full bg-gray-200">
          <div
            className="h-2.5 rounded-full bg-blue-600 transition-all"
            style={{ width: `${Math.min(section.percentComplete, 100)}%` }}
          />
        </div>
        {stats && (
          <div className="mt-3 flex flex-wrap gap-4 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <CheckCircle2 className="h-3.5 w-3.5 text-green-500" />
              {stats.answered} answered
            </span>
            <span className="flex items-center gap-1">
              <SkipForward className="h-3.5 w-3.5 text-yellow-500" />
              {stats.skipped} skipped
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3.5 w-3.5 text-orange-500" />
              {stats.later} later
            </span>
            <span className="flex items-center gap-1">
              <Circle className="h-3.5 w-3.5 text-gray-300" />
              {stats.unanswered} unanswered
            </span>
          </div>
        )}
      </div>

      {/* Captured So Far narrative */}
      {narrative && (
        <div className="mt-6 rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <BookOpen className="h-5 w-5 text-blue-600" />
            <h2 className="text-sm font-semibold text-gray-900">Captured So Far</h2>
          </div>
          <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-wrap">
            {narrative.narrativeText}
          </p>
          <p className="mt-2 text-xs text-gray-400">
            Generated {new Date(narrative.generatedAt).toLocaleDateString()}
          </p>
        </div>
      )}

      {/* Remaining items */}
      {unansweredRequired > 0 && (
        <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3">
          <p className="text-sm font-medium text-amber-800">
            {unansweredRequired} required question{unansweredRequired !== 1 ? 's' : ''} still
            unanswered
          </p>
        </div>
      )}

      {/* Expandable question list */}
      <div className="mt-6">
        <button
          onClick={() => setShowQuestions(!showQuestions)}
          className="flex w-full items-center justify-between rounded-xl border border-gray-200 bg-white px-5 py-4 text-left shadow-sm hover:bg-gray-50 transition"
        >
          <span className="text-sm font-semibold text-gray-900">
            Show Questions ({questions?.length ?? 0} total)
          </span>
          {showQuestions ? (
            <ChevronDown className="h-5 w-5 text-gray-400" />
          ) : (
            <ChevronRight className="h-5 w-5 text-gray-400" />
          )}
        </button>

        {showQuestions && questions && (
          <div className="mt-2 divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white shadow-sm overflow-hidden">
            {questions
              .sort((a, b) => {
                // Sort by question order via questionKey as a proxy, or just use array order
                return 0;
              })
              .map((q) => {
                const statusCfg = QUESTION_STATUS_ICON[q.status] ?? QUESTION_STATUS_ICON.unanswered;
                const StatusIcon = statusCfg.icon;

                return (
                  <Link
                    key={q.intakeQuestionInstanceId}
                    to={`/intakes/${intakeId}/sections/${sectionInstanceId}/questions/${q.intakeQuestionInstanceId}`}
                    className="flex items-start gap-3 px-5 py-3 hover:bg-gray-50 transition"
                  >
                    <StatusIcon className={`mt-0.5 h-5 w-5 flex-shrink-0 ${statusCfg.color}`} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-medium text-gray-900">
                        {q.questionText}
                        {q.isRequired && (
                          <span className="ml-1 text-red-500">*</span>
                        )}
                      </p>
                      {q.currentAnswer && (
                        <p className="mt-0.5 truncate text-xs text-gray-500">
                          {q.currentAnswer}
                        </p>
                      )}
                    </div>
                    <ChevronRight className="mt-0.5 h-4 w-4 flex-shrink-0 text-gray-400" />
                  </Link>
                );
              })}
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="mt-8 flex flex-wrap items-center gap-3">
        {section.status !== 'complete' && (
          <>
            {showCompleteConfirm ? (
              <div className="flex items-center gap-2 rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2">
                <p className="text-sm text-yellow-800">
                  Mark this section as complete?
                  {unansweredRequired > 0 && (
                    <span className="font-medium">
                      {' '}
                      ({unansweredRequired} required question{unansweredRequired !== 1 ? 's' : ''} unanswered)
                    </span>
                  )}
                </p>
                <button
                  onClick={() => markCompleteMutation.mutate()}
                  disabled={markCompleteMutation.isPending}
                  className="inline-flex items-center gap-1 rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-50 transition"
                >
                  {markCompleteMutation.isPending && (
                    <Loader2 className="h-3 w-3 animate-spin" />
                  )}
                  Confirm
                </button>
                <button
                  onClick={() => setShowCompleteConfirm(false)}
                  className="rounded-lg px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-100 transition"
                >
                  Cancel
                </button>
              </div>
            ) : (
              <button
                onClick={() => setShowCompleteConfirm(true)}
                className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-green-700 transition"
              >
                <CheckCircle2 className="h-4 w-4" />
                Mark Section Complete
              </button>
            )}
          </>
        )}

        {/* Only show "Add Repeat Instance" if the section template is repeatable */}
        {isRepeatable && (
          <button
            onClick={() => addRepeatMutation.mutate()}
            disabled={addRepeatMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50 transition"
          >
            {addRepeatMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Plus className="h-4 w-4" />
            )}
            Add Repeat Instance
          </button>
        )}

        <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
          <UserPlus className="h-4 w-4" />
          Assign Person
        </button>
      </div>
    </div>
  );
}
