// Count working days from 2025-11-01 to 2025-11-20
const holidays = ['2025-11-01']; // Allerheiligen

let workingDays = 0;
const start = new Date('2025-11-01');
const end = new Date('2025-11-20');

for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
  const dayOfWeek = d.getDay(); // 0 = Sunday, 6 = Saturday
  const dateStr = d.toISOString().split('T')[0];

  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  const isHoliday = holidays.includes(dateStr);

  if (!isWeekend && !isHoliday) {
    workingDays++;
    console.log(`✅ ${dateStr} (${['So','Mo','Di','Mi','Do','Fr','Sa'][dayOfWeek]})`);
  } else {
    const reason = isWeekend ? 'Wochenende' : 'Feiertag';
    console.log(`❌ ${dateStr} (${['So','Mo','Di','Mi','Do','Fr','Sa'][dayOfWeek]}) - ${reason}`);
  }
}

console.log('\n📊 Total working days:', workingDays);
console.log('📊 Target hours:', workingDays * 8);
