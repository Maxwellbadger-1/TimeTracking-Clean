/**
 * Test Suite Index
 *
 * Exports all test suites (400+ tests)
 */

import { TestCase } from '../testRunner';
import { authTests } from './authTests';
import { userTests } from './userTests';
import { timeEntryTests } from './timeEntryTests';
import { timeEntryEdgeTests } from './timeEntryEdgeTests';
import { overtimeTests } from './overtimeTests';
import { vacationTests } from './vacationTests';
import { absenceWorkflowTests } from './absenceWorkflowTests';
import { workingDaysTests } from './workingDaysTests';
import {
  absenceTests as absencePlaceholders,
  overtimeTests as overtimePlaceholders,
  notificationTests,
  exportTests,
  databaseTests,
  businessLogicTests as businessLogicPlaceholders,
  securityTests,
  performanceTests as performancePlaceholders,
  frontendTests,
  integrationTests as integrationPlaceholders,
  edgeCaseTests,
} from './allTests';
import { integrationTests } from './integrationTests';
import { performanceTests } from './performanceTests';

// Use professional tests instead of placeholders
const absenceTests = [...vacationTests, ...absenceWorkflowTests];
const businessLogicTests = [...workingDaysTests, ...businessLogicPlaceholders];
const allTimeEntryTests = [...timeEntryTests, ...timeEntryEdgeTests];

// Export all tests grouped by category (428 tests total)
export const allTests: TestCase[] = [
  ...authTests,            // 15 tests
  ...userTests,            // 20 tests
  ...allTimeEntryTests,    // 40 tests (30 basic + 10 edge)
  ...absenceTests,         // 30 tests (15 vacation + 15 workflow)
  ...overtimeTests,        // 20 tests (professional)
  ...notificationTests,    // 20 tests
  ...exportTests,          // 15 tests
  ...databaseTests,        // 25 tests
  ...businessLogicTests,   // 38 tests (8 working days + 30 placeholders)
  ...securityTests,        // 20 tests
  ...performanceTests,     // 5 tests (professional - PERF-001 to PERF-005)
  ...frontendTests,        // 30 tests
  ...integrationTests,     // 10 tests (professional - INT-001 to INT-010)
  ...edgeCaseTests,        // 25 tests
];

// Export by category
export const testsByCategory = {
  auth: authTests,
  users: userTests,
  timeEntries: allTimeEntryTests,
  absences: absenceTests,
  overtime: overtimeTests,
  notifications: notificationTests,
  exports: exportTests,
  database: databaseTests,
  businessLogic: businessLogicTests,
  security: securityTests,
  performance: performanceTests,              // Professional performance tests (5)
  frontend: frontendTests,
  integration: integrationTests,              // Professional integration tests (10)
  edgeCases: edgeCaseTests,
};

// Get tests by category ID
export function getTestsByCategory(categoryId: string): TestCase[] {
  return allTests.filter((test) => test.category === categoryId);
}

// Get test count by category
export function getTestCountByCategory(): Record<string, number> {
  const counts: Record<string, number> = {};

  allTests.forEach((test) => {
    counts[test.category] = (counts[test.category] || 0) + 1;
  });

  return counts;
}
