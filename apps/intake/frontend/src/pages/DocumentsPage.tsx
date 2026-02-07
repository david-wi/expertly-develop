import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  FileText,
  Upload,
  Globe,
  RefreshCw,
  Plus,
  X,
  ExternalLink,
  ChevronDown,
  ChevronRight,
  Clock,
  CheckCircle2,
  AlertCircle,
  Loader2,
} from 'lucide-react';
import { api } from '@/api/client';
import type { FileAsset, UrlSource, UrlSnapshot } from '@/types';
import { format } from 'date-fns';

// ── API helpers ──

function fetchFileAssets(intakeId: string) {
  return api.get<FileAsset[]>(`/intakes/${intakeId}/file-assets`).then((r) => r.data);
}

function fetchUrlSources(intakeId: string) {
  return api.get<(UrlSource & { snapshots?: UrlSnapshot[] })[]>(`/intakes/${intakeId}/url-sources`).then((r) => r.data);
}

// ── Helpers ──

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function statusBadge(status: string) {
  const config: Record<string, { icon: typeof Clock; label: string; cls: string }> = {
    pending: { icon: Clock, label: 'Pending', cls: 'bg-gray-100 text-gray-600' },
    processing: { icon: Loader2, label: 'Processing', cls: 'bg-blue-100 text-blue-700' },
    completed: { icon: CheckCircle2, label: 'Completed', cls: 'bg-green-100 text-green-700' },
    failed: { icon: AlertCircle, label: 'Failed', cls: 'bg-red-100 text-red-700' },
  };
  const c = config[status] ?? config.pending;
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${c.cls}`}
    >
      <Icon className={`w-3 h-3 ${status === 'processing' ? 'animate-spin' : ''}`} />
      {c.label}
    </span>
  );
}

// ── Page ──

export default function DocumentsPage() {
  const { intakeId } = useParams<{ intakeId: string }>();
  const [activeTab, setActiveTab] = useState<'uploads' | 'urls'>('uploads');

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center gap-3 mb-6">
        <FileText className="w-6 h-6 text-gray-700" />
        <h1 className="text-2xl font-bold text-gray-900">Documents</h1>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-gray-200">
        {[
          { id: 'uploads' as const, label: 'Uploads', icon: Upload },
          { id: 'urls' as const, label: 'URL Sources', icon: Globe },
        ].map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex items-center gap-2 px-4 py-2 font-medium transition-colors border-b-2 -mb-px text-sm ${
                activeTab === tab.id
                  ? 'text-indigo-600 border-indigo-500'
                  : 'text-gray-500 border-transparent hover:text-gray-700'
              }`}
            >
              <Icon className="w-4 h-4" />
              {tab.label}
            </button>
          );
        })}
      </div>

      {activeTab === 'uploads' && <UploadsTab intakeId={intakeId!} />}
      {activeTab === 'urls' && <UrlsTab intakeId={intakeId!} />}
    </div>
  );
}

// ── Uploads Tab ──

function UploadsTab({ intakeId }: { intakeId: string }) {
  const queryClient = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const { data: files = [], isLoading } = useQuery({
    queryKey: ['file-assets', intakeId],
    queryFn: () => fetchFileAssets(intakeId),
  });

  const uploadMutation = useMutation({
    mutationFn: (file: File) => {
      const formData = new FormData();
      formData.append('file', file);
      return api.post(`/intakes/${intakeId}/file-assets`, formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-assets', intakeId] });
      if (fileInputRef.current) fileInputRef.current.value = '';
    },
  });

  const processMutation = useMutation({
    mutationFn: (fileAssetId: string) =>
      api.post(`/intakes/${intakeId}/file-assets/${fileAssetId}/process`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['file-assets', intakeId] });
    },
  });

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) uploadMutation.mutate(file);
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading documents...</div>;
  }

  return (
    <div>
      {/* Upload button */}
      <div className="mb-6">
        <input
          ref={fileInputRef}
          type="file"
          onChange={handleFileChange}
          className="hidden"
          accept=".pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.png,.jpg,.jpeg"
        />
        <button
          onClick={() => fileInputRef.current?.click()}
          disabled={uploadMutation.isPending}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium disabled:opacity-50"
        >
          <Upload className="w-4 h-4" />
          {uploadMutation.isPending ? 'Uploading...' : 'Upload File'}
        </button>
        {uploadMutation.isError && (
          <p className="mt-2 text-sm text-red-600">Upload failed. Please try again.</p>
        )}
      </div>

      {/* File list */}
      {files.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          No files uploaded yet.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  File
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Size
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {files.map((file) => (
                <tr key={file.fileAssetId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {file.fileName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">{file.mimeType}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {formatFileSize(file.fileSizeBytes)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(new Date(file.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3">{statusBadge(file.processingStatus)}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      {file.processingStatus === 'pending' && (
                        <button
                          onClick={() => processMutation.mutate(file.fileAssetId)}
                          disabled={processMutation.isPending}
                          className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                        >
                          Process
                        </button>
                      )}
                      <Link
                        to={`/intakes/${intakeId}/proposals?source=${file.fileAssetId}`}
                        className="inline-flex items-center gap-1 text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        View Proposals
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── URLs Tab ──

function UrlsTab({ intakeId }: { intakeId: string }) {
  const queryClient = useQueryClient();
  const [showAddUrl, setShowAddUrl] = useState(false);
  const [expandedUrls, setExpandedUrls] = useState<Set<string>>(new Set());

  const { data: urlSources = [], isLoading } = useQuery({
    queryKey: ['url-sources', intakeId],
    queryFn: () => fetchUrlSources(intakeId),
  });

  const addUrlMutation = useMutation({
    mutationFn: (data: { url: string; label: string }) =>
      api.post(`/intakes/${intakeId}/url-sources`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['url-sources', intakeId] });
      setShowAddUrl(false);
    },
  });

  const refreshMutation = useMutation({
    mutationFn: (sourceId: string) =>
      api.post(`/intakes/${intakeId}/url-sources/${sourceId}/refresh`),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['url-sources', intakeId] });
    },
  });

  const toggleExpanded = (id: string) => {
    setExpandedUrls((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (isLoading) {
    return <div className="text-center py-12 text-gray-500">Loading URL sources...</div>;
  }

  return (
    <div>
      {/* Add URL button */}
      <div className="mb-6">
        <button
          onClick={() => setShowAddUrl(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          Add URL Source
        </button>
      </div>

      {/* URL list */}
      {urlSources.length === 0 ? (
        <div className="text-center py-12 text-gray-500 bg-white rounded-lg border border-gray-200">
          No URL sources added yet.
        </div>
      ) : (
        <div className="space-y-3">
          {urlSources.map((src) => {
            const isExpanded = expandedUrls.has(src.urlSourceId);
            const snapshots = src.snapshots ?? [];
            return (
              <div
                key={src.urlSourceId}
                className="bg-white rounded-lg border border-gray-200 shadow-sm"
              >
                <div className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3 min-w-0">
                      <button
                        onClick={() => toggleExpanded(src.urlSourceId)}
                        className="mt-1 text-gray-400 hover:text-gray-600"
                      >
                        {isExpanded ? (
                          <ChevronDown className="w-4 h-4" />
                        ) : (
                          <ChevronRight className="w-4 h-4" />
                        )}
                      </button>
                      <div className="min-w-0">
                        <h3 className="font-semibold text-gray-900">
                          {src.label || 'Untitled'}
                        </h3>
                        <a
                          href={src.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-sm text-indigo-600 hover:underline truncate block max-w-md"
                        >
                          {src.url}
                        </a>
                        <div className="flex items-center gap-4 mt-1.5 text-xs text-gray-500">
                          {src.lastFetchedAt && (
                            <span>
                              Last fetched:{' '}
                              {format(new Date(src.lastFetchedAt), 'MMM d, yyyy h:mm a')}
                            </span>
                          )}
                          {!src.lastFetchedAt && <span>Never fetched</span>}
                        </div>
                      </div>
                    </div>

                    <button
                      onClick={() => refreshMutation.mutate(src.urlSourceId)}
                      disabled={refreshMutation.isPending}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors flex-shrink-0"
                    >
                      <RefreshCw
                        className={`w-4 h-4 ${refreshMutation.isPending ? 'animate-spin' : ''}`}
                      />
                      Refresh Now
                    </button>
                  </div>

                  {/* Snapshot history */}
                  {isExpanded && (
                    <div className="mt-4 ml-7">
                      <h4 className="text-xs font-medium text-gray-500 uppercase tracking-wider mb-2">
                        Snapshot History
                      </h4>
                      {snapshots.length === 0 ? (
                        <p className="text-sm text-gray-400">No snapshots yet.</p>
                      ) : (
                        <div className="space-y-2">
                          {snapshots.map((snap) => (
                            <div
                              key={snap.urlSnapshotId}
                              className="flex items-center justify-between bg-gray-50 rounded-lg px-3 py-2"
                            >
                              <span className="text-sm text-gray-700">
                                {format(new Date(snap.fetchedAt), 'MMM d, yyyy h:mm a')}
                              </span>
                              {snap.contentHash && (
                                <span className="text-xs text-gray-400 font-mono">
                                  {snap.contentHash.slice(0, 8)}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Add URL Modal */}
      {showAddUrl && (
        <AddUrlModal
          onClose={() => setShowAddUrl(false)}
          onSubmit={(data) => addUrlMutation.mutate(data)}
          isPending={addUrlMutation.isPending}
        />
      )}
    </div>
  );
}

function AddUrlModal({
  onClose,
  onSubmit,
  isPending,
}: {
  onClose: () => void;
  onSubmit: (data: { url: string; label: string }) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState({ url: '', label: '' });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">Add URL Source</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
            <input
              type="url"
              required
              value={form.url}
              onChange={(e) => setForm({ ...form, url: e.target.value })}
              placeholder="https://example.com/page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Label</label>
            <input
              type="text"
              required
              value={form.label}
              onChange={(e) => setForm({ ...form, label: e.target.value })}
              placeholder="e.g. Company FAQ page"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={isPending}
              className="px-4 py-2 text-sm text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 disabled:opacity-50"
            >
              {isPending ? 'Adding...' : 'Add URL'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
