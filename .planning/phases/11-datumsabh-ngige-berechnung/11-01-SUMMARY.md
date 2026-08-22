---
phase: 11-datumsabh-ngige-berechnung
plan: 01
subsystem: testing
tags: [sqlite, better-sqlite3, vitest, tsc, snapshot, migration-verification]

# Dependency graph
requires:
  - phase: 10-perioden-fundament
    provides: "user_work_periods, workPeriodService.ts (checkPeriodChain, resolveWorkPeriodAt), snapshotBalances.ts, productionGuard.ts"
  - phase: 09-ein-ma-stab-ein-weg
    provides: "09-INVENTAR-SOLLSTUNDEN.md — die 23+ klassifizierten Fundstellen der Sollstunden-Ermittlung"
provides:
  - "server/database/11-nullwirkung.db — nur-lesende Arbeitskopie mit Migrationen 008/009, 20 Nutzer, 20 Perioden"
  - "11-SNAPSHOT-VORHER.json — Salden-Snapshot A vor dem Umbau des Rechenwerks (D5)"
  - "11-AUSGANGSZUSTAND.md — fünf Kennzahlen als Manipulationsschutz für Plan 11-10"
  - "11-AUFRUFER-CHECKLISTE.md — Abhakliste aller Aufrufer für die Pläne 11-04 bis 11-09"
affects: [11-04, 11-05, 11-06, 11-07, 11-08, 11-09, 11-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "VACUUM INTO statt Dateikopie für Arbeitskopien einer vom Dev-Server offen gehaltenen SQLite-Datei"
    - "Kennzahlen-Vergleich (Migrationen, Nutzerzahl, D4-Voraussetzung, Drift, Wochenend-Risiko) als Manipulationsschutz vor einem späteren Byte-Vergleich"

key-files:
  created:
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUSGANGSZUSTAND.md
    - .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.json
    - .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.users.json
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md
    - server/database/11-nullwirkung.db (nicht committet, *.db in .gitignore)
  modified: []

key-decisions:
  - "server/database/11-nullwirkung.db wird ab jetzt nur noch gelesen; Probeläufe und Seeds späterer Pläne laufen gegen 11-werkzeugprobe.db (aus 11-01-PLAN.md übernommen, nicht neu entschieden)"
  - "Testdatei-Treffer der vier Grep-Läufe werden je Datei zu einer Sammelzeile zusammengefasst statt Zeile für Zeile, weil sie keine eigenständigen Berechnungswege sind, aber wegen D3 dennoch Compiler-Fehler auslösen und deshalb mit eigener Disposition (statt Auslassung) geführt werden"
  - "absenceService.ts:360,791,863 (calculateAbsenceHoursWithWorkSchedule) als zusätzliche Produktivpfad-Fundstellen gegenüber 09-INVENTAR-SOLLSTUNDEN.md aufgenommen — jenes Inventar durchsuchte nur getDailyTargetHours, nicht calculateAbsenceHoursWithWorkSchedule"

patterns-established:
  - "Fünf-Kennzahlen-Manipulationsschutz: vor einem späteren Nullwirkungs-Vergleich erst prüfen, ob die Vergleichsgrundlage seit ihrer Erhebung unverändert ist"

requirements-completed: [REQ-24]

# Metrics
duration: ~20min
completed: 2026-08-22
---

# Phase 11 Plan 01: Ausgangszustand, Snapshot A, Aufrufer-Checkliste Summary

**Salden-Snapshot A (20 Nutzer, ungefiltert) und fünf Kennzahlen der Vergleichsgrundlage vor dem Umbau von `getDailyTargetHours()` erhoben, plus eine mit `datei:zeile` belegte Abhakliste aller 41+ Aufrufer für die Pläne 11-04 bis 11-09.**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-22
- **Tasks:** 3/3
- **Files modified:** 4 (plus 1 nicht committete `.db`-Arbeitskopie)

## Accomplishments

- Arbeitskopie `server/database/11-nullwirkung.db` per `VACUUM INTO` gezogen (Migrationen 008/009
  bereits angewendet, 20 Nutzer, 20 Perioden, `integrity_check: ok`)
- Datenvoraussetzung für D4 gemessen: 0 von 20 Nutzern mit `checkPeriodChain`-Findings, 0
  unresolved bei `resolveWorkPeriodAt(hireDate)`, Drift-Zahl 0, Wochenend-Risiko 0 — die
  lückenlose Periodenkette ist auf diesem Datenbestand belegt, nicht nur behauptet
- Snapshot A (`11-SNAPSHOT-VORHER.json`) über alle 20 Nutzer ungefiltert gezogen; die bekannte
  Einschränkung für die 2 soft-gelöschten Nutzer (`"User <id> not found"` statt Saldo) bestätigt
  und dokumentiert
- `tsc`/`vitest`-Baseline protokolliert und sauber von der parallel laufenden TDD-RED-Phase des
  Plans 11-02 abgegrenzt (1 tsc-Fehler + 5 zusätzliche rote Tests stammen nachweislich aus Commit
  `8a3ae3b`, nicht aus Plan 11-01; die 3 tatsächlich vorbestehenden roten Tests entsprechen der
  Plan-Erwartung)
- `11-AUFRUFER-CHECKLISTE.md` aus den vier vorgeschriebenen Grep-Läufen und dem
  Phase-9-Inventar aufgebaut: jede Fundstelle einem Plan zugeordnet oder mit begründeter
  Disposition versehen; die vier `desktop/`-Zeilen bewusst offen gelassen (Prüfauftrag für Plan
  11-09 Task 2, nicht vorab entschieden)

## Task Commits

Each task was committed atomically:

1. **Task 1+2: Arbeitskopie, D4-Voraussetzung, Snapshot A, Testsuite-Baseline** - `d6ffe9a` (test)
2. **Task 3: Aufrufer-Checkliste** - `e4834d5` (docs)

_Hinweis: Tasks 1 und 2 teilen sich dieselbe Zieldatei (`11-AUSGANGSZUSTAND.md`) laut Plan-
Frontmatter und wurden deshalb in einem Commit zusammengeführt, da beide Inhalte im selben
Schreibvorgang entstanden sind._

## Files Created/Modified

- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUSGANGSZUSTAND.md` - Protokoll mit
  wörtlichen Befehlen/Ausgaben für (a)–(f) sowie Snapshot- und Testsuite-Baseline
- `.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.json` - Salden-Snapshot A,
  20 Nutzer, `asOf=2026-08-20`
- `.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.users.json` - Vergleichsdatei
  (nur `users`-Array), von `snapshotBalances.ts` automatisch mit erzeugt
- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-CHECKLISTE.md` - Abhakliste aller
  Fundstellen mit `datei:zeile`, Produktivpfad-Beleg, zuständigem Plan/Disposition
- `server/database/11-nullwirkung.db` - Arbeitskopie (nicht committet, `*.db` in `.gitignore`)

## Decisions Made

- Testdatei-Treffer der vier Grep-Läufe wurden je Datei zu einer Sammelzeile mit Zeilenbereich
  und Trefferzahl zusammengefasst statt einzeln aufgeführt (Begründung: keine eigenständigen
  Berechnungswege, aber wegen D3/Signaturänderung dennoch Compiler-Fehler — Disposition statt
  1:1-Explosion von ~34 Testzeilen). Die Rechnung Treffer→Zeile ist im Dokument nachvollziehbar
  dokumentiert.
- `absenceService.ts:360,791,863` (`calculateAbsenceHoursWithWorkSchedule`) als zusätzliche
  Produktivpfad-Fundstellen in die Checkliste aufgenommen, obwohl `09-INVENTAR-SOLLSTUNDEN.md`
  sie nicht enthält — jenes Inventar durchsuchte gezielt nur `getDailyTargetHours`, nicht die
  zweite kanonische Funktion `calculateAbsenceHoursWithWorkSchedule`. Der heutige Stand gilt,
  wie vom Plan vorgegeben.

## Deviations from Plan

### Auto-fixed Issues

Keine — keine Bugs, keine blockierenden Probleme, keine architektonischen Änderungen.

### Beobachtungen, wörtlich dokumentiert statt korrigiert

**1. Parallel-Ausführungs-Artefakt bei `tsc`/`vitest`-Baseline**
- **Gefunden während:** Task 2
- **Beobachtung:** `npx tsc --noEmit` zeigt 1 Fehler (`workPeriodService.test.ts` referenziert
  `resolveWorkPeriodIn`, das noch nicht implementiert ist) statt „fehlerfrei"; `npx vitest run`
  zeigt 8 statt 3 rote Tests.
- **Ursache:** Der parallel laufende Plan 11-02 hatte zum Messzeitpunkt bereits seine
  TDD-RED-Phase committet (`8a3ae3b test(11-02): add failing tests for resolveWorkPeriodIn`),
  die GREEN-Phase aber noch nicht. Dies ist kein durch Plan 11-01 verursachter Fund.
- **Maßnahme:** Nicht korrigiert (nicht meine Datei, `parallel_work_prohibition`). Wörtlich mit
  Einordnung in `11-AUSGANGSZUSTAND.md` festgehalten: Die 3 tatsächlich vorbestehenden roten
  Tests (2× `unifiedOvertimeService.test.ts`, 1× `vacationBackfillService.test.ts`) bleiben die
  für Plan 11-10 verbindliche Referenz; die 5 zusätzlichen `workPeriodService.test.ts`-Fehlschläge
  sind als Momentaufnahme-Artefakt gekennzeichnet, keine neue Baseline.
- **Dateien:** keine (nur protokolliert, nichts geändert)

---

**Total deviations:** 0 Auto-Fixes; 1 dokumentierte Beobachtung ohne Codeänderung.
**Impact on plan:** Kein Einfluss auf die Kennzahlen der Arbeitskopie (Task 1) oder den Snapshot
(Task 2) — beide sind unabhängig vom `tsc`/`vitest`-Zustand des Arbeitsverzeichnisses. Die
Abgrenzung stellt sicher, dass Plan 11-10 die richtige Referenzzahl (3, nicht 8) verwendet.

## Issues Encountered

Keine, außer der oben dokumentierten Beobachtung.

## User Setup Required

None - keine externe Konfiguration erforderlich.

## Next Phase Readiness

- `11-SNAPSHOT-VORHER.json` und die fünf Kennzahlen in `11-AUSGANGSZUSTAND.md` stehen als
  Vergleichsgrundlage für Plan 11-10 bereit.
- `11-AUFRUFER-CHECKLISTE.md` ist die verbindliche Abhakliste für die Pläne 11-04 bis 11-09 —
  jede Zeile trägt entweder einen zuständigen Plan oder eine begründete Disposition.
- Die vier `desktop/`-Zeilen bleiben absichtlich offen; Plan 11-09 Task 2 muss sie vor
  Phasenabschluss abschließend disponieren.
- Kein Produktivcode wurde durch diesen Plan verändert (`git status` zeigt für diesen Plan
  ausschließlich neue `.planning/`-Dateien).
- Beobachtung für die Orchestrierung: Zum Zeitpunkt dieses Plans lief Plan 11-02 bereits mit
  einer committeten TDD-RED-Phase; wer als Nächstes `tsc`/`vitest` gegen den Gesamtstand prüft,
  sollte den Merge-Fortschritt von 11-02 (GREEN-Phase) berücksichtigen, um nicht denselben
  Momentaufnahme-Effekt erneut als neue Regression misszuverstehen.

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle in dieser Summary genannten Dateien existieren, beide Commit-Hashes (`d6ffe9a`, `e4834d5`)
sind in `git log` auffindbar.
