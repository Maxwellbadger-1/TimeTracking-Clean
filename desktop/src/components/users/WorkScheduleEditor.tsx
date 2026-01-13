import { useState, useEffect } from 'react';
import type { WorkSchedule } from '../../types';

interface WorkScheduleEditorProps {
  value: WorkSchedule | null;
  weeklyHours: number;
  onChange: (schedule: WorkSchedule | null) => void;
}

const DEFAULT_WORK_SCHEDULE: WorkSchedule = {
  monday: 8,
  tuesday: 8,
  wednesday: 8,
  thursday: 8,
  friday: 8,
  saturday: 0,
  sunday: 0,
};

const DAY_LABELS: Record<keyof WorkSchedule, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

export function WorkScheduleEditor({ value, weeklyHours, onChange }: WorkScheduleEditorProps) {
  const [useIndividualSchedule, setUseIndividualSchedule] = useState(!!value);
  const [schedule, setSchedule] = useState<WorkSchedule>(
    value || DEFAULT_WORK_SCHEDULE
  );

  // Calculate total weekly hours from schedule
  const totalHours = Object.values(schedule).reduce((sum, hours) => sum + hours, 0);

  // Handle toggle between standard and individual schedule
  const handleToggle = (enabled: boolean) => {
    setUseIndividualSchedule(enabled);
    if (enabled) {
      // Generate schedule from weeklyHours (distribute evenly Mo-Fr)
      const dailyHours = Math.round((weeklyHours / 5) * 100) / 100;
      const newSchedule: WorkSchedule = {
        monday: dailyHours,
        tuesday: dailyHours,
        wednesday: dailyHours,
        thursday: dailyHours,
        friday: dailyHours,
        saturday: 0,
        sunday: 0,
      };
      setSchedule(newSchedule);
      onChange(newSchedule);
    } else {
      onChange(null);
    }
  };

  // Handle day hours change
  const handleDayChange = (day: keyof WorkSchedule, hours: number) => {
    const newSchedule = { ...schedule, [day]: hours };
    setSchedule(newSchedule);
    onChange(newSchedule);
  };

  // Sync with external value changes
  useEffect(() => {
    if (value) {
      setSchedule(value);
      setUseIndividualSchedule(true);
    } else {
      setUseIndividualSchedule(false);
    }
  }, [value]);

  return (
    <div className="space-y-4">
      {/* Toggle */}
      <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
        <div>
          <label className="text-sm font-medium text-gray-900 dark:text-gray-100">
            Individueller Wochenplan
          </label>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Für Teilzeit mit ungleicher Stundenverteilung (z.B. Mo 8h, Fr 2h)
          </p>
        </div>
        <button
          type="button"
          onClick={() => handleToggle(!useIndividualSchedule)}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            useIndividualSchedule
              ? 'bg-blue-600'
              : 'bg-gray-200 dark:bg-gray-700'
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              useIndividualSchedule ? 'translate-x-6' : 'translate-x-1'
            }`}
          />
        </button>
      </div>

      {/* Individual Schedule Editor */}
      {useIndividualSchedule && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            {(Object.keys(DAY_LABELS) as Array<keyof WorkSchedule>).map((day) => (
              <div
                key={day}
                className={`flex items-center justify-between p-3 rounded-lg border ${
                  schedule[day] > 0
                    ? 'border-blue-300 bg-blue-50 dark:border-blue-700 dark:bg-blue-900/20'
                    : 'border-gray-200 bg-gray-50 dark:border-gray-700 dark:bg-gray-800'
                }`}
              >
                <label
                  htmlFor={`schedule-${day}`}
                  className="text-sm font-medium text-gray-700 dark:text-gray-300"
                >
                  {DAY_LABELS[day]}
                </label>
                <div className="flex items-center space-x-2">
                  <input
                    id={`schedule-${day}`}
                    type="number"
                    min="0"
                    max="24"
                    step="0.5"
                    value={schedule[day]}
                    onChange={(e) =>
                      handleDayChange(day, parseFloat(e.target.value) || 0)
                    }
                    className="w-20 px-2 py-1 text-sm text-right border border-gray-300 dark:border-gray-600 rounded bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  />
                  <span className="text-sm text-gray-500 dark:text-gray-400">h</span>
                </div>
              </div>
            ))}
          </div>

          {/* Summary */}
          <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg border border-blue-200 dark:border-blue-800">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                Wochenstunden gesamt:
              </span>
              <span className={`text-lg font-bold ${
                Math.abs(totalHours - weeklyHours) < 0.1
                  ? 'text-green-600 dark:text-green-400'
                  : 'text-orange-600 dark:text-orange-400'
              }`}>
                {totalHours.toFixed(1)}h
              </span>
            </div>
            {Math.abs(totalHours - weeklyHours) >= 0.1 && (
              <p className="text-xs text-orange-600 dark:text-orange-400 mt-2">
                ⚠️ Summe weicht von Wochenstunden ({weeklyHours}h) ab!
              </p>
            )}
          </div>

          {/* Examples */}
          <div className="p-3 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-2">
              💡 Beispiele:
            </p>
            <ul className="text-xs text-gray-600 dark:text-gray-400 space-y-1">
              <li>• Teilzeit: Mo 8h, Fr 2h = 10h/Woche</li>
              <li>• 4-Tage-Woche: Mo-Do je 10h = 40h/Woche</li>
              <li>• Einzelhandel: Mo-Fr 8h, Sa 4h = 44h/Woche</li>
            </ul>
          </div>
        </div>
      )}

      {/* Fallback Info */}
      {!useIndividualSchedule && (
        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Standard 5-Tage-Woche:{' '}
            <span className="font-medium text-gray-900 dark:text-gray-100">
              {weeklyHours}h ÷ 5 Arbeitstage = {(weeklyHours / 5).toFixed(2)}h/Tag
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
