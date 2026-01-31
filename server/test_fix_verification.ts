import { getUserOvertimeReport } from './src/services/reportService.js';

// Suppress all logging
console.log = () => {};
console.info = () => {};
console.debug = () => {};
console.warn = () => {};

// Restore console.log only for our output
const originalLog = process.stdout.write.bind(process.stdout);

originalLog('\n=== VERIFICATION OF TIMEZONE FIX ===\n\n');

const report2025 = getUserOvertimeReport(155, 2025);

originalLog('📊 YEAR 2025 Result:\n');
originalLog(`Summary: ${JSON.stringify(report2025.summary, null, 2)}\n\n`);

originalLog('Expected Values (from overtime_balance DB):\n');
originalLog('  targetHours: 156h\n');
originalLog('  actualHours: 149h\n');
originalLog('  overtime: -7h\n\n');

const targetMatch = Math.abs(report2025.summary.targetHours - 156) < 0.01;
const actualMatch = Math.abs(report2025.summary.actualHours - 149) < 0.01;
const overtimeMatch = Math.abs(report2025.summary.overtime - (-7)) < 0.01;

originalLog('VERIFICATION:\n');
originalLog(`  Target Hours:  ${targetMatch ? '✅ MATCH' : '❌ MISMATCH'} (got ${report2025.summary.targetHours}h, expected 156h)\n`);
originalLog(`  Actual Hours:  ${actualMatch ? '✅ MATCH' : '❌ MISMATCH'} (got ${report2025.summary.actualHours}h, expected 149h)\n`);
originalLog(`  Overtime:      ${overtimeMatch ? '✅ MATCH' : '❌ MISMATCH'} (got ${report2025.summary.overtime}h, expected -7h)\n\n`);

if (targetMatch && actualMatch && overtimeMatch) {
  originalLog('🎉 FIX SUCCESSFUL! Frontend should now show -7h for 2025 instead of -13h.\n\n');
} else {
  originalLog('⚠️  FIX NOT COMPLETE - Still have discrepancies!\n\n');
  originalLog(`Monthly Breakdown:\n${JSON.stringify(report2025.breakdown.monthly, null, 2)}\n`);
}
