import { getCurrentDate } from '../dist/utils/timezone.js';

console.log('\n🔍 Testing getCurrentDate()\n');
console.log('='.repeat(60));

const now = getCurrentDate();
console.log('getCurrentDate() returned:');
console.log('  toString():', now.toString());
console.log('  toISOString():', now.toISOString());
console.log('  getHours():', now.getHours());
console.log('  getMinutes():', now.getMinutes());

console.log('\n✅ Expected: Midnight Berlin time (00:00)');
console.log('❌ Actual: Current time?', now.getHours() !== 0 ? 'YES - NOT MIDNIGHT!' : 'NO - is midnight');

console.log('\n' + '='.repeat(60));
