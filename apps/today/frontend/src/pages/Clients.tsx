import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import api from '../services/api';
import { Card } from '../components/common/Card';
import type { Client } from '../types';

export function Clients() {
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [statusFilter, setStatusFilter] = useState<string>('all');

  const { data: clients = [], isLoading, error } = useQuery({
    queryKey: ['clients'],
    queryFn: () => api.getClients(),
  });

  const statuses = ['all', ...new Set(clients.map(c => c.status))];
  const filteredClients = statusFilter === 'all'
    ? clients
    : clients.filter(c => c.status === statusFilter);

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
        <p className="text-red-600">Failed to load clients</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[var(--theme-text-heading)]">Clients</h1>
          <p className="text-sm text-gray-500">Organizations you work with</p>
        </div>
        <span className="text-sm text-gray-500">{clients.length} clients</span>
      </div>

      {statuses.length > 1 && (
        <div className="flex items-center space-x-2">
          {statuses.map((status) => (
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
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="text-lg font-semibold text-gray-900 mb-4">All Clients</h2>
          {filteredClients.length === 0 ? (
            <div className="text-center py-8">
              <BuildingIcon className="mx-auto h-12 w-12 text-gray-400" />
              <p className="mt-4 text-sm text-gray-500">No clients found.</p>
            </div>
          ) : (
            <div className="divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <button
                  key={client.id}
                  onClick={() => setSelectedClient(client)}
                  className={`w-full text-left py-3 -mx-4 px-4 transition-colors ${
                    selectedClient?.id === client.id ? 'bg-blue-50' : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center">
                      <div className="h-10 w-10 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                        <BuildingIcon className="h-5 w-5 text-gray-500" />
                      </div>
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">{client.name}</p>
                        <StatusBadge status={client.status} />
                      </div>
                    </div>
                    <ChevronRightIcon className="w-5 h-5 text-gray-400" />
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <div>
          {selectedClient ? (
            <Card>
              <div className="space-y-4">
                <div className="flex items-center">
                  <div className="h-16 w-16 rounded-lg bg-blue-100 flex items-center justify-center">
                    <BuildingIcon className="h-8 w-8 text-blue-600" />
                  </div>
                  <div className="ml-4">
                    <h2 className="text-lg font-semibold text-gray-900">{selectedClient.name}</h2>
                    <StatusBadge status={selectedClient.status} />
                  </div>
                </div>

                {selectedClient.notes && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
                    <p className="text-sm text-gray-600 bg-gray-50 p-3 rounded-md whitespace-pre-wrap">{selectedClient.notes}</p>
                  </div>
                )}

                {selectedClient.metadata && Object.keys(selectedClient.metadata).length > 0 && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Additional Info</label>
                    <div className="bg-gray-50 p-3 rounded-md">
                      {Object.entries(selectedClient.metadata).map(([key, value]) => (
                        <div key={key} className="flex justify-between text-sm py-1">
                          <span className="text-gray-500">{key}</span>
                          <span className="text-gray-900">{String(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                <div className="pt-4 border-t text-xs text-gray-400">
                  <p>Created: {new Date(selectedClient.created_at).toLocaleDateString()}</p>
                  <p>Updated: {new Date(selectedClient.updated_at).toLocaleDateString()}</p>
                </div>
              </div>
            </Card>
          ) : (
            <Card>
              <div className="text-center py-12">
                <BuildingIcon className="mx-auto h-12 w-12 text-gray-400" />
                <p className="mt-4 text-gray-500">Select a client to view details</p>
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
    prospect: 'bg-blue-100 text-blue-800',
    inactive: 'bg-gray-100 text-gray-800',
    churned: 'bg-red-100 text-red-800',
  };
  return (
    <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${colors[status] || 'bg-gray-100 text-gray-800'}`}>
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

function BuildingIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
    </svg>
  );
}
