import { getUserOvertimeReport } from './src/services/reportService.js';

console.log('=== DETAILED DAILY BREAKDOWN for User 155, Dec 2025 ===\n');

const report = getUserOvertimeReport(155, 2025);

console.log('Total Summary:', report.summary);
console.log('\nMonthly Breakdown:', report.breakdown.monthly);
console.log('\nDaily Breakdown (all December):');
report.breakdown.daily.forEach(day => {
  console.log(`${day.date}: target=${day.target}h, actual=${day.actual}h, overtime=${day.overtime}h`);
});

console.log(`\nTotal days: ${report.breakdown.daily.length}`);
const totalTarget = report.breakdown.daily.reduce((sum, d) => sum + d.target, 0);
const totalActual = report.breakdown.daily.reduce((sum, d) => sum + d.actual, 0);
console.log(`Sum of daily targets: ${totalTarget}h`);
console.log(`Sum of daily actuals: ${totalActual}h`);
console.log(`Overtime: ${totalActual - totalTarget}h`);
