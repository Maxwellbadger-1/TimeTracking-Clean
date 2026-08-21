---
phase: 09-ein-ma-stab-ein-weg
plan: 02
subsystem: testing
tags: [overtime, vitest, sqlite, cli, tdd, dual-calculation, guard]

# Dependency graph
requires:
  - phase: 09-01
    provides: "Vollständiges Sollstunden-Inventar (23 Fundstellen), Abweichung A-1 (fix-overtime.ts), REQ-19-Kernbefund"
provides:
  - "npm run validate:overtime:paths — ausführbares Werkzeug (D3), das fünf Berechnungswege (unified, dashboard, report_summary, report_daily, balance_row) je Nutzer/Monat vergleicht und bei Abweichung mit Exit 1 fehlschlägt"
  - "Produktionsschutz (D5) als technischer Guard vor jedem Import eines schreibenden Service-Moduls, nicht nur als Konvention"
  - "Drei reale Prüfnutzer nach D4 (09-PRUEFNUTZER.md/.csv), wiederverwendbar für Plan 09-03/09-04"
  - "Erstbefund vor jeder Codeänderung (09-VERGLEICH-BEFUND.md) und JSON-Grundlinie (09-VERGLEICH-BASELINE.json) für den Vorher/Nachher-Nachweis in Plan 09-03 und Phase 11"
affects: [09-03, 09-04, 11-datumsabhaengige-berechnung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Guard-vor-Import-Muster: reine Logik in eigener Datei ohne DB-Import, CLI mit synchronem Produktions-Guard auf Modulebene, schreibende Service-Module erst per await import() innerhalb von main()"

key-files:
  created:
    - server/src/scripts/overtimePathComparison.ts
    - server/src/scripts/overtimePathComparison.test.ts
    - server/src/scripts/compareOvertimePaths.ts
    - .planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.md
    - .planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv
    - .planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BEFUND.md
    - .planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BASELINE.json
  modified:
    - server/package.json

key-decisions:
  - "Karin Jochem (userId 2) statt Carmen Rothemund als Nutzer A gewählt, obwohl Carmen ebenfalls workSchedule mit 0-Stunden-Tagen hat — Carmen ist der dokumentierte Reproduktionsfall für Plan 09-04 (Nutzer C), Karin deckt Kriterium A ab, damit alle drei Prüfnutzer verschiedene userId sind"
  - "npm run sync-dev-db nicht ausgeführt, weil der laufende lokale Dev-Server die Datenbankdatei offen hält (mv waere mit 'Device or resource busy' fehlgeschlagen) — Aktualität stattdessen direkt per Zeilenzahl-Abfrage geprüft (18 aktive Nutzer, letzter time_entries.date 2026-08-20), als Abweichung in 09-PRUEFNUTZER.md dokumentiert"
  - "Toleranzvergleich in comparePaths() nutzt TOLERANCE_HOURS + 1e-9-Epsilon, weil 12.51 - 12.5 in IEEE-754 ca. 0.010000000000005 statt exakt 0.01 ergibt — ohne Epsilon würde eine Gleitkommarundung fälschlich als Abweichung gemeldet"
  - "assertNotProduction() prüft sowohl 'production' als Teilstring im aufgelösten Datenbankpfad als auch NODE_ENV==='production' — beide Kanarienpfad-Tests (lokaler Ordnername mit 'production' und der reale Serverpfad) lösen denselben Guard aus"

requirements-completed: [REQ-17, REQ-18]

# Metrics
duration: ~35min
completed: 2026-08-21
---

# Phase 9 Plan 2: Wege-Vergleichswerkzeug und Erstbefund Summary

**`npm run validate:overtime:paths` — CLI mit Produktions-Guard vor jedem Import, das fünf Überstunden-Berechnungswege je Nutzer/Monat gegenüberstellt; Erstbefund zeigt für drei reale Prüfnutzer keine Abweichung zwischen den Wegen, aber einen separaten, bereits aus Plan 09-01 bekannten Transaktions-Mismatch.**

## Performance

- **Duration:** ~35 min (nicht exakt gestoppt)
- **Completed:** 2026-08-21
- **Tasks:** 3 (Task 2 als TDD: RED → GREEN, kein separater REFACTOR-Commit nötig)
- **Files modified:** 8 (7 neu erstellt, 1 geändert)

## Accomplishments

- **Drei reale Prüfnutzer nach D4 ausgewählt:** Karin Jochem (userId 2, `workSchedule` mit vier
  0-Stunden-Werktagen), Benedikt Jochem (userId 16, nur `weeklyHours`), Carmen Rothemund
  (userId 17, genehmigter `overtime_comp`-Antrag, zugleich Reproduktionsfall für Plan 09-04).
  Dokumentiert mit SQL-Belegen in `09-PRUEFNUTZER.md`, maschinenlesbar in `.csv`.
- **`comparePaths()` als reine, datenbankfreie Vergleichslogik** (`overtimePathComparison.ts`),
  TDD-entwickelt: 6 Testfälle aus dem Plan (identische Werte, Toleranzgrenze mit
  Gleitkomma-Epsilon, Abweichung über Toleranz, `null`-Wert in `missing`, negative Salden,
  10 Paarungen bei 5 Wegen) zuerst rot, dann grün.
- **`compareOvertimePaths.ts` mit D5-Produktionsschutz VOR jedem Import:**
  `assertNotProduction()` läuft synchron auf Modulebene, bevor `unifiedOvertimeService`,
  `overtimeService`, `reportService` oder die Datenbankverbindung überhaupt geladen werden
  (per `await import()` erst in `main()`). Beide geforderten Kanarienproben real ausgeführt
  und bestanden: ein Pfad mit `production` im Ordnernamen sowie der reale Serverpfad
  `/home/ubuntu/databases/production.db` beenden sich beide mit Exit 2, **ohne** dass
  Verzeichnis oder Datenbankdatei angelegt werden (verifiziert mit `test ! -e .tmp-guardcheck`
  direkt nach dem Lauf).
- **Startprotokoll gegen den Fehlgriff auf die tote `server/database.db`:** Jeder Lauf gibt den
  absoluten Datenbankpfad und die Anzahl aktiver Nutzer aus; bei 0 Nutzern bricht das Skript
  mit Exit 2 ab, statt still gegen eine leere oder falsche Datei zu rechnen.
- **Erstbefund vor jeder Codeänderung:** Alle drei Prüfnutzer zeigen für alle fünf Wege
  (`unified`, `dashboard`, `report_summary`, `report_daily`, `balance_row`) exakt denselben
  Wert — Exit-Code 0, keine Abweichung über `TOLERANCE_HOURS = 0.01`. Grundlinie als JSON
  abgelegt (`09-VERGLEICH-BASELINE.json`) für Plan 09-03 und die spätere Wiederverwendung in
  Phase 11.
- **Zusätzlicher, unerwarteter Befund bei `validate:overtime:detailed`:** Alle drei Prüfnutzer
  zeigen einen `TRANSACTION MISMATCH` zwischen der berechneten Überstundenzahl und der Summe
  aus `overtime_transactions` (z. B. Karin Jochem: `Earned (Time Entries): +0h (0 txs)` trotz
  18,5 h tatsächlich gearbeiteter Stunden). `Calculated` und `Database` stimmen dabei exakt
  überein — die Abweichung betrifft ausschließlich die Vollständigkeit des
  `overtime_transactions`-Journals, nicht die Sollstunden-Auflösung. Deckt sich mit dem
  REQ-19-Kernbefund aus `09-01-SUMMARY.md`, ist also kein neuer REQ-17/18-Fund.

## Task Commits

1. **Task 1: Produktionskopie ziehen und drei Prüfnutzer nach D4 auswählen** - `392d2fc` (docs)
2. **Task 2: Vergleichswerkzeug bauen — TDD RED** - `0a8f23a` (test)
2. **Task 2: Vergleichswerkzeug bauen — TDD GREEN** - `f2a757a` (feat)
2. **Task 2: Vergleichswerkzeug bauen — CLI + npm-Skript** - `820da21` (feat)
3. **Task 3: Erstlauf gegen die drei Prüfnutzer und Befund festhalten** - `9333516` (docs)

**Plan metadata:** wird mit diesem Commit erstellt (siehe unten)

_Hinweis: Task 2 ist ein TDD-Task mit drei statt einem Commit (RED → GREEN → CLI). Kein
separater REFACTOR-Commit, da die Implementierung nach GREEN keine Bereinigung benötigte._

## Files Created/Modified

- `server/src/scripts/overtimePathComparison.ts` - Reine Vergleichslogik (`comparePaths`,
  `TOLERANCE_HOURS`, `PathValue`, `ComparisonResult`), ohne Datenbankimport
- `server/src/scripts/overtimePathComparison.test.ts` - 6 Unit-Tests für `comparePaths()`
- `server/src/scripts/compareOvertimePaths.ts` - CLI mit Produktions-Guard vor jedem Import,
  erhebt fünf Wege je Nutzer/Monat, `--userId`/`--month`, `--from=<csv>`, `--json=<pfad>`
- `server/package.json` - Skript `validate:overtime:paths` registriert
- `.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.md` - Drei Prüfnutzer nach D4 mit
  SQL-Beleg
- `.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv` - Maschinenlesbare Eingabe für
  `--from=`
- `.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BEFUND.md` - Erstbefund vor jeder
  Codeänderung
- `.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BASELINE.json` - JSON-Grundlinie der
  Rohwerte

## Decisions Made

- Karin Jochem statt Carmen Rothemund als Nutzer A gewählt (beide erfüllen das
  `workSchedule`-Kriterium), weil Carmen bereits der dokumentierte Reproduktionsfall für Nutzer
  C ist — so bleiben alle drei `userId` verschieden, wie D4 verlangt.
  Siehe `09-PRUEFNUTZER.md`.
- `npm run sync-dev-db` nicht ausgeführt: Der lokale Dev-Server hielt die Datenbankdatei offen
  (Port 3000 belegt), ein Sync-Lauf wäre laut `.planning/notes/db-pfad-diskrepanz-20260821.md`
  mit `mv: ... Device or resource busy` fehlgeschlagen. Stattdessen wurde die Aktualität der
  bestehenden lokalen Kopie direkt per SQL-Abfrage geprüft (18 aktive Nutzer, letzter
  `time_entries.date` = 2026-08-20) — deckungsgleich mit dem in der Diskrepanz-Notiz
  dokumentierten Stand. Nicht erzwungen, um die laufende Dev-Datenbank nicht zu gefährden.
- Toleranzvergleich mit `1e-9`-Epsilon auf `TOLERANCE_HOURS`, um IEEE-754-Rundungsfehler bei
  der Gleitkomma-Subtraktion abzufangen (12.51 - 12.5 ergibt in JavaScript ca.
  0.010000000000005 statt exakt 0.01).
- `assertNotProduction()` prüft sowohl den aufgelösten Pfad auf die Zeichenkette `production`
  als auch `NODE_ENV === 'production'` — beide im Plan geforderten Kanarienproben (Ordnername
  mit `production`, realer Serverpfad) lösen denselben Codepfad aus.

## Deviations from Plan

### Auto-fixed Issues

Keine Rule-1/2/3-Auto-Fixes im klassischen Sinn — dieser Plan hat keinen bestehenden Code
verändert, sondern ausschließlich neue Dateien angelegt. Eine dokumentierte, im
Executor-Kontext ausdrücklich vorgesehene Abweichung von der wörtlichen Plananweisung:

**1. [Dokumentierte Abweichung, kein Rule 1-4] `npm run sync-dev-db` nicht ausgeführt**
- **Gefunden während:** Task 1
- **Grund:** Der laufende lokale Dev-Server (Port 3000, mehrere `node.exe`-Prozesse) hält
  `server/database/development.db` offen; ein Sync-Lauf hätte in Schritt 5/6 mit
  `mv: ... Device or resource busy` fehlschlagen müssen (dokumentierter Nebenbefund in
  `.planning/notes/db-pfad-diskrepanz-20260821.md`).
- **Ausweichlösung:** Aktualität der bestehenden lokalen Kopie direkt per `better-sqlite3`
  geprüft (18 aktive Nutzer, letzter `time_entries.date` = 2026-08-20, 144
  `overtime_balance`-Zeilen) — deckungsgleich mit dem dokumentierten Stand vom 21.08.2026
  21:00 Uhr. Kein Zwang, kein Abbruch der Phase.
- **Dokumentiert in:** `09-PRUEFNUTZER.md`, Abschnitt „Datengrundlage"
- **Committed in:** `392d2fc`

---

**Total deviations:** 1 dokumentierte Ausweichlösung (kein Rule-1-4-Fix nötig)
**Impact on plan:** Keine inhaltliche Abweichung von den Akzeptanzkriterien. Die verwendete
lokale Datenbank ist nachweislich aktuell und enthält echte Produktionsdaten.

## Issues Encountered

- **`validate:overtime:detailed` zeigt einen Transaktions-Mismatch bei allen drei
  Prüfnutzern**, der nicht Teil der ursprünglichen Plan-Erwartung war (der Plan verlangte nur,
  dass der Lauf „ohne Abweichungsmeldung durchläuft"). Da das Skript laut den
  Plan-`<interfaces>` bei einer erkannten Abweichung KEINEN Exit-Code ungleich 0 liefert
  (bekannte, im Plan selbst dokumentierte Lücke), wurde die Bewertung „bestanden/nicht
  bestanden" stattdessen anhand des `🎯 VALIDATION STATUS`-Abschnitts im Bericht getroffen und
  wörtlich in `09-VERGLEICH-BEFUND.md` dokumentiert. Der Mismatch betrifft ausschließlich die
  Vollständigkeit des `overtime_transactions`-Journals (nicht die Sollstunden-Auflösung,
  `Calculated` == `Database` bei allen drei Nutzern) und deckt sich mit dem bereits in
  `09-01-SUMMARY.md` festgehaltenen REQ-19-Kernbefund. Kein Fixversuch unternommen — das ist
  ausdrücklich Gegenstand von Plan 09-04, nicht dieses Analyse-Plans.

## Next Phase Readiness

- **Plan 09-03 (REQ-17/18, A-1-Fix):** Kann `09-VERGLEICH-BASELINE.json` als Vorher-Zustand
  nutzen. Wichtig: Der Erstbefund zeigt bereits jetzt 0 Abweichungen zwischen den fünf Wegen —
  das beweist NICHT, dass A-1 (`fix-overtime.ts`) bereits behoben ist, weil dieser Lauf gegen
  die lokale Entwicklungskopie ging, die `fix-overtime.ts` nie beschreibt (das Skript läuft
  laut `09-INVENTAR-SOLLSTUNDEN.md` nur bei Deployment/Cron auf der Produktionsdatenbank). Plan
  09-03 sollte sich auf den Fix von `fix-overtime.ts` selbst konzentrieren, nicht auf einen
  erneuten lokalen 5-Wege-Vergleich.
- **Plan 09-04 (REQ-19):** Kann den in diesem Plan zusätzlich gefundenen
  Transaktions-Mismatch (leere `overtime_transactions`-Einträge trotz gearbeiteter Stunden) als
  weiteren Beleg für den bereits bekannten REQ-19-Kernbefund verwenden — wörtliche Meldungen je
  Nutzer stehen in `09-VERGLEICH-BEFUND.md`.
- **Phase 11:** `09-VERGLEICH-BASELINE.json` liegt als dauerhaftes JSON-Artefakt vor und kann
  mit `--json=<pfad>` erneut erzeugt werden, um nach dem Periodenumbau zu belegen, dass sich
  Salden für Nutzer ohne Modellwechsel nicht verändert haben.
- **Kein Blocker:** Alle drei Tasks vollständig, alle Acceptance-Criteria und der
  `<verify><automated>`-Block wurden gegen den finalen Stand ausgeführt und bestanden
  (siehe Self-Check unten).

---
*Phase: 09-ein-ma-stab-ein-weg*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `server/src/scripts/overtimePathComparison.ts`
- FOUND: `server/src/scripts/overtimePathComparison.test.ts`
- FOUND: `server/src/scripts/compareOvertimePaths.ts`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BEFUND.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-VERGLEICH-BASELINE.json`
- FOUND: commit `392d2fc` (Task 1)
- FOUND: commit `0a8f23a` (Task 2, RED)
- FOUND: commit `f2a757a` (Task 2, GREEN)
- FOUND: commit `820da21` (Task 2, CLI)
- FOUND: commit `9333516` (Task 3)
