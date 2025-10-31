/**
 * Calendar Page - Main calendar view with tab navigation
 *
 * Integrates MonthCalendar, WeekCalendar, YearCalendar, TeamCalendar
 */

import { useState } from 'react';
import { useAuthStore } from '../store/authStore';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { MonthCalendar } from '../components/calendar/MonthCalendar';
import { WeekCalendar } from '../components/calendar/WeekCalendar';
import { YearCalendar } from '../components/calendar/YearCalendar';
import { TeamCalendar } from '../components/calendar/TeamCalendar';
import { useTimeEntries, useAbsenceRequests, useCurrentYearHolidays } from '../hooks';

export function CalendarPage() {
  const { user, logout } = useAuthStore();
  const [viewMode, setViewMode] = useState<'month' | 'week' | 'year' | 'team'>('month');

  // Fetch data for calendar
  const { data: timeEntries, isLoading: loadingEntries } = useTimeEntries(user?.id);
  const { data: absences, isLoading: loadingAbsences } = useAbsenceRequests(user?.id);
  const { data: holidays, isLoading: loadingHolidays } = useCurrentYearHolidays();

  if (!user) return null;

  const isLoading = loadingEntries || loadingAbsences || loadingHolidays;

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
            Kalender
          </h1>
          <p className="text-gray-600 dark:text-gray-400 mt-1">
            {user.firstName} {user.lastName}
          </p>
        </div>

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
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onDayClick={(date) => {
                  console.log('Day clicked:', date);
                  // TODO: Open day detail modal
                }}
              />
            )}

            {/* Week Calendar */}
            {viewMode === 'week' && (
              <WeekCalendar
                timeEntries={timeEntries || []}
                absences={absences || []}
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
                viewMode={viewMode}
                onViewModeChange={setViewMode}
                onDayClick={(date) => {
                  console.log('Day clicked:', date);
                  // TODO: Open day detail modal or switch to month view
                }}
              />
            )}

            {/* Team Calendar (Admin only) */}
            {viewMode === 'team' && (
              <>
                {user.role === 'admin' ? (
                  <TeamCalendar
                    viewMode={viewMode}
                    onViewModeChange={setViewMode}
                    onDayClick={(date, user) => {
                      console.log('Day clicked:', date, 'User:', user);
                      // TODO: Open user day detail modal
                    }}
                  />
                ) : (
                  <div className="text-center py-12 text-gray-500 dark:text-gray-400">
                    <p>Team-Kalender ist nur für Administratoren verfügbar.</p>
                  </div>
                )}
              </>
            )}
          </>
        )}
      </main>
    </div>
  );
}
