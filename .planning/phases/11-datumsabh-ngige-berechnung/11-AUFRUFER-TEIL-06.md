# Teilbeleg Plan 11-06 — overtimeService.ts (Legacy-Pfad) und overtimeLiveCalculationService.ts

**Erstellt:** 2026-08-22 (Plan 11-06, Task 3)
**Zweck:** Teilbeleg für die zentrale Aufrufer-Checkliste (`11-AUFRUFER-CHECKLISTE.md`), die
laut Plan 11-06 in dieser Welle NICHT direkt beschrieben werden darf (parallele Welle 3,
gleichzeitiges Schreiben mehrerer Agenten würde ein Update verlieren). Plan 11-09 führt diesen
Teilbeleg sequenziell mit den Teilbelegen der Pläne 11-05, 11-07, 11-08, 11-11 zusammen und hakt
dort in der Haupttabelle ab.

---

## D7: Legacy-Pfad

D7 verlangt den Nachweis, dass kein Aufrufer aus dem `overtimeService.ts`-Pfad an der neuen
Signatur (`getDailyTargetHours(user, date, periods)`, Plan 11-04) vorbeirechnet. Vier Befehle,
wörtlich ausgeführt gegen den Stand nach Abschluss aller drei Tasks dieses Plans.

### Befehl 1: Alle `getDailyTargetHours()`-Aufrufe in `overtimeService.ts`

```
$ grep -rn "getDailyTargetHours(" server/src/services/overtimeService.ts
```

```
103:    // Iterate through each day and sum getDailyTargetHours()
105:    // workSchedule und Wochenende werden ausschließlich von getDailyTargetHours() selbst
112:      absenceHours += getDailyTargetHours(user, dateStr, periods);
190:    // Iterate through each day and sum getDailyTargetHours()
192:    // workSchedule und Wochenende werden ausschließlich von getDailyTargetHours() selbst
198:      totalUnpaidHours += getDailyTargetHours(user, dateStr, periods);
328:    // REQ-17: Kein eigener Wochenend-/Feiertagsfilter mehr. getDailyTargetHours() prüft
336:      const targetHours = getDailyTargetHours(user, dateStr, periods);
369:    // REQ-17: Kein eigener Wochenend-/Feiertagsfilter mehr. getDailyTargetHours() prüft
377:      const dailyHours = getDailyTargetHours(user, dateStr, periods);
578:  const targetHours = getDailyTargetHours(user, date, directWorkPeriodLookup);
869:    const targetHours = getDailyTargetHours(user, dateStr, periods);
1364:    // REQ-17: Kein eigener Wochenend-/Feiertagsfilter mehr. getDailyTargetHours() prüft
1372:      const targetHours = getDailyTargetHours(user, dateStr, periods);
```

**Auswertung:** Acht tatsächliche Aufrufzeilen (die übrigen sind Kommentare, die den
Funktionsnamen nur erwähnen), jede trägt jetzt drei Argumente — sechs mit einem
`createWorkPeriodContext()`-Kontext (`periods`), eine mit `directWorkPeriodLookup`
(Einzeltagfunktion `_updateOvertimeTransactionsForDate`, Zeile 578). Keine Zeile ruft die
Funktion noch mit zwei Argumenten auf.

### Befehl 2: Keine zweite Kopie der `weeklyHours / 5`-Regel

```
$ grep -rn "weeklyHours / 5\|weeklyHours/5" server/src/services --include=*.ts
```

```
(keine Treffer)
```

**Auswertung:** Kein Treffer in `server/src/services` — auch nicht außerhalb von
`overtimeService.ts`. Keine zweite, unbemerkte Kopie der Sollstunden-Regel.

### Befehl 3: Aufrufkette von `ensureOvertimeBalanceEntries`

```
$ grep -rn "ensureOvertimeBalanceEntries" server/src server/scripts --include=*.ts
```

```
server/src/routes/overtime.ts:10:  ensureOvertimeBalanceEntries,
server/src/routes/overtime.ts:602:      // ✅ CRITICAL: Ensure ALL daily transactions exist (ON-DEMAND, like ensureOvertimeBalanceEntries)
server/src/routes/overtime.ts:806:        await ensureOvertimeBalanceEntries(user.id, currentMonth);
server/src/routes/overtime.ts:1031:      await ensureOvertimeBalanceEntries(userId, currentMonth);
server/src/scripts/add2026TimeEntries.ts:122:  logger.info('💡 Now recalculate overtime balances with: ensureOvertimeBalanceEntries()');
server/src/scripts/compareOvertimePaths.ts:13: * `getOvertimeSummary()` (overtimeService.ts:618) rufen `ensureOvertimeBalanceEntries()` auf,
server/src/scripts/compareOvertimePaths.ts:82:        '(ensureOvertimeBalanceEntries legt overtime_balance-Zeilen an/aktualisiert sie).'
server/src/scripts/createCompleteTestUser.ts:29:const { ensureOvertimeBalanceEntries } = await import('../services/overtimeService.js');
server/src/scripts/createCompleteTestUser.ts:254:  ensureOvertimeBalanceEntries(userId, '2026-01');
server/src/scripts/createEnhancedTestUser.ts:29:const { ensureOvertimeBalanceEntries } = await import('../services/overtimeService.js');
server/src/scripts/createEnhancedTestUser.ts:314:  ensureOvertimeBalanceEntries(userId, '2026-01');
server/src/scripts/createNewEmployeeTestUser.ts:31:const { ensureOvertimeBalanceEntries } = await import('../services/overtimeService.js');
server/src/scripts/createNewEmployeeTestUser.ts:202:  ensureOvertimeBalanceEntries(userId, '2026-01');
server/src/scripts/createOneTestUser.ts:21:const { ensureOvertimeBalanceEntries } = await import('../services/overtimeService.js');
server/src/scripts/createOneTestUser.ts:95:ensureOvertimeBalanceEntries(userId, '2026-01');
server/src/scripts/createSuperTestUser.ts:38:const { ensureOvertimeBalanceEntries } = await import('../services/overtimeService.js');
server/src/scripts/createSuperTestUser.ts:336:  ensureOvertimeBalanceEntries(userId, '2026-01');
server/src/scripts/recalculateOvertimeBalances.ts:11:import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
server/src/scripts/recalculateOvertimeBalances.ts:44:    ensureOvertimeBalanceEntries(userId, upToMonth);
server/src/scripts/refreshOvertimeBalances.ts:11:import { ensureOvertimeBalanceEntries } from '../services/overtimeService.js';
server/src/scripts/refreshOvertimeBalances.ts:67:      await ensureOvertimeBalanceEntries(user.id, currentMonth);
server/src/scripts/reproduceOvertimeCompDefect.ts:34: * (`getUserOvertimeReport`, `getOvertimeSummary`, `ensureOvertimeBalanceEntries`,
server/src/scripts/seedTestUsers.ts:29:const { ensureOvertimeBalanceEntries } = await import('../services/overtimeService.js');
server/src/scripts/seedTestUsers.ts:721:        ensureOvertimeBalanceEntries(user.id, currentMonth);
server/src/services/overtimeService.ts:632:  await ensureOvertimeBalanceEntries(userId, endMonth);
server/src/services/overtimeService.ts:698:export async function ensureOvertimeBalanceEntries(userId: number, upToMonth: string): Promise<void> {
server/src/services/overtimeService.ts:699:  logger.debug({ userId, upToMonth }, '🔥 ensureOvertimeBalanceEntries called');
server/src/services/overtimeService.ts:808: * ON-DEMAND: Called before reading transactions (like ensureOvertimeBalanceEntries)
server/src/services/overtimeService.ts:923:      await ensureOvertimeBalanceEntries(user.id, month);
server/src/services/overtimeService.ts:933:      await ensureOvertimeBalanceEntries(user.id, endMonth);
server/src/services/overtimeService.ts:982:    await ensureOvertimeBalanceEntries(user.id, targetMonth);
server/src/services/overtimeService.ts:1111:  // This function is called during Year-End Rollover AFTER ensureOvertimeBalanceEntries
server/src/services/overtimeService.ts:1125:    // ensureOvertimeBalanceEntries() must be called BEFORE getYearEndOvertimeBalance()
server/src/services/reportService.ts:17:import { ensureOvertimeBalanceEntries } from './overtimeService.js';
server/src/services/reportService.ts:116:  await ensureOvertimeBalanceEntries(userId, targetMonth);
server/src/services/reportService.ts:151:      // FALLBACK: Calculate (should not happen after ensureOvertimeBalanceEntries)
server/src/services/reportService.ts:203:      // FALLBACK: Calculate (should not happen after ensureOvertimeBalanceEntries)
server/scripts/fix-overtime.ts:26: * server/src/services/overtimeService.ts:684 `ensureOvertimeBalanceEntries()`. Sie delegiert
server/scripts/fix-overtime.ts:36:import { ensureOvertimeBalanceEntries } from '../dist/services/overtimeService.js';
server/scripts/fix-overtime.ts:64:    await ensureOvertimeBalanceEntries(user.id, currentMonth);
```

**Auswertung:** Die öffentliche Signatur von `ensureOvertimeBalanceEntries(userId, upToMonth)`
wurde durch diesen Plan NICHT verändert — der `WorkPeriodContext` wird intern (Zeile 711)
erzeugt und intern an `unifiedOvertimeService.calculateMonthlyOvertime()` durchgereicht (Zeile
764). Jeder Aufrufer unten ruft weiterhin mit genau zwei Argumenten auf und läuft damit
automatisch, ohne eigene Anpassung, über den periodenbewussten Kontext:

- Produktivpfad: `server/src/routes/overtime.ts:806,1031` (zwei HTTP-Handler) und
  `server/src/services/reportService.ts:116` (Aufrufer von `overtimeService.ts:632`,
  `getOvertimeSummary()`).
- Cronjob/Deployment: `server/scripts/fix-overtime.ts:64` importiert die Funktion aus
  `../dist/services/overtimeService.js` (dem kompilierten Ergebnis dieser Datei) — läuft bei
  jedem Deployment (`deploy-server.yml:118`) und täglich per Cron um 3 Uhr
  (`deploy-server.yml:125`). Da `dist/` aus `src/` gebaut wird, trägt der kompilierte Code
  denselben internen Kontextaufbau.
- Entwicklungs-/Testskripte (`server/src/scripts/create*.ts`, `seedTestUsers.ts`,
  `recalculateOvertimeBalances.ts`, `refreshOvertimeBalances.ts`): alle rufen mit zwei
  Argumenten auf, kein Skript baut sich eine eigene Sollstunden-Berechnung.
- Interne rekursive Aufrufe innerhalb `overtimeService.ts` selbst (Zeilen 632, 923, 933, 982):
  ebenfalls zwei Argumente, laufen über dieselbe geänderte Funktion.

Kein Aufrufer musste geändert werden — das ist die Stärke eines intern gekapselten Kontexts:
D7 ist erfüllt, weil es strukturell unmöglich ist, an der neuen Signatur vorbeizurechnen, ohne
`overtimeService.ts` selbst zu ändern.

### Befehl 4: Ergänzend — `getAllWorkingDaysBetween()` (Live-Anzeige)

Der Plan verlangt den D7-Nachweis ausdrücklich für den Legacy-Pfad (`overtimeService.ts`); für
`overtimeLiveCalculationService.ts` zusätzlich geprüft, weil diese Datei ebenfalls Teil dieses
Plans ist. Anders als `ensureOvertimeBalanceEntries()` wurde hier die öffentliche Signatur von
`getAllWorkingDaysBetween()` geändert (vierter Pflichtparameter `periods`), weil die Funktion
exportiert ist und ein interner Default-Kontext einen Cache je Aufruf erzeugt hätte (D1-Verlust).

```
$ grep -rn "getAllWorkingDaysBetween" server/src --include=*.ts | grep -v "\.test\.ts"
```

```
server/src/services/overtimeLiveCalculationService.ts:48:export function getAllWorkingDaysBetween(
server/src/services/overtimeLiveCalculationService.ts:132:  // Schleife gebaut und an alle Fundstellen unten sowie an getAllWorkingDaysBetween()
server/src/services/overtimeLiveCalculationService.ts:258:  const allWorkingDays = getAllWorkingDaysBetween(startDate, endDate, userForCalc, periods);
```

**Auswertung:** Der einzige Nicht-Test-Aufrufer liegt in derselben Datei
(`calculateLiveOvertimeTransactions`, Zeile 258) und reicht den eigenen, einmal gebauten
Kontext durch (`periods`, Zeile 134). Kein externer Aufrufer außerhalb dieser Datei — die
Signaturänderung ist vollständig lokal aufgefangen.

---

## Projektweiter `tsc`-Stand (Momentaufnahme)

**Befehl:** `cd server && npx tsc --noEmit`
**Ergebnis zum Zeitpunkt des Abschlusses dieses Plans: 0 Zeilen Ausgabe (fehlerfrei).**

Zum Start dieses Plans galten 29 Fehler in 10 Dateien als Ausgangszustand (Welle 3 lief
parallel: 11-05, 11-06, 11-07, 11-08, 11-11). Zum Abschluss dieses Plans sind alle fünf
Wellenpläne gelandet — der projektweite Stand ist bereits grün. Dieser Plan war für die sieben
Fehler in `overtimeService.ts` (Zeilen 109, 193, 329, 370, 570, 853, 1353) und die fünf Fehler
in `overtimeLiveCalculationService.ts` (Zeilen 59, 179, 254, 305, 407) zuständig — beide auf
0 Fehler geprüft, s. u.

---

## Fundstellen-Nachweis: `overtimeService.ts` und `overtimeLiveCalculationService.ts`

Spaltenform identisch zur Haupttabelle in `11-AUFRUFER-CHECKLISTE.md`.

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeService.ts:112` (vormals :109) | `_calculateAbsenceCreditsForMonth()` | nein (toter Code, Inventar 09) | 11-06 | Auf neue Signatur gebracht, `createWorkPeriodContext()` am Funktionsanfang, mit Vermerk „kein Aufrufer" | ✓ |
| `server/src/services/overtimeService.ts:198` (vormals :193) | `_calculateUnpaidLeaveForMonth()` | nein (toter Code, Inventar 09) | 11-06 | wie oben | ✓ |
| `server/src/services/overtimeService.ts:336` (vormals :329) | `ensureAbsenceTransactionsForMonth()` PHASE 1 | nein (toter Code, Inventar 09) | 11-06 | Gemeinsamer Kontext mit PHASE 2 (ein `createWorkPeriodContext()` am Funktionsanfang), mit Vermerk | ✓ |
| `server/src/services/overtimeService.ts:377` (vormals :370) | `ensureAbsenceTransactionsForMonth()` PHASE 2 | nein (toter Code, Inventar 09) | 11-06 | wie oben | ✓ |
| `server/src/services/overtimeService.ts:578` (vormals :570) | `_updateOvertimeTransactionsForDate()` | nein (toter Code, `@deprecated`) | 11-06 | `directWorkPeriodLookup` (Einzeltagfunktion), mit Vermerk | ✓ |
| `server/src/services/overtimeService.ts:869` (vormals :853) | `ensureDailyOvertimeTransactions()` | ja (via `routes/overtime.ts:610`) | 11-06 | `createWorkPeriodContext()` am Funktionsanfang | ✓ |
| `server/src/services/overtimeService.ts:1372` (vormals :1353) | `ensureAbsenceTransactions()` | ja (via `ensureDailyOvertimeTransactions()`) | 11-06 | eigener `createWorkPeriodContext()` am Funktionsanfang | ✓ |
| `server/src/services/overtimeService.ts:764` (zusätzlich, kein tsc-Fehler) | `ensureOvertimeBalanceEntries()` → `unifiedOvertimeService.calculateMonthlyOvertime()` | ja (via `routes/overtime.ts:806,1031`, `reportService.ts:116`, `fix-overtime.ts` Cron) | 11-06 | eigener `createWorkPeriodContext()` am Funktionsanfang, an `calculateMonthlyOvertime()` durchgereicht (D1) | ✓ |
| `server/src/services/overtimeLiveCalculationService.ts:65` (vormals :59) | `getAllWorkingDaysBetween()` | ja (via `calculateLiveOvertimeTransactions()`) | 11-06 | `periods: WorkPeriodContext` als vierter Pflichtparameter | ✓ |
| `server/src/services/overtimeLiveCalculationService.ts:194` (vormals :179) | `calculateLiveOvertimeTransactions()`, Abwesenheits-Datumsschleife | ja | 11-06 | EIN Kontext pro Lauf (D1/D2), durchgereicht | ✓ |
| `server/src/services/overtimeLiveCalculationService.ts:269` (vormals :254) | `calculateLiveOvertimeTransactions()`, Arbeitstage-Schleife | ja | 11-06 | wie oben | ✓ |
| `server/src/services/overtimeLiveCalculationService.ts:320` (vormals :305) | `calculateLiveOvertimeTransactions()`, Abwesenheits-Credit-Schleife | ja | 11-06 | wie oben | ✓ |
| `server/src/services/overtimeLiveCalculationService.ts:422` (vormals :407) | `calculateLiveOvertimeTransactions()`, Arbeit an Nicht-Arbeitstagen | ja | 11-06 | wie oben | ✓ |

**Zusätzlich, außerhalb der ursprünglichen 12 Fundstellen:** `userForCalc` (Zeile 140) um
`hireDate: user.hireDate` ergänzt — sonst würde die D4-Ausnahme (Datum vor Eintritt → 0h) nicht
greifen und ein Tag vor dem Eintrittsdatum die gesamte Live-Anzeige mit
`MissingWorkPeriodError` abbrechen lassen (T-11-20).

---

## Testnachweis

| Datei | Tests vor Plan 11-06 | Tests nach Plan 11-06 | Status |
|---|---|---|---|
| `server/src/services/overtimeService.test.ts` | 4 (2 rot durch D4, s. u.) | 4 | grün |
| `server/src/services/overtimeTransactionCentralization.test.ts` | 4 | 4 | grün |
| `server/src/services/overtimeLiveCalculationService.test.ts` | 10 | 12 (+2 D7-Regressionstests) | grün |

Vor den Testfixes (Task 3) waren zwei Tests in `overtimeService.test.ts` rot
(`MissingWorkPeriodError` für Nutzer 11605/11607, direkt per `INSERT INTO users` angelegt,
keine Periode). Ursache: D4 (Plan 11-04) verlangt eine Periode ab `hireDate` für jeden Nutzer,
den `getDailyTargetHours()` auflöst. Fix: `insertTestWorkPeriod()` nach jedem `INSERT INTO
users` mit denselben Werten. Erwartungswerte der Tests wurden dabei NICHT verändert — nur die
Fixture-Vorbereitung.

Kein Testnutzer bleibt zurück: `afterEach` in beiden Testdateien löscht die angelegten
`users`-Zeilen; `user_work_periods` ist per `ON DELETE CASCADE` an `users.id` gebunden
(`008_create_user_work_periods.ts:133`) und wird beim Cascade-Delete mitgelöscht, ohne dass der
Delete-Guard-Trigger (der nur bei noch existierendem Elternsatz greift) auslöst.
