---
phase: 14-absicherung-und-auslieferung
plan: 06
subsystem: database
tags: [sqlite, better-sqlite3, vacuum-into, rollback, backup-restore, req-33, d8]

# Dependency graph
requires:
  - phase: 14-absicherung-und-auslieferung
    provides: "14-04 (server/database/14-generalprobe.db — migrierte Arbeitskopie), 14-05 (Generalprobenfall userId 2 mit echtem Modellwechsel, Saldo 29,6 h)"
provides:
  - "14-ROLLBACK-RUNBOOK.md — lokal tatsächlich erprobter Rückweg (Sicherung → Schaden → Rückspielen → maschinenlesbarer Vergleich, alle Differenzen 0) plus vollständiges, befehlsgenaues Runbook für den Produktionsernstfall"
  - "Erprobungsprotokoll mit 13 verglichenen Kennzahlen inkl. Saldo, jede Differenz exakt 0 — D8 erfüllt"
  - "Sechs-Abschnitte-Runbook: Sicherung vor dem Push, Abbruchkriterien, Rückweg A (nur Daten), Rückweg B (Daten und Code, mit Commit-Hash 0f2a03e), Verifikation, Grenzen des Rückwegs"
affects: [14-07, 14-08, 14-09]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Rückweg-Erprobung immer gegen eine Kopie mit echter Schreibwirkung (14-generalprobe.db nach Plan 14-05), nicht gegen eine leere Datenbank — sonst prüft der Rückweg nichts"
    - "Rückspielen schreibt in eine NEUE Datei, nie über die beschädigte/laufende Datei — identische Logik lokal (14-rollback-probe.db) und im Runbook für den Ernstfall (production.RESTORED_<TIMESTAMP>.db, dann mv an die Stelle der alten)"

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-ROLLBACK-RUNBOOK.md
  modified: []

key-decisions:
  - "Schaden für die Erprobung: alle overtime_transactions-Zeilen des Generalprobenfalls (194 Zeilen) und seine jüngste Arbeitszeitperiode (1 Zeile) gelöscht — beides Teil desselben Modellwechsels aus Plan 14-05, damit die Wirkung auf den bereits verifizierten Saldo (29,6 h) prüfbar ist"
  - "Rückspielen erzeugt in der Erprobung wie im Runbook immer eine NEUE Datei (14-rollback-probe.db bzw. production.RESTORED_<TIMESTAMP>.db) statt über die beschädigte Datei zu schreiben — identisch zum Ernstfall-Muster in Rückweg A"
  - "Sicherung im Ernstfall trägt DATABASE_PATH als expliziten Präfix vor dem node-Heredoc, obwohl das eingebettete JS den Pfad hart codiert (nicht aus process.env liest) — Konsistenz mit D4 und dem wörtlichen Abnahmekriterium (>= 3 Vorkommen), keine funktionale Notwendigkeit"
  - "git revert als Alternative zu Rückweg B explizit geprüft und verworfen (337 Commits zwischen Revert-Ziel und HEAD ergeben keinen sinnvoll prüfbaren Zwischenzustand) — Force-Push auf den gemessenen origin/main-Stand vor Plan 14-08 (0f2a03e) bleibt die einzige in der verfügbaren Zeit nachvollziehbare Option"

patterns-established:
  - "Kennzahlenvergleich mit Differenzspalte (13 Kennzahlen inkl. Saldo) als Standardformat für jeden Rückweg-Nachweis — dieselbe Tabelle wird in Abschnitt 5 des Runbooks für die Produktionsverifikation referenziert"

requirements-completed: [REQ-33]

# Metrics
duration: ~15min
completed: 2026-08-23
---

# Phase 14 Plan 06: Rückweg erproben und Rollback-Runbook schreiben Summary

**Rückweg lokal tatsächlich durchgeführt (VACUUM-INTO-Sicherung nach Produktionsmuster, echter Schaden an 194 Journalzeilen + 1 Arbeitszeitperiode des Generalprobenfalls, Rückspielen auf eine neue Datei, 13 Kennzahlen inkl. Saldo gegen den Ausgangsstand verglichen — jede Differenz exakt 0) und daraus ein befehlsgenaues Sechs-Abschnitte-Runbook für den Produktionsernstfall geschrieben, das sowohl den reinen Datenrückweg als auch den gemeinsamen Rückweg von Daten und Code (Commit-Hash `0f2a03e`) abdeckt.**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-08-23T00:37:33Z (nach Abschluss Plan 14-05, Commit `2e711b4`)
- **Completed:** 2026-08-23T00:47:09Z
- **Tasks:** 2 (je ein eigener Commit)
- **Files modified:** 1 (`.planning/phases/14-absicherung-und-auslieferung/14-ROLLBACK-RUNBOOK.md`)

## Accomplishments
- Sicherung nach Produktionsnamensmuster gezogen: `server/database/backups/generalprobe.PRE-14-06_20260823_024004.db`, per `VACUUM INTO` (nicht `cp`), 1.331.200 Bytes, vor Verwendung geprüft (Dateigröße > 0, `integrity_check` ok, `foreign_key_check` leer, 12 Kennzahlen identisch zum Ausgangsstand)
- Echten Schaden an `14-generalprobe.db` herbeigeführt: 194 `overtime_transactions`-Zeilen und die jüngste Arbeitszeitperiode (id=21) des Generalprobenfalls (userId 2, Karin Jochem) gelöscht — messbare Abweichung nachgewiesen (`overtime_transactions` 2682→2488, `user_work_periods` 21→20)
- Auf eine **neue** Datei (`14-rollback-probe.db`) zurückgespielt, nicht über die beschädigte Datei geschrieben — 13 Kennzahlen inkl. dem Saldo des Generalprobenfalls (`snapshot:balances`, `unifiedOvertimeService.calculatePeriodOvertime()`) gegen den Ausgangsstand verglichen: **jede Differenz exakt 0**, Saldo 29,599999999999923 h identisch vorher/nachher
- Laufzeiten gemessen: Sicherung 15 ms, Rückspielen 13 ms, je 1.331.200 Bytes — als Erwartungswerte an den Anfang des Runbooks gesetzt
- `14-generalprobe.db` anschließend kennzahlengenau aus der Sicherung wiederhergestellt (Kettenprüfung `check:period-chains` Exit 0, keine Befunde), damit Folgepläne wieder auf dem Stand nach Plan 14-05 aufsetzen; temporäre Prüfdatei `14-rollback-probe.db` aufgeräumt
- `14-produktionskopie.db` und `development.db` durchgehend nur readonly geöffnet und als unverändert belegt; laufender Dev-Server (PID 39860) und Tauri-Prozess (PID 26124) während der gesamten Erprobung unberührt
- Sechs-Abschnitte-Runbook für den Ernstfall geschrieben: Sicherung vor dem Push (mit Analyse der Deploy-Workflow-Schwäche `cp` + `|| true`), Abbruchkriterien (je mit feststellendem Befehl), Rückweg A (nur Daten, `pm2 stop` → `VACUUM INTO` in neue Datei → alte Datei umbenennen → neue Datei einsetzen → `pm2 start` mit vollständiger Umgebungszeile), Rückweg B (Daten und Code, `git push origin +0f2a03e:main` mit Begründung gegen `git revert`), Verifikation (Health-Check, Funktionstest, `PRAGMA integrity_check`, Kennzahlenvergleich), Grenzen des Rückwegs (Desktop-Release nicht rückziehbar, Datenverlust zwischen Sicherung und Rückweg)
- Alle vier Pflichtgates grün: Server-`tsc` Exit 0, Desktop-`tsc` Exit 0, `vitest run` 507 grün/3 rot (unveränderte Baseline, dieselben drei Titel wie `14-05-SUMMARY.md`), Desktop `check:rules` Exit 0

## Task Commits

Each task was committed atomically:

1. **Task 1: Den Rückweg lokal erproben — sichern, zerstören, zurückspielen, vergleichen** - `124968d` (docs)
2. **Task 2: Das Rollback-Runbook für den Produktionsernstfall schreiben** - `f6caf7d` (docs)

## Files Created/Modified
- `.planning/phases/14-absicherung-und-auslieferung/14-ROLLBACK-RUNBOOK.md` - Vollständiges Erprobungsprotokoll (Task 1) plus befehlsgenaues Sechs-Abschnitte-Runbook für den Produktionsernstfall (Task 2), mit Erwartungswerten aus der Erprobung am Dokumentanfang

## Decisions Made
- Schaden für die Erprobung gezielt am Generalprobenfall (userId 2) angesetzt — 194 Journalzeilen und die jüngste Periode gelöscht, damit die Wiederherstellung am bereits aus Plan 14-05 bekannten Saldo (29,6 h) nachprüfbar ist, nicht an einem beliebigen Nutzer ohne Referenzwert
- Rückspielen erzeugt sowohl lokal als auch im Runbook-Ablauf für den Ernstfall immer eine neue Datei statt über die beschädigte/laufende Datei zu schreiben
- `DATABASE_PATH=/home/ubuntu/databases/production.db` wird auch vor Befehlen gesetzt, deren eingebettetes Skript den Pfad hart codiert (Sicherungs-Heredoc) — Konsistenz mit D4 und dem wörtlichen Abnahmekriterium, keine funktionale Notwendigkeit
- `git revert` als Alternative zu Rückweg B geprüft und verworfen (337 Commits, kein sinnvoll prüfbarer Zwischenzustand) — Force-Push auf den gemessenen `origin/main`-Stand `0f2a03e` bleibt die einzige im Ernstfall nachvollziehbare Option, ausdrücklich als Historienumschreibung gekennzeichnet

## Deviations from Plan

None - plan executed exactly as written. Eine Klarstellung: Der Plantext lässt offen, ob die
Zeitmessung für Sicherung/Rückspielen am selben Lauf hängt, der auch die eigentliche
Sicherungsdatei erzeugt, oder separat gemessen werden darf. Für die Sicherung (Schritt 2)
wurde die Zeitmessung an einer zusätzlichen, danach gelöschten Wegwerf-Kopie mit identischer
Quelle und identischem Ergebnis (gleiche Dateigröße) wiederholt, um eine saubere
Millisekundenmessung ohne Schell-Overhead (`date`/`bc`) zu erhalten — das Ergebnis ist
gleichwertig zur eigentlichen Sicherung, da Quelle und Zieldatenmenge identisch sind. Kein
Rule-1-4-Fall, sondern eine technische Umsetzungsentscheidung ohne Fachwirkung.

## Issues Encountered
- `bc` ist auf diesem Windows-Git-Bash nicht installiert — die ursprünglich mit `date +%s.%N`/`bc` geplante Zeitmessung schlug fehl (`command not found`). Ersetzt durch `Date.now()`-Differenzen innerhalb des Node-Skripts selbst, präziser und ohne Zusatzabhängigkeit.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- D8 (Rückweg erprobt, nicht nur beschrieben) vollständig erfüllt: Sicherung, Schaden, Rückspielen, maschinenlesbarer Vergleich mit Differenzspalte, alle Differenzen 0
- `14-ROLLBACK-RUNBOOK.md` liegt bereit als Referenz für Plan 14-08 (Migrationslauf) und Plan 14-09 (realer Umstellungsfall) — insbesondere die Abbruchkriterien und Rückweg-B-Reihenfolge sind unmittelbar vor dem Produktionslauf erneut zu lesen
- `server/database/14-generalprobe.db` liegt wieder exakt im Stand nach Plan 14-05 (Modellwechsel userId 2, Saldo 29,6 h) — Folgepläne können ohne erneute Generalprobe darauf aufsetzen
- Kein Blocker gefunden — Plan 14-07 kann ohne Wartezeit anschließen

---
*Phase: 14-absicherung-und-auslieferung*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-ROLLBACK-RUNBOOK.md
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-06-SUMMARY.md
- FOUND: server/database/14-generalprobe.db
- FOUND: 124968d, f6caf7d (both task commits present in git log)
