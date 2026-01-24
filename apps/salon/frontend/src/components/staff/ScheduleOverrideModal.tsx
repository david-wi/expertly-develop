import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Staff } from '../../types';
import { Button } from '../ui/Button';
import { Modal } from '../ui/Modal';

interface Props {
  staff: Staff;
  isOpen: boolean;
  onClose: () => void;
}

interface ScheduleOverride {
  id: string;
  staff_id: string;
  date: string;
  override_type: 'off' | 'custom';
  custom_slots: Array<{ start: string; end: string }>;
  note?: string;
}

export function ScheduleOverrideModal({ staff, isOpen, onClose }: Props) {
  const queryClient = useQueryClient();
  const [date, setDate] = useState('');
  const [overrideType, setOverrideType] = useState<'off' | 'custom'>('off');
  const [customSlots, setCustomSlots] = useState([{ start: '09:00', end: '17:00' }]);
  const [note, setNote] = useState('');

  const { data: overrides = [] } = useQuery<ScheduleOverride[]>({
    queryKey: ['schedule-overrides', staff.id],
    queryFn: async () => {
      const response = await api.get(`/staff/${staff.id}/schedule/overrides`);
      return response.data;
    },
    enabled: isOpen,
  });

  const createOverrideMutation = useMutation({
    mutationFn: async (data: {
      date: string;
      override_type: string;
      custom_slots: Array<{ start: string; end: string }>;
      note: string;
    }) => {
      const response = await api.post(`/staff/${staff.id}/schedule/override`, data);
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides', staff.id] });
      setDate('');
      setNote('');
      setOverrideType('off');
    },
  });

  const deleteOverrideMutation = useMutation({
    mutationFn: async (overrideId: string) => {
      await api.delete(`/staff/${staff.id}/schedule/override/${overrideId}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['schedule-overrides', staff.id] });
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!date) return;

    createOverrideMutation.mutate({
      date,
      override_type: overrideType,
      custom_slots: overrideType === 'custom' ? customSlots : [],
      note,
    });
  };

  const updateSlot = (index: number, field: 'start' | 'end', value: string) => {
    setCustomSlots((prev) =>
      prev.map((slot, i) => (i === index ? { ...slot, [field]: value } : slot))
    );
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={`Time Off / Schedule Changes - ${staff.first_name}`}>
      <div className="space-y-6">
        {/* Existing Overrides */}
        {overrides.length > 0 && (
          <div>
            <h4 className="text-sm font-medium text-warm-700 mb-2">Scheduled Time Off</h4>
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {overrides.map((override) => (
                <div
                  key={override.id}
                  className="flex items-center justify-between p-2 bg-warm-50 rounded"
                >
                  <div>
                    <span className="text-sm font-medium text-warm-800">
                      {new Date(override.date).toLocaleDateString('en-US', {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                      })}
                    </span>
                    <span className="ml-2 text-xs text-warm-500">
                      {override.override_type === 'off'
                        ? 'Day Off'
                        : `Custom: ${override.custom_slots
                            .map((s) => `${s.start}-${s.end}`)
                            .join(', ')}`}
                    </span>
                    {override.note && (
                      <span className="ml-2 text-xs text-warm-400">({override.note})</span>
                    )}
                  </div>
                  <button
                    onClick={() => deleteOverrideMutation.mutate(override.id)}
                    className="text-red-500 hover:text-red-700 text-xs"
                    disabled={deleteOverrideMutation.isPending}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Add New Override */}
        <form onSubmit={handleSubmit} className="space-y-4">
          <h4 className="text-sm font-medium text-warm-700">Add Time Off / Schedule Change</h4>

          <div>
            <label className="block text-sm text-warm-600 mb-1">Date</label>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().split('T')[0]}
              className="w-full px-3 py-2 border border-warm-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
              required
            />
          </div>

          <div>
            <label className="block text-sm text-warm-600 mb-1">Type</label>
            <div className="flex gap-4">
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="overrideType"
                  value="off"
                  checked={overrideType === 'off'}
                  onChange={() => setOverrideType('off')}
                  className="text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-warm-700">Day Off</span>
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="overrideType"
                  value="custom"
                  checked={overrideType === 'custom'}
                  onChange={() => setOverrideType('custom')}
                  className="text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm text-warm-700">Custom Hours</span>
              </label>
            </div>
          </div>

          {overrideType === 'custom' && (
            <div className="space-y-2">
              <label className="block text-sm text-warm-600">Working Hours</label>
              {customSlots.map((slot, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={slot.start}
                    onChange={(e) => updateSlot(index, 'start', e.target.value)}
                    className="px-2 py-1 text-sm border border-warm-300 rounded focus:ring-primary-500"
                  />
                  <span className="text-warm-500">to</span>
                  <input
                    type="time"
                    value={slot.end}
                    onChange={(e) => updateSlot(index, 'end', e.target.value)}
                    className="px-2 py-1 text-sm border border-warm-300 rounded focus:ring-primary-500"
                  />
                </div>
              ))}
            </div>
          )}

          <div>
            <label className="block text-sm text-warm-600 mb-1">Note (optional)</label>
            <input
              type="text"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="e.g., Vacation, Doctor appointment"
              className="w-full px-3 py-2 border border-warm-300 rounded-lg focus:ring-primary-500 focus:border-primary-500"
            />
          </div>

          <div className="flex justify-end gap-3 pt-4 border-t border-warm-200">
            <Button variant="secondary" type="button" onClick={onClose}>
              Close
            </Button>
            <Button type="submit" disabled={createOverrideMutation.isPending || !date}>
              {createOverrideMutation.isPending ? 'Adding...' : 'Add Override'}
            </Button>
          </div>
        </form>
      </div>
    </Modal>
  );
}
