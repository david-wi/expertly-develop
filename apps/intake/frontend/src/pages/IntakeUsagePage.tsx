import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  PhoneCall,
  FileText,
  Globe,
  Layers,
} from 'lucide-react';
import { api } from '@/api/client';
import type { Session } from '@/types';
import { format } from 'date-fns';

// ── API helpers ──

function fetchUsageRollup(intakeId: string) {
  return api.usage.getIntake(intakeId);
}

function fetchSessions(intakeId: string) {
  return api.sessions.list(intakeId);
}

// ── Page ──

export default function IntakeUsagePage() {
  const { intakeId } = useParams<{ intakeId: string }>();

  const { data: usage, isLoading: loadingUsage } = useQuery({
    queryKey: ['usage-rollup', intakeId],
    queryFn: () => fetchUsageRollup(intakeId!),
    enabled: !!intakeId,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ['sessions', intakeId],
    queryFn: () => fetchSessions(intakeId!),
    enabled: !!intakeId,
  });

  if (loadingUsage) {
    return (
      <div className="p-6">
        <div className="text-center py-12 text-gray-500">Loading usage data...</div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-8">
        <BarChart3 className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Usage &amp; Billing</h1>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <SummaryCard
          icon={PhoneCall}
          label="Call Minutes"
          value={usage?.totalCallMinutes ?? 0}
          iconColor="text-purple-600"
          bgColor="bg-purple-100"
        />
        <SummaryCard
          icon={Layers}
          label="Total Sessions"
          value={usage?.totalSessions ?? 0}
          iconColor="text-blue-600"
          bgColor="bg-blue-100"
        />
        <SummaryCard
          icon={FileText}
          label="Files Processed"
          value={usage?.totalFilesProcessed ?? 0}
          iconColor="text-amber-600"
          bgColor="bg-amber-100"
        />
        <SummaryCard
          icon={Globe}
          label="URL Refreshes"
          value={usage?.totalUrlsRefreshed ?? 0}
          iconColor="text-cyan-600"
          bgColor="bg-cyan-100"
        />
      </div>

      {/* Additional stats row */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-green-100">
            <Layers className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {(usage?.totalProposals ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Total Proposals</p>
          </div>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 flex items-center gap-4">
          <div className="p-2 rounded-lg bg-indigo-100">
            <Layers className="w-5 h-5 text-indigo-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">
              {(usage?.totalAnswersConfirmed ?? 0).toLocaleString()}
            </p>
            <p className="text-xs text-gray-500">Answers Confirmed</p>
          </div>
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="bg-white rounded-lg border border-gray-200 p-6 mb-8">
        <h2 className="text-sm font-medium text-gray-700 mb-4">Usage Over Time</h2>
        <div className="h-48 flex items-center justify-center bg-gray-50 rounded-lg border-2 border-dashed border-gray-200">
          <div className="text-center">
            <BarChart3 className="w-10 h-10 text-gray-300 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Usage chart will be displayed here</p>
          </div>
        </div>
      </div>

      {/* Sessions list */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 bg-gray-50">
          <h3 className="text-sm font-semibold text-gray-700">Sessions</h3>
        </div>
        {sessions.length === 0 ? (
          <div className="p-6 text-sm text-gray-500 text-center">No sessions recorded.</div>
        ) : (
          <table className="min-w-full divide-y divide-gray-200">
            <thead>
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Date
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Type
                </th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
                <th className="px-4 py-2 text-right text-xs font-medium text-gray-500 uppercase">
                  Duration
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {sessions.map((session) => (
                <tr key={session.sessionId} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-sm text-gray-800">
                    {format(new Date(session.startedAt), 'MMM d, yyyy h:mm a')}
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600">
                    <SessionTypeBadge type={session.sessionType} />
                  </td>
                  <td className="px-4 py-2 text-sm">
                    <SessionStatusBadge status={session.status} />
                  </td>
                  <td className="px-4 py-2 text-sm text-gray-600 text-right">
                    {session.durationSeconds != null
                      ? `${Math.round(session.durationSeconds / 60)} min`
                      : '--'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

// ── Sub-components ──

function SummaryCard({
  icon: Icon,
  label,
  value,
  iconColor,
  bgColor,
}: {
  icon: typeof PhoneCall;
  label: string;
  value: number;
  iconColor: string;
  bgColor: string;
}) {
  return (
    <div className="bg-white rounded-lg border border-gray-200 p-4">
      <div className="flex items-center gap-3">
        <div className={`p-2 rounded-lg ${bgColor}`}>
          <Icon className={`w-5 h-5 ${iconColor}`} />
        </div>
        <div>
          <p className="text-2xl font-bold text-gray-900">{value.toLocaleString()}</p>
          <p className="text-xs text-gray-500">{label}</p>
        </div>
      </div>
    </div>
  );
}

function SessionTypeBadge({ type }: { type: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    phoneCall: { label: 'Phone Call', cls: 'bg-purple-100 text-purple-700' },
    fileUpload: { label: 'File Upload', cls: 'bg-blue-100 text-blue-700' },
    urlRefresh: { label: 'URL Refresh', cls: 'bg-cyan-100 text-cyan-700' },
  };
  const c = config[type] ?? { label: type, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}

function SessionStatusBadge({ status }: { status: string }) {
  const config: Record<string, { label: string; cls: string }> = {
    active: { label: 'Active', cls: 'bg-green-100 text-green-700' },
    completed: { label: 'Completed', cls: 'bg-gray-100 text-gray-700' },
    failed: { label: 'Failed', cls: 'bg-red-100 text-red-700' },
    cancelled: { label: 'Cancelled', cls: 'bg-amber-100 text-amber-700' },
  };
  const c = config[status] ?? { label: status, cls: 'bg-gray-100 text-gray-700' };
  return (
    <span className={`inline-block px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}>
      {c.label}
    </span>
  );
}
