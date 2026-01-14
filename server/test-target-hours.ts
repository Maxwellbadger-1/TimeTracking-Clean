import { db } from './src/database/connection.js';
import { getDailyTargetHours } from './src/utils/workingDays.js';
import { getUserById } from './src/services/userService.js';

const user = getUserById(47);
if (!user) {
  console.log('User not found!');
  process.exit(1);
}

console.log('User:', user.firstName, user.lastName);
console.log('WorkSchedule:', user.workSchedule);

const dates = ['2026-01-01', '2026-01-02', '2026-01-08', '2026-01-09', '2026-01-14'];

for (const date of dates) {
  const targetHours = getDailyTargetHours(user, date);
  console.log(date + ' → ' + targetHours + 'h target');
}
