import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  BarChart3,
  Download,
  Calendar,
} from 'lucide-react';
import { axiosInstance } from '@/api/client';
import { format, subDays } from 'date-fns';

// ── Types ──

interface AccountUsageRow {
  intakeId: string;
  intakeName: string;
  callMinutes: number;
  transcriptionMinutes: number;
  ocrPages: number;
  urlRefreshes: number;
}

interface AccountUsageSummary {
  totalMinutes: number;
  totalIntakes: number;
  totalSessions: number;
  rows: AccountUsageRow[];
}

// ── API helpers ──

function fetchAccountUsage(startDate: string, endDate: string): Promise<AccountUsageSummary> {
  return axiosInstance
    .get<AccountUsageSummary>('/admin/usage', { params: { startDate, endDate } })
    .then((r) => r.data);
}

// ── Page ──

export default function UsageReportPage() {
  const [startDate, setStartDate] = useState(
    format(subDays(new Date(), 30), 'yyyy-MM-dd'),
  );
  const [endDate, setEndDate] = useState(format(new Date(), 'yyyy-MM-dd'));

  const { data: usage, isLoading } = useQuery({
    queryKey: ['account-usage', startDate, endDate],
    queryFn: () => fetchAccountUsage(startDate, endDate),
  });

  const handleExportCsv = () => {
    if (!usage) return;
    const headers = [
      'Intake',
      'Call Minutes',
      'Transcription Minutes',
      'OCR Pages',
      'URL Refreshes',
    ];
    const rows = usage.rows.map((r) =>
      [r.intakeName, r.callMinutes, r.transcriptionMinutes, r.ocrPages, r.urlRefreshes].join(','),
    );
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `usage-report-${startDate}-to-${endDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <BarChart3 className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Usage Report</h1>
        </div>
        <button
          onClick={handleExportCsv}
          disabled={!usage || usage.rows.length === 0}
          className="inline-flex items-center gap-2 px-4 py-2 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 transition-colors disabled:opacity-50"
        >
          <Download className="w-4 h-4" />
          Export CSV
        </button>
      </div>

      {/* Date range picker */}
      <div className="flex items-center gap-4 mb-8 p-4 bg-white rounded-lg border border-gray-200">
        <Calendar className="w-4 h-4 text-gray-500 flex-shrink-0" />
        <div className="flex items-center gap-4 flex-wrap">
          <div>
            <label className="block text-xs text-gray-500 mb-1">Start Date</label>
            <input
              type="date"
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-xs text-gray-500 mb-1">End Date</label>
            <input
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              className="px-3 py-1.5 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">
            {(usage?.totalMinutes ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Minutes</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">
            {(usage?.totalIntakes ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Intakes</p>
        </div>
        <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
          <p className="text-3xl font-bold text-gray-900">
            {(usage?.totalSessions ?? 0).toLocaleString()}
          </p>
          <p className="text-sm text-gray-500 mt-1">Total Sessions</p>
        </div>
      </div>

      {/* Usage table */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading usage data...</div>
      ) : !usage || usage.rows.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <BarChart3 className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No usage data</h3>
          <p className="text-sm text-gray-500">
            No usage recorded for the selected date range.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Intake
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Call Min
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Transcription Min
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  OCR Pages
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  URL Refreshes
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {usage.rows.map((row) => (
                <tr key={row.intakeId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {row.intakeName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {row.callMinutes}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {row.transcriptionMinutes}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {row.ocrPages}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600 text-right">
                    {row.urlRefreshes}
                  </td>
                </tr>
              ))}
              {/* Totals row */}
              <tr className="bg-gray-50 font-medium">
                <td className="px-4 py-3 text-sm text-gray-900">Total</td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {usage.rows.reduce((sum, r) => sum + r.callMinutes, 0)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {usage.rows.reduce((sum, r) => sum + r.transcriptionMinutes, 0)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {usage.rows.reduce((sum, r) => sum + r.ocrPages, 0)}
                </td>
                <td className="px-4 py-3 text-sm text-gray-900 text-right">
                  {usage.rows.reduce((sum, r) => sum + r.urlRefreshes, 0)}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
