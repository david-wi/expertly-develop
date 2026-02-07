import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Mic, Plus, X } from 'lucide-react';
import { api } from '@/api/client';
import type { VoiceProfile } from '@/types';
import { format } from 'date-fns';

// ── API helpers ──

function fetchVoiceProfiles() {
  return api.get<VoiceProfile[]>('/voice-profiles').then((r) => r.data);
}

// ── Page ──

export default function VoicesPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editingVoice, setEditingVoice] = useState<VoiceProfile | null>(null);

  const { data: voices = [], isLoading } = useQuery({
    queryKey: ['voice-profiles'],
    queryFn: fetchVoiceProfiles,
  });

  const createMutation = useMutation({
    mutationFn: (data: {
      voiceProfileName: string;
      vapiVoiceId: string;
      notes?: string;
      isEnabled: boolean;
    }) => api.post('/voice-profiles', data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-profiles'] });
      setShowModal(false);
    },
  });

  const updateMutation = useMutation({
    mutationFn: ({
      voiceProfileId,
      ...data
    }: {
      voiceProfileId: string;
      voiceProfileName: string;
      vapiVoiceId: string;
      notes?: string;
      isEnabled: boolean;
    }) => api.put(`/voice-profiles/${voiceProfileId}`, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-profiles'] });
      setShowModal(false);
      setEditingVoice(null);
    },
  });

  const toggleEnabled = useMutation({
    mutationFn: ({ voiceProfileId, isEnabled }: { voiceProfileId: string; isEnabled: boolean }) =>
      api.patch(`/voice-profiles/${voiceProfileId}`, { isEnabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['voice-profiles'] });
    },
  });

  return (
    <div className="p-6 max-w-4xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div className="flex items-center gap-3">
          <Mic className="w-6 h-6 text-gray-700" />
          <h1 className="text-2xl font-bold text-gray-900">Voice Profiles</h1>
        </div>
        <button
          onClick={() => {
            setEditingVoice(null);
            setShowModal(true);
          }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" />
          New Voice
        </button>
      </div>

      {/* Voice list */}
      {isLoading ? (
        <div className="text-center py-12 text-gray-500">Loading voice profiles...</div>
      ) : voices.length === 0 ? (
        <div className="text-center py-16 bg-white rounded-lg border border-gray-200">
          <Mic className="w-12 h-12 text-gray-300 mx-auto mb-3" />
          <h3 className="text-lg font-medium text-gray-700 mb-1">No voice profiles</h3>
          <p className="text-sm text-gray-500">
            Create a voice profile to use with phone call intakes.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  VAPI Voice ID
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Enabled
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Notes
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Created
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {voices.map((voice) => (
                <tr key={voice.voiceProfileId} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {voice.voiceProfileName}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 font-mono">
                    {voice.vapiVoiceId}
                  </td>
                  <td className="px-4 py-3">
                    <button
                      onClick={() =>
                        toggleEnabled.mutate({
                          voiceProfileId: voice.voiceProfileId,
                          isEnabled: !voice.isEnabled,
                        })
                      }
                      className={`relative inline-flex h-6 w-11 flex-shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:ring-offset-2 ${
                        voice.isEnabled ? 'bg-indigo-600' : 'bg-gray-200'
                      }`}
                    >
                      <span
                        className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                          voice.isEnabled ? 'translate-x-5' : 'translate-x-0'
                        }`}
                      />
                    </button>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500 max-w-xs truncate">
                    {voice.notes || '--'}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-500">
                    {format(new Date(voice.createdAt), 'MMM d, yyyy')}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => {
                        setEditingVoice(voice);
                        setShowModal(true);
                      }}
                      className="text-sm text-indigo-600 hover:text-indigo-800 font-medium"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add/Edit Modal */}
      {showModal && (
        <VoiceFormModal
          voice={editingVoice}
          onClose={() => {
            setShowModal(false);
            setEditingVoice(null);
          }}
          onSubmit={(data) => {
            if (editingVoice) {
              updateMutation.mutate({
                voiceProfileId: editingVoice.voiceProfileId,
                ...data,
              });
            } else {
              createMutation.mutate(data);
            }
          }}
          isPending={createMutation.isPending || updateMutation.isPending}
        />
      )}
    </div>
  );
}

// ── Voice Form Modal ──

interface VoiceFormData {
  voiceProfileName: string;
  vapiVoiceId: string;
  notes?: string;
  isEnabled: boolean;
}

function VoiceFormModal({
  voice,
  onClose,
  onSubmit,
  isPending,
}: {
  voice: VoiceProfile | null;
  onClose: () => void;
  onSubmit: (data: VoiceFormData) => void;
  isPending: boolean;
}) {
  const [form, setForm] = useState<VoiceFormData>({
    voiceProfileName: voice?.voiceProfileName ?? '',
    vapiVoiceId: voice?.vapiVoiceId ?? '',
    notes: voice?.notes ?? '',
    isEnabled: voice?.isEnabled ?? true,
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit(form);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <h2 className="text-lg font-semibold text-gray-900">
            {voice ? 'Edit Voice Profile' : 'New Voice Profile'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
            <input
              type="text"
              required
              value={form.voiceProfileName}
              onChange={(e) => setForm({ ...form, voiceProfileName: e.target.value })}
              placeholder="e.g. Friendly Female"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">VAPI Voice ID</label>
            <input
              type="text"
              required
              value={form.vapiVoiceId}
              onChange={(e) => setForm({ ...form, vapiVoiceId: e.target.value })}
              placeholder="e.g. 21m00Tcm4TlvDq8ikWAM"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent font-mono text-sm"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
            <textarea
              value={form.notes}
              onChange={(e) => setForm({ ...form, notes: e.target.value })}
              rows={3}
              placeholder="Optional notes about this voice profile"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="voiceEnabled"
              checked={form.isEnabled}
              onChange={(e) => setForm({ ...form, isEnabled: e.target.checked })}
              className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
            />
            <label htmlFor="voiceEnabled" className="text-sm text-gray-700">
              Enabled
            </label>
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
              {isPending ? 'Saving...' : 'Save'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
