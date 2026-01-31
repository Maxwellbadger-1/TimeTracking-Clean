import { getUserOvertimeReport } from './src/services/reportService.js';

async function test() {
  console.log('Testing daily dates for User 155, December 2025...\n');

  const report = await getUserOvertimeReport(155, 2025, 12);

  console.log('FIRST 5 days:');
  report.breakdown.daily.slice(0, 5).forEach(day => {
    console.log(`  ${day.date}: target=${day.target}h, actual=${day.actual}h`);
  });

  console.log('\nLAST 5 days:');
  const lastFive = report.breakdown.daily.slice(-5);
  lastFive.forEach(day => {
    console.log(`  ${day.date}: target=${day.target}h, actual=${day.actual}h`);
  });

  const totalDays = report.breakdown.daily.length;
  const lastDate = report.breakdown.daily[totalDays - 1].date;

  console.log(`\nTotal days: ${totalDays}`);
  console.log(`Last date: ${lastDate}`);
  console.log(`Expected: 2025-12-31`);
  console.log(`Match: ${lastDate === '2025-12-31' ? 'YES ✅' : 'NO ❌'}`);
}

test();
