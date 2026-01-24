import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Card } from '../components/common/Card';
import type { Playbook } from '../types';

export function Playbooks() {
  const [selectedPlaybook, setSelectedPlaybook] = useState<Playbook | null>(null);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'proposed' | 'archived'>('active');

  const { data: playbooks = [], isLoading, error } = useQuery({
    queryKey: ['playbooks'],
    queryFn: () => api.getPlaybooks(),
  });

  const filteredPlaybooks = statusFilter === 'all'
    ? playbooks
    : playbooks.filter(p => p.status === statusFilter);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="text-center py-12">
        <p className="text-red-600">Failed to load playbooks</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Playbooks</h1>
          <p className="text-sm text-gray-500">Procedures and guidelines for Claude</p>
        </div>
        <span className="text-sm text-gray-500">{playbooks.length} playbooks</span>
      </div>

      <div className="flex items-center space-x-2">
        {(['active', 'all', 'proposed', 'archived'] as const).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
              statusFilter === status
                ? 'bg-blue-100 text-blue-700'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            {status.charAt(0).toUpperCase() + status.slice(1)}
          </button>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">
            {statusFilter === 'all' ? 'All Playbooks' : `${statusFilter.charAt(0).toUpperCase() + statusFilter.slice(1)} Playbooks`}
          </h2>
          {filteredPlaybooks.length === 0 ? (
            <p className="text-sm text-gray-500 text-center py-8">No playbooks found.</p>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredPlaybooks.map((playbook) => (
                <button
                  key={playbook.id}
                  onClick={() => setSelectedPlaybook(playbook)}
                  className={`w-full text-left py-3 -mx-4 px-4 transition-colors ${
                    selectedPlaybook?.id === playbook.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-start justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900">{playbook.name}</p>
                      {playbook.category && (
                        <p className="text-xs text-gray-500 mt-0.5">{playbook.category}</p>
                      )}
                      <div className="mt-1 flex items-center space-x-2">
                        <StatusBadge status={playbook.status} />
                        {playbook.must_consult && (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-100 text-red-800">
                            Must Consult
                          </span>
                        )}
                        {playbook.use_count > 0 && (
                          <span className="text-xs text-gray-400">Used {playbook.use_count}x</span>
                        )}
                      </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400 ml-2 flex-shrink-0" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div>
          {selectedPlaybook ? (
            <Card>
              <div className="space-y-4">
                <div className="flex items-start justify-between">
                  <h2 className="text-lg font-semibold text-gray-900">{selectedPlaybook.name}</h2>
                  <StatusBadge status={selectedPlaybook.status} />
                </div>

                {selectedPlaybook.description && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md">{selectedPlaybook.description}</p>
                  </div>
                )}

                {selectedPlaybook.category && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Category</label>
                    <p className="text-sm text-gray-900">{selectedPlaybook.category}</p>
                  </div>
                )}

                {selectedPlaybook.triggers && selectedPlaybook.triggers.length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Triggers</label>
                    <div className="flex flex-wrap gap-1">
                      {selectedPlaybook.triggers.map((trigger, i) => (
                        <span key={i} className="inline-flex items-center px-2 py-1 rounded text-xs bg-gray-100 text-gray-700">
                          {trigger}
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                {selectedPlaybook.must_consult && (
                  <div className="bg-red-50 border border-red-200 rounded-md p-3">
                    <p className="text-sm text-red-800 font-medium">Must Consult</p>
                    <p className="text-xs text-red-600 mt-1">Claude must check with you before acting on this playbook.</p>
                  </div>
                )}

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Content</label>
                  <div className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md whitespace-pre-wrap max-h-96 overflow-y-auto">
                    {selectedPlaybook.content}
                  </div>
                </div>

                <div className="pt-4 border-t text-xs text-gray-400">
                  {selectedPlaybook.use_count > 0 && <p>Used {selectedPlaybook.use_count} times</p>}
                  {selectedPlaybook.last_used && <p>Last used: {new Date(selectedPlaybook.last_used).toLocaleDateString()}</p>}
                  <p>Created: {new Date(selectedPlaybook.created_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <BookIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Select a playbook to view details</p>
              </div>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    proposed: 'bg-yellow-100 text-yellow-800',
    archived: 'bg-gray-100 text-gray-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || colors.active}`}>
      {status}
    </span>
  );
}

function ChevronRightIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function BookIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
    </svg>
  );
}
