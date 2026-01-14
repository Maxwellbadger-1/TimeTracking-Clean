import { approveAbsenceRequest } from './src/services/absenceService.js';
import { getOvertimeBalance } from './src/services/overtimeTransactionService.js';

try {
  const absenceId = 21; // New absence from SQL
  console.log('Approving absence ID', absenceId);
  await approveAbsenceRequest(absenceId, 1, 'Final test');
  console.log('✅ Approved!');
  
  const balance = getOvertimeBalance(47);
  console.log('\n💰 Final balance:', balance + 'h');
  console.log('🎯 Expected:', '-1.00h');
  console.log('✅ Match:', Math.abs(balance - (-1.0)) < 0.01 ? 'YES!' : 'NO');
} catch (error: any) {
  console.error('❌ ERROR:', error.message);
}
