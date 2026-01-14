import { createAbsenceRequest, approveAbsenceRequest } from './src/services/absenceService.js';
import { db } from './src/database/connection.js';

console.log('Creating overtime_comp absence for 02.01.2026...');
const absence = await createAbsenceRequest({
  userId: 47,
  type: 'overtime_comp',
  startDate: '2026-01-02',
  endDate: '2026-01-02',
  reason: 'Test',
  daysRequired: 0.5
});
console.log('Created absence ID:', absence.id);

console.log('\nApproving absence...');
try {
  const approved = await approveAbsenceRequest(absence.id, 1, 'OK');
  console.log('Approved!');
  
  const comp = db.prepare('SELECT * FROM overtime_transactions WHERE userId = 47 AND type = "compensation"').get();
  console.log('\nCompensation transaction:', comp);
} catch (error: any) {
  console.error('ERROR:', error.message);
}
