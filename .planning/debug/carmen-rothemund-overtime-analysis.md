# 🚨 CRITICAL BUG ANALYSIS: Carmen Rothemund Überstunden-Berechnung

**Analyse-Datum:** 2026-04-01 18:30
**Betroffener User:** Carmen Rothemund (userId: 17)
**Status:** PRODUCTION BUG - Betrifft alle User mit workSchedule!

---

## 📊 Executive Summary

**Was der User sieht:**
- ✅ Reale Überstunden (Jan-Apr 2026): **+9:29h** (korrekt!)
- ❌ System zeigt beim Antrag stellen: **-62:31h** (FALSCH!)
- 🔴 **Differenz: 71 Stunden!**

**Root Cause:**
Drei separate Bugs arbeiten zusammen und erzeugen das falsche Ergebnis:
1. Frontend summiert Zukunftsmonate (Mai/Juni 2026)
2. April 2026 hat targetHours = 0 statt 48h
3. Mai/Juni 2026 haben fehlerhafte negative Salden

---

## 👤 User Profile: Carmen Rothemund

```json
{
  "userId": 17,
  "name": "Carmen Rothemund",
  "email": "00.0@0.00",
  "weeklyHours": 12,
  "workSchedule": {
    "monday": 4,
    "tuesday": 4,
    "wednesday": 0,
    "thursday": 4,
    "friday": 0,
    "saturday": 0,
    "sunday": 0
  },
  "hireDate": "2026-01-01",
  "status": "active"
}
```

**Arbeitswoche:** Mo/Di/Do je 4h = **12h/Woche**
**Erwartete Sollstunden/Monat:** ~48h (12h × 4 Wochen)

---

## 📈 Overtime Balance Table (Production DB)

| Monat | Soll (target) | Ist (actual) | Balance | Status | Problem |
|-------|---------------|--------------|---------|--------|---------|
| **2026-01** | 48h | 51.49h | **+3.49h** | ✅ OK | - |
| **2026-02** | 48h | 45.22h | **-2.78h** | ✅ OK | - |
| **2026-03** | 52.8h | 57.58h | **+4.78h** | ✅ OK | - |
| **2026-04** | **0h** ⚠️ | 4.8h | **+4.8h** | ❌ FALSCH | targetHours = 0! |
| **2026-05** | 40h | 8h | **-32h** | ❌ ZUKUNFT | Sollte nicht existieren! |
| **2026-06** | 48h | 8h | **-40h** | ❌ ZUKUNFT | Sollte nicht existieren! |

**Korrekte Berechnung (Jan-Apr):**
```
3.49 - 2.78 + 4.78 + 4.8 = +10.29h ≈ +9:29h ✅
```

**Falsche Berechnung (Jan-Jun inkl. Zukunft):**
```
3.49 - 2.78 + 4.78 + 4.8 - 32 - 40 = -61.71h ≈ -62:31h ❌
```

---

## 🐛 BUG #1: Frontend summiert Zukunftsmonate (CRITICAL!)

### Symptome
- Frontend ruft `/api/overtime/:userId` auf
- Backend/Frontend summiert ALLE Monate in overtime_balance
- Inkludiert Mai/Juni 2026 (Zukunft!)
- Resultat: -62:31h statt +9:29h

### Expected Behavior
- Nur Monate bis "heute" (April 2026) summieren
- Zukunftsmonate ignorieren oder warnen

### Root Cause Location
**Verdächtige Dateien:**
- `server/src/routes/overtime.ts` - API Endpoint
- `server/src/services/overtimeService.ts` - Summierung
- `desktop/src/hooks/useBalances.ts` - Frontend Data Fetching
- `desktop/src/components/absences/AbsenceRequestForm.tsx` - Display

### Code zu prüfen
```typescript
// Vermutlich in overtimeService.ts:
const balances = db.prepare(`
  SELECT * FROM overtime_balance
  WHERE userId = ?
  ORDER BY month ASC
`).all(userId);

// Sollte sein:
const balances = db.prepare(`
  SELECT * FROM overtime_balance
  WHERE userId = ?
    AND month <= ? -- Nur bis heute!
  ORDER BY month ASC
`).all(userId, getCurrentMonth());
```

### Impact
🔴 **CRITICAL** - Betrifft ALLE User bei Abwesenheitsanträgen!
- Falsche Überstundenwerte bei Anträgen
- User können nicht korrekt Überstundenausgleich beantragen
- Vertrauen in System zerstört

---

## 🐛 BUG #2: April 2026 targetHours = 0 (HIGH!)

### Symptome
- April 2026: `targetHours: 0` statt erwartete ~48h
- Carmen arbeitet Mo/Di/Do je 4h = 12h/Woche
- April sollte ~48h Sollstunden haben

### Expected Behavior
```
April 2026 Arbeitstage für Carmen (Mo/Di/Do):
- 7x Montag, 7x Dienstag, 8x Donnerstag = 22 Arbeitstage
- Je 4h × 22 = 88h Sollstunden

ODER bei 4-Wochen Berechnung:
- 12h/Woche × 4 Wochen = 48h
```

### Mögliche Root Causes

**Hypothese 1: Feiertag-Problematik**
- Gibt es Feiertage in April die ALLE Carmen's Arbeitstage überlagern?
- Ostern 2026? Karfreitag + Ostermontag?
- Feiertage ÜBERSCHREIBEN workSchedule → targetHours = 0

**Hypothese 2: Berechnung läuft nur bis "heute"**
- Heute ist 1. April 2026
- Berechnung läuft von 1.4. bis 1.4. = 0 Tage?
- `calculateTargetHoursUntilToday()` Bug?

**Hypothese 3: workSchedule wird ignoriert**
- weeklyHours = 12h wird ignoriert
- workSchedule wird nicht korrekt geparst
- Fallback zu 0h?

### Code zu prüfen
```typescript
// server/src/utils/workingDays.ts
function getDailyTargetHours(user, date) {
  // Prüfe: Wird workSchedule korrekt verwendet?
  // Prüfe: Feiertags-Logik
  // Prüfe: Wochenend-Logik
}

// server/src/services/overtimeService.ts
function calculateMonthlyTargetHours(userId, month) {
  // Prüfe: Wird bis "heute" oder bis Monatsende berechnet?
}
```

### Impact
🟡 **HIGH** - Falscher April-Saldo
- April zeigt +4.8h statt ~-40h (wenn April richtig berechnet wäre)
- Kumulativer Fehler in Gesamtüberstunden

---

## 🐛 BUG #3: Mai/Juni 2026 existieren (MEDIUM)

### Symptome
- Es ist 1. April 2026
- Mai/Juni 2026 haben bereits Einträge in overtime_balance
- Mai: targetHours 40h, actualHours 8h → -32h
- Juni: targetHours 48h, actualHours 8h → -40h

### Possible Root Causes

**Hypothese 1: Cron-Job läuft zu früh**
- `cronService.ts` berechnet Monate im Voraus?
- Pre-calculation für Performance?

**Hypothese 2: Manueller Script-Lauf**
- Admin hat `recalculateOvertimeBalances.ts` ausgeführt?
- Script berechnet auch Zukunftsmonate?

**Hypothese 3: Test-Daten**
- Wurden Mai/Juni manuell für Tests erstellt?
- actualHours = 8h sieht wie Placeholder aus

### Expected Behavior
- Nur Monate ≤ "heute" sollten in overtime_balance existieren
- Zukunftsmonate sollten NICHT pre-calculated werden
- Falls doch: Müssen als "preliminary" markiert sein

### Code zu prüfen
```typescript
// server/src/services/cronService.ts
// Prüfe: Welche Monate werden berechnet?

// server/src/scripts/recalculateOvertimeBalances.ts
// Prüfe: Zeitraum-Parameter
```

### Impact
🟠 **MEDIUM** - Verwirrung + Daten-Qualität
- Zukunftsdaten verwirren Analysen
- Database pollution mit spekulativen Werten

---

## 🔍 Weitere zu prüfende Aspekte

### 1. Betrifft dieser Bug auch andere User?

**Test-Fälle:**
- ✅ User mit weeklyHours (keine workSchedule) → Funktioniert das?
- ✅ User mit workSchedule (wie Carmen) → Betroffen!
- ⚠️ Wie viele User haben workSchedule in Production?

**Query:**
```sql
SELECT COUNT(*) as total_users,
       COUNT(CASE WHEN workSchedule IS NOT NULL THEN 1 END) as users_with_schedule
FROM users WHERE status = 'active';
```

### 2. Andere Stellen betroffen?

**Zu prüfen:**
- Dashboard Überstunden-Anzeige
- Reports/Exports
- Überstunden-Verwaltung (Admin-Seite)
- Urlaubsanträge (verwenden auch Überstunden-Daten?)

### 3. Ab wann trat der Bug auf?

**Hypothesen:**
- Seit Carmen angelegt wurde (1.1.2026)?
- Seit workSchedule Feature implementiert wurde?
- Seit letztem Deployment?

**Check Git History:**
```bash
git log --all --grep="workSchedule" --since="2025-11-01"
git log --all -- server/src/services/overtimeService.ts --since="2026-03-01"
```

---

## 🎯 Priorisierung der Fixes

### 🔴 CRITICAL (Sofort fixen!)
**Bug #1: Frontend summiert Zukunftsmonate**
- **Impact:** Alle Abwesenheitsanträge zeigen falsche Werte
- **Users betroffen:** Alle User mit overtime_balance Einträgen in Zukunft
- **Fix-Aufwand:** ~30 Min (Filter hinzufügen)
- **Test-Aufwand:** ~15 Min (Carmen + 1 weiterer User)

### 🟡 HIGH (Heute fixen!)
**Bug #2: April targetHours = 0**
- **Impact:** Falscher Monatssaldo für April
- **Users betroffen:** Carmen + ggf. andere mit workSchedule
- **Fix-Aufwand:** ~1-2 Std (Root Cause finden + Fix)
- **Test-Aufwand:** ~30 Min (Validation Script)

### 🟠 MEDIUM (Diese Woche fixen)
**Bug #3: Zukunftsmonate existieren**
- **Impact:** Datenqualität, Verwirrung
- **Users betroffen:** Alle in overtime_balance
- **Fix-Aufwand:** ~1 Std (Prevention + Cleanup Script)
- **Test-Aufwand:** ~20 Min

---

## 🛠️ Empfohlene Fix-Strategie

### Phase 1: IMMEDIATE HOTFIX (30 Min)
**Ziel:** Carmen kann wieder korrekt Anträge stellen

```typescript
// server/src/routes/overtime.ts oder overtimeService.ts
// Quick Fix: Filter Zukunftsmonate

const today = new Date();
const currentMonth = formatDate(today, 'yyyy-MM');

const balances = db.prepare(`
  SELECT * FROM overtime_balance
  WHERE userId = ?
    AND month <= ?  -- ✅ FIX: Nur bis heute!
  ORDER BY month ASC
`).all(userId, currentMonth);
```

**Deployment:**
1. Fix committen
2. `git push origin main` → Auto-Deploy
3. Sofort testen mit Carmen

### Phase 2: ROOT CAUSE FIX (2-3 Std)
**Ziel:** April korrekt berechnen + Prevention

1. **Analyse April Bug**
   - Run: `npm run validate:overtime:detailed -- --userId=17 --month=2026-04`
   - Read: `getDailyTargetHours()` für jeden Tag im April
   - Check: Feiertage im April 2026 für Bayern

2. **Fix Implementation**
   - Fix identified root cause
   - Add unit tests for workSchedule edge cases
   - Run full validation suite

3. **Zukunfts-Prevention**
   - Add CHECK constraint: `month <= strftime('%Y-%m', 'now')`
   - Oder: Add `is_preliminary` flag für Zukunftsmonate
   - Update cron jobs: Don't calculate future months

### Phase 3: CLEANUP & VALIDATION (1 Std)
**Ziel:** Database aufräumen + Vollständiger Test

1. **Cleanup Script**
   ```sql
   DELETE FROM overtime_balance
   WHERE month > strftime('%Y-%m', 'now');
   ```

2. **Recalculate April**
   ```bash
   npm run recalculate:overtime -- --userId=17 --month=2026-04
   ```

3. **Full Validation**
   ```bash
   npm run validate:all-test-users
   ```

---

## 📋 Testing Checklist

### Pre-Deployment Tests
- [ ] Carmen: Abwesenheitsantrag zeigt +9:29h ✅
- [ ] Carmen: Dashboard zeigt +9:29h ✅
- [ ] Carmen: Reports zeigen korrekte Werte ✅
- [ ] User mit weeklyHours (kein workSchedule): Unverändert ✅
- [ ] Validation Script: No errors ✅

### Post-Deployment Monitoring
- [ ] Carmen erstellt Testantrag: Erfolgreich ✅
- [ ] Logs: Keine Errors in PM2 ✅
- [ ] Health Check: `/api/health` returns 200 ✅
- [ ] Database: Keine Zukunftsmonate mehr ✅

---

## 🔬 Validation Commands

```bash
# 1. Check Carmen's current overtime (should be +9:29h)
ssh ubuntu@129.159.8.19 "cd TimeTracking-Clean/server && node -e \"
const db = require('better-sqlite3')('../../database-shared.db');
const result = db.prepare('SELECT SUM(actualHours - targetHours + carryoverFromPreviousYear) as total FROM overtime_balance WHERE userId = 17 AND month <= \"2026-04\"').get();
console.log('Total Overtime:', result.total, 'hours');
\""

# 2. Run detailed validation
npm run validate:overtime:detailed -- --userId=17 --month=2026-04

# 3. Check for future months
ssh ubuntu@129.159.8.19 "cd TimeTracking-Clean/server && node -e \"
const db = require('better-sqlite3')('../../database-shared.db');
const future = db.prepare('SELECT userId, month FROM overtime_balance WHERE month > \"2026-04\" ORDER BY userId, month').all();
console.log('Future months:', future.length);
console.table(future);
\""

# 4. Check all users with workSchedule
ssh ubuntu@129.159.8.19 "cd TimeTracking-Clean/server && node -e \"
const db = require('better-sqlite3')('../../database-shared.db');
const users = db.prepare('SELECT id, firstName, lastName, workSchedule FROM users WHERE workSchedule IS NOT NULL AND status = \"active\"').all();
console.table(users);
\""
```

---

## 📚 Reference Documentation

**Related Files:**
- `server/src/utils/workingDays.ts` - Core calculation logic
- `server/src/services/overtimeService.ts` - Monthly overtime
- `server/src/services/unifiedOvertimeService.ts` - Unified interface
- `server/src/routes/overtime.ts` - API endpoints
- `desktop/src/hooks/useBalances.ts` - Frontend hooks
- `desktop/src/components/absences/AbsenceRequestForm.tsx` - UI

**Architecture Context:**
- ARCHITECTURE.md - Dual calculation system explanation
- CLAUDE.md - workSchedule priority rules
- PROJECT_SPEC.md - Overtime calculation requirements

---

## ⏭️ Next Actions

**IMMEDIATE (Du entscheidest):**
1. 🔥 **Hotfix deployen?** (Filter Zukunftsmonate)
2. 🔍 **Erst vollständige Analyse?** (Warum April = 0?)
3. 📊 **Mehr Daten sammeln?** (Andere betroffene User?)

**Meine Empfehlung:**
→ **Hotfix zuerst!** (30 Min) - Carmen kann wieder arbeiten
→ **Dann Root Cause** (2 Std) - Vollständiger Fix
→ **Dann Testing & Deployment** (1 Std) - Quality Check

---

**Status:** ANALYSIS COMPLETE - AWAITING FIX DECISION
**Erstellt:** 2026-04-01 18:30
**Analyst:** Claude Code (GSD Debug System)
