import { getUserOvertimeReport } from './src/services/reportService.js';

async function test() {
  console.log('Testing getUserOvertimeReport for User 155, December 2025...\n');
  
  const report = await getUserOvertimeReport(155, 2025, 12);
  
  console.log('REPORT RESULT:');
  console.log('Summary:', report.summary);
  console.log('\nDaily breakdown (first 5 days):');
  report.breakdown.daily.slice(0, 5).forEach(day => {
    console.log(`  ${day.date}: target=${day.target}h, actual=${day.actual}h, overtime=${day.overtime}h`);
  });
  
  console.log(`\nTotal days calculated: ${report.breakdown.daily.length}`);
  console.log('\nDays with absence (18-19 Dec):');
  const absenceDays = report.breakdown.daily.filter(d => d.date >= '2025-12-18' && d.date <= '2025-12-19');
  absenceDays.forEach(day => {
    console.log(`  ${day.date}: target=${day.target}h, actual=${day.actual}h`);
  });
}

test().catch(console.error);
