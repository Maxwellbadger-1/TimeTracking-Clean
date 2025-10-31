/**
 * Seed German Public Holidays for 2025
 *
 * Run with: tsx server/src/scripts/seedHolidays.ts
 */

import { db } from '../database/connection.js';

const holidays2025 = [
  { name: 'Neujahr', date: '2025-01-01', federal: 1 },
  { name: 'Karfreitag', date: '2025-04-18', federal: 1 },
  { name: 'Ostermontag', date: '2025-04-21', federal: 1 },
  { name: 'Tag der Arbeit', date: '2025-05-01', federal: 1 },
  { name: 'Christi Himmelfahrt', date: '2025-05-29', federal: 1 },
  { name: 'Pfingstmontag', date: '2025-06-09', federal: 1 },
  { name: 'Tag der Deutschen Einheit', date: '2025-10-03', federal: 1 },
  { name: '1. Weihnachtstag', date: '2025-12-25', federal: 1 },
  { name: '2. Weihnachtstag', date: '2025-12-26', federal: 1 },
];

const holidays2024 = [
  { name: 'Neujahr', date: '2024-01-01', federal: 1 },
  { name: 'Karfreitag', date: '2024-03-29', federal: 1 },
  { name: 'Ostermontag', date: '2024-04-01', federal: 1 },
  { name: 'Tag der Arbeit', date: '2024-05-01', federal: 1 },
  { name: 'Christi Himmelfahrt', date: '2024-05-09', federal: 1 },
  { name: 'Pfingstmontag', date: '2024-05-20', federal: 1 },
  { name: 'Tag der Deutschen Einheit', date: '2024-10-03', federal: 1 },
  { name: '1. Weihnachtstag', date: '2024-12-25', federal: 1 },
  { name: '2. Weihnachtstag', date: '2024-12-26', federal: 1 },
];

function seedHolidays() {
  console.log('🌴 Seeding holidays...');

  try {
    // Clear existing holidays
    db.prepare('DELETE FROM holidays').run();
    console.log('✅ Cleared existing holidays');

    // Insert 2024 holidays
    const insert = db.prepare(`
      INSERT INTO holidays (name, date, federal)
      VALUES (?, ?, ?)
    `);

    holidays2024.forEach((holiday) => {
      insert.run(holiday.name, holiday.date, holiday.federal);
    });
    console.log(`✅ Inserted ${holidays2024.length} holidays for 2024`);

    // Insert 2025 holidays
    holidays2025.forEach((holiday) => {
      insert.run(holiday.name, holiday.date, holiday.federal);
    });
    console.log(`✅ Inserted ${holidays2025.length} holidays for 2025`);

    console.log('🎉 Holiday seeding complete!');

    // Display seeded holidays
    const all = db.prepare('SELECT * FROM holidays ORDER BY date').all();
    console.log('\n📅 All holidays in database:');
    console.table(all);
  } catch (error) {
    console.error('❌ Error seeding holidays:', error);
    throw error;
  }
}

// Run if called directly
if (import.meta.url === `file://${process.argv[1]}`) {
  seedHolidays();
  process.exit(0);
}

export { seedHolidays };
