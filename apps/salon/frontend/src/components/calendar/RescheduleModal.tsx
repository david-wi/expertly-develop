import { format } from 'date-fns';
import { X, Calendar, Clock, User, AlertCircle } from 'lucide-react';
import { Button } from '../ui';
import type { Appointment, Staff } from '../../types';

interface RescheduleModalProps {
  appointment: Appointment;
  newStaffId: string;
  newStartTime: Date;
  staffList: Staff[];
  isLoading: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}

export function RescheduleModal({
  appointment,
  newStaffId,
  newStartTime,
  staffList,
  isLoading,
  onConfirm,
  onCancel,
}: RescheduleModalProps) {
  const originalStaff = staffList.find((s) => s.id === appointment.staff_id);
  const newStaff = staffList.find((s) => s.id === newStaffId);

  const originalTime = new Date(appointment.start_time);
  const staffChanged = appointment.staff_id !== newStaffId;
  const timeChanged = originalTime.getTime() !== newStartTime.getTime();

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
      <div className="relative bg-white rounded-xl shadow-xl w-full max-w-md mx-4">
        <div className="flex items-center justify-between p-4 border-b border-warm-200">
          <h2 className="text-lg font-semibold text-warm-800">Reschedule Appointment</h2>
          <button onClick={onCancel} className="p-1 hover:bg-warm-100 rounded-lg">
            <X className="w-5 h-5 text-warm-500" />
          </button>
        </div>

        <div className="p-4 space-y-4">
          {/* Appointment Info */}
          <div className="p-3 rounded-lg bg-warm-50">
            <p className="font-medium text-warm-800">
              {appointment.client_name || 'Client'}
            </p>
            <p className="text-sm text-warm-600">
              {appointment.service_name || 'Service'}
            </p>
          </div>

          {/* Change Summary */}
          <div className="space-y-3">
            {timeChanged && (
              <div className="flex items-start gap-3">
                <Calendar className="w-5 h-5 text-warm-500 mt-0.5" />
                <div>
                  <p className="text-sm text-warm-500">Date & Time</p>
                  <p className="text-sm text-warm-600 line-through">
                    {format(originalTime, 'EEEE, MMM d')} at {format(originalTime, 'h:mm a')}
                  </p>
                  <p className="text-sm font-medium text-warm-800">
                    {format(newStartTime, 'EEEE, MMM d')} at {format(newStartTime, 'h:mm a')}
                  </p>
                </div>
              </div>
            )}

            {staffChanged && (
              <div className="flex items-start gap-3">
                <User className="w-5 h-5 text-warm-500 mt-0.5" />
                <div>
                  <p className="text-sm text-warm-500">Staff Member</p>
                  <p className="text-sm text-warm-600 line-through">
                    {originalStaff?.display_name || originalStaff?.first_name || 'Unknown'}
                  </p>
                  <p className="text-sm font-medium text-warm-800">
                    {newStaff?.display_name || newStaff?.first_name || 'Unknown'}
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* Warning */}
          <div className="flex items-start gap-2 p-3 rounded-lg bg-warning-50 text-warning-800">
            <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
            <p className="text-sm">
              The client will be notified of this change via SMS/email if notifications are enabled.
            </p>
          </div>
        </div>

        <div className="flex justify-end gap-3 p-4 border-t border-warm-200">
          <Button variant="secondary" onClick={onCancel} disabled={isLoading}>
            Cancel
          </Button>
          <Button onClick={onConfirm} isLoading={isLoading}>
            Confirm Reschedule
          </Button>
        </div>
      </div>
    </div>
  );
}
