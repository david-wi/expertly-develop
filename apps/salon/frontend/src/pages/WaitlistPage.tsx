import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { format, parseISO } from 'date-fns';
import { waitlist, clients, services, staff } from '../services/api';
import type { WaitlistStatus, AvailabilityMatch } from '../types';

const statusColors: Record<WaitlistStatus, string> = {
  active: 'bg-emerald-100 text-emerald-800',
  notified: 'bg-amber-100 text-amber-800',
  booked: 'bg-blue-100 text-blue-800',
  expired: 'bg-gray-100 text-gray-600',
  cancelled: 'bg-red-100 text-red-800',
};

const statusLabels: Record<WaitlistStatus, string> = {
  active: 'Active',
  notified: 'Notified',
  booked: 'Booked',
  expired: 'Expired',
  cancelled: 'Cancelled',
};

export default function WaitlistPage() {
  const queryClient = useQueryClient();
  const [showAddModal, setShowAddModal] = useState(false);
  const [showMatchesModal, setShowMatchesModal] = useState(false);
  const [statusFilter, setStatusFilter] = useState<WaitlistStatus | ''>('');

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ['waitlist', statusFilter],
    queryFn: () => waitlist.list(statusFilter || undefined),
  });

  const { data: matches = [], refetch: refetchMatches } = useQuery({
    queryKey: ['waitlist-matches'],
    queryFn: () => waitlist.checkMatches(),
    enabled: showMatchesModal,
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => waitlist.delete(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
    },
  });

  const notifyMutation = useMutation({
    mutationFn: (match: AvailabilityMatch) =>
      waitlist.notify(match.waitlist_entry_id, match.start_time, match.staff_id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['waitlist'] });
      queryClient.invalidateQueries({ queryKey: ['waitlist-matches'] });
    },
  });

  const handleCheckMatches = () => {
    setShowMatchesModal(true);
    refetchMatches();
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold text-gray-900">Waitlist</h1>
          <p className="text-sm text-gray-500 mt-1">
            Clients waiting for appointment availability
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleCheckMatches}
            className="px-4 py-2 text-sm font-medium text-rose-700 bg-rose-50 rounded-lg hover:bg-rose-100"
          >
            Check for Matches
          </button>
          <button
            onClick={() => setShowAddModal(true)}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600"
          >
            Add to Waitlist
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex gap-2">
        <button
          onClick={() => setStatusFilter('')}
          className={`px-3 py-1.5 text-sm rounded-lg ${
            statusFilter === '' ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          All
        </button>
        {(['active', 'notified', 'booked', 'expired'] as WaitlistStatus[]).map((status) => (
          <button
            key={status}
            onClick={() => setStatusFilter(status)}
            className={`px-3 py-1.5 text-sm rounded-lg capitalize ${
              statusFilter === status ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
            }`}
          >
            {statusLabels[status]}
          </button>
        ))}
      </div>

      {/* Waitlist entries */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading...</div>
      ) : entries.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-xl">
          <p className="text-gray-500">No waitlist entries found</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Client</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Service</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Availability</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Added</th>
                <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {entries.map((entry) => (
                <tr key={entry.id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="font-medium text-gray-900">{entry.client_name}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                    {entry.service_name}
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 max-w-xs truncate" title={entry.availability_description}>
                      {entry.availability_description}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      {entry.preferences.is_urgent && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-red-100 text-red-700 mr-1">
                          Urgent
                        </span>
                      )}
                      {entry.preferences.flexible && (
                        <span className="inline-flex items-center px-1.5 py-0.5 rounded bg-green-100 text-green-700">
                          Flexible
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${statusColors[entry.status]}`}>
                      {statusLabels[entry.status]}
                    </span>
                    {entry.notification_count > 0 && (
                      <span className="ml-2 text-xs text-gray-500">
                        ({entry.notification_count} notifications)
                      </span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {format(parseISO(entry.created_at), 'MMM d, yyyy')}
                    {entry.expires_at && (
                      <div className="text-xs text-gray-400">
                        Expires {format(parseISO(entry.expires_at), 'MMM d')}
                      </div>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-right text-sm">
                    {entry.status === 'active' && (
                      <button
                        onClick={() => deleteMutation.mutate(entry.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        Remove
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Modal */}
      {showAddModal && (
        <AddWaitlistModal
          onClose={() => setShowAddModal(false)}
          onSuccess={() => {
            setShowAddModal(false);
            queryClient.invalidateQueries({ queryKey: ['waitlist'] });
          }}
        />
      )}

      {/* Matches Modal */}
      {showMatchesModal && (
        <MatchesModal
          matches={matches}
          onClose={() => setShowMatchesModal(false)}
          onNotify={(match) => notifyMutation.mutate(match)}
          isNotifying={notifyMutation.isPending}
        />
      )}
    </div>
  );
}

interface AddWaitlistModalProps {
  onClose: () => void;
  onSuccess: () => void;
}

function AddWaitlistModal({ onClose, onSuccess }: AddWaitlistModalProps) {
  const [clientId, setClientId] = useState('');
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [availability, setAvailability] = useState('');
  const [expiresInDays, setExpiresInDays] = useState(30);
  const [clientSearch, setClientSearch] = useState('');

  const { data: clientList = [] } = useQuery({
    queryKey: ['clients-search', clientSearch],
    queryFn: () => clientSearch ? clients.search(clientSearch) : clients.list(20),
    enabled: clientSearch.length >= 2 || clientSearch === '',
  });

  const { data: serviceList = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => services.list(),
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staff.list(),
  });

  const createMutation = useMutation({
    mutationFn: () =>
      waitlist.create({
        client_id: clientId,
        service_id: serviceId,
        availability_description: availability,
        preferred_staff_id: staffId || undefined,
        expires_in_days: expiresInDays,
      }),
    onSuccess,
  });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-lg">
        <h2 className="text-lg font-semibold mb-4">Add to Waitlist</h2>

        <div className="space-y-4">
          {/* Client Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Client</label>
            <input
              type="text"
              placeholder="Search clients..."
              value={clientSearch}
              onChange={(e) => setClientSearch(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
            {clientList.length > 0 && (
              <div className="mt-2 max-h-40 overflow-y-auto border rounded-lg">
                {clientList.map((client) => (
                  <button
                    key={client.id}
                    onClick={() => {
                      setClientId(client.id);
                      setClientSearch(client.full_name);
                    }}
                    className={`w-full text-left px-3 py-2 hover:bg-gray-50 ${
                      clientId === client.id ? 'bg-rose-50 text-rose-700' : ''
                    }`}
                  >
                    {client.full_name}
                    {client.phone && <span className="text-gray-400 ml-2">{client.phone}</span>}
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Service Selection */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Service</label>
            <select
              value={serviceId}
              onChange={(e) => setServiceId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="">Select a service</option>
              {serviceList.map((service) => (
                <option key={service.id} value={service.id}>
                  {service.name} ({service.duration_minutes} min)
                </option>
              ))}
            </select>
          </div>

          {/* Preferred Staff */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Preferred Staff (optional)
            </label>
            <select
              value={staffId}
              onChange={(e) => setStaffId(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value="">Any available</option>
              {staffList.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.first_name} {s.last_name}
                </option>
              ))}
            </select>
          </div>

          {/* Availability Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Availability Description
            </label>
            <textarea
              value={availability}
              onChange={(e) => setAvailability(e.target.value)}
              placeholder="e.g., Usually free Wed 2-4pm, would like to see Sarah ASAP"
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            />
            <p className="mt-1 text-xs text-gray-500">
              Describe when the client is available using natural language. We'll parse preferences
              like days, times, staff, and urgency.
            </p>
          </div>

          {/* Expiration */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Keep on waitlist for
            </label>
            <select
              value={expiresInDays}
              onChange={(e) => setExpiresInDays(Number(e.target.value))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-rose-500 focus:border-transparent"
            >
              <option value={7}>1 week</option>
              <option value={14}>2 weeks</option>
              <option value={30}>1 month</option>
              <option value={60}>2 months</option>
              <option value={90}>3 months</option>
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 mt-6">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg"
          >
            Cancel
          </button>
          <button
            onClick={() => createMutation.mutate()}
            disabled={!clientId || !serviceId || !availability || createMutation.isPending}
            className="px-4 py-2 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 disabled:opacity-50"
          >
            {createMutation.isPending ? 'Adding...' : 'Add to Waitlist'}
          </button>
        </div>
      </div>
    </div>
  );
}

interface MatchesModalProps {
  matches: AvailabilityMatch[];
  onClose: () => void;
  onNotify: (match: AvailabilityMatch) => void;
  isNotifying: boolean;
}

function MatchesModal({ matches, onClose, onNotify, isNotifying }: MatchesModalProps) {
  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
      <div className="bg-white rounded-xl p-6 w-full max-w-2xl max-h-[80vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold">Available Matches</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {matches.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No matching availability found for current waitlist entries.
          </div>
        ) : (
          <div className="space-y-4">
            {matches.map((match, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div>
                    <div className="font-medium text-gray-900">{match.client_name}</div>
                    <div className="text-sm text-gray-600">{match.service_name}</div>
                    <div className="text-sm text-gray-500 mt-1">
                      with {match.staff_name} on {format(parseISO(match.start_time), 'EEE, MMM d at h:mm a')}
                    </div>
                    <div className="text-xs text-gray-400 mt-1">{match.match_reason}</div>
                  </div>
                  <button
                    onClick={() => onNotify(match)}
                    disabled={isNotifying}
                    className="px-3 py-1.5 text-sm font-medium text-white bg-rose-500 rounded-lg hover:bg-rose-600 disabled:opacity-50"
                  >
                    {isNotifying ? 'Sending...' : 'Notify Client'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
