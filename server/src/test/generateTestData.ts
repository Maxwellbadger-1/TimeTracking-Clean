/**
 * Test Data Generator for Overtime Calculation Testing
 *
 * Generates predefined test scenarios with users, time entries, absences,
 * and expected overtime results for comprehensive validation.
 *
 * Usage:
 * ```typescript
 * import { createTestScenario } from './generateTestData';
 *
 * const scenario = createTestScenario('standard-40h');
 * console.log(scenario.user);
 * console.log(scenario.expectedOvertime);
 * ```
 */

import type { DayName } from '../utils/workingDays';

// ============================================================================
// Types
// ============================================================================

export interface TestUser {
  id: number;
  firstName: string;
  lastName: string;
  email: string;
  weeklyHours: number;
  workSchedule: Record<DayName, number> | null;
  hireDate: string;
  role: 'admin' | 'employee';
  department: string;
}

export interface TestTimeEntry {
  id: number;
  userId: number;
  date: string;
  startTime: string;
  endTime: string;
  breakMinutes: number;
  hours: number;
  description: string;
}

export interface TestAbsence {
  id: number;
  userId: number;
  type: 'vacation' | 'sick' | 'overtime_comp' | 'unpaid';
  startDate: string;
  endDate: string;
  daysRequired: number;
  status: 'approved' | 'pending' | 'rejected';
  reason: string;
}

export interface TestScenario {
  name: string;
  description: string;
  user: TestUser;
  timeEntries: TestTimeEntry[];
  absences: TestAbsence[];
  referenceDate: string; // "today" for calculation
  expectedTargetHours: number;
  expectedActualHours: number;
  expectedOvertime: number;
  explanation: string;
}

// ============================================================================
// User Factory
// ============================================================================

let userIdCounter = 1000;
let timeEntryIdCounter = 5000;
let absenceIdCounter = 3000;

export function createTestUser(config: {
  firstName?: string;
  lastName?: string;
  email?: string;
  weeklyHours?: number;
  workSchedule?: Record<DayName, number> | null;
  hireDate: string;
  role?: 'admin' | 'employee';
  department?: string;
}): TestUser {
  userIdCounter++;
  return {
    id: userIdCounter,
    firstName: config.firstName || 'Test',
    lastName: config.lastName || 'User',
    email: config.email || `test${userIdCounter}@example.com`,
    weeklyHours: config.weeklyHours ?? 40,
    workSchedule: config.workSchedule ?? null,
    hireDate: config.hireDate,
    role: config.role || 'employee',
    department: config.department || 'Engineering',
  };
}

export function createTestTimeEntry(config: {
  userId: number;
  date: string;
  hours: number;
  description?: string;
}): TestTimeEntry {
  timeEntryIdCounter++;
  return {
    id: timeEntryIdCounter,
    userId: config.userId,
    date: config.date,
    startTime: '09:00',
    endTime: '17:00',
    breakMinutes: 60,
    hours: config.hours,
    description: config.description || 'Test entry',
  };
}

export function createTestAbsence(config: {
  userId: number;
  type: 'vacation' | 'sick' | 'overtime_comp' | 'unpaid';
  startDate: string;
  endDate: string;
  daysRequired: number;
  status?: 'approved' | 'pending' | 'rejected';
  reason?: string;
}): TestAbsence {
  absenceIdCounter++;
  return {
    id: absenceIdCounter,
    userId: config.userId,
    type: config.type,
    startDate: config.startDate,
    endDate: config.endDate,
    daysRequired: config.daysRequired,
    status: config.status || 'approved',
    reason: config.reason || 'Test absence',
  };
}

// ============================================================================
// Predefined Scenarios
// ============================================================================

export function createTestScenario(name: string): TestScenario {
  switch (name) {
    case 'standard-40h':
      return createStandard40hScenario();
    case 'hans-individual-schedule':
      return createHansIndividualScheduleScenario();
    case 'vacation-week':
      return createVacationWeekScenario();
    case 'sick-leave-month':
      return createSickLeaveMonthScenario();
    case 'unpaid-leave':
      return createUnpaidLeaveScenario();
    case 'holiday-heavy-month':
      return createHolidayHeavyMonthScenario();
    case 'weekend-worker':
      return createWeekendWorkerScenario();
    case 'zero-hours-day':
      return createZeroHoursDayScenario();
    case 'partial-week':
      return createPartialWeekScenario();
    case 'overtime-compensation':
      return createOvertimeCompensationScenario();
    default:
      throw new Error(`Unknown scenario: ${name}`);
  }
}

// ----------------------------------------------------------------------------
// Scenario 1: Standard 40h week (no absences)
// ----------------------------------------------------------------------------
function createStandard40hScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Max',
    lastName: 'Mustermann',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon
    createTestTimeEntry({ userId: user.id, date: '2025-02-04', hours: 8 }), // Tue
    createTestTimeEntry({ userId: user.id, date: '2025-02-05', hours: 8 }), // Wed
    createTestTimeEntry({ userId: user.id, date: '2025-02-06', hours: 8 }), // Thu
    createTestTimeEntry({ userId: user.id, date: '2025-02-07', hours: 8 }), // Fri
  ];

  return {
    name: 'standard-40h',
    description: 'Standard 40h week, Mo-Fr worked, no absences',
    user,
    timeEntries,
    absences: [],
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 40, // 5 days × 8h
    expectedActualHours: 40, // 5 × 8h worked
    expectedOvertime: 0, // 40 - 40 = 0
    explanation: 'Week: Mo-Fr (5 days). Target: 5 × 8h = 40h. Actual: 40h worked. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 2: Hans Individual Schedule (from OVERTIME_TESTING_GUIDE.md)
// ----------------------------------------------------------------------------
function createHansIndividualScheduleScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Hans',
    lastName: 'Schmidt',
    weeklyHours: 30,
    workSchedule: {
      monday: 8,
      tuesday: 0, // Not a working day!
      wednesday: 6,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
    },
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon
    // Tuesday: No entry (0h day)
    createTestTimeEntry({ userId: user.id, date: '2025-02-05', hours: 6 }), // Wed
    createTestTimeEntry({ userId: user.id, date: '2025-02-06', hours: 8 }), // Thu
    createTestTimeEntry({ userId: user.id, date: '2025-02-07', hours: 8 }), // Fri
  ];

  return {
    name: 'hans-individual-schedule',
    description: 'Hans with individual schedule (Tuesday = 0h)',
    user,
    timeEntries,
    absences: [],
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 30, // Mon(8) + Wed(6) + Thu(8) + Fri(8) = 30h
    expectedActualHours: 30, // 8 + 6 + 8 + 8 = 30h
    expectedOvertime: 0, // 30 - 30 = 0
    explanation: 'Week: Mo(8h), Tu(0h - not working day), We(6h), Th(8h), Fr(8h). Target: 30h. Actual: 30h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 3: Vacation Week
// ----------------------------------------------------------------------------
function createVacationWeekScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Lisa',
    lastName: 'Weber',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon
    createTestTimeEntry({ userId: user.id, date: '2025-02-04', hours: 8 }), // Tue
  ];

  const absences = [
    createTestAbsence({
      userId: user.id,
      type: 'vacation',
      startDate: '2025-02-05', // Wed
      endDate: '2025-02-07',   // Fri
      daysRequired: 3,
      status: 'approved',
    }),
  ];

  return {
    name: 'vacation-week',
    description: 'Week with vacation (Wed-Fri)',
    user,
    timeEntries,
    absences,
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 40, // 5 days × 8h
    expectedActualHours: 40, // 16h worked + 24h vacation credit
    expectedOvertime: 0, // 40 - 40 = 0
    explanation: 'Week: Mo-Tue worked (16h), Wed-Fri vacation (3 × 8h = 24h credit). Target: 40h. Actual: 16h + 24h = 40h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 4: Sick Leave Month
// ----------------------------------------------------------------------------
function createSickLeaveMonthScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Tom',
    lastName: 'Müller',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-02-01', // Saturday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon (first week)
  ];

  const absences = [
    createTestAbsence({
      userId: user.id,
      type: 'sick',
      startDate: '2025-02-04', // Tue
      endDate: '2025-02-28',   // Fri (last day of Feb)
      daysRequired: 19, // All remaining working days
      status: 'approved',
    }),
  ];

  return {
    name: 'sick-leave-month',
    description: 'Month with sick leave (Feb 2025)',
    user,
    timeEntries,
    absences,
    referenceDate: '2025-02-28', // Last day of Feb
    expectedTargetHours: 160, // 20 working days × 8h (Feb 2025: Mo-Fr only)
    expectedActualHours: 160, // 8h worked + 152h sick credit (19 days × 8h)
    expectedOvertime: 0, // 160 - 160 = 0
    explanation: 'Feb 2025: 20 working days. Worked: Mon (8h). Sick: 19 days (152h credit). Target: 160h. Actual: 160h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 5: Unpaid Leave (reduces target!)
// ----------------------------------------------------------------------------
function createUnpaidLeaveScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Anna',
    lastName: 'Schmidt',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon
    createTestTimeEntry({ userId: user.id, date: '2025-02-04', hours: 8 }), // Tue
    createTestTimeEntry({ userId: user.id, date: '2025-02-05', hours: 8 }), // Wed
  ];

  const absences = [
    createTestAbsence({
      userId: user.id,
      type: 'unpaid',
      startDate: '2025-02-06', // Thu
      endDate: '2025-02-07',   // Fri
      daysRequired: 2,
      status: 'approved',
    }),
  ];

  return {
    name: 'unpaid-leave',
    description: 'Week with unpaid leave (reduces target!)',
    user,
    timeEntries,
    absences,
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 24, // (5 - 2) × 8h = 24h (unpaid reduces target!)
    expectedActualHours: 24, // 3 × 8h worked (no credit for unpaid!)
    expectedOvertime: 0, // 24 - 24 = 0
    explanation: 'Week: Mo-Wed worked (24h), Thu-Fri unpaid (NO credit, reduces target). Target: 3 × 8h = 24h. Actual: 24h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 6: Holiday-Heavy Month (Dec 2025)
// ----------------------------------------------------------------------------
function createHolidayHeavyMonthScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Paul',
    lastName: 'Becker',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-12-01', // Monday
  });

  const timeEntries = [
    // Dec 1-24: 17 working days (exclude Dec 25, 26 = holidays)
    ...Array.from({ length: 17 }, (_, i) => {
      const date = new Date(2025, 11, 1 + i);
      const day = date.getDay();
      if (day === 0 || day === 6) return null; // Skip weekends
      return createTestTimeEntry({
        userId: user.id,
        date: date.toISOString().split('T')[0],
        hours: 8,
      });
    }).filter(Boolean) as TestTimeEntry[],
  ];

  return {
    name: 'holiday-heavy-month',
    description: 'December 2025 with Christmas holidays',
    user,
    timeEntries,
    absences: [],
    referenceDate: '2025-12-26', // Dec 26 (holiday)
    expectedTargetHours: 136, // 17 working days × 8h (exclude Dec 25, 26)
    expectedActualHours: 136, // 17 × 8h worked
    expectedOvertime: 0, // 136 - 136 = 0
    explanation: 'Dec 2025: 22 workdays, but Dec 25, 26 = holidays (0h). Worked: 17 days × 8h = 136h. Target: 136h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 7: Weekend Worker
// ----------------------------------------------------------------------------
function createWeekendWorkerScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Sarah',
    lastName: 'König',
    weeklyHours: 40,
    workSchedule: {
      monday: 0,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 8, // Works on Saturday!
      sunday: 0,
    },
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-04', hours: 8 }), // Tue
    createTestTimeEntry({ userId: user.id, date: '2025-02-05', hours: 8 }), // Wed
    createTestTimeEntry({ userId: user.id, date: '2025-02-06', hours: 8 }), // Thu
    createTestTimeEntry({ userId: user.id, date: '2025-02-07', hours: 8 }), // Fri
    createTestTimeEntry({ userId: user.id, date: '2025-02-08', hours: 8 }), // Sat
  ];

  return {
    name: 'weekend-worker',
    description: 'User with Saturday as working day',
    user,
    timeEntries,
    absences: [],
    referenceDate: '2025-02-08', // Saturday
    expectedTargetHours: 40, // Tue-Sat (5 days × 8h)
    expectedActualHours: 40, // 5 × 8h worked
    expectedOvertime: 0, // 40 - 40 = 0
    explanation: 'Week: Mo(0h), Tue-Fri(32h), Sat(8h). Target: 40h. Actual: 40h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 8: Vacation on 0h day (Edge Case #2 from GUIDE)
// ----------------------------------------------------------------------------
function createZeroHoursDayScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Markus',
    lastName: 'Wolf',
    weeklyHours: 30,
    workSchedule: {
      monday: 8,
      tuesday: 0, // Vacation on this day should give 0h credit!
      wednesday: 6,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
    },
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon
    // Tuesday: Vacation (0h day)
    createTestTimeEntry({ userId: user.id, date: '2025-02-05', hours: 6 }), // Wed
    createTestTimeEntry({ userId: user.id, date: '2025-02-06', hours: 8 }), // Thu
    createTestTimeEntry({ userId: user.id, date: '2025-02-07', hours: 8 }), // Fri
  ];

  const absences = [
    createTestAbsence({
      userId: user.id,
      type: 'vacation',
      startDate: '2025-02-04', // Tuesday (0h day!)
      endDate: '2025-02-04',
      daysRequired: 1,
      status: 'approved',
    }),
  ];

  return {
    name: 'zero-hours-day',
    description: 'Vacation on 0h day (no credit!)',
    user,
    timeEntries,
    absences,
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 30, // Mon(8) + Wed(6) + Thu(8) + Fri(8) = 30h
    expectedActualHours: 30, // 30h worked + 0h vacation credit (Tuesday = 0h!)
    expectedOvertime: 0, // 30 - 30 = 0
    explanation: 'Week: Vacation on Tuesday (0h day) gives NO credit! Target: 30h. Actual: 30h worked. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 9: Partial Week (hired mid-week)
// ----------------------------------------------------------------------------
function createPartialWeekScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Julia',
    lastName: 'Hoffmann',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-02-05', // Wednesday (hired mid-week)
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-05', hours: 8 }), // Wed
    createTestTimeEntry({ userId: user.id, date: '2025-02-06', hours: 8 }), // Thu
    createTestTimeEntry({ userId: user.id, date: '2025-02-07', hours: 8 }), // Fri
  ];

  return {
    name: 'partial-week',
    description: 'Hired mid-week (Wednesday)',
    user,
    timeEntries,
    absences: [],
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 24, // Wed-Fri (3 days × 8h)
    expectedActualHours: 24, // 3 × 8h worked
    expectedOvertime: 0, // 24 - 24 = 0
    explanation: 'Hired: Wednesday. Week: Wed-Fri (3 days). Target: 3 × 8h = 24h. Actual: 24h. Overtime: 0h.',
  };
}

// ----------------------------------------------------------------------------
// Scenario 10: Overtime Compensation
// ----------------------------------------------------------------------------
function createOvertimeCompensationScenario(): TestScenario {
  const user = createTestUser({
    firstName: 'Michael',
    lastName: 'Fischer',
    weeklyHours: 40,
    workSchedule: null,
    hireDate: '2025-02-03', // Monday
  });

  const timeEntries = [
    createTestTimeEntry({ userId: user.id, date: '2025-02-03', hours: 8 }), // Mon
    createTestTimeEntry({ userId: user.id, date: '2025-02-04', hours: 8 }), // Tue
  ];

  const absences = [
    createTestAbsence({
      userId: user.id,
      type: 'overtime_comp',
      startDate: '2025-02-05', // Wed
      endDate: '2025-02-07',   // Fri
      daysRequired: 3,
      status: 'approved',
    }),
  ];

  return {
    name: 'overtime-compensation',
    description: 'Week with overtime compensation (Wed-Fri)',
    user,
    timeEntries,
    absences,
    referenceDate: '2025-02-07', // Friday
    expectedTargetHours: 40, // 5 days × 8h
    expectedActualHours: 40, // 16h worked + 24h overtime_comp credit
    expectedOvertime: 0, // 40 - 40 = 0
    explanation: 'Week: Mo-Tue worked (16h), Wed-Fri overtime_comp (3 × 8h = 24h credit). Target: 40h. Actual: 40h. Overtime: 0h.',
  };
}

// ============================================================================
// Utility Functions
// ============================================================================

export function getAllScenarioNames(): string[] {
  return [
    'standard-40h',
    'hans-individual-schedule',
    'vacation-week',
    'sick-leave-month',
    'unpaid-leave',
    'holiday-heavy-month',
    'weekend-worker',
    'zero-hours-day',
    'partial-week',
    'overtime-compensation',
  ];
}

export function printScenario(scenario: TestScenario): void {
  console.log('\n' + '='.repeat(80));
  console.log(`SCENARIO: ${scenario.name}`);
  console.log('='.repeat(80));
  console.log(`Description: ${scenario.description}`);
  console.log(`Reference Date: ${scenario.referenceDate}`);
  console.log('\nUser:');
  console.log(`  ${scenario.user.firstName} ${scenario.user.lastName} (ID: ${scenario.user.id})`);
  console.log(`  Weekly Hours: ${scenario.user.weeklyHours}h`);
  console.log(`  Work Schedule: ${scenario.user.workSchedule ? 'Individual' : 'Standard'}`);
  console.log(`  Hire Date: ${scenario.user.hireDate}`);
  console.log('\nTime Entries:', scenario.timeEntries.length);
  scenario.timeEntries.forEach(entry => {
    console.log(`  - ${entry.date}: ${entry.hours}h`);
  });
  console.log('\nAbsences:', scenario.absences.length);
  scenario.absences.forEach(absence => {
    console.log(`  - ${absence.startDate} to ${absence.endDate}: ${absence.type} (${absence.daysRequired} days)`);
  });
  console.log('\nExpected Results:');
  console.log(`  Target Hours: ${scenario.expectedTargetHours}h`);
  console.log(`  Actual Hours: ${scenario.expectedActualHours}h`);
  console.log(`  Overtime: ${scenario.expectedOvertime >= 0 ? '+' : ''}${scenario.expectedOvertime}h`);
  console.log('\nExplanation:');
  console.log(`  ${scenario.explanation}`);
  console.log('='.repeat(80) + '\n');
}

// ============================================================================
// CLI Interface (optional)
// ============================================================================

if (require.main === module) {
  const args = process.argv.slice(2);
  const scenarioName = args[0];

  if (!scenarioName) {
    console.log('Usage: tsx generateTestData.ts <scenario-name>');
    console.log('\nAvailable scenarios:');
    getAllScenarioNames().forEach(name => console.log(`  - ${name}`));
    process.exit(1);
  }

  if (scenarioName === '--all') {
    getAllScenarioNames().forEach(name => {
      const scenario = createTestScenario(name);
      printScenario(scenario);
    });
  } else {
    const scenario = createTestScenario(scenarioName);
    printScenario(scenario);
  }
}
