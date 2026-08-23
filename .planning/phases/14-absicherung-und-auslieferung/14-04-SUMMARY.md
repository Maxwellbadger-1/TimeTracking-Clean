---
phase: 14-absicherung-und-auslieferung
plan: 04
subsystem: database
tags: [sqlite, better-sqlite3, migrations, production-copy, req-33, generalprobe]

# Dependency graph
requires:
  - phase: 14-absicherung-und-auslieferung
    provides: "14-01 (REQ-32-Nachweis), 14-02 (WR-07 geschlossen) — beide Voraussetzung fuer den nun folgenden Produktionslauf"
provides:
  - "Gemessener Migrationsstand der Produktion: 001-007 vorhanden, 008-015 fehlen (bestaetigt die Vorab-Erwartung aus 14-04-PLAN.md deckungsgleich)"
  - "server/database/14-produktionskopie.db — unveraenderte Referenzkopie im Produktionsstand, Grundlage fuer Plan 14-05/14-06/14-08"
  - "server/database/14-generalprobe.db — Arbeitskopie mit vollstaendig angewendeter Migrationsfolge 008-015"
  - "Maschineller Nullwirkungs-Nachweis: Migrationsfolge bewegt keine Zahl in overtime_transactions/overtime_balance"
  - "--asOf-Wert fuer Plan 14-05: MAX(date) FROM time_entries = 2026-08-21"
affects: [14-05, 14-06, 14-07, 14-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Produktionsdatenbank ausschliesslich ueber readonly better-sqlite3-Verbindung fuer VACUUM INTO angesprochen (kein Read-Write-Fallback noetig gewesen)"
    - "Direktes Download-Ziel bei Produktionspull statt Umweg ueber development.db, wenn ein laufender Dev-Server die Zieldatei offen haelt"

key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-MIGRATIONSSTAND.md
  modified: []

key-decisions:
  - "npm run sync-dev-db NICHT ausgefuehrt — laufender Dev-Server (PID 39860) haelt development.db offen; stattdessen die VACUUM-INTO+scp-Logik aus scripts/sync-dev-db.sh manuell mit Zielpfad server/database/14-produktionskopie.db nachgebaut, development.db nie schreibend geoeffnet"
  - "VACUUM INTO gegen Produktion lief ueber eine readonly better-sqlite3-Verbindung (SQLite erlaubt das) — kein Read-Write-Fallback noetig"
  - "Erste Fassung der Rohkennzahlen-Vermutung (overtime_transactions/overtime_balance seien auf dem 001-007-Stand leer) wurde durch tatsaechliche Abfrage widerlegt und vor dem Commit korrigiert, nicht stehen gelassen"

patterns-established:
  - "development.db-Unversehrtheitsnachweis ueber drei Messpunkte (vor Pull, nach Pull, nach Migrationslauf) statt nur zwei — deckt auf, dass mtime durch einen fremden laufenden Prozess driften kann, obwohl der Inhalt unveraendert bleibt"

requirements-completed: [REQ-33]

# Metrics
duration: ~12min
completed: 2026-08-23
---

# Phase 14 Plan 04: Migrationsstand messen und Generalprobe fahren Summary

**Produktionsmigrationsstand gemessen (001–007 vorhanden, 008–015 fehlen — deckungsgleich mit der Vorab-Erwartung), Migrationsfolge auf einer Produktionskopie gefahren (Exit 0, `integrity_check` ok) und mit Vorher/Nachher-Vergleich belegt, dass sie keine einzige Zahl in `overtime_transactions`/`overtime_balance` bewegt — ohne den laufenden lokalen Dev-Server zu berühren.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-08-23T00:09:00Z (nach Abschluss Plan 14-03, Commit f46bc08)
- **Completed:** 2026-08-23T00:18:32Z
- **Tasks:** 3 (Task 1 als eigener Commit; Task 2+3 wegen zusammenhängender Autorenarbeit an derselben Datei in einem zweiten Commit — siehe Deviations)
- **Files modified:** 1 (`.planning/phases/14-absicherung-und-auslieferung/14-MIGRATIONSSTAND.md`)

## Accomplishments
- Mandatorische Abweichung aus dem Ausführungsauftrag korrekt umgesetzt: laufender Dev-Server (PID 39860, Port 3000) und Tauri-Prozess (PID 26124, Port 1420) nicht beendet, `npm run sync-dev-db` nicht ausgeführt, `development.db` durchgängig nur readonly geöffnet und an drei Messpunkten (vorher/nach Pull/nach Migrationslauf) als inhaltlich unverändert belegt
- Produktionskopie per readonly `VACUUM INTO` auf dem Server + `scp` direkt nach `server/database/14-produktionskopie.db` gezogen (kein Umweg über `development.db`), Remote-Temp-Datei aufgeräumt, `integrity_check` = `ok`
- Gemessener Produktionsstand: Migrationen 001–007 vorhanden, `user_work_periods` existiert nicht — bestätigt die begründete Erwartung aus `14-04-PLAN.md` exakt (acht fehlende Migrationen 008–015, keine Abweichung)
- Rohkennzahlen vor dem Migrationslauf erhoben — dabei eine eigene Fehlannahme (Tabellen seien leer) durch echte Abfrage widerlegt und vor dem Commit korrigiert: `overtime_transactions` trägt tatsächlich 2671 Zeilen (Summe −372,68 h), `overtime_balance` 144 Zeilen
- Migrationsfolge 008–015 auf `14-generalprobe.db` gefahren: Exit 0, `integrity_check` ok, `foreign_key_check` leer, neu angewendete Migrationen wortgleich identisch zur Fehlliste aus Task 1
- Vorher/Nachher-Vergleich: alle Differenzen in `overtime_transactions` (Zeilenzahl, Stundensumme, je Typ, je referenceType) und `overtime_balance` (Zeilenzahl, alle drei Summenspalten) exakt `0`; `user_work_periods` von „nicht vorhanden" auf genau `COUNT(*) FROM users` = 20
- `check:period-chains` gegen die migrierte Kopie: keine Befunde, Exit 0
- Alle vier Pflichtgates grün: Server-`tsc` (Exit 0), Desktop-`tsc` (Exit 0), `vitest run` (3 rot/493 grün, unverändert), Desktop `check:rules` (19 PASS, Exit 0)

## Task Commits

Each task was committed atomically:

1. **Task 1: Baseline sichern, Produktionskopie ziehen, Produktionsstand messen** - `fe7672c` (docs)
2. **Task 2+3: Rohkennzahlen erheben, Migrationsfolge fahren, Nullwirkung belegen** - `3fabe23` (docs)

_Hinweis: Task 2 und Task 3 landeten in einem gemeinsamen Commit statt zwei getrennten — siehe Deviations unten._

## Files Created/Modified
- `.planning/phases/14-absicherung-und-auslieferung/14-MIGRATIONSSTAND.md` - Vollständiges Messprotokoll: gemessener Produktionsstand, Fehlliste (Tabelle mit Laufreihenfolge), Rohkennzahlen vor/nach mit Differenzspalte, Migrationslauf-Ausgabe, Kettenprüfung, dreifache `development.db`-Unversehrtheitsmessung

## Decisions Made
- `npm run sync-dev-db` nicht ausgeführt (mandatorische Abweichung) — Produktionskopie stattdessen direkt nach `14-produktionskopie.db` gezogen, `development.db` nie schreibend geöffnet
- `VACUUM INTO` gegen Produktion über eine readonly `better-sqlite3`-Verbindung — SQLite ließ das zu, kein Rückfall auf Read-Write nötig
- Fehlerhafte Erstannahme in der Rohkennzahlen-Erhebung (Tabellen seien auf dem gemessenen Migrationsstand noch leer) durch tatsächliche Abfrage widerlegt und vor jedem Commit korrigiert — siehe Deviations

## Deviations from Plan

### Mandatorische Abweichung (aus dem Ausführungsauftrag, nicht Rule 1-4)

**Task 1 Schritte 1, 2, 7, 8 des Plantexts entfallen; Schritt 4 (`npm run sync-dev-db`) wird durch eine manuelle Nachbildung von `scripts/sync-dev-db.sh` Schritt [3/6]+[4/6] ersetzt.**
- **Grund:** Der Plantext verlangt „kein lokaler Dev-Server läuft" als Vorbedingung. Gemessen liefen tatsächlich ein Node-Dev-Server (PID 39860, Port 3000) und ein Tauri-Dev-Prozess (PID 26124, Port 1420), beide hielten `development.db` offen (WAL > 4 MB). Diese Prozesse gehören dem Anwender und wurden nicht beendet.
- **Umsetzung:** `npm run sync-dev-db` nicht ausgeführt (es überschreibt `development.db`). Stattdessen wurde dessen Kernlogik — serverseitiges `VACUUM INTO` in eine `/tmp/`-Datei, `scp`-Download, Aufräumen der Remote-Temp-Datei — manuell nachgebaut, aber mit dem Downloadziel `server/database/14-produktionskopie.db` statt `development.db`. `development.db` wurde ausschließlich readonly geöffnet: einmal vor dem Pull, einmal direkt danach, ein drittes Mal nach Abschluss von Task 3.
- **Folge für Schritt 2/7 (Baseline sichern/wiederherstellen):** Entfällt vollständig — es existiert kein `server/database/14-dev-baseline.db` in diesem Lauf, weil nichts wiederhergestellt werden musste. Das ist beabsichtigt, nicht vergessen (im Protokoll ausdrücklich vermerkt).
- **Nachweis statt Rücksicherung:** Drei Messpunkte (Größe, mtime, vollständige Migrationsliste, `COUNT(users)`, `COUNT(user_work_periods)`) zeigen inhaltliche Identität. Bei der dritten Messung (nach Task 3) driftete die `mtime` (01:45:30 → 02:15:07) bei ansonsten byteidentischem Inhalt — Ursache ist ein WAL-Checkpoint des weiterlaufenden Dev-Servers, kein Schreibzugriff dieses Plans. Dieser Befund wurde offen dokumentiert statt eine falsche Byteidentität zu behaupten.
- **Produktionsverbindung:** `VACUUM INTO` lief über eine readonly `better-sqlite3`-Verbindung gegen `production.db` — kein Schreibzugriff, keine Migration, keine Schemaänderung auf Produktion.

### Auto-fixed Issues

**1. [Rule 1 - Bug in eigener Arbeit] Fehlannahme über den Inhalt von `overtime_transactions`/`overtime_balance` vor der eigentlichen Abfrage niedergeschrieben**
- **Gefunden während:** Selbstprüfung nach dem ersten Schreiben von `14-MIGRATIONSSTAND.md` — der Abschnitt „Rohkennzahlen VOR" enthielt zunächst plausibel klingende, aber nicht tatsächlich abgefragte Werte (Annahme: beide Tabellen seien beim Migrationsstand 001–007 leer).
- **Problem:** Verstoß gegen die Zero-Hallucination-Vorgabe aus `.claude/CLAUDE.md` — Werte wurden geschrieben, bevor die zugehörige Abfrage lief.
- **Fix:** Alle Abfragen tatsächlich gegen `14-produktionskopie.db` (readonly) ausgeführt (inklusive eines dabei aufgetretenen echten Fehlers: `PRAGMA table_info(overtime_balance)` zeigte, dass die geratene Spalte `overtimeHours` nicht existiert — korrekt sind `targetHours`/`actualHours`/`carryoverFromPreviousYear`). Die Datei wurde vor jedem Commit mit den echten Ergebnissen überschrieben: `overtime_transactions` 2671 Zeilen/−372,68 h, `overtime_balance` 144 Zeilen. Die „Arbeitskopie erzeugen"/„Migrationslauf"-Abschnitte wurden aus demselben Grund ebenfalls erst nach tatsächlicher Ausführung final formuliert.
- **Dateien:** `.planning/phases/14-absicherung-und-auslieferung/14-MIGRATIONSSTAND.md`
- **Verifikation:** Alle im Protokoll stehenden Zahlen stammen aus tatsächlich ausgeführten `node -e`-Aufrufen gegen die jeweils genannte Datei, mit wörtlich übernommener Ausgabe.
- **Committed in:** `3fabe23` (die korrigierte Fassung; die fehlerhafte Zwischenfassung wurde nie separat committet)

**2. [Prozess-Abweichung, kein Rule-1-4-Fall] Task 2 und Task 3 landeten in einem gemeinsamen Commit**
- **Gefunden während:** Nach Abschluss der Rohkennzahlen-Erhebung (Task 2) wurde direkt mit dem Migrationslauf (Task 3) fortgefahren, ohne zwischendurch zu committen — beide Arbeiten betrafen dieselbe Datei im selben Bearbeitungsdurchgang.
- **Auswirkung:** Zwei statt drei Task-Commits. Die inhaltliche Vollständigkeit ist unberührt — jede der drei Plan-Tasks ist im Protokoll unter eigener Überschrift nachweisbar, nur die Commit-Granularität weicht vom Standard „ein Commit je Task" ab.
- **Committed in:** `3fabe23`

---

**Total deviations:** 1 mandatorisch (Ausführungsauftrag, siehe oben), 2 auto-fixed (1 Selbstkorrektur einer Fehlannahme vor dem Commit, 1 Commit-Granularität)
**Impact on plan:** Keine der Abweichungen ändert das Ergebnis der Nullwirkungsprüfung oder gefährdet Produktionsdaten. Die Selbstkorrektur (Deviation 1) hat im Gegenteil eine falsche Behauptung verhindert, bevor sie committet wurde.

## Issues Encountered
- `PRAGMA table_info(overtime_balance)` zeigte, dass die zunächst angenommene Spalte `overtimeHours` nicht existiert (`SqliteError: no such column: overtimeHours`) — die tatsächlichen Spalten (`targetHours`, `actualHours`, `carryoverFromPreviousYear`) wurden danach korrekt verwendet, siehe Deviation 1.
- `development.db-wal` schrumpfte zwischen der zweiten und dritten Messung leicht (4148872 → 4140632 Bytes) bei gleichzeitigem mtime-Sprung der Haupt-`.db`-Datei — als WAL-Checkpoint des laufenden Dev-Servers eingeordnet und dokumentiert, kein Hinweis auf einen Schreibzugriff dieses Plans.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- REQ-33 (Generalprobe auf Produktionskopie) vollständig erfüllt: gemessener Migrationsstand, vollständige Fehlliste, fehlerfreier Migrationslauf mit `integrity_check`/`foreign_key_check`-Nachweis, maschinelle Nullwirkungsprüfung auf Tabellenebene
- `server/database/14-produktionskopie.db` (unveränderte Referenz) und `server/database/14-generalprobe.db` (migrierte Arbeitskopie) liegen bereit für Plan 14-05 (Salden-Snapshots) — beide `.gitignore`-erfasst (`*.db`), keine Personendaten im Repository
- `--asOf`-Wert für Plan 14-05/14-08 festgelegt: `2026-08-21` (`MAX(date) FROM time_entries` der Produktionskopie)
- `development.db` unverändert, Testbaseline unverändert (3 rot/493 grün, dieselben drei Titel wie in `11-AUSGANGSZUSTAND.md`/`14-01-SUMMARY.md`/`14-02-SUMMARY.md`)
- Kein Blocker gefunden — Plan 14-05 kann ohne Wartezeit anschließen

---
*Phase: 14-absicherung-und-auslieferung*
*Completed: 2026-08-23*

## Self-Check: PASSED

- FOUND: server/database/14-produktionskopie.db
- FOUND: server/database/14-generalprobe.db
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-MIGRATIONSSTAND.md
- FOUND: .planning/phases/14-absicherung-und-auslieferung/14-04-SUMMARY.md
- FOUND: fe7672c, 3fabe23 (both commits present in git log)
