/**
 * Work Schedule Display Component
 *
 * Shows employee's working hours configuration (workSchedule or weeklyHours fallback)
 * Two modes:
 * - compact: For dashboard widget (summary view)
 * - detailed: For settings page / modal (table + chart)
 */

import { useMemo } from 'react';
import { Clock, Calendar, Info } from 'lucide-react';
import type { User, WorkSchedule } from '../../types';

interface WorkScheduleDisplayProps {
  user: User;
  mode: 'compact' | 'detailed';
  onDetailsClick?: () => void; // Only used in compact mode
}

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'So',
};

const DAY_LABELS_FULL: Record<keyof WorkSchedule, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

export function WorkScheduleDisplay({ user, mode, onDetailsClick }: WorkScheduleDisplayProps) {
  // Calculate schedule data
  const scheduleData = useMemo(() => {
    const hasIndividualSchedule = !!user.workSchedule;

    if (hasIndividualSchedule && user.workSchedule) {
      // Use individual schedule
      const schedule = user.workSchedule;
      const totalHours = Object.values(schedule).reduce((sum, hours) => sum + hours, 0);
      const workingDays = Object.values(schedule).filter(hours => hours > 0).length;

      return {
        type: 'individual' as const,
        schedule,
        totalHours,
        workingDays,
        avgHoursPerWorkingDay: workingDays > 0 ? totalHours / workingDays : 0,
      };
    } else {
      // Standard 5-day week (fallback)
      const dailyHours = user.weeklyHours / 5;
      const schedule: WorkSchedule = {
        monday: dailyHours,
        tuesday: dailyHours,
        wednesday: dailyHours,
        thursday: dailyHours,
        friday: dailyHours,
        saturday: 0,
        sunday: 0,
      };

      return {
        type: 'standard' as const,
        schedule,
        totalHours: user.weeklyHours,
        workingDays: 5,
        avgHoursPerWorkingDay: dailyHours,
      };
    }
  }, [user.workSchedule, user.weeklyHours]);

  // Compact Mode (Dashboard Widget)
  if (mode === 'compact') {
    return (
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
              Arbeitszeitmodell
            </p>
            <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
              {scheduleData.totalHours}h/Woche
            </p>
          </div>
          <div className="bg-indigo-100 dark:bg-indigo-900/20 p-3 rounded-lg">
            <Calendar className="w-6 h-6 text-indigo-600 dark:text-indigo-400" />
          </div>
        </div>

        <div className="space-y-1">
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {scheduleData.type === 'individual' ? (
              <>
                <span className="font-medium">Individueller Plan</span>
                <br />
                {scheduleData.workingDays} Arbeitstage
              </>
            ) : (
              <>
                <span className="font-medium">Standard 5-Tage-Woche</span>
                <br />
                Mo-Fr: {scheduleData.avgHoursPerWorkingDay.toFixed(1)}h/Tag
              </>
            )}
          </p>
        </div>

        {onDetailsClick && (
          <button
            onClick={onDetailsClick}
            className="text-sm text-blue-600 dark:text-blue-400 hover:text-blue-700 dark:hover:text-blue-300 font-medium transition-colors flex items-center gap-1"
          >
            Details anzeigen →
          </button>
        )}
      </div>
    );
  }

  // Detailed Mode (Settings / Modal)
  const maxHours = Math.max(...Object.values(scheduleData.schedule), 8);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
            {scheduleData.type === 'individual' ? 'Individueller Wochenplan' : 'Standard-Arbeitswoche'}
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            {scheduleData.type === 'individual'
              ? 'Deine Arbeitsstunden sind individuell auf die Wochentage verteilt'
              : 'Gleichmäßige Verteilung auf 5 Arbeitstage (Mo-Fr)'
            }
          </p>
        </div>
        <div className="text-right">
          <p className="text-sm text-gray-600 dark:text-gray-400">Gesamt</p>
          <p className="text-3xl font-bold text-blue-600 dark:text-blue-400">
            {scheduleData.totalHours}h
          </p>
        </div>
      </div>

      {/* Weekly Schedule Table + Chart */}
      <div className="bg-gray-50 dark:bg-gray-800 rounded-lg p-4 space-y-3">
        {(Object.keys(DAY_LABELS) as Array<keyof WorkSchedule>).map((day) => {
          const hours = scheduleData.schedule[day];
          const isWorkingDay = hours > 0;
          const barWidth = maxHours > 0 ? (hours / maxHours) * 100 : 0;

          return (
            <div key={day} className="space-y-1">
              {/* Day Label + Hours */}
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-gray-700 dark:text-gray-300 w-24">
                  {DAY_LABELS_FULL[day]}
                </span>
                <span className={`font-bold ${
                  isWorkingDay
                    ? 'text-blue-600 dark:text-blue-400'
                    : 'text-gray-400 dark:text-gray-600'
                }`}>
                  {hours.toFixed(1)}h
                </span>
              </div>

              {/* Progress Bar */}
              <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
                <div
                  className={`h-full rounded-full transition-all ${
                    isWorkingDay
                      ? 'bg-blue-600 dark:bg-blue-500'
                      : 'bg-gray-300 dark:bg-gray-600'
                  }`}
                  style={{ width: `${barWidth}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {/* Summary Stats */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4 border border-blue-200 dark:border-blue-800">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-blue-600 dark:text-blue-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Arbeitstage
            </span>
          </div>
          <p className="text-2xl font-bold text-blue-600 dark:text-blue-400">
            {scheduleData.workingDays}
          </p>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-900/20 rounded-lg p-4 border border-indigo-200 dark:border-indigo-800">
          <div className="flex items-center gap-2 mb-2">
            <Clock className="w-4 h-4 text-indigo-600 dark:text-indigo-400" />
            <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
              Ø pro Arbeitstag
            </span>
          </div>
          <p className="text-2xl font-bold text-indigo-600 dark:text-indigo-400">
            {scheduleData.avgHoursPerWorkingDay.toFixed(1)}h
          </p>
        </div>
      </div>

      {/* Info Box - Overtime Calculation */}
      <div className="bg-amber-50 dark:bg-amber-900/20 rounded-lg p-4 border border-amber-200 dark:border-amber-800">
        <div className="flex gap-3">
          <Info className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0 mt-0.5" />
          <div className="space-y-2">
            <p className="text-sm font-medium text-gray-900 dark:text-white">
              Überstunden-Berechnung
            </p>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              Deine Überstunden werden basierend auf diesem Arbeitszeitmodell berechnet:
            </p>
            <div className="text-sm text-gray-600 dark:text-gray-400 space-y-1">
              <p>• <strong>Soll-Stunden:</strong> {scheduleData.totalHours}h pro Woche ({scheduleData.avgHoursPerWorkingDay.toFixed(1)}h pro Arbeitstag)</p>
              <p>• <strong>Ist-Stunden:</strong> Deine erfassten Arbeitszeiten + Abwesenheitsgutschriften</p>
              <p>• <strong>Überstunden:</strong> Ist-Stunden - Soll-Stunden</p>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-500 mt-2">
              ℹ️ Feiertage und Wochenenden werden automatisch berücksichtigt
            </p>
          </div>
        </div>
      </div>

      {/* Admin Note */}
      {scheduleData.type === 'standard' && (
        <p className="text-xs text-gray-500 dark:text-gray-400 text-center">
          💡 Bei Teilzeit oder ungleicher Stundenverteilung kann ein Administrator einen individuellen Wochenplan einrichten
        </p>
      )}
    </div>
  );
}
