---
gsd_state_version: 1.0
milestone: v2.0
milestone_name: Urlaubskonto — Korrektheit & Nachvollziehbarkeit
status: Phase 5 abgeschlossen — bereit für Phase 6
stopped_at: Phase 5 komplett (05-01 + 05-02), noch nicht deployed
last_updated: "2026-08-18T20:50:00.000Z"
progress:
  total_phases: 4
  completed_phases: 1
  total_plans: 2
  completed_plans: 2
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-18)

**Core value:** Kein Urlaubstag verschwindet mehr unbemerkt — jede Bewegung wird gebucht, der Saldo ist ihre Summe.
**Current focus:** Phase 06 — Buchungen bei jedem Vorgang

## Current Status

- **Phase:** 06 of 8 — Buchungen bei jedem Vorgang (noch nicht geplant)
- **Milestone:** 2 — Urlaubskonto: Korrektheit & Nachvollziehbarkeit
- **Initialized:** 2026-08-18
- **Next action:** Phase 5 deployen, dann `/gsd:plan-phase 6`
- **Last completed:** Phase 5 — Journal-Fundament (Migration 007 + vacationTransactionService, 16 Tests grün)
- **Stopped at:** Phase 5 komplett, Migration noch nicht auf Produktion ausgerollt

## Phase Progress

### Milestone 2 (aktuell)

| Phase | Name | Status |
|-------|------|--------|
| 5 | Journal-Fundament | Complete (2/2 Plans) — 2026-08-19 |
| 6 | Buchungen bei jedem Vorgang | Not started |
| 7 | Saldo aus Buchungen + Backfill | Not started |
| 8 | Kontoauszug für Mitarbeiter und Admin | Not started |

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
