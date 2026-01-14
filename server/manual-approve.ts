import { approveAbsenceRequest } from './src/services/absenceService.js';
import { db } from './src/database/connection.js';
import { getOvertimeBalance } from './src/services/overtimeTransactionService.js';

try {
  console.log('Approving absence ID 20...');
  const approved = await approveAbsenceRequest(20, 1, 'OK');
  console.log('✅ Approved!');
  
  const comp = db.prepare("SELECT * FROM overtime_transactions WHERE userId = 47 AND type = 'compensation'").get();
  console.log('\n✅ Compensation transaction:', comp);
  
  const balance = getOvertimeBalance(47);
  console.log('\n💰 New overtime balance:', balance + 'h');
} catch (error: any) {
  console.error('❌ ERROR:', error.message);
}
