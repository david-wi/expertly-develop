import { useMemo, useState, useCallback } from 'react';
import { format, parseISO, differenceInMinutes, setHours, setMinutes, startOfWeek, addDays } from 'date-fns';
import { clsx } from 'clsx';
import { useCalendarStore } from '../../stores/calendarStore';
import { useBookingStore } from '../../stores/bookingStore';
import type { Appointment, Staff, StaffCalendarDay } from '../../types';
import { RescheduleModal } from './RescheduleModal';

const HOUR_HEIGHT = 60; // pixels per hour
const START_HOUR = 7; // 7 AM
const END_HOUR = 21; // 9 PM
const SLOT_INTERVAL = 15; // minutes per slot

export function CalendarView() {
  const {
    viewMode,
    currentDate,
    calendarData,
    isLoading,
    showRescheduleModal,
    pendingReschedule,
    isRescheduling,
    confirmReschedule,
    cancelReschedule,
  } = useCalendarStore();
  const { openBooking } = useBookingStore();

  const timeSlots = useMemo(() => {
    const slots = [];
    for (let hour = START_HOUR; hour < END_HOUR; hour++) {
      slots.push({
        hour,
        label: format(new Date().setHours(hour, 0), 'h a'),
      });
    }
    return slots;
  }, []);

  // Get the days to display based on view mode
  const daysToShow = useMemo(() => {
    if (viewMode === 'day') {
      return [currentDate];
    }
    // Week view: show 7 days starting from Sunday
    const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
    return Array.from({ length: 7 }, (_, i) => addDays(weekStart, i));
  }, [viewMode, currentDate]);

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center text-warm-500">
        Loading calendar...
      </div>
    );
  }

  if (!calendarData) {
    return (
      <div className="h-full flex items-center justify-center text-warm-500">
        No calendar data
      </div>
    );
  }

  // Day view: show staff as columns
  if (viewMode === 'day') {
    const dateKey = format(currentDate, 'yyyy-MM-dd');
    const dayData = calendarData.days[dateKey] || [];

    return (
      <div className="h-full flex flex-col bg-white">
        {/* Staff header */}
        <div className="flex border-b border-warm-200 bg-warm-50">
          <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
          {calendarData.staff.map((staffMember) => (
            <div
              key={staffMember.id}
              className="flex-1 min-w-[150px] px-3 py-3 text-center border-l border-warm-200"
            >
              <div
                className="inline-flex items-center justify-center w-8 h-8 rounded-full text-white text-sm font-medium mb-1"
                style={{ backgroundColor: staffMember.color }}
              >
                {staffMember.first_name[0]}
              </div>
              <div className="text-sm font-medium text-warm-800">
                {staffMember.display_name || staffMember.first_name}
              </div>
            </div>
          ))}
        </div>

        {/* Calendar grid */}
        <div className="flex-1 overflow-auto">
          <div className="flex min-h-full">
            {/* Time column */}
            <div className="w-16 flex-shrink-0 border-r border-warm-200">
              {timeSlots.map((slot) => (
                <div
                  key={slot.hour}
                  className="relative"
                  style={{ height: HOUR_HEIGHT }}
                >
                  <span className="absolute -top-2.5 right-2 text-xs text-warm-500">
                    {slot.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Staff columns */}
            {calendarData.staff.map((staffMember) => {
              const staffDay = dayData.find((d) => d.staff_id === staffMember.id);
              return (
                <StaffColumn
                  key={staffMember.id}
                  staff={staffMember}
                  dayData={staffDay}
                  timeSlots={timeSlots}
                  currentDate={currentDate}
                  onSlotClick={() => {
                    openBooking(undefined, staffMember, currentDate);
                  }}
                />
              );
            })}
          </div>
        </div>

        {/* Reschedule Confirmation Modal */}
        {showRescheduleModal && pendingReschedule && (
          <RescheduleModal
            appointment={pendingReschedule.appointment}
            newStaffId={pendingReschedule.newStaffId}
            newStartTime={pendingReschedule.newStartTime}
            staffList={calendarData.staff}
            isLoading={isRescheduling}
            onConfirm={confirmReschedule}
            onCancel={cancelReschedule}
          />
        )}
      </div>
    );
  }

  // Week view: show days as columns
  return (
    <div className="h-full flex flex-col bg-white">
      {/* Day header */}
      <div className="flex border-b border-warm-200 bg-warm-50">
        <div className="w-16 flex-shrink-0" /> {/* Time column spacer */}
        {daysToShow.map((day) => {
          const isToday = format(day, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');
          return (
            <div
              key={format(day, 'yyyy-MM-dd')}
              className="flex-1 min-w-[120px] px-3 py-3 text-center border-l border-warm-200"
            >
              <div className="text-xs text-warm-500 uppercase">
                {format(day, 'EEE')}
              </div>
              <div
                className={clsx(
                  'text-lg font-semibold',
                  isToday ? 'text-primary-600' : 'text-warm-800'
                )}
              >
                {format(day, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Calendar grid */}
      <div className="flex-1 overflow-auto">
        <div className="flex min-h-full">
          {/* Time column */}
          <div className="w-16 flex-shrink-0 border-r border-warm-200">
            {timeSlots.map((slot) => (
              <div
                key={slot.hour}
                className="relative"
                style={{ height: HOUR_HEIGHT }}
              >
                <span className="absolute -top-2.5 right-2 text-xs text-warm-500">
                  {slot.label}
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {daysToShow.map((day) => {
            const dateKey = format(day, 'yyyy-MM-dd');
            const dayData = calendarData.days[dateKey] || [];
            // Combine all staff appointments for this day
            const allAppointments = dayData.flatMap((staffDay) =>
              staffDay.appointments.map((apt) => ({
                ...apt,
                staffColor: calendarData.staff.find((s) => s.id === staffDay.staff_id)?.color || '#888',
              }))
            );

            return (
              <DayColumn
                key={dateKey}
                date={day}
                appointments={allAppointments}
                timeSlots={timeSlots}
                onSlotClick={() => {
                  openBooking(undefined, undefined, day);
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Reschedule Confirmation Modal */}
      {showRescheduleModal && pendingReschedule && (
        <RescheduleModal
          appointment={pendingReschedule.appointment}
          newStaffId={pendingReschedule.newStaffId}
          newStartTime={pendingReschedule.newStartTime}
          staffList={calendarData.staff}
          isLoading={isRescheduling}
          onConfirm={confirmReschedule}
          onCancel={cancelReschedule}
        />
      )}
    </div>
  );
}

interface StaffColumnProps {
  staff: Staff;
  dayData?: StaffCalendarDay;
  timeSlots: { hour: number; label: string }[];
  currentDate: Date;
  onSlotClick: (time: Date) => void;
}

function StaffColumn({ staff, dayData, timeSlots, currentDate, onSlotClick }: StaffColumnProps) {
  const { draggingAppointment, dropTarget, updateDropTarget, clearDropTarget, endDrag } =
    useCalendarStore();
  const isWorking = dayData?.is_working ?? false;
  const appointments = dayData?.appointments || [];
  const workingHours = dayData?.working_hours || [];

  const handleDragOver = useCallback(
    (e: React.DragEvent) => {
      if (!draggingAppointment || !isWorking) return;

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';

      // Calculate the time slot based on mouse position
      const rect = e.currentTarget.getBoundingClientRect();
      const y = e.clientY - rect.top;
      const totalMinutes = START_HOUR * 60 + (y / HOUR_HEIGHT) * 60;

      // Round to nearest slot interval
      const roundedMinutes = Math.round(totalMinutes / SLOT_INTERVAL) * SLOT_INTERVAL;
      const hours = Math.floor(roundedMinutes / 60);
      const minutes = roundedMinutes % 60;

      const dropTime = setMinutes(setHours(currentDate, hours), minutes);
      updateDropTarget(staff.id, dropTime);
    },
    [draggingAppointment, isWorking, currentDate, staff.id, updateDropTarget]
  );

  const handleDragLeave = useCallback(() => {
    clearDropTarget();
  }, [clearDropTarget]);

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      endDrag();
    },
    [endDrag]
  );

  // Calculate drop indicator position
  const dropIndicatorTop = dropTarget?.staffId === staff.id && dropTarget?.startTime
    ? ((dropTarget.startTime.getHours() * 60 + dropTarget.startTime.getMinutes() - START_HOUR * 60) / 60) * HOUR_HEIGHT
    : null;

  return (
    <div
      className={clsx(
        'flex-1 min-w-[150px] border-l border-warm-200 relative',
        draggingAppointment && isWorking && 'bg-primary-50/30'
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
    >
      {/* Hour grid lines */}
      {timeSlots.map((slot) => (
        <div
          key={slot.hour}
          className={clsx(
            'border-b border-warm-100',
            !isWorking && 'bg-warm-100/50'
          )}
          style={{ height: HOUR_HEIGHT }}
        />
      ))}

      {/* Working hours background */}
      {isWorking &&
        workingHours.map((slot, idx) => {
          const startMinutes = parseTimeToMinutes(slot.start);
          const endMinutes = parseTimeToMinutes(slot.end);
          const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
          const height = ((endMinutes - startMinutes) / 60) * HOUR_HEIGHT;

          return (
            <div
              key={idx}
              className="absolute left-0 right-0 bg-white"
              style={{ top: Math.max(0, top), height }}
            />
          );
        })}

      {/* Drop indicator */}
      {dropIndicatorTop !== null && (
        <div
          className="absolute left-0 right-0 h-1 bg-primary-500 rounded z-20 pointer-events-none"
          style={{ top: dropIndicatorTop }}
        >
          <div className="absolute -left-1 -top-1 w-3 h-3 bg-primary-500 rounded-full" />
        </div>
      )}

      {/* Appointments */}
      {appointments.map((appointment) => (
        <AppointmentBlock
          key={appointment.id}
          appointment={appointment}
          staffId={staff.id}
          staffColor={staff.color}
        />
      ))}

      {/* Clickable slots for booking */}
      {isWorking && !draggingAppointment && (
        <div className="absolute inset-0 cursor-pointer" onClick={() => onSlotClick(new Date())} />
      )}
    </div>
  );
}

interface DayColumnProps {
  date: Date;
  appointments: (Appointment & { staffColor: string })[];
  timeSlots: { hour: number; label: string }[];
  onSlotClick: () => void;
}

function DayColumn({ date, appointments, timeSlots, onSlotClick }: DayColumnProps) {
  const isToday = format(date, 'yyyy-MM-dd') === format(new Date(), 'yyyy-MM-dd');

  return (
    <div
      className={clsx(
        'flex-1 min-w-[120px] border-l border-warm-200 relative',
        isToday && 'bg-primary-50/30'
      )}
    >
      {/* Hour grid lines */}
      {timeSlots.map((slot) => (
        <div
          key={slot.hour}
          className="border-b border-warm-100"
          style={{ height: HOUR_HEIGHT }}
        />
      ))}

      {/* Appointments */}
      {appointments.map((appointment) => (
        <WeekAppointmentBlock
          key={appointment.id}
          appointment={appointment}
          staffColor={appointment.staffColor}
        />
      ))}

      {/* Clickable area for booking */}
      <div className="absolute inset-0 cursor-pointer" onClick={onSlotClick} />
    </div>
  );
}

interface WeekAppointmentBlockProps {
  appointment: Appointment;
  staffColor: string;
}

function WeekAppointmentBlock({ appointment, staffColor }: WeekAppointmentBlockProps) {
  const startTime = parseISO(appointment.start_time);
  const endTime = parseISO(appointment.end_time);

  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  const duration = differenceInMinutes(endTime, startTime);

  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = (duration / 60) * HOUR_HEIGHT;

  const statusColors: Record<string, string> = {
    pending_deposit: 'bg-warning-200 border-warning-400',
    confirmed: 'bg-primary-100 border-primary-400',
    checked_in: 'bg-accent-100 border-accent-400',
    in_progress: 'bg-accent-200 border-accent-500',
    completed: 'bg-success-100 border-success-400',
    cancelled: 'bg-warm-200 border-warm-400 opacity-50',
    no_show: 'bg-error-100 border-error-400',
  };

  return (
    <div
      className={clsx(
        'absolute left-1 right-1 rounded-lg border-l-4 px-1 py-0.5',
        'hover:shadow-warm transition-shadow overflow-hidden z-10 cursor-pointer',
        statusColors[appointment.status] || 'bg-warm-100 border-warm-400'
      )}
      style={{
        top,
        height: Math.max(height, 24),
        borderLeftColor: staffColor,
      }}
    >
      <div className="text-xs font-medium text-warm-800 truncate">
        {appointment.client_name || 'Client'}
      </div>
      {height > 30 && (
        <div className="text-xs text-warm-500">
          {format(startTime, 'h:mm a')}
        </div>
      )}
    </div>
  );
}

interface AppointmentBlockProps {
  appointment: Appointment;
  staffId: string;
  staffColor: string;
}

function AppointmentBlock({ appointment, staffId, staffColor }: AppointmentBlockProps) {
  const { startDrag, draggingAppointment } = useCalendarStore();
  const startTime = parseISO(appointment.start_time);
  const endTime = parseISO(appointment.end_time);

  const startMinutes = startTime.getHours() * 60 + startTime.getMinutes();
  const duration = differenceInMinutes(endTime, startTime);

  const top = ((startMinutes - START_HOUR * 60) / 60) * HOUR_HEIGHT;
  const height = (duration / 60) * HOUR_HEIGHT;

  const isDragging = draggingAppointment?.appointment.id === appointment.id;
  const canDrag = ['pending_deposit', 'confirmed'].includes(appointment.status);

  const statusColors: Record<string, string> = {
    pending_deposit: 'bg-warning-200 border-warning-400',
    confirmed: 'bg-primary-100 border-primary-400',
    checked_in: 'bg-accent-100 border-accent-400',
    in_progress: 'bg-accent-200 border-accent-500',
    completed: 'bg-success-100 border-success-400',
    cancelled: 'bg-warm-200 border-warm-400 opacity-50',
    no_show: 'bg-error-100 border-error-400',
  };

  const handleDragStart = useCallback(
    (e: React.DragEvent) => {
      if (!canDrag) {
        e.preventDefault();
        return;
      }

      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', appointment.id);
      startDrag(appointment, staffId);
    },
    [appointment, staffId, canDrag, startDrag]
  );

  const handleDragEnd = useCallback(() => {
    // endDrag is called by the drop handler
  }, []);

  return (
    <div
      draggable={canDrag}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={clsx(
        'absolute left-1 right-1 rounded-lg border-l-4 px-2 py-1',
        'hover:shadow-warm transition-shadow overflow-hidden z-10',
        canDrag ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer',
        isDragging && 'opacity-50',
        statusColors[appointment.status] || 'bg-warm-100 border-warm-400'
      )}
      style={{
        top,
        height: Math.max(height, 30),
        borderLeftColor: staffColor,
      }}
    >
      <div className="text-xs font-medium text-warm-800 truncate">
        {appointment.client_name || 'Client'}
      </div>
      <div className="text-xs text-warm-600 truncate">
        {appointment.service_name || 'Service'}
      </div>
      <div className="text-xs text-warm-500">
        {format(startTime, 'h:mm a')}
      </div>
    </div>
  );
}

function parseTimeToMinutes(timeStr: string): number {
  const [hours, minutes] = timeStr.split(':').map(Number);
  return hours * 60 + minutes;
}
