const dates = ['2026-01-01', '2026-01-02', '2026-01-08', '2026-01-09', '2026-01-14'];
const days = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];

for (const dateStr of dates) {
  const date = new Date(dateStr + 'T12:00:00');
  const dayOfWeek = date.getDay();
  console.log(dateStr + ' = ' + days[dayOfWeek]);
}
