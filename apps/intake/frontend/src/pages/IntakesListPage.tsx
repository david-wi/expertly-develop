import { useState, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from 'react-router-dom';
import {
  Plus,
  Search,
  ClipboardList,
  Calendar,
  Clock,
  ChevronRight,
} from 'lucide-react';
import { api } from '@/api/client';
import type { IntakeResponse, IntakeStatus } from '@/types';

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

type FilterTab = 'all' | 'active' | 'completed';

function StatusBadge({ status }: { status: IntakeStatus }) {
  const cfg = STATUS_CONFIG[status] ?? STATUS_CONFIG.draft;
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ${cfg.bg} ${cfg.text}`}
    >
      {cfg.label}
    </span>
  );
}

function ProgressBar({ percent }: { percent: number }) {
  return (
    <div className="flex items-center gap-2">
      <div className="h-2 flex-1 rounded-full bg-gray-200">
        <div
          className="h-2 rounded-full bg-blue-600 transition-all"
          style={{ width: `${Math.min(percent, 100)}%` }}
        />
      </div>
      <span className="text-xs font-medium text-gray-500 tabular-nums">
        {Math.round(percent)}%
      </span>
    </div>
  );
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function SkeletonRow() {
  return (
    <div className="animate-pulse border-b border-gray-100 px-6 py-4">
      <div className="flex items-center gap-4">
        <div className="h-4 w-48 rounded bg-gray-200" />
        <div className="h-5 w-16 rounded-full bg-gray-200" />
        <div className="ml-auto h-3 w-24 rounded bg-gray-200" />
      </div>
      <div className="mt-2 flex items-center gap-4">
        <div className="h-2 w-40 rounded bg-gray-200" />
        <div className="h-3 w-20 rounded bg-gray-200" />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function IntakesListPage() {
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [activeTab, setActiveTab] = useState<FilterTab>('all');

  const {
    data: intakes,
    isLoading,
    isError,
    error,
  } = useQuery<IntakeResponse[]>({
    queryKey: ['intakes'],
    queryFn: async () => {
      const res = await api.get<IntakeResponse[]>('/intakes');
      return res.data;
    },
  });

  // Filter + search
  const filtered = useMemo(() => {
    if (!intakes) return [];
    let list = intakes;

    if (activeTab === 'active') {
      list = list.filter((i) => i.intakeStatus === 'inProgress' || i.intakeStatus === 'underReview');
    } else if (activeTab === 'completed') {
      list = list.filter((i) => i.intakeStatus === 'completed');
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((i) => i.intakeName.toLowerCase().includes(q));
    }

    return list;
  }, [intakes, activeTab, search]);

  const tabs: { key: FilterTab; label: string }[] = [
    { key: 'all', label: 'All' },
    { key: 'active', label: 'Active' },
    { key: 'completed', label: 'Completed' },
  ];

  return (
    <div className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Intakes</h1>
        <Link
          to="/intakes/new"
          className="inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition"
        >
          <Plus className="h-4 w-4" />
          New Intake
        </Link>
      </div>

      {/* Search + Tabs */}
      <div className="mt-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Tabs */}
        <div className="flex gap-1 rounded-lg bg-gray-100 p-1">
          {tabs.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                activeTab === tab.key
                  ? 'bg-white text-gray-900 shadow-sm'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input
            type="text"
            placeholder="Search intakes..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-lg border border-gray-300 bg-white py-2 pl-10 pr-4 text-sm text-gray-900 placeholder:text-gray-400 focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 sm:w-72"
          />
        </div>
      </div>

      {/* Content */}
      <div className="mt-6 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        {isLoading ? (
          <div>
            {Array.from({ length: 5 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : isError ? (
          <div className="px-6 py-12 text-center">
            <p className="text-sm text-red-600">
              Failed to load intakes.{' '}
              {error instanceof Error ? error.message : 'Please try again.'}
            </p>
          </div>
        ) : filtered.length === 0 ? (
          <div className="px-6 py-16 text-center">
            <ClipboardList className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-4 text-sm font-semibold text-gray-900">No intakes found</h3>
            <p className="mt-1 text-sm text-gray-500">
              {search
                ? 'Try adjusting your search query.'
                : 'Get started by creating your first intake.'}
            </p>
            {!search && (
              <Link
                to="/intakes/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition"
              >
                <Plus className="h-4 w-4" />
                New Intake
              </Link>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((intake) => (
              <li key={intake.intakeId}>
                <button
                  onClick={() => navigate(`/intakes/${intake.intakeId}`)}
                  className="flex w-full items-center gap-4 px-6 py-4 text-left hover:bg-gray-50 transition"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-3">
                      <span className="truncate text-sm font-semibold text-gray-900">
                        {intake.intakeName}
                      </span>
                      <StatusBadge status={intake.intakeStatus} />
                    </div>

                    <div className="mt-2 max-w-md">
                      <ProgressBar percent={intake.progress?.percentComplete ?? 0} />
                    </div>

                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-gray-500">
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="h-3.5 w-3.5" />
                        Created {formatDate(intake.createdAt)}
                      </span>
                      {intake.progress && (
                        <span className="inline-flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5" />
                          {intake.progress.answered} of {intake.progress.totalQuestions} answered
                        </span>
                      )}
                    </div>
                  </div>

                  <ChevronRight className="h-5 w-5 flex-shrink-0 text-gray-400" />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
