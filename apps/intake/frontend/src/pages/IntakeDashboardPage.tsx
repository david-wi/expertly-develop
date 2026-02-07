import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  ArrowLeft,
  Pencil,
  Phone,
  Upload,
  LinkIcon,
  Clock,
  Calendar,
  AlertTriangle,
  Users,
  FileText,
  ChevronRight,
  UserPlus,
  Plus,
  Loader2,
} from 'lucide-react';
import { api, axiosInstance } from '@/api/client';
import type {
  IntakeResponse,
  IntakeTypeResponse,
  IntakeSectionInstanceResponse,
  ContributorResponse,
  AssignmentResponse,
  FollowUpResponse,
  SessionResponse,
  IntakeStatus,
  SectionInstanceStatus,
} from '@/types';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const STATUS_CONFIG: Record<
  IntakeStatus,
  { label: string; bg: string; text: string }
> = {
  draft: { label: 'Draft', bg: 'bg-gray-100', text: 'text-gray-700' },
  inProgress: { label: 'Active', bg: 'bg-blue-100', text: 'text-blue-700' },
  underReview: { label: 'Under Review', bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { label: 'Completed', bg: 'bg-green-100', text: 'text-green-700' },
  cancelled: { label: 'Cancelled', bg: 'bg-red-100', text: 'text-red-700' },
};

const SECTION_STATUS_CONFIG: Record<
  SectionInstanceStatus,
  { label: string; bg: string; text: string }
> = {
  notStarted: { label: 'Not Started', bg: 'bg-gray-100', text: 'text-gray-600' },
  inProgress: { label: 'In Progress', bg: 'bg-blue-100', text: 'text-blue-700' },
  complete: { label: 'Complete', bg: 'bg-green-100', text: 'text-green-700' },
  notApplicable: { label: 'N/A', bg: 'bg-gray-100', text: 'text-gray-500' },
};

type DashboardTab = 'overview' | 'people' | 'documents' | 'proposals' | 'timeline' | 'usage';

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

// ---------------------------------------------------------------------------
// Sub-components
// ---------------------------------------------------------------------------

function StatusBadge({ status }: { status: IntakeStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function SectionStatusBadge({ status }: { status: SectionInstanceStatus }) {
  const cfg = SECTION_STATUS_CONFIG[status] ?? SECTION_STATUS_CONFIG.notStarted;
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}>
      {cfg.label}
    </span>
  );
}

function CircularProgress({ percent }: { percent: number }) {
  const radius = 36;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (percent / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg className="h-24 w-24 -rotate-90" viewBox="0 0 80 80">
        <circle cx="40" cy="40" r={radius} fill="none" stroke="#e5e7eb" strokeWidth="6" />
        <circle
          cx="40"
          cy="40"
          r={radius}
          fill="none"
          stroke="#2563eb"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="transition-all duration-500"
        />
      </svg>
      <span className="absolute text-lg font-bold text-gray-900">{Math.round(percent)}%</span>
    </div>
  );
}

function SummaryCard({
  icon: Icon,
  label,
  value,
  subtext,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  value: string | number;
  subtext?: string;
}) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
          <Icon className="h-5 w-5 text-gray-600" />
        </div>
        <div>
          <p className="text-xs font-medium text-gray-500">{label}</p>
          <p className="text-lg font-bold text-gray-900">{value}</p>
          {subtext && <p className="text-xs text-gray-500">{subtext}</p>}
        </div>
      </div>
    </div>
  );
}

function SectionTile({
  section,
  intakeId,
  assignments,
  contributors,
}: {
  section: IntakeSectionInstanceResponse;
  intakeId: string;
  assignments: AssignmentResponse[];
  contributors: ContributorResponse[];
}) {
  // Find contributors assigned to this section
  const sectionAssignments = assignments.filter(
    (a) => a.intakeSectionInstanceId === section.intakeSectionInstanceId,
  );
  const assignedContributors = sectionAssignments
    .map((a) => contributors.find((c) => c.intakeContributorId === a.intakeContributorId))
    .filter(Boolean);

  return (
    <Link
      to={`/intakes/${intakeId}/sections/${section.intakeSectionInstanceId}`}
      className="block rounded-xl border border-gray-200 bg-white p-5 shadow-sm hover:border-blue-300 hover:shadow-md transition"
    >
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold text-gray-900 truncate">
          {section.instanceLabel ?? section.sectionName}
        </h3>
        <SectionStatusBadge status={section.status} />
      </div>

      {/* Progress bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-xs text-gray-500 mb-1">
          <span>{section.answeredQuestions} of {section.totalQuestions} answered</span>
          <span className="tabular-nums">{Math.round(section.percentComplete)}%</span>
        </div>
        <div className="h-1.5 rounded-full bg-gray-200">
          <div
            className="h-1.5 rounded-full bg-blue-600 transition-all"
            style={{ width: `${Math.min(section.percentComplete, 100)}%` }}
          />
        </div>
      </div>

      {/* Assigned people */}
      {assignedContributors.length > 0 && (
        <div className="mt-3 flex items-center gap-1">
          {assignedContributors.slice(0, 3).map((c) => (
            <span
              key={c!.intakeContributorId}
              className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs font-medium text-blue-700"
              title={c!.displayName}
            >
              {c!.displayName.charAt(0).toUpperCase()}
            </span>
          ))}
          {assignedContributors.length > 3 && (
            <span className="text-xs text-gray-500">+{assignedContributors.length - 3}</span>
          )}
        </div>
      )}
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Loading Skeleton
// ---------------------------------------------------------------------------

function DashboardSkeleton() {
  return (
    <div className="animate-pulse space-y-6">
      <div className="h-8 w-64 rounded bg-gray-200" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="h-24 rounded-xl bg-gray-200" />
        ))}
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="h-32 rounded-xl bg-gray-200" />
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export default function IntakeDashboardPage() {
  const { intakeId } = useParams<{ intakeId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState<DashboardTab>('overview');

  // ---- Queries ----

  const { data: intake, isLoading: intakeLoading, isError } = useQuery<IntakeResponse>({
    queryKey: ['intake', intakeId],
    queryFn: () => api.intakes.get(intakeId!),
    enabled: !!intakeId,
  });

  const { data: intakeType } = useQuery<IntakeTypeResponse>({
    queryKey: ['intakeType', intake?.intakeTypeId],
    queryFn: async () => {
      const res = await axiosInstance.get<IntakeTypeResponse>(`/intake-types/${intake!.intakeTypeId}`);
      return res.data;
    },
    enabled: !!intake?.intakeTypeId,
  });

  const { data: sections } = useQuery<IntakeSectionInstanceResponse[]>({
    queryKey: ['intakeSections', intakeId],
    queryFn: () => api.sections.list(intakeId!),
    enabled: !!intakeId,
  });

  const { data: contributors } = useQuery<ContributorResponse[]>({
    queryKey: ['intakeContributors', intakeId],
    queryFn: async () => {
      const res = await axiosInstance.get<ContributorResponse[]>(`/intakes/${intakeId}/contributors`);
      return res.data;
    },
    enabled: !!intakeId,
  });

  const { data: assignments } = useQuery<AssignmentResponse[]>({
    queryKey: ['intakeAssignments', intakeId],
    queryFn: async () => {
      const res = await axiosInstance.get<AssignmentResponse[]>(`/intakes/${intakeId}/assignments`);
      return res.data;
    },
    enabled: !!intakeId,
  });

  const { data: followUps } = useQuery<FollowUpResponse[]>({
    queryKey: ['intakeFollowUps', intakeId],
    queryFn: async () => {
      const res = await axiosInstance.get<FollowUpResponse[]>(`/intakes/${intakeId}/follow-ups`);
      return res.data;
    },
    enabled: !!intakeId,
  });

  const { data: sessions } = useQuery<SessionResponse[]>({
    queryKey: ['intakeSessions', intakeId],
    queryFn: () => api.sessions.list(intakeId!),
    enabled: !!intakeId,
  });

  // ---- Start Call mutation ----

  const startCallMutation = useMutation({
    mutationFn: () => api.sessions.create(intakeId!, { sessionType: 'phoneCall' }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['intakeSessions', intakeId] });
    },
  });

  // ---- Derived data ----

  const totalMinutesUsed = sessions
    ? Math.round(
        sessions.reduce((sum, s) => sum + (s.durationSeconds ?? 0), 0) / 60,
      )
    : 0;

  const nextFollowUp = followUps
    ?.filter((f) => f.status === 'scheduled')
    .sort((a, b) => new Date(a.nextContactAt).getTime() - new Date(b.nextContactAt).getTime())[0];

  const openIssuesCount = sections
    ? sections.reduce((count, s) => {
        const unansweredRequired = s.totalQuestions - s.answeredQuestions;
        return count + Math.max(0, unansweredRequired);
      }, 0)
    : 0;

  // Group sections by template section for repeat display
  const sectionsByTemplate = sections
    ? sections.reduce<Record<string, IntakeSectionInstanceResponse[]>>((acc, s) => {
        const key = s.templateSectionId;
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
      }, {})
    : {};

  const tabs: { key: DashboardTab; label: string }[] = [
    { key: 'overview', label: 'Overview' },
    { key: 'people', label: 'People' },
    { key: 'documents', label: 'Documents' },
    { key: 'proposals', label: 'Proposals' },
    { key: 'timeline', label: 'Timeline' },
    { key: 'usage', label: 'Usage' },
  ];

  // ---- Render ----

  if (intakeLoading) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <DashboardSkeleton />
      </div>
    );
  }

  if (isError || !intake) {
    return (
      <div className="mx-auto max-w-6xl px-4 py-16 text-center sm:px-6 lg:px-8">
        <p className="text-sm text-red-600">Failed to load intake. It may have been deleted.</p>
        <button
          onClick={() => navigate('/intakes')}
          className="mt-4 text-sm text-blue-600 hover:text-blue-700"
        >
          Back to Intakes
        </button>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Top Bar */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <button
            onClick={() => navigate('/intakes')}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600 transition"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{intake.intakeName}</h1>
              <StatusBadge status={intake.intakeStatus} />
            </div>
            {intakeType && (
              <p className="mt-0.5 text-sm text-gray-500">{intakeType.intakeTypeName}</p>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
            <Pencil className="h-4 w-4" />
            Edit
          </button>
          <button
            onClick={() => startCallMutation.mutate()}
            disabled={startCallMutation.isPending}
            className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 disabled:opacity-50 transition"
          >
            {startCallMutation.isPending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Phone className="h-4 w-4" />
            )}
            Start Call
          </button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="flex items-center justify-center rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
          <CircularProgress percent={intake.progress?.percentComplete ?? 0} />
          <div className="ml-4">
            <p className="text-xs font-medium text-gray-500">Overall Progress</p>
            <p className="text-sm font-semibold text-gray-900">
              {intake.progress?.answered ?? 0} of {intake.progress?.totalQuestions ?? 0} answered
            </p>
          </div>
        </div>

        <SummaryCard
          icon={Clock}
          label="Minutes Used"
          value={totalMinutesUsed}
          subtext={`${sessions?.length ?? 0} session${(sessions?.length ?? 0) !== 1 ? 's' : ''}`}
        />

        <SummaryCard
          icon={Calendar}
          label="Next Follow-up"
          value={nextFollowUp ? formatDateTime(nextFollowUp.nextContactAt) : 'None scheduled'}
          subtext={nextFollowUp?.nextContactWindowText ?? undefined}
        />

        <SummaryCard
          icon={AlertTriangle}
          label="Open Items"
          value={openIssuesCount}
          subtext="Unanswered required questions"
        />
      </div>

      {/* Sub-navigation tabs */}
      <div className="mt-8 border-b border-gray-200">
        <nav className="-mb-px flex gap-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`whitespace-nowrap border-b-2 pb-3 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:border-gray-300 hover:text-gray-700'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Tab Content */}
      <div className="mt-6">
        {activeTab === 'overview' && (
          <div className="space-y-8">
            {/* Actions bar */}
            <div className="flex flex-wrap gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                <Upload className="h-4 w-4" />
                Upload Document
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                <LinkIcon className="h-4 w-4" />
                Add URL Source
              </button>
            </div>

            {/* Section tiles grid */}
            <div>
              <h2 className="text-lg font-semibold text-gray-900">Sections</h2>
              {sections && sections.length > 0 ? (
                <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {Object.entries(sectionsByTemplate).map(([templateSectionId, instances]) => {
                    if (instances.length === 1) {
                      return (
                        <SectionTile
                          key={templateSectionId}
                          section={instances[0]}
                          intakeId={intakeId!}
                          assignments={assignments ?? []}
                          contributors={contributors ?? []}
                        />
                      );
                    }
                    // Repeatable sections - show a container with sub-tiles
                    return (
                      <div
                        key={templateSectionId}
                        className="rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm"
                      >
                        <h3 className="text-sm font-semibold text-gray-700">
                          {instances[0].sectionName}
                        </h3>
                        <div className="mt-3 space-y-2">
                          {instances.map((inst) => (
                            <Link
                              key={inst.intakeSectionInstanceId}
                              to={`/intakes/${intakeId}/sections/${inst.intakeSectionInstanceId}`}
                              className="flex items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 hover:border-blue-300 transition"
                            >
                              <div className="min-w-0 flex-1">
                                <span className="text-sm font-medium text-gray-900">
                                  {inst.instanceLabel ?? `${inst.sectionName} ${inst.repeatIndex + 1}`}
                                </span>
                                <div className="mt-1 flex items-center gap-2">
                                  <div className="h-1 w-20 rounded-full bg-gray-200">
                                    <div
                                      className="h-1 rounded-full bg-blue-600"
                                      style={{
                                        width: `${Math.min(inst.percentComplete, 100)}%`,
                                      }}
                                    />
                                  </div>
                                  <span className="text-xs text-gray-500 tabular-nums">
                                    {Math.round(inst.percentComplete)}%
                                  </span>
                                </div>
                              </div>
                              <SectionStatusBadge status={inst.status} />
                            </Link>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="mt-4 text-sm text-gray-500">
                  No sections configured for this intake.
                </p>
              )}
            </div>

            {/* People summary tile */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <Users className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Contributors</h3>
                    <p className="text-xs text-gray-500">
                      {contributors?.length ?? 0} contributor{(contributors?.length ?? 0) !== 1 ? 's' : ''}
                    </p>
                  </div>
                </div>
                <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                  <UserPlus className="h-3.5 w-3.5" />
                  Add Contributor
                </button>
              </div>
              {contributors && contributors.length > 0 && (
                <div className="mt-4 space-y-2">
                  {contributors.map((c) => {
                    const assignedCount = assignments?.filter(
                      (a) => a.intakeContributorId === c.intakeContributorId,
                    ).length ?? 0;
                    return (
                      <div
                        key={c.intakeContributorId}
                        className="flex items-center gap-3 rounded-lg border border-gray-100 px-3 py-2"
                      >
                        <span className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                          {c.displayName.charAt(0).toUpperCase()}
                        </span>
                        <div className="min-w-0 flex-1">
                          <p className="truncate text-sm font-medium text-gray-900">
                            {c.displayName}
                          </p>
                          <p className="text-xs text-gray-500">
                            {assignedCount} section{assignedCount !== 1 ? 's' : ''} assigned
                            {c.isPrimaryPointPerson && (
                              <span className="ml-2 text-blue-600 font-medium">Primary</span>
                            )}
                          </p>
                        </div>
                        <ChevronRight className="h-4 w-4 text-gray-400" />
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Documents summary tile */}
            <div className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-gray-100">
                    <FileText className="h-5 w-5 text-gray-600" />
                  </div>
                  <div>
                    <h3 className="text-sm font-semibold text-gray-900">Documents & Sources</h3>
                    <p className="text-xs text-gray-500">
                      Files, URLs, and pending proposals
                    </p>
                  </div>
                </div>
                <div className="flex gap-2">
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                    <Upload className="h-3.5 w-3.5" />
                    Upload
                  </button>
                  <button className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-gray-50 transition">
                    <Plus className="h-3.5 w-3.5" />
                    Add URL
                  </button>
                </div>
              </div>
            </div>
          </div>
        )}

        {activeTab === 'people' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-lg font-semibold text-gray-900">People</h2>
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-3 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
                <UserPlus className="h-4 w-4" />
                Add Contributor
              </button>
            </div>
            {contributors && contributors.length > 0 ? (
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                {contributors.map((c) => (
                  <div
                    key={c.intakeContributorId}
                    className="rounded-xl border border-gray-200 bg-white p-5 shadow-sm"
                  >
                    <div className="flex items-center gap-3">
                      <span className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-sm font-medium text-blue-700">
                        {c.displayName.charAt(0).toUpperCase()}
                      </span>
                      <div>
                        <p className="text-sm font-semibold text-gray-900">{c.displayName}</p>
                        {c.email && <p className="text-xs text-gray-500">{c.email}</p>}
                        {c.phone && <p className="text-xs text-gray-500">{c.phone}</p>}
                      </div>
                    </div>
                    {c.isPrimaryPointPerson && (
                      <span className="mt-2 inline-flex rounded-full bg-blue-100 px-2 py-0.5 text-xs font-medium text-blue-700">
                        Primary Contact
                      </span>
                    )}
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No contributors added yet.</p>
            )}
          </div>
        )}

        {activeTab === 'documents' && (
          <div className="text-center py-12">
            <FileText className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-semibold text-gray-900">Documents & Sources</h3>
            <p className="mt-1 text-sm text-gray-500">
              Upload files or add URL sources to extract information.
            </p>
            <div className="mt-4 flex items-center justify-center gap-2">
              <button className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition">
                <Upload className="h-4 w-4" />
                Upload File
              </button>
              <button className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 transition">
                <LinkIcon className="h-4 w-4" />
                Add URL
              </button>
            </div>
          </div>
        )}

        {activeTab === 'proposals' && (
          <div className="text-center py-12">
            <AlertTriangle className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-semibold text-gray-900">Proposals</h3>
            <p className="mt-1 text-sm text-gray-500">
              Pending answer proposals from calls and document extraction will appear here.
            </p>
          </div>
        )}

        {activeTab === 'timeline' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Activity Timeline</h2>
            {sessions && sessions.length > 0 ? (
              <div className="space-y-3">
                {sessions
                  .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())
                  .map((s) => (
                    <div
                      key={s.sessionId}
                      className="flex items-start gap-3 rounded-lg border border-gray-200 bg-white p-4"
                    >
                      <div className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-100">
                        <Phone className="h-4 w-4 text-blue-600" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900 capitalize">
                          {s.sessionType === 'phoneCall'
                            ? 'Phone Call'
                            : s.sessionType === 'fileUpload'
                              ? 'File Upload'
                              : 'URL Refresh'}
                        </p>
                        <p className="text-xs text-gray-500">
                          {formatDateTime(s.startedAt)}
                          {s.durationSeconds != null && (
                            <span className="ml-2">
                              {Math.floor(s.durationSeconds / 60)}m {s.durationSeconds % 60}s
                            </span>
                          )}
                        </p>
                      </div>
                      <span
                        className={`ml-auto inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          s.status === 'completed'
                            ? 'bg-green-100 text-green-700'
                            : s.status === 'active'
                              ? 'bg-blue-100 text-blue-700'
                              : 'bg-gray-100 text-gray-600'
                        }`}
                      >
                        {s.status}
                      </span>
                    </div>
                  ))}
              </div>
            ) : (
              <p className="text-sm text-gray-500">No sessions recorded yet.</p>
            )}
          </div>
        )}

        {activeTab === 'usage' && (
          <div className="space-y-4">
            <h2 className="text-lg font-semibold text-gray-900">Usage</h2>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <SummaryCard
                icon={Clock}
                label="Total Minutes"
                value={totalMinutesUsed}
              />
              <SummaryCard
                icon={Phone}
                label="Total Sessions"
                value={sessions?.length ?? 0}
              />
              <SummaryCard
                icon={Calendar}
                label="Created"
                value={formatDate(intake.createdAt)}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
