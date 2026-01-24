import { create } from 'zustand';
import { format, addDays, startOfWeek, endOfWeek } from 'date-fns';
import type { Appointment, CalendarResponse, SlotLock } from '../types';
import { calendar, appointments as appointmentsApi } from '../services/api';

type ViewMode = 'day' | 'week';

interface DragState {
  appointment: Appointment;
  originalStaffId: string;
  originalStartTime: string;
}

interface DropTarget {
  staffId: string;
  startTime: Date;
}

interface CalendarState {
  viewMode: ViewMode;
  currentDate: Date;
  selectedStaffIds: string[];
  calendarData: CalendarResponse | null;
  isLoading: boolean;
  error: string | null;

  // Slot lock state
  activeLock: SlotLock | null;
  lockExpiry: Date | null;

  // Drag-and-drop state
  draggingAppointment: DragState | null;
  dropTarget: DropTarget | null;
  showRescheduleModal: boolean;
  pendingReschedule: { appointment: Appointment; newStaffId: string; newStartTime: Date } | null;
  isRescheduling: boolean;

  // Actions
  setViewMode: (mode: ViewMode) => void;
  setCurrentDate: (date: Date) => void;
  goToToday: () => void;
  goToNextPeriod: () => void;
  goToPreviousPeriod: () => void;
  setSelectedStaff: (staffIds: string[]) => void;
  toggleStaffSelection: (staffId: string) => void;

  // Data fetching
  fetchCalendar: () => Promise<void>;
  refreshCalendar: () => Promise<void>;

  // Slot locking
  acquireLock: (staffId: string, startTime: Date, endTime: Date) => Promise<SlotLock | null>;
  releaseLock: () => Promise<void>;

  // Drag-and-drop actions
  startDrag: (appointment: Appointment, staffId: string) => void;
  updateDropTarget: (staffId: string, startTime: Date) => void;
  clearDropTarget: () => void;
  endDrag: () => void;
  confirmReschedule: () => Promise<void>;
  cancelReschedule: () => void;
}

export const useCalendarStore = create<CalendarState>((set, get) => ({
  viewMode: 'week',
  currentDate: new Date(),
  selectedStaffIds: [],
  calendarData: null,
  isLoading: false,
  error: null,
  activeLock: null,
  lockExpiry: null,
  draggingAppointment: null,
  dropTarget: null,
  showRescheduleModal: false,
  pendingReschedule: null,
  isRescheduling: false,

  setViewMode: (mode) => {
    set({ viewMode: mode });
    get().fetchCalendar();
  },

  setCurrentDate: (date) => {
    set({ currentDate: date });
    get().fetchCalendar();
  },

  goToToday: () => {
    set({ currentDate: new Date() });
    get().fetchCalendar();
  },

  goToNextPeriod: () => {
    const { viewMode, currentDate } = get();
    const days = viewMode === 'day' ? 1 : 7;
    set({ currentDate: addDays(currentDate, days) });
    get().fetchCalendar();
  },

  goToPreviousPeriod: () => {
    const { viewMode, currentDate } = get();
    const days = viewMode === 'day' ? 1 : 7;
    set({ currentDate: addDays(currentDate, -days) });
    get().fetchCalendar();
  },

  setSelectedStaff: (staffIds) => {
    set({ selectedStaffIds: staffIds });
    get().fetchCalendar();
  },

  toggleStaffSelection: (staffId) => {
    const { selectedStaffIds } = get();
    if (selectedStaffIds.includes(staffId)) {
      set({ selectedStaffIds: selectedStaffIds.filter((id) => id !== staffId) });
    } else {
      set({ selectedStaffIds: [...selectedStaffIds, staffId] });
    }
    get().fetchCalendar();
  },

  fetchCalendar: async () => {
    const { viewMode, currentDate, selectedStaffIds } = get();
    set({ isLoading: true, error: null });

    try {
      let startDate: string;
      let endDate: string;

      if (viewMode === 'day') {
        startDate = format(currentDate, 'yyyy-MM-dd');
        endDate = startDate;
      } else {
        const weekStart = startOfWeek(currentDate, { weekStartsOn: 0 });
        const weekEnd = endOfWeek(currentDate, { weekStartsOn: 0 });
        startDate = format(weekStart, 'yyyy-MM-dd');
        endDate = format(weekEnd, 'yyyy-MM-dd');
      }

      const data = await calendar.get(
        startDate,
        endDate,
        selectedStaffIds.length > 0 ? selectedStaffIds : undefined
      );

      set({ calendarData: data, isLoading: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load calendar',
        isLoading: false,
      });
    }
  },

  refreshCalendar: async () => {
    await get().fetchCalendar();
  },

  acquireLock: async (staffId, startTime, endTime) => {
    try {
      // Release existing lock first
      await get().releaseLock();

      const lock = await appointmentsApi.lock(
        staffId,
        startTime.toISOString(),
        endTime.toISOString()
      );

      set({
        activeLock: lock,
        lockExpiry: new Date(lock.expires_at),
      });

      return lock;
    } catch (error) {
      console.error('Failed to acquire lock:', error);
      return null;
    }
  },

  releaseLock: async () => {
    const { activeLock } = get();
    if (activeLock) {
      try {
        await appointmentsApi.releaseLock(activeLock.lock_id);
      } catch {
        // Ignore errors when releasing lock
      }
      set({ activeLock: null, lockExpiry: null });
    }
  },

  // Drag-and-drop actions
  startDrag: (appointment, staffId) => {
    set({
      draggingAppointment: {
        appointment,
        originalStaffId: staffId,
        originalStartTime: appointment.start_time,
      },
    });
  },

  updateDropTarget: (staffId, startTime) => {
    set({ dropTarget: { staffId, startTime } });
  },

  clearDropTarget: () => {
    set({ dropTarget: null });
  },

  endDrag: () => {
    const { draggingAppointment, dropTarget } = get();

    if (draggingAppointment && dropTarget) {
      // Check if actually moved
      const sameStaff = draggingAppointment.originalStaffId === dropTarget.staffId;
      const sameTime =
        new Date(draggingAppointment.originalStartTime).getTime() === dropTarget.startTime.getTime();

      if (!sameStaff || !sameTime) {
        // Show confirmation modal
        set({
          showRescheduleModal: true,
          pendingReschedule: {
            appointment: draggingAppointment.appointment,
            newStaffId: dropTarget.staffId,
            newStartTime: dropTarget.startTime,
          },
        });
      }
    }

    set({ draggingAppointment: null, dropTarget: null });
  },

  confirmReschedule: async () => {
    const { pendingReschedule, fetchCalendar } = get();

    if (!pendingReschedule) return;

    set({ isRescheduling: true });

    try {
      await appointmentsApi.reschedule(
        pendingReschedule.appointment.id,
        pendingReschedule.newStartTime.toISOString(),
        pendingReschedule.newStaffId
      );

      set({
        showRescheduleModal: false,
        pendingReschedule: null,
        isRescheduling: false,
      });

      // Refresh calendar
      await fetchCalendar();
    } catch (error) {
      console.error('Failed to reschedule:', error);
      set({ isRescheduling: false });
      throw error;
    }
  },

  cancelReschedule: () => {
    set({
      showRescheduleModal: false,
      pendingReschedule: null,
    });
  },
}));
