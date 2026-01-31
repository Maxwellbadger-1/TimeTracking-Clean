/**
 * Calendar Page - Main calendar view with tab navigation
 *
 * Integrates MonthCalendar, WeekCalendar, YearCalendar, TeamCalendar
 */

import { useState, useMemo } from 'react';
import { addMonths, subMonths, addWeeks, subWeeks, addYears, subYears } from 'date-fns';
import { useAuthStore } from '../store/authStore';
import { useUIStore } from '../store/uiStore';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { MonthCalendar } from '../components/calendar/MonthCalendar';
import { WeekCalendarColumns } from '../components/calendar/WeekCalendarColumns';
import { YearCalendar } from '../components/calendar/YearCalendar';
import { TeamCalendar } from '../components/calendar/TeamCalendar';
import { CalendarFilters } from '../components/calendar/CalendarFilters';
import { CalendarToolbar } from '../components/calendar/CalendarToolbar';
import { CalendarLegend } from '../components/calendar/CalendarLegend';
import { useTimeEntries, useCalendarAbsences, useMultiYearHolidays, useActiveEmployees } from '../hooks';

export function CalendarPage() {
  const { user } = useAuthStore();
  const { calendarFilters } = useUIStore();
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
  // For calendars: Show ALL absences (pending + approved) for visibility
  // Pending absences are shown with dashed border to differentiate from approved
  // Rejected absences are filtered out in the calendar components
  //
  // MULTI-YEAR ABSENCE LOADING:
  // Load absences for 3 years (previous, current, next) based on viewed date
  // Example: Viewing Dec 2025 → Loads 2024, 2025, 2026
  // This handles:
  // - Historical data when navigating to past months
  // - Year-crossing absences (e.g., 31.12.2025 - 02.01.2026)
  // - Future planning when viewing upcoming months
  const absenceYear = currentDate.getFullYear();
  const { data: absences, isLoading: loadingAbsences } = useCalendarAbsences(absenceYear, {});
  const { data: holidays, isLoading: loadingHolidays } = useMultiYearHolidays();

  // Fetch all active employees for filter (admin only)
  const { data: allEmployees, isLoading: loadingEmployees } = useActiveEmployees({
    enabled: isAdmin,
  });

  // Apply user filter (admin only)
  const hasUserFilter = isAdmin && calendarFilters.selectedUserIds.length > 0;

  const filteredTimeEntries = useMemo(() => {
    if (!hasUserFilter || !timeEntries) return timeEntries || [];
    return timeEntries.filter(entry =>
      calendarFilters.selectedUserIds.includes(entry.userId)
    );
  }, [timeEntries, hasUserFilter, calendarFilters.selectedUserIds]);

  const filteredAbsences = useMemo(() => {
    if (!hasUserFilter || !absences) return absences || [];
    return absences.filter(absence =>
      calendarFilters.selectedUserIds.includes(absence.userId)
    );
  }, [absences, hasUserFilter, calendarFilters.selectedUserIds]);

  // Navigation handlers
  const handlePrevious = () => {
    switch (viewMode) {
      case 'month':
      case 'team':
        setCurrentDate(subMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(subWeeks(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(subYears(currentDate, 1));
        break;
    }
  };

  const handleNext = () => {
    switch (viewMode) {
      case 'month':
      case 'team':
        setCurrentDate(addMonths(currentDate, 1));
        break;
      case 'week':
        setCurrentDate(addWeeks(currentDate, 1));
        break;
      case 'year':
        setCurrentDate(addYears(currentDate, 1));
        break;
    }
  };

  const handleToday = () => {
    setCurrentDate(new Date());
  };

  if (!user) return null;

  const isLoading = loadingEntries || loadingAbsences || loadingHolidays || (isAdmin && loadingEmployees);

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
            {/* Unified Calendar Toolbar (Row 1) */}
            <CalendarToolbar
              currentDate={currentDate}
              onDateChange={setCurrentDate}
              onPrevious={handlePrevious}
              onNext={handleNext}
              onToday={handleToday}
              viewMode={viewMode}
              onViewModeChange={setViewMode}
              showEmployeeFilter={isAdmin && !!allEmployees}
              employeeFilterComponent={
                isAdmin && allEmployees ? <CalendarFilters users={allEmployees} /> : undefined
              }
            />

            {/* Calendar Legend (Row 2) */}
            <div className="mb-6">
              <CalendarLegend />
            </div>

            {/* Month Calendar */}
            {viewMode === 'month' && (
              <MonthCalendar
                timeEntries={filteredTimeEntries}
                absences={filteredAbsences}
                holidays={holidays || []}
                isAdmin={isAdmin}
                currentUserId={user.id}
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
                timeEntries={filteredTimeEntries}
                absences={filteredAbsences}
                holidays={holidays || []}
                currentUserId={user.id}
                currentUser={user}
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

            {/* Year Calendar */}
            {viewMode === 'year' && (
              <YearCalendar
                timeEntries={filteredTimeEntries}
                absences={filteredAbsences}
                holidays={holidays || []}
                currentUserId={user.id}
                currentUser={user}
                isAdmin={isAdmin}
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                currentDate={currentDate}
                onDateChange={setCurrentDate}
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
                currentUserId={user.id}
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
