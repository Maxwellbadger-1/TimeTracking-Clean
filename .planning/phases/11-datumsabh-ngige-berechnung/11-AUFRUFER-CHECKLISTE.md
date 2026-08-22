# Aufrufer-Checkliste: Phase 11 (Datumsabhängige Berechnung)

**Erstellt:** 2026-08-22 (Plan 11-01, Task 3)
**Zweck:** Abhakliste aller Fundstellen, die `getDailyTargetHours()`, `calculateAbsenceHoursWithWorkSchedule()`
oder `calculateTargetHoursForPeriod()` aufrufen, definieren oder testen — als Nachweis statt
Behauptung, dass die Pläne 11-04 bis 11-09 wirklich alle Aufrufer nachziehen (REQ-23, Lehre aus
Plan 09-04, wo die vierte Kopie der Regel erst im Review ans Licht kam). Grundlage ist
`.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md` — nicht neu gesucht, sondern
mit dem heutigen Stand abgeglichen (vier Grep-Läufe unten). Zeilennummern haben sich seit Phase 9
verschoben (Phase 9 Tasks 1–5 haben Code verändert); wo eine Zeile abweicht, gilt der heutige
Stand.

---

## Grep-Läufe (wörtlich, mit Trefferzahl)

### Lauf 1
```
$ grep -rn "getDailyTargetHours(" --include=*.ts server/src
```
**Trefferzahl: 50**

### Lauf 2
```
$ grep -rn "calculateAbsenceHoursWithWorkSchedule(" --include=*.ts server/src
```
**Trefferzahl: 20**

### Lauf 3
```
$ grep -rn "calculateTargetHoursForPeriod(" --include=*.ts server/src
```
**Trefferzahl: 22**

### Lauf 4
```
$ grep -rn "getDailyTargetHours\|calculateAbsenceHoursWithWorkSchedule" --include=*.ts --include=*.tsx desktop/src
```
**Trefferzahl: 5**

**Summe aller vier Läufe: 97 Treffer.**

**Zuordnung Treffer → Tabellenzeile:** Kommentar-/Doku-Treffer (JSDoc-Beispiele, erläuternde
`//`-Zeilen) sind von der Tabelle ausgeschlossen und einzeln unten aufgeführt. Testdatei-Treffer
(`*.test.ts`) sind — anders als produktive Aufrufstellen — nicht Zeile für Zeile in die Tabelle
aufgenommen, sondern je Testdatei zu **einer** Zeile mit Zeilenbereich und Trefferzahl
zusammengefasst: Sie sind keine eigenständigen Berechnungswege, sondern Assertions gegen die
kanonischen Funktionen (gleiche Einstufung wie in `09-INVENTAR-SOLLSTUNDEN.md`,
„Ausgeschlossene Treffer"), werden aber durch die Signaturänderung (D3) ebenfalls
Compiler-Fehler werfen und deshalb hier — anders als in Phase 9 — nicht ausgeklammert, sondern
mit eigener Zeile und Disposition geführt. Jede verbleibende Zeile (Definition, produktiver
Aufruf, Skript-Aufruf) hat genau eine Tabellenzeile.

**Rechnerische Kontrolle:** Lauf 1: 50 = 22 produktive/Skript-Zeilen + 2 Definitionen + 5
Testdatei-Zeilen (1 Testdatei-Sammelzeile) + 21 Kommentar-/Doku-Zeilen. Lauf 2: 20 = 6
produktive/Skript-Zeilen + 1 Definition + 11 Testdatei-Zeilen (1 Sammelzeile) + 2 Doku-Zeilen.
Lauf 3: 22 = 2 Skript-Zeilen + 1 Definition + 18 Testdatei-Zeilen (1 Sammelzeile) + 1 Doku-Zeile.
Lauf 4: 5 = 3 Nicht-Kommentar-Zeilen (AbsenceRequestForm.tsx Import+Aufruf zusammengefasst,
utils/index.ts Re-Export, timeUtils.ts Definition) + 1 Doku-Zeile + (AbsenceRequestForm.tsx hat
zwei Treffer, Import Zeile 15 und Aufruf Zeile 64, in einer Zeile zusammengeführt, da derselbe
Aufrufort).

---

## Fundstellen-Tabelle

Spalten: `Fundstelle` (datei:zeile), `Funktion/Kontext`, `Produktivpfad` (ja/nein, mit Beleg),
`Zuständiger Plan`, `Disposition`, `✓` (leer — Abhak-Spalte für die Pläne 11-04 bis 11-09).

### Kanonische Definitionen (`server/src/utils/workingDays.ts`)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/utils/workingDays.ts:63` | `export function getDailyTargetHours(user, date)` — die kanonische Definition (D3: Signatur wird um Perioden/Cache erweitert) | ja (Beleg: `09-INVENTAR-SOLLSTUNDEN.md`, „von praktisch allen `ja`-Zeilen aufgerufen") | 11-04 | Signaturänderung (D1–D3); jeder Aufrufer unten muss nachgezogen werden | |
| `server/src/utils/workingDays.ts:117` | `export function calculateAbsenceHoursWithWorkSchedule(...)` — eigenständige Definition, nutzt `getDailyTargetHours` NICHT direkt (eigene Tagesschleife über `workSchedule`/`weeklyHours`) | ja (Beleg: Aufrufer in `absenceService.ts`, Produktivpfad über `routes/absences.ts`, s. u.) | 11-04 | Prüfen, ob D1–D3 auch hier greifen muss (datumsabhängige Auflösung von `workSchedule`/`weeklyHours` fehlt dieser Funktion strukturell, da sie die Werte bereits als Parameter erhält statt sie selbst aufzulösen) | |
| `server/src/utils/workingDays.ts:316` | `export function calculateTargetHoursForPeriod(user, fromDate, toDate)` — Definition, Tagesschleife über `getDailyTargetHours` | nein (Beleg: `grep -rln calculateTargetHoursForPeriod server/src desktop/src` → nur `validateOvertimeCalculation.ts` und `workingDays.test.ts` importieren sie, kein Import aus `server/src/routes/`) | 11-04 | Zieht automatisch mit, wenn `getDailyTargetHours` (Zeile 336, s. u.) auf die neue Signatur umgestellt wird | |
| `server/src/utils/workingDays.ts:336` | `calculateTargetHoursForPeriod()`, Aufruf `getDailyTargetHours(user, d)` in der Tagesschleife | nein (wie Zeile 316, derselbe Funktionskörper) | 11-04 | Aufrufstelle wird mit der Signaturänderung angepasst | |

### `server/src/services/unifiedOvertimeService.ts` — der vorgesehene gemeinsame Weg

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/unifiedOvertimeService.ts:115` | `calculateDailyOvertime(userId, date)`, Aufruf `getDailyTargetHours(user, date)` | ja (Beleg: `calculateMonthlyOvertime()` ← `updateMonthlyOvertime()` (`overtimeService.ts:454`) ← `routes/overtime.ts` (`GET /api/overtime/balance/:userId/:month`); zusätzlich ← `ensureOvertimeBalanceEntries()` ← `GET /api/overtime/:userId`) | 11-05 | Muss den Perioden-Cache (D1/D2) durchreichen | |

### `server/src/services/overtimeTransactionRebuildService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeTransactionRebuildService.ts:263` | `collectDailyCalculations()`, Aufruf `getDailyTargetHours(user, dateStr)` | ja (Beleg: `rebuildOvertimeTransactionsForMonth()` ← `updateMonthlyOvertime()` (`overtimeService.ts:493`) ← `routes/overtime.ts`; zusätzlich ← `updateAllOvertimeLevels()`, aufgerufen bei jedem Zeiteintrag) | 11-05 | Muss den Perioden-Cache durchreichen; REQ-24-Idempotenztest betrifft diesen Rebuild-Weg | |

### `server/src/services/overtimeLiveCalculationService.ts` — Live-Anzeige

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeLiveCalculationService.ts:59` | `getAllWorkingDaysBetween()`, Aufruf `getDailyTargetHours(user, dateStr)` | ja (Beleg: `routes/overtime.ts` importiert `calculateLiveOvertimeTransactions` für `GET /transactions/live`) | 11-06 | Muss den Perioden-Cache durchreichen | |
| `server/src/services/overtimeLiveCalculationService.ts:179` | `calculateLiveOvertimeTransactions()`, Abwesenheits-Datumsschleife | ja (wie Zeile 59) | 11-06 | Muss den Perioden-Cache durchreichen | |
| `server/src/services/overtimeLiveCalculationService.ts:254` | `calculateLiveOvertimeTransactions()`, Arbeitstage-Schleife | ja (wie Zeile 59) | 11-06 | Muss den Perioden-Cache durchreichen | |
| `server/src/services/overtimeLiveCalculationService.ts:305` | `calculateLiveOvertimeTransactions()`, Abwesenheits-Credit-Schleife | ja (wie Zeile 59) | 11-06 | Muss den Perioden-Cache durchreichen | |
| `server/src/services/overtimeLiveCalculationService.ts:407` | `calculateLiveOvertimeTransactions()`, Arbeit an Nicht-Arbeitstagen | ja (wie Zeile 59) | 11-06 | Muss den Perioden-Cache durchreichen | |

### `server/src/services/overtimeService.ts` — Legacy-Pfad

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeService.ts:109` | `_calculateAbsenceCreditsForMonth()`, Aufruf `getDailyTargetHours(user, dateStr)` | nein (Beleg: `grep -rn "_calculateAbsenceCreditsForMonth(" server/src` → nur die eigene Definition, Funktionsname beginnt mit `_`, kein Aufrufer; unverändert seit `09-INVENTAR-SOLLSTUNDEN.md`) | 11-06 | Toter Code, zieht bei der Signaturänderung automatisch mit (Compiler-Fehler zwingt zur Anpassung oder zum Entfernen) | |
| `server/src/services/overtimeService.ts:193` | `_calculateUnpaidLeaveForMonth()`, Aufruf `getDailyTargetHours(user, dateStr)` | nein (wie Zeile 109 — `grep` findet nur die Definition) | 11-06 | Toter Code, wie oben | |
| `server/src/services/overtimeService.ts:329` | `ensureAbsenceTransactionsForMonth()`, PHASE 1 | nein (Beleg: `ensureAbsenceTransactionsForMonth` ist `function` ohne `export`; `grep -n "ensureAbsenceTransactionsForMonth(" server/src/services/overtimeService.ts` findet nur Definition Zeile 224 — kein Aufrufer im Repository) | 11-06 | Toter Code, wie oben | |
| `server/src/services/overtimeService.ts:370` | `ensureAbsenceTransactionsForMonth()`, PHASE 2 | nein (derselbe tote Codeblock, Zeilen 224–427) | 11-06 | Toter Code, wie oben | |
| `server/src/services/overtimeService.ts:570` | `_updateOvertimeTransactionsForDate()`, Aufruf `getDailyTargetHours(user, date)` | nein (Beleg: `grep -rn "_updateOvertimeTransactionsForDate" server/src --include=*.ts` (ohne Tests) → nur die eigene Definition Zeile 555, kein Aufrufer — heute erneut verifiziert, gleicher Befund wie Phase 9 trotz `@deprecated`-Kommentar) | 11-06 | Toter Code, zieht bei Bedarf mit | |
| `server/src/services/overtimeService.ts:853` | `ensureDailyOvertimeTransactions()`, Aufruf `getDailyTargetHours(user, dateStr)` | ja (Beleg: `export async function ensureDailyOvertimeTransactions` ← `routes/overtime.ts` im Handler `GET /api/overtime/transactions/monthly-summary`) | 11-06 | Muss den Perioden-Cache durchreichen | |
| `server/src/services/overtimeService.ts:1353` | `ensureAbsenceTransactions()`, Aufruf `getDailyTargetHours(user, dateStr)` | ja (Beleg: `export async function ensureAbsenceTransactions` ← aufgerufen von `ensureDailyOvertimeTransactions()` selbst — dieselbe Aufrufkette wie Zeile 853) | 11-06 | Muss den Perioden-Cache durchreichen | |

### `server/src/services/absenceService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/absenceService.ts:360` | `getAbsenceRequestsPaginated()`, Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` zur Anzeige-Anreicherung (`calculatedHours`) | ja (Beleg: `routes/absences.ts:47,55,149` importieren und rufen `getAbsenceRequestsPaginated` auf) | 11-07 | Zusätzlicher Fund gegenüber `09-INVENTAR-SOLLSTUNDEN.md` (dort nicht erfasst, weil dieses Inventar nur `getDailyTargetHours` durchsuchte) — muss auf Perioden-Auflösung geprüft werden | |
| `server/src/services/absenceService.ts:791` | `approveAbsenceRequest()`, Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` für `actualHoursRequired` vor Genehmigung | ja (Beleg: `export async function approveAbsenceRequest` ← `routes/absences.ts:495`) | 11-07 | Zusätzlicher Fund, wie Zeile 360 | |
| `server/src/services/absenceService.ts:863` | `approveAbsenceRequest()`, Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` für `hoursToDeduct` bei `overtime_comp`-Genehmigung | ja (wie Zeile 791) | 11-07 | Zusätzlicher Fund, wie Zeile 360 | |
| `server/src/services/absenceService.ts:1195` | `calculateAbsenceCredits(userId, startDate, endDate)`, Aufruf `getDailyTargetHours(user, d)` (heute Zeile 1195, in `09-INVENTAR-SOLLSTUNDEN.md` ebenfalls 1195 — unverschoben) | ja (Beleg: `updateBalancesAfterApproval()` → `deductOvertimeHours()` ← `approveAbsenceRequest()` ← `routes/absences.ts:495`; zusätzlich Aufrufer Zeilen 1244, 1297) | 11-07 | Muss den Perioden-Cache durchreichen | |

### `server/src/services/exportService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/exportService.ts:98` | `generateDATEVExport()`, Aufruf `getDailyTargetHours(fullUser, entry.date)` | ja (Beleg: `server/src/routes/exports.ts:18` importiert `generateDATEVExport`) | 11-07 | Muss den Perioden-Cache durchreichen | |

### Skripte (`server/src/scripts/`) — kein Produktivpfad, aber im Aufgabenbereich von Plan 11-08

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/scripts/migrateOvertimeToTransactions.ts:131` | Aufruf `getDailyTargetHours(user, date)` | nein (Beleg: kein Import aus `server/src/routes/`/`server.ts`; erreichbar nur über `npm run migrate:overtime`, `server/package.json:19`; nicht in `.github/workflows/*.yml` verdrahtet — heute erneut geprüft) | 11-08 | Muss die Signatur nachziehen, damit `npm run migrate:overtime` weiter kompiliert | |
| `server/src/scripts/validateAllTestUsers.ts:73` | Aufruf `getDailyTargetHours(user, dateStr)` | nein (wie oben; `npm run validate:all-test-users`, `server/package.json:36`) | 11-08 | Muss die Signatur nachziehen | |
| `server/src/scripts/validateAllTestUsers.ts:107` | Aufruf `getDailyTargetHours(user, dateStr)` | nein (wie oben) | 11-08 | Muss die Signatur nachziehen | |
| `server/src/scripts/validateOvertimeDetailed.ts:473` | Aufruf `getDailyTargetHours(user, dateStr)` | nein (wie oben; `npm run validate:overtime:detailed`, `server/package.json:32`) | 11-08 | Domain-Vorgabe: „`scripts/validateOvertimeDetailed.ts` prüft gegen den periodengültigen Maßstab" (`11-CONTEXT.md`) — explizit im Umfang, nicht nur „nachziehen" | |
| `server/src/scripts/validateOvertimeDetailed.ts:634` | Aufruf `getDailyTargetHours(user, dateStr)` | nein (wie oben) | 11-08 | wie Zeile 473 | |
| `server/src/scripts/validateOvertimeDetailed.ts:682` | Aufruf `getDailyTargetHours(user, dateStr)` | nein (wie oben) | 11-08 | wie Zeile 473 | |
| `server/src/scripts/validateOvertimeCalculation.ts:185` | Aufruf `calculateTargetHoursForPeriod(...)` | nein (Beleg: kein Import aus `server/src/routes/`; `npm run validate:overtime`, `server/package.json:31`) | 11-08 | Muss die Signatur nachziehen | |
| `server/src/scripts/validateOvertimeCalculation.ts:245` | Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` | nein (wie oben) | 11-08 | Muss die Signatur nachziehen | |
| `server/src/scripts/validateOvertimeCalculation.ts:454` | Aufruf `calculateTargetHoursForPeriod(...)` | nein (wie oben) | 11-08 | Muss die Signatur nachziehen | |
| `server/src/scripts/validateOvertimeCalculation.ts:477` | Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` | nein (wie oben) | 11-08 | Muss die Signatur nachziehen | |
| `server/src/scripts/reproduceOvertimeCompDefect.ts:226` | Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` | nein (Beleg: kein Import aus `server/src/routes/`; `npm run repro:overtime-comp`, `server/package.json:34`; nicht in `.github/workflows/*.yml`) | 11-08 | Muss die Signatur nachziehen, sonst bricht das Reproduktionswerkzeug aus Phase 9 | |

### Testdateien (Sammelzeilen — keine eigenständigen Berechnungswege, aber Compiler-Fehler bei Signaturänderung)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/utils/workingDays.test.ts:487,488,489,490,491` (5 Treffer) | Assertions gegen `getDailyTargetHours()` | nein (Testdatei) | 11-04 | Wird bei der Signaturänderung von `getDailyTargetHours()` als Teil von Plan 11-04 (TDD) mit angepasst | |
| `server/src/utils/workingDays.test.ts:506,529,700,723,746,760,774,843,884,1057,1166` (11 Treffer) | Assertions gegen `calculateAbsenceHoursWithWorkSchedule()` | nein (Testdatei) | 11-04 | wie oben | |
| `server/src/utils/workingDays.test.ts:409,598,612,626,640,658,679,800,819,837,877,971,987,1029,1090,1110,1137,1165` (18 Treffer) | Assertions gegen `calculateTargetHoursForPeriod()` | nein (Testdatei) | 11-04 | wie oben | |

### Desktop — vier Fundstellen mit offenem Prüfauftrag (Disposition in Plan 11-09 Task 2)

Diese Gruppe rechnet ohne Datenbankzugriff aus den über die API gelieferten Stammdaten. Die
Disposition wird laut `11-CONTEXT.md`/`11-01-PLAN.md` ausdrücklich **nicht** hier, sondern in
Plan 11-09 Task 2 endgültig festgehalten und belegt. Die Zeilen bleiben deshalb offen (kein
Haken), mit dem Prüfauftrag: „zeigt die Anzeige einen vergangenen Zeitraum oder nur den
heutigen/künftigen Stand?"

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `desktop/src/utils/timeUtils.ts:213` | `export function calculateAbsenceHoursWithWorkSchedule(...)` — eigenständige Client-Kopie, identischer Name wie die Server-Funktion, aber unabhängige Implementierung; läuft im Tauri/Browser-Prozess, kein Server-Aufruf | nein im Sinne dieses Plans („Produktivpfad" = Express-Route), aber aktiv genutzter Desktop-Client-Code | 11-09 (Task 2, Prüfauftrag) | **OFFEN** — Prüfauftrag: zeigt die Anzeige einen vergangenen Zeitraum oder nur den heutigen/künftigen Stand? | **offen** |
| `desktop/src/utils/index.ts:17` | Barrel-Re-Export von `calculateAbsenceHoursWithWorkSchedule` aus `timeUtils.ts` | nein (Re-Export, keine eigene Berechnung) | 11-09 (Task 2, Prüfauftrag) | **OFFEN** — folgt der Disposition von `timeUtils.ts:213` | **offen** |
| `desktop/src/components/absences/AbsenceRequestForm.tsx:15,64` | Import (Zeile 15) und Aufruf (Zeile 64) von `calculateAbsenceHoursWithWorkSchedule(...)` zur Live-Vorschau der Antragsstunden im Formular | nein im Sinne dieses Plans, aktiv genutzter Desktop-Code (Urlaubsantrag-Formular) | 11-09 (Task 2, Prüfauftrag) | **OFFEN** — Prüfauftrag: Formular zeigt einen künftigen/aktuellen Zeitraum (Antragstellung), nicht rückwirkend — trotzdem in Plan 11-09 zu bestätigen, nicht hier vorwegzunehmen | **offen** |
| `desktop/src/components/worktime/WorkScheduleDisplay.tsx:60` | `const dailyHours = user.weeklyHours / 5;` — eigene Rechnung (nicht über die beiden Grep-Muster gefunden, aber laut `11-01-PLAN.md` Task 3 ausdrücklich Teil dieser Gruppe; Beleg aus `09-INVENTAR-SOLLSTUNDEN.md`, „Ausgeschlossene Treffer") | nein im Sinne dieses Plans, aktiv genutzte Dashboard-/Detail-Anzeige | 11-09 (Task 2, Prüfauftrag) | **OFFEN** — Prüfauftrag: zeigt die Anzeige einen vergangenen Zeitraum oder nur den heutigen/künftigen Stand? | **offen** |
| `desktop/src/components/users/WorkScheduleEditor.tsx:44,186` | `const dailyHours = Math.round((weeklyHours / 5) * 100) / 100;` (Zeile 44, Formular-Vorschlagswert) und `{weeklyHours}h ÷ 5 Arbeitstage = ...h/Tag` (Zeile 186, Hilfetext) — Eingabemaske beim Anlegen/Bearbeiten eines Nutzers | nein — Formular-Vorschlagswert und Hilfetext, keine Bezugnahme auf einen historischen Zeitraum (Beleg wie oben, `09-INVENTAR-SOLLSTUNDEN.md`) | 11-09 (Task 2, Prüfauftrag) | **OFFEN** — Prüfauftrag zur Vollständigkeit mitgeführt, auch wenn der fachliche Fall (Eingabe eines NEUEN Wochenplans) strukturell keinen vergangenen Zeitraum betrifft — Bestätigung bleibt Plan 11-09 vorbehalten | **offen** |

### Vier Sondergruppen mit ausdrücklicher Disposition (aus `11-01-PLAN.md`, Task 3)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/scripts/fix-overtime.ts` (ruft `getDailyTargetHours` NICHT direkt auf) | `ensureOvertimeBalanceEntries()`-Delegation, verifiziert heute erneut: `server/scripts/fix-overtime.ts:36` importiert `ensureOvertimeBalanceEntries` aus `../dist/services/overtimeService.js`, Zeile 64 ruft sie auf — keine eigene `weeklyHours/5`-Rechnung mehr (Fix aus Plan 09-03, A-1) | ja (Cron + Deployment: `.github/workflows/deploy-server.yml:118` bei jedem Deployment, `deploy-server.yml:125` täglicher Cronjob um 3 Uhr) | — (kein eigener Umbau nötig) | **„Zieht mit"**: Wird automatisch periodenbewusst, sobald `ensureOvertimeBalanceEntries()` → `unifiedOvertimeService` (Plan 11-05) umgestellt ist. Nicht im `tsc`-Umfang (`tsconfig.json` schließt nur `src/**/*` ein). In Plan 11-09 gegenzuprüfen (D7) | |
| `server/debug_overtime_comparison.ts`, `server/debug_target_calculation.ts`, `server/debug_dates.ts`, `server/test_*.ts` (24 Dateien im Serverwurzelverzeichnis, u. a. `test_absence_days.ts`, `test_loop_debug.ts`, `test_updateMonthlyOvertime_exact.ts`) | Debug-/Test-Einwegskripte außerhalb von `src/` | nein (Beleg: außerhalb `src/**/*`, damit außerhalb des `tsc`-Umfangs; laut `09-INVENTAR-SOLLSTUNDEN.md` kein Import aus `server/src/routes/`; `debug_target_calculation.ts:22` definiert sogar eine **eigene, lokale Kopie** von `getDailyTargetHours()`, unabhängig von `workingDays.ts` — heute erneut verifiziert, Datei liegt unverändert vor) | — (nicht nachgezogen) | **Disposition: nicht nachgezogen.** Kein Produktivpfad, keine Vollständigkeitspflicht laut Plan. Begründung hier festgehalten statt stiller Auslassung | — |
| `server/src/services/absenceService.ts:464,472,697,700` | `countWorkingDaysForUser(...)` — zählt Urlaubs**tage**, keine Sollstunden (Beleg: Zeile 4 Import aus `workingDays.js`; Aufrufkontext in `createAbsenceRequest`/verwandten Funktionen, heute erneut an denselben Zeilen verifiziert, unverändert seit `09-INVENTAR-SOLLSTUNDEN.md`) | ja (Teil des Urlaubsantrags-Wegs) | — (in Phase 11 unverändert) | **Disposition: In Phase 11 unverändert.** Ein Urlaubsantrag über einen Stichtag hinweg ist laut `13-CONTEXT.md` D3 in Phase 12/14 zu bewerten, nicht hier | — |

---

## Ausgeschlossene Treffer (Kommentar-/Doku-Zeilen)

Diese Zeilen enthalten keinen Aufruf, sondern JSDoc-Beispiele oder erläuternde Kommentare — sie
tragen keine eigene Tabellenzeile:

| Fundstelle | Art |
|---|---|
| `server/src/database/migrations/008_create_user_work_periods.ts:5` | Kommentar (Migrationsbegründung) |
| `server/src/services/absenceService.ts:1154` | Kommentar oberhalb `calculateAbsenceCredits` |
| `server/src/services/exportService.ts:96` | Kommentar |
| `server/src/services/overtimeLiveCalculationService.ts:31,56,86,125` | Kommentare |
| `server/src/services/overtimeLiveCalculationService.test.ts:14` | Kommentar in Testdatei |
| `server/src/services/overtimeService.ts:100,102,185,187,321,362,1345` | Kommentare |
| `server/src/services/unifiedOvertimeService.ts:99` | Kommentar |
| `server/src/utils/workingDays.ts:54,57,58,61,304` | JSDoc-Beispielzeilen (Lauf 1) |
| `server/src/utils/workingDays.ts:110,114` | JSDoc-Beispielzeilen (Lauf 2) |
| `server/src/utils/workingDays.ts:313` | JSDoc-Beispielzeile (Lauf 3) |
| `desktop/src/utils/timeUtils.ts:210` | JSDoc-Beispielzeile (Lauf 4) |

---

## Zusammenfassung nach Plan

| Plan | Anzahl Fundstellen (Tabellenzeilen, ohne Testdatei-Sammelzeilen und Sonderfälle) |
|---|---|
| 11-04 (`workingDays.ts` + zugehörige Tests) | 4 Definitionen/Aufrufe + 3 Testdatei-Sammelzeilen |
| 11-05 (`unifiedOvertimeService.ts`, `overtimeTransactionRebuildService.ts`) | 2 |
| 11-06 (`overtimeService.ts`, `overtimeLiveCalculationService.ts`) | 12 |
| 11-07 (`absenceService.ts`, `exportService.ts`) | 5 |
| 11-08 (Validierungs-/Migrationsskripte) | 10 |
| 11-09 (Desktop, offener Prüfauftrag) | 5 (Sammelzeilen für teils mehrzeilige Fundstellen) |
| Ohne Plan, mit Disposition (fix-overtime.ts „zieht mit", debug/test-Skripte „nicht nachgezogen", `countWorkingDaysForUser` „unverändert") | 3 |

Keine Fundstelle der vier Grep-Läufe bleibt ohne Zeile: 22+2+1+1 (Lauf 1) + 6+1+1 (Lauf 2) +
2+1+1 (Lauf 3) + 3 (Lauf 4) = 41 Tabellenzeilen, zuzüglich der explizit im Plan geforderten,
nicht per Grep gefundenen Zeilen `WorkScheduleDisplay.tsx:60` und `WorkScheduleEditor.tsx:44,186`
sowie der drei Sondergruppen ohne Grep-Ursprung (`fix-overtime.ts`, debug/test-Skripte,
`countWorkingDaysForUser`).
