# User 5 Überstunden-Analyse - Komplette Gegenüberstellung

**User:** Maximilian Fegg4 (ID=5)
**Zeitraum:** Januar 2026 (2026-01-01 bis 2026-02-02)
**Erstellt:** 2026-02-02
**Status:** ⚠️ DISKREPANZEN GEFUNDEN

---

## 1. DATABASE - Rohe Werte

### 1.1 overtime_balance (Januar 2026)

```sql
SELECT * FROM overtime_balance WHERE userId=5 AND month='2026-01'
```

| userId | month   | targetHours | actualHours | overtime | carryoverFromPreviousYear |
|--------|---------|-------------|-------------|----------|---------------------------|
| 5      | 2026-01 | 38.0        | 36.0        | -2.0     | 0.0                       |

**Interpretation:**
- Soll: 38h (19 Arbeitstage × 2h/Tag)
- Ist: 36h (gearbeitete Stunden)
- **⚠️ DISKREPANZ:** actualHours = 36h, ABER es gibt +2h Korrektur!
- **Erwartet:** actualHours = 38h (36h + 2h correction)

---

### 1.2 time_entries (Januar 2026)

```sql
SELECT date, hours FROM time_entries WHERE userId=5 AND date LIKE '2026-01%'
```

| date       | hours |
|------------|-------|
| 2026-01-01 | 8.5   |
| 2026-01-02 | 2.0   |
| 2026-01-03 | 8.5   |
| 2026-01-05 | 8.5   |
| 2026-01-06 | 8.5   |

**Summe:** 36.0h ✅

---

### 1.3 overtime_corrections (Januar 2026)

```sql
SELECT * FROM overtime_corrections WHERE userId=5
```

| id | userId | date       | hours | reason          | correctionType | createdBy | createdAt           |
|----|--------|------------|-------|-----------------|----------------|-----------|---------------------|
| 4  | 5      | 2026-01-08 | 2.0   | Test ausgleich  | adjustment     | 1         | 2026-01-30 13:02:37 |

**Total Corrections:** +2.0h

**⚠️ PROBLEM:** Diese Korrektur ist NICHT in overtime_balance.actualHours (36h) eingerechnet!

---

### 1.4 absence_requests (Januar 2026)

```sql
SELECT * FROM absence_requests WHERE userId=5 AND status='approved'
```

| id | userId | type   | startDate  | endDate    | days | status   |
|----|--------|--------|------------|------------|------|----------|
| 13 | 5      | unpaid | 2026-01-07 | 2026-01-07 | 1    | approved |
| 12 | 5      | sick   | 2026-02-02 | 2026-02-02 | 1    | approved |

**Januar:**
- 1 Tag unbezahlter Urlaub (2026-01-07)
- Reduziert Soll-Stunden um 2h
- KEINE Gutschrift auf Ist-Stunden

---

### 1.5 overtime_transactions (Januar 2026)

```sql
SELECT * FROM overtime_transactions
WHERE userId=5 AND date LIKE '2026-01%'
ORDER BY date, type
```

| id  | date       | type               | hours   | description                              |
|-----|------------|--------------------|---------|------------------------------------------|
| 254 | 2026-01-01 | earned             | 8.5     | Überstunden verdient: 8.50h gearbeitet   |
| 253 | 2026-01-02 | earned             | 0.0     | Tag ohne Zeiteinträge: 0.00h gearbeitet  |
| 256 | 2026-01-03 | earned             | 8.5     | Überstunden verdient: 8.50h gearbeitet   |
| 257 | 2026-01-05 | earned             | 6.5     | Überstunden verdient: 8.50h gearbeitet   |
| 258 | 2026-01-06 | earned             | 8.5     | Überstunden verdient: 8.50h gearbeitet   |
| 259 | 2026-01-07 | earned             | -2.0    | Abwesenheit (unpaid): Soll/Ist-Differenz |
| 262 | 2026-01-07 | earned             | -2.0    | Tag ohne Zeiteinträge: -2.00h (Minusst.) |
| 263 | 2026-01-07 | unpaid_adjustment  | 2.0     | Unpaid leave: 2026-01-07                 |
| 261 | 2026-01-08 | correction         | 2.0     | Test ausgleich                           |
| 252 | 2026-02-01 | earned             | 0.0     | Tag ohne Zeiteinträge: 0.00h gearbeitet  |

**Summe (nur Januar 2026-01-*):**
```
8.5 + 0.0 + 8.5 + 6.5 + 8.5 + (-2.0) + (-2.0) + 2.0 + 2.0 = 32.0h
```

**⚠️ INKONSISTENZ:**
- Transaction id=257 zeigt `hours=6.5h`, description sagt "8.50h gearbeitet"
- Transaction id=259 und id=262 sind DUPLIKATE für 2026-01-07 (beide `earned`, beide -2h)
- SUM(32h) stimmt NICHT mit overtime_balance.overtime (-2h) überein

---

## 2. BACKEND API CODE - Wie werden Daten berechnet?

### 2.1 overtimeService.ts - Schreibt in overtime_balance

**Funktion:** `updateMonthlyOvertime(userId, month)` (Line 419-539)

**Berechnung (Line 504-507):**
```typescript
const overtimeCorrections = getTotalCorrectionsForUserInMonth(userId, month);
const actualHoursWithCredits = workedHours.total + absenceCredits + overtimeCorrections;
```

**Schreibt in DB (Line 519-524):**
```typescript
db.prepare(`
  INSERT INTO overtime_balance (userId, month, targetHours, actualHours)
  VALUES (?, ?, ?, ?)
  ON CONFLICT(userId, month)
  DO UPDATE SET targetHours = ?, actualHours = ?
`).run(userId, month, adjustedTargetHours, actualHoursWithCredits, ...);
```

**✅ SOLLTE FUNKTIONIEREN:**
- Holt Corrections via `getTotalCorrectionsForUserInMonth()`
- Addiert sie zu actualHours

**⚠️ PROBLEM:**
- DB zeigt actualHours=36h (OHNE Correction)
- **Ursache:** `updateMonthlyOvertime()` wurde nach Correction-Erstellung NICHT aufgerufen!
- Correction wurde am 2026-01-30 erstellt, aber Balance nicht neu berechnet

---

### 2.2 reportService.ts - Liest overtime_balance + berechnet Daily Breakdown

**Funktion:** `getUserOvertimeReport(userId, year, month)` (Line 94-246)

**Liest overtime_balance (Line 139-149):**
```typescript
const monthKey = `${year}-${String(month).padStart(2, '0')}`;
const dbData = getMonthlyOvertimeFromDB(userId, monthKey);

summary = {
  targetHours: dbData.target,     // 38h
  actualHours: dbData.actual,     // 36h (FALSCH, sollte 38h sein!)
  overtime: dbData.overtime,      // -2h (FALSCH, sollte 0h sein!)
};
```

**Daily Breakdown inkludiert Corrections (Line 328-335):**
```typescript
const correctionsResult = db.prepare(`
  SELECT COALESCE(SUM(hours), 0) as total
  FROM overtime_corrections
  WHERE userId = ? AND date = ?
`).get(userId, date);

const actual = workedResult.total + absenceCredit + correctionsResult.total;
```

**✅ INKONSISTENZ:**
- Summary liest FALSCHE Werte aus overtime_balance (36h statt 38h)
- Daily Breakdown berechnet KORREKT (inkl. Corrections)

---

### 2.3 overtimeLiveCalculationService.ts - Berechnet Frontend "Zeitkonto-Saldo"

**Funktion:** `calculateCurrentOvertimeBalance(userId, fromDate, toDate)` (Line 437-451)

**Berechnung:**
```typescript
const transactions = calculateLiveOvertimeTransactions(userId, fromDate, toDate);

// Sum only "earned" and "correction" types
const balance = transactions
  .filter((t) => t.type === 'earned' || t.type === 'correction')
  .reduce((sum, t) => sum + t.hours, 0);

return Math.round(balance * 100) / 100;
```

**WICHTIG:**
- Liest NICHT aus overtime_balance!
- Summiert overtime_transactions mit type='earned' ODER type='correction'
- Absences (vacation_credit, sick_credit, etc.) werden IGNORIERT

**⚠️ PROBLEM:**
- User sieht -8.5h im Frontend
- DB SUM(overtime_transactions WHERE type IN ('earned','correction')) = +32h für Januar
- **DISKREPANZ:** Frontend zeigt anderen Wert als DB!

---

## 3. FRONTEND CODE - Was wird angezeigt?

### 3.1 OvertimeTransactions Component

**Datei:** `desktop/src/components/worktime/OvertimeTransactions.tsx`

**Zeigt an (Line 173-186):**
```tsx
<span className="text-gray-500" title="Kumulierter Saldo aller Transaktionen">
  Zeitkonto-Saldo:
</span>
<span className={...}>
  {data.currentBalance > 0 ? '+' : ''}
  {formatHours(data.currentBalance)}
</span>
```

**Wert:** `data.currentBalance` kommt vom Hook

---

### 3.2 useOvertimeTransactions Hook

**Datei:** `desktop/src/hooks/useWorkTimeAccounts.ts` (Line 219-274)

**API Call (Line 254):**
```typescript
const endpoint = `/overtime/transactions/live?${params}`;
const response = await apiClient.get(endpoint);
```

**Response Type (Line 264):**
```typescript
{
  transactions: Array<...>,
  currentBalance: number,    // ← DAS SIEHT USER!
  userId: number
}
```

---

### 3.3 Backend API Route

**Datei:** `server/src/routes/overtime.ts` (Line 464-533)

**Route:** GET `/api/overtime/transactions/live`

**Berechnet currentBalance (Line 498-515):**
```typescript
const { calculateLiveOvertimeTransactions, calculateCurrentOvertimeBalance } = await import(
  '../services/overtimeLiveCalculationService.js'
);

const transactions = calculateLiveOvertimeTransactions(userId, fromDateStr, toDateStr);
const currentBalance = calculateCurrentOvertimeBalance(userId, fromDateStr, toDateStr);

res.json({
  success: true,
  data: {
    transactions,
    currentBalance,  // ← Nutzt overtimeLiveCalculationService!
    userId,
  },
});
```

---

## 4. DISKREPANZ-ANALYSE

### 4.1 overtime_balance: actualHours = 36h (FALSCH!)

**Erwarteter Wert:**
```
actualHours = workedHours + absenceCredits + overtimeCorrections
            = 36h + 0h + 2h
            = 38h
```

**Aktueller DB-Wert:** 36h

**Root Cause:**
1. Correction (id=4) wurde am 2026-01-30 erstellt
2. `updateMonthlyOvertime(5, '2026-01')` wurde DANACH nicht aufgerufen
3. overtime_balance enthält alte Werte (OHNE Correction)

**Fix:**
```typescript
// Nach jeder Correction-Erstellung:
import { updateMonthlyOvertime } from './overtimeService.js';
updateMonthlyOvertime(userId, '2026-01');
```

---

### 4.2 Frontend "Zeitkonto-Saldo" = -8.5h (User-Angabe)

**Berechnung:**
```typescript
// overtimeLiveCalculationService.ts
SUM(overtime_transactions WHERE type IN ('earned', 'correction'))
```

**DB-Wert (laut Query):**
```
SUM = 8.5 + 0 + 8.5 + 6.5 + 8.5 + (-2) + (-2) + 2 = 32h
```

**User sieht:** -8.5h

**⚠️ MASSIVE DISKREPANZ:**
- DB zeigt +32h
- Frontend zeigt -8.5h
- **Differenz:** 40.5h!

**Mögliche Ursachen:**
1. Frontend filtered zusätzlich nach `fromDate/toDate` (User sieht "Gesamtsaldo" = alle Zeit)
2. Transactions haben unterschiedliche Werte in realtime vs. DB
3. Live Calculation berechnet anders als DB-Werte

**Benötigt weitere Untersuchung:**
- Welchen Zeitraum sieht User im Frontend?
- Gibt es Transaktionen VOR Januar 2026?
- Sind alle Transactions korrekt in DB gespeichert?

---

### 4.3 overtime_transactions Inkonsistenzen

**Problem 1: Doppelte Einträge für 2026-01-07**
```
id=259: earned, -2.0h, "Abwesenheit (unpaid): Soll/Ist-Differenz"
id=262: earned, -2.0h, "Tag ohne Zeiteinträge: -2.00h (Minusst.)"
```
→ **DUPLIKAT!** Sollte nur EINE Transaction geben

**Problem 2: Falsche hours in id=257**
```
id=257: earned, 6.5h, "Überstunden verdient: 8.50h gearbeitet"
```
→ Description sagt 8.5h, aber hours=6.5h (Differenz: 2h wegen unpaid leave?)

**Problem 3: Transaction für 2026-02-01 in Januar-Filter**
```
id=252: 2026-02-01, earned, 0.0h
```
→ Gehört zu Februar, nicht Januar

---

## 5. ZUSAMMENFASSUNG - Was fehlt WO und WARUM?

### 5.1 Backend (overtime_balance)

**Was fehlt:**
- Correction (+2h) NICHT in actualHours eingerechnet

**Wo:**
- `overtime_balance` Tabelle, month='2026-01'
- actualHours sollte 38h sein (ist 36h)
- overtime sollte 0h sein (ist -2h)

**Warum:**
- `updateMonthlyOvertime()` wurde nach Correction-Erstellung nicht aufgerufen
- overtimeCorrectionsService erstellt Correction, aber triggert keine Balance-Neuberechnung

**Fix:**
```typescript
// In overtimeCorrectionsService.ts nach Correction-Erstellung:
import { updateMonthlyOvertime } from './overtimeService.js';
const month = date.substring(0, 7); // "2026-01"
updateMonthlyOvertime(userId, month);
```

---

### 5.2 Frontend (Zeitkonto-Saldo)

**Was fehlt:**
- Anzeige zeigt -8.5h statt erwarteter 0h (oder +32h laut DB)

**Wo:**
- OvertimeTransactions Component → "Zeitkonto-Saldo"
- Kommt von `calculateCurrentOvertimeBalance()` in overtimeLiveCalculationService

**Warum:**
- Möglichkeit 1: Live Calculation nutzt ANDERE Transaktionen als DB (real-time berechnet)
- Möglichkeit 2: Filtert nach anderem Zeitraum (User sagt "Gesamtsaldo")
- Möglichkeit 3: Duplikate/Fehler in Transactions führen zu falscher Summe

**Benötigt:**
- API Call zum Backend ausführen: GET /api/overtime/transactions/live?userId=5
- Response inspizieren: Welche Transactions werden zurückgegeben?
- currentBalance aus Response überprüfen

---

### 5.3 overtime_transactions (Datenqualität)

**Was fehlt:**
- Konsistente, fehlerfreie Transactions

**Wo:**
- overtime_transactions Tabelle
- Duplikate (id=259, id=262 für 2026-01-07)
- Falsche hours (id=257 zeigt 6.5h statt 8.5h)

**Warum:**
- `ensureAbsenceTransactionsForMonth()` erstellt möglicherweise Duplikate
- Neutralization-Logic (earned -2h + unpaid_adjustment +2h) funktioniert nicht korrekt
- Keine Validierung gegen Duplikate

**Fix:**
1. IDEMPOTENT-Check: Vor Transaction-Erstellung prüfen ob schon existiert
2. DELETE-Statement vor Recreation: Alte Transactions löschen, neue erstellen
3. Transaction SUM validieren gegen overtime_balance

---

## 6. NÄCHSTE SCHRITTE (Empfehlung)

### Schritt 1: overtime_balance neu berechnen
```bash
cd server
npm run recalculate:overtime -- --userId=5 --month=2026-01
```

**Erwartetes Resultat:**
- targetHours: 38h (19 Tage × 2h/Tag - 2h unpaid)
- actualHours: 38h (36h worked + 2h correction)
- overtime: 0h

---

### Schritt 2: Frontend API Call testen
```bash
curl -X GET 'http://localhost:3000/api/overtime/transactions/live?userId=5' \
  -H 'Cookie: connect.sid=...' \
  --cookie-jar cookies.txt
```

**Inspiziere:**
- Wie viele Transactions werden zurückgegeben?
- Was ist `currentBalance` in der Response?
- Welche Transactions haben type='earned' oder type='correction'?

---

### Schritt 3: overtime_transactions bereinigen
```sql
-- Finde Duplikate
SELECT date, type, hours, COUNT(*) as count
FROM overtime_transactions
WHERE userId=5 AND date LIKE '2026-01%'
GROUP BY date, type, hours
HAVING count > 1;

-- Lösche Duplikate (behalte ältesten Eintrag)
DELETE FROM overtime_transactions
WHERE id NOT IN (
  SELECT MIN(id)
  FROM overtime_transactions
  WHERE userId=5 AND date LIKE '2026-01%'
  GROUP BY date, type
);
```

---

### Schritt 4: Code Fix implementieren
```typescript
// In overtimeCorrectionsService.ts nach Line 163:
export function createOvertimeCorrection(...) {
  // ... existing code ...

  // NEW: Recalculate overtime_balance for this month
  const month = input.date.substring(0, 7);
  updateMonthlyOvertime(userId, month);

  // NEW: Recalculate work_time_accounts (sync with overtime_balance)
  const { getOvertimeBalance } = await import('./overtimeTransactionService.js');
  const { updateWorkTimeAccountBalance } = await import('./workTimeAccountService.js');
  const newBalance = getOvertimeBalance(userId);
  updateWorkTimeAccountBalance(userId, newBalance);

  return correction;
}
```

---

## 7. USER'S STATEMENT: "-2h sind KORREKT"

**User sagt:**
> "also nach meinen berechnungen stimmen die -2 std im januar"

**Interpretation:**
- User glaubt, dass overtime_balance.overtime = -2h korrekt ist
- **ABER:** Das ignoriert die Correction von +2h!

**Mögliche Gründe für User's Meinung:**
1. User rechnet: 36h Ist - 38h Soll = -2h (OHNE Correction)
2. User erwartet, dass Corrections SEPARAT angezeigt werden (nicht in Balance)
3. User kennt ein anderes Business-Rule System

**Klärung benötigt:**
- Sollen Corrections in overtime_balance.actualHours inkludiert sein? JA/NEIN?
- Wenn NEIN: Wo werden Corrections dann angezeigt?
- Wenn JA: Warum zeigt DB actualHours=36h (ohne Correction)?

**CLAUDE.md Policy:**
> "Überstunden = Ist-Stunden - Soll-Stunden"
> "overtime_balance.actualHours = Worked + Absences + Corrections"

Laut Doku sollten Corrections inkludiert sein!

---

**Ende der Analyse**

**Nächster Schritt:** Mit User klären ob Corrections in Balance inkludiert sein sollen.
