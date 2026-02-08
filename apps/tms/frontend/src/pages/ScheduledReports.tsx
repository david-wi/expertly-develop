import { useEffect, useState } from 'react'
import { api } from '../services/api'
import PageHelp from '../components/PageHelp'
import type { ScheduledReport } from '../types'
import { REPORT_TYPE_LABELS, REPORT_FREQUENCY_LABELS, REPORT_FORMAT_LABELS } from '../types'
import {
  Calendar,
  Clock,
  Plus,
  Trash2,
  Mail,
  FileText,
  CheckCircle,
  AlertTriangle,
  Sparkles,
} from 'lucide-react'

export default function ScheduledReports() {
  const [reports, setReports] = useState<ScheduledReport[]>([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState({
    report_type: 'margin_report',
    report_name: '',
    recipients: '',
    frequency: 'weekly',
    format: 'pdf',
    time_of_day: '08:00',
    day_of_week: 1,
    day_of_month: 1,
  })

  useEffect(() => {
    fetchReports()
  }, [])

  const fetchReports = async () => {
    setLoading(true)
    try {
      const data = await api.getScheduledReports()
      setReports(data)
    } catch (error) {
      console.error('Failed to fetch scheduled reports:', error)
    } finally {
      setLoading(false)
    }
  }

  const handleCreate = async () => {
    setSaving(true)
    try {
      await api.createScheduledReport({
        report_type: form.report_type,
        report_name: form.report_name || `${REPORT_TYPE_LABELS[form.report_type] || form.report_type} - ${form.frequency}`,
        recipients: form.recipients.split(',').map(e => e.trim()).filter(Boolean),
        frequency: form.frequency,
        format: form.format,
        time_of_day: form.time_of_day,
        day_of_week: form.frequency === 'weekly' ? form.day_of_week : undefined,
        day_of_month: form.frequency === 'monthly' ? form.day_of_month : undefined,
      })
      setShowForm(false)
      setForm({ report_type: 'margin_report', report_name: '', recipients: '', frequency: 'weekly', format: 'pdf', time_of_day: '08:00', day_of_week: 1, day_of_month: 1 })
      fetchReports()
    } catch (error) {
      console.error('Failed to create report:', error)
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async (id: string) => {
    try {
      await api.deleteScheduledReport(id)
      setReports(reports.filter(r => r.id !== id))
    } catch (error) {
      console.error('Failed to delete report:', error)
    }
  }

  const dayLabels = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun']

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
            <Calendar className="h-7 w-7 text-indigo-600" />
            Scheduled Reports
            <PageHelp pageId="scheduled-reports" />
          </h1>
          <p className="text-gray-500">Automate report delivery to your team</p>
        </div>
        <button
          onClick={() => setShowForm(!showForm)}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors"
        >
          <Plus className="h-4 w-4" />
          Schedule Report
        </button>
      </div>

      {/* Create Form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 p-6 space-y-4">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-indigo-600" />
            New Scheduled Report
            <span className="text-xs text-gray-400 font-normal ml-2">AI suggests smart defaults based on report type</span>
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Type</label>
              <select
                value={form.report_type}
                onChange={(e) => setForm({ ...form, report_type: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Object.entries(REPORT_TYPE_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Report Name</label>
              <input
                type="text"
                value={form.report_name}
                onChange={(e) => setForm({ ...form, report_name: e.target.value })}
                placeholder="Auto-generated if blank"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Recipients (comma-separated)</label>
              <input
                type="text"
                value={form.recipients}
                onChange={(e) => setForm({ ...form, recipients: e.target.value })}
                placeholder="email@example.com, user@example.com"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Frequency</label>
              <select
                value={form.frequency}
                onChange={(e) => setForm({ ...form, frequency: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Object.entries(REPORT_FREQUENCY_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Format</label>
              <select
                value={form.format}
                onChange={(e) => setForm({ ...form, format: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              >
                {Object.entries(REPORT_FORMAT_LABELS).map(([val, label]) => (
                  <option key={val} value={val}>{label}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Time</label>
              <input
                type="time"
                value={form.time_of_day}
                onChange={(e) => setForm({ ...form, time_of_day: e.target.value })}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
              />
            </div>

            {form.frequency === 'weekly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Week</label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                >
                  {dayLabels.map((label, i) => (
                    <option key={i} value={i}>{label}</option>
                  ))}
                </select>
              </div>
            )}

            {form.frequency === 'monthly' && (
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Day of Month</label>
                <input
                  type="number"
                  min={1}
                  max={28}
                  value={form.day_of_month}
                  onChange={(e) => setForm({ ...form, day_of_month: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500"
                />
              </div>
            )}
          </div>

          <div className="flex justify-end gap-3">
            <button
              onClick={() => setShowForm(false)}
              className="px-4 py-2 text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              onClick={handleCreate}
              disabled={saving || !form.recipients}
              className="px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {saving ? 'Creating...' : 'Create Schedule'}
            </button>
          </div>
        </div>
      )}

      {/* Reports List */}
      {loading ? (
        <div className="p-8 text-center text-gray-500">Loading scheduled reports...</div>
      ) : reports.length === 0 ? (
        <div className="bg-white rounded-xl border border-gray-200 p-12 text-center">
          <Calendar className="h-12 w-12 text-gray-300 mx-auto mb-4" />
          <p className="text-gray-500">No scheduled reports yet</p>
          <p className="text-sm text-gray-400 mt-2">Schedule recurring reports to be delivered to your team automatically</p>
        </div>
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <div key={report.id} className="bg-white rounded-xl border border-gray-200 p-5 flex items-center justify-between hover:shadow-sm transition-shadow">
              <div className="flex items-center gap-4">
                <div className={`p-3 rounded-lg ${report.is_active ? 'bg-indigo-100' : 'bg-gray-100'}`}>
                  <FileText className={`h-5 w-5 ${report.is_active ? 'text-indigo-600' : 'text-gray-400'}`} />
                </div>
                <div>
                  <h3 className="font-semibold text-gray-900">{report.report_name}</h3>
                  <div className="flex items-center gap-4 mt-1 text-sm text-gray-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {REPORT_FREQUENCY_LABELS[report.frequency] || report.frequency} at {report.time_of_day}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Mail className="h-3.5 w-3.5" />
                      {report.recipients.length} recipient{report.recipients.length !== 1 ? 's' : ''}
                    </span>
                    <span className="px-2 py-0.5 bg-gray-100 rounded text-xs font-medium">
                      {REPORT_FORMAT_LABELS[report.format] || report.format}
                    </span>
                    <span className="px-2 py-0.5 bg-indigo-50 text-indigo-700 rounded text-xs font-medium">
                      {REPORT_TYPE_LABELS[report.report_type] || report.report_type}
                    </span>
                  </div>
                  {report.next_run_at && (
                    <p className="text-xs text-gray-400 mt-1">
                      Next run: {new Date(report.next_run_at).toLocaleString()}
                    </p>
                  )}
                </div>
              </div>

              <div className="flex items-center gap-3">
                {report.is_active ? (
                  <span className="flex items-center gap-1 text-xs text-emerald-600 bg-emerald-50 px-2 py-1 rounded">
                    <CheckCircle className="h-3 w-3" /> Active
                  </span>
                ) : (
                  <span className="flex items-center gap-1 text-xs text-amber-600 bg-amber-50 px-2 py-1 rounded">
                    <AlertTriangle className="h-3 w-3" /> Paused
                  </span>
                )}
                <button
                  onClick={() => handleDelete(report.id)}
                  className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                  title="Delete schedule"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
