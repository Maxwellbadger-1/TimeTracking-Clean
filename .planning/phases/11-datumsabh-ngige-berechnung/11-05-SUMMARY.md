---
phase: 11-datumsabh-ngige-berechnung
plan: 05
subsystem: overtime-calculation
tags: [tdd, workPeriodContext, unifiedOvertimeService, overtimeTransactionRebuildService, D1, D3, REQ-24]

requires:
  - phase: 11-04
    provides: "getDailyTargetHours(user, date, periods) mit Pflichtparameter periods (D3), MissingWorkPeriodError (D4), stubWorkPeriodContext/insertTestWorkPeriod"
  - phase: 11-02
    provides: "createWorkPeriodContext()/directWorkPeriodLookup (D1, D2)"
provides:
  - "unifiedOvertimeService: calculateDailyOvertime/-Monthly/-Period rechnen periodenbewusst, ein Kontext je Lauf"
  - "overtimeTransactionRebuildService: collectDailyCalculations() periodenbewusst, ein Kontext je Rebuild"
  - "Idempotenz-Regressionstest fuer den Rebuild (REQ-24), schneller Vorlaufer zum phasenweiten Nachweis in 11-09/11-10"
affects: [11-09, 11-10, dashboard, reports, monatsabschluss, rebuild]

tech-stack:
  added: []
  patterns:
    - "Parameter-Default periods = directWorkPeriodLookup fuer Routen-Methoden ohne eigenen Berechnungslauf; periods = createWorkPeriodContext() fuer Methoden mit Tagesschleife (D1/D2)"
    - "Namensraum-Import (import * as workPeriodContextModule) statt Named Import, wenn ein grep-Kriterium genau eine Aufrufstelle einer Fabrikfunktion nachweisen soll"
    - "insertTestWorkPeriod()-Aufrufe MUESSEN innerhalb des try-Blocks stehen, nicht davor — sonst verhindert ein Fixture-Fehler das finally-Aufraeumen und hinterlaesst Testnutzer in der geteilten Arbeitsdatenbank"

key-files:
  created:
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-05.md
  modified:
    - server/src/services/unifiedOvertimeService.ts
    - server/src/services/unifiedOvertimeService.test.ts
    - server/src/services/overtimeTransactionRebuildService.ts
    - server/src/services/overtimeTransactionRebuildService.test.ts

key-decisions:
  - "calculateDailyOvertime() behaelt einen Vorgabewert (directWorkPeriodLookup), obwohl D3 fuer getDailyTargetHours selbst einen Pflichtparameter verlangt — begruendet im Plan: Routen kennen keinen Berechnungslauf, der Vorgabewert haelt ihre Signatur stabil und liefert nach D2 dieselbe Semantik (kein Modul-Cache, nur ohne Vorladen)"
  - "handleAbsenceDay() unveraendert gelassen, nachdem die Datei geprueft (nicht angenommen) wurde: die Funktion ruft getDailyTargetHours nicht selbst auf, sondern rechnet ausschliesslich mit dem von collectDailyCalculations bereits aufgeloesten day.targetHours"
  - "Namensraum-Import fuer createWorkPeriodContext in overtimeTransactionRebuildService.ts, damit der grep-Nachweis 'genau ein Aufruf vor der Tagesschleife' nicht durch die Importzeile verfaelscht wird"

requirements-completed: [REQ-23, REQ-24]

duration: "~25min"
completed: "2026-08-22"
---

# Phase 11 Plan 05: Kanonischer Weg + Rebuild periodenbewusst Summary

`unifiedOvertimeService` und `overtimeTransactionRebuildService` — Dashboard, Berichte,
Monatsabschluss und der Transaktions-Rebuild — lösen Sollstunden jetzt über einen einmal je
Lauf gebauten `WorkPeriodContext` auf, statt implizit gegen den heutigen Stammdatensatz zu
rechnen; ein REQ-24-Idempotenztest mit maschinellem JSON-Vergleich sichert den Rebuild
zusätzlich ab.

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-22
- **Tasks:** 2 (beide TDD: RED → GREEN)
- **Files modified:** 4 (+ 1 neu: Teilbeleg)

## Accomplishments
- `calculateDailyOvertime`/`calculateMonthlyOvertime`/`calculatePeriodOvertime` reichen einen
  `WorkPeriodContext` durch; die beiden Zeitraum-Methoden bauen ihn genau einmal je Lauf
  (D1, per Zähler-Nachweis-Test belegt: `getWorkPeriods` 1x statt 1x je Tag).
- `overtimeTransactionRebuildService.collectDailyCalculations()` bekommt `periods` als
  Pflichtparameter; `rebuildOvertimeTransactionsForMonth()` baut den Kontext einmal vor der
  Tagesschleife (grep-verifiziert: genau ein Treffer für `createWorkPeriodContext`).
- REQ-24: neuer Idempotenztest führt denselben Monat zweimal durch den Rebuild und vergleicht
  `overtime_transactions` + `overtime_balance` beider Läufe über eine kanonisch sortierte
  JSON-Darstellung — grün.
- Stichtag-mitten-im-Monat-Verhalten für beide Dienste per Test belegt (40h→20h-Wechsel:
  Tag davor 8h/-8h, Tag danach 4h/-4h Sollstunden).
- Bug in eigenen Testfixtures gefunden und behoben (Rule 1, s. u.): `insertTestWorkPeriod()`
  stand ursprünglich vor dem `try`-Block zweier bestehender Tests — ein Fixture-Fehler hätte
  das `finally`-Aufräumen übersprungen und Testnutzer in der geteilten
  `server/database/development.db` hinterlassen (genau das Muster, vor dem `.continue-here.md`
  warnt).

## Task Commits

Beide Tasks folgten TDD (RED → GREEN):

1. **Task 1: unifiedOvertimeService — ein Kontext je Lauf**
   - `b196529` (test) — RED: 20/21 rot, alte 2-Parameter-Signatur
   - `c09fda0` (feat) — GREEN: 19/21 grün, 2 verbleibende = dokumentierter Ausgangszustand
2. **Task 2: overtimeTransactionRebuildService — periodenbewusst und wiederholbar**
   - `b2c2524` (test) — RED: 7/8 rot, `collectDailyCalculations` ohne `periods`
   - `5ad1169` (feat) — GREEN: 8/8 grün
   - `2c0163a` (docs) — Teilbeleg `11-AUFRUFER-TEIL-05.md`

**Plan metadata:** siehe Self-Check/State-Update unten (folgt nach diesem Commit)

## Files Created/Modified
- `server/src/services/unifiedOvertimeService.ts` — `periods: WorkPeriodContext` an allen drei
  öffentlichen Methoden, Vorgabewerte gemäß Plan-Begründung (`directWorkPeriodLookup` bzw.
  `createWorkPeriodContext()`); bleibt reiner Lesepfad (grep: 0 INSERT/UPDATE/DELETE/`.run(`)
- `server/src/services/unifiedOvertimeService.test.ts` — Testnutzer erhalten passende
  `user_work_periods`; 6 neue Tests für D1-D4-Verhaltensfälle
- `server/src/services/overtimeTransactionRebuildService.ts` — `collectDailyCalculations()`
  mit `periods`-Pflichtparameter, `user: any` → `UserPublic`, Kontext-Aufbau vor der
  Tagesschleife (Namensraum-Import)
- `server/src/services/overtimeTransactionRebuildService.test.ts` — Testnutzer erhält Periode;
  4 neue Tests (Stichtag, REQ-24-Idempotenz, D1-Zähler-Nachweis, Aufräumnachweis)
- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-05.md` (neu) — Teilbeleg
  für die zwei diesem Plan zugeordneten Fundstellen der Aufrufer-Checkliste

## Decisions Made
Siehe `key-decisions` im Frontmatter (Vorgabewert-Begründung für `calculateDailyOvertime`,
`handleAbsenceDay` unverändert nach Prüfung, Namensraum-Import für den grep-Nachweis).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Testfixture-Aufruf stand außerhalb des try-Blocks und verhinderte bei einem Fixture-Fehler das Aufräumen**
- **Found during:** Task 1, beim ersten GREEN-Testlauf (`UNIQUE constraint failed: users.email`
  für `feb@test.com`/`febfirst@test.com` — Nutzer aus einem vorangegangenen RED-Lauf blieben
  in `server/database/development.db` liegen)
- **Issue:** In den beiden Tests `should respect hire date and not include pre-employment
  months` und `REGRESSION: User hired on 1st of month should calculate correctly` stand der
  `insertTestWorkPeriod(...)`-Aufruf vor dem `try { ... } finally { DELETE FROM users ... }`.
  Da `insertTestWorkPeriod` beim ersten Versuch wegen eines zu unvollständigen
  `WorkSchedule`-Objekts warf (siehe Fix 2), lief das `finally` nie, der Testnutzer blieb
  liegen — beim nächsten Testlauf schlug dieselbe `INSERT INTO users`-Zeile mit
  `UNIQUE constraint failed: users.email` fehl, weil die E-Mail schon vergeben war.
- **Fix:** `insertTestWorkPeriod(...)` in beide Tests in den `try`-Block verschoben (direkt vor
  die eigentliche Berechnung), damit jeder Fehler ab Nutzeranlage das `finally`-Aufräumen
  auslöst. Betroffene Leftover-Zeilen in `development.db` manuell bereinigt
  (`DELETE FROM users WHERE id IN (...)`, cascade-verifiziert über `user_work_periods`).
- **Files modified:** `server/src/services/unifiedOvertimeService.test.ts`
- **Verification:** Erneuter Testlauf zeigte keine `UNIQUE constraint`-Fehler mehr; direkte
  DB-Abfrage nach dem Lauf bestätigte 0 verbliebene Zeilen mit `feb@test.com`/
  `febfirst@test.com`.
- **Committed in:** `c09fda0` (Teil des GREEN-Commits für Task 1)

**2. [Rule 1 - Bug] WorkSchedule-Testobjekt unvollständig (fehlende Wochenendschlüssel)**
- **Found during:** Task 1, GREEN-Testlauf
- **Issue:** `{ monday: 2, tuesday: 2, wednesday: 2, thursday: 2, friday: 2 }` (aus dem
  bestehenden `users.workSchedule`-Rohwert übernommen) erfüllt nicht den `WorkSchedule`-Typ,
  den `workPeriodService.ts`s `parseWorkSchedule()` beim Lesen aus `user_work_periods`
  streng validiert (alle sieben Wochentagsschlüssel Pflicht) — Laufzeitfehler
  `Periode …: workSchedule ist kein gültiger Wochenplan`.
- **Fix:** `saturday: 0, sunday: 0` ergänzt. Der ursprüngliche, unvollständige Wert in
  `users.workSchedule` selbst bleibt unangetastet (wird nach diesem Plan nicht mehr gelesen).
- **Files modified:** `server/src/services/unifiedOvertimeService.test.ts`
- **Verification:** `npx vitest run src/services/unifiedOvertimeService.test.ts` — kein
  `parseWorkSchedule`-Fehler mehr, die beiden betroffenen Tests reproduzieren wieder exakt den
  dokumentierten Ausgangszustand (`AssertionError: expected 40 to be 10`, identisch mit
  `11-AUSGANGSZUSTAND.md` Zeile 258/260).
- **Committed in:** `c09fda0`

---

**Total deviations:** 2 auto-fixed (beide Rule 1, beide in Testfixtures derselben Datei,
keine Produktionslogik betroffen).
**Impact on plan:** Keine Scope-Erweiterung — beide Fixes waren nötig, um die vom Plan selbst
verlangten Verhaltenstests (Stichtag-Szenario mit `workSchedule`) überhaupt lauffähig zu
machen, ohne die geteilte Arbeitsdatenbank zu verschmutzen.

## Issues Encountered
Keine über die beiden dokumentierten Auto-Fixes hinaus.

## Momentaufnahme: projektweiter Stand nach diesem Plan

Wie im Plan-Zwischenzustand vorgegeben, war `npx tsc --noEmit` zu Beginn dieses Plans noch
projektweit rot (29 Fehler in 10 Dateien, Erbe aus Plan 11-04). **Für die beiden Dateien
dieses Plans gilt das Prüfkriterium erfüllt:** `npx tsc --noEmit 2>&1 | grep -E
"unifiedOvertimeService|overtimeTransactionRebuildService"` liefert keine Zeile.

Zum Zeitpunkt des Abschlusses dieses Plans (07:45 Uhr) waren die parallel laufenden Pläne
11-06/11-07/11-08/11-11 derselben Welle bereits so weit fortgeschritten, dass ein
projektweiter `npx tsc --noEmit` **0 Fehler** und `npx vitest run` **370/373 grün** zeigte —
die verbleibenden 3 Fehlschläge sind exakt die drei dokumentierten, vorbestehenden,
unabhängigen Fälle (2× `unifiedOvertimeService.test.ts` Eintrittsdatum/Sollstunden, 1×
`vacationBackfillService.test.ts`). Dies ist eine Momentaufnahme des Wellenstands, kein
Ergebnis dieses Plans allein — der verbindliche Abschlussnachweis für die gesamte Welle 3
bleibt Plan 11-09 vorbehalten.

## User Setup Required
None - keine externe Konfiguration nötig.

## Next Phase Readiness
Beide Fundstellen dieses Plans sind in `11-AUFRUFER-TEIL-05.md` abgehakt und mit wörtlichen
grep-Belegen versehen. `server/database/11-nullwirkung.db` wurde durch diesen Plan nicht
berührt (kein Skript dieses Plans hat darauf zugegriffen). `11-AUFRUFER-CHECKLISTE.md` bleibt
unverändert für die sequenzielle Zusammenführung in Plan 11-09. Keine Blocker für 11-09/11-10
erkennbar.

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle genannten Dateien vorhanden (6/6), alle fünf Commits (`b196529`, `c09fda0`, `b2c2524`,
`5ad1169`, `2c0163a`) im Git-Log auffindbar.
