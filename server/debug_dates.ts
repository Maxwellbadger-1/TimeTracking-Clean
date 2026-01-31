import { getUserOvertimeReport } from './src/services/reportService.js';

const report = getUserOvertimeReport(155, 2025);

console.log('\n=== DAILY BREAKDOWN FOR DECEMBER 2025 ===\n');
console.log('Date       | Target | Actual | Overtime');
console.log('-----------|--------|--------|----------');

report.breakdown.daily.forEach(day => {
  const date = day.date.padEnd(10);
  const target = String(day.target).padEnd(6);
  const actual = String(day.actual).padEnd(6);
  const overtime = String(day.overtime).padEnd(9);
  console.log(`${date} | ${target} | ${actual} | ${overtime}`);
});

console.log('\n=== SUMMARY ===');
console.log(`Total Days: ${report.breakdown.daily.length}`);
console.log(`Total Target: ${report.summary.targetHours}h`);
console.log(`Total Actual: ${report.summary.actualHours}h`);
console.log(`Total Overtime: ${report.summary.overtime}h`);

// Count working days
const workDays = report.breakdown.daily.filter(d => d.target > 0);
console.log(`\nWorking Days (target > 0): ${workDays.length}`);
console.log(`Expected: 21 days (Mon-Thu Dec 2025, but no Fri)`);
