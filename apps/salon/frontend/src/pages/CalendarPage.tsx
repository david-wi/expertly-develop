import { useEffect } from 'react';
import { format } from 'date-fns';
import {
  ChevronLeft,
  ChevronRight,
  Plus,
} from 'lucide-react';
import { Button } from '../components/ui';
import { CalendarView } from '../components/calendar/CalendarView';
import { useCalendarStore } from '../stores/calendarStore';
import { useBookingStore } from '../stores/bookingStore';

export function CalendarPage() {
  const {
    viewMode,
    currentDate,
    setViewMode,
    goToToday,
    goToNextPeriod,
    goToPreviousPeriod,
    fetchCalendar,
  } = useCalendarStore();

  const { openBooking } = useBookingStore();

  useEffect(() => {
    fetchCalendar();
  }, [fetchCalendar]);

  const dateDisplay =
    viewMode === 'day'
      ? format(currentDate, 'EEEE, MMMM d, yyyy')
      : format(currentDate, 'MMMM yyyy');

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-warm-200 px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            {/* Date navigation */}
            <div className="flex items-center gap-2">
              <button
                onClick={goToPreviousPeriod}
                className="p-2 rounded-lg hover:bg-warm-100 transition-colors"
              >
                <ChevronLeft className="w-5 h-5 text-warm-600" />
              </button>
              <button
                onClick={goToNextPeriod}
                className="p-2 rounded-lg hover:bg-warm-100 transition-colors"
              >
                <ChevronRight className="w-5 h-5 text-warm-600" />
              </button>
            </div>

            <h2 className="text-lg font-semibold text-warm-800">
              {dateDisplay}
            </h2>

            <Button variant="ghost" size="sm" onClick={goToToday}>
              Today
            </Button>
          </div>

          <div className="flex items-center gap-3">
            {/* View toggle */}
            <div className="flex bg-warm-100 rounded-lg p-1">
              <button
                onClick={() => setViewMode('day')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'day'
                    ? 'bg-white text-warm-800 shadow-sm'
                    : 'text-warm-600 hover:text-warm-800'
                }`}
              >
                Day
              </button>
              <button
                onClick={() => setViewMode('week')}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  viewMode === 'week'
                    ? 'bg-white text-warm-800 shadow-sm'
                    : 'text-warm-600 hover:text-warm-800'
                }`}
              >
                Week
              </button>
            </div>

            {/* New booking button */}
            <Button onClick={() => openBooking()} leftIcon={<Plus className="w-4 h-4" />}>
              New Booking
            </Button>
          </div>
        </div>
      </header>

      {/* Calendar */}
      <div className="flex-1 overflow-hidden">
        <CalendarView />
      </div>
    </div>
  );
}
