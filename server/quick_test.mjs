import { getUserOvertimeReport } from './src/services/reportService.js';

const report = getUserOvertimeReport(155, 2025);

console.log('\n=== FIX VERIFICATION ===\n');
console.log('Result:', JSON.stringify(report.summary, null, 2));
console.log('\nExpected from DB:');
console.log('  targetHours: 156');
console.log('  actualHours: 149');
console.log('  overtime: -7');
console.log('\nMatch:',
  report.summary.targetHours === 156 &&
  report.summary.actualHours === 149 &&
  report.summary.overtime === -7 ? '✅ YES' : '❌ NO'
);
