import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import api from '../../services/api';
import type { Staff, WorkingHours } from '../../types';
import { Button } from '../ui/Button';

interface Props {
  staff: Staff;
  onClose: () => void;
}

const DAYS = [
  { key: '0', label: 'Monday' },
  { key: '1', label: 'Tuesday' },
  { key: '2', label: 'Wednesday' },
  { key: '3', label: 'Thursday' },
  { key: '4', label: 'Friday' },
  { key: '5', label: 'Saturday' },
  { key: '6', label: 'Sunday' },
];

const DEFAULT_SCHEDULE: WorkingHours = {
  schedule: {
    '0': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
    '1': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
    '2': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
    '3': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
    '4': { is_working: true, slots: [{ start: '09:00', end: '17:00' }] },
    '5': { is_working: false, slots: [] },
    '6': { is_working: false, slots: [] },
  },
};

export function StaffScheduleEditor({ staff, onClose }: Props) {
  const queryClient = useQueryClient();
  const [schedule, setSchedule] = useState<WorkingHours>(
    staff.working_hours || DEFAULT_SCHEDULE
  );

  const updateScheduleMutation = useMutation({
    mutationFn: async (data: WorkingHours) => {
      const response = await api.put(`/staff/${staff.id}/schedule`, {
        working_hours: data,
      });
      return response.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['staff'] });
      onClose();
    },
  });

  const toggleDay = (dayKey: string) => {
    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          is_working: !prev.schedule[dayKey]?.is_working,
          slots: !prev.schedule[dayKey]?.is_working
            ? [{ start: '09:00', end: '17:00' }]
            : [],
        },
      },
    }));
  };

  const updateSlot = (
    dayKey: string,
    slotIndex: number,
    field: 'start' | 'end',
    value: string
  ) => {
    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          slots: prev.schedule[dayKey].slots.map((slot, i) =>
            i === slotIndex ? { ...slot, [field]: value } : slot
          ),
        },
      },
    }));
  };

  const addSlot = (dayKey: string) => {
    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          slots: [
            ...prev.schedule[dayKey].slots,
            { start: '12:00', end: '17:00' },
          ],
        },
      },
    }));
  };

  const removeSlot = (dayKey: string, slotIndex: number) => {
    setSchedule((prev) => ({
      ...prev,
      schedule: {
        ...prev.schedule,
        [dayKey]: {
          ...prev.schedule[dayKey],
          slots: prev.schedule[dayKey].slots.filter((_, i) => i !== slotIndex),
        },
      },
    }));
  };

  const handleSave = () => {
    updateScheduleMutation.mutate(schedule);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-medium text-warm-800">
          Schedule for {staff.first_name} {staff.last_name}
        </h3>
      </div>

      <div className="space-y-4">
        {DAYS.map((day) => {
          const daySchedule = schedule.schedule[day.key] || {
            is_working: false,
            slots: [],
          };

          return (
            <div
              key={day.key}
              className="flex items-start gap-4 p-3 rounded-lg bg-warm-50"
            >
              <div className="w-28 flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={daySchedule.is_working}
                  onChange={() => toggleDay(day.key)}
                  className="rounded border-warm-300 text-primary-500 focus:ring-primary-500"
                />
                <span className="text-sm font-medium text-warm-700">
                  {day.label}
                </span>
              </div>

              {daySchedule.is_working ? (
                <div className="flex-1 space-y-2">
                  {daySchedule.slots.map((slot, slotIndex) => (
                    <div key={slotIndex} className="flex items-center gap-2">
                      <input
                        type="time"
                        value={slot.start}
                        onChange={(e) =>
                          updateSlot(day.key, slotIndex, 'start', e.target.value)
                        }
                        className="px-2 py-1 text-sm border border-warm-300 rounded focus:ring-primary-500 focus:border-primary-500"
                      />
                      <span className="text-warm-500">to</span>
                      <input
                        type="time"
                        value={slot.end}
                        onChange={(e) =>
                          updateSlot(day.key, slotIndex, 'end', e.target.value)
                        }
                        className="px-2 py-1 text-sm border border-warm-300 rounded focus:ring-primary-500 focus:border-primary-500"
                      />
                      {daySchedule.slots.length > 1 && (
                        <button
                          onClick={() => removeSlot(day.key, slotIndex)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      )}
                    </div>
                  ))}
                  <button
                    onClick={() => addSlot(day.key)}
                    className="text-sm text-primary-600 hover:text-primary-700"
                  >
                    + Add break / split shift
                  </button>
                </div>
              ) : (
                <span className="text-sm text-warm-500 italic">Day off</span>
              )}
            </div>
          );
        })}
      </div>

      <div className="flex justify-end gap-3 pt-4 border-t border-warm-200">
        <Button variant="secondary" onClick={onClose}>
          Cancel
        </Button>
        <Button
          onClick={handleSave}
          disabled={updateScheduleMutation.isPending}
        >
          {updateScheduleMutation.isPending ? 'Saving...' : 'Save Schedule'}
        </Button>
      </div>
    </div>
  );
}
