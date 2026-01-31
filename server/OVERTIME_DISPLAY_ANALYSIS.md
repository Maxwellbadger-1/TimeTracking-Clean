# Überstunden-Anzeige im System - Vollständige Analyse

## Backend-Datenquellen

### 1. `overtime_balance` Tabelle (Monatlich)
**Struktur:**
```sql
month       | targetHours | actualHours | overtime
2025-12     | 156.0       | 149.0       | -7.0
2026-01     | 84.0        | 82.0        | -2.0
```

**Berechnung:** `overtime = actualHours - targetHours` (GENERATED COLUMN)

**User 155:**
- 2025-12: -7h
- 2026-01: -2h

---

## Backend API Endpunkte

### A. `/api/overtime/current` (AKTUELLES JAHR)
**Hook:** `useCurrentOvertimeStats(userId)`
**Service:** `getCurrentOvertimeStats()` → `getOvertimeSummary(userId, currentYear)`
**Logik:** Summiert `overtime` aus `overtime_balance` WHERE `month LIKE '2026-%'`
**User 155 Result:**
- totalYear: -2h (nur 2026-01)

---

### B. `/api/work-time-accounts/live` (ALLE JAHRE)
**Hook:** `useWorkTimeAccountLive(userId)`
**Service:** `calculateWorkTimeAccountLive()`
**Logik:**
```sql
SELECT COALESCE(SUM(overtime), 0) as totalOvertime
FROM overtime_balance
WHERE userId = ?
-- KEIN Jahr-Filter!
```
**User 155 Result:**
- currentBalance: -9h (2025-12: -7h + 2026-01: -2h)

⚠️ **POTENTIAL CONFUSION**: Zeigt GESAMTE Überstunden aller Zeit, nicht nur 2026!

---

### C. `/api/reports/overtime/history/{userId}` (LETZTEN N MONATE)
**Hook:** `useOvertimeHistory(userId, months=12)`
**Service:** `getOvertimeHistory()` → fallback `getOvertimeHistoryFromBalance()`
**Logik:**
1. Berechnet `startMonth` (N Monate zurück von heute)
2. Holt alle Monate >= startMonth
3. Berechnet `runningBalance` (kumulativ)
4. Frontend kann `earned` summieren pro Jahr

**User 155 Result (months=12):**
```json
[
  { month: "2025-12", earned: -7, balance: -7 },
  { month: "2026-01", earned: -2, balance: -9 }
]
```

**Frontend-Summierung möglich:**
- Gesamt Verdient (alle Monate): -9h
- 2025 Verdient: -7h
- 2026 Verdient: -2h

---

## Frontend-Komponenten

### 1. EmployeeDashboard (Dashboard Card)
**Location:** `desktop/src/components/dashboard/EmployeeDashboard.tsx:175`
**Hook:** `useCurrentOvertimeStats(userId)`
**Zeigt:** `overtimeStats?.totalYear` → **-2h** (nur 2026)

---

### 2. WorkTimeAccountWidget (Arbeitszeitkonto)
**Location:** `desktop/src/components/worktime/WorkTimeAccountWidget.tsx:140`
**Hook:** `useWorkTimeAccountLive(userId)`
**Zeigt:** `account.currentBalance` → **-9h** (ALLE Monate)

⚠️ **LABEL**: "Aktueller Saldo" (könnte als "2026 Saldo" missverstanden werden!)

---

### 3. WorkTimeAccountHistory (Monatliche Entwicklung)
**Location:** `desktop/src/components/worktime/WorkTimeAccountHistory.tsx`
**Hook:** `useOvertimeHistory(userId, 12)`
**Zeigt:**
- Tabelle mit pro-Monat breakdown
- "Gesamt Verdient": `history.reduce((sum, e) => sum + e.earned, 0)` → **-9h**
- "Aktueller Saldo": `history[history.length - 1].balance` → **-9h**

**MÖGLICH**: Wenn Frontend die History nach Jahr gruppiert und summiert:
- 2025: `history.filter(h => h.month.startsWith('2025')).reduce((sum, e) => sum + e.earned, 0)` → **-7h**
- 2026: `history.filter(h => h.month.startsWith('2026')).reduce((sum, e) => sum + e.earned, 0)` → **-2h**

---

## Mögliche Ursachen für "-13h für 2025"

1. **Alte Daten in DB** (aber aktuell nur -7h für 2025-12)
2. **Frontend cached alte Daten** (React Query Cache)
3. **Komponente filtert/summiert nach Jahr** (nicht gefunden in meiner Analyse)
4. **User schaut auf eine andere Komponente** (nicht in Standard-UI)
5. **Bug in Frontend-Berechnung** (z.B. doppelte Summierung)
6. **Extra -6h irgendwo** (z.B. alte Correction in DB?)

---

## Validation

### Database aktuell (User 155):
```sql
SELECT month, overtime FROM overtime_balance WHERE userId = 155;
-- 2025-12: -7h
-- 2026-01: -2h
```

### Corrections/Adjustments:
```sql
SELECT * FROM overtime_corrections WHERE userId = 155;
-- (Empty)

SELECT * FROM work_time_accounts WHERE userId = 155;
-- (Empty or currentBalance should match sum of overtime_balance)
```

---

## Nächste Schritte

1. User fragen: **Wo genau** siehst du "-13h für 2025"?
2. React Query Cache clearen im Frontend
3. Prüfen ob alte Daten in `overtime_balance` table (pre-12/2025)
4. Prüfen ob `overtime_corrections` table Einträge hat

