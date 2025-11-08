# Konsistenz-Regeln für TimeTracking System

**Erstellt:** 2025-11-03
**Version:** 1.0
**Zweck:** Sicherstellen, dass das gesamte System konsistent und wartbar bleibt

---

## 1. Datenbank-Konsistenz

### 1.1 Überstunden-Tabellen (3-Level-System)

**KRITISCH:** Es gibt DREI Tabellen für Überstunden. Alle sind aktiv und werden genutzt!

```
overtime_daily   → Tages-Ebene (targetHours = weeklyHours / 5)
overtime_weekly  → Wochen-Ebene (targetHours = weeklyHours)
overtime_balance → Monats-Ebene (targetHours = (weeklyHours / 7) × daysInMonth)
```

**Regel:**
- ✅ Alle 3 Tabellen MÜSSEN synchron gehalten werden
- ✅ Bei JEDER Zeitbuchung (create/update/delete) MUSS `updateAllOvertimeLevels()` aufgerufen werden
- ✅ NIEMALS nur eine Tabelle aktualisieren - immer alle 3!
- ❌ NIEMALS eine der 3 Tabellen als "alt" oder "deprecated" betrachten

**Implementierung:**
```typescript
// In timeEntryService.ts - bei create/update/delete:
import { updateAllOvertimeLevels } from './overtimeService.js';

// Nach Zeitbuchung:
updateAllOvertimeLevels(userId, date); // Aktualisiert alle 3 Ebenen!
```

### 1.2 Single Source of Truth

**Regel:**
- ✅ Eine Datenbank: `server/database.db`
- ❌ NIEMALS mehrere Datenbanken oder Sync-Logik zwischen DBs
- ✅ WAL Mode MUSS aktiviert sein (Multi-User Support)

### 1.3 Daten-Migration bei Schema-Änderungen

**Regel:**
- ✅ Bei neuen Tabellen/Feldern IMMER Migrations-Script erstellen
- ✅ Migrations-Scripts in `server/src/scripts/` ablegen
- ✅ Bestehende Daten MÜSSEN migriert werden (nicht neu erstellen!)

**Beispiel:**
```bash
# Migration ausführen
cd server
npx tsx src/scripts/migrateOvertimeData.ts
```

---

## 2. API-Konsistenz

### 2.1 Überstunden-Endpoints

**Aktuelle Endpoints (ALLE aktiv!):**

```typescript
// Neue 3-Level-Endpoints:
GET /api/overtime/current           // { today, thisWeek, thisMonth, totalYear }
GET /api/overtime/daily/:userId/:date
GET /api/overtime/weekly/:userId/:week
GET /api/overtime/summary/:userId/:year

// Legacy-Endpoints (für Rückwärtskompatibilität):
GET /api/overtime/balance?userId=X&year=Y    // → getOvertimeSummary()
GET /api/overtime/month/:userId/:month       // → getMonthlyOvertime()
GET /api/overtime/stats                      // → getCurrentOvertimeStats()
```

**Regel:**
- ✅ Legacy-Endpoints MÜSSEN auf neue Funktionen mappen
- ✅ Neue Features nutzen `/current`, `/daily`, `/weekly`, `/summary`
- ❌ NIEMALS Legacy-Endpoints entfernen ohne Migration-Plan

### 2.2 Response-Format

**Regel:**
```typescript
// ✅ IMMER dieses Format:
{
  success: true,
  data: { ... }
}

// Bei Fehler:
{
  success: false,
  error: "Error message"
}
```

---

## 3. Frontend-Konsistenz

### 3.1 Hooks für Überstunden

**Aktuelle Hooks (ALLE in [useBalances.ts](desktop/src/hooks/useBalances.ts)):**

```typescript
// Neue 3-Level-Hooks:
useCurrentOvertimeStats(userId?)    // → Alle 4 Levels
useDailyOvertime(userId, date)
useWeeklyOvertime(userId, week)
useOvertimeSummary(userId, year)

// Legacy-Hooks (deprecated, aber noch nutzbar):
useTotalOvertime(userId)            // → Nutzt useCurrentOvertimeStats
useOvertimeBalance(userId, month)
```

**Regel:**
- ✅ Neue Features MÜSSEN `useCurrentOvertimeStats()` nutzen
- ✅ Legacy-Hooks dürfen verwendet werden, zeigen aber Warnung
- ✅ Alle Hooks MÜSSEN in `hooks/index.ts` exportiert werden

### 3.2 Dashboard-Anzeige

**Regel:**
```tsx
// ✅ RICHTIG - Alle 4 Levels anzeigen:
const { data: overtimeStats } = useCurrentOvertimeStats(userId);

<Card>
  <h3>Überstunden (Gesamt): {overtimeStats?.totalYear}</h3>
  <div>
    Heute: {overtimeStats?.today}
    Woche: {overtimeStats?.thisWeek}
    Monat: {overtimeStats?.thisMonth}
  </div>
</Card>

// ❌ FALSCH - Nur ein Level:
const { totalHours } = useTotalOvertime(userId);
<p>{totalHours}</p>
```

---

## 4. Berechnungs-Konsistenz

### 4.1 Soll-Stunden Formeln

**KRITISCH:** Diese Formeln NIEMALS ändern ohne Grund!

```typescript
// Tägliche Soll-Stunden:
targetHours = weeklyHours / 5    // 5-Tage-Woche

// Wöchentliche Soll-Stunden:
targetHours = weeklyHours        // Aus User-Einstellung

// Monatliche Soll-Stunden:
targetHours = (weeklyHours / 7) × daysInMonth   // 7 Tage-Woche für genaue Verteilung
```

**Regel:**
- ✅ Formeln sind in [overtimeService.ts](server/src/services/overtimeService.ts) dokumentiert
- ❌ NIEMALS Formeln ändern ohne Konsistenz-Check aller 3 Ebenen
- ✅ Bei Formel-Änderung: Alle historischen Daten neu berechnen (Migration!)

### 4.2 Überstunden-Berechnung

```typescript
// IMMER diese Formel:
overtime = actualHours - targetHours

// Kann POSITIV (+5h) oder NEGATIV (-5h Minusstunden) sein!
```

**Regel:**
- ✅ Überstunden können negativ sein (Minusstunden)
- ✅ NIEMALS negative Werte auf 0 runden
- ✅ Formatierung zeigt + oder - Zeichen (`formatOvertimeHours()`)

---

## 5. Code-Stil Konsistenz

### 5.1 Service Layer Naming

**Regel:**
```typescript
// ✅ Funktions-Naming:
updateAllOvertimeLevels()     // update* für Schreiboperationen
getOvertimeSummary()          // get* für Leseoperationen
calculateDailyTargetHours()   // calculate* für Berechnungen
validateTimeEntryData()       // validate* für Validierung

// ❌ Inkonsistent:
fetchOvertime()               // NEIN - nutze get*
processOvertime()             // NEIN - zu vage
```

### 5.2 Hook Naming

**Regel:**
```typescript
// ✅ Hooks:
useCurrentOvertimeStats()     // use* + beschreibender Name
useDailyOvertime()            // use* + Ebene + "Overtime"

// ❌ Inkonsistent:
getOvertimeStats()            // NEIN - Hooks starten mit use*
fetchDaily()                  // NEIN - zu vage
```

---

## 6. Datenbank Schema-Versioning

**Regel:**
- ✅ Schema-Änderungen IMMER in [schema.ts](server/src/database/schema.ts)
- ✅ Versionsnummer in Kommentar dokumentieren
- ✅ Migration-Script erstellen in `server/src/scripts/migrate_vX.ts`

**Beispiel:**
```typescript
// Version 1.0 - Initial Schema
// Version 1.1 - Added overtime_daily and overtime_weekly tables (2025-11-03)
```

---

## 7. Testing-Konsistenz

**Regel:**
- ✅ Bei jedem neuen Feature: Migration für bestehende Daten prüfen
- ✅ Manuelles Testing aller 3 Überstunden-Ebenen nach Zeitbuchung
- ✅ Edge Cases testen: Negative Stunden, Feiertage, Wochenenden

**Test-Checklist nach Zeitbuchung:**
```
1. ✅ overtime_daily aktualisiert?
2. ✅ overtime_weekly aktualisiert?
3. ✅ overtime_balance aktualisiert?
4. ✅ Dashboard zeigt alle 4 Levels korrekt?
5. ✅ Freizeitausgleich-Beantragung nutzt totalYear?
```

---

## 8. Dokumentations-Konsistenz

**Regel:**
- ✅ Jede Service-Funktion hat JSDoc-Kommentar
- ✅ Komplexe Berechnungen haben Inline-Kommentare
- ✅ README.md beschreibt 3-Level-System
- ✅ CLAUDE.md hat Überstunden-Regeln

**Beispiel:**
```typescript
/**
 * Update all 3 overtime levels (daily, weekly, monthly)
 * MASTER function - call this after ANY time entry change!
 *
 * @param userId - User ID
 * @param date - Date in format "YYYY-MM-DD"
 */
export function updateAllOvertimeLevels(userId: number, date: string): void {
  // Implementation
}
```

---

## 9. Deployment-Konsistenz

**Regel:**
- ✅ Bei Schema-Änderungen: Migration VOR Deployment ausführen
- ✅ TypeScript MUSS kompilieren (`npm run build`)
- ✅ Server-Neustart nach Schema-Änderungen
- ✅ Datenbank-Backup VOR Migration

**Deployment-Checklist:**
```bash
# 1. Backup
cp server/database.db server/database.backup.$(date +%Y%m%d).db

# 2. Migration (falls nötig)
cd server && npx tsx src/scripts/migrateOvertimeData.ts

# 3. Build
cd server && npm run build

# 4. Restart
pm2 restart timetracking-server
```

---

## 10. Breaking Changes vermeiden

**Regel:**
- ✅ Legacy-Endpoints/-Hooks NIEMALS löschen - als deprecated markieren
- ✅ Bei Funktions-Umbenennung: Alias-Funktion erstellen
- ✅ Bei Schema-Änderung: Alte Tabellen NICHT droppen (nur wenn absolut sicher)

**Beispiel:**
```typescript
// Neue Funktion:
export function getCurrentOvertimeStats(userId: number) { ... }

// Legacy-Funktion (für Rückwärtskompatibilität):
export function getOvertimeStats(userId: number) {
  return getCurrentOvertimeStats(userId);
}
```

---

## 11. Fehler-Handling Konsistenz

**Regel:**
```typescript
// ✅ IMMER try-catch bei async Operationen:
try {
  const result = await apiCall();
  return result;
} catch (error) {
  console.error('❌ Error:', error);
  throw error; // Re-throw für obere Ebene
}

// ✅ Validation VOR Business Logic:
if (!data.email?.trim()) {
  throw new Error('Email is required');
}

// ✅ Defensive Programming:
const overtimeHours = overtimeStats?.totalYear || 0; // Default bei undefined
```

---

## 12. Performance-Konsistenz

**Regel:**
- ✅ SQL Prepared Statements IMMER
- ✅ Indizes auf Fremdschlüssel (userId, date, month, week)
- ✅ Batch-Updates statt einzelne (bei Migrationen)
- ✅ React Query Caching nutzen (refetchOnWindowFocus: false)

---

## Checklist für neue Features

**VOR Implementation:**
- [ ] Betrifft es Überstunden? → Alle 3 Ebenen prüfen
- [ ] Neue DB-Tabelle? → Migration-Script erstellen
- [ ] Neue API? → Legacy-Kompatibilität prüfen
- [ ] Neue Hook? → In index.ts exportieren
- [ ] Formel-Änderung? → Historische Daten migrieren

**NACH Implementation:**
- [ ] TypeScript kompiliert ohne Fehler
- [ ] Migration erfolgreich (falls nötig)
- [ ] Manuelles Testing aller 4 Überstunden-Levels
- [ ] Dashboard zeigt korrekte Werte
- [ ] Freizeitausgleich nutzt totalYear
- [ ] Dokumentation aktualisiert

---

**Ende der Konsistenz-Regeln**
**Bei Fragen:** Diese Datei lesen BEVOR Änderungen gemacht werden!
