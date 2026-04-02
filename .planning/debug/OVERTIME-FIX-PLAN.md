# 🔧 OVERTIME FIX PLAN - Production Ready

**Bug:** Überstunden-Berechnung inkludiert Zukunftsmonate (Mai/Juni 2026)
**Impact:** Carmen & Benedikt sehen -62h statt +9h
**Root Cause:** `getOvertimeSummary()` filtert nicht bis `endMonth`
**Fix:** 1 Zeile Code + 1 Parameter
**Status:** ✅ Root Cause identifiziert, Ready to Fix

---

## 📊 ROOT CAUSE SUMMARY

**File:** `server/src/services/overtimeService.ts:629-636`

```typescript
// ❌ BUGGY CODE:
const monthlyRaw = db.prepare(`
  SELECT month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = ?
    AND month LIKE ?
    AND month >= strftime('%Y-%m', ?)
    -- FEHLT: AND month <= ?
`).all(userId, `${year}-%`, hireDate);

// ✅ FIXED CODE:
const monthlyRaw = db.prepare(`
  SELECT month, targetHours, actualHours, overtime
  FROM overtime_balance
  WHERE userId = ?
    AND month LIKE ?
    AND month >= strftime('%Y-%m', ?)
    AND month <= ?  -- ✅ FIX
`).all(userId, `${year}-%`, hireDate, endMonth);
```

**Warum der Bug?**
- Carmen/Benedikt haben genehmigten Urlaub im Mai/Juni (Zukunft)
- System erstellt `overtime_balance` Einträge für Mai/Juni
- Query holt ALLE "2026-%" Monate → Inkludiert Zukunft!
- Summe: Jan-Apr (+9h) + Mai (-32h) + Juni (-40h) = **-62h** ❌

**Nach Fix:**
- Query holt nur bis `endMonth = "2026-04"`
- Summe: Jan-Apr = **+9h** ✅

---

## 🗄️ PHASE 1: DB BACKUP & COPY WORKFLOW

### 1.1 Backup Blue DB (Production)

```bash
# SSH zu Production Server
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19

# Erstelle Backup mit Timestamp
cd ~
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
cp database-shared.db "backups/database-shared-BEFORE-FIX-${TIMESTAMP}.db"

# Verify Backup
ls -lh "backups/database-shared-BEFORE-FIX-${TIMESTAMP}.db"
# Erwartung: ~800 KB

# Exit SSH
exit
```

### 1.2 Copy zu Local Dev Environment

```bash
# Download Production DB zu Local
scp -i .ssh/oracle_server.key \
  ubuntu@129.159.8.19:database-shared.db \
  server/database.db

# Verify Local Copy
ls -lh server/database.db
# Erwartung: ~800 KB, gleiche Größe wie Production

# Test: DB ist lesbar
sqlite3 server/database.db "SELECT COUNT(*) FROM users WHERE status='active'"
# Erwartung: 16 (active users)
```

### 1.3 Verify Test Data (Carmen & Benedikt)

```bash
# Check Carmen's Data
sqlite3 server/database.db "
SELECT id, firstName, lastName, weeklyHours, workSchedule
FROM users WHERE id = 17
"
# Erwartung: 17|Carmen|Rothemund|12|{"monday":4,...}

# Check Benedikt's Data
sqlite3 server/database.db "
SELECT id, firstName, lastName, weeklyHours
FROM users WHERE id = 16
"
# Erwartung: 16|Benedikt|Jochem|30|

# Check Future Months
sqlite3 server/database.db "
SELECT userId, month,
       (actualHours - targetHours + carryoverFromPreviousYear) as balance
FROM overtime_balance
WHERE userId IN (16, 17) AND month > '2026-04'
ORDER BY userId, month
"
# Erwartung:
#   16|2026-05|-78
#   16|2026-06|-78
#   17|2026-05|-32
#   17|2026-06|-40
```

**✅ Phase 1 Complete:** Production DB gesichert + Lokal kopiert

---

## 💻 PHASE 2: FIX IMPLEMENTATION

### 2.1 Code-Änderung

**File:** `server/src/services/overtimeService.ts`

```diff
export async function getOvertimeSummary(userId: number, year: number): Promise<OvertimeSummary> {
  // ... (Lines 595-628 unverändert)

  // Get monthly overtime (only from hireDate onwards)
  const monthlyRaw = db
    .prepare(
      `SELECT month, targetHours, actualHours, overtime
       FROM overtime_balance
       WHERE userId = ? AND month LIKE ? AND month >= strftime('%Y-%m', ?)
+      AND month <= ?
       ORDER BY month DESC`
    )
-   .all(userId, `${year}-%`, hireDate) as MonthlyOvertime[];
+   .all(userId, `${year}-%`, hireDate, endMonth) as MonthlyOvertime[];

  // ... (Rest unverändert)
}
```

**Änderungen:**
1. Zeile 633: `AND month <= ?` hinzufügen
2. Zeile 636: `, endMonth` Parameter ergänzen

### 2.2 Apply Fix

```bash
# Open file
code server/src/services/overtimeService.ts

# Navigate to Line 629-636
# Apply the diff above

# Save file
```

**WICHTIG:** Nur diese 2 Zeilen ändern, nichts anderes!

### 2.3 Verify TypeScript Compilation

```bash
cd server
npx tsc --noEmit
# Erwartung: Keine Errors
```

**✅ Phase 2 Complete:** Fix implementiert, TypeScript kompiliert

---

## 🧪 PHASE 3: LOCAL TESTING

### 3.1 Unit Test für Fix

**Create:** `server/src/services/overtimeService.test.ts`

```typescript
import { describe, it, expect, beforeAll } from 'vitest';
import { getOvertimeSummary } from './overtimeService.js';

describe('getOvertimeSummary - Future Month Filter Bug Fix', () => {
  it('should NOT include future months in totalOvertime calculation', async () => {
    // Carmen (userId: 17) has overtime_balance entries for May/June (future)
    const summary = await getOvertimeSummary(17, 2026);

    // Should only sum Jan-Apr (current month)
    // NOT include May (-32h) and June (-40h)
    expect(summary.totalOvertime).toBeGreaterThan(0);
    expect(summary.totalOvertime).toBeCloseTo(9.49, 1); // ~9:29h

    // Should only have 4 months (Jan-Apr), NOT 6 (Jan-Jun)
    expect(summary.monthly).toHaveLength(4);
    expect(summary.monthly.map(m => m.month)).toEqual([
      '2026-04',
      '2026-03',
      '2026-02',
      '2026-01',
    ]);
  });

  it('should handle Benedikt correctly (no workSchedule)', async () => {
    const summary = await getOvertimeSummary(16, 2026);

    // Benedikt should also only have Jan-Apr
    expect(summary.totalOvertime).toBeGreaterThan(0);
    expect(summary.totalOvertime).toBeCloseTo(17.5, 1);
    expect(summary.monthly).toHaveLength(4);
  });
});
```

**Run Test:**

```bash
cd server
npm test -- overtimeService.test.ts

# Erwartung: ✅ 2/2 tests passed
```

### 3.2 Manual Integration Test (Local Server)

```bash
# Terminal 1: Start Local Server mit Production DB
cd server
npm run dev
# Server läuft auf localhost:3000

# Terminal 2: Test API Endpoint
curl http://localhost:3000/api/overtime/17 \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Erwartung (NACH Fix):
# {
#   "success": true,
#   "data": {
#     "overtime": 9.49  // ✅ NICHT -62.51!
#   }
# }

# Test Benedikt auch
curl http://localhost:3000/api/overtime/16 \
  -H "Cookie: connect.sid=YOUR_SESSION_COOKIE"

# Erwartung:
# { "overtime": 17.5 }  // ✅ NICHT -138.5!
```

**✅ Phase 3 Complete:** Tests erfolgreich, Fix funktioniert lokal

---

## 🚀 PHASE 4: DEPLOYMENT

### 4.1 Pre-Deployment Checklist

```bash
☐ TypeScript kompiliert ohne Errors (npx tsc --noEmit)
☐ Unit Tests erfolgreich (npm test)
☐ Integration Test lokal erfolgreich
☐ Production DB Backup existiert
☐ Git Status clean (alle Änderungen committed)
```

### 4.2 Commit & Push

```bash
# Check Status
git status
# Erwartung: Modified: server/src/services/overtimeService.ts

# Review Changes
git diff server/src/services/overtimeService.ts
# Verify: Nur die 2 Zeilen geändert

# Stage & Commit
git add server/src/services/overtimeService.ts

# Optional: Unit Test auch committen
git add server/src/services/overtimeService.test.ts

# Commit mit aussagekräftiger Message
git commit -m "fix: Overtime calculation excludes future months

- Add endMonth filter to getOvertimeSummary() query
- Prevents including future overtime_balance entries (May/June)
- Fixes Carmen/Benedikt showing -62h instead of +9h

Root Cause: Users with approved future vacation create
overtime_balance entries for future months. Query was
fetching ALL year months instead of only up to current month.

Fix: Add 'AND month <= ?' filter + endMonth parameter

Tested:
- Carmen (userId 17): -62.51h → +9.49h ✅
- Benedikt (userId 16): -138.5h → +17.5h ✅

Analysis: .planning/debug/carmen-rothemund-overtime-analysis.md
"

# Push to Main (triggers Auto-Deploy)
git push origin main
```

### 4.3 Monitor Deployment

```bash
# Watch GitHub Actions
gh run watch

# Erwartung nach ~2-3 Min:
# ✅ Type check passed
# ✅ Security audit passed
# ✅ Deploy to production completed

# Verify Server Health
curl http://129.159.8.19:3000/api/health
# Erwartung: {"status":"ok","database":"connected"}
```

### 4.4 Production Verification

```bash
# Test Carmen's Overtime (sollte jetzt +9h sein)
curl http://129.159.8.19:3000/api/overtime/17 \
  -H "Cookie: YOUR_PROD_SESSION"

# Erwartung:
# { "overtime": 9.49 }  ✅

# Test Benedikt's Overtime
curl http://129.159.8.19:3000/api/overtime/16 \
  -H "Cookie: YOUR_PROD_SESSION"

# Erwartung:
# { "overtime": 17.5 }  ✅
```

### 4.5 User Acceptance Test

**Carmen (Desktop App):**
1. Öffne Abwesenheiten → Neuer Antrag
2. Typ: Überstundenausgleich
3. **Erwartung:** "Verfügbar: +9:29h" (nicht -62:31h!)

**Benedikt (Desktop App):**
1. Öffne Abwesenheiten → Neuer Antrag
2. Typ: Überstundenausgleich
3. **Erwartung:** "Verfügbar: +17:30h"

**✅ Phase 4 Complete:** Fix deployed, verifiziert, User können arbeiten

---

## 🔄 ROLLBACK PLAN (Falls nötig)

### Option A: Git Revert (Schnell)

```bash
# Get commit hash
git log -1 --oneline
# z.B.: abc1234 fix: Overtime calculation excludes future months

# Revert
git revert abc1234
git push origin main
# Auto-Deploy läuft, alter Code ist wieder live
```

### Option B: Database Restore (Extreme)

```bash
# Nur falls DB korrupt! (Sehr unwahrscheinlich)
ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19

# Liste Backups
ls -lh backups/database-shared-BEFORE-FIX-*

# Restore
cp backups/database-shared-BEFORE-FIX-20260401_*.db database-shared.db

# Restart Server
pm2 restart timetracking-server

# Verify
curl http://129.159.8.19:3000/api/health
```

---

## 📋 KNOWN ISSUES & FOLLOW-UPS

### Issue 1: April 2026 targetHours = 0

**Status:** Separate Issue (nicht kritisch)
**Symptom:** Carmen & Benedikt haben April targetHours=0 statt erwartete Werte
**Impact:** Gering (April Balance = 0 statt negativer Wert)
**Next Step:** Separate Analyse in neuer Session

### Issue 2: Future Months Prevention

**Status:** Design Question
**Frage:** Sollen Zukunftsmonate überhaupt erstellt werden?
**Optionen:**
1. Prevention: Keine overtime_balance für Zukunft erstellen
2. Flag: `is_preliminary` flag für Zukunftsmonate
3. Leave as-is: Fix hält Zukunft aus Summierung raus (✅ Done)

**Decision:** Option 3 für jetzt, Option 1 später evaluieren

---

## ✅ SUCCESS CRITERIA

**DONE when:**
- ✅ Carmen sieht +9:29h (nicht -62:31h)
- ✅ Benedikt sieht +17:30h (nicht -138h)
- ✅ Andere User unverändert (keine Regression)
- ✅ Tests erfolgreich (Unit + Integration + UAT)
- ✅ Deployment successful
- ✅ Backup existiert (Rollback möglich)

---

## 📞 CONTACTS & LINKS

**Production Server:** ubuntu@129.159.8.19
**Health Check:** http://129.159.8.19:3000/api/health
**GitHub Actions:** https://github.com/Maxwellbadger-1/TimeTracking-Clean/actions
**PM2 Logs:** `ssh ubuntu@129.159.8.19 "pm2 logs timetracking-server"`

**Debug Files:**
- Analysis: `.planning/debug/carmen-rothemund-overtime-analysis.md`
- This Plan: `.planning/debug/OVERTIME-FIX-PLAN.md`

---

**Plan Status:** ✅ READY TO EXECUTE
**Estimated Time:**
- Phase 1 (Backup): ~5 Min
- Phase 2 (Fix): ~5 Min
- Phase 3 (Test): ~15 Min
- Phase 4 (Deploy): ~10 Min
- **Total:** ~35 Min

**Next Command:** Start with Phase 1 DB Backup in fresh context window
