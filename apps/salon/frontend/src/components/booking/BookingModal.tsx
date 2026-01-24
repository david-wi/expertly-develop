import { useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { X, ChevronLeft, Clock, User, Calendar } from 'lucide-react';
import { clsx } from 'clsx';
import { useBookingStore } from '../../stores/bookingStore';
import { useCalendarStore } from '../../stores/calendarStore';
import { services as servicesApi, staff as staffApi, clients as clientsApi } from '../../services/api';
import { Button, Input } from '../ui';
import type { Service, Staff, Client, AvailableSlot } from '../../types';
import { useState } from 'react';

export function BookingModal() {
  const {
    isOpen,
    closeBooking,
    currentStep,
    selectedService,
    selectedStaff,
    selectedDate,
    selectedSlot,
    selectedClient,
    notes,
    availableSlots,
    isLoadingSlots,
    isCreating,
    error,
    selectService,
    selectStaff,
    selectDate,
    selectSlot,
    selectClient,
    setNotes,
    goToNextStep,
    goToPreviousStep,
    loadAvailableSlots,
    createBooking,
    reset,
  } = useBookingStore();

  const { refreshCalendar } = useCalendarStore();

  // Fetch data
  const { data: serviceList = [] } = useQuery({
    queryKey: ['services'],
    queryFn: () => servicesApi.list(),
    enabled: isOpen,
  });

  const { data: staffList = [] } = useQuery({
    queryKey: ['staff'],
    queryFn: () => staffApi.list(),
    enabled: isOpen,
  });

  // Load slots when service/staff/date changes
  useEffect(() => {
    if (selectedService && selectedDate) {
      loadAvailableSlots();
    }
  }, [selectedService, selectedStaff, selectedDate]);

  const handleConfirm = async () => {
    const appointment = await createBooking();
    if (appointment) {
      refreshCalendar();
      closeBooking();
      reset();
    }
  };

  if (!isOpen) return null;

  const stepTitles: Record<string, string> = {
    service: 'Select Service',
    staff: 'Select Staff',
    time: 'Select Time',
    client: 'Select Client',
    confirm: 'Confirm Booking',
  };

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto">
      <div className="fixed inset-0 bg-warm-900/50" onClick={closeBooking} />
      <div className="flex min-h-full items-center justify-center p-4">
        <div className="relative w-full max-w-lg bg-white rounded-lg shadow-warm-lg">
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-warm-200">
            <div className="flex items-center gap-3">
              {currentStep !== 'service' && (
                <button
                  onClick={goToPreviousStep}
                  className="p-1 rounded-lg text-warm-500 hover:bg-warm-100"
                >
                  <ChevronLeft className="w-5 h-5" />
                </button>
              )}
              <h2 className="text-lg font-semibold text-warm-800">
                {stepTitles[currentStep]}
              </h2>
            </div>
            <button
              onClick={closeBooking}
              className="p-1 rounded-lg text-warm-500 hover:bg-warm-100"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
            {error && (
              <div className="mb-4 p-3 rounded-lg bg-error-100 text-error-700 text-sm">
                {error}
              </div>
            )}

            {currentStep === 'service' && (
              <ServiceStep
                services={serviceList}
                selected={selectedService}
                onSelect={(s) => {
                  selectService(s);
                  goToNextStep();
                }}
              />
            )}

            {currentStep === 'staff' && (
              <StaffStep
                staffList={staffList}
                selected={selectedStaff}
                onSelect={(s) => {
                  selectStaff(s);
                  goToNextStep();
                }}
                onSkip={() => {
                  selectStaff(null);
                  goToNextStep();
                }}
              />
            )}

            {currentStep === 'time' && (
              <TimeStep
                selectedDate={selectedDate}
                onDateChange={selectDate}
                slots={availableSlots}
                isLoading={isLoadingSlots}
                selected={selectedSlot}
                onSelect={(s) => {
                  selectSlot(s);
                  goToNextStep();
                }}
              />
            )}

            {currentStep === 'client' && (
              <ClientStep
                selected={selectedClient}
                onSelect={(c) => {
                  selectClient(c);
                  goToNextStep();
                }}
              />
            )}

            {currentStep === 'confirm' && (
              <ConfirmStep
                service={selectedService!}
                slot={selectedSlot!}
                client={selectedClient!}
                notes={notes}
                onNotesChange={setNotes}
              />
            )}
          </div>

          {/* Footer */}
          {currentStep === 'confirm' && (
            <div className="px-6 py-4 border-t border-warm-200 flex justify-end gap-3">
              <Button variant="secondary" onClick={goToPreviousStep}>
                Back
              </Button>
              <Button onClick={handleConfirm} isLoading={isCreating}>
                Confirm Booking
              </Button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// Step Components

interface ServiceStepProps {
  services: Service[];
  selected: Service | null;
  onSelect: (service: Service) => void;
}

function ServiceStep({ services, selected, onSelect }: ServiceStepProps) {
  return (
    <div className="space-y-2">
      {services.map((service) => (
        <button
          key={service.id}
          onClick={() => onSelect(service)}
          className={clsx(
            'w-full p-4 rounded-lg border text-left transition-all',
            selected?.id === service.id
              ? 'border-primary-400 bg-primary-50'
              : 'border-warm-200 hover:border-primary-300 hover:bg-warm-50'
          )}
        >
          <div className="flex justify-between items-start">
            <div>
              <p className="font-medium text-warm-800">{service.name}</p>
              {service.description && (
                <p className="text-sm text-warm-500 mt-1">{service.description}</p>
              )}
              <div className="flex items-center gap-3 mt-2 text-sm text-warm-600">
                <span className="flex items-center gap-1">
                  <Clock className="w-4 h-4" />
                  {service.duration_minutes} min
                </span>
              </div>
            </div>
            <p className="font-semibold text-accent-600">{service.price_display}</p>
          </div>
        </button>
      ))}
    </div>
  );
}

interface StaffStepProps {
  staffList: Staff[];
  selected: Staff | null;
  onSelect: (staff: Staff) => void;
  onSkip: () => void;
}

function StaffStep({ staffList, selected, onSelect, onSkip }: StaffStepProps) {
  return (
    <div className="space-y-2">
      <button
        onClick={onSkip}
        className={clsx(
          'w-full p-4 rounded-lg border text-left transition-all',
          !selected
            ? 'border-primary-400 bg-primary-50'
            : 'border-warm-200 hover:border-primary-300 hover:bg-warm-50'
        )}
      >
        <p className="font-medium text-warm-800">Any Available</p>
        <p className="text-sm text-warm-500">First available staff member</p>
      </button>

      {staffList.map((staffMember) => (
        <button
          key={staffMember.id}
          onClick={() => onSelect(staffMember)}
          className={clsx(
            'w-full p-4 rounded-lg border text-left transition-all',
            selected?.id === staffMember.id
              ? 'border-primary-400 bg-primary-50'
              : 'border-warm-200 hover:border-primary-300 hover:bg-warm-50'
          )}
        >
          <div className="flex items-center gap-3">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center text-white font-medium"
              style={{ backgroundColor: staffMember.color }}
            >
              {staffMember.first_name[0]}
            </div>
            <div>
              <p className="font-medium text-warm-800">
                {staffMember.display_name || `${staffMember.first_name} ${staffMember.last_name}`}
              </p>
            </div>
          </div>
        </button>
      ))}
    </div>
  );
}

interface TimeStepProps {
  selectedDate: Date | null;
  onDateChange: (date: Date) => void;
  slots: AvailableSlot[];
  isLoading: boolean;
  selected: AvailableSlot | null;
  onSelect: (slot: AvailableSlot) => void;
}

function TimeStep({ selectedDate, onDateChange, slots, isLoading, selected, onSelect }: TimeStepProps) {
  const today = new Date();

  return (
    <div className="space-y-4">
      {/* Date picker */}
      <div>
        <label className="block text-sm font-medium text-warm-700 mb-2">Date</label>
        <input
          type="date"
          value={selectedDate ? format(selectedDate, 'yyyy-MM-dd') : ''}
          onChange={(e) => onDateChange(new Date(e.target.value))}
          min={format(today, 'yyyy-MM-dd')}
          className="w-full px-3 py-2 rounded-lg border border-warm-300 focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
        />
      </div>

      {/* Time slots */}
      <div>
        <label className="block text-sm font-medium text-warm-700 mb-2">Available Times</label>
        {isLoading ? (
          <p className="text-warm-500 text-center py-4">Loading availability...</p>
        ) : slots.length === 0 ? (
          <p className="text-warm-500 text-center py-4">No available times</p>
        ) : (
          <div className="grid grid-cols-3 gap-2 max-h-64 overflow-y-auto">
            {slots.map((slot, idx) => (
              <button
                key={idx}
                onClick={() => onSelect(slot)}
                className={clsx(
                  'px-3 py-2 rounded-lg border text-sm transition-all',
                  selected?.start_time === slot.start_time && selected?.staff_id === slot.staff_id
                    ? 'border-primary-400 bg-primary-100 text-primary-700'
                    : 'border-warm-200 hover:border-primary-300'
                )}
              >
                {format(new Date(slot.start_time), 'h:mm a')}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

interface ClientStepProps {
  selected: Client | null;
  onSelect: (client: Client) => void;
}

function ClientStep({ selected, onSelect }: ClientStepProps) {
  const [searchQuery, setSearchQuery] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  const { data: clients = [], isLoading } = useQuery({
    queryKey: ['clients-search', searchQuery],
    queryFn: () => searchQuery ? clientsApi.search(searchQuery) : clientsApi.list(20),
    enabled: searchQuery.length > 0 || !searchQuery,
  });

  if (showCreate) {
    return (
      <CreateClientInline
        onCreated={(client) => {
          onSelect(client);
        }}
        onCancel={() => setShowCreate(false)}
      />
    );
  }

  return (
    <div className="space-y-4">
      <Input
        placeholder="Search clients by name or phone..."
        value={searchQuery}
        onChange={(e) => setSearchQuery(e.target.value)}
        autoFocus
      />

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {isLoading ? (
          <p className="text-warm-500 text-center py-4">Searching...</p>
        ) : clients.length === 0 ? (
          <div className="text-center py-4">
            <p className="text-warm-500 mb-2">No clients found</p>
            <Button variant="secondary" size="sm" onClick={() => setShowCreate(true)}>
              Create New Client
            </Button>
          </div>
        ) : (
          <>
            {clients.map((client) => (
              <button
                key={client.id}
                onClick={() => onSelect(client)}
                className={clsx(
                  'w-full p-3 rounded-lg border text-left transition-all',
                  selected?.id === client.id
                    ? 'border-primary-400 bg-primary-50'
                    : 'border-warm-200 hover:border-primary-300'
                )}
              >
                <p className="font-medium text-warm-800">{client.full_name}</p>
                <p className="text-sm text-warm-500">{client.phone || client.email || 'No contact'}</p>
              </button>
            ))}
            <button
              onClick={() => setShowCreate(true)}
              className="w-full p-3 rounded-lg border border-dashed border-warm-300 text-warm-600 hover:border-primary-300 hover:text-primary-600"
            >
              + Create New Client
            </button>
          </>
        )}
      </div>
    </div>
  );
}

interface CreateClientInlineProps {
  onCreated: (client: Client) => void;
  onCancel: () => void;
}

function CreateClientInline({ onCreated, onCancel }: CreateClientInlineProps) {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [phone, setPhone] = useState('');
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    setIsCreating(true);
    try {
      const client = await clientsApi.create({ first_name: firstName, last_name: lastName, phone });
      onCreated(client);
    } finally {
      setIsCreating(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
        <Input
          label="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </div>
      <Input
        label="Phone"
        type="tel"
        value={phone}
        onChange={(e) => setPhone(e.target.value)}
      />
      <div className="flex gap-3">
        <Button variant="secondary" onClick={onCancel}>
          Cancel
        </Button>
        <Button onClick={handleCreate} isLoading={isCreating} disabled={!firstName || !lastName}>
          Create & Select
        </Button>
      </div>
    </div>
  );
}

interface ConfirmStepProps {
  service: Service;
  slot: AvailableSlot;
  client: Client;
  notes: string;
  onNotesChange: (notes: string) => void;
}

function ConfirmStep({ service, slot, client, notes, onNotesChange }: ConfirmStepProps) {
  return (
    <div className="space-y-4">
      <div className="p-4 rounded-lg bg-warm-50 space-y-3">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-warm-500" />
          <div>
            <p className="font-medium text-warm-800">
              {format(new Date(slot.start_time), 'EEEE, MMMM d, yyyy')}
            </p>
            <p className="text-sm text-warm-600">
              {format(new Date(slot.start_time), 'h:mm a')} - {format(new Date(slot.end_time), 'h:mm a')}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-warm-500" />
          <div>
            <p className="font-medium text-warm-800">{client.full_name}</p>
            <p className="text-sm text-warm-600">{client.phone || client.email}</p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-warm-500" />
          <div>
            <p className="font-medium text-warm-800">{service.name}</p>
            <p className="text-sm text-warm-600">
              {service.duration_minutes} minutes • {service.price_display}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <User className="w-5 h-5 text-warm-500" />
          <p className="text-warm-800">with {slot.staff_name}</p>
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-warm-700 mb-1">Notes (optional)</label>
        <textarea
          value={notes}
          onChange={(e) => onNotesChange(e.target.value)}
          rows={3}
          className="w-full px-3 py-2 rounded-lg border border-warm-300 focus:ring-2 focus:ring-primary-300 focus:border-primary-400"
          placeholder="Any special requests or notes..."
        />
      </div>
    </div>
  );
}
