import { getCurrentMonth, getTodayString, parseDate } from '../dist/utils/timezone.js';

console.log('\n🔍 Testing timezone functions\n');
console.log('='.repeat(60));

console.log('getCurrentMonth():', getCurrentMonth());
console.log('getTodayString():', getTodayString());

const today = parseDate(getTodayString());
console.log('parseDate(getTodayString()):');
console.log('  toString():', today.toString());
console.log('  toISOString():', today.toISOString());
console.log('  Date:', today.toISOString().substring(0, 10));

console.log('\n' + '='.repeat(60));
