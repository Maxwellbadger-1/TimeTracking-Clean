/**
 * Calendar Legend Component
 *
 * Shows color coding for different event types
 * Modern, minimal design with pills
 */

export function CalendarLegend() {
  const items = [
    { label: 'Arbeit', color: 'bg-blue-500' },
    { label: 'Urlaub', color: 'bg-green-500' },
    { label: 'Krank', color: 'bg-red-500' },
    { label: 'Überstunden-Ausgleich', color: 'bg-purple-500' },
    { label: 'Feiertag', color: 'bg-gray-400' },
  ];

  return (
    <div className="flex flex-wrap items-center gap-4 text-sm">
      {items.map((item) => (
        <div key={item.label} className="flex items-center space-x-2">
          <div className={`w-3 h-3 rounded-full ${item.color}`} />
          <span className="text-gray-600 dark:text-gray-400">{item.label}</span>
        </div>
      ))}
    </div>
  );
}
