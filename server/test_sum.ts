import { getUserOvertimeReport } from './src/services/reportService.js';

async function main() {
  const report = await getUserOvertimeReport(155, 2025, 12);

  console.log('Days calculated:', report.breakdown.daily.length);

  let sumTarget = 0;
  let sumActual = 0;

  report.breakdown.daily.forEach(d => {
    sumTarget += d.target;
    sumActual += d.actual;
  });

  console.log('\nManual sum from daily array:');
  console.log('Target:', sumTarget, 'h');
  console.log('Actual:', sumActual, 'h');

  console.log('\nReport summary:');
  console.log('Target:', report.summary.targetHours, 'h');
  console.log('Actual:', report.summary.actualHours, 'h');

  console.log('\nDiscrepancy:');
  console.log('Target diff:', sumTarget - report.summary.targetHours, 'h');
  console.log('Actual diff:', sumActual - report.summary.actualHours, 'h');
}

main();
