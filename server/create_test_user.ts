import Database from 'better-sqlite3';

const db = new Database('database/development.db');
db.pragma('journal_mode = WAL');

console.log('🔨 Creating complex test user scenario...\n');

// 1. CREATE TEST USER
const insertUser = db.prepare(`
  INSERT INTO users (username, email, password, firstName, lastName, role, department, weeklyHours, workSchedule, hireDate, status)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'active')
`);

const workSchedule = {
  monday: 4,
  tuesday: 4,
  wednesday: 0,
  thursday: 0,
  friday: 0,
  saturday: 0,
  sunday: 0,
};

const result = insertUser.run(
  'test.user',
  'test.user@example.com',
  '$2b$10$dummy.hash.for.testing',
  'Test',
  'User',
  'employee',
  'IT',
  8, // weeklyHours (IGNORED wenn workSchedule existiert!)
  JSON.stringify(workSchedule),
  '2025-07-01' // hire date
);

const userId = result.lastInsertRowid as number;
console.log(`✅ User created: ID=${userId}, Name: Test User`);
console.log(`   Work Schedule: Mo=4h, Tu=4h, rest=0h (8h/week)`);
console.log(`   Hire Date: 2025-07-01\n`);

// 2. CREATE ABSENCE REQUESTS (all approved)
const insertAbsence = db.prepare(`
  INSERT INTO absence_requests (userId, type, startDate, endDate, days, reason, status, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, 'approved', datetime('now'))
`);

// Krankheit: 07.07-08.07.2025 (Montag + Dienstag = 8h credit)
insertAbsence.run(userId, 'sick', '2025-07-07', '2025-07-08', 2, 'Grippe');
console.log(`✅ Sick leave: 07.07-08.07.2025 (Mon-Tue, 8h credit expected)`);

// Urlaub: 14.07-15.07.2025 (Montag + Dienstag = 8h credit)
insertAbsence.run(userId, 'vacation', '2025-07-14', '2025-07-15', 2, 'Sommerurlaub');
console.log(`✅ Vacation: 14.07-15.07.2025 (Mon-Tue, 8h credit expected)`);

// Überstundenausgleich: 28.07.2025 (Montag = 4h credit)
insertAbsence.run(userId, 'overtime_comp', '2025-07-28', '2025-07-28', 1, 'Überstunden abbummeln');
console.log(`✅ Overtime comp: 28.07.2025 (Mon, 4h credit expected)`);

// Unbezahlter Urlaub: 11.08-12.08.2025 (Montag + Dienstag = REDUZIERT Soll um 8h!)
insertAbsence.run(userId, 'unpaid', '2025-08-11', '2025-08-12', 2, 'Privat');
console.log(`✅ Unpaid leave: 11.08-12.08.2025 (Mon-Tue, REDUCES target by 8h!)\n`);

// 3. CREATE TIME ENTRIES
const insertTimeEntry = db.prepare(`
  INSERT INTO time_entries (userId, date, startTime, endTime, breakMinutes, hours, activity, project, location, notes, createdAt)
  VALUES (?, ?, ?, ?, 0, ?, ?, ?, 'office', ?, datetime('now'))
`);

// Normale Arbeitstage (Juli-Dezember 2025)
const workDays = [
  { date: '2025-07-01', hours: 4, desc: 'Projekt Setup', start: '08:00', end: '12:00' }, // Dienstag
  { date: '2025-07-21', hours: 4, desc: 'Development', start: '08:00', end: '12:00' }, // Montag
  { date: '2025-07-22', hours: 4, desc: 'Testing', start: '08:00', end: '12:00' }, // Dienstag
  { date: '2025-07-29', hours: 5, desc: 'Überstunde!', start: '08:00', end: '13:00' }, // Dienstag (1h Überstunde!)
  { date: '2025-08-04', hours: 4, desc: 'Meetings', start: '08:00', end: '12:00' }, // Montag
  { date: '2025-08-05', hours: 4, desc: 'Code Review', start: '08:00', end: '12:00' }, // Dienstag
  // 11.08 + 12.08 = Unbezahlter Urlaub (keine Einträge)
  { date: '2025-08-18', hours: 4, desc: 'Sprint Planning', start: '08:00', end: '12:00' }, // Montag
  { date: '2025-08-19', hours: 4, desc: 'Implementation', start: '08:00', end: '12:00' }, // Dienstag
];

console.log(`📝 Time Entries:`);
let totalWorkedHours = 0;
workDays.forEach(({ date, hours, desc, start, end }) => {
  insertTimeEntry.run(userId, date, start, end, hours, 'Development', 'Internal', desc);
  totalWorkedHours += hours;
  console.log(`   ${date}: ${hours}h - ${desc}`);
});
console.log(`   TOTAL WORKED: ${totalWorkedHours}h\n`);

// 4. VACATION BALANCE - Skipped (not needed for overtime calculation)

console.log('='
.repeat(80));
console.log('🎯 TEST USER SUMMARY');
console.log('='.repeat(80));
console.log(`User ID: ${userId}`);
console.log(`Email: test.user@example.com`);
console.log(`Work Schedule: Mo=4h, Tu=4h (only 2 days/week!)`);
console.log(`Hire Date: 2025-07-01`);
console.log(`\nAbsences:`);
console.log(`  - Sick: 07.07-08.07 (Mon-Tue)`);
console.log(`  - Vacation: 14.07-15.07 (Mon-Tue)`);
console.log(`  - Overtime Comp: 28.07 (Mon)`);
console.log(`  - Unpaid: 11.08-12.08 (Mon-Tue)`);
console.log(`\nTime Entries: ${workDays.length} entries, ${totalWorkedHours}h total`);
console.log('='.repeat(80));
console.log(`\n🔍 Run validation: npm run validate:overtime:detailed -- --userId=${userId} --month=2025-07`);
console.log(`🔍 Or for full period: npm run validate:overtime -- --userId=${userId}`);

db.close();
