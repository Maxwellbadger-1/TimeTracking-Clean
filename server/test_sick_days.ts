import { getUserOvertimeReport } from './src/services/reportService.js';

async function test() {
  console.log('Checking sick days (18-19 Dec) calculation...\n');

  const report = await getUserOvertimeReport(155, 2025, 12);

  // Get the sick days
  const sickDays = report.breakdown.daily.filter(d =>
    d.date === '2025-12-18' || d.date === '2025-12-19'
  );

  console.log('Sick Days (18-19 Dec):');
  sickDays.forEach(day => {
    console.log(`  ${day.date}: target=${day.target}h, actual=${day.actual}h, overtime=${day.overtime}h`);
  });

  const totalSickTarget = sickDays.reduce((sum, d) => sum + d.target, 0);
  const totalSickActual = sickDays.reduce((sum, d) => sum + d.actual, 0);

  console.log(`\nSick Days Total:`);
  console.log(`  Target: ${totalSickTarget}h`);
  console.log(`  Actual: ${totalSickActual}h (should match target for sick days)`);
  console.log(`  Match: ${totalSickTarget === totalSickActual ? 'YES ✅' : 'NO ❌'}`);

  // Check overtime_comp days (Saturdays 20, 27 Dec)
  const overtimeCompDays = report.breakdown.daily.filter(d =>
    d.date === '2025-12-20' || d.date === '2025-12-27'
  );

  console.log(`\nOvertime Comp Days (20, 27 Dec - Saturdays):`);
  overtimeCompDays.forEach(day => {
    console.log(`  ${day.date}: target=${day.target}h, actual=${day.actual}h`);
  });

  const totalOvertimeCompTarget = overtimeCompDays.reduce((sum, d) => sum + d.target, 0);
  console.log(`\nOvertime Comp Total Target: ${totalOvertimeCompTarget}h (should be 0h for Saturdays)`);
  console.log(`  Correct: ${totalOvertimeCompTarget === 0 ? 'YES ✅' : 'NO ❌'}`);
}

test();
