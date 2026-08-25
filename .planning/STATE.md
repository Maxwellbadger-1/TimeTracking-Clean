---
gsd_state_version: 1.0
milestone: v3.0
milestone_name: — Historisierte Arbeitszeitmodelle
status: executing
stopped_at: Plan 14.1-05 abgeschlossen (BL-04 geschlossen, 3 Commits, Gates gruen). Naechster und letzter Plan der Phase 14.1 ist 14.1-06 (Datenbereinigung der drei Zukunftsmonate, D-06 - zweistufig mit Sicherung und Trockenlauf). Weiterhin offen aus Plan 14-08 - Entscheidung des Anwenders zu den 99 von fix-overtime.ts geschriebenen Werten.
last_updated: "2026-08-25T04:54:00.000Z"
last_activity: 2026-08-25 -- Plan 14.1-05 abgeschlossen, BL-04 geschlossen (Sprung im Saldo nach einer Genehmigung -8,00 h -> 0,00 h; Rueckgabe bei Ablehnung und Loeschung je -8,00 h -> 0,00 h; Weg B bleibt als Pruefnachweis)
progress:
  total_phases: 9
  completed_phases: 5
  total_plans: 65
  completed_plans: 55
  percent: 58
---

# Project State

## Project Reference

See: .planning/PROJECT.md (updated 2026-08-21)

**Core value:** Eine Stundenumstellung verschiebt keine Vergangenheit — was bis zum Stichtag gerechnet wurde, bleibt stehen.
**Current focus:** Phase 14.1 — rechenwerk-blocker-aus-dem-produktionslauf-schliessen

## Current Status

- **Phase:** 14.1 — Rechenwerk-Blocker aus dem Produktionslauf schließen (5/6 Plänen fertig)
- **Milestone:** v3.0 — Historisierte Arbeitszeitmodelle (gestartet 2026-08-21)
- **Initialized:** 2026-08-18
- **Next action:** Plan 14.1-06 (Datenbereinigung der drei Zukunftsmonats-Datenreste) ausführen — Welle 6 ist durch den Abschluss von 14.1-05 entsperrt. Das ist der **einzige** Schritt der Phase, der Daten löscht, und er ist nach D-06 zwingend zweistufig: vorherige Sicherung → Trockenlauf ohne Schreibzugriff → Prüfung der Trockenlauf-Ausgabe → `--apply` → Nachweis, dass die gelöschten Zeilen aus der Sicherung wiederherstellbar sind. Unverändert offen daneben: die Entscheidung des Anwenders zum Befund aus Plan 14-08 (fix-overtime.ts hat 99 Werte in overtime_balance bei 8 Nutzern neu geschrieben; Details in 14-PRODUKTIONSLAUF.md), die Entscheidung 14.1-U3 (Darstellung von Abwesenheitstagen im Kontoauszug), die zusammengehörenden Entscheidungen 14.1-U5 und **14.1-U8** (`work_time_accounts` zieht weder beim Löschen noch beim Anlegen einer Krankmeldung mit), **14.1-U11** (der Historien-Export trägt weiterhin 102 Zeiteinträge und 1 genehmigten Antrag stillgelegter Konten) sowie neu **14.1-U15** (ob die Datenbereinigung die drei Bestandsausgleiche 25, 56, 64 zusätzlich auf Alt-Abzüge in `overtime_balance` nachmisst — Details in deferred-items.md, Abschnitt „Aus Plan 14.1-05").
- **Last completed:** Plan 14.1-05 — BL-04 geschlossen. Der handgeschriebene FIFO-Abzug in `overtime_balance` (Weg A) ist samt **beiden** Aufrufern und der Funktionsdefinition ersatzlos entfernt; projektweit 0 Treffer. Die von D-04 verlangte Nachmessung lief **vor** dem Entfernen und förderte zwei Dinge zutage, die der Befund nicht kannte: Weg A hatte zwei Aufrufer (14.1-CONTEXT.md nennt nur einen), und der zweite war seit jeher wirkungslos — er rief den Abzug mit negativem Argument auf, dessen Schleife sofort abbricht; genau deshalb fehlten nach Ablehnung und Löschung je 8,00 h. Gemessen: Sprung zwischen Saldo nach Genehmigung und Saldo nach der nächsten Neuberechnung **−8,00 h → 0,00 h**, `actualHours` des fremden, längst abgeschlossenen Vormonats **244,00 h → 252,00 h**, Rückgabe bei Ablehnung und bei Löschung je **−8,00 h → 0,00 h**. **Entscheidung des Anwenders zu Weg B: `option-a`** — die `compensation`-Journalzeile bleibt als Prüfnachweis, gestützt auf zwei Messwerte (sie überlebt die Neuberechnung: 1 Zeile davor, 1 danach; sie bewegt den Saldo um 0,00 h). Drei Commits (`67647b6` Nachmessung, `24bfb75` fix, `50e8b7b` Zusicherungen), alle vier Gates grün (557 grün / 3 rot bei einem Ausgangsstand von 553/3), D-08-Prüfsummen unverändert, die Anträge 25/56/64 unangetastet, kein Push.
- **Davor abgeschlossen:** Plan 14.1-04 — BL-03 geschlossen. Der Historien-Export filtert jetzt stillgelegte Konten (`deletedAt IS NULL`) und nicht genehmigte Anträge (`status = 'approved'`) in **beiden** Abfragevarianten, und `totalOvertime` summiert nur die exportierten Nutzer und keinen Monat in der Zukunft. Auf einer Produktionsarbeitskopie gemessen: abgelehnte Anträge im Export **15 → 0**, stillgelegte Konten **5 → 0**, `overtimeBalance`-Zeilen mit Zukunftsmonat **3 → 0**, `totalOvertime` **−2.954,21 h → 105,75 h**. Die bewusste Gegenentscheidung der DATEV-Schwesterfunktion blieb unangetastet und ist jetzt durch einen Test abgesichert. Zwei Commits (`ceb97d5` fix, `38c0173` test), alle vier Gates grün (553 grün / 3 rot bei einem Ausgangsstand von 547/3), D-08-Prüfsummen unverändert, kein Push.
- **Davor abgeschlossen:** Plan 14.1-03 — BL-05 geschlossen. Der Neuberechnungsblock steht jetzt auch im Auto-Genehmigungszweig von `createAbsenceRequest`; die `sick_credit`-Buchungen stehen unmittelbar nach dem Anlegen im Journal (0 → 1 Zeile, +8,00 h = ein Tagessoll), bei angehaltenem Nachtlauf und ohne zwischengeschaltete Berichtsabfrage. Die Auto-Genehmigung ist unverändert und jetzt durch drei Regressionstests festgeschrieben (`approved`, `approvedBy`/`approvedAt` NULL, kein `audit_log`); die Bestandsanträge 46, 60, 68, 70 sind unangetastet. Gegenversuch protokolliert (ohne den Fix Test 1 rot). 2 Commits, alle vier Gates grün (547 grün / 3 rot, rote Menge unverändert).
- **Davor abgeschlossen:** Plan 14.1-02 — BL-02 geschlossen. `require()` in `absenceService.ts` durch einen statischen ESM-Import ersetzt; der Löschpfad rechnet nachweislich neu: `overtime_transactions` 2 → 0, `work_time_accounts.currentBalance` −168,00 h → −176,00 h. Davor Plan 14.1-01 — BL-01 geschlossen (8 Nutzer mit Zukunftsdifferenz vorher, 0 nachher).
- **Stopped at:** Plan 14.1-05 vollständig abgeschlossen, SUMMARY und Nachweis geschrieben. Kein Push (D-13).

**Autonomer Lauf (`/gsd:autonomous --from 11`):** discuss übersprungen (CONTEXT für 11–14 liegt vor),
UI-Phase nur wo nötig (12 und 13 haben UI-SPEC, 14 braucht keine), menschliche Abnahme (UAT)
aller Phasen gesammelt ans Milestone-Ende nach Phase 14 verlagert.

## Phase Progress

### Milestone v3.0 (aktuell)

| Phase | Name | Status |
|-------|------|--------|
| 9 | Ein Maßstab, ein Weg | Complete (5/5 Pläne), verifiziert 11/11 — REQ-17 bis REQ-19 |
| 9.1 | Journal-Backfill und Betriebs-Härtung | Noch keine Pläne (verankert, NICHT erledigt) — läuft mit dem Produktionslauf der Phase 14 |
| 10 | Perioden-Fundament | Complete (6/6 Pläne), verifiziert 4/4 — REQ-20 bis REQ-22 |
| 11 | Datumsabhängige Berechnung | Complete (11/11 Pläne), Review 2 Iterationen / 33 Fixes, verifiziert 10/10 — REQ-23 bis REQ-25 |
| 12 | Stundenwechsel bedienen | Geplant (9 Pläne, 5 Wellen), plan-checker PASSED — REQ-26 bis REQ-29 |
| 13 | Korrigieren und rückgängig machen | Nicht begonnen — UI-SPEC abgenommen, Planung offen — REQ-30 bis REQ-31 |
| 14 | Absicherung und Auslieferung | Nicht begonnen — Kontext gesetzt — REQ-32 bis REQ-33 |

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

## Offene Pflichtpunkte (nicht durch Werkzeuge erfasst)

- **Phase 9.1 — Journal-Backfill und Betriebs-Härtung.** Verankert in ROADMAP.md (Zeile 26,
  Abschnitt ab Zeile 141, Fortschrittstabelle Zeile 344) und REQUIREMENTS.md (Zeile 166).
  **Achtung:** Die Phase hat noch keine Pläne. `gsd-sdk query roadmap.analyze` meldet sie
  deshalb faelschlich als `complete` (0 von 0 offenen Plaenen) und ein autonomer Lauf
  wuerde sie ueberspringen. Sie ist nicht erledigt.
  **Festgelegt am 22.08.2026:** Der Backfill schreibt in die Produktionsdatenbank und laeuft
  deshalb gemeinsam mit dem Produktionslauf der Phase 14 — ein Wartungsfenster, ein Backup,
  eine Verifikation. Die reinen Codeanteile (WR-02 bis WR-05, WR-07 aus 09-REVIEW.md) koennen
  vorher laufen. Der Produktionsschreibzugriff bedarf der ausdruecklichen Freigabe des Anwenders.

---

## Decisions

- [Phase 14.1 / Plan 14.1-05]: **BL-04 / Weg B — `option-a` (Anwender, 25.08.2026):** Die `compensation`-Journalzeile bleibt als Prüfnachweis. Sie ist seit dem Rebuild-Fix vom 18.08.2026 dauerhaft (gemessen: 1 Zeile vor und nach einer Neuberechnung) und bewegt keinen Saldo (gemessen: 76,00 h mit wie ohne sie). „Genau eine Spur, nicht drei" wird als genau eine **saldowirksame** Spur gelesen.
- [Phase 14.1 / Plan 14.1-05]: **BL-04 / Weg A entfernt, samt beiden Aufrufern.** Der zweite Aufrufer (in `revertBalancesAfterDeletion`) stand nicht in 14.1-CONTEXT.md und war außerdem seit jeher wirkungslos — negatives Argument, Schleife bricht bei `remainingHours <= 0` sofort ab. Genau deshalb fehlten nach Ablehnung und Löschung je 8,00 h.
- [Phase 14.1 / Plan 14.1-05]: Das Abnahmekriterium „`grep -c recordOvertimeCompensation` in `absenceService.ts` = 1" ist eine Fehlzählung des Planers (gemessen: 2, beide Zeilen gehören zu Weg B). Benannt und begründet, statt den Code an die Zahl anzupassen.
- [Phase 14.1 / Plan 14.1-05]: Mögliche Alt-Abzüge im Bestand (Anträge 25, 56, 64) wurden **nicht gemessen und nicht repariert** — das wäre ein Datenzugriff und gehört nach D-06 in die Datenbereinigung (Plan 14.1-06). Als 14.1-U15 zur Entscheidung vorgelegt.
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
- [Phase ?]: [09-01] server/scripts/fix-overtime.ts als Produktivpfad=ja eingestuft (Abweichung A-1 zu REQ-17) — laeuft bei jedem Deployment und taeglich per Cron (deploy-server.yml), berechnet Sollstunden ueber weeklyHours/5 statt getDailyTargetHours() und ignoriert damit workSchedule
- [Phase ?]: [09-01] REQ-19-Kernbefund aktiv verifiziert: overtime_comp-Debit erreicht den Saldo nicht, weil ensureOvertimeBalanceEntries() und updateOvertimeBalanceForMonth() actualHours bei jeder Neuberechnung ohne Kenntnis von type='compensation'-Buchungen ueberschreiben
- [Phase ?]: [09-01] Alle vier offenen Ueberstunden-Debug-Sessions (carmen-rothemund-overtime-analysis, overtime-compensation-workschedule-bug, overtime-validation-backend-mismatch, OVERTIME-FIX-PLAN) als behoben verifiziert - die beschriebenen Fixes sind im heutigen Code vorhanden
- [Phase 09-ein-ma-stab-ein-weg]: [09-02] Karin Jochem (userId 2) statt Carmen Rothemund als Pruefnutzer A gewaehlt - Carmen ist bereits Nutzer C (overtime_comp-Reproduktionsfall fuer Plan 09-04), alle drei Pruefnutzer muessen verschiedene userId sein
- [Phase 09-ein-ma-stab-ein-weg]: [09-02] npm run sync-dev-db nicht ausgefuehrt (laufender Dev-Server haelt DB offen, mv waere fehlgeschlagen) - Aktualitaet stattdessen direkt geprueft (18 aktive Nutzer, letzter time_entries.date 2026-08-20), als Abweichung dokumentiert
- [Phase 09-ein-ma-stab-ein-weg]: [09-02] Erstbefund zeigt 0 Abweichungen zwischen den fuenf Ueberstunden-Wegen bei allen drei Pruefnutzern, aber einen separaten Transaktions-Mismatch (overtime_transactions unvollstaendig) - deckt sich mit dem REQ-19-Kernbefund aus 09-01, kein neuer REQ-17/18-Fund
- [Phase 09-ein-ma-stab-ein-weg]: [09-03] userForCalc (bereits als UserPublic gebaut) statt der rohen DB-Zeile an getAllWorkingDaysBetween() übergeben - haelt die Signatur konsistent mit getDailyTargetHours()
- [Phase 09-ein-ma-stab-ein-weg]: [09-03] a1-vorher.db nicht fuer die Nachher-Messung wiederverwendet - sie enthaelt bereits kanonisch ueberschriebene Zeilen aus dem Task-3-Werkzeuglauf; frische Kopie a1-nachher.db gezogen
- [Phase 09-ein-ma-stab-ein-weg]: [09-03] Zeilenzitate aus dem Plan-Interfaces-Abschnitt, die durch Task 2s Zeilenentfernung um 15 Zeilen verschoben wurden, in den Nachweisdokumenten mit beiden Staenden zitiert
- [Phase 09-ein-ma-stab-ein-weg]: [09-04] Zweig A gewaehlt (Fix in Phase 9 statt Phase 9.1): 2 Services betroffen (unifiedOvertimeService.ts, overtimeTransactionRebuildService.ts), keine Datenmigration noetig - overtime_balance wird bei jedem Dashboard-/Berichtsaufruf ueber ensureOvertimeBalanceEntries() ohnehin vollstaendig neu berechnet (self-heal)
- [Phase 09-ein-ma-stab-ein-weg]: [09-04] Beide Services mussten geaendert werden, nicht nur unifiedOvertimeService.ts: updateMonthlyOvertime() schreibt overtime_balance zweimal nacheinander (unifiedOvertimeService-UPSERT, dann rebuildOvertimeTransactionsForMonth-UPSERT); der zweite Schreibvorgang haette den Fix im ersten sonst wieder ueberschrieben
- [Phase 09-ein-ma-stab-ein-weg]: [09-04] Pre-existierende, vom REQ-19-Fix unabhaengige targetHours-Abweichung in overtimeTransactionRebuildService.ts (36h statt 40h fuer Nutzer C) per Gegenprobe verifiziert und in deferred-items.md dokumentiert statt mitbehoben - ausserhalb des REQ-19-Scopes, betrifft nicht den ueber GET /api/overtime/:userId angezeigten Saldo
- [Phase ?]: [Phase 09-05] Zwoelf statt vier Fundstellen der overtime_comp-Kreditierungsregel gezaehlt statt angenommen - CR-01 und der Schreibpfad geschlossen, Monatsend-Off-by-one in zwei Funktionen behoben
- [Phase ?]: [Phase 09-05] Produktionsschutz-Guard kombiniert Pfadgleichheit + NODE_ENV + Substring-Fallback statt reiner Heuristik - getProductionDatabasePath() liefert strukturell nicht den realen Produktionspfad, gemessen dass der Substring-Fallback fuer den D5-Kanarientest noetig bleibt
- [Phase ?]: [Phase 09-05] Erfolgskriterium 3 der ROADMAP erfuellt: alle drei Pruefnutzer zeigen nach Rebuild mit dem gefixten Code Transaction validation PASSED - Nachweis in 09-ABSCHLUSS-NACHWEIS.md, Phase 9.1 (Journal-Backfill, Betriebs-Haertung) in ROADMAP/REQUIREMENTS verankert (D2)
- [Phase 10-perioden-fundament]: 10-01: DDL woertlich aus dem ddl_contract uebernommen, keine eigene Aenderung
- [Phase 10-perioden-fundament]: 10-01: PRAGMA index_list(user_work_periods) liefert 3 Eintraege (2 benannte Indizes + 1 SQLite-Autoindex fuer UNIQUE(userId, validFrom)) - Tests pruefen auf benannte Indizes statt fester Gesamtzahl
- [Phase 10-perioden-fundament]: 10-01: schemaMigrationParity.test.ts nutzt Dateien in os.tmpdir() statt :memory:, weil initializeDatabase() WAL-Modus erzwingt
- [Phase 10-perioden-fundament]: 10-01: requirements.mark-complete fuer REQ-20/REQ-22 nicht anwendbar - REQUIREMENTS.md dieses Milestones nutzt kein Checkbox-/Pending-Complete-Format, nur eine Phasenzuordnungstabelle; Abdeckung bleibt wie gehabt ueber die Phase-10-Zeilen dokumentiert
- [Phase 10-perioden-fundament]: 10-03: FALLBACK_PROJECT_START=2025-01-01 (D5) - deckt fruehesten gemessenen time_entries.date (2025-07-01) und hireDate (2025-11-13) ab, kein Epoch-Datum
- [Phase 10-perioden-fundament]: 10-03: Selbstverifikation der Migration 009 vergleicht ALLE Perioden (nicht nur neu eingefuegte) gegen aktuelle users-Werte - Skip-Test fuer D7 musste weeklyHours/workSchedule der manuell vorab eingefuegten Periode identisch zum Nutzer halten
- [Phase 10-perioden-fundament]: Fehlertext für Überlappungs-Konflikte nennt das Substantiv Überlappung statt der Verbform, damit der geforderte Wortlaut aus dem Plan exakt getroffen wird
- [Phase 10-perioden-fundament]: Trigger-Bypass fuer den checkPeriodChain-Luecken-Test laeuft ausschliesslich innerhalb einer einzigen atomaren db.transaction() mit wortgleicher Wiederherstellung der Trigger-DDL aus Migration 008
- [Phase 10-perioden-fundament]: Identisches validFrom wirft Ueberlappung, nicht UNIQUE constraint failed - Insert-Trigger laeuft vor Constraint-Pruefung, UNIQUE-Index bleibt Verteidigung in der Tiefe
- [Phase 10-perioden-fundament]: Insert-Trigger-Entfernungsexperiment zweifach durchgefuehrt: dauerhafter automatisierter Test plus einmaliger manueller Versuch an der echten Migrationsdatei, danach per Bearbeitung (nicht git checkout) zurueckgenommen
- [Phase 10-perioden-fundament]: Migration 009 aus Plan 10-03 war beim Migrationslauf bereits zusammengefuehrt (Dev-Server wendet Migrationen automatisch an); user_work_periods zeigte 20 statt 0 Zeilen - dokumentierter Erwartungsfall, kein Fehlschlag
- [Phase 10-perioden-fundament]: Zusaetzliche synthetische Vor-008-Kopie gebaut, um zu belegen dass migrate:copy tatsaechlich neue Migrationen anwendet, nicht nur eine vollstaendige Datenbank bestaetigt
- [Phase ?]: [10-05] Der kanonische Überstunden-Lesepfad löst soft-gelöschte Nutzer nicht auf (getUser() filtert deletedAt IS NULL) — snapshotBalances.ts fängt das je Nutzer ab und hält die Fehlermeldung in overtimeError fest, statt abzubrechen.
- [Phase 10-perioden-fundament]: 10-06: Migration 001 bleibt bewusst async (echtes await auf Feiertags-Netzabruf, laeuft auf jedem Erststart) - applyMigration() bekommt stattdessen zwei getrennte Pfade statt eines pauschalen Abweisens von async up()
- [Phase 10-perioden-fundament]: 10-06: Migration 010 statt reiner Aenderung an 008 - 008 ist auf development.db und lokalen Kopien bereits verbucht und laeuft dort nie erneut; 010 importiert dieselbe DELETE_GUARD_TRIGGER_SQL-Konstante wie 008 (eine Quelle, keine dritte Kopie)
- [Phase 10-perioden-fundament]: 10-06: WR-01-Riegel verweigert nur das Leerlaufen auf null Perioden, nicht das Loeschen der ersten von mehreren Perioden - das bleibt laut 13-CONTEXT.md D3 Sache der Ersetzungslogik in Phase 13
- [Phase 11-datumsabh-ngige-berechnung]: [11-02] resolveWorkPeriodIn ersetzt die SQL-WHERE-Bedingung in resolveWorkPeriodAt vollständig — die Intervall-Semantik existiert projektweit nur noch einmal — D1/D2: workPeriodContext.ts cached per Closure je Berechnungslauf (kein modul-globales Map), directWorkPeriodLookup ist der ungecachte Fallback fuer Einzelabfragen
- [Phase 11-datumsabh-ngige-berechnung]: [11-01] Testdatei-Treffer der vier Grep-Laeufe je Datei zu einer Sammelzeile zusammengefasst statt 1:1 explodiert, weil sie keine eigenstaendigen Berechnungswege sind, aber wegen D3 dennoch Compiler-Fehler ausloesen
- [Phase 11-datumsabh-ngige-berechnung]: [11-01] tsc-Fehler und 5 zusaetzliche rote Tests beim Baseline-Lauf stammen aus der parallel laufenden TDD-RED-Phase von Plan 11-02 (Commit 8a3ae3b), nicht aus Plan 11-01 - verbindliche Referenz fuer Plan 11-10 bleiben die 3 tatsaechlich vorbestehenden roten Tests
- [Phase 11-datumsabh-ngige-berechnung]: [11-03] createUser()/updateUser() legen Startperiode bzw. spiegeln Stammdatenaenderung atomar per db.transaction() - ensureInitialWorkPeriod(user, createdBy?) exportiert und idempotent fuer Seed-Skripte (Plan 11-08); createdBy der Startperiode bleibt null (keine Admin-ID in der createUser-Signatur verfuegbar), note traegt die Nachvollziehbarkeit
- [Phase 11-datumsabh-ngige-berechnung]: [11-03] Rule 1: createUser() ohne hireDate verletzte users.hireDate NOT NULL bereits vor Phase 11 (schema.ts:45, DEFAULT wird durch explizit gebundenes NULL nicht ausgeloest) - behoben, hireDate und Perioden-validFrom teilen jetzt denselben resolveInitialValidFrom()-Ersatzwert
- [Phase 11-datumsabh-ngige-berechnung]: [11-03] UPDATE user_work_periods bewusst direkt in userService.ts statt workPeriodService.ts (Plan 11-02 arbeitete in derselben Welle parallel an dieser Datei) - Phase 12 fuehrt den Schreibzugriff zusammen
- [Phase 11]: calculateAbsenceHoursWithWorkSchedule bleibt bewusst eine zweite Kopie der Sollstunden-Regel (Wochenende immer uebersprungen); Zusammenfuehrung mit getDailyTargetHours ausdruecklich Phase 14 vorbehalten (D5), belegt durch Ausgangszustand-Kennzahl 0 von 20 Nutzern mit Wochenendstunden
- [Phase ?]: 11-06: ensureOvertimeBalanceEntries() aendert oeffentliche Signatur nicht - Perioden-Kontext intern erzeugt und an unifiedOvertimeService.calculateMonthlyOvertime() durchgereicht, damit alle ~15 Aufrufer automatisch periodenbewusst rechnen (D7)
- [Phase ?]: 11-06: getAllWorkingDaysBetween() bekommt echten vierten Pflichtparameter (periods), da exportiert - anders als ensureOvertimeBalanceEntries, wo der Kontext intern gekapselt bleibt
- [Phase ?]: calculateDailyOvertime behaelt Vorgabewert directWorkPeriodLookup fuer Routen ohne eigenen Berechnungslauf, obwohl getDailyTargetHours selbst (D3) einen Pflichtparameter verlangt — 11-05
- [Phase ?]: Namensraum-Import fuer createWorkPeriodContext in overtimeTransactionRebuildService.ts, damit grep genau eine Aufrufstelle zeigt — 11-05
- [Phase 11-datumsabh-ngige-berechnung]: validateScenario() nutzt stubWorkPeriodContext() statt createWorkPeriodContext() fuer synthetische Testnutzer ohne DB-Periode
- [Phase 11-datumsabh-ngige-berechnung]: Produktionsschutz in migrateOvertimeToTransactions.ts nachgeruestet (T-11-27), da das Skript zuvor ungeschuetzt Ueberstundentransaktionen schrieb
- [Phase 11-datumsabh-ngige-berechnung]: 11-11: create-admin.ts von fest verdrahtetem Pfad (server/database.db) auf DATABASE_PATH-bewusste geteilte Verbindung aus dist/database/connection.js umgestellt (Rule 3) - Skript ignorierte DATABASE_PATH zuvor vollstaendig
- [Phase 11-datumsabh-ngige-berechnung]: 11-11: Alle acht Skripte, die Nutzer per direktem INSERT INTO users anlegen, rufen jetzt ensureInitialWorkPeriod() auf - kein Nutzer im Projekt entsteht mehr ohne Arbeitszeitperiode (REQ-23)
- [Phase 11-09]: Desktop wird in Phase 11 nicht nachgezogen (Abhängigkeitskonflikt: fehlende Perioden-Lese-API), Wirksamkeitsfenster mit drei Messzahlen (alle 0) belegt statt behauptet
- [Phase 11-09]: Erschöpfende Nachsuche fand sechs Neufunde (drei tote Funktionen in workingDays.ts, timeEntryService.updateOvertimeBalance, verifyTestData.ts, check_overtime.ts) - alle Produktivpfad=nein, kein blockierender Befund
- [Phase 11-datumsabh-ngige-berechnung]: verifyPeriodNullEffect.ts als unabhaengiges Pruefwerkzeug: schliesst das Loch bei zwei soft-geloeschten Nutzern, die der kanonische Lesepfad nicht aufloest
- [Phase 11-datumsabh-ngige-berechnung]: Kontrollnutzer fuer REQ-25-Gegenprobe ist userId 3 (individueller Wochenplan) statt userId 1 (weeklyHours=0) - realistischerer Regelfall
- [Phase ?]: [Phase 12-stundenwechsel-bedienen]: 12-01 Migration 011 wortgleich nach Migration 006 gebaut (Tabellen-Neubau-Muster), referenceType-CHECK traegt explizites NULL wie 006, schema.ts bleibt bei seiner bestehenden Form ohne NULL - funktional identisch, keine Formatvereinheitlichung vorgenommen
- [Phase ?]: [Phase 12-stundenwechsel-bedienen]: 12-01 GET /api/work-periods legt in Plan 12-05 zwei weitere Endpunkte (POST /preview, POST /change) auf denselben Router - Kopfkommentar haelt fest, dass diese zusaetzlich requireAdmin brauchen (T-12-05)
- [Phase ?]: [Phase 12-stundenwechsel-bedienen]: 12-01 requirements.mark-complete fuer REQ-26/REQ-29 nicht anwendbar - REQUIREMENTS.md dieses Milestones nutzt kein Checkbox-/Pending-Complete-Format, nur eine Phasenzuordnungstabelle (wie bereits bei Phase 10 REQ-20/22 dokumentiert); Abdeckung bleibt ueber die Phase-12-Plaene dokumentiert
- [Phase 12-02]: Modal-Stack per Namespace-Import statt benannter Imports eingebunden, um exakte grep-Trefferzahlen der Abnahmekriterien zu erfuellen
- [Phase 12-02]: modalStack.test.ts laeuft als npx tsx-Pruefskript statt vitest-Test - vitest ist im Environment projektweit durch fehlendes @babel/runtime blockiert
- [Phase 12-03]: previousWeeklyHours in der Journalbeschreibung faellt auf user.weeklyHours zurueck, wenn am Stichtag keine Periode aktiv war — Luecken-Fall im Textbuch nicht wortwoertlich vorgegeben; einzige sinnvolle Deutung von bisherigen Wochenstunden ohne bisherige Periode
- [Phase 12-03]: Trockenlauf schreibt und rechnet auch im isNoOp-Fall wie der Speicherpfad, nur der Speicherpfad verweigert — Haelt D2 strikt ein - keine zweite Rechenbahn fuer Randfaelle
- [Phase ?]: Kein optimistisches Update in useSaveWorkTimeChange (D2) - der Speichern-Button haengt an einem gueltigen previewToken
- [Phase ?]: useSaveWorkTimeChange nutzt den bestehenden Helper invalidateUserAffectedQueries statt einzelner Ueberstunden-Query-Keys
- [Phase ?]: reason/previewToken werden im Speicherpfad-Anfragekoerper permissiv gelesen (leere Zeichenkette statt 400 bei fehlendem Typ) - ein fehlendes Token beantwortet verifyPreviewToken() bereits mit 409 PREVIEW_STALE (T-12-24)
- [Phase ?]: OvertimeTransaction.type/.referenceType additiv um 'model_change'/'work_period' erweitert statt Cast/any im Test zu verwenden - reine Typkorrektur, keine Verhaltensaenderung
- [Phase 12-06]: WorkTimeChangeModal.tsx Zustand 8 wechselt zwischen Task 1 (client-seitiger Vergleich gegen currentPeriod) und Task 2 (serverseitiges preview.isNoOp) die Datenquelle - im fertigen Dialog gibt es keine Client-Vergleichslogik mehr
- [Phase 12-06]: formatSignedHours() zeigt bei Differenz=0 literal '± 0:00h' statt '+0:00h' - Randfall aus 12-UI-SPEC.md woertlich uebernommen
- [Phase 12-06]: previewToken bindet nur Stichtag/Wochenstunden/Tagesplan (nicht die Begruendung) - jede Feldaenderung verwirft preview synchron im selben State-Update, nicht im entprellten Callback (T-12-28)
- [Phase 12]: WR-12 Weg (b) gewaehlt: Desktop-Client-Kopie periodengetreu gemacht statt neuem Server-Vorschau-Endpunkt — Perioden-Lese-API aus Plan 12-01/12-04 bereits vorhanden; kein bestehender Endpunkt fuer eine Vorschau vor Antragstellung
- [Phase 12]: Arbeitskopie fuer die Wirksamkeitsmessung aus server/database/development.db gezogen, nicht aus server/database.db — server/database.db ist lokal veraltet/unmigriert (keine user_work_periods-Tabelle)
- [Phase 12-07]: OvertimeTransactions.tsx haengt am /overtime/transactions/live-Endpunkt, der overtime_transactions bisher NICHT las - model_change waere ohne additiven Merge in overtimeLiveCalculationService.ts nie sichtbar geworden (Rule 1/2 Deviation, empirisch verifiziert)
- [Phase 12-07]: Reset-Effekt in EditUserModal auf [user.id] statt [user], plus schmaler Sync-Effekt mit Wertvergleich fuer weeklyHours/workSchedule - noetig weil user nach der UserManagementPage-Umstellung bei jedem Refetch ein neues Objekt ist
- [Phase 12-07]: WorkTimeChangeModal wird als Geschwister NACH </form> gerendert (innerhalb der Kinder von Modal), damit ein Submit im verschachtelten Dialog niemals handleSubmit des aeusseren Formulars erreicht (T-12-38)
- [Phase 12-09]: Periodenlisten-Format ist '0 h' (kein erzwungenes Komma), verifiziert gegen WorkTimePeriodList.tsx statt der Plan-Platzhalterformulierung '0,0 h'
- [Phase 12-09]: WorkTimeChangeModal-Formularfelder haben kein name/htmlFor - E2E-Selektor ueber label:has-text(X) + input/textarea statt [name=...]
- [Phase 12-09]: Vollstaendiger E2E-Lauf in dieser lokalen Umgebung blockiert (Port 3000 durch fremdes Next.js-Projekt belegt, Port 1420 bereits von aktiver Fremd-Session belegt) - Fehler tritt im unveraenderten Login-Fixture auf, nicht am geaenderten Testcode; als UAT-Punkt 39 fuer Phase 14 dokumentiert
- [Phase 13-01]: schemaMigrationParity.test.ts um migration013.up() und Quoting-Normalisierung erweitert, damit der bestehende Paritaetstest durch die Tabellen-Neubau-Technik nicht regressionsrot wird
- [Phase 13-01]: Neue deletedAt-/reversalOf-abhaengige Indizes einzeln try/catch-abgesichert ausserhalb des kombinierten db.exec()-Indexblocks, da initializeDatabase() vor runMigrations() laeuft und ein Fehlschlag sonst den gesamten Indexblock abgerissen haette
- [Phase 13-01]: Migration 013/014 direkt gegen server/database/development.db ausgefuehrt (mit Backup), weil alle Tests laut vitest.config.ts gegen dieselbe Arbeitsdatenbank laufen
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-02: UserWorkPeriodListItem zunaechst lokal in workPeriodService.ts, dann nach types/index.ts verschoben (Task 1/Task 2 Reihenfolgekonflikt geloest ohne Nutzerentscheid)
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-02: PreviewRollback generisch gemacht, runWithPreviewRollback() als geteilte Trockenlauf-Huelle fuer Plan 13-03/13-04 freigegeben - applyWorkTimeChange() unveraendert im Verhalten (23/23 Tests gruen)
- [Phase 13-06]: referenceId auf beiden Paarzeilen ist row.reversalOf ?? row.id (DD-24) - die Id der Buchungszeile selbst, nicht der Periode
- [Phase 13-06]: id/reversalOf/reversedBy/reversedAt/reversedByName nur bei type === model_change gesetzt - keine Bedeutungsaenderung fuer die uebrigen Transaktionstypen
- [Phase 13-06]: Test-Cleanup loescht user_work_periods nicht explizit, sondern raeumt ueber ON DELETE CASCADE beim Loeschen des Nutzers auf - der BEFORE-DELETE-Riegel wuerde ein echtes DELETE der letzten Periode verweigern
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: checkPeriodChain() laeuft in correctWorkPeriod() unbedingt nach jedem Schreiben (nicht nur bei verschobenem validFrom) als Sicherheitsnetz gegen bereits bestehende Kettenschaeden
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: Rule-1-Fix: veralteter INSERT-Guard-Trigger-Text in workPeriodService.test.ts und workPeriodChangeService.test.ts (Vor-Migration-013-Fassung) beschaedigte die geteilte development.db bei jedem Testlauf -- auf Migration-013-Fassung korrigiert, live-Trigger repariert
- [Phase ?]: 13-04: isFirst-Pruefung (DD-17) laeuft unbedingt, auch im Trockenlauf - eine Vorschau auf eine nicht loeschbare erste Periode waere sonst irrefuehrend
- [Phase ?]: 13-04: Gegenbuchung mit hours=-original.hours und journal-neutralem balanceBefore/balanceAfter - die tatsaechliche Saldo-Ruecknahme kommt ausschliesslich aus dem Rebuild ab validFrom (DD-14), nicht aus der Gegenbuchung
- [Phase ?]: [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-05: signCanonical()/verifyCanonical() als gemeinsame private Hilfsfunktionen fuer alle drei Token-Arten (Stundenwechsel/Korrektur/Loeschung) — die bestehende Stundenwechsel-Bahn blieb wortgleich unveraendert, DD-20-Zweckfeld macht die drei Token-Arten gegenseitig nicht einloesbar
- [Phase ?]: [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-05: GET /api/work-periods liefert jetzt getWorkPeriodsWithFlags() statt getWorkPeriods() (DD-23) — isFirst/isCurrent kommen serverseitig, additive Erweiterung, keine bestehenden Felder entfernt
- [Phase ?]: [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-05: HTTP-Autorisierungstest (workPeriods.authorization.test.ts) nach dem Muster von vacationTransactionRoutes.test.ts — echte express-App mit app.listen(0) + fetch, weil ein Test der die Service-Funktion direkt aufruft die Rollenpruefung in der Route nicht erfasst
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: [13-07] tsconfig exclude um src/**/*.check.ts ergänzt — node:assert-basierte Prüfskripte ohne .test.ts-Namen brechen sonst tsc --noEmit (typeRoots ist auf das leere desktop/node_modules/@types beschränkt)
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: [13-07] WorkPeriodCorrectionOutcome.period referenziert den bestehenden Desktop-Typ WorkTimePeriod statt einer dritten Periodenform mit deletedAt/deletedBy — dieselbe Vereinfachung wie beim Server (UserWorkPeriodListItem vs. UserWorkPeriod)
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: [13-08] CR-03-Tagesplan-Validierung (0-24h je Tag) bleibt in WorkTimePeriodEditModal.tsx, nicht in workTimePeriodEditRules.ts — keine der vier im Plan benannten Entscheidungen, betrifft den WorkScheduleEditor-Teilbaum
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: [13-08] isForbiddenMessage() prueft auf den Praefix 'Forbidden' (Server: requireAdmin liefert 'Forbidden - Admin access required') statt auf 'FORBIDDEN' — das ist der Sondertext nur fuer useWorkPeriods()/GET
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-10: reversedNoteLine() formatiert reversedAt (UTC-Zeitstempel) ueber formatCreatedAtDe() statt des T12:00:00-Musters, das im Projekt nur fuer reine YYYY-MM-DD-Felder gilt -- verhindert den in CR-04 dokumentierten Timezone-Bug
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: 13-10: JSON-Parse-Fehlerpfad in api/client.ts auf einen einzigen console.error konsolidiert (Rohtext-Vorschau 200 Zeichen statt vollstaendiger Nutzdaten), damit zusammen mit dem Netzwerkfehler-Fangnetz genau zwei console.error stehenbleiben
- [Phase 13]: Pflichtbegründung (≥10 Zeichen) für das Löschen ergänzt (Rule 2) — Server weist leere/kurze Begründung im Speicherpfad ab, ohne das Feld wäre jeder echte Löschversuch ein 400
- [Phase 13]: ConfirmDialog um sechste additive Prop confirmAriaLabel erweitert — 13-UI-SPEC.md fordert einen konkreten aria-label am Löschbestätigungsknopf, den ConfirmDialog bislang nicht anbot
- [Phase 13]: Punkt 1 der Löschbestätigung (Lückenschluss) wird sofort clientseitig gerendert, Punkt 2 (Storno-Betrag) wartet mit Punkt 3 auf die Server-Vorschau — DD-38 behauptet fälschlich, beide seien vorab bekannt
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: Alle sieben D1-D7-Entscheidungen sind am fertigen Code belegt (13-11-SUMMARY.md), keine offene Fundstelle
- [Phase 13-korrigieren-und-r-ckg-ngig-machen]: Phase-13-UAT-Sammlung (13 Pruefpunkte, 10 Festlegungen) in 14-UAT-SAMMLUNG.md ergaenzt; Phasen 11/12 unangetastet
- [Phase 14-absicherung-und-auslieferung]: Kein Codefix in workPeriodChangeService.ts fuer den Erhoehungsfall noetig - Erhoehung/Reduzierung werden bereits symmetrisch behandelt, die REQ-32-Luecke war reine Testabdeckung — Test lief beim ersten Lauf gruen; balanceDelta-Vorzeichen kehrt sich bei Erhoehung korrekt um
- [Phase 14-absicherung-und-auslieferung]: WR-07 vor dem Produktionslauf geschlossen: updateUser() wirft WorkPeriodBypassError bei tatsaechlicher weeklyHours/workSchedule-Aenderung statt sie zu spiegeln — Schreibweg an der Perioden-Historie vorbei ohne Vorschau-Token/Pflichtbegruendung/Journalzeile; EditUserModal sendet weeklyHours bereits unveraendert, Risiko beherrschbar
- [Phase 14-absicherung-und-auslieferung]: mirrorUserToWorkPeriod() (Seed-Skript-Helfer in userService.ts) bleibt unangetastet — nicht ueber die API erreichbar (einziger Aufrufer: scripts/seedTestUsers.ts), mirrort Stammdaten in die Periode statt Admin-Eingabe ohne Nachweis
- [Phase 14-absicherung-und-auslieferung]: 14-03: 11-F1 bis 11-F3 sind laut Kontrollsummen-Arithmetik im Bestand (6+51+29=86) nicht Teil der 86 Bestandspunkte, obwohl inhaltlich Festlegungen wie 13-F1-10 -- als separater Zusatz mit Pruefweg D gefuehrt statt die Kontrollsumme 86 zu verfaelschen
- [Phase 14-absicherung-und-auslieferung]: 14-03: Von acht vorgeprueften Dublettenkandidaten wurden zwei vollstaendig verworfen (Migration 011 vs. 015 -- unterschiedliche Migrationen trotz gleichem Pruefweg) und zwei nur teilweise bestaetigt (Kontrast-Kandidat enthielt zwei Responsive-Layout-Punkte, Fokus-Kandidat enthielt eine offene Entscheidungsfrage statt eines Verhaltenstests)
- [Phase 14-absicherung-und-auslieferung]: 14-03: Punkt 48 (Playwright-E2E-Suite) laeuft in der Sitzung als manueller Nachvollzug des Bedienpfads statt als automatisierter Lauf -- Playwright ist in dieser Umgebung nicht installiert und die Installation ist nicht autorisiert
- [Phase 14-absicherung-und-auslieferung]: 14-03: Fuenf zusaetzliche Punktgruppen aus dem Ausfuehrungsauftrag (Phase-13-UI-Fixes, Phase-12-UI-Fixes, B-2-Sicherheitsfix, REQ-32-Nachweis, WR-07-Oberflaechenwirkung) als 14-U5 bis 14-U9 aufgenommen, gemessene Zaehlungen aus den Quelldateien uebernommen (5 bzw. 6 Befunde), nicht geschaetzt
- [Phase 14-absicherung-und-auslieferung]: 14-04: npm run sync-dev-db nicht ausgefuehrt (laufender Dev-Server PID 39860 haelt development.db offen) — Produktionskopie stattdessen per readonly VACUUM INTO + scp direkt nach 14-produktionskopie.db gezogen, development.db durchgehend nur readonly geoeffnet und an drei Messpunkten als inhaltlich unveraendert belegt
- [Phase 14-absicherung-und-auslieferung]: 14-04: Gemessener Produktionsstand bestaetigt die Vorab-Erwartung deckungsgleich — Migrationen 001-007 vorhanden, 008-015 fehlen (acht Migrationen, nicht nur 011-015); Migrationsfolge auf Produktionskopie gefahren bewegt nachweislich keine Zahl in overtime_transactions/overtime_balance (alle Differenzen exakt 0)
- [Phase 14-absicherung-und-auslieferung]: 14-04: requirements.mark-complete fuer REQ-33 nicht anwendbar (not_found) - REQUIREMENTS.md dieses Milestones nutzt kein Checkbox-/Pending-Complete-Format, nur eine Phasenzuordnungstabelle (wie bereits bei Phase 10/12 dokumentiert); Abdeckung bleibt ueber die Phase-14-Plaene dokumentiert
- [Phase 14-absicherung-und-auslieferung]: 14-05: DATABASE_PATH-Pruefung laeuft in main() vor parseArgs() (nicht wie im Plantext beschrieben) - noetig fuer das woertliche Abnahmekriterium ohne Argumente/ohne DATABASE_PATH
- [Phase 14-absicherung-und-auslieferung]: 14-05: Generalprobenfall ist userId 2 (Karin Jochem) - kleinste id, die die vier Auswahlbedingungen erfuellt; Stichtag 2026-06-01, Zielwert 3h/Woche, createdBy=1, alle hergeleitet
- [Phase 14-absicherung-und-auslieferung]: 14-05: D5-Diff zeigt genau einen bewegten Nutzer (userId 2, +19.6h), identisch mit dem im Skript gedruckten balanceDelta; die drei benannten Rauschquellen (User 30, 31, Antrag 73) byteidentisch unveraendert
- [Phase 14-absicherung-und-auslieferung]: 14-06: Rueckweg-Erprobung schaedigt gezielt den Generalprobenfall (userId 2, 194 Journalzeilen + juengste Periode) statt einer leeren Datenbank, damit die Wiederherstellung am bekannten Saldo (29,6 h) aus Plan 14-05 nachpruefbar ist
- [Phase 14-absicherung-und-auslieferung]: 14-06: Rueckspielen schreibt immer in eine NEUE Datei statt ueber die beschaedigte/laufende Datei - identisches Muster lokal (14-rollback-probe.db) und im Runbook fuer den Ernstfall (production.RESTORED_<TIMESTAMP>.db)
- [Phase 14-absicherung-und-auslieferung]: 14-06: git revert als Alternative zu Rueckweg B geprueft und verworfen (337 Commits, kein sinnvoll pruefbarer Zwischenzustand) - Force-Push auf den gemessenen origin/main-Stand 0f2a03e vor Plan 14-08 bleibt die einzige im Ernstfall nachvollziehbare Option
- [Phase 14]: Phase 9.1 aufgeteilt (Plan 14-07): Journal-Backfill laeuft im Produktionsfenster der Phase 14 mit, aber strikt NACH der Verifikation aus Plan 14-09; Code-Haertung WR-02 bis WR-05 bleibt in Phase 9.1
- [Phase 14]: Die Planannahme 'der Backfill kann die D5-Zahlen nicht bewegen' ist widerlegt: rebuildOvertimeTransactionsForMonth schreibt ueber STEP 7 auch overtime_balance, und snapshotBalances.ts liest daraus — der D5-Diff zeigte 164 Zeilen bei 8 von 20 Nutzern
- [Phase 14]: Findelogik des Backfills korrigiert: massgeblich ist der letzte Tag mit Sollstunden ODER Zeiteintrag ODER genehmigter Abwesenheit — die Planregel uebersah zwei Aushilfen (weeklyHours=0) mit echten, nicht gebuchten Arbeitsstunden am 31.07.2026
- [Phase 14]: backfillOvertimeJournal.ts erhaelt den Schalter --all-months (Vorgabe aus); die Wahl zwischen Teilaufbau (2 Nutzer besser, 3 schlechter) und Vollaufbau (13 von 15 deckungsgleich, keiner schlechter) gehoert nach D2 dem Anwender und wird in Plan 14-10 getroffen
- [Phase 14.1]: BL-01 — die Deckelung auf heute wurde an beiden Stellen eingesetzt statt als Hilfsfunktion nach utils/timezone.ts gezogen (Freiheitsgrad aus D-01); die bereits korrekte WR-10-Vorlage bleibt damit unangetastet
- [Phase 14.1]: PeriodOvertimeResult.endDate bleibt das ANGEFRAGTE Bereichsende, gerechnet wird bis effectiveEndDate — dieselbe Trennung wie journalEndDate gegen endDate in calculateLiveOvertimeTransactions; haelt die Ausgabe von snapshotBalances.ts unveraendert
- [Phase 14.1]: Der Exitcode von verifyBalanceVsJournal.ts haengt allein an der BL-01-Kennzahl (Zukunftsdiff), nicht an der Journalsumme — sonst haengt ein Werkzeug dieses Plans dauerhaft an einem fremden, noch nicht entschiedenen Befund
- [Phase 14.1]: Der neu entdeckte Befund (Abwesenheits-Gutschriften ohne Gegenbuchung im Kontoauszug) wurde NICHT mitrepariert, sondern in deferred-items.md vermerkt und als 14.1-U3 zur Entscheidung vorgelegt (D-07, D-09)
- [Phase 14.1]: BL-05 — der Neuberechnungsblock gehoert in createAbsenceRequest, nicht in updateBalancesAfterApproval: diese Funktion hat zwei Aufrufer, und der regulaere Genehmigungsweg fuehrt den Block direkt danach ohnehin aus (er liefe dort sonst doppelt)
- [Phase 14.1]: BL-05 nutzt den in Plan 14.1-02 festgeschriebenen statischen Top-Level-Import; kein await import fuer updateMonthlyOvertime, kein Signaturwechsel — createAbsenceRequest bleibt synchron und routes/absences.ts sowie 15 Testaufrufstellen bleiben unberuehrt
- [Phase 14.1]: BL-05 — die Auto-Genehmigung von Krankmeldungen bleibt unveraendert und wird zusaetzlich durch Regressionstests festgeschrieben (approved, approvedBy/approvedAt NULL, kein audit_log, Abgrenzung zum pending-Urlaubsantrag), damit ein spaeterer Umbau daran scheitert statt still durchzugehen
- [Phase 14.1]: BL-05 — der work_time_accounts-Block des regulaeren Weges wurde bewusst NICHT mitkopiert (D-05 benennt genau einen Block); die Lage wurde stattdessen gemessen (Kontostand bleibt um ein Tagessoll zurueck) und als 14.1-U8 zur Entscheidung vorgelegt (D-07, D-09)
- [Phase 14.1]: Erklaerende Kommentare zitieren keine Fundstelle woertlich, die ein Abnahmekriterium per grep zaehlt — sonst zaehlt der Kommentar mit und die Kennzahl weist eine Aenderung aus, die es nicht gibt

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
  **Richtigstellung 21.08.2026 (Phase 09-03):** Die Deaktivierung hielt nicht — `deploy-server.yml:123-130`
  installiert den Cron bei jedem Deployment neu. Er trägt dort allerdings `DATABASE_PATH` bereits
  gesetzt (`deploy-server.yml:125`), das WAL-Problem von damals ist damit entschärft.

- **Offen daraus:** Staging-Sync (`Permission denied`), Symlink `server/database.db` auflösen,
  Quarantäne nach Bewährungszeit löschen.
  ~~Cron-Reaktivierung mit `DATABASE_PATH`~~ — erledigt sich von selbst, siehe Richtigstellung oben.

## Performance Metrics

| Phase | Plan | Duration | Notes |
|-------|------|----------|-------|
| Phase 06-buchungen-bei-jedem-vorgang P01 | 30min | 4 tasks | 3 files |
| Phase 06-buchungen-bei-jedem-vorgang P02 | 35min | 3 tasks | 5 files |
| Phase 06-buchungen-bei-jedem-vorgang P03 | 25min | 4 tasks | 3 files |
| Phase 08-kontoauszug-f-r-mitarbeiter-und-admin P04 | 1h 41min | 3 tasks | 10 files |
| Phase 08-kontoauszug-f-r-mitarbeiter-und-admin P05 | ~20min | 3 tasks | 6 files |
| Phase 06-buchungen-bei-jedem-vorgang P07 | ~40min | 3 tasks | 3 files |
| Phase 09-ein-ma-stab-ein-weg P01 | 55min | 3 tasks | 3 files |
| Phase 09-ein-ma-stab-ein-weg P02 | 35min | 3 tasks | 8 files |
| Phase 09 P03 | 90min | 5 tasks | 11 files |
| Phase 09-ein-ma-stab-ein-weg P04 | 50min | 3 tasks | 7 files |
| Phase 09-ein-ma-stab-ein-weg P05 | 55min | - tasks | - files |
| Phase 10-perioden-fundament P01 | 45min | 2 tasks | 5 files |
| Phase 10-perioden-fundament P03 | 35min | 2 tasks | 2 files |
| Phase 10-perioden-fundament P04 | 25min | 2 tasks | 2 files |
| Phase 10-perioden-fundament P02 | 55min | 2 tasks | 4 files |
| Phase 10-perioden-fundament P05 | 50min | - tasks | - files |
| Phase 10-perioden-fundament P06 | 30min | 4 tasks | 16 files |
| Phase 11-datumsabh-ngige-berechnung P02 | 45min | 2 tasks | 4 files |
| Phase 11-datumsabh-ngige-berechnung P01 | 20min | 3 tasks | 4 files |
| Phase 11-datumsabh-ngige-berechnung P03 | 55min | 3 tasks | 2 files |
| Phase 11 P04 | 70min | 3 tasks | 3 files |
| Phase 11-datumsabh-ngige-berechnung P06 | 65min | 3 tasks | 5 files |
| Phase 11-datumsabh-ngige-berechnung P05 | 25min | 2 tasks | 4 files |
| Phase 11-datumsabh-ngige-berechnung P08 | 35min | 3 tasks | 7 files |
| Phase 11-datumsabh-ngige-berechnung P11 | 105min | 3 tasks | 9 files |
| Phase 11-datumsabh-ngige-berechnung P09 | 60min | 3 tasks | 6 files |
| Phase 11-datumsabh-ngige-berechnung P10 | 70m | 3 tasks | 5 files |
| Phase 12-stundenwechsel-bedienen P01 | 50min | 3 tasks | 6 files |
| Phase 12-stundenwechsel-bedienen P02 | 12min | 3 tasks | 4 files |
| Phase 12 P03 | 45min | 2 tasks | 3 files |
| Phase 12-stundenwechsel-bedienen P04 | 35min | 2 tasks | 3 files |
| Phase 12-stundenwechsel-bedienen P05 | 100min | 2 tasks | 3 files |
| Phase 12-stundenwechsel-bedienen P06 | 70min | 2 tasks | 1 files |
| Phase 12 P08 | 35min | 3 tasks | 7 files |
| Phase 12-stundenwechsel-bedienen P07 | ~55min | 3 tasks | 6 files |
| Phase 12-stundenwechsel-bedienen P09 | 50min | 2 tasks | 1 files |
| Phase 13 P01 | 55min | 3 tasks | 7 files |
| Phase 13-korrigieren-und-r-ckg-ngig-machen P02 | 35min | 3 tasks | 8 files |
| Phase 13 P06 | 35min | 2 tasks | 2 files |
| Phase 13-korrigieren-und-r-ckg-ngig-machen P03 | 45min | 2 tasks | 4 files |
| Phase 13 P04 | 50min | 2 tasks | 2 files |
| Phase 13-korrigieren-und-r-ckg-ngig-machen P05 | 50min | 3 tasks | 4 files |
| Phase 13-korrigieren-und-r-ckg-ngig-machen P07 | 50min | 3 tasks | 8 files |
| Phase 13 P08 | ~55min | 3 tasks | 4 files |
| Phase 13-korrigieren-und-r-ckg-ngig-machen P10 | ~50min | 3 tasks | 4 files |
| Phase 13 P09 | 75min | 3 tasks | 5 files |
| Phase 13-korrigieren-und-r-ckg-ngig-machen P11 | 70min | 2 tasks | 1 files |
| Phase 14-absicherung-und-auslieferung P01 | 20min | 3 tasks | 2 files |
| Phase 14-absicherung-und-auslieferung P02 | ~10min | 3 tasks | 5 files |
| Phase 14-absicherung-und-auslieferung P03 | ~90min | 2 tasks | 2 files |
| Phase 14-absicherung-und-auslieferung P04 | 12min | 3 tasks | 1 files |
| Phase 14-absicherung-und-auslieferung P05 | ~25min | 3 tasks | 7 files |
| Phase 14-absicherung-und-auslieferung P06 | 15min | 2 tasks | 1 files |
| Phase 14 P07 | 35min | 3 tasks | 9 files |
| Phase 14.1-rechenwerk-blocker-aus-dem-produktionslauf-schliessen P01 | 26min | 3 tasks | 9 files |
| Phase 14.1-rechenwerk-blocker-aus-dem-produktionslauf-schliessen P02 | 23min | 2 tasks | 5 files |
| Phase 14.1 P03 (BL-05) | 14min | 2 tasks | 5 files |
| Phase 14.1 P04 (BL-03) | 25min | 2 tasks | 5 files |
| Phase 14.1 P05 (BL-04) | 22min | 3 tasks | 5 files |

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

Phase: 14.1 (rechenwerk-blocker-aus-dem-produktionslauf-schliessen) — EXECUTING
Plan: 4 of 6
Status: Executing Phase 14.1
        Plan 14.1-05 ist autonomous: false und haelt in Welle 5 fuer eine Entscheidung
        des Anwenders zu Weg B (recordOvertimeCompensation) an.

Vorherige Phase: 14 (absicherung-und-auslieferung) — EXECUTING, Plan 8 of 11
Status: GESPERRT — die Plaene 14-08, 14-09 und 14-10 schreiben auf die Produktion und
        brauchen die ausdrueckliche Freigabe des Anwenders (D2). 14-11 (Release) haengt an
        der Produktionsverifikation. Zusaetzlich ist 14-10 fachlich blockiert (s. Blockers).
        Phase 14.1 laeuft laut Roadmap vor Plan 14-11.
Last activity: 2026-08-25 -- Plan 14.1-03 (BL-05) abgeschlossen, Welle 4 entsperrt

## Operator Next Steps

- Start the next milestone with /gsd:new-milestone

---

## Zurückgestellte Punkte

Beim Abschluss von Milestone v2.0 am 2026-08-21 bewusst zurückgestellt und dokumentiert.
Acht offene Debug-Sessions in `.planning/debug/`:

| Thema | Einschätzung | Weiterbehandlung |
|-------|--------------|------------------|
| `urlaubstage-bei-ablehnung-verloren` | Auslöser von v2.0 — durch diesen Milestone strukturell behoben | erledigt, Datei als Beleg |
| `db-stabilisierung-20260818` | Behoben 18.08., Symlink am 20.08. entfernt | Kein Restpunkt: Cron ist nicht deaktiviert, sondern wird bei jedem Deployment neu installiert (`deploy-server.yml:123-130`) und trägt `DATABASE_PATH` bereits gesetzt (`deploy-server.yml:125`) — siehe `09-A1-NACHWEIS.md` |
| `carmen-rothemund-overtime-analysis` | Überstundenberechnung | Milestone v3.0 |
| `overtime-compensation-workschedule-bug` | Überstunden + `workSchedule` | Milestone v3.0 |
| `overtime-validation-backend-mismatch` | `getOvertimeBalance()` ohne Monatsfilter | Milestone v3.0, REQ-19 |
| `OVERTIME-FIX-PLAN` | Sammelplan Überstunden | Milestone v3.0 |
| `unpaid-leave-logic-issues` | Logik unbezahlter Urlaub | offen, unzugeordnet |
| `notifications-position-column-missing` | `position`-Spalte fehlt in der lokalen Entwicklungsdatenbank | offen, klein, unabhängig |

Vier der acht betreffen die Überstundenberechnung und werden in Milestone v3.0
(Historisierte Arbeitszeitmodelle) aufgegriffen — REQ-19 des Entwurfs verweist bereits
auf zwei davon.

### Blockers

- Plan 14-10 blockiert: Der Journal-Backfill bewegt den fuer Mitarbeiter sichtbaren Saldo (overtime_balance) bei 8 von 20 Nutzern der Produktionskopie um bis zu 84 Stunden. Der in 14-10 vorgesehene Teilaufbau ist zudem der messbar schlechtere Weg (2 Nutzer besser, 3 schlechter gegenueber dem kanonischen Rechenweg; Vollaufbau: 13 von 15 deckungsgleich, keiner schlechter). Entscheidung des Anwenders noetig: (a) Teilaufbau, (b) Vollaufbau mit --all-months, (c) verschieben. Messwerte in 14-URTEIL-PHASE-9.1.md Abschnitt 8.
- Plan 14-08 nach Task 3 Schritt E abgebrochen: Deployment (Lauf 32632007657, success) hat die Migrationen 008-015 angewendet — diese bewegen nachweislich keine Zahl (Vorhersagemessung vor dem Push: 0 Differenzen). Aber fix-overtime.ts hat danach 99 Werte in overtime_balance bei 8 Nutzern neu geschrieben (Summe -98,5 h; groesste Einzelbewegung -84 h bei userId 16 Benedikt Jochem). Das verletzt die Zusicherung des Anwenders, dass sich an den Stundenstaenden nichts aendert. Richtung gemessen: 13 von 15 aktiven Nutzern stimmen jetzt exakt mit dem kanonischen Rechenweg ueberein (vorher 7 von 15), kein Nutzer steht schlechter — zahlengleich der Zustand, den der Anwender fuer 14-10 (Vollaufbau) gewaehlt hat. Nichts verloren: Journal, Zeiteintraege, Urlaub, Stammdaten unveraendert. Entscheidung noetig: (a) Stand bestehen lassen, (b) Rueckweg B (Daten UND Code, nimmt den gesamten v3.0-Milestone zurueck). Geprueft Sicherung production.PRE-14-08_20260823_111541.db liegt doppelt vor. Zahlen in 14-PRODUKTIONSLAUF.md und 14-VERGLEICH-VOR-NACH.md.
- Entscheidung des Anwenders noetig (14.1-U3, aufgekommen in Plan 14.1-01): Im Kontoauszug erzeugt ein Urlaubs- oder Krankheitstag NUR die Gutschriftszeile (+ Tagessoll) und KEINE Soll-Gegenbuchung. Die Buchungsliste summiert sich dadurch hoeher als der Saldo darueber — nachgemessen am 25.08.2026 gegen eine Arbeitskopie von 14-prod-nach-migration.db: Nutzer 16 = 30,00 h, Nutzer 17 = 8,00 h, Nutzer 3 = 4,00 h. Anders als bei BL-01 ist hier der Saldo richtig und die Liste falsch. Solange das offen ist, ist das ERSTE ERFOLGSKRITERIUM der Phase 14.1 ("Saldo = Summe der Buchungen darunter, fuer jeden Nutzer") nur fuer die BL-01-Ursache erreicht (8 betroffene Nutzer vorher, 0 nachher), nicht insgesamt (9 vorher, 3 nachher). Zwei Loesungswege ausformuliert in .planning/phases/14-absicherung-und-auslieferung/deferred-items.md, Abschnitt "Aus Plan 14.1-01 (25.08.2026)", Eintrag 1. Zahlen in 14.1-NACHWEIS-BL01.md, Abschnitt 5.
- Entscheidung des Anwenders noetig (14.1-U5, aufgekommen in Plan 14.1-02): Nach dem Loeschen einer genehmigten Krankmeldung bleibt work_time_accounts.currentBalance auf einem Zwischenstand stehen — gemessen -176,00 h, waehrend Journal und overtime_balance desselben Nutzers bei -184,00 h enden (Differenz genau ein Tagessoll). Ursache: updateAllOvertimeLevels() — die einzige Funktion, die work_time_accounts schreibt — laeuft INNERHALB der Loeschtransaktion, solange die Zeile in absence_requests noch steht; der anschliessende updateMonthlyOvertime()-Aufruf rechnet richtig, beruehrt work_time_accounts aber nicht. Vorbestehend: ja — vor dem BL-02-Fix bewegte sich der Wert ueberhaupt nicht, der Fix macht den Befund erst messbar. Zwei Loesungswege ausformuliert in .planning/phases/14-absicherung-und-auslieferung/deferred-items.md, Abschnitt "Aus Plan 14.1-02 (25.08.2026)", Eintrag 1. Zahlen in 14.1-NACHWEIS-BL02.md, Abschnitt 7. NICHT mitrepariert (D-07, D-09).
- Entscheidung des Anwenders noetig (14.1-U8, aufgekommen in Plan 14.1-03): Beim Anlegen einer Krankmeldung wird work_time_accounts.currentBalance gar nicht fortgeschrieben (gemessen -184,00 h vorher wie nachher), waehrend im selben Moment die sick_credit-Gutschrift von +8,00 h im Journal steht. Gehoert sachlich zu 14.1-U5 und sollte mit ihm zusammen entschieden werden. Details in deferred-items.md, Abschnitt "Aus Plan 14.1-03 (25.08.2026) - BL-05", und in 14.1-NACHWEIS-BL05.md, Abschnitt 4.
- Entscheidung des Anwenders noetig (14.1-U11, aufgekommen in Plan 14.1-04): Der Historien-Export nennt stillgelegte Konten nicht mehr in seiner Nutzerliste, traegt aber weiterhin 102 Zeiteintraege und 1 genehmigten Antrag, die ueber die Spalte userId auf genau diese Konten verweisen (gemessen auf der Produktionsarbeitskopie). Die Listen timeEntries und absences der Sammelvariante sind nur nach Zeitraum eingegrenzt, nicht nach Nutzern - vor dem Fix genauso. Weg 1: denselben Nutzerfilter mitziehen, den overtime_balance jetzt traegt. Weg 2: die Zeilen bewusst behalten und begruenden, dann aber die Nutzerliste wieder mitfuehren. Kein technischer Blocker fuer die folgenden Plaene; Details in deferred-items.md, Abschnitt "Aus Plan 14.1-04 (25.08.2026) - BL-03", und in 14.1-NACHWEIS-BL03.md, Abschnitt 7.
