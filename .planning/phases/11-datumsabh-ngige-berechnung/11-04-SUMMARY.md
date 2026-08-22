---
phase: 11-datumsabh-ngige-berechnung
plan: 04
subsystem: work-period-resolution
tags: [tdd, core-rewrite, workingDays, D3, D4, breaking-signature]
dependency-graph:
  requires:
    - resolveWorkPeriodIn / resolveWorkPeriodAt (workPeriodService.ts, Plan 11-02)
    - WorkPeriodContext / createWorkPeriodContext / directWorkPeriodLookup (workPeriodContext.ts, Plan 11-02)
  provides:
    - "getDailyTargetHours(user, date, periods) — periodenbewusste Sollstunden-Auflösung"
    - "calculateAbsenceHoursWithWorkSchedule(user, startDate, endDate, periods) — nachgezogen"
    - "calculateTargetHoursForPeriod(user, fromDate, toDate, periods) — nachgezogen"
    - MissingWorkPeriodError (D4)
    - stubWorkPeriodContext / insertTestWorkPeriod (server/src/test-support/workPeriodFixtures.ts)
  affects:
    - "Alle 29 verbleibenden Compiler-Fehlerstellen (Pläne 11-05 bis 11-08) — tsc ist absichtlich ROT"
tech-stack:
  added: []
  patterns:
    - "Pflichtparameter ohne Vorgabewert als Compiler-Beweis für Vollständigkeit (D3)"
    - "Gemeinsame D4-Hilfsfunktion resolvePeriodForDate() für beide Kalender-Funktionen"
key-files:
  created:
    - server/src/test-support/workPeriodFixtures.ts
  modified:
    - server/src/utils/workingDays.ts
    - server/src/utils/workingDays.test.ts
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md
decisions:
  - "calculateAbsenceHoursWithWorkSchedule bleibt bewusst eine zweite Kopie der Regel (Wochenende immer übersprungen) — Zusammenführung mit getDailyTargetHours ausdrücklich Phase 14 vorbehalten (D5), Ausgangszustand-Kennzahl (0 von 20 Nutzern mit Wochenendstunden) als Beleg im Code-Kommentar"
  - "Test- und Implementierungsänderungen in workingDays.ts wurden NICHT strikt je Task in getrennte Commits gesplittet (Task 1 und Task 2 teilen sich dieselben Dateien); stattdessen ein test-Commit für beide Tasks zusammen und ein feat-Commit für beide Tasks zusammen, um eine saubere, überprüfbare Historie zu erhalten statt eines riskanten Patch-Splits in derselben Datei"
metrics:
  duration: "~70min"
  completed: "2026-08-22"
---

# Phase 11 Plan 04: Der Kernumbau — getDailyTargetHours löst über die Periode auf Summary

`getDailyTargetHours()`, `calculateAbsenceHoursWithWorkSchedule()` und
`calculateTargetHoursForPeriod()` lesen Sollstunden nicht mehr aus dem heutigen
Stammdatensatz, sondern aus der Periode, die am übergebenen Datum galt — mit einem
Pflichtparameter ohne Vorgabewert (D3), der den Compiler an jeder verbleibenden Aufrufstelle
zwingt, sich zu melden (29 Fehler in 10 Dateien, geprüft und der Aufrufer-Checkliste
zugeordnet).

## Was gebaut wurde

**Task 1 — `getDailyTargetHours` (Commits `d3a6f37` test, `c3c1fa8` feat):**

- `server/src/test-support/workPeriodFixtures.ts` neu angelegt: `stubWorkPeriodContext()`
  (baut `WorkPeriodContext` rein im Speicher über `resolveWorkPeriodIn()`, keine eigene
  Intervall-Logik) und `insertTestWorkPeriod()` (echte Periode über `createWorkPeriod()` für
  Tests, die den vollen Datenbankweg brauchen).
- `getDailyTargetHours(user, date, periods)`: dritter Parameter `periods: WorkPeriodContext`
  ohne Vorgabewert. Ablauf unverändert in der Reihenfolge: Feiertag zuerst (0h), dann
  `periods.resolve(user.id, dateStr)`, dann `period.workSchedule`, dann
  `period.weeklyHours === 0`, dann Wochenende (0h), dann `weeklyHours/5`. Die Zeilen, die
  `user.weeklyHours`/`user.workSchedule` lasen, sind aus der Funktion verschwunden
  (grep-verifiziert: `sed -n '/^export function getDailyTargetHours/,/^}/p' workingDays.ts |
  grep "user.weeklyHours\|user.workSchedule"` → 0 Treffer).
- Neue `MissingWorkPeriodError`-Klasse (D4): kein Periodentreffer und Datum ≥ `hireDate` →
  `logger.error({userId, date}, ...)` + Wurf; Meldung nennt ausschließlich `userId` und Datum
  (T-11-12, kein Name, keine E-Mail). Kein Periodentreffer und Datum < `hireDate` → weiterhin
  0, kein Fehler (bestehendes Verhalten, D4-Ausnahme).
- Gemeinsame Hilfsfunktion `resolvePeriodForDate(user, dateStr, periods)` kapselt diese D4-
  Logik für beide Kalender-Funktionen (Task 1 und Task 2).

**Task 2 — `calculateAbsenceHoursWithWorkSchedule` und `calculateTargetHoursForPeriod`
(gleiche Commits, da dieselben Dateien):**

- `calculateAbsenceHoursWithWorkSchedule(user, startDate, endDate, periods)`: löst pro Tag der
  Schleife die Periode über `resolvePeriodForDate` auf, statt `workSchedule`/`weeklyHours` als
  feste Parameter für den ganzen Zeitraum zu nehmen. Wochenend-/Feiertagsprüfung Zeile für
  Zeile unverändert übernommen. Ein Tag vor `hireDate` trägt 0 bei (kein Fehler), ein Tag ab
  `hireDate` ohne Periodentreffer wirft `MissingWorkPeriodError`.
  Begründungskommentar über der Funktion (Acceptance Criteria): nennt die
  `11-AUSGANGSZUSTAND.md`-Kennzahl (e) — 0 von 20 Nutzern mit `workSchedule.saturday > 0` oder
  `sunday > 0` — als Beleg, warum die Zusammenführung mit `getDailyTargetHours` heute keine
  Zahl bewegen würde, aber trotzdem nicht in dieser Phase vorgezogen wird (D5, Phase 14
  vorbehalten).
- `calculateTargetHoursForPeriod(user, fromDate, toDate, periods)`: `periods` als vierter
  Pflichtparameter, durchgereicht an `getDailyTargetHours`. Vorfilter
  `if (isWeekend && !user.workSchedule) continue;` entfernt (REQ-17-Muster,
  grep-verifiziert: 0 Treffer) — `getDailyTargetHours` entscheidet jetzt selbst über
  Wochenende/Feiertag/Wochenplan.

**Task 3 — Tests nachgezogen, Compiler-Fehlerliste abgeglichen (Commit `d18b5b3`):**

- Alle ~30 Aufrufstellen in `workingDays.test.ts` auf die neue Signatur gebracht (Testhilfen
  `periodsFor()`/`absenceFixture()` innerhalb der Testdatei, bauen `WorkPeriodContext` aus den
  bestehenden `user`/`workSchedule`-Testobjekten mit einer einzigen, weit zurückliegenden
  Periode ab `2000-01-01` — kein bestehender Erwartungswert wurde verändert).
  9 neue Tests für die D1-4-Verhaltensfälle aus dem Plan (Periodenwechsel, Stichtag halboffen,
  Wochenend-Fallback, Wochenplan nach Stichtag, Feiertag vor Periode, Aushilfe, drei D4-Fälle)
  plus 3 neue Tests für Task 2 (Stichtag mitten im Absence-Zeitraum, Feiertag im Zeitraum,
  `calculateTargetHoursForPeriod` = Summe der Einzeltage). `npx vitest run
  src/utils/workingDays.test.ts` → **82/82 grün** (vorher ~70 Tests; Anzahl gestiegen, keine
  verringert).
- `npx tsc --noEmit`: **29 Fehler in 10 Dateien** (gespeichert und Zeile für Zeile gegen
  `11-AUFRUFER-CHECKLISTE.md` abgeglichen). Ergebnis als neuer Abschnitt „Compiler-Fehlerliste
  nach 11-04" in der Checkliste dokumentiert: reine Zeilendrift bei sechs Fundstellen
  (Kommentar, erwartet laut Kopfnotiz der Checkliste), ein struktureller Sonderfall bei
  `validateOvertimeDetailed.ts` (die Datei hält `getDailyTargetHours` in einer lokal typisierten
  Modulvariablen; der Compiler meldet nur die Zuweisung an dieser Variable — Zeile 1089 — statt
  aller drei tatsächlichen Aufrufstellen 473/634/682, weil die Aufrufe selbst noch gegen die
  veraltete lokale Typsignatur kompilieren), und eine bereits vorher bestehende Zähldifferenz
  in der Zusammenfassungstabelle der Checkliste selbst (10 vs. 11 Fundstellenzeilen für 11-08)
  — beide Abweichungen vermerkt statt stillschweigend übernommen.

## Verifikation

- `npx vitest run src/utils/workingDays.test.ts` → 82/82 grün.
- `npx tsc --noEmit` → ROT, 29 Fehler in 10 Dateien (erwarteter Zwischenzustand, s. o.) — deckt
  sich mit der Aufrufer-Checkliste.
- `grep -n "user.weeklyHours\|user.workSchedule"` innerhalb von `getDailyTargetHours` → 0
  Treffer.
- `grep -n "isWeekend && !user.workSchedule" workingDays.ts` → 0 Treffer.
- `grep -n "validTo"` in `workPeriodFixtures.ts` → nur Zuweisungen, kein Vergleich, keine
  eigene Intervall-Auflösung.
- `server/database/11-nullwirkung.db` nicht angefasst (kein Skript in diesem Plan hat darauf
  zugegriffen).

## Deviations from Plan

### Auto-fixed Issues

Keine Rule-1/2/3-Bugfixes — der Plan wurde wie geschrieben umgesetzt.

### Prozedurale Anpassung (dokumentiert, kein Rule-1-4-Fall)

**1. Commit-Granularität abweichend von der Task-Grenze.** Der Plan sieht implizit einen
eigenen test/feat-Commit-Zyklus je Task vor. Da Task 1 und Task 2 dieselben zwei Dateien
(`workingDays.ts`, `workingDays.test.ts`) an eng benachbarten/überlappenden Stellen ändern
(gemeinsame Hilfsfunktion `resolvePeriodForDate`, gemeinsame Testhilfe `periodsFor`), wurde
stattdessen EIN test-Commit für beide Tasks (`d3a6f37`) und EIN feat-Commit für beide Tasks
(`c3c1fa8`) erstellt, statt die Datei-Diffs riskant per Patch in vier Teile zu zerlegen. Die
TDD-Gate-Reihenfolge (test vor feat) ist eingehalten; die Task-3-Arbeit (Tests weiterer
Aufrufstellen, Compiler-Abgleich) ist ein separater dritter Commit (`d18b5b3`).

## Bekannte Nebenwirkung (erwartet, nicht Teil dieses Plans)

`npx vitest run` über den gesamten Server zeigt jetzt 32 Fehlschläge in 6 Dateien (vorher
342/345, 3 bekannte, unabhängige Fehlschläge). Ursache: Services, die
`getDailyTargetHours`/`calculateAbsenceHoursWithWorkSchedule`/`calculateTargetHoursForPeriod`
noch mit der alten Signatur aufrufen (`unifiedOvertimeService.ts`,
`overtimeTransactionRebuildService.ts`, `overtimeLiveCalculationService.ts`,
`overtimeService.ts`, `absenceService.ts` — alle laut `11-AUFRUFER-CHECKLISTE.md` den Plänen
11-05 bis 11-07 zugeordnet), erhalten `periods === undefined` und werfen zur Laufzeit einen
`TypeError` in `resolvePeriodForDate`. Dies ist der vom Plan **ausdrücklich vorgesehene**
Zwischenzustand (D3: „Ein Compiler-Fehler an jeder Aufrufstelle ist hier ein Feature"); die
Plan-eigene `<verification>` beschränkt „kein neuer roter Test" bewusst auf `src/utils/` — dort
ist die Suite grün (82/82). Die bereits vorher bekannten 3 Fehlschläge
(`unifiedOvertimeService.test.ts` ×2, `vacationBackfillService.test.ts` ×1, „erkennt einen
bereits gelaufenen Backfill") sind unverändert unter den 32 enthalten. Alle 29 neuen
Fehlschläge sind Aufgabe der Pläne 11-05 bis 11-08 und werden dort geschlossen — nicht in
diesem Plan, wie im Plan-Text selbst vorgegeben.

## Self-Check: PASSED

Alle genannten Dateien vorhanden, alle drei Commits (`d3a6f37`, `c3c1fa8`, `d18b5b3`) im
Git-Log auffindbar.
