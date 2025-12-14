// Time Entries
export {
  useTimeEntries,
  useTimeEntry,
  useTodayTimeEntries,
  useWeekTimeEntries,
  useCreateTimeEntry,
  useUpdateTimeEntry,
  useDeleteTimeEntry,
} from './useTimeEntries';

// Absence Requests
export {
  useAbsenceRequests,
  useAbsenceRequest,
  usePendingAbsenceRequests,
  useCreateAbsenceRequest,
  useApproveAbsenceRequest,
  useRejectAbsenceRequest,
  useDeleteAbsenceRequest,
} from './useAbsenceRequests';

// Balances
export {
  useVacationBalance,
  useCurrentVacationBalance,
  useOvertimeBalance,
  useTotalOvertime,
  useRemainingVacationDays,
  useCurrentOvertimeStats,
  useDailyOvertime,
  useWeeklyOvertime,
  useOvertimeSummary,
} from './useBalances';

// Vacation Balance Admin
export {
  useVacationBalances,
  useVacationBalanceSummary,
  useUpsertVacationBalance,
  useUpdateVacationBalance,
  useDeleteVacationBalance,
  useBulkInitializeVacationBalances,
} from './useVacationBalanceAdmin';
export type { VacationBalanceSummary, VacationBalanceCreateInput, VacationBalanceUpdateInput } from './useVacationBalanceAdmin';

// Overtime Admin
export {
  useAllUsersOvertime,
} from './useOvertimeAdmin';
export type { OvertimeSummary } from './useOvertimeAdmin';

// Users
export {
  useCurrentUser,
  useUsers,
  useUser,
  useActiveEmployees,
  useCreateUser,
  useUpdateUser,
  useDeleteUser,
  useReactivateUser,
} from './useUsers';

// Notifications
export {
  useNotifications,
  useUnreadNotifications,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from './useNotifications';
export { useInfiniteNotifications } from './useInfiniteNotifications';

// Holidays
export {
  useHolidays,
  useCurrentYearHolidays,
  useMultiYearHolidays,
} from './useHolidays';

// Keyboard Shortcuts
export {
  useKeyboardShortcuts,
  useGlobalKeyboardShortcuts,
  useModalKeyboardShortcuts,
} from './useKeyboardShortcuts';

// Auto-Updater
export { useAutoUpdater } from './useAutoUpdater';
export type { UpdateState } from './useAutoUpdater';
