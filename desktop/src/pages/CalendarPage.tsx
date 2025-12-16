/**
 * Calendar Page - Main calendar view with tab navigation
 *
 * Integrates MonthCalendar, WeekCalendar, YearCalendar, TeamCalendar
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { MonthCalendar } from '../components/calendar/MonthCalendar';
import { WeekCalendarColumns } from '../components/calendar/WeekCalendarColumns';
import { YearCalendar } from '../components/calendar/YearCalendar';
import { TeamCalendar } from '../components/calendar/TeamCalendar';
import { useTimeEntries, useAbsenceRequests, useMultiYearHolidays } from '../hooks';

export function CalendarPage() {
  const { user } = useAuthStore();
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'year' | 'team'>('month');
  const [currentDate, setCurrentDate] = useState(new Date());

  // Fetch data for calendar
  // For admin: fetch ALL data (no user filter) for team views
  // For employee: fetch only own data
  //
  // PROFESSIONAL APPROACH (Google Calendar Style):
  // - Load ONLY data for visible date range + buffer (performance!)
  // - Month view: Load current month ± 1 month (3 months total)
  // - Year view: Load current year
  // - React Query caches data automatically (navigation is fast!)
  // - AVOID loading ALL historical data (10000+ entries) at once!
  const isAdmin = user?.role === 'admin';
  const userIdFilter = isAdmin ? undefined : user?.id;

  // Calculate date range based on view mode (Google Calendar approach)
  const { startDate, endDate } = (() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    if (viewMode === 'month' || viewMode === 'week') {
      // Month/Week view: Load current month ± 1 month (3 months buffer)
      const start = new Date(year, month - 1, 1); // Previous month
      const end = new Date(year, month + 2, 0); // Next month (last day)
      return {
        startDate: start.toISOString().split('T')[0],
        endDate: end.toISOString().split('T')[0],
      };
    } else {
      // Year/Team view: Load full year
      return {
        startDate: `${year}-01-01`,
        endDate: `${year}-12-31`,
      };
    }
  })();

  const { data: timeEntries, isLoading: loadingEntries } = useTimeEntries({
    userId: userIdFilter,
    startDate,
    endDate,
  });
  const { data: absences, isLoading: loadingAbsences } = useAbsenceRequests(userIdFilter ? { userId: userIdFilter } : undefined);
  const { data: holidays, isLoading: loadingHolidays } = useMultiYearHolidays();

  if (!user) return null;

  const isLoading = loadingEntries || loadingAbsences || loadingHolidays;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {isLoading ? (
          <div className="flex justify-center items-center py-12">
            <LoadingSpinner size="lg" />
          </div>
        ) : (
          <>
            {/* Month Calendar */}
            {viewMode === 'month' && (
              <MonthCalendar
                timeEntries={timeEntries || []}
                absences={absences || []}
                holidays={holidays || []}
                isAdmin={isAdmin}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
                onDayClick={(date) => {
                  console.log('Day clicked:', date);
                  // TODO: Open day detail modal
                }}
              />
            )}

            {/* Week Calendar - Columns per User (Google Calendar Style) */}
            {viewMode === 'week' && (
              <WeekCalendarColumns
                timeEntries={timeEntries || []}
                absences={absences || []}
                currentUserId={user.id}
                currentUser={user}
                isAdmin={isAdmin}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onDayClick={(date) => {
                  console.log('Day clicked:', date);
                  // TODO: Open day detail modal
                }}
              />
            )}

            {/* Year Calendar */}
            {viewMode === 'year' && (
              <YearCalendar
                timeEntries={timeEntries || []}
                absences={absences || []}
                currentUserId={user.id}
                currentUser={user}
                isAdmin={isAdmin}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onDayClick={(date) => {
                  console.log('Day clicked:', date);
                  // TODO: Open day detail modal or switch to month view
                }}
              />
            )}

            {/* Team Calendar (All users - privacy-filtered for employees) */}
            {viewMode === 'team' && (
              <TeamCalendar
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                isAdmin={isAdmin}
                onDayClick={(date, user) => {
                  console.log('Day clicked:', date, 'User:', user);
                  // TODO: Open user day detail modal
                }}
              />
            )}
          </>
        )}
      </main>
    </div>
  );
}
