# 🎯 UI Migration Roadmap: Transaction-Based Overtime System

**Status:** In Progress
**Start:** 2026-01-14
**Geschätzte Dauer:** 14 Stunden
**Ziel:** Komplette UI-Migration auf transaction-based Overtime + Vereinfachte ReportsPage

---

## 📊 Analyse-Ergebnisse

### Betroffene Komponenten: 13

| Status | Anzahl | Komponenten |
|--------|--------|-------------|
| ❌ **KRITISCH** | 3 | ReportsPage (CSV), WorkTimeAccountHistory, Redundante APIs |
| ⚠️ **HOCH** | 2 | OvertimeTransactions (Redundanz), ReportsPage (Design) |
| ✅ **OK** | 8 | WorkTimeAccountWidget, OvertimeManagementPage, Dashboards, etc. |

### Hauptprobleme

1. **ReportsPage.tsx**
   - ❌ Nutzt alte API `/overtime/summary` (zeigt falsche historische Werte)
   - ❌ CSV Export berechnet Überstunden lokal statt vom Backend
   - ❌ 3 verschiedene APIs für "Alle Mitarbeiter" (redundant)
   - ❌ Unübersichtliches Design (500+ Zeilen, komplexe State-Logik)

2. **WorkTimeAccountHistory.tsx**
   - ❌ Nutzt separate API `/work-time-accounts/history`
   - ❌ Unklare Bedeutung: `balance`, `delta`, `overtime` Felder
   - ❌ Nicht transaction-based

3. **OvertimeTransactions.tsx**
   - ⚠️ Zeigt `currentBalance` redundant zu `WorkTimeAccountWidget`

---

## 🚀 Umsetzungsplan

### ✅ Phase 0: Backend Migration (ERLEDIGT)

- [x] Migration Script erstellt (`migrateOvertimeToTransactions.ts`)
- [x] Work Time Account Sync Script (`syncWorkTimeAccounts.ts`)
- [x] Transaction-based System als Primary markiert
- [x] Alte Funktionen als deprecated markiert
- [x] Production DB zu Dev synchronisiert

**Ergebnis:**
- 13 Overtime Transactions migriert
- 4 Work Time Accounts synchronisiert
- TypeScript kompiliert ohne Fehler
- Tests erfolgreich

---

### 🔄 Phase 1: Backend API Cleanup (1-2h)

**Status:** 🔴 TODO

#### 1.1 Neue Report-Endpoints erstellen

**Datei:** `server/src/routes/reports.ts` (NEU)

```typescript
// GET /api/reports/overtime/user/:userId?year=&month=
// Ersetzt /overtime/summary
// Basiert auf overtime_transactions

Response: {
  userId: number;
  year: number;
  month?: number;
  summary: {
    targetHours: number;
    actualHours: number;
    overtime: number;
  };
  breakdown: {
    daily: Array<{ date, target, actual, overtime }>;
    weekly: Array<{ week, target, actual, overtime }>;
    monthly: Array<{ month, target, actual, overtime }>;
  };
}
```

#### 1.2 Neue History-Endpoint

**Datei:** `server/src/routes/reports.ts`

```typescript
// GET /api/reports/overtime/history/:userId?months=12
// Ersetzt /work-time-accounts/history
// Klare Felder mit Bedeutung

Response: {
  userId: number;
  months: Array<{
    month: string;           // "2025-11"
    earned: number;          // +12h (Überstunden verdient)
    compensation: number;    // -8h (Urlaub/Ausgleich)
    correction: number;      // +2h (Admin-Korrektur)
    balance: number;         // +6h (Saldo am Monatsende)
    balanceChange: number;   // +6h (Änderung vs. Vormonat)
  }>;
}
```

#### 1.3 Report Service erstellen

**Datei:** `server/src/services/reportService.ts` (NEU)

- `getUserOvertimeReport(userId, year, month?)`
- `getOvertimeHistory(userId, months)`
- Basiert auf `overtime_transactions` Tabelle
- Respektiert holidays, work schedules, hire dates

#### 1.4 Deprecated Endpoints erweitern

**Datei:** `server/src/routes/overtime.ts`

```typescript
// Bestehende deprecated Endpoints mit Migration-Hinweis:
// - GET /overtime/balance → 410 Gone "Use /api/overtime/transactions"
// - GET /overtime/summary → 410 Gone "Use /api/reports/overtime/user/:userId"
```

**Dateien:**
- ✅ `server/src/routes/reports.ts` (NEU)
- ✅ `server/src/services/reportService.ts` (NEU)
- ✅ `server/src/routes/overtime.ts` (ÄNDERN)

---

### 🎨 Phase 2: ReportsPage Neugestaltung (4-6h)

**Status:** 🔴 TODO

#### 2.1 Neue Komponenten-Struktur

**Ziel:** Von 500+ Zeilen → 3 klare, wiederverwendbare Komponenten

##### Component 1: OvertimeSummaryCards

**Datei:** `desktop/src/components/reports/OvertimeSummaryCards.tsx` (NEU)

```tsx
<OvertimeSummaryCards
  targetHours={2040}
  actualHours={2156}
  overtime={116}
/>

// Zeigt 3 Cards:
// 1. Soll-Stunden (Gray, Clock Icon)
// 2. Ist-Stunden (Blue, CheckCircle Icon)
// 3. Überstunden (Green/Red, TrendingUp/Down Icon)
```

##### Component 2: OvertimeUserTable

**Datei:** `desktop/src/components/reports/OvertimeUserTable.tsx` (NEU)

```tsx
<OvertimeUserTable
  users={allUsersOvertimeData}
  sortBy="overtime"
  sortOrder="desc"
  onUserClick={(userId) => navigate(`/reports?userId=${userId}`)}
/>

// Features:
// - Sortierbar (Name, Soll, Ist, Überstunden)
// - Status-Icons (✅ OK, ⚠️ Warning, ❌ Critical)
// - Click → Detail-Ansicht
// - Responsive Design
```

##### Component 3: OvertimeHistoryChart

**Datei:** `desktop/src/components/reports/OvertimeHistoryChart.tsx` (NEU)

```tsx
<OvertimeHistoryChart
  userId={userId}
  months={12}
  showBreakdown={true}  // earned/compensation/correction separate
/>

// Recharts Line Chart mit:
// - X-Axis: Monate
// - Y-Axis: Überstunden
// - Lines: Saldo, Verdient, Ausgleich, Korrekturen
// - Tooltip mit Details
```

#### 2.2 Custom Hook erstellen

**Datei:** `desktop/src/hooks/useOvertimeReports.ts` (NEU)

```typescript
export function useOvertimeReport(userId?: string, year?: number) {
  // Nutzt neue API: GET /reports/overtime/user/:userId
  // Ersetzt: useOvertimeSummary, useAllUsersOvertime, useAggregatedOvertimeStats

  return {
    data: {
      summary: { target, actual, overtime },
      breakdown: { daily, weekly, monthly },
      users: [...],  // wenn userId='all'
    },
    isLoading,
    error,
  };
}

export function useOvertimeHistory(userId: string, months: number = 12) {
  // Nutzt neue API: GET /reports/overtime/history/:userId
  // Ersetzt: useWorkTimeAccountHistory

  return {
    data: [{ month, earned, compensation, correction, balance, balanceChange }],
    isLoading,
    error,
  };
}
```

#### 2.3 ReportsPage neu implementieren

**Datei:** `desktop/src/pages/ReportsPage.tsx` (KOMPLETT NEU)

**Struktur:**

```tsx
export function ReportsPage() {
  const [year, setYear] = useState(currentYear);
  const [userId, setUserId] = useState<string>('all');

  const { data: report, isLoading } = useOvertimeReport(userId, year);
  const { data: history } = useOvertimeHistory(userId, 12);

  return (
    <div className="space-y-6">
      {/* Header mit Filtern */}
      <PageHeader
        title="Überstunden-Bericht"
        filters={
          <>
            <YearSelect value={year} onChange={setYear} />
            <UserSelect value={userId} onChange={setUserId} />
            <ExportButton data={report} />
          </>
        }
      />

      {/* Summary Cards */}
      <OvertimeSummaryCards
        targetHours={report.summary.target}
        actualHours={report.summary.actual}
        overtime={report.summary.overtime}
      />

      {/* User Table (wenn "Alle") */}
      {userId === 'all' && (
        <OvertimeUserTable
          users={report.users}
          onUserClick={setUserId}
        />
      )}

      {/* History Chart (collapsible) */}
      <CollapsibleCard title="📈 Jahresverlauf">
        <OvertimeHistoryChart
          userId={userId}
          months={12}
        />
      </CollapsibleCard>
    </div>
  );
}
```

**Von 500+ Zeilen → ~80 Zeilen!**

#### 2.4 CSV Export korrigieren

**Vorher (FALSCH):**
```typescript
const diff = userStats.hours - userStats.targetHours;  // ❌ Lokal berechnet
rows.push([..., formatOvertimeHours(diff), ...]);
```

**Nachher (RICHTIG):**
```typescript
const userOvertime = report.users.find(u => u.userId === user.id);
rows.push([..., formatOvertimeHours(userOvertime.overtime), ...]);  // ✅ Backend
```

**Dateien:**
- ✅ `desktop/src/components/reports/OvertimeSummaryCards.tsx` (NEU)
- ✅ `desktop/src/components/reports/OvertimeUserTable.tsx` (NEU)
- ✅ `desktop/src/components/reports/OvertimeHistoryChart.tsx` (NEU)
- ✅ `desktop/src/hooks/useOvertimeReports.ts` (NEU)
- ✅ `desktop/src/pages/ReportsPage.tsx` (KOMPLETT NEU)

---

### 📊 Phase 3: WorkTimeAccountHistory Migration (2-3h)

**Status:** 🔴 TODO

#### 3.1 Component aktualisieren

**Datei:** `desktop/src/components/worktime/WorkTimeAccountHistory.tsx`

**Vorher:**
```typescript
const { data: history } = useWorkTimeAccountHistory(userId, months);
// Unklar: balance? delta? overtime?

history.map(entry => (
  <td>{entry.overtime}</td>   // Was ist das?
  <td>{entry.delta}</td>       // Was ist das?
  <td>{entry.balance}</td>     // Was ist das?
))
```

**Nachher:**
```typescript
const { data: history } = useOvertimeHistory(userId, months);
// Klar: earned, compensation, correction, balance!

history.map(entry => (
  <td title="Überstunden verdient">{formatHours(entry.earned)}</td>
  <td title="Urlaub/Ausgleich">{formatHours(entry.compensation)}</td>
  <td title="Admin-Korrekturen">{formatHours(entry.correction)}</td>
  <td title="Saldo am Monatsende"><strong>{formatHours(entry.balance)}</strong></td>
))
```

#### 3.2 Tooltips & Dokumentation

Jede Spalte bekommt Tooltip:
- **Verdient:** "Überstunden die Sie in diesem Monat gesammelt haben"
- **Ausgleich:** "Überstunden die für Urlaub/Freizeit verwendet wurden"
- **Korrekturen:** "Manuelle Anpassungen durch Administrator"
- **Saldo:** "Ihr Überstunden-Stand am Monatsende"

**Dateien:**
- ✅ `desktop/src/components/worktime/WorkTimeAccountHistory.tsx` (ÄNDERN)

---

### 🧹 Phase 4: OvertimeTransactions Cleanup (1h)

**Status:** 🔴 TODO

#### 4.1 Redundante Balance-Anzeige entfernen

**Datei:** `desktop/src/components/worktime/OvertimeTransactions.tsx`

**Vorher:**
```tsx
<div className="flex items-center justify-between mb-6">
  <h3>Überstunden-Transaktionen</h3>
  <div>Aktueller Saldo: {formatHours(data.currentBalance)}</div>  {/* ❌ Redundant! */}
</div>
```

**Nachher:**
```tsx
<div className="flex items-center gap-3 mb-4">
  <Receipt className="w-5 h-5" />
  <h3>Transaktions-Historie</h3>  {/* ✅ Einfacher */}
</div>
```

**Begründung:** Balance wird bereits von `WorkTimeAccountWidget` angezeigt (in ReportsPage oben)

#### 4.2 Prüfen: Corrections in Transactions?

**Frage:** Wenn Admin eine Correction erstellt (`POST /overtime/corrections`), wird dann automatisch eine Transaction mit `type='correction'` in `overtime_transactions` erstellt?

**Falls NEIN → Backend Fix:**
```typescript
// In overtimeCorrectionsService.ts:
export function createOvertimeCorrection(...) {
  // ... Korrektur in overtime_corrections speichern

  // NEU: Auch als Transaction speichern für Audit-Trail!
  recordOvertimeCorrection(userId, date, hours, description);
}
```

**Dateien:**
- ✅ `desktop/src/components/worktime/OvertimeTransactions.tsx` (ÄNDERN)
- ⚠️ `server/src/services/overtimeCorrectionsService.ts` (PRÜFEN + evtl. ÄNDERN)

---

### 🔧 Phase 5: Kleinere Fixes (1-2h)

**Status:** 🔴 TODO

#### 5.1 Redundante API-Calls entfernen

**ReportsPage aktuell nutzt:**
- `useOvertimeSummary(userId, year)` → `/overtime/summary/:userId/:year`
- `useAllUsersOvertime(year, month)` → `/overtime/all`
- `useAggregatedOvertimeStats(year, month)` → `/overtime/aggregated`

**3 APIs für fast gleiche Daten!**

**Nach Migration:**
- `useOvertimeReport(userId, year)` → `/reports/overtime/user/:userId` (EINE API!)

#### 5.2 Loading & Error States vereinheitlichen

Alle Komponenten nutzen:
```tsx
if (isLoading) return <LoadingSpinner />;
if (error) return <ErrorMessage error={error} onRetry={refetch} />;
if (!data) return <EmptyState message="Keine Daten verfügbar" />;
```

#### 5.3 Dark Mode Consistency

Alle neuen Komponenten:
- Tailwind `dark:` Klassen für alle Farben
- Icons in `text-gray-600 dark:text-gray-400`
- Backgrounds in `bg-white dark:bg-gray-800`

---

## 📋 Checkliste

### Backend
- [ ] `server/src/routes/reports.ts` erstellt
- [ ] `server/src/services/reportService.ts` erstellt
- [ ] Neue Endpoints getestet (Postman/curl)
- [ ] Alte Endpoints mit 410 Gone markiert
- [ ] TypeScript kompiliert ohne Fehler

### Frontend - Komponenten
- [ ] `OvertimeSummaryCards.tsx` erstellt
- [ ] `OvertimeUserTable.tsx` erstellt
- [ ] `OvertimeHistoryChart.tsx` erstellt
- [ ] `useOvertimeReports.ts` Hook erstellt
- [ ] Alle Komponenten in Storybook dokumentiert

### Frontend - Pages
- [ ] `ReportsPage.tsx` komplett neu
- [ ] CSV Export korrigiert (Backend-Daten)
- [ ] `WorkTimeAccountHistory.tsx` migriert
- [ ] `OvertimeTransactions.tsx` vereinfacht
- [ ] Dark Mode überall getestet

### Testing
- [ ] Mit Production-Daten getestet
- [ ] Alle User-Szenarien getestet:
  - Admin sieht "Alle Mitarbeiter"
  - Employee sieht nur eigene Daten
  - CSV Export korrekt
  - History Chart funktioniert
  - Transaktions-Liste vollständig
- [ ] Keine TypeScript Errors
- [ ] Keine Console Warnings

---

## ⏱️ Zeitschätzung

| Phase | Aufwand | Status |
|-------|---------|--------|
| Phase 0: Backend Migration | ✅ 8h | ERLEDIGT |
| Phase 1: Backend API | 2h | 🔴 TODO |
| Phase 2: ReportsPage | 6h | 🔴 TODO |
| Phase 3: History Migration | 3h | 🔴 TODO |
| Phase 4: Transactions Cleanup | 1h | 🔴 TODO |
| Phase 5: Kleinere Fixes | 2h | 🔴 TODO |
| **GESAMT** | **22h** | **36% ERLEDIGT** |

---

## 🎯 Erfolgskriterien

### Funktional
- [x] Backend: Transaction-based System als Primary
- [ ] ReportsPage zeigt korrekte Überstunden aus Transactions
- [ ] CSV Export nutzt Backend-Daten (keine lokalen Berechnungen)
- [ ] WorkTimeAccountHistory mit klarer Felderbedeutung
- [ ] Keine redundanten Balance-Anzeigen
- [ ] Alle alten APIs als deprecated markiert

### UI/UX
- [ ] ReportsPage max 3 Haupt-Bereiche
- [ ] Alle Zahlen haben Label + Tooltip
- [ ] Loading & Error States konsistent
- [ ] Dark Mode überall unterstützt
- [ ] Responsive Design (Desktop + Tablet)

### Code Quality
- [ ] TypeScript ohne Errors
- [ ] Keine Console Warnings
- [ ] DRY Prinzip (keine Code-Duplikation)
- [ ] Komponenten wiederverwendbar
- [ ] Klare Namensgebung

---

## 🚀 Nächste Schritte

**Aktuell:** Phase 0 abgeschlossen (Backend Migration)

**Als Nächstes:**
1. **Quick Win:** Phase 5.1 (CSV Export Fix) - 30 Min
2. **Kritisch:** Phase 1 (Backend API) - 2h
3. **Kritisch:** Phase 2 (ReportsPage) - 6h

**Oder:**
- Falls schnelle Ergebnisse gewünscht: Erst Phase 5 (Alle Quick Fixes)
- Falls grundlegende Neugestaltung: Phase 1 → 2 → 3 → 4 → 5

---

## 📝 Notizen

### Entscheidungen getroffen:
- ✅ Transaction-based als Single Source of Truth
- ✅ Alte Tabellen bleiben für Legacy Reports (read-only)
- ✅ Work Time Account wird nur von Transactions aktualisiert
- ✅ Migration Scripts sind idempotent (können mehrfach ausgeführt werden)

### Offene Fragen:
- ❓ Sollen alte deprecated Endpoints nach Release X.X entfernt werden?
- ❓ History Chart: Welche Library? (Recharts vs. Chart.js)
- ❓ Mobile Support für ReportsPage? (aktuell nur Desktop)

---

**Letzte Aktualisierung:** 2026-01-14
**Verantwortlich:** Claude Code
**Status:** ✅ Phase 0 Complete, 🔴 Phase 1-5 TODO
