# Notification System - Code Changes Reference

**Date:** 2025-11-12
**Purpose:** Quick reference for all code changes made to implement notification system

---

## 📁 File 1: notificationService.ts

**Path:** `/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/src/services/notificationService.ts`

**Change:** Added 12 new notification helper functions

**Location:** After line 227 (after `notifyAbsenceRequested()`)

### Functions Added:

```typescript
// HIGH PRIORITY
export function notifyTimeEntryEditedByAdmin(userId: number, date: string, adminName: string, reason?: string): void
export function notifyTimeEntryDeleted(userId: number, date: string, adminName: string, reason?: string): void
export function notifyVacationDaysAdjusted(userId: number, oldDays: number, newDays: number, reason?: string): void
export function notifyUserDeactivated(userId: number): void

// MEDIUM PRIORITY
export function notifyOvertimeThreshold(userId: number, currentOvertime: number, threshold: number): void
export function notifyNegativeOvertimeAlert(employeeName: string, currentOvertime: number, threshold: number): void
export function notifyTargetHoursChanged(userId: number, oldHours: number, newHours: number): void
export function notifyVacationDaysLow(userId: number, remainingDays: number, threshold?: number): void

// LOW PRIORITY
export function notifyUserCreated(userId: number, firstName: string): void
export function notifyMissedClockIn(userId: number, date: string, expectedTime: string): void
export function notifyAdminMissedClockIn(employeeName: string, date: string): void
export function notifyBreakTimeViolation(userId: number, date: string, workedHours: number, requiredBreak: number): void
export function notifyWeeklyOvertimeLimitExceeded(employeeName: string, weeklyHours: number, limit?: number): void
```

**Lines Added:** ~190 lines

---

## 📁 File 2: timeEntries.ts

**Path:** `/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/src/routes/timeEntries.ts`

### Change 1: Add Imports

**Location:** Lines 18-22

```typescript
import {
  notifyTimeEntryEditedByAdmin,
  notifyTimeEntryDeleted
} from '../services/notificationService.js';
import { getUserById } from '../services/userService.js';
```

### Change 2: Notify on Time Entry Edit

**Location:** After line 257 (in PUT endpoint, after `logAudit()`)

```typescript
// Notify employee if admin edited their time entry
if (isAdmin && !isOwner) {
  const admin = getUserById(req.session.user!.id);
  if (admin) {
    notifyTimeEntryEditedByAdmin(
      existing.userId,
      existing.date,
      `${admin.firstName} ${admin.lastName}`
    );
  }
}
```

### Change 3: Notify on Time Entry Delete

**Location:** After line 359 (in DELETE endpoint, after `logAudit()`)

```typescript
// Notify employee if admin deleted their time entry
if (isAdmin && !isOwner) {
  const admin = getUserById(req.session.user!.id);
  if (admin) {
    notifyTimeEntryDeleted(
      existing.userId,
      existing.date,
      `${admin.firstName} ${admin.lastName}`
    );
  }
}
```

**Lines Added:** ~25 lines

---

## 📁 File 3: users.ts

**Path:** `/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/src/routes/users.ts`

### Change 1: Add Imports

**Location:** Lines 20-25

```typescript
import {
  notifyVacationDaysAdjusted,
  notifyUserDeactivated,
  notifyUserCreated,
  notifyTargetHoursChanged
} from '../services/notificationService.js';
```

### Change 2: Notify on User Creation

**Location:** After line 244 (in POST endpoint, after `logAudit()`)

```typescript
// Send welcome notification to new user
notifyUserCreated(user.id, user.firstName);
```

### Change 3: Get Old User Before Update

**Location:** Line 287 (in PUT endpoint, before checking username/email)

```typescript
// Get existing user for comparison (before update)
const oldUser = getUserById(id);
if (!oldUser) {
  res.status(404).json({
    success: false,
    error: 'User not found',
  });
  return;
}
```

### Change 4: Notify on Vacation Days Change

**Location:** After line 318 (in PUT endpoint, after `logAudit()`)

```typescript
// Check if vacation days changed - notify employee
if (data.vacationDaysPerYear !== undefined &&
    oldUser.vacationDaysPerYear !== data.vacationDaysPerYear) {
  notifyVacationDaysAdjusted(
    id,
    oldUser.vacationDaysPerYear,
    data.vacationDaysPerYear
  );
}
```

### Change 5: Notify on Weekly Hours Change

**Location:** After vacation days check (line ~329)

```typescript
// Check if weekly hours changed - notify employee
if (data.weeklyHours !== undefined &&
    oldUser.weeklyHours !== data.weeklyHours) {
  notifyTargetHoursChanged(
    id,
    oldUser.weeklyHours,
    data.weeklyHours
  );
}
```

### Change 6: Notify on User Deactivation (DELETE)

**Location:** After line 392 (in DELETE endpoint, after `logAudit()`)

```typescript
// Notify user that their account was deactivated
notifyUserDeactivated(id);
```

### Change 7: Notify on Status Change to Inactive

**Location:** After line 501 (in PATCH status endpoint, after `logAudit()`)

```typescript
// Notify user if they were deactivated
if (status === 'inactive') {
  notifyUserDeactivated(id);
}
```

**Lines Added:** ~40 lines

---

## 📁 File 4: notifications.ts

**Path:** `/Users/maximilianfegg/Desktop/TimeTracking-Clean/server/src/routes/notifications.ts`

**Change:** ✅ No changes needed!

The `PATCH /api/notifications/:id/unread` endpoint and `markNotificationAsUnread()` function were already implemented.

**Lines Added:** 0 lines

---

## 🔍 How to Find the Changes

### Search by Function Name

If you want to find where a notification is called:

```bash
# Example: Find where vacation days notification is called
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/server
grep -r "notifyVacationDaysAdjusted" src/
```

### Search by Notification Type

If you want to find the notification definition:

```bash
# Example: Find time entry edited notification
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/server
grep -A 10 "notifyTimeEntryEditedByAdmin" src/services/notificationService.ts
```

---

## 🎯 Integration Points Summary

| Notification | Route File | Line Number | Trigger Point |
|--------------|-----------|-------------|---------------|
| Time Entry Edited | timeEntries.ts | ~260 | PUT endpoint, after audit log |
| Time Entry Deleted | timeEntries.ts | ~362 | DELETE endpoint, after audit log |
| Vacation Days Adjusted | users.ts | ~321 | PUT endpoint, after user update |
| Weekly Hours Changed | users.ts | ~330 | PUT endpoint, after user update |
| User Deactivated (DELETE) | users.ts | ~395 | DELETE endpoint, after audit log |
| User Deactivated (STATUS) | users.ts | ~504 | PATCH status, after audit log |
| User Created Welcome | users.ts | ~247 | POST endpoint, after audit log |

---

## 🧪 Quick Test Commands

### Test Notification Service (TypeScript Compilation)

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/server
npm run build
```

### Test Routes (Start Server)

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/server
npm start
```

### Check for Syntax Errors

```bash
cd /Users/maximilianfegg/Desktop/TimeTracking-Clean/server
npx tsc --noEmit
```

---

## 📊 Statistics

| Metric | Value |
|--------|-------|
| Files Modified | 3 |
| Files Checked | 4 |
| Lines Added | ~255 |
| Functions Added | 12 |
| Notification Types | 13 |
| Routes Modified | 7 |
| TypeScript Errors | 0 |

---

## ✅ Verification Checklist

After making these changes, verify:

- [x] TypeScript compilation successful (`npm run build`)
- [x] No TypeScript errors
- [x] No `any` types used
- [x] All imports resolve correctly
- [x] Server starts without errors
- [x] Defensive programming applied (null checks)
- [x] German language messages
- [x] Consistent code style

---

## 🚀 Deployment Notes

When deploying to production:

1. **Build the server:**
   ```bash
   cd server
   npm run build
   ```

2. **Restart the server:**
   ```bash
   pm2 restart ecosystem.config.js
   # OR
   npm start
   ```

3. **Test notifications:**
   - Login as admin
   - Edit an employee's time entry
   - Check employee notifications

---

**Document Version:** 1.0
**Last Updated:** 2025-11-12
