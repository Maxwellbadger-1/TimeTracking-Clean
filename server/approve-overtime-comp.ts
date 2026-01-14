import { db } from './src/database/connection.js';
import { createAbsenceRequest, approveAbsenceRequest } from './src/services/absenceService.js';

console.log('\n=== Creating Overtime Compensation Absence ===\n');

// Create absence request (02.01.2026, 0.5 days = 4h for this user's schedule)
const absence = await createAbsenceRequest({
  userId: 47,
  type: 'overtime_comp',
  startDate: '2026-01-02',
  endDate: '2026-01-02',
  reason: 'Überstunden-Ausgleich',
  daysRequired: 0.5  // Will be calculated based on workSchedule
});

console.log('Created absence:', absence);

// Approve it (this should trigger the compensation transaction)
try {
  const approved = await approveAbsenceRequest(absence.id, 1, 'Genehmigt');
  console.log('\n✅ Absence approved!');
  console.log('Approved absence:', approved);
  
  // Check if compensation transaction was created
  const compensation = db.prepare(`
    SELECT * FROM overtime_transactions
    WHERE userId = 47 AND type = 'compensation'
  `).get();
  
  if (compensation) {
    console.log('\n✅ Compensation transaction created:');
    console.log(compensation);
  } else {
    console.log('\n❌ NO compensation transaction found!');
  }
} catch (error: any) {
  console.error('\n❌ Error approving absence:', error.message);
}

console.log('\n');
