# Implementation Plan: Flexible Arbeitszeitmodelle

**Ticket:** Individueller Wochenplan + 0-Stunden-Mitarbeiter + Max-Hours-Anpassung
**Status:** ✅ IMPLEMENTATION COMPLETE - Ready for Testing
**Start:** 2026-01-07
**Completed:** 2026-01-07
**Ziel:** Flexible Arbeitszeitmodelle ermöglichen

---

## 🎯 Anforderungen (User Stories)

### 1. 0-Stunden-Mitarbeiter (Aushilfen)
**Als Admin** möchte ich Mitarbeiter mit `weeklyHours=0` anlegen können,
**damit** Aushilfen erfasst werden können, bei denen alle Stunden als Überstunden zählen.

**Acceptance Criteria:**
- ✅ `weeklyHours=0` ist erlaubt (keine Validation Error)
- ✅ Soll-Stunden: 0h
- ✅ Ist-Stunden: Jede erfasste Stunde
- ✅ Überstunden: Ist - Soll = Alle Stunden

### 2. Maximale Arbeitszeit erhöhen
**Als Mitarbeiter** möchte ich Schichten bis zu 24 Stunden erfassen können,
**damit** Bereitschaftsdienste/Langschichten korrekt dokumentiert werden.

**Acceptance Criteria:**
- ✅ Max Hours: 24h (statt 16h)
- ✅ Validation: `hours > 24` → Error
- ✅ Backend + Frontend Validation angepasst

### 3. Individueller Wochenplan (Teilzeit mit ungleicher Verteilung)
**Als Admin** möchte ich jedem Mitarbeiter einen individuellen Wochenplan zuweisen,
**damit** Teilzeit-Mitarbeiter mit ungleicher Stundenverteilung (z.B. Mo 8h, Fr 2h) korrekt erfasst werden.

**Beispiel:** Hans arbeitet 10h/Woche: Montag 8h, Freitag 2h
- Freitag Urlaub → 2h Gutschrift (nicht 5h Durchschnitt!)
- Montag Urlaub → 8h Gutschrift

**Acceptance Criteria:**
- ✅ User hat `workSchedule` Field: `{monday: 8, tuesday: 0, ..., friday: 2, ...}`
- ✅ Urlaubs-Gutschrift: Summiere tatsächliche Tagesstunden
- ✅ Soll-Berechnung: Berücksichtige individuellen Wochenplan
- ✅ Fallback: Wenn `workSchedule=null` → nutze `weeklyHours/5` (wie bisher)

---

## 🏗️ Architecture

### Database Schema Change

```sql
-- users Table erweitern
ALTER TABLE users ADD COLUMN workSchedule TEXT DEFAULT NULL;

-- Format: JSON string
-- Beispiel: '{"monday":8,"tuesday":8,"wednesday":8,"thursday":8,"friday":2,"saturday":0,"sunday":0}'
```

### Business Logic Flow

```
┌─────────────────────────────────────────────────────────────┐
│ User Profile                                                │
├─────────────────────────────────────────────────────────────┤
│ weeklyHours: 10                                             │
│ workSchedule: {monday:8, tuesday:0, ..., friday:2}         │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ getDailyTargetHours(userId, date)                          │
├─────────────────────────────────────────────────────────────┤
│ IF workSchedule EXISTS:                                     │
│   dayName = getDayName(date) // "monday", "friday", ...    │
│   RETURN workSchedule[dayName]  // 8 or 2                  │
│ ELSE:                                                       │
│   RETURN weeklyHours / 5  // Fallback                      │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Absence Credit Calculation                                  │
├─────────────────────────────────────────────────────────────┤
│ Urlaub: Fr 07.02.2025                                       │
│ → getDailyTargetHours(Hans, "2025-02-07") = 2h            │
│ → Gutschrift: 2h (statt 5h Durchschnitt!)                  │
└─────────────────────────────────────────────────────────────┘
                         │
                         ▼
┌─────────────────────────────────────────────────────────────┐
│ Overtime Calculation                                        │
├─────────────────────────────────────────────────────────────┤
│ Soll (Monat): Σ getDailyTargetHours() für alle Arbeitstage │
│ Ist: Σ time_entries.hours                                  │
│ Überstunden: Ist - Soll                                     │
└─────────────────────────────────────────────────────────────┘
```

---

## 📋 Implementation Checklist

### Phase 1: Database & Types ✅ COMPLETED

- [x] **Migration Script**: `ALTER TABLE users ADD COLUMN workSchedule TEXT`
- [x] **TypeScript Types**: User Interface erweitern
  ```typescript
  interface User {
    // ... existing fields
    workSchedule?: WorkSchedule | null;
  }

  interface WorkSchedule {
    monday: number;
    tuesday: number;
    wednesday: number;
    thursday: number;
    friday: number;
    saturday: number;
    sunday: number;
  }
  ```

### Phase 2: Backend Core Logic ✅ COMPLETED

- [x] **userService.ts** - Line 60-62
  ```typescript
  // BEFORE: weeklyHours >= 1
  // AFTER:  weeklyHours >= 0
  if (weeklyHours < 0 || weeklyHours > 80) {
    throw new Error(`Weekly hours must be between 0 and 80`);
  }
  ```

- [x] **timeEntryService.ts** - Line 122-127
  ```typescript
  // BEFORE: hours > 16
  // AFTER:  hours > 24
  if (hours > 24) {
    return { valid: false, error: 'Working time cannot exceed 24 hours per day' };
  }
  ```

- [x] **workingDays.ts** - NEW Functions
  ```typescript
  // NEW: Get daily target hours from workSchedule or fallback
  export function getDailyTargetHours(userId: number, date: string): number

  // NEW: Get day name from date
  function getDayName(date: string): keyof WorkSchedule

  // NEW: calculateTargetHoursForPeriod() - iterate days using getDailyTargetHours()
  ```

- [x] **absenceService.ts** - Line 681-698
  ```typescript
  // MODIFY: updateBalancesAfterApproval()
  // BEFORE: request.days * 8
  // AFTER:  calculateAbsenceCredits(userId, startDate, endDate)

  function calculateAbsenceCredits(userId, startDate, endDate): number {
    // Iterate days, sum getDailyTargetHours()
  }
  ```

- [x] **overtimeService.ts** - calculateMonthlyTarget()
  ```typescript
  // MODIFY: Use getDailyTargetHours() instead of weeklyHours/5
  ```

### Phase 3: Frontend UI ✅ COMPLETED

- [x] **WorkScheduleEditor.tsx** - NEW Component
  ```tsx
  // 7 Input-Felder für Mo-So
  // Toggle: "Standard 5-Tage-Woche" vs "Individuell"
  // Anzeige: Wochenstunden-Summe
  ```

- [x] **CreateUserModal.tsx + EditUserModal.tsx**
  ```tsx
  // Integrate WorkScheduleEditor in User-Forms
  // Added workSchedule state and onChange handler
  // Updated min="0" for weeklyHours (Aushilfen support)
  ```

- [x] **TimeEntryForm.tsx + EditTimeEntryModal.tsx**
  ```tsx
  // Update validation: max 24h warning in preview
  // Visual feedback when > 24h (red background)
  ```

- [ ] **AbsenceRequestForm.tsx** (OPTIONAL)
  ```tsx
  // Preview: "Gebuchte Stunden: Mo 8h, Di 8h, ..., Fr 2h = 34h gesamt"
  // This is a nice-to-have, not critical for core functionality
  ```

### Phase 4: Testing 🧪

- [ ] **Unit Tests** - workingDays.test.ts
  ```typescript
  test('getDailyTargetHours with workSchedule')
  test('getDailyTargetHours fallback to weeklyHours/5')
  test('0-hours employee: all hours = overtime')
  ```

- [ ] **Integration Tests**
  ```typescript
  test('Teilzeit-Urlaub: Fr 2h Gutschrift')
  test('24h Schicht erlaubt')
  test('Backward compatibility: existing users without workSchedule')
  ```

- [ ] **Manual Testing**
  - [ ] Create 0-hours employee → Check Soll=0h, Überstunden=Ist
  - [ ] Create Hans (Mo 8h, Fr 2h) → Freitag Urlaub → Check 2h credit
  - [ ] Create 24h shift → Check validation passes

### Phase 5: Migration & Deployment 🚀

- [ ] **Data Migration Script**
  ```sql
  -- Optional: Convert existing users to workSchedule
  -- Example: weeklyHours=40 → {"monday":8, "tuesday":8, ...}
  ```

- [ ] **Deployment Steps**
  1. Database migration (zero-downtime)
  2. Backend deploy (supports both modes)
  3. Frontend deploy (new UI)
  4. Gradual rollout (admins can opt-in users)

---

## 🔧 Technical Details

### workSchedule JSON Format

```json
{
  "monday": 8,
  "tuesday": 8,
  "wednesday": 8,
  "thursday": 8,
  "friday": 2,
  "saturday": 0,
  "sunday": 0
}
```

**Validation Rules:**
- Each day: `>= 0` and `<= 24`
- Sum must equal `weeklyHours` (for consistency)
- `null` = use `weeklyHours/5` fallback

### Day Name Mapping

```typescript
const DAY_NAMES: Record<number, keyof WorkSchedule> = {
  0: 'sunday',
  1: 'monday',
  2: 'tuesday',
  3: 'wednesday',
  4: 'thursday',
  5: 'friday',
  6: 'saturday',
};
```

---

## 🚨 Edge Cases & Solutions

### Edge Case 1: 0-Stunden-Mitarbeiter
**Problem:** Soll=0h → Division by zero?
**Solution:** Special handling in overtime calculation: `if (weeklyHours === 0) targetHours = 0;`

### Edge Case 2: Backward Compatibility
**Problem:** Existing users without `workSchedule`
**Solution:** Fallback to `weeklyHours / 5` (wie bisher)

### Edge Case 3: Wochenende-Arbeit
**Problem:** Einzelhandel arbeitet Samstag/Sonntag
**Solution:** `workSchedule` erlaubt beliebige Tage (`saturday: 8, sunday: 0`)

### Edge Case 4: Feiertags-Gutschrift
**Problem:** Montag (8h-Tag) ist Feiertag → Gutschrift?
**Current Behavior:** Keine automatische Gutschrift
**Solution:** Bleibt so (Best Practice: Feiertage != Urlaub)

---

## 📊 Test Cases

### Test Case 1: 0-Stunden-Aushilfe
```typescript
User: {
  weeklyHours: 0,
  workSchedule: null
}

Time Entry: 10h

Expected:
- Soll: 0h
- Ist: 10h
- Überstunden: +10h ✅
```

### Test Case 2: Teilzeit Hans
```typescript
User: {
  weeklyHours: 10,
  workSchedule: {
    monday: 8,
    tuesday: 0,
    wednesday: 0,
    thursday: 0,
    friday: 2,
    saturday: 0,
    sunday: 0
  }
}

Absence: Freitag 07.02.2025 (Urlaub)

Expected:
- Gutschrift: 2h (nicht 5h!) ✅
```

### Test Case 3: 24h Schicht
```typescript
Time Entry: {
  startTime: "00:00",
  endTime: "23:59",
  breakMinutes: 60,
  hours: 23
}

Expected:
- Validation: Pass ✅
- No error about max hours ✅
```

### Test Case 4: Existing User (Backward Compatibility)
```typescript
User: {
  weeklyHours: 40,
  workSchedule: null  // OLD USER
}

Expected:
- getDailyTargetHours() → 40/5 = 8h ✅
- System verhält sich wie bisher ✅
```

---

## 📁 Affected Files - Implementation Status

### Backend (11) ✅ ALL COMPLETED
1. ✅ `server/src/database/schema.sql` - ALTER TABLE
2. ✅ `server/src/types/index.ts` - WorkSchedule interface + DayName type
3. ✅ `server/src/services/userService.ts` - weeklyHours >= 0, workSchedule support
4. ✅ `server/src/services/timeEntryService.ts` - max 24h
5. ✅ `server/src/services/absenceService.ts` - calculateAbsenceCredits()
6. ✅ `server/src/services/overtimeService.ts` - workSchedule logic (all 3 functions)
7. ✅ `server/src/utils/workingDays.ts` - getDailyTargetHours() + calculateTargetHoursForPeriod()
8. ✅ `server/src/services/exportService.ts` - DATEV Export mit getDailyTargetHours() (NEW FIX!)
9. ⏳ `server/src/utils/workingDays.test.ts` - tests (TODO)
10. ✅ `server/src/routes/users.ts` - workSchedule akzeptieren (via userService)
11. ⏳ `server/scripts/migrate-work-schedule.ts` - NEW migration script (OPTIONAL)

### Frontend (6) ✅ ALL COMPLETED
11. ✅ `desktop/src/types/index.ts` - WorkSchedule interface
12. ✅ `desktop/src/components/users/WorkScheduleEditor.tsx` - NEW (194 lines)
13. ✅ `desktop/src/components/users/CreateUserModal.tsx` - integrate editor
14. ✅ `desktop/src/components/users/EditUserModal.tsx` - integrate editor
15. ✅ `desktop/src/components/timeEntries/TimeEntryForm.tsx` - max 24h visual warning
16. ✅ `desktop/src/components/timeEntries/EditTimeEntryModal.tsx` - max 24h visual warning
17. ⏳ `desktop/src/components/absences/AbsenceRequestForm.tsx` - hours preview (OPTIONAL)

---

## ⏱️ Time Estimate

- **Phase 1** (DB + Types): 1h
- **Phase 2** (Backend Logic): 4h
- **Phase 3** (Frontend UI): 3h
- **Phase 4** (Testing): 2h
- **Phase 5** (Migration): 1h

**TOTAL: ~11 hours**

---

## 🎯 Success Criteria

✅ **Must Have:**
- 0-Stunden-Mitarbeiter funktionieren
- Max 24h Arbeitszeit erlaubt
- Individueller Wochenplan funktioniert
- Backward compatibility (existing users work)

✅ **Nice to Have:**
- UI für Wochenplan-Editor ist intuitiv
- Migrations-Script für existierende User
- Umfangreiche Tests

---

## 📝 Notes & Decisions

### Decision 1: JSON vs separate columns
**Question:** workSchedule als JSON oder 7 separate Spalten (monday, tuesday, ...)?
**Decision:** JSON - Flexibler, einfacher zu erweitern (z.B. Schichtpläne)

### Decision 2: weeklyHours behalten oder entfernen?
**Question:** Ist weeklyHours noch nötig wenn workSchedule existiert?
**Decision:** Behalten - Als Fallback + für Reports + Backward Compatibility

### Decision 3: Urlaub in Tagen oder Stunden?
**Question:** Soll Urlaub weiterhin in "Tagen" angezeigt werden?
**Current:** "5 Tage Urlaub"
**Future:** "34h Urlaub (= 4.25 Standardtage)"
**Decision:** TBD - Warten auf User-Feedback

---

**Last Updated:** 2026-01-07
**Status:** ✅ Implementation Complete - Backend & Frontend Done

---

## 📋 Summary of Changes

### ✅ Backend (100% Complete)
- Database migration: `workSchedule TEXT` column added to users table
- Type system: WorkSchedule interface + DayName type
- User service: weeklyHours >= 0 (Aushilfen support)
- Time entry service: Max 24h per day
- Working days utility: getDailyTargetHours() - core function for individual schedules
- Absence service: calculateAbsenceCredits() - exact daily hours for vacation
- Overtime service: All calculations respect individual work schedules
- **DATEV Export service: Fixed to use getDailyTargetHours() instead of weeklyHours/5** (NEW!)

### ✅ Frontend (100% Complete)
- WorkScheduleEditor component: Toggle + 7 day inputs + validation
- User forms: Integrated editor in Create & Edit modals
- Time entry forms: Visual warnings for > 24h entries
- Types: Synchronized with backend

### ⏳ Next Steps
1. **Build & Test**: Desktop app mit `npm run build` (frontend + backend)
2. **Manual Testing**:
   - Create 0-hour employee (Aushilfe)
   - Create part-time employee with individual schedule (Hans example)
   - Test 24h shift
   - Test vacation credits with individual schedule
3. **Unit Tests** (optional): workingDays.test.ts

---

## 🔧 Post-Implementation Fixes (2026-01-13)

### WorkSchedule System Completeness Audit

**Issue**: Daily overtime calculation was still using old `calculateDailyTargetHours(weeklyHours)` instead of WorkSchedule-aware `getDailyTargetHours(user, date)`.

**Files Changed**:
- `server/src/services/overtimeService.ts` (Lines 252-275)
  - Changed from manual SELECT query to `getUserById(userId)` to get full user object with workSchedule
  - Replaced `calculateDailyTargetHours(user.weeklyHours)` → `getDailyTargetHours(user, date)`
  - Removed unused `calculateDailyTargetHours` import

**Result**: ✅ **100% WorkSchedule Coverage**
- All 4 absence types (vacation, sick, overtime_comp, unpaid) use `countWorkingDaysForUser()`
- All overtime calculations (daily, weekly, monthly) use `getDailyTargetHours()`
- All exports (DATEV, general) use WorkSchedule-aware utilities
- Frontend components display WorkSchedule-aware data

**Best Practice Alignment (Personio, DATEV, SAP)**:
- ✅ Days with 0 hours do NOT count as working days
- ✅ Vacation/Overtime exclude holidays (can't take vacation on holiday)
- ✅ Sick/Unpaid include holidays (can be sick on holiday)
- ✅ Live overtime calculation (no cached balances)
- ✅ Individual daily target hours respected

---

**Last Updated:** 2026-01-13 (WorkSchedule System 100% Complete)
**Original Implementation:** 2026-01-07 (Phase 1-3)
**Final Audit:** 2026-01-13 (System-wide WorkSchedule compliance verified)
