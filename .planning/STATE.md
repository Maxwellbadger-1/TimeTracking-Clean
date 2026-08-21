---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: Historisierte Arbeitszeitmodelle
status: planning
last_updated: "2026-08-21T19:28:40.770Z"
last_activity: 2026-08-21
progress:
  total_phases: 6
  completed_phases: 0
  total_plans: 0
  completed_plans: 0
  percent: 0
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-21)

**Core value:** Eine Stundenumstellung verschiebt keine Vergangenheit — was bis zum Stichtag gerechnet wurde, bleibt stehen.
**Current focus:** Milestone v3.0 zugeschnitten (Phasen 9–14) — Phase 9 noch nicht begonnen

## Current Status

- **Phase:** 9 von 14 — noch nicht begonnen
- **Milestone:** v3.0 — Historisierte Arbeitszeitmodelle (gestartet 2026-08-21)
- **Initialized:** 2026-08-18
- **Next action:** `/gsd:discuss-phase 9` — Kontext für „Ein Maßstab, ein Weg" sammeln, oder `/gsd:plan-phase 9` direkt planen.
- **Last completed:** Milestone v2.0 abgeschlossen und archiviert (Tag `milestone-v2.0`)
- **Stopped at:** Milestone v3.0 aufgesetzt: REQUIREMENTS.md mit REQ-17 bis REQ-33, ROADMAP.md mit sechs Phasen (9–14), 100 % Abdeckung. `.planning/phases/` ist leer.

## Phase Progress

### Milestone v3.0 (aktuell)

| Phase | Name | Status |
|-------|------|--------|
| 9 | Ein Maßstab, ein Weg | Nicht begonnen — REQ-17 bis REQ-19 |
| 10 | Perioden-Fundament | Nicht begonnen — REQ-20 bis REQ-22 |
| 11 | Datumsabhängige Berechnung | Nicht begonnen — REQ-23 bis REQ-25 |
| 12 | Stundenwechsel bedienen | Nicht begonnen — REQ-26 bis REQ-29 |
| 13 | Korrigieren und rückgängig machen | Nicht begonnen — REQ-30 bis REQ-31 |
| 14 | Absicherung und Auslieferung | Nicht begonnen — REQ-32 bis REQ-33 |

### Milestone v2.0 (abgeschlossen 2026-08-21)

| Phase | Name | Status |
|-------|------|--------|
| 5 | Journal-Fundament | Complete (2/2 Plans), deployed — 2026-08-19 |
| 6 | Buchungen bei jedem Vorgang | Complete (7/7 Plans), Verifikation 14/14 bestanden — 2026-08-21 |
| 7 | Saldo aus Buchungen + Backfill | Complete (3/3 Plans), deployed — 2026-08-19 |
| 8 | Kontoauszug für Mitarbeiter und Admin | Complete (5/5 Pläne) — Release v1.8.0 veröffentlicht 2026-08-20 |

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
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-07: entitlement wird bei der Pre-Hire-Korrektur per Gegenbuchung auf 0 gesetzt (nicht nur der Journalsaldo ausgeglichen) — der Kontoauszug-Header zeigt sonst irreführend "Genommen X", obwohl nie Urlaub genommen wurde
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-07: Produktionslauf gegen Karin Jochem (userId 2) und Christine Glas (userId 3) am 21.08.2026 ausgeführt und unabhängig verifiziert (Journalsaldo, vacation_balance, Korrekturbuchung mit Marker [BACKFILL-06-07], 2026er-Konten und userId 1 unangetastet). Ausführung erfolgte per SSH durch den Orchestrator im ausdrücklichen Auftrag des Anwenders; der im Plan vorgeschriebene Zwei-Stufen-Ablauf (Trockenlauf → Prüfung → --apply) blieb dabei gewahrt. Backup vor dem Lauf: /home/ubuntu/databases/backups/production.PRE-06-07_20260821_184143.db
- [Phase 06-buchungen-bei-jedem-vorgang]: 06-07: Phase 6 musste vor dem Produktionslauf erst deployed werden (Skript existierte auf dem Server noch nicht) — für künftige Datenkorrekturpläne ist das Deployment als Vorbedingung mitzuplanen
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: getVacationJournalEntries sortiert jetzt createdAt DESC, id DESC (Anzeige); getVacationTransactions bleibt bei date ASC, weil der Konsistenzprüfer aus Phase 7 die fachliche Chronologie braucht — Saldo-Kette riss sonst bei rückdatierten Buchungen (Bug, gefunden während der Abnahme)
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: `/promote-to-prod` ist NICHT der Weg, um die Desktop-App gegen Produktion zu richten — es merged staging→main und deployt, schaltet aber keine App-URL um. Abnahme läuft über `npm run sync-dev-db` + lokaler Dev-Server
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: Erwartungswert „Gesamt Verbleibend 2026 = 98 Tage" aus Phase 7 ist überholt — aktuell 112 Tage (Testnutzer „Test Urlaub", id 30, entstand nach dem Backfill-Wert)
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: Kontoauszug als Tab in AbsencesPage statt eigener Sidebar-Eintrag — bewusste Anwender-Entscheidung während der Abnahme
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-04: DATABASE_PATH muss in jedem produktionsdatenbank-berührenden Skript/Workflow-Schritt explizit gesetzt werden — Symlink server/database.db existiert auf dem Server seit 20.08.2026 nicht mehr; deploy-server.yml, migrate.ts und validateSchema.ts hatten das noch nicht nachgezogen
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-05: Release v1.8.0 veröffentlicht — alle drei Versionsdateien synchron, Tag gesetzt, alle vier Matrix-Jobs (macOS arm64/x64, Windows, Linux) erfolgreich, latest.json enthält alle vier Auto-Update-Plattformschlüssel mit Signatur. Phase 8 damit vollständig (5/5 Pläne)
- [Phase 08-kontoauszug-f-r-mitarbeiter-und-admin]: 08-05: Zwei untracked Debris-Dateien (.claude/CLAUDETESTOUT.md, zwei stale WAL/SHM-Quarantänedateien) vor dem Versionssprung entfernt, um den von der Release-Checkliste geforderten sauberen git status zu erreichen — keine der Dateien war je getrackt

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
| Phase 08-kontoauszug-f-r-mitarbeiter-und-admin P05 | ~20min | 3 tasks | 6 files |
| Phase 06-buchungen-bei-jedem-vorgang P07 | ~40min | 3 tasks | 3 files |

## Aktuelle Hinweise für parallele Sitzungen (Stand 20.08.2026)

- **Phase 8 abgeschlossen, Release v1.8.0 veröffentlicht.** Server bereits seit Plan 08-04 in
  Produktion, Desktop-Release v1.8.0 seit Plan 08-05 verfügbar (kein Entwurf, alle vier
  Plattformen, `latest.json` vollständig). Anwender erhalten den Kontoauszug über die
  Auto-Update-Funktion. Details: `.planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/08-05-SUMMARY.md`.
  Ein Teil des Releases (Notification-Guard) wurde nur im Browser-Dev-Modus getestet, nicht in
  der gebauten Tauri-App — siehe Risiken-Abschnitt in der 08-05-SUMMARY.md.

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

- **Phase-6-Lückenschluss (06-04 bis 06-07) ausgeführt, abschließende Verifikation offen.**
  Alle 7 Pläne der Phase haben eine SUMMARY.md. 06-07 hat am 21.08.2026 die beiden realen
  2025er-Datenartefakte (Karin Jochem, Christine Glas) gegen Produktion korrigiert und
  unabhängig verifiziert. Phasenstatus bleibt bis zur erneuten Prüfung gegen
  `06-VERIFICATION.md` auf „Lückenschluss ausgeführt", nicht „Complete". Details:
  `.planning/phases/06-buchungen-bei-jedem-vorgang/06-07-SUMMARY.md`.

## Current Position

Phase: Not started (defining requirements)
Plan: —
Status: Defining requirements
Last activity: 2026-08-21 — Milestone v3.0 started

## Operator Next Steps

- Start the next milestone with /gsd:new-milestone

---

## Zurückgestellte Punkte

Beim Abschluss von Milestone v2.0 am 2026-08-21 bewusst zurückgestellt und dokumentiert.
Acht offene Debug-Sessions in `.planning/debug/`:

| Thema | Einschätzung | Weiterbehandlung |
|-------|--------------|------------------|
| `urlaubstage-bei-ablehnung-verloren` | Auslöser von v2.0 — durch diesen Milestone strukturell behoben | erledigt, Datei als Beleg |
| `db-stabilisierung-20260818` | Behoben 18.08., Symlink am 20.08. entfernt | Restpunkt: Cron mit `DATABASE_PATH` reaktivieren |
| `carmen-rothemund-overtime-analysis` | Überstundenberechnung | Milestone v3.0 |
| `overtime-compensation-workschedule-bug` | Überstunden + `workSchedule` | Milestone v3.0 |
| `overtime-validation-backend-mismatch` | `getOvertimeBalance()` ohne Monatsfilter | Milestone v3.0, REQ-19 |
| `OVERTIME-FIX-PLAN` | Sammelplan Überstunden | Milestone v3.0 |
| `unpaid-leave-logic-issues` | Logik unbezahlter Urlaub | offen, unzugeordnet |
| `notifications-position-column-missing` | `position`-Spalte fehlt in der lokalen Entwicklungsdatenbank | offen, klein, unabhängig |

Vier der acht betreffen die Überstundenberechnung und werden in Milestone v3.0
(Historisierte Arbeitszeitmodelle) aufgegriffen — REQ-19 des Entwurfs verweist bereits
auf zwei davon.
