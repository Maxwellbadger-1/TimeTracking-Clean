# Aufrufer-Checkliste: Phase 11 (Datumsabhängige Berechnung)

**Erstellt:** 2026-08-22 (Plan 11-01, Task 3)
**Zusammengeführt:** 2026-08-22 (Plan 11-09, Task 1) — die fünf Teilbelege der Welle 3
(`11-AUFRUFER-TEIL-05.md` bis `-08.md` und `-11.md`) sind hier eingearbeitet, die
Teilbeleg-Dateien selbst bleiben unverändert liegen (Quelle).

**Zweck:** Abhakliste aller Fundstellen, die `getDailyTargetHours()`,
`calculateAbsenceHoursWithWorkSchedule()` oder `calculateTargetHoursForPeriod()` aufrufen,
definieren oder testen — als Nachweis statt Behauptung, dass die Pläne 11-04 bis 11-09 wirklich
alle Aufrufer nachziehen (REQ-23, Lehre aus Plan 09-04, wo die vierte Kopie der Regel erst im
Review ans Licht kam).

**Spalten:** `Fundstelle` (datei:zeile), `Funktion/Kontext`, `Produktivpfad` (ja/nein, mit
Beleg), `Zuständiger Plan`, `Disposition`, `✓` (`[x]` nachgezogen / `[n/a]` begründete
Disposition / `offen` — nur für die vier Desktop-Zeilen bis Task 2 dieses Plans zulässig).

---

## Kopfabschnitt — Zahlen (Stand nach Task 2 dieses Plans)

Zeilen gesamt: **55**. Davon abgehakt (`[x]`): **42**. Davon mit Disposition (`[n/a]`): **13**.
Kontrolle: 42 + 13 = 55 — stimmt mit „Zeilen gesamt" überein. (Maschinell nachgezählt mit dem
Prüfbefehl aus `11-09-PLAN.md` Task 1/2, s. Abschnitte „Vollständigkeitsbeleg" am Dateiende.)

Zwischenstand nach Task 1 (vor der Desktop-Disposition in Task 2): 42 `[x]`, 9 `[n/a]`
(Sondergruppen 3 + Neufunde 6), 4 `offen` (Desktop) — 42+9+4=55. Task 2 hat die vier
Desktop-Zeilen auf `[n/a]` gesetzt (9→13) — der Prüfbefehl ist jetzt auch ohne Desktop-Ausnahme
exit-0-grün (s. Abschnitt „Vollständigkeitsbeleg Task 2" am Dateiende).

---

## Kanonische Definitionen (`server/src/utils/workingDays.ts`)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/utils/workingDays.ts:133` (vormals :63) | `export function getDailyTargetHours(user, date, periods)` — kanonische Definition | ja | 11-04 | Erledigt: Signatur um `periods: WorkPeriodContext` erweitert (D1–D3), löst intern über `resolvePeriodForDate()`/`resolveWorkPeriodIn()` auf | [x] |
| `server/src/utils/workingDays.ts:211` (vormals :117) | `export function calculateAbsenceHoursWithWorkSchedule(user, startDate, endDate, periods)` | ja | 11-04 | Erledigt: nimmt jetzt `user`+`periods` statt separater `workSchedule`/`weeklyHours`-Parameter, löst je Tag die gültige Periode auf | [x] |
| `server/src/utils/workingDays.ts:418` (vormals :316/:336) | `export function calculateTargetHoursForPeriod(user, fromDate, toDate, periods)` — Definition, Tagesschleife über `getDailyTargetHours` | nein (kein Import aus `server/src/routes/`) | 11-04 | Erledigt: Signatur nachgezogen, `periods` wird je Tag an `getDailyTargetHours` durchgereicht (Zeile 444) | [x] |
| `server/src/utils/workingDays.ts:444` | `calculateTargetHoursForPeriod()`, Aufruf `getDailyTargetHours(user, d, periods)` in der Tagesschleife | nein (wie oben) | 11-04 | Erledigt, wie oben | [x] |

---

## `server/src/services/unifiedOvertimeService.ts` — der vorgesehene gemeinsame Weg

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/unifiedOvertimeService.ts:130` (vormals :115) | `calculateDailyOvertime(userId, date, periods = directWorkPeriodLookup)`, Aufruf `getDailyTargetHours(user, date, periods)` | ja (`calculateMonthlyOvertime()` ← `updateMonthlyOvertime()` (`overtimeService.ts:454`) ← `routes/overtime.ts` `GET /api/overtime/balance/:userId/:month`; zusätzlich ← `ensureOvertimeBalanceEntries()` ← `GET /api/overtime/:userId`) | 11-05 | Erledigt: Perioden-Kontext durchgereicht, `calculateMonthlyOvertime`/`calculatePeriodOvertime` bauen `createWorkPeriodContext()` einmal je Lauf (D1, Zähler-Nachweis grün). Commits `b196529`/`c09fda0` | [x] |

---

## `server/src/services/overtimeTransactionRebuildService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeTransactionRebuildService.ts:276` (vormals :263) | `collectDailyCalculations()`, Aufruf `getDailyTargetHours(user, dateStr, periods)` | ja (`rebuildOvertimeTransactionsForMonth()` ← `updateMonthlyOvertime()` ← `routes/overtime.ts`; zusätzlich ← `updateAllOvertimeLevels()` bei jedem Zeiteintrag) | 11-05 | Erledigt: `periods: WorkPeriodContext` Pflichtparameter, `createWorkPeriodContext()` genau einmal vor der Tagesschleife (`:165`). REQ-24-Idempotenztest (in Plan 11-05) grün, D1-Zähler-Nachweis grün. Commits `b2c2524`/`5ad1169` | [x] |

---

## `server/src/services/overtimeLiveCalculationService.ts` — Live-Anzeige

Reachability: `routes/overtime.ts` importiert `calculateLiveOvertimeTransactions` für
`GET /transactions/live`. Alle Zeilen dieser Funktion sind damit Produktivpfad = ja.

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeLiveCalculationService.ts:65` (vormals :59, ursprünglich :66 eigener Vorfilter — der eigene Vorfilter wurde bereits in Plan 09-03 durch einen Aufruf von `getDailyTargetHours()` ersetzt) | `getAllWorkingDaysBetween()` | ja | 11-06 | Erledigt: `periods: WorkPeriodContext` als vierter Pflichtparameter | [x] |
| `server/src/services/overtimeLiveCalculationService.ts:194` (vormals :179/:181) | `calculateLiveOvertimeTransactions()`, Abwesenheits-Datumsschleife | ja | 11-06 | Erledigt: EIN Kontext pro Lauf (D1/D2), durchgereicht | [x] |
| `server/src/services/overtimeLiveCalculationService.ts:269` (vormals :254/:250) | `calculateLiveOvertimeTransactions()`, Arbeitstage-Schleife | ja | 11-06 | Erledigt, wie oben | [x] |
| `server/src/services/overtimeLiveCalculationService.ts:320` (vormals :305/:301) | `calculateLiveOvertimeTransactions()`, Abwesenheits-Credit-Schleife | ja | 11-06 | Erledigt, wie oben | [x] |
| `server/src/services/overtimeLiveCalculationService.ts:422` (vormals :407/:395) | `calculateLiveOvertimeTransactions()`, Arbeit an Nicht-Arbeitstagen | ja | 11-06 | Erledigt, wie oben | [x] |

---

## `server/src/services/overtimeService.ts` — Legacy-Pfad

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeService.ts:112` (vormals :109/:110) | `_calculateAbsenceCreditsForMonth()` | nein (toter Code, kein Aufrufer) | 11-06 | Erledigt: Signatur nachgezogen, `createWorkPeriodContext()` am Funktionsanfang, Vermerk „kein Aufrufer" | [x] |
| `server/src/services/overtimeService.ts:198` (vormals :193/:198) | `_calculateUnpaidLeaveForMonth()` | nein (toter Code) | 11-06 | Erledigt, wie oben | [x] |
| `server/src/services/overtimeService.ts:336` (vormals :329/:309, Zeile 347 der Phase-9-Zählung war eine Leerzeile ohne eigene Fundstelle) | `ensureAbsenceTransactionsForMonth()` PHASE 1 | nein (toter Code, `function` ohne `export`, kein Aufrufer) | 11-06 | Erledigt: gemeinsamer Kontext mit PHASE 2 | [x] |
| `server/src/services/overtimeService.ts:377` (vormals :370/:360) | `ensureAbsenceTransactionsForMonth()` PHASE 2 | nein (toter Code) | 11-06 | Erledigt, wie oben | [x] |
| `server/src/services/overtimeService.ts:578` (vormals :570/:564) | `_updateOvertimeTransactionsForDate()` | nein (toter Code, `@deprecated`) | 11-06 | Erledigt: `directWorkPeriodLookup` (Einzeltagfunktion) | [x] |
| `server/src/services/overtimeService.ts:869` (vormals :853/:847) | `ensureDailyOvertimeTransactions()` | ja (`routes/overtime.ts` `GET /api/overtime/transactions/monthly-summary`) | 11-06 | Erledigt: `createWorkPeriodContext()` am Funktionsanfang | [x] |
| `server/src/services/overtimeService.ts:1372` (vormals :1353/:1323) | `ensureAbsenceTransactions()` | ja (via `ensureDailyOvertimeTransactions()`) | 11-06 | Erledigt: eigener `createWorkPeriodContext()` am Funktionsanfang | [x] |
| `server/src/services/overtimeService.ts:764` (zusätzlich, kein eigener tsc-Fehler — interne Delegation) | `ensureOvertimeBalanceEntries()` → `unifiedOvertimeService.calculateMonthlyOvertime()` | ja (`routes/overtime.ts:806,1031`, `reportService.ts:116`, `fix-overtime.ts` Cron/Deploy) | 11-06 | Erledigt: eigener `createWorkPeriodContext()`, an `calculateMonthlyOvertime()` durchgereicht. **D7-Nachweis**: Kein Aufrufer musste geändert werden — die öffentliche Signatur `(userId, upToMonth)` blieb gleich, der Kontext ist intern gekapselt (`11-AUFRUFER-TEIL-06.md`, Befehl 3) | [x] |

**Pass-Through-Stellen, bewusst nicht als eigene Fundstelle geführt** (wie in
`09-INVENTAR-SOLLSTUNDEN.md` selbst begründet: „Pass-Through-Stellen, die nur `overtime_balance`
lesen, zählen nicht als eigene Sollstunden-Ermittlung"):
- `overtimeService.ts:595-660` `getOvertimeSummary()` — liest nur vorberechnete Werte
- `overtimeService.ts:454` `updateMonthlyOvertime()` — delegiert vollständig an `unifiedOvertimeService`, ruft `getDailyTargetHours` nicht selbst auf
- `overtimeTransactionService.ts:406-418` `getOvertimeBalance()` — liest nur vorberechnete Werte

---

## `server/src/services/absenceService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/absenceService.ts:364` (vormals :360) | `getAbsenceRequestsPaginated()`, `calculateAbsenceHoursWithWorkSchedule(...)` für `calculatedHours` | ja (`routes/absences.ts:47,55,149`) | 11-07 | Erledigt: `periods = createWorkPeriodContext()` einmal vor `rows.map` | [x] |
| `server/src/services/absenceService.ts:828` (vormals :791) | `approveAbsenceRequest()`, `calculateAbsenceHoursWithWorkSchedule(...)` für `actualHoursRequired` | ja (`routes/absences.ts:495`) | 11-07 | Erledigt: über `getUserForOvertimeCompCalculation()`, `directWorkPeriodLookup` | [x] |
| `server/src/services/absenceService.ts:902` (vormals :863) | `approveAbsenceRequest()`, `calculateAbsenceHoursWithWorkSchedule(...)` für `hoursToDeduct` | ja (wie oben) | 11-07 | Erledigt, identisch aufgebaut wie Zeile 828 | [x] |
| `server/src/services/absenceService.ts:1236` (vormals :1195) | `calculateAbsenceCredits(userId, startDate, endDate)`, `getDailyTargetHours(user, d, periods)` | ja (`deductOvertimeHours()` ← `approveAbsenceRequest()` ← `routes/absences.ts:495`) | 11-07 | Erledigt: `periods = createWorkPeriodContext()` vor der Tagesschleife | [x] |

**`countWorkingDaysForUser(...)`-Fundstellen (absenceService.ts:464,472,697,700)** — zählen
Urlaubs**tage**, keine Sollstunden; siehe eigene Zeile unter „Sondergruppen" unten.

---

## `server/src/services/exportService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/exportService.ts:103` (vormals :98) | `generateDATEVExport()`, `getDailyTargetHours(fullUser, entry.date, periods)` | ja (`routes/exports.ts:18`) | 11-07 | Erledigt: `periods = createWorkPeriodContext()` einmal je Export, außerhalb aller Schleifen | [x] |

---

## Skripte (`server/src/scripts/`) — kein Produktivpfad, Plan 11-08

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/scripts/validateOvertimeDetailed.ts:499` | `validateOvertimeForUser()`, „Day-by-Day Breakdown" | nein | 11-08 | Erledigt: EIN `WorkPeriodContext` je Nutzer-/Monatslauf | [x] |
| `server/src/scripts/validateOvertimeDetailed.ts:660` | „Absence Credits" | nein | 11-08 | Erledigt, derselbe Kontext | [x] |
| `server/src/scripts/validateOvertimeDetailed.ts:708` | „Unpaid Reduction" | nein | 11-08 | Erledigt, derselbe Kontext | [x] |
| `server/src/scripts/validateOvertimeCalculation.ts:199` | `validateUser()`, `calculateTargetHoursForPeriod(...)` | nein | 11-08 | Erledigt: `createWorkPeriodContext()` je Aufruf | [x] |
| `server/src/scripts/validateOvertimeCalculation.ts:260` | `validateUser()`, `calculateAbsenceHoursWithWorkSchedule(...)` | nein | 11-08 | Erledigt: vier alte Positionsparameter durch `(user, startDate, endDate, periods)` ersetzt | [x] |
| `server/src/scripts/validateOvertimeCalculation.ts:483` | `validateScenario()`, `calculateTargetHoursForPeriod(...)` | nein (synthetische Testdaten) | 11-08 | Erledigt: `stubWorkPeriodContext()` statt `createWorkPeriodContext()` (Szenario-Nutzer existieren nicht in `user_work_periods`) | [x] |
| `server/src/scripts/validateOvertimeCalculation.ts:507` | `validateScenario()`, Abwesenheits-Kredit | nein | 11-08 | Erledigt, derselbe Stub-Kontext | [x] |
| `server/src/scripts/validateAllTestUsers.ts:84` | `validateUser()`, Zielstunden-Tagesschleife | nein | 11-08 | Erledigt: `createWorkPeriodContext()` je `validateUser()`-Aufruf | [x] |
| `server/src/scripts/validateAllTestUsers.ts:118` | Abwesenheits-Tagesschleife | nein | 11-08 | Erledigt, derselbe Kontext | [x] |
| `server/src/scripts/migrateOvertimeToTransactions.ts:203` | `migrateUserOvertimeTransactions()`, Tagesschleife | nein | 11-08 | Erledigt: `createWorkPeriodContext()` je Nutzer-Migrationslauf, zusätzlich `assertNotProduction()` nachgerüstet (Rule 2, T-11-27) | [x] |
| `server/src/scripts/reproduceOvertimeCompDefect.ts:255` | `main()`, `erwarteterAbzug`-Schleife | nein | 11-08 | Erledigt: `createWorkPeriodContext()`, ein Kontext je Lauf | [x] |

---

## Skripte mit direktem `INSERT INTO users` — Plan 11-11 (D4-Risiko, nicht dieselbe Fundstellenart wie oben, aber Teil der Vollständigkeitspflicht: fehlende Arbeitszeitperiode → `MissingWorkPeriodError`)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/scripts/seedTestData.ts:33` | `createUser()`-Helper, David/Emma/Frank | nein (`npm run seed-test-data`) | 11-11 | Erledigt: `ensureInitialWorkPeriod()` ergänzt; Probelauf 3/3 Perioden | [x] |
| `server/src/scripts/seedTestUsers.ts:93` | `upsertUser()`-Helper, 10 Testnutzer | nein (`npm run seed:test-users`) | 11-11 | Erledigt: `ensureInitialWorkPeriod()` im Create-Zweig + Sicherheitsnetz im Update-Zweig; Probelauf 10/10 | [x] |
| `server/src/scripts/createCompleteTestUser.ts:90` | `createCompleteTestUser()` | nein | 11-11 | Erledigt: `ensureInitialWorkPeriod()` nach Transaktions-Commit | [x] |
| `server/src/scripts/createEnhancedTestUser.ts:123` | `createEnhancedTestUser()` | nein | 11-11 | Erledigt, wie oben | [x] |
| `server/src/scripts/createNewEmployeeTestUser.ts:88` | `createNewEmployeeTestUser()` | nein | 11-11 | Erledigt, wie oben | [x] |
| `server/src/scripts/createOneTestUser.ts:19` | Skript-Top-Level | nein | 11-11 | Erledigt: `ensureInitialWorkPeriod()` direkt nach Anlage | [x] |
| `server/src/scripts/createSuperTestUser.ts:151` | `createSuperTestUser()` | nein | 11-11 | Erledigt, wie oben | [x] |
| `server/scripts/create-admin.ts:98` | `createAdmin()`, Ersteinrichtung | ja (Ersteinrichtung eines frischen Systems; außerhalb `tsc`-Umfang) | 11-11 | Erledigt: `ensureInitialWorkPeriod()` über kompilierte `dist/services/userService.js`; zusätzlich `DATABASE_PATH`-Ignorierung behoben (Rule 3, blockierend). Probelauf 1/1 Periode | [x] |

---

## Desktop — vier Zeilen (Disposition in Task 2 dieses Plans)

Die ursprünglich fünf Grep-Treffer (`timeUtils.ts:213` Definition und `index.ts:17`
Barrel-Re-Export derselben Funktion) sind hier zu EINER Zeile zusammengeführt, weil der
Re-Export keine eigene Berechnung trägt und dieselbe Disposition wie die Definition erhält —
das reduziert die Zeilenzahl von fünf auf vier, deckungsgleich mit den vier in
`11-09-PLAN.md` Task 2 einzeln benannten Dateien (`timeUtils.ts`, `AbsenceRequestForm.tsx`,
`WorkScheduleDisplay.tsx`, `WorkScheduleEditor.tsx`).

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `desktop/src/utils/timeUtils.ts:213` (+ Re-Export `desktop/src/utils/index.ts:17`) | `export function calculateAbsenceHoursWithWorkSchedule(...)` — eigenständige Client-Kopie | nein im Sinne dieses Plans (Express-Route), aktiv genutzter Desktop-Client-Code | 11-09 (Task 2) | **Nicht nachgezogen, zugeordnet an Phase 12** — Abhängigkeitskonflikt + Wirksamkeitsfenster (drei Messzahlen = 0) belegt in `11-DESKTOP-DISPOSITION.md` | [n/a] |
| `desktop/src/components/absences/AbsenceRequestForm.tsx:15,64` | Import/Aufruf zur Live-Vorschau der Antragsstunden | nein im Sinne dieses Plans | 11-09 (Task 2) | **Nicht nachgezogen, zugeordnet an Phase 12** — siehe `11-DESKTOP-DISPOSITION.md` (Wert ist reine UI-Vorschau, Server rechnet beim Speichern neu, kein Persistenzrisiko) | [n/a] |
| `desktop/src/components/worktime/WorkScheduleDisplay.tsx:60` | `const dailyHours = user.weeklyHours / 5;` — Anzeige | nein im Sinne dieses Plans | 11-09 (Task 2) | **Nicht nachgezogen, zugeordnet an Phase 12** — siehe `11-DESKTOP-DISPOSITION.md` (zeigt nur den heutigen Stand, kein historischer Bezug) | [n/a] |
| `desktop/src/components/users/WorkScheduleEditor.tsx:44,186` | Formular-Vorschlagswert und Hilfetext | nein im Sinne dieses Plans | 11-09 (Task 2) | **Nicht nachgezogen, zugeordnet an Phase 12** — siehe `11-DESKTOP-DISPOSITION.md` (Eingabe eines neuen Modells, kein historischer Bezug) | [n/a] |

---

## Sondergruppen mit ausdrücklicher Disposition (aus `11-01-PLAN.md`, Task 3)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/scripts/fix-overtime.ts` (ruft `getDailyTargetHours` nicht direkt auf) | `ensureOvertimeBalanceEntries()`-Delegation | ja (Cron + Deployment: `.github/workflows/deploy-server.yml:118,123-130`) | — | **„Zieht mit"**: automatisch periodenbewusst seit `ensureOvertimeBalanceEntries()` → `unifiedOvertimeService` (Plan 11-05/11-06) umgestellt ist. D7-Nachweis in `11-AUFRUFER-TEIL-06.md`, Befehl 3, bestätigt: kein Aufrufer musste geändert werden | [n/a] |
| `server/debug_*.ts`, `server/test_*.ts`, `server/check_overtime.ts`, `server/create_test_user.ts`, `server/fix_*.ts`, `server/recalculate_user3.ts` (32 Einwegskripte im Serverwurzelverzeichnis — **Korrektur der Zahl**: `11-01-PLAN.md`/`09-INVENTAR-SOLLSTUNDEN.md` nannten „24 Dateien"; `ls server/*.ts \| wc -l` zählt heute 34 Dateien, davon 2 Config-Dateien (`tsx.config.ts`, `vitest.config.ts`) kein Einwegskript → 32 Einwegskripte. Die Differenz wird hier festgehalten, nicht stillschweigend übernommen) | Debug-/Test-/Reparatur-Einwegskripte außerhalb von `src/` | nein (außerhalb `tsc`-Umfang, `tsconfig.json` include: `src/**/*`; kein Import aus `server/src/routes/`; kein Eintrag in `.github/workflows/*.yml`) | — | **Disposition: nicht nachgezogen.** Kein Produktivpfad, keine Vollständigkeitspflicht laut Plan | [n/a] |
| `server/src/services/absenceService.ts:464,472,697,700` | `countWorkingDaysForUser(...)` — zählt Urlaubstage, keine Sollstunden | ja (Teil des Urlaubsantrags-Wegs) | — | **In Phase 11 unverändert.** Ein Urlaubsantrag über einen Stichtag hinweg ist laut `13-CONTEXT.md` D3 in Phase 12/14 zu bewerten | [n/a] |

---

## Neufunde (Task 1, Schritt B — erschöpfende Nachsuche, nicht in den fünf Teilbelegen enthalten)

Sechs Neufunde, jeder einzeln bewertet. **Keiner liegt im Produktivpfad** — die Bewertung ist
hiermit belegt, nicht behauptet.

| Fundstelle | Funktion/Kontext | Produktivpfad | Beleg | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/utils/workingDays.ts:289` | `export function calculateDailyTargetHours(weeklyHours: number): number` — eigenständige, exportierte Funktion, ignoriert `workSchedule` und Datum vollständig (`Math.round((weeklyHours / 5) * 100) / 100`), gefunden über Suchgruppe 2 (flache Formel), nicht über Suchgruppe 1 (andere Funktionsnamen als die drei kanonischen) | nein — `grep -rn "calculateDailyTargetHours" --include=*.ts src scripts [Desktop-Quellbaum] *.ts` findet ausschließlich die eigene Definition und `workingDays.test.ts` (5 Testfälle); kein Import aus `server/src/routes/`, keine andere Servicedatei ruft sie auf | Toter Code, keine Verwendung außerhalb des eigenen Testfiles | Nicht nachgezogen — keine Signaturänderung nötig, da funktional isoliert und ohne Aufrufer im Produktivpfad. Für Phase 14 als Aufräumkandidat vorgemerkt (identisches Muster wie die toten Funktionen in `overtimeService.ts`) | [n/a] |
| `server/src/utils/workingDays.ts:309` | `export function calculateMonthlyTargetHours(weeklyHours, year, month): number` — nutzt intern `calculateDailyTargetHours()`, ebenfalls `workSchedule`-blind | nein — `grep -rn "calculateMonthlyTargetHours"` findet nur die Definition, `workingDays.test.ts` (4 Testfälle) und einen explizit auskommentierten `// UNUSED:`-Import in `userService.ts:6` | Toter Code, per Kommentar im Quelltext selbst als `UNUSED` markiert | Nicht nachgezogen, wie oben | [n/a] |
| `server/src/utils/workingDays.ts:447` | `export function calculateTargetHoursUntilToday(weeklyHours, fromDate): number` — flache Formel, `new Date(fromDate)` (Zeitzonenrisiko, aber ohne Aufrufer irrelevant) | nein — `grep -rn "calculateTargetHoursUntilToday"` findet nur die Definition und `workingDays.test.ts` (13 Testfälle) | Toter Code | Nicht nachgezogen, wie oben | [n/a] |
| `server/src/services/timeEntryService.ts:783-841` | `export function updateOvertimeBalance(userId, month): void` — schreibt direkt in `overtime_balance` mit `targetHours = Math.round(((user.weeklyHours / 7) * daysInMonth) * 100) / 100` (Kalendertage, nicht Arbeitstage; ignoriert `workSchedule`, Feiertage, Wochenenden vollständig) | nein — `grep -rn "updateOvertimeBalance\b" --include=*.ts src scripts [Desktop-Quellbaum] *.ts` findet außerhalb der eigenen Definition und ihres eigenen Fehler-Logs (Zeile 838) **keinen einzigen Aufrufer** im gesamten Repository, auch nicht in `routes/` oder Tests | Exportierte, aber toter Code — dieselbe Kategorie wie `overtimeService.ts`s `_calculate*ForMonth`-Funktionen, nur ohne führenden Unterstrich und ohne `@deprecated`-Kommentar | **Kein blockierender Befund, da nachweislich kein Aufrufer** — trotzdem als eigenständiger Fund benannt, weil die Formel (`weeklyHours / 7`) fachlich falsch wäre, würde sie je aufgerufen. Für Phase 14 als Entfernungskandidat vorgemerkt (Verwechslungsgefahr mit dem aktiven `overtimeTransactionRebuildService.ts`s `updateOvertimeBalanceForMonth()`, das trotz ähnlichen Namens korrekt über `getDailyTargetHours()` rechnet) | [n/a] |
| `server/src/scripts/verifyTestData.ts:92,98` | `hoursPerDay = weeklyHours / 5` — eigene Nachrechnung eines Validierungsskripts, bereits in `09-INVENTAR-SOLLSTUNDEN.md` „Nicht-Abweichungen mit Begründung" bekannt, aber bisher nicht als eigene Zeile in dieser Checkliste geführt | nein — nur über `npm run verify-test-data` erreichbar, kein Import aus `server/src/routes/`, kein Eintrag in `.github/workflows/*.yml` | `09-INVENTAR-SOLLSTUNDEN.md:245-254` — dort bereits als Validierungsskript-Fallback eingeordnet | Nicht nachgezogen — Zweck des Skripts ist eine unabhängige Nachrechnung, nicht der Produktivpfad. Neufund nur im Sinne „bisher nicht in `11-AUFRUFER-CHECKLISTE.md`", die fachliche Bewertung war bereits Phase 9 bekannt | [n/a] |
| `server/check_overtime.ts` | Manuelles Debug-Skript, `new Database('database/development.db')` fest verdrahtet, eigene `calculateAbsenceHours()`-Hilfsfunktion mit `user.weeklyHours / 5`-Fallback (Zeile 94-95) | nein — kein Import aus `server/src/routes/`, kein Eintrag in `.github/workflows/*.yml`, liegt außerhalb `tsc`-Umfang | `grep -rn "check_overtime" .github/workflows/*.yml src/routes src/server.ts` → keine Treffer | Nicht nachgezogen — fällt unter dieselbe Sondergruppen-Disposition wie die anderen 31 Einwegskripte im Serverwurzelverzeichnis (s. o.), hier einzeln benannt, weil es beim ursprünglichen Zählen der „24 Dateien" nicht namentlich genannt war | [n/a] |

---

## Erschöpfende Nachsuche (Task 1, Schritt B)

Fünf Suchläufe, wörtlich, gegen `server/src`, `server/scripts`, das Serverwurzelverzeichnis
(`server/*.ts`) und `desktop/src`. Kommentarzeilen sind für Zählungen mit
`grep -v "^\s*\*" | grep -vE "://"` bzw. äquivalenten Filtern herausgerechnet, wo eine reine
Trefferzahl gebildet wird.

### Suchlauf 1 — die drei kanonischen Funktionsnamen

```
$ cd server && grep -rn "getDailyTargetHours\|calculateAbsenceHoursWithWorkSchedule\|calculateTargetHoursForPeriod" --include=*.ts --include=*.tsx src ../desktop/src *.ts scripts 2>/dev/null | grep -v "^\s*\*" | grep -vE ":\s*//" | wc -l
```
**Trefferzahl: 168.** Dateien mit Treffern (27): alle bereits oben in dieser Checkliste
geführten Produktiv-/Skriptdateien, plus die zugehörigen `*.test.ts`-Dateien, plus die fünf
außerhalb des Produktivpfads liegenden Debug-/Test-Skripte im Serverwurzelverzeichnis
(`debug_overtime_comparison.ts`, `debug_target_calculation.ts`, `test_absence_days.ts`,
`test_loop_debug.ts`, `test_updateMonthlyOvertime_exact.ts`) sowie `scripts/fix-overtime.ts`
(nur im Kommentar, Zeile 28 — kein Aufruf, s. u.) und die vier Desktop-Dateien. Jede Datei mit
Treffer ist entweder oben mit `[x]`/`[n/a]` geführt oder — wie `scripts/fix-overtime.ts` —
über die Sondergruppen-Disposition abgedeckt.

### Suchlauf 2 — die flache Formel in allen Schreibweisen

```
$ cd server && grep -rn "weeklyHours[[:space:]]*/[[:space:]]*5\|weeklyHours[[:space:]]*\*[[:space:]]*0\.2" --include=*.ts --include=*.tsx src ../desktop/src *.ts scripts 2>/dev/null | grep -v "^\s*\*" | grep -vE "://"
```
**Trefferzahl (Dateien mit mindestens einem echten Treffer): 15.** Dieser Lauf hat die drei
Neufunde in `workingDays.ts` (Zeilen 289, 309 folgend, 447) sowie die Kommentarzeile in
`scripts/fix-overtime.ts:17` (Beschreibung der historischen A-1-Abweichung, keine aktive
Berechnung mehr) zutage gefördert. Alle Treffer sind einzeln geprüft: kanonische
Fallback-Formeln innerhalb von `getDailyTargetHours`/`calculateAbsenceHoursWithWorkSchedule`
selbst (Zeilen 174, 250 — Teil der bereits abgehakten kanonischen Definitionen), die drei toten
Funktionen (Neufunde oben), Desktop-Formular-/Anzeigecode (bereits geführt), Testdateien und
Typkommentare (keine Berechnung).

### Suchlauf 3 — `user.workSchedule`/`weeklyHours`-Zugriffe außerhalb Typdefs/Formulare/`userService.ts`

```
$ cd server && grep -rln "user\.workSchedule\|users\.workSchedule\|user\.weeklyHours\|users\.weeklyHours" --include=*.ts --include=*.tsx src ../desktop/src *.ts scripts 2>/dev/null | grep -v "\.test\.ts" | grep -v "userService.ts" | grep -v "/types/"
```
**Trefferzahl (Dateien): 28.** Jede Datei einzeln geprüft. Ergebnis: `routes/overtime.ts`,
`middleware/auth.ts`, `routes/auth.ts`, `services/authService.ts`, `utils/jwt.ts`,
`services/workTimeAccountService.ts` — alle reiner Pass-Through (`weeklyHours` wird in ein
Antwort-/Token-Objekt kopiert, nicht zu einer Sollstundenzahl verrechnet); Beleg für
`workTimeAccountService.ts` unten wörtlich geprüft (Zeilen 60-139, 401-448 — ausschließlich
`SELECT`/Objektkopie, keine Rechenoperation). `services/timeEntryService.ts` enthält den oben
als Neufund geführten Treffer (Zeile 800). Alle übrigen Dateien sind bereits oben geführt
(kanonische Definition, Aufrufer, Skripte, Desktop, Sondergruppen) oder sind Testdateien/
Typdefinitionen/Formulare (`EditUserModal.tsx`, `UserManagementPage.tsx` — Anzeige des
gespeicherten Felds, keine Berechnung, `UserManagementPage.tsx:438` zeigt `{user.weeklyHours}h`
unverändert) und deshalb laut Auftrag ausgenommen.

### Suchlauf 4 — `SELECT ... FROM users` in Dateien, die anschließend Sollstunden bilden

```
$ cd server && grep -rn "FROM users" --include=*.ts src scripts *.ts 2>/dev/null | grep -v "^\s*\*" | wc -l
```
**Trefferzahl: 167 Zeilen in 76 Dateien.** Dieser Suchlauf ist erwartungsgemäß breit (jede
Nutzer-Lese-Query trifft, unabhängig vom Zweck — Auth, Urlaub, Benachrichtigungen,
Testdaten-Setup). Gezielt auf „bildet anschließend Sollstunden" geprüft: alle Dateien, die
zusätzlich `getDailyTargetHours`/`calculateAbsenceHoursWithWorkSchedule`/
`calculateTargetHoursForPeriod`/die flache Formel referenzieren, sind bereits oben geführt.
Keine zusätzliche, bisher nicht erfasste Datei aus diesem Suchlauf berechnet eine
Sollstundenzahl aus einer `FROM users`-Query heraus (Einzelprüfung von
`overtimeCorrectionsService.ts`, `settingsService.ts`, `preHireVacationCorrectionService.ts`,
`vacationBalanceService.ts`, `yearEndRolloverService.ts`, `syncWorkTimeAccounts.ts` —
keiner dieser Dateien enthält `weeklyHours`/`workSchedule` überhaupt).

### Suchlauf 5 — `WorkPeriodContext` (Gegenprobe: wer benutzt den Kontext bereits)

```
$ cd server && grep -rln "WorkPeriodContext" --include=*.ts src scripts ../desktop/src 2>/dev/null
```
**Trefferzahl (Dateien): 18.** `workPeriodContext.ts` (Definition, Plan 11-02),
`workPeriodContext.test.ts`, `test-support/workPeriodFixtures.ts`, `workingDays.ts`/
`workingDays.test.ts` (kanonisch), `unifiedOvertimeService.ts`/`.test.ts`,
`overtimeTransactionRebuildService.ts`, `overtimeService.ts`,
`overtimeLiveCalculationService.ts`/`.test.ts`, `absenceService.ts`, `exportService.ts` und
die fünf Skripte aus Plan 11-08. **Kein Treffer außerhalb der bereits oben geführten Dateien**
— jede Datei, die den Kontext importiert, ist bereits als `[x]` abgehakt. Die Gegenprobe
bestätigt: es gibt keine sechste, unentdeckte Datei, die zwar den Kontext kennt, aber in dieser
Checkliste fehlt.

---

## Rückwärtsabgleich: Die 23 (tatsächlich 24) Fundstellen aus `09-INVENTAR-SOLLSTUNDEN.md`

`11-09-PLAN.md` nennt „23 klassifizierten Fundstellen". Ausgezählt (Fundstellen-Tabelle +
„UnifiedOvertimeService"-Abschnitt) ergeben sich **24 Tabellenzeilen** in
`09-INVENTAR-SOLLSTUNDEN.md` (2 kanonisch + 1 unified + 5 live + 10 legacy-overtimeService,
davon eine Leerzeilen-Sonderzeile + 1 Migration-Delegation + 1 Rebuild + 1
Pass-Through-TransactionService + 1 Absence + 1 Export + 1 fix-overtime = 24). Diese Abweichung
(23 vs. 24) wird hier festgehalten statt stillschweigend geglättet — vermutlich zählt der Plan
die Leerzeilen-Sonderzeile (`overtimeService.ts:347`, s. u.) nicht mit. Alle 24 Zeilen sind
unten aufgeführt und wiedergefunden oder mit Wegfallgrund vermerkt — keine bleibt ungeklärt.

Nummerierte Liste statt Tabelle (bewusst, damit diese Rückschau nicht als eigene
Fundstellen-Datenzeile gezählt wird — die verbindliche Zählung bleibt auf die Tabellen oben
beschränkt):

1. `workingDays.ts:63` `getDailyTargetHours` Def → heute `workingDays.ts:133`, Zeile verschoben (D1-D3-Erweiterung), Kanonische-Definitionen-Tabelle oben, `[x]`.
2. `workingDays.ts:336` `calculateTargetHoursForPeriod` Def → heute `workingDays.ts:418`, Zeile verschoben, oben `[x]`.
3. `unifiedOvertimeService.ts:115` → heute `:130`, oben `[x]`.
4. `overtimeLiveCalculationService.ts:66` (Vorfilter, kein `getDailyTargetHours`-Aufruf) → ersetzt durch `getDailyTargetHours`-Aufruf an `:65` (Plan 09-03); Funktion/Vorfilter entfernt, aufgegangen in der jetzt abgehakten Zeile `:65`.
5. `overtimeLiveCalculationService.ts:181` → heute `:194`, oben `[x]`.
6. `overtimeLiveCalculationService.ts:250` → heute `:269`, oben `[x]`.
7. `overtimeLiveCalculationService.ts:301` → heute `:320`, oben `[x]`.
8. `overtimeLiveCalculationService.ts:395` → heute `:422`, oben `[x]`.
9. `overtimeService.ts:110` → heute `:112`, oben `[x]`.
10. `overtimeService.ts:198` → heute `:198`, oben `[x]`.
11. `overtimeService.ts:309` → heute `:336`, oben `[x]`.
12. `overtimeService.ts:320` → Teil desselben Blocks wie #11, in der `:336`-Zeile mit erledigt.
13. `overtimeService.ts:347` (Leerzeile, keine echte Fundstelle laut 09-Dokument selbst) → entfällt, kein Code — das 09-Dokument vermerkt das bereits selbst.
14. `overtimeService.ts:360` → heute `:377`, oben `[x]`.
15. `overtimeService.ts:564` → heute `:578`, oben `[x]`.
16. `overtimeService.ts:847` → heute `:869`, oben `[x]`.
17. `overtimeService.ts:1323` → heute `:1372`, oben `[x]`.
18. `overtimeService.ts:595-660` `getOvertimeSummary` (Pass-Through) → unverändert, weiterhin Pass-Through, bewusst nicht als eigene Fundstelle geführt (s. Vermerk im `overtimeService.ts`-Abschnitt oben).
19. `overtimeService.ts:454` `updateMonthlyOvertime` (delegiert) → weiterhin reine Delegation, kein eigener Aufruf, s. Vermerk oben.
20. `overtimeTransactionRebuildService.ts:250` → heute `:276`, oben `[x]`.
21. `overtimeTransactionService.ts:406-418` `getOvertimeBalance` (Pass-Through) → unverändert, bewusst nicht als eigene Fundstelle geführt.
22. `absenceService.ts:1195` → heute `:1236`, oben `[x]`.
23. `exportService.ts:98` → heute `:103`, oben `[x]`.
24. `server/scripts/fix-overtime.ts:78` → unverändert an derselben Stelle, jetzt korrekt („zieht mit"), oben `[n/a]` in der Sondergruppen-Tabelle.

**Ergebnis:** Alle 24 Zeilen des Phase-9-Inventars sind wiedergefunden, entweder als
abgehakte/dispositionierte Zeile in dieser Checkliste oder mit explizitem Wegfallgrund
(Leerzeile, Pass-Through, Vorfilter aufgegangen). Keine Zeile ist kommentarlos gestrichen.

---

## Compiler-Fehlerliste nach 11-04 (unverändert aus dem Vorlauf übernommen)

**Erstellt:** 2026-08-22 (Plan 11-04, Task 3) — historischer Zwischenstand, nicht Teil der
Vollständigkeitsbewertung dieses Plans, aber als Beleg für den Ablauf der Welle 3 stehen
gelassen.

**Wörtliche Fehlerzahl: 29 Fehler in 10 Dateien** (Details unverändert wie im Vorlauf
protokolliert — siehe Git-Historie dieser Datei für den vollständigen Text vor der
Zusammenführung durch Plan 11-09). Aktueller Stand nach Abschluss aller Wellenpläne:
`cd server && npx tsc --noEmit` → 0 Fehler (bestätigt in `11-AUFRUFER-TEIL-06.md`, Abschnitt
„Projektweiter tsc-Stand").

---

## Vollständigkeitsbeleg Task 1

Prüfbefehl aus `11-09-PLAN.md` Task 1 (Desktop-Zeilen ausgenommen):

```
$ node -e "const fs=require('fs');const t=fs.readFileSync('.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md','utf8');const rows=t.split('\n').filter(l=>l.trim().startsWith('|')&&!/^\|\s*[-: ]+\|/.test(l)&&!/Datei:Zeile|Fundstelle|Disposition\s*\|/i.test(l));const desktop=rows.filter(l=>l.toLowerCase().includes('desktop/'));const offen=rows.filter(l=>!/\[x\]|\[n\/a\]/i.test(l)&&!l.toLowerCase().includes('desktop/'));console.log('Datenzeilen:',rows.length,'davon Desktop:',desktop.length,'ohne Haken/Disposition:',offen.length);process.exit(offen.length===0?0:1)"
```

**Wörtliche Ausgabe:**
```
Datenzeilen: 55 davon Desktop (Disposition folgt in Task 2): 4 ohne Haken/Disposition: 0
```
Exit 0. Die vier Desktop-Zeilen sind exakt wie im Plan erwartet ausgenommen; keine sonstige
Zeile ist offen.

---

## Vollständigkeitsbeleg Task 2 — derselbe Prüfbefehl, jetzt OHNE Desktop-Ausnahme

Nach Abschluss der Desktop-Disposition (`11-DESKTOP-DISPOSITION.md`) sind die vier
Desktop-Zeilen oben auf `[n/a]` gesetzt. Derselbe Prüfbefehl wie in Task 1, aber ohne die
Desktop-Ausnahme:

```
$ node -e "const fs=require('fs');const t=fs.readFileSync('.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md','utf8');const rows=t.split('\n').filter(l=>l.trim().startsWith('|')&&!/^\|\s*[-: ]+\|/.test(l)&&!/Datei:Zeile|Fundstelle|Disposition\s*\|/i.test(l));const offen=rows.filter(l=>!/\[x\]|\[n\/a\]/i.test(l));console.log('Datenzeilen:',rows.length,'ohne Haken/Disposition (KEINE Ausnahme):',offen.length);process.exit(offen.length===0?0:1)"
```

**Wörtliche Ausgabe:**
```
Datenzeilen: 55 ohne Haken/Disposition (KEINE Ausnahme): 0
```

Exit 0. Keine Datenzeile ist mehr offen — das abschließende Vollständigkeitskriterium dieses
Plans ist erfüllt.
