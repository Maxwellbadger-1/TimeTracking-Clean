---
phase: 09-ein-ma-stab-ein-weg
plan: 05
subsystem: overtime-calculation
tags: [sqlite, better-sqlite3, timezone, tdd, vitest, overtime, req-19]

requires:
  - phase: 09-ein-ma-stab-ein-weg (09-04)
    provides: REQ-19-Kernfix in unifiedOvertimeService.ts und overtimeTransactionRebuildService.ts
provides:
  - "Vollzähliges Inventar aller zwölf Fundstellen der Abwesenheits-Kreditierungsregel (09-INVENTAR-KREDITIERUNG.md)"
  - "overtime_comp senkt den Saldo auch auf dem Live-Lesepfad (GET /transactions/live) und dem Schreibpfad (GET /transactions/monthly-summary)"
  - "Alle vier Validierungs-/Vergleichswerkzeuge auf DATABASE_PATH und denselben kanonischen Produktionsschutz gehoben"
  - "Monatsend-Off-by-one im Transaktionsjournal behoben (overtimeTransactionRebuildService.ts und overtimeService.ts)"
  - "Erfolgskriterium 3 der ROADMAP erfüllt und mit Vorher/Nachher-Beleg dokumentiert (09-ABSCHLUSS-NACHWEIS.md)"
  - "Phase 9.1 in ROADMAP.md und REQUIREMENTS.md verankert (D2, Journal-Backfill + Betriebs-Härtung)"
affects: [phase-9.1, phase-11, phase-14]

tech-stack:
  added: []
  patterns:
    - "Guard-vor-jedem-Import-Muster (compareOvertimePaths.ts) auf validateOvertimeDetailed.ts, validateOvertimeCalculation.ts, reproduceOvertimeCompDefect.ts ausgeweitet: import-sichere Module + synchroner assertNotProduction() + await import() erst danach"
    - "Kombinierter Produktionsschutz (Pfadgleichheit + NODE_ENV + Substring-Fallback) statt reiner Zeichenketten-Heuristik, WR-06"
    - "Lokale Datumszerlegung (split('-').map(Number) -> new Date(jahr, monat, tag)) statt new Date(ISO-String) für Monatsgrenzen, Eintrittsdatum und Abwesenheitsgrenzen"

key-files:
  created:
    - .planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-KREDITIERUNG.md
    - .planning/phases/09-ein-ma-stab-ein-weg/09-ABSCHLUSS-NACHWEIS.md
    - server/src/services/overtimeService.test.ts
    - server/src/services/overtimeTransactionRebuildService.test.ts
  modified:
    - server/src/services/overtimeLiveCalculationService.ts
    - server/src/services/overtimeService.ts
    - server/src/services/overtimeTransactionRebuildService.ts
    - server/src/services/overtimeTransactionService.ts
    - server/src/scripts/validateOvertimeDetailed.ts
    - server/src/scripts/validateOvertimeCalculation.ts
    - server/src/scripts/reproduceOvertimeCompDefect.ts
    - server/src/scripts/compareOvertimePaths.ts
    - server/src/test/generateTestData.ts
    - .planning/ROADMAP.md
    - .planning/REQUIREMENTS.md
    - .planning/phases/09-ein-ma-stab-ein-weg/deferred-items.md

key-decisions:
  - "Produktionsschutz kombiniert Pfadgleichheit(getProductionDatabasePath()) + NODE_ENV + Substring-Fallback, weil getProductionDatabasePath() strukturell den lokalen Fallback-Pfad server/database.db liefert, nicht den realen Produktionspfad /home/ubuntu/databases/production.db — gemessen, dass ohne den Substring-Fallback der D5-Kanarientest den Guard nicht ausgelöst hätte"
  - "validateOvertimeDetailed.ts und validateOvertimeCalculation.ts nutzen die geteilte DB-Verbindung aus database/connection.js statt einer eigenen new Database() — eliminiert die zweite, unkonfigurierte WAL-Verbindung (Vorfall 18.08.2026), keine neuen Nebenwirkungen, da der Schema-Init bereits transitiv über den bestehenden getUserById-Import erfolgte"
  - "overtime_comp-Tage erhalten in der Live-Transaktionsliste eine informationelle 0h-Gutschriftzeile (analog unpaid_deduction) statt die Gutschriftzeile ganz zu entfernen — Anzeigelogik/Sortierpriorität bleibt unverändert"
  - "overtime_comp aus dem SQL-Filter der Schreibpfade entfernt statt im switch/case einen Sonderfall zu behandeln — vermeidet einen bei jedem Aufruf wiederkehrenden Zähler-Durchlauf ins Leere"

patterns-established:
  - "Jede Kopie der Abwesenheits-Kreditierungsregel muss gegen die zwölf Fundstellen aus 09-INVENTAR-KREDITIERUNG.md geprüft werden, nicht nur gegen die zuletzt bekannten drei"

requirements-completed: [REQ-17, REQ-18]

duration: ~55min
completed: 2026-08-22
---

# Phase 9 Plan 5: Lückenschluss — Ein Maßstab, ein Weg Summary

**Zwölf statt vier Fundstellen der `overtime_comp`-Kreditierungsregel gezählt, die beiden verbleibenden aktiven Kopien (Live-Lesepfad, Schreibpfad) und alle vier Werkzeuge auf denselben Maßstab gebracht, den Monatsend-Off-by-one im Transaktionsjournal behoben und Erfolgskriterium 3 mit Vorher/Nachher-Beleg erfüllt.**

## Performance

- **Duration:** ~55 min
- **Completed:** 2026-08-22
- **Tasks:** 4 (zwei davon TDD, RED→GREEN)
- **Files modified:** 16 (4 neu, 12 geändert)

## Accomplishments

- **Inventar statt Annahme:** `09-INVENTAR-KREDITIERUNG.md` zählt zwölf Fundstellen mit
  Kreditentscheidung (statt der ursprünglich vermuteten vier), klassifiziert jede
  (kanonisch/behoben/offen/unerreichbar/toter Code/Testdaten) und benennt die falsche
  Reichweitenannahme aus `09-04-PLAN.md`, die CR-01 unentdeckt ließ.
- **Beide verbleibenden aktiven API-Pfade geschlossen:** `GET /transactions/live`
  (`overtimeLiveCalculationService.ts`) und `GET /transactions/monthly-summary`
  (`overtimeService.ts`) behandeln einen genehmigten Ausgleichstag jetzt wie
  `unifiedOvertimeService.getAbsenceCredit()` — der Saldo sinkt statt neutral oder positiv
  zu bleiben.
- **Alle vier Werkzeuge vereinheitlicht:** `validateOvertimeDetailed.ts`,
  `validateOvertimeCalculation.ts`, `compareOvertimePaths.ts`,
  `reproduceOvertimeCompDefect.ts` lesen `DATABASE_PATH` konsistent, brechen bei
  Produktionspfad **und** `NODE_ENV=production` mit Exit 2 ab (empirisch gegen den realen
  Kanarienpfad gemessen), und messen `overtime_comp` mit demselben Maßstab wie die Services.
- **Monatsend-Off-by-one behoben, zwei Fundstellen:** `overtimeTransactionRebuildService.ts`
  (der geplante Fund) UND ein zweiter, tatsächlich erreichbarer Fund in
  `overtimeService.ts` (`ensureAbsenceTransactions()`, aktiver Schreibpfad) — bei der vom
  Plan vorgeschriebenen Suche nach demselben Muster gefunden und empirisch reproduziert,
  nicht nur angenommen.
- **Erfolgskriterium 3 erfüllt:** Alle drei Prüfnutzer zeigen nach einem Rebuild mit dem
  gefixten Code `✅ Transaction validation: PASSED` — mit wörtlichem Vorher/Nachher-Beleg
  gegen eine WAL-konsistente Wegwerfkopie (`09-ABSCHLUSS-NACHWEIS.md`).
- **D2 angewendet, kein dritter Ausgang:** Phase 9.1 in `.planning/ROADMAP.md` (Phasenübersicht-
  Tabelle + eigener Abschnitt) und `.planning/REQUIREMENTS.md` (Abdeckungstabelle) verankert —
  der Codefix repariert nur künftige Rebuilds, der Backfill der Produktions-Bestandsdaten ist
  ein von D5 verbotener Schreibzugriff in Phase 9.

## Task Commits

1. **Task 1: Inventar der Kreditierungsregel** - `b3f3e52` (docs)
2. **Task 2 RED: Tests für Live- und Schreibpfad** - `b00be76` (test)
2. **Task 2 GREEN: overtime_comp senkt Saldo auf beiden Pfaden** - `edc51f1` (feat)
3. **Task 3: Werkzeuge auf DATABASE_PATH und Guard gehoben** - `65721fd` (feat)
4. **Task 4 RED: Test für Monatsend-Off-by-one** - `ace568c` (test)
4. **Task 4 GREEN: Monatsend-Off-by-one behoben** - `c81c44f` (feat)
4. **Task 4 Doku: Kriterium-3-Nachweis, D2-Verankerung** - `012cab9` (docs)

**Plan metadata:** (dieser Commit, docs: complete plan)

## Files Created/Modified

- `.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-KREDITIERUNG.md` - Zwölf klassifizierte Fundstellen, Suchläufe mit Rohtrefferzahl, Urteil
- `.planning/phases/09-ein-ma-stab-ein-weg/09-ABSCHLUSS-NACHWEIS.md` - Vorher/Nachher-Beleg Kriterium 3, Ursachenkorrektur, WR-03-Bewertung
- `server/src/services/overtimeLiveCalculationService.ts` - CR-01: overtime_comp erhält negative earned-Buchung statt Gutschrift
- `server/src/services/overtimeLiveCalculationService.test.ts` - 4 neue Tests für CR-01
- `server/src/services/overtimeService.ts` - Schreibpfad: overtime_comp aus Kreditfilter entfernt; Monatsend-Off-by-one in zwei Funktionen behoben
- `server/src/services/overtimeService.test.ts` - Neu: 4 Tests (Schreibpfad, Idempotenz, Monatsend-Regression)
- `server/src/services/overtimeTransactionRebuildService.ts` - Monatsend-Off-by-one behoben (lokale Datumszerlegung)
- `server/src/services/overtimeTransactionRebuildService.test.ts` - Neu: 4 Tests (Sommer-/Wintermonat, targetHours-Konsistenz, Regression)
- `server/src/services/overtimeTransactionService.ts` - Kommentar an recordOvertimeCompCredit(): nicht mehr automatisch aufgerufen
- `server/src/scripts/validateOvertimeDetailed.ts` - Geteilte DB-Verbindung, Guard, Kreditfilter, time_entry→earned-Abbildung
- `server/src/scripts/validateOvertimeCalculation.ts` - Guard, Kreditfilter; departmentId/sign-Bugs behoben (blockierten Verifikation)
- `server/src/scripts/reproduceOvertimeCompDefect.ts` - WR-06-Guard, WR-01 (toISOString entfernt)
- `server/src/scripts/compareOvertimePaths.ts` - WR-06-Guard (Deviation, nicht in Plan-files_modified, aber von Acceptance-Criteria gefordert)
- `server/src/test/generateTestData.ts` - ESM-Bug (require.main) behoben; overtime-compensation-Szenario auf REQ-19-Werte korrigiert (Deviation)
- `.planning/ROADMAP.md` - Phase 9.1 an zwei Stellen verankert
- `.planning/REQUIREMENTS.md` - Abdeckungstabelle REQ-19 → 9 → 9.1
- `.planning/phases/09-ein-ma-stab-ein-weg/deferred-items.md` - 36h-Befund aufgelöst, zwei neue Restbefunde aus Task 3 vermerkt

## Decisions Made

- Produktionsschutz-Guard kombiniert Pfadgleichheit + `NODE_ENV` + Substring-Fallback, weil
  `getProductionDatabasePath()` strukturell nicht dem realen Produktionspfad entspricht (siehe
  key-decisions oben) — gemessen, nicht angenommen.
- `validateOvertimeDetailed.ts`/`validateOvertimeCalculation.ts` nutzen jetzt die geteilte
  DB-Verbindung statt einer eigenen `new Database()` — eliminiert die zweite,
  WAL-riskante Verbindung.
- `overtime_comp`-Tage zeigen in der Live-Liste eine informationelle 0h-Zeile statt ganz zu
  verschwinden — Anzeigelogik bleibt unverändert, Nettowirkung stimmt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `compareOvertimePaths.ts` auf denselben WR-06-Guard gehoben**
- **Found during:** Task 3
- **Issue:** Die Plan-`<files>`-Liste für Task 3 nennt `compareOvertimePaths.ts` nicht, aber
  Action-Text und Acceptance-Criteria fordern ausdrücklich "Alle drei Werkzeuge ... ziehe
  dieselbe robuste Form in `compareOvertimePaths.ts` ... nach" bzw. "Alle vier Werkzeuge ...
  brechen ... ab" — ein Widerspruch im Plan selbst.
- **Fix:** Denselben kombinierten Guard wie in den anderen drei Werkzeugen eingebaut.
- **Files modified:** `server/src/scripts/compareOvertimePaths.ts`
- **Verification:** D5-Kanarientest (Exit 2) bestanden.
- **Committed in:** `65721fd`

**2. [Rule 3 - Blocking] `generateTestData.ts`: `require.main === module` (ESM-Bug)**
- **Found during:** Task 3, funktionale Verifikation von `validateOvertimeCalculation.ts`
- **Issue:** CommonJS-Muster in einem ESM-Modul warf bei jedem Import einen `ReferenceError`
  — machte `validateOvertimeCalculation.ts` (statischer Import) vollständig unbenutzbar,
  unabhängig von REQ-19.
- **Fix:** ESM-Äquivalent (`process.argv[1] === fileURLToPath(import.meta.url)`).
- **Files modified:** `server/src/test/generateTestData.ts`
- **Verification:** `npx tsx validateOvertimeCalculation.ts --scenario=...` läuft.
- **Committed in:** `65721fd`

**3. [Rule 1 - Bug] `validateOvertimeCalculation.ts`: Spalte `departmentId` existiert nicht**
- **Found during:** Task 3
- **Issue:** `SELECT ... departmentId FROM users` schlug mit `SqliteError` fehl (echte Spalte:
  `department`, `schema.ts:42`) — blockierte jeden Aufruf mit `--userId=`.
- **Fix:** Auf `department` korrigiert.
- **Files modified:** `server/src/scripts/validateOvertimeCalculation.ts`
- **Verification:** Lauf gegen Wegwerfkopie erfolgreich.
- **Committed in:** `65721fd`

**4. [Rule 1 - Bug] `validateOvertimeCalculation.ts`: `formatOvertimeHours()` verlor das Minuszeichen**
- **Found during:** Task 3
- **Issue:** `sign = hours >= 0 ? '+' : ''` gab für negative Stunden eine leere Zeichenkette
  zurück — jeder negative Saldo erschien ohne Minuszeichen (irreführend, gerade beim
  frisch korrigierten `overtime-compensation`-Szenario aufgefallen).
- **Fix:** `sign = hours >= 0 ? '+' : '-'`.
- **Files modified:** `server/src/scripts/validateOvertimeCalculation.ts`
- **Verification:** Szenario zeigt jetzt korrekt `-24:00h`.
- **Committed in:** `65721fd`

**5. [Rule 1 - Bug] `generateTestData.ts`: `overtime-compensation`-Szenario auf veralteten Erwartungswerten**
- **Found during:** Task 3, unmittelbar durch den Kreditfilter-Fix ausgelöst
- **Issue:** `expectedActualHours: 40`/`expectedOvertime: 0` gingen von der VOR-REQ-19-Annahme
  aus, dass `overtime_comp` wie `vacation`/`sick` kreditiert wird — nach dem Fix hätte das
  Szenario fälschlich als fehlgeschlagen gemeldet.
- **Fix:** Auf `expectedActualHours: 16`/`expectedOvertime: -24` korrigiert (nur die
  tatsächlich geleisteten Stunden, keine Gutschrift für den Ausgleichstag).
- **Files modified:** `server/src/test/generateTestData.ts`
- **Verification:** `npm run validate:overtime -- --scenario=overtime-compensation` zeigt
  `✅ Szenario erfolgreich validiert!`.
- **Committed in:** `65721fd`

**6. [Rule 1 - Bug] Zweiter Monatsend-Off-by-one in `overtimeService.ts` (`ensureAbsenceTransactions`)**
- **Found during:** Task 4, bei der vom Plan vorgeschriebenen Suche nach demselben Muster
  (`new Date(<ISO-String>)` für `absence.startDate`/`endDate`)
- **Issue:** Empirisch reproduziert (nicht nur vermutet): Eine Abwesenheit, die bis zum
  Monatsende reicht, verlor ihre letzte Gutschriftzeile, weil `effectiveStartDate`/
  `effectiveEndDate` bereits lokal gebildet werden, `absence.startDate`/`endDate` aber über
  `new Date(String)` (UTC-Mitternacht) geparst wurden — derselbe Zeitanteil-Mismatch wie im
  Rebuild-Dienst.
- **Fix:** Lokale Zerlegung wie überall sonst in der Funktion; dieselbe Korrektur konsistent
  in `ensureAbsenceTransactionsForMonth()` nachgezogen (unerreichbar, aber wie in Task 2
  etabliert mitgezogen).
- **Files modified:** `server/src/services/overtimeService.ts`
- **Verification:** Neuer Test „mehrtaegiger Urlaub bis zum letzten Kalendertag..." rot vor
  dem Fix, grün danach; `npx vitest run` weiterhin 218/221 mit den drei bekannten
  Fehlschlägen.
- **Committed in:** `c81c44f`

---

**Total deviations:** 6 auto-fixed (5 Rule 1, 1 Rule 3)
**Impact on plan:** Alle sechs waren notwendig, um die vom Plan selbst geforderte
Verifikation (funktionale Läufe, Acceptance Criteria „alle vier Werkzeuge") überhaupt
durchführen zu können, oder waren echte, vom Plan explizit angeforderte
Musterprüfungen mit positivem Befund. Kein Scope Creep — jede Änderung ist Konsequenz
einer im Plan selbst gestellten Aufgabe.

## Issues Encountered

- `validateOvertimeCalculation.ts` enthält weitere, von REQ-19 unabhängige Defekte
  (Spalten `daysRequired`/`deletedAt` existieren nicht auf `absence_requests`/`time_entries`;
  zwei Testszenarien `unpaid-leave`/`holiday-heavy-month` vorbestehend rot) — außerhalb des
  Lückenschluss-Scopes, in `deferred-items.md` dokumentiert statt behoben.
- `09-VERIFICATION.md` hatte „fehlende Earned-Buchungen" als zweite, eigenständige Ursache
  genannt — bei der Ausführung als Fehldiagnose der Werkzeugausgabe bestätigt (Buchungen
  existierten immer unter dem Typ `time_entry`) und in Task 3 behoben (`09-ABSCHLUSS-NACHWEIS.md`).

## User Setup Required

None - keine externe Service-Konfiguration nötig.

## Next Phase Readiness

- Phase 9 ist inhaltlich abgeschlossen: REQ-17/REQ-18 vollständig erfüllt, REQ-19-
  Kernmechanismus erfüllt und mit Erfolgskriterium-3-Nachweis belegt.
- Phase 9.1 ("Journal-Backfill und Betriebs-Härtung") ist in ROADMAP.md/REQUIREMENTS.md
  verankert und wartet auf Einplanung — Umfang: Backfill der Produktions-Bestandsdaten
  (D5-konform erst dort erlaubt), WR-03/WR-04/WR-05/WR-02/WR-07 aus `09-REVIEW.md`.
- `09-INVENTAR-KREDITIERUNG.md` ist als dauerhaftes Artefakt für Phase 11/14 abgelegt — jede
  künftige Änderung an der Kreditierungsregel muss gegen alle zwölf dort gelisteten
  Fundstellen geprüft werden.
- Die drei vorbestehenden roten Tests (G5) sind unverändert und dokumentiert — Phase 11
  (Eintrittsdatum/Sollstunden-Umbau) trifft dort auf ein bereits rotes Testnetz.

---
*Phase: 09-ein-ma-stab-ein-weg*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle in dieser SUMMARY genannten Dateien existieren (16/16 geprüft) und alle sieben
genannten Commit-Hashes sind im Git-Log auffindbar (7/7 geprüft). Keine fehlenden
Artefakte.
