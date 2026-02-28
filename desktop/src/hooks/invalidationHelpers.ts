/**
 * Centralized Query Invalidation Helpers
 *
 * This module provides consistent query invalidation patterns across the application.
 * It ensures that all related queries are properly invalidated when data changes,
 * eliminating cache inconsistencies and update delays.
 *
 * Key Principles:
 * 1. Use `exact: false` to invalidate all queries that start with the key
 * 2. Use `refetchType: 'all'` to refetch both active and inactive queries
 * 3. Group related queries together for comprehensive invalidation
 */

import type { QueryClient } from '@tanstack/react-query';

/**
 * Query groups that are commonly invalidated together
 */
export const QUERY_GROUPS = {
  // Overtime-related queries
  overtime: [
    'overtime',
    'overtimeBalance',
    'overtimeSummary',
    'overtimeCorrections',
    'currentOvertimeStats',
    'totalOvertime',
    'work-time-accounts',
    'all-users-overtime-reports',
    'overtime-transactions',
    'overtime-corrections',
    'overtime-report',               // For Reports page charts
    'overtime-history',              // For Monthly Development (Monatliche Entwicklung)
    'overtime-year-breakdown',       // For year breakdown widget
    'overtime-history-transactions', // For transaction-based history
    'overtime-report-daily',         // For daily breakdown details (CRITICAL!)
    'dailyOvertime',                 // For daily overtime calculations
    'weeklyOvertime',                // For weekly overtime calculations
    'allUsersOvertimeSummary',       // For all users overtime summary
    'overtime-balances',             // For year-end rollover
  ],

  // Vacation-related queries
  vacation: [
    'vacationBalance',
    'vacation-balances',
  ],

  // Absence-related queries
  absence: [
    'absenceRequests',
    'absenceRequest',
  ],

  // User-related queries
  user: [
    'user',
    'users',
    'currentUser',
  ],

  // Time entry queries
  timeEntries: [
    'timeEntries',
    'timeEntry',
  ],

  // Notification queries
  notifications: [
    'notifications',
  ],
} as const;

/**
 * Invalidation options for consistent behavior
 */
const DEFAULT_INVALIDATION_OPTIONS = {
  exact: false, // Invalidate all queries that start with this key
  refetchType: 'all' as const, // Refetch both active and inactive queries
};

/**
 * Invalidate all overtime-related queries
 *
 * Use this when:
 * - Time entries are added/modified/deleted
 * - Overtime corrections are made
 * - User work schedule changes
 * - Absences are approved/rejected
 * - Vacation balances change
 */
export async function invalidateOvertimeQueries(queryClient: QueryClient): Promise<void> {
  // First invalidate (mark as stale)
  const invalidatePromises = QUERY_GROUPS.overtime.map(queryKey =>
    queryClient.invalidateQueries({
      queryKey: [queryKey],
      ...DEFAULT_INVALIDATION_OPTIONS,
    })
  );
  await Promise.all(invalidatePromises);

  // Then immediately refetch active queries for instant updates
  const refetchPromises = QUERY_GROUPS.overtime.map(queryKey =>
    queryClient.refetchQueries({
      queryKey: [queryKey],
      exact: false,
      type: 'active',
    })
  );
  await Promise.all(refetchPromises);
}

/**
 * Invalidate all vacation-related queries
 *
 * Use this when:
 * - Vacation balances are modified
 * - Vacation requests are approved/rejected
 * - User vacation entitlements change
 */
export async function invalidateVacationQueries(queryClient: QueryClient): Promise<void> {
  // First invalidate (mark as stale)
  const invalidatePromises = QUERY_GROUPS.vacation.map(queryKey =>
    queryClient.invalidateQueries({
      queryKey: [queryKey],
      ...DEFAULT_INVALIDATION_OPTIONS,
    })
  );
  await Promise.all(invalidatePromises);

  // Then immediately refetch active queries for instant updates
  const refetchPromises = QUERY_GROUPS.vacation.map(queryKey =>
    queryClient.refetchQueries({
      queryKey: [queryKey],
      exact: false,
      type: 'active',
    })
  );
  await Promise.all(refetchPromises);
}

/**
 * Invalidate all absence-related queries
 *
 * Use this when:
 * - Absence requests are created/modified/deleted
 * - Absence requests are approved/rejected
 */
export async function invalidateAbsenceQueries(queryClient: QueryClient): Promise<void> {
  // First invalidate (mark as stale)
  const invalidatePromises = QUERY_GROUPS.absence.map(queryKey =>
    queryClient.invalidateQueries({
      queryKey: [queryKey],
      ...DEFAULT_INVALIDATION_OPTIONS,
    })
  );
  await Promise.all(invalidatePromises);

  // Then immediately refetch active queries for instant updates
  const refetchPromises = QUERY_GROUPS.absence.map(queryKey =>
    queryClient.refetchQueries({
      queryKey: [queryKey],
      exact: false,
      type: 'active',
    })
  );
  await Promise.all(refetchPromises);
}

/**
 * Invalidate all user-related queries
 *
 * Use this when:
 * - User data is modified
 * - Users are created/deleted
 * - User permissions change
 */
export async function invalidateUserQueries(queryClient: QueryClient): Promise<void> {
  // First invalidate (mark as stale)
  const invalidatePromises = QUERY_GROUPS.user.map(queryKey =>
    queryClient.invalidateQueries({
      queryKey: [queryKey],
      ...DEFAULT_INVALIDATION_OPTIONS,
    })
  );
  await Promise.all(invalidatePromises);

  // Then immediately refetch active queries for instant updates
  const refetchPromises = QUERY_GROUPS.user.map(queryKey =>
    queryClient.refetchQueries({
      queryKey: [queryKey],
      exact: false,
      type: 'active',
    })
  );
  await Promise.all(refetchPromises);
}

/**
 * Invalidate all time entry queries
 *
 * Use this when:
 * - Time entries are created/modified/deleted
 */
export async function invalidateTimeEntryQueries(queryClient: QueryClient): Promise<void> {
  // Use predicate-based invalidation to match ALL timeEntries queries
  // This includes: ['timeEntries'], ['timeEntry', id], ['timeEntries', 'infinite', ...]
  await queryClient.invalidateQueries({
    predicate: (query) => {
      const firstKey = query.queryKey[0];
      return firstKey === 'timeEntries' || firstKey === 'timeEntry';
    },
    ...DEFAULT_INVALIDATION_OPTIONS,
  });

  // Then immediately refetch active queries for instant updates
  await queryClient.refetchQueries({
    predicate: (query) => {
      const firstKey = query.queryKey[0];
      return firstKey === 'timeEntries' || firstKey === 'timeEntry';
    },
    type: 'active',
  });
}

/**
 * Invalidate queries that are affected by absence changes
 * This includes overtime (since absences give overtime credits)
 *
 * Use this when:
 * - Absence requests are created/modified/deleted
 * - Absence requests are approved/rejected
 */
export async function invalidateAbsenceAffectedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateAbsenceQueries(queryClient),
    invalidateVacationQueries(queryClient),
    invalidateOvertimeQueries(queryClient), // Critical: Absences affect overtime calculations
  ]);
}

/**
 * Invalidate queries that are affected by vacation balance changes
 * This includes overtime (since vacation affects overtime calculations)
 *
 * Use this when:
 * - Vacation balances are modified
 * - Vacation entitlements change
 */
export async function invalidateVacationAffectedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateVacationQueries(queryClient),
    invalidateOvertimeQueries(queryClient), // Critical: Vacation affects overtime calculations
  ]);
}

/**
 * Invalidate queries that are affected by user changes
 * This includes overtime (since work schedule affects overtime calculations)
 *
 * Use this when:
 * - User work schedule changes
 * - User weekly hours change
 * - User hire date changes
 */
export async function invalidateUserAffectedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateUserQueries(queryClient),
    invalidateOvertimeQueries(queryClient), // Critical: User work schedule affects overtime
    invalidateVacationQueries(queryClient), // User changes may affect vacation entitlements
  ]);
}

/**
 * Invalidate queries that are affected by time entry changes
 * This includes overtime (since time entries are the base of overtime calculations)
 *
 * Use this when:
 * - Time entries are created/modified/deleted
 */
export async function invalidateTimeEntryAffectedQueries(queryClient: QueryClient): Promise<void> {
  await Promise.all([
    invalidateTimeEntryQueries(queryClient),
    invalidateOvertimeQueries(queryClient), // Critical: Time entries directly affect overtime
  ]);
}

/**
 * Force immediate refetch of specific queries (bypass cache completely)
 *
 * Use this when you need immediate data refresh without waiting for stale time
 */
export async function forceRefetchQueries(
  queryClient: QueryClient,
  queryKeys: string[]
): Promise<void> {
  const promises = queryKeys.map(queryKey =>
    queryClient.refetchQueries({
      queryKey: [queryKey],
      type: 'active', // Only refetch currently active queries
    })
  );

  await Promise.all(promises);
}

/**
 * Invalidate all data queries (complete cache reset)
 *
 * Use this sparingly, only when:
 * - User logs out
 * - Major data sync is needed
 * - Recovery from error state
 */
export async function invalidateAllQueries(queryClient: QueryClient): Promise<void> {
  await queryClient.invalidateQueries();
}