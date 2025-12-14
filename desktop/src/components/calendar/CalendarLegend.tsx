/**
 * Calendar Legend Component
 *
 * Shows color coding for different event types
 * Modern, minimal design with pills
 * IMPORTANT: Colors must match getEventColor() in calendarUtils.ts!
 */

export function CalendarLegend() {
  const items = [
    {
      label: 'Arbeit',
      bgColor: 'bg-blue-100 dark:bg-blue-900/40',
      borderColor: 'border border-blue-200 dark:border-blue-800'
    },
    {
      label: 'Urlaub',
      bgColor: 'bg-green-100 dark:bg-green-900/40',
      borderColor: 'border border-green-200 dark:border-green-800'
    },
    {
      label: 'Krankmeldung',
      bgColor: 'bg-red-100 dark:bg-red-900/40',
      borderColor: 'border border-red-200 dark:border-red-800'
    },
    {
      label: 'Überstundenausgleich',
      bgColor: 'bg-purple-100 dark:bg-purple-900/40',
      borderColor: 'border border-purple-200 dark:border-purple-800'
    },
    {
      label: 'Unbezahlter Urlaub',
      bgColor: 'bg-orange-100 dark:bg-orange-900/40',
      borderColor: 'border border-orange-200 dark:border-orange-800'
    },
    {
      label: 'Feiertag',
      bgColor: 'bg-gray-200 dark:bg-gray-700',
      borderColor: 'border border-gray-300 dark:border-gray-600'
    },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-center space-x-2">
          <div className={`w-4 h-4 rounded ${item.bgColor} ${item.borderColor}`} />
          <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
