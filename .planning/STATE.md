---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: milestone
status: Executing Phase 08
stopped_at: "Plan 08-04 abgeschlossen (Qualitätstor, Deployment, Abnahme). Anwender hat den Kontoauszug gegen echte Produktionsdaten freigegeben; während der Abnahme gefundener Saldo-Kettenbruch bei rückdatierten Buchungen behoben (8af5e3f), Lesbarkeits-Verbesserungen (3f6ac5f) und phasenfremder Notification-Fix (7b75765) mit ausgeliefert. Alle Fixes deployed, alle vier Produktionsprüfungen bestanden (Health ok, /api/vacation-transactions und /api/vacation-balances/1 je 401). Nächster Schritt: Plan 08-05 (Desktop-Release v1.8.0)."
last_updated: "2026-08-20T20:56:22.000Z"
progress:
  total_phases: 4
  completed_phases: 2
  total_plans: 13
  completed_plans: 12
  percent: 92
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-18)

**Core value:** Kein Urlaubstag verschwindet mehr unbemerkt — jede Bewegung wird gebucht, der Saldo ist ihre Summe.
**Current focus:** Phase 08 — kontoauszug-f-r-mitarbeiter-und-admin

## Current Status

- **Phase:** 08 of 8 — Kontoauszug für Mitarbeiter und Admin (4/5 Pläne abgeschlossen)
- **Milestone:** 2 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit
- **Initialized:** 2026-08-18
- **Next action:** Plan 08-05 — Desktop-Release v1.8.0 mit vollständiger `latest.json`
- **Last completed:** Plan 08-04 — Qualitätstor, Server-Deployment und Abnahme; Anwender hat den Kontoauszug gegen echte Produktionsdaten freigegeben
- **Stopped at:** Plan 08-04 abgeschlossen. Server deployed, Endpunkt live und mit 401 abgesichert, Abnahme erteilt. Phase 06 bleibt mit `gaps_found` (11/14 must_haves, siehe `06-VERIFICATION.md`/`06-REVIEW.md`) — dieser Lückenschluss ist weiterhin unabhängig offen und blockiert Phase 8 nicht.

## Phase Progress

### Milestone 2 (aktuell)

| Phase | Name | Status |
|-------|------|--------|
| 5 | Journal-Fundament | Complete (2/2 Plans), deployed — 2026-08-19 |
| 6 | Buchungen bei jedem Vorgang | Ausgeführt (3/3 Plans), Verifikation: Gaps Found — 2026-08-19 |
| 7 | Saldo aus Buchungen + Backfill | Complete (3/3 Plans), deployed — 2026-08-19 |
| 8 | Kontoauszug für Mitarbeiter und Admin | 4/5 Pläne abgeschlossen — Abnahme freigegeben, deployed 2026-08-20 |

### Milestone 1 (abgeschlossen 2026-04-02)

| Phase | Name | Status |
|-------|------|--------|
| 1 | Server DB Consolidation | Complete (5/5 plans) |
| 2 | Symlink + PM2 Ecosystem | Complete (2026-04-02) |
| 3 | Local Dev Sync Script | Complete (2/2 plans) |
| 4 | Deploy Workflow + Documentation | Complete (3/3 plans) |

## Decisions

- **01-server-db-consolidation-01:** Used chmod 750 for /home/ubuntu/databases/ directories — tighter than 755 minimum, excludes other users entirely for better security
- [Phase 01-server-db-consolidation]: LIVE_DB_PATH confirmed as /home/ubuntu/database-shared.db — symlink server/database.db already points to it
- [Phase 01-server-db-consolidation]: Use pm2 pid <name> (not pgrep -f) for reliable PM2 process PID resolution
- [Phase 01-server-db-consolidation]: 01-03: Copied /home/ubuntu/database-shared.db to /home/ubuntu/databases/production.db with mode 600 — original untouched, SIZE_MATCH verified
- [Phase 01-server-db-consolidation]: 01-05: sqlite3 CLI not on server — used better-sqlite3 Node module for PRAGMA integrity_check (identical result)
- [Phase 01-server-db-consolidation]: 01-05: All Phase 1 success criteria confirmed — SC-1 through SC-4 all PASS. Phase 1 gate cleared for Phase 2.
- [Phase 02-symlink-pm2-ecosystem]: PM2 v6 treats plain .js files as app scripts — ecosystem file must use .config.js extension (renamed ecosystem.production.js -> ecosystem.production.config.js)
- [Phase 02-symlink-pm2-ecosystem]: SESSION_SECRET not embedded in ecosystem file — loaded from server/.env via shell environment + --update-env at PM2 restart
- [Phase 02-symlink-pm2-ecosystem]: Old symlink backup: server/database.db.backup.20260402_125311 (points to /home/ubuntu/database-shared.db)
- [Phase 02-symlink-pm2-ecosystem]: All SC-1 through SC-4 confirmed PASS. Blue Server running on /home/ubuntu/databases/production.db. Phase 2 complete.
- [Phase 03-local-dev-sync-script]: 03-01: Use node -e + better-sqlite3 (explicit require path) for SQLite integrity checks — sqlite3 CLI absent in Git Bash on Windows
- [Phase 03-local-dev-sync-script]: 03-01: Script uses BASH_SOURCE[0] for project root resolution — works from any cwd including npm run
- [Phase 03-local-dev-sync-script]: 03-01: PROD_DB_PATH set to /home/ubuntu/databases/production.db (Phase 2 canonical path)
- [Phase 03-local-dev-sync-script]: 03-01: Backup naming convention server/database.db.backup.YYYYMMDD_HHMMSS covered by new .gitignore pattern server/*.db.backup.*
- [Phase 03-local-dev-sync-script]: 03-02: cygpath -m (not -w) required for Node.js require() paths in Git Bash — -w backslashes break JS string escaping
- [Phase 03-local-dev-sync-script]: 03-02: npm workspaces hoists better-sqlite3 to root node_modules (not server/node_modules) — check both in pre-flight
- [Phase 03-local-dev-sync-script]: 03-02: All Phase 3 success criteria confirmed — sync-dev-db.sh works end-to-end on Windows Git Bash. Phase 3 complete.
- [Phase 04-deploy-workflow-documentation]: 04-02: PORT=3001 added to pm2 start shell prefix in deploy-staging.yml — PM2 does not load .env, .env creation block preserved as documentation/fallback
- [Phase 04-deploy-workflow-documentation]: 04-01: Separate appleboy/ssh-action step for DB verification (not appended to deploy script) — distinct step identity in Actions logs; uses pm2 pid + lsof with .db$ anchor; reuses existing SSH secrets
- [Phase 04-deploy-workflow-documentation]: 04-02: On-demand comment block added to deploy-staging.yml documenting Green Server is not part of 2-Tier standard flow
- [Phase 04-deploy-workflow-documentation]: 04-03: CLAUDE.md Verbote updated - 'Auf main branch' rule replaced with 'Direkt auf Production server' rule since main IS the deploy branch in 2-Tier flow
- [Phase 04-deploy-workflow-documentation]: 04-03: All three docs updated to 2-Tier architecture - ENV.md, WINDOWS_PC_SETUP.md, CLAUDE.md now consistently reference /home/ubuntu/databases/production.db and npm run sync-dev-db
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-01: db.transaction()-Klammer für approveAbsenceRequest ergänzt (Rule 2) — Statuswechsel und Buchung müssen laut must_have atomar sein
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-01: revertBalancesAfterDeletion bekam reason-Parameter (rejected/deleted) für anlassgerechte Journal-Beschreibung
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-01: Buchung nur type='vacation' — sick/unpaid/overtime_comp berühren das Urlaubskonto nicht
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-02: Buchungslogik der Nutzeranlage aus routes/users.ts nach vacationBalanceService.initializeVacationAccountsForNewUser() extrahiert - direkt testbar, keine Verhaltensaenderung
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-02: bulkInitializeVacationBalances bucht entitlement UND carryover in einer Funktion - performYearEndRollover erbt beide Buchungen automatisch beim Aufruf
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-02: createdBy bei Massenanlage/Jahreswechsel: Admin-ID bei manuellem Aufruf, null beim automatischen Cron-Lauf
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-03: Leere-Begründung-Validierung liegt im Service (updateVacationBalance/upsertVacationBalance), nicht nur in der Route — beide Schreibpfade teilen dieselbe Prüfung
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-03: upsertVacationBalance bucht jetzt auch bei Neuanlage Anspruch/Übertrag — das ist der reale Admin-Editier-Pfad, VacationBalanceEditModal.tsx ruft für Neuanlage UND Bearbeitung immer POST auf, PUT/updateVacationBalance wird vom Frontend nicht verwendet
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-03: skipCreationBooking-Flag auf upsertVacationBalance verhindert Doppelbuchung bei initializeVacationAccountsForNewUser (Rule 1)
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: getVacationJournalEntries sortiert jetzt createdAt DESC, id DESC (Anzeige); getVacationTransactions bleibt bei date ASC, weil der Konsistenzprüfer aus Phase 7 die fachliche Chronologie braucht — Saldo-Kette riss sonst bei rückdatierten Buchungen (Bug, gefunden während der Abnahme)
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: `/promote-to-prod` ist NICHT der Weg, um die Desktop-App gegen Produktion zu richten — es merged staging→main und deployt, schaltet aber keine App-URL um. Abnahme läuft über `npm run sync-dev-db` + lokaler Dev-Server
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: Erwartungswert „Gesamt Verbleibend 2026 = 98 Tage" aus Phase 7 ist überholt — aktuell 112 Tage (Testnutzer „Test Urlaub", id 30, entstand nach dem Backfill-Wert)
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: Kontoauszug als Tab in AbsencesPage statt eigener Sidebar-Eintrag — bewusste Anwender-Entscheidung während der Abnahme
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: DATABASE_PATH muss in jedem produktionsdatenbank-berührenden Skript/Workflow-Schritt explizit gesetzt werden — Symlink server/database.db existiert auf dem Server seit 20.08.2026 nicht mehr; deploy-server.yml, migrate.ts und validateSchema.ts hatten das noch nicht nachgezogen

## Quick Tasks Completed

| Datum | Slug | Ergebnis |
|-------|------|----------|
| 2026-08-18 | urlaubskonto-korrektheit | 5 Bugfixes deployed + Produktionsdaten korrigiert. Urlaubstage gingen beim Ablehnen genehmigter Anträge verloren (Carmen 6, Benedikt 10); `0 \|\| 30` gab 6 Mitarbeitern je 30 statt 0 Tage. Gesamt Verbleibend 257,5 → 98 Tage. Siehe `.planning/quick/20260818-urlaubskonto-korrektheit/SUMMARY.md` |

## Ungeplante Eingriffe (Produktion)

- **2026-08-18 DB-Stabilisierung:** Zwei verwaiste WAL-Dateien machten `production.db` nicht mehr
  neustartfähig (`SQLITE_CORRUPT` bei jedem neuen Verbindungsaufbau; der laufende Server hielt
  nur noch gelöschte Dateihandles). Ursache: Der Cronjob `fix-overtime.ts` öffnete dieselbe DB
  über den Symlink `server/database.db` ohne gesetztes `DATABASE_PATH` — zwei Prozesse mit
  getrennten WAL/SHM auf einer Datei. Behoben: WAL/SHM in Quarantäne, `REINDEX`
  (`integrity_check: ok`), Cron deaktiviert. Details: `.planning/debug/db-stabilisierung-20260818.md`

- **Offen daraus:** Staging-Sync (`Permission denied`), Cron-Reaktivierung mit `DATABASE_PATH`,
  Symlink `server/database.db` auflösen, Quarantäne nach Bewährungszeit löschen.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 06-buchungen-bei-jedem-vorgang P01 | 30min | 4 tasks | 3 files |
| Phase 06-buchungen-bei-jedem-vorgang P02 | 35min | 3 tasks | 5 files |
| Phase 06-buchungen-bei-jedem-vorgang P03 | 25min | 4 tasks | 3 files |
| Phase 08-kontoauszug-f-r-mitarbeiter-und-admin P04 | 1h 41min | 3 tasks | 10 files |

## Aktuelle Hinweise für parallele Sitzungen (Stand 20.08.2026)

- **Phase 8 releasefähig.** Server deployed, Journal-Endpunkt live und mit 401 abgesichert,
  Anwender-Abnahme gegen echte Produktionsdaten erteilt. Offen: Plan 08-05 (Desktop-Release
  v1.8.0). Details: `.planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/08-04-SUMMARY.md`.

- **Symlink `server/database.db` auf dem Server entfernt.** Skripte gegen Produktion MÜSSEN
  `DATABASE_PATH=/home/ubuntu/databases/production.db` explizit setzen. Ohne die Variable
  entsteht eine leere Datenbank (fällt sofort auf) — vorher wäre still die Produktion
  gefährdet worden. Details in `.claude/CLAUDE.md` → Database Rules.

- **Deploy-Workflow angepasst:** Pre-Deploy-Backup zielt direkt auf `production.db`, Ablage
  unter `~/databases/backups/`. Commit `5f4519e` liegt lokal und geht beim nächsten Push mit.

- **Frische Daten sind per direktem Lesezugriff auf die Datenbankdatei nicht sichtbar**
  (SQLite WAL-Modus). Verifikation über `pm2 logs timetracking-server` oder die API.

- **UAT der Phasen 6+7 abgeschlossen**, 7/7 bestanden — siehe
  `.planning/phases/07-saldo-aus-buchungen-backfill/07-UAT.md`.

- **Testdaten in Produktion:** User 30 „Test Urlaub", User 31 „UAT", Antrag 73 (storniert).
