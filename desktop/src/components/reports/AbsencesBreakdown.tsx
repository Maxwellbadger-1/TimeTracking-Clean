import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useAbsenceRequests } from '../../hooks/useAbsenceRequests';
import { Calendar, Umbrella, HeartPulse, Ban, Clock, AlertCircle } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';

interface AbsencesBreakdownProps {
  userId: number;
  year?: number;   // Optional: filter by specific year
  month?: number;  // Optional: filter by specific month (1-12)
}

/**
 * Absences Breakdown Component
 *
 * Shows how absences affect overtime balance:
 * - Urlaub (Vacation): Full credit (targetHours)
 * - Krankheit (Sick): Full credit (targetHours)
 * - Überstunden-Ausgleich (Overtime Comp): Full credit (targetHours)
 * - Unbezahlter Urlaub (Unpaid Leave): NO credit, reduces target hours
 *
 * Displays days + hours credited per absence type
 */
export function AbsencesBreakdown({ userId, year, month }: AbsencesBreakdownProps) {
  const currentYear = year || new Date().getFullYear();

  // ✅ PERFORMANCE: Fetch ONLY this user's approved absences (filtered on backend!)
  const { data: absences, isLoading, error } = useAbsenceRequests({
    userId,
    status: 'approved',
    year: currentYear,
    // ✅ Pass month filter to backend if specified
    ...(month && { month }),
  });

  // 🔍 DEBUG: Log absences data
  console.log('📊 AbsencesBreakdown - Loaded absences:', absences?.length || 0);
  console.log('📊 First absence:', absences?.[0]);
  if (absences?.[0]) {
    console.log('📊 Has calculatedHours?', absences[0].calculatedHours !== undefined);
    console.log('📊 calculatedHours value:', absences[0].calculatedHours);
    console.log('📊 days value:', absences[0].days);
  }

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Abwesenheiten Breakdown
          </h3>
        </div>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Abwesenheiten Breakdown
          </h3>
        </div>
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Fehler beim Laden: {error.message}</p>
        </div>
      </Card>
    );
  }

  // ✅ Backend already filtered by userId, status='approved', year (and month if specified)
  // No need for frontend filtering anymore!
  const userAbsences = absences || [];

  // Group by type and calculate totals
  const breakdown = userAbsences.reduce(
    (acc, absence) => {
      const type = absence.type;
      const days = absence.days;

      // ✅ Use REAL calculated hours from backend (Single Source of Truth!)
      // Backend calculates based on workSchedule/weeklyHours + excludes holidays
      let hours: number;

      if (absence.calculatedHours !== undefined && absence.calculatedHours !== null) {
        // ✅ Backend calculated real hours
        hours = absence.calculatedHours;
      } else {
        // ⚠️ FALLBACK: calculatedHours missing (should not happen with current backend!)
        console.warn(`⚠️ Absence ${absence.id} missing calculatedHours! Using fallback: days * 8h`);
        hours = days * 8; // Fallback estimate
      }

      if (!acc[type]) {
        acc[type] = { days: 0, hours: 0, count: 0 };
      }

      acc[type].days += days;
      acc[type].hours += hours;
      acc[type].count += 1;

      return acc;
    },
    {} as Record<
      string,
      {
        days: number;
        hours: number;
        count: number;
      }
    >
  );

  // Absence type configuration
  const absenceTypes = [
    {
      key: 'vacation',
      label: 'Urlaub',
      icon: Umbrella,
      color: 'blue',
      credit: true,
      description: 'Volle Gutschrift (Soll-Stunden)',
    },
    {
      key: 'sick',
      label: 'Krankheit',
      icon: HeartPulse,
      color: 'red',
      credit: true,
      description: 'Volle Gutschrift (Soll-Stunden)',
    },
    {
      key: 'overtime_comp',
      label: 'Überstunden-Ausgleich',
      icon: Clock,
      color: 'orange',
      credit: true,
      description: 'Volle Gutschrift (Soll-Stunden)',
    },
    {
      key: 'unpaid',
      label: 'Unbezahlter Urlaub',
      icon: Ban,
      color: 'gray',
      credit: false,
      description: 'KEINE Gutschrift, reduziert Soll',
    },
  ];

  // Get color classes for each type
  const getColorClasses = (color: string, credit: boolean) => {
    if (!credit) {
      return {
        bg: 'bg-gray-100 dark:bg-gray-800',
        text: 'text-gray-700 dark:text-gray-300',
        icon: 'text-gray-600 dark:text-gray-400',
      };
    }

    switch (color) {
      case 'blue':
        return {
          bg: 'bg-blue-50 dark:bg-blue-900/20',
          text: 'text-blue-700 dark:text-blue-300',
          icon: 'text-blue-600 dark:text-blue-400',
        };
      case 'red':
        return {
          bg: 'bg-red-50 dark:bg-red-900/20',
          text: 'text-red-700 dark:text-red-300',
          icon: 'text-red-600 dark:text-red-400',
        };
      case 'orange':
        return {
          bg: 'bg-orange-50 dark:bg-orange-900/20',
          text: 'text-orange-700 dark:text-orange-300',
          icon: 'text-orange-600 dark:text-orange-400',
        };
      default:
        return {
          bg: 'bg-gray-50 dark:bg-gray-800',
          text: 'text-gray-700 dark:text-gray-300',
          icon: 'text-gray-600 dark:text-gray-400',
        };
    }
  };

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Calendar className="w-5 h-5 text-green-600 dark:text-green-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Abwesenheiten Breakdown
          </h3>
        </div>
        <div className="text-sm text-gray-500 dark:text-gray-400">
          {year && month
            ? new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
            : year || currentYear}
        </div>
      </div>

      {/* Absence Type Cards */}
      {userAbsences.length === 0 ? (
        <p className="text-center text-gray-500 dark:text-gray-400 py-8">
          Keine genehmigten Abwesenheiten für{' '}
          {year && month
            ? new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })
            : year || currentYear}
        </p>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {absenceTypes.map(type => {
            const data = breakdown[type.key];
            const colors = getColorClasses(type.color, type.credit);
            const Icon = type.icon;

            if (!data) return null; // Skip if no absences of this type

            return (
              <div
                key={type.key}
                className={`${colors.bg} rounded-lg p-4 border border-gray-200 dark:border-gray-700`}
              >
                {/* Header */}
                <div className="flex items-center gap-2 mb-3">
                  <Icon className={`w-5 h-5 ${colors.icon}`} />
                  <h4 className={`font-semibold ${colors.text}`}>{type.label}</h4>
                  <span className="ml-auto text-xs bg-white dark:bg-gray-900/50 px-2 py-0.5 rounded-full text-gray-600 dark:text-gray-400">
                    {data.count}× verwendet
                  </span>
                </div>

                {/* Stats */}
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Tage</p>
                    <p className={`text-xl font-bold ${colors.text}`}>{data.days.toFixed(1)}</p>
                  </div>
                  <div>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                      {type.credit ? 'Gutschrift' : 'Soll-Reduktion'}
                    </p>
                    <p className={`text-xl font-bold ${colors.text}`}>
                      {type.credit ? '+' : '-'}
                      {formatHours(data.hours)}
                    </p>
                  </div>
                </div>

                {/* Description */}
                <p className="text-xs text-gray-500 dark:text-gray-400 italic">{type.description}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Summary */}
      {userAbsences.length > 0 && (
        <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gesamt Abwesenheiten</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {userAbsences.length}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gesamt Tage</p>
              <p className="text-lg font-bold text-gray-900 dark:text-gray-100">
                {Object.values(breakdown)
                  .reduce((sum, b) => sum + b.days, 0)
                  .toFixed(1)}
              </p>
            </div>
            <div>
              <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">Gesamt Gutschrift</p>
              <p className="text-lg font-bold text-green-600 dark:text-green-400">
                +
                {formatHours(
                  Object.entries(breakdown)
                    .filter(([key]) => key !== 'unpaid') // Exclude unpaid leave
                    .reduce((sum, [, b]) => sum + b.hours, 0)
                )}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Note */}
      <div className="mt-4 p-3 bg-green-50 dark:bg-green-900/10 rounded-lg border border-green-200 dark:border-green-800">
        <p className="text-xs text-green-700 dark:text-green-300">
          <strong>✅ Echte Stunden:</strong> Gutschriften basieren auf Ihren individuellen Soll-Stunden
          (workSchedule / weeklyHours) und berücksichtigen Feiertage automatisch.
        </p>
      </div>
    </Card>
  );
}
