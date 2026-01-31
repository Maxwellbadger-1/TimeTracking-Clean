import { ensureAbsenceTransactions } from './src/services/overtimeService.js';

async function test() {
  console.log('🔥 Testing ensureAbsenceTransactions for Christine (userId=3)...');
  await ensureAbsenceTransactions(3, '2026-01', '2026-01');
  console.log('✅ Done!');
}

test().catch(console.error);
