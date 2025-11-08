import db from '../database/connection.js';

/**
 * Feiertage Bayern 2025
 * Quelle: https://www.ferienwiki.de/feiertage/de/bayern/2025
 */
const bavarianHolidays2025 = [
  { date: '2025-01-01', name: 'Neujahr' },
  { date: '2025-01-06', name: 'Heilige Drei Könige' },
  { date: '2025-04-18', name: 'Karfreitag' },
  { date: '2025-04-21', name: 'Ostermontag' },
  { date: '2025-05-01', name: 'Tag der Arbeit' },
  { date: '2025-05-29', name: 'Christi Himmelfahrt' },
  { date: '2025-06-09', name: 'Pfingstmontag' },
  { date: '2025-06-19', name: 'Fronleichnam' },
  { date: '2025-08-15', name: 'Mariä Himmelfahrt' },
  { date: '2025-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2025-11-01', name: 'Allerheiligen' },
  { date: '2025-12-25', name: '1. Weihnachtstag' },
  { date: '2025-12-26', name: '2. Weihnachtstag' },
];

/**
 * Feiertage Bayern 2026
 */
const bavarianHolidays2026 = [
  { date: '2026-01-01', name: 'Neujahr' },
  { date: '2026-01-06', name: 'Heilige Drei Könige' },
  { date: '2026-04-03', name: 'Karfreitag' },
  { date: '2026-04-06', name: 'Ostermontag' },
  { date: '2026-05-01', name: 'Tag der Arbeit' },
  { date: '2026-05-14', name: 'Christi Himmelfahrt' },
  { date: '2026-05-25', name: 'Pfingstmontag' },
  { date: '2026-06-04', name: 'Fronleichnam' },
  { date: '2026-08-15', name: 'Mariä Himmelfahrt' },
  { date: '2026-10-03', name: 'Tag der Deutschen Einheit' },
  { date: '2026-11-01', name: 'Allerheiligen' },
  { date: '2026-12-25', name: '1. Weihnachtstag' },
  { date: '2026-12-26', name: '2. Weihnachtstag' },
];

function addBavarianHolidays() {
  console.log('🎄 Adding Bavarian holidays to database...');

  // federal: 0 = Bayern-spezifisch, 1 = Bundesweit
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO holidays (date, name, federal)
    VALUES (?, ?, ?)
  `);

  let count = 0;

  // Add 2025 holidays
  for (const holiday of bavarianHolidays2025) {
    const isFederal = ['Neujahr', 'Karfreitag', 'Ostermontag', 'Tag der Arbeit',
                       'Christi Himmelfahrt', 'Pfingstmontag', 'Tag der Deutschen Einheit',
                       '1. Weihnachtstag', '2. Weihnachtstag'].includes(holiday.name) ? 1 : 0;
    stmt.run(holiday.date, holiday.name, isFederal);
    count++;
    console.log(`✅ Added: ${holiday.date} - ${holiday.name} (federal: ${isFederal})`);
  }

  // Add 2026 holidays
  for (const holiday of bavarianHolidays2026) {
    const isFederal = ['Neujahr', 'Karfreitag', 'Ostermontag', 'Tag der Arbeit',
                       'Christi Himmelfahrt', 'Pfingstmontag', 'Tag der Deutschen Einheit',
                       '1. Weihnachtstag', '2. Weihnachtstag'].includes(holiday.name) ? 1 : 0;
    stmt.run(holiday.date, holiday.name, isFederal);
    count++;
    console.log(`✅ Added: ${holiday.date} - ${holiday.name} (federal: ${isFederal})`);
  }

  console.log(`\n🎉 Successfully added ${count} Bavarian holidays!`);
}

// Run the script
addBavarianHolidays();
