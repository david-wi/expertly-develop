import { create } from 'zustand';
import type { Client, Service, Staff, Appointment, AvailableSlot } from '../types';
import { appointments, calendar } from '../services/api';

type BookingStep = 'service' | 'staff' | 'time' | 'client' | 'confirm';

interface BookingState {
  // Booking flow state
  isOpen: boolean;
  currentStep: BookingStep;

  // Selected values
  selectedService: Service | null;
  selectedStaff: Staff | null;
  selectedDate: Date | null;
  selectedSlot: AvailableSlot | null;
  selectedClient: Client | null;
  notes: string;

  // Available slots
  availableSlots: AvailableSlot[];
  isLoadingSlots: boolean;

  // Result
  createdAppointment: Appointment | null;
  isCreating: boolean;
  error: string | null;

  // Actions
  openBooking: (initialService?: Service, initialStaff?: Staff, initialDate?: Date) => void;
  closeBooking: () => void;
  reset: () => void;

  // Step navigation
  goToStep: (step: BookingStep) => void;
  goToNextStep: () => void;
  goToPreviousStep: () => void;

  // Selection actions
  selectService: (service: Service) => void;
  selectStaff: (staff: Staff | null) => void;
  selectDate: (date: Date) => void;
  selectSlot: (slot: AvailableSlot) => void;
  selectClient: (client: Client) => void;
  setNotes: (notes: string) => void;

  // Data loading
  loadAvailableSlots: () => Promise<void>;

  // Booking creation
  createBooking: () => Promise<Appointment | null>;
}

const STEP_ORDER: BookingStep[] = ['service', 'staff', 'time', 'client', 'confirm'];

const initialState = {
  isOpen: false,
  currentStep: 'service' as BookingStep,
  selectedService: null,
  selectedStaff: null,
  selectedDate: null,
  selectedSlot: null,
  selectedClient: null,
  notes: '',
  availableSlots: [],
  isLoadingSlots: false,
  createdAppointment: null,
  isCreating: false,
  error: null,
};

export const useBookingStore = create<BookingState>((set, get) => ({
  ...initialState,

  openBooking: (initialService, initialStaff, initialDate) => {
    set({
      ...initialState,
      isOpen: true,
      selectedService: initialService || null,
      selectedStaff: initialStaff || null,
      selectedDate: initialDate || new Date(),
      currentStep: initialService ? 'staff' : 'service',
    });
  },

  closeBooking: () => {
    set({ isOpen: false });
  },

  reset: () => {
    set(initialState);
  },

  goToStep: (step) => {
    set({ currentStep: step, error: null });
  },

  goToNextStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex < STEP_ORDER.length - 1) {
      set({ currentStep: STEP_ORDER[currentIndex + 1], error: null });
    }
  },

  goToPreviousStep: () => {
    const { currentStep } = get();
    const currentIndex = STEP_ORDER.indexOf(currentStep);
    if (currentIndex > 0) {
      set({ currentStep: STEP_ORDER[currentIndex - 1], error: null });
    }
  },

  selectService: (service) => {
    set({ selectedService: service, selectedSlot: null, availableSlots: [] });
  },

  selectStaff: (staff) => {
    set({ selectedStaff: staff, selectedSlot: null, availableSlots: [] });
  },

  selectDate: (date) => {
    set({ selectedDate: date, selectedSlot: null, availableSlots: [] });
    get().loadAvailableSlots();
  },

  selectSlot: (slot) => {
    set({ selectedSlot: slot });
  },

  selectClient: (client) => {
    set({ selectedClient: client });
  },

  setNotes: (notes) => {
    set({ notes });
  },

  loadAvailableSlots: async () => {
    const { selectedService, selectedStaff, selectedDate } = get();
    if (!selectedService || !selectedDate) return;

    set({ isLoadingSlots: true, error: null });

    try {
      const dateStr = selectedDate.toISOString().split('T')[0];
      const response = await calendar.availability(
        dateStr,
        selectedService.id,
        selectedStaff?.id
      );
      set({ availableSlots: response.slots, isLoadingSlots: false });
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to load availability',
        isLoadingSlots: false,
      });
    }
  },

  createBooking: async () => {
    const { selectedService, selectedSlot, selectedClient, notes } = get();

    if (!selectedService || !selectedSlot || !selectedClient) {
      set({ error: 'Missing required booking information' });
      return null;
    }

    set({ isCreating: true, error: null });

    try {
      const appointment = await appointments.create({
        client_id: selectedClient.id,
        staff_id: selectedSlot.staff_id,
        service_id: selectedService.id,
        start_time: selectedSlot.start_time,
        notes: notes || undefined,
      });

      set({ createdAppointment: appointment, isCreating: false });
      return appointment;
    } catch (error) {
      set({
        error: error instanceof Error ? error.message : 'Failed to create booking',
        isCreating: false,
      });
      return null;
    }
  },
}));
