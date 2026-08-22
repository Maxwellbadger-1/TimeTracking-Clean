---
phase: 12-stundenwechsel-bedienen
plan: 01
subsystem: database
tags: [sqlite, better-sqlite3, express, typescript, migration, overtime-transactions]

# Dependency graph
requires:
  - phase: 10-perioden-fundament
    provides: user_work_periods Tabelle, workPeriodService.getWorkPeriods(userId)
  - phase: 11-datumsabh-ngige-berechnung
    provides: periodenbewusste Ueberstundenberechnung (workPeriodContext, createWorkPeriodContext)
provides:
  - "Buchungstyp 'model_change' und referenceType 'work_period' in overtime_transactions (Migration 011 + schema.ts, Parity gewahrt)"
  - "Vertragstypen WorkTimeChangeInput, WorkTimeChangePreview, WorkTimeChangePreviewResponse, WorkTimeChangeOutcome in server/src/types/index.ts"
  - "GET /api/work-periods mit Rollenpruefung (D6): Admin beliebige userId, Mitarbeiter nur eigene, sonst 403"
affects: [12-02, 12-03, 12-04, 12-05, 13-korrigieren-und-rueckgaengig-machen]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Tabellen-Neubau fuer CHECK-Constraint-Erweiterung auf SQLite (kein ALTER TABLE ... ADD CONSTRAINT) - Migration 006 woertlich als Vorlage"
    - "userId-Query-Param + Admin-vs-Eigenzugriff-Rollenpruefung fuer Lese-Routen (workTimeAccounts.ts, vacationTransactions.ts als Vorbild)"

key-files:
  created:
    - server/src/database/migrations/011_add_model_change_transaction_type.ts
    - server/src/routes/workPeriods.ts
  modified:
    - server/src/database/schema.ts
    - server/src/types/index.ts
    - server/src/services/overtimeTransactionManager.ts
    - server/src/server.ts

key-decisions:
  - "Migration 011 folgt Migration 006 wortgleich (Tabellen-Neubau, Zeilenzahlvergleich, DROP/RENAME, drei Indizes) statt eines eigenen Musters - eine Quelle fuer diese Technik im Projekt"
  - "referenceType-CHECK in Migration 011 traegt explizites NULL in der IN-Liste (wie Migration 006), schema.ts dagegen nicht (vorbestehende Asymmetrie, siehe Beobachtete Altlasten) - beide Formen sind fuer NULL-Werte aequivalent (SQLite wertet CHECK bei NULL nicht aus)"
  - "GET /api/work-periods legt in Plan 12-05 zwei weitere Endpunkte (POST /preview, POST /change) auf denselben Router - Kopfkommentar haelt fest, dass diese zusaetzlich requireAdmin brauchen (T-12-05)"

patterns-established:
  - "workPeriods.ts als gemeinsamer Router fuer Lesen (12-01) und Schreiben (12-05) von Arbeitszeitperioden"

requirements-completed: [REQ-26, REQ-29]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 12 Plan 01: Fundament — Buchungstyp, Vertragstypen, Perioden-Lese-API Summary

**Migration 011 erweitert overtime_transactions um den Buchungstyp `model_change` und den Referenztyp `work_period`, vier Vertragstypen (`WorkTimeChangeInput/Preview/PreviewResponse/Outcome`) stehen in `server/src/types/index.ts`, und `GET /api/work-periods` liefert Arbeitszeitperioden mit serverseitiger Rollenpruefung (D6).**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3 completed
- **Files modified:** 6 (2 neu, 4 geändert)

## Accomplishments
- `overtime_transactions.type` und `.referenceType` akzeptieren `'model_change'` bzw. `'work_period'` — Migration 011 UND `schema.ts` tragen denselben Constraint (Parity-Pflicht erfüllt, gegen eine Arbeitskopie der Entwicklungsdatenbank verifiziert)
- Vier exportierte Vertragstypen legen den Datenvertrag zwischen Server und Desktop fest, bevor irgendein Aufrufer gebaut wird (D2: Vorschau und Speichern teilen sich `WorkTimeChangePreview`)
- `GET /api/work-periods` ist erreichbar, rollengeprüft (D6) und live gegen den lokalen Dev-Server mit drei realen HTTP-Aufrufen verifiziert

## Task Commits

Each task was committed atomically:

1. **Task 1: Migration 011 und schema.ts auf den Buchungstyp model_change bringen** - `2f3b41e` (feat)
2. **Task 2: Vertragstypen fuer den Stundenwechsel festschreiben** - `566b7dc` (feat)
3. **Task 3: GET /api/work-periods — Perioden-Lese-API mit Rollenpruefung (D6)** - `a457c55` (feat)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified
- `server/src/database/migrations/011_add_model_change_transaction_type.ts` - Tabellen-Neubau von `overtime_transactions` mit erweiterten CHECK-Constraints (Migration-006-Muster)
- `server/src/database/schema.ts` - CREATE TABLE overtime_transactions trägt dieselben beiden CHECK-Erweiterungen (Parity)
- `server/src/types/index.ts` - `WorkTimeChangeInput`, `WorkTimeChangePreview`, `WorkTimeChangePreviewResponse`, `WorkTimeChangeOutcome` exportiert und dokumentiert
- `server/src/services/overtimeTransactionManager.ts` - `TransactionParams['type']` und `['referenceType']` um `'model_change'`/`'work_period'` erweitert
- `server/src/routes/workPeriods.ts` - neuer Router, `GET /` mit Rollenprüfung, delegiert an `getWorkPeriods(userId)`
- `server/src/server.ts` - Import + Registrierung `app.use('/api/work-periods', workPeriodsRoutes)` direkt nach `/api/work-time-accounts`

## Decisions Made
- Migration 011 wortgleich nach Migration 006 gebaut (keine eigene Technik erfunden) — reduziert das Risiko eines abweichenden Tabellen-Neubau-Musters im selben Projekt
- `referenceType`-CHECK in der Migration behält das explizite `NULL` aus Migration 006 bei; `schema.ts` bleibt bei seiner bestehenden Form ohne `NULL` — funktional identisch (SQLite überspringt CHECK-Auswertung bei NULL-Werten), keine Vereinheitlichung dieser Altlast vorgenommen (außerhalb des Plan-Scopes)
- Rollenprüfung in `workPeriods.ts` wortgleich zum Muster aus `workTimeAccounts.ts`/`vacationTransactions.ts` übernommen — kein neues Auth-Konzept

## Deviations from Plan

None — plan executed exactly as written. Eine Abweichung wurde bei der Verifikation beobachtet und dokumentiert (kein Codefehler, sondern eine literarisch nicht erfüllbare Zählvorschrift in der Plan-Acceptance-Criteria):

### Beobachtung (kein Auto-Fix nötig)

**Acceptance-Criterion "grep -c work_period schema.ts liefert genau 1" trifft nicht literal zu**
- **Gefunden während:** Task 1 Verifikation
- **Befund:** `grep -c "work_period"` zählt Zeilen, nicht Vorkommen, und `"work_period"` ist als Teilstring in `"user_work_periods"` enthalten (Tabellenname, Indizes) — dieser Name kommt in `schema.ts` bereits ~28-mal vor (Phase 10). Der tatsächliche Befund `grep -n "referenceType TEXT CHECK" server/src/database/schema.ts` zeigt zweifelsfrei: genau eine der beiden CHECK-Zeilen (Zeile 527, `overtime_transactions`) trägt jetzt `'work_period'`; die andere (Zeile 247, unverändert) nicht.
- **Bewertung:** Die fachliche Anforderung ("referenceType-CHECK bekommt work_period") ist erfüllt und exakt lokalisiert nachgewiesen. Die numerische Kriteriumsformulierung im Plan ist unabhängig von dieser Umsetzung fehlerhaft (kollidiert mit vorbestehendem Tabellennamen aus Phase 10). Kein Code geändert, keine Rule 1-4 angewendet — reine Verifikationsmethode korrigiert.

## Beobachtete Altlasten

- **`schema.ts` führt keine Spalten `balanceBefore`/`balanceAfter` im `CREATE TABLE overtime_transactions`, obwohl Migration 005 sie ergänzt hat.** Vorbestehend vor dieser Phase, bewusst NICHT behoben (Plan-Anweisung: "kein Aufräumfeldzug"). Eine frische Installation über `schema.ts` bekäme diese beiden Spalten nicht — betrifft nur den theoretischen Fall einer Neuinstallation ohne Migrationslauf; der reale Migrationspfad (`migrationRunner.ts`, bei jedem Serverstart) läuft immer über `runMigrations()` und trägt die Spalten korrekt seit Migration 005/006/011.
- **`referenceType`-CHECK-Format weicht zwischen Migration und `schema.ts` in der Behandlung von `NULL` ab** (Migration listet `NULL` explizit in der IN-Klausel, `schema.ts` nicht). Funktional folgenlos (SQLite CHECK-Constraints werden bei NULL-Spaltenwerten nicht ausgewertet), aber eine stilistische Inkonsistenz, die aus Migration 006 stammt und hier fortgeschrieben wurde, um die Parity-Pflicht nicht durch eine unbeauftragte Formatvereinheitlichung zu verletzen.

## UAT-Punkte für Phase 14

1. **Migration 011 auf der Produktionskopie:** Zeilenzahl `overtime_transactions` vor und nach dem Lauf muss identisch sein, `PRAGMA integrity_check` muss `ok` liefern. Lokal gegen eine Arbeitskopie der Entwicklungsdatenbank bereits verifiziert (1033 Zeilen vor/nach identisch, `integrity_check: ok`, `foreign_key_check` leer) — Produktionslauf selbst ist Teil von Phase 14 (D8).
2. **`GET /api/work-periods` mit einer echten Mitarbeiter-Session gegen eine fremde `userId`:** erwartet HTTP 403, keine Perioden im Antwortkörper. Lokal gegen den Dev-Server mit echten Sessions (KarinJochem, id 2, gegen fremde userId 17) verifiziert — Ergebnis exakt wie erwartet (`{"success":false,"error":"Forbidden"}`, HTTP 403). Produktions-Nachweis mit echten Nutzerpasswörtern ist Sache der Phase-14-Abnahme.

## Issues Encountered

- **Port 3000 lokal belegt.** Der für dieses Projekt übliche Dev-Server-Port (3000) war während der Ausführung von einem unabhängigen Next.js-Projekt (Stiftung DPolG Website) belegt. Für die Live-Verifikation von Task 3 wurde der TimeTracking-Server temporär auf Port 3099 gestartet (`PORT=3099 NODE_ENV=development npx tsx src/server.ts`, gegen `server/database/development.db`, keine Codeänderung). Nach Abschluss der drei Testaufrufe wieder beendet. Kein Rest-Prozess verblieben (verifiziert über `Get-NetTCPConnection` und `curl` nach dem Beenden).
- **Testnutzer-Anmeldedaten unbekannt.** Für die Live-HTTP-Verifikation wurden die bcrypt-Passwort-Hashes von drei Testnutzern (`admin` id 1, `KarinJochem` id 2, `CarmenRothemund` id 17) temporär auf ein bekanntes Testpasswort gesetzt, nach den drei Testaufrufen aus einer zuvor angelegten Sicherung wortgleich zurückgeschrieben und verifiziert (`passwordLooksHashed: true` für alle drei nach der Wiederherstellung). Ausschließlich gegen `server/database/development.db` (gitignored, lokale Entwicklungskopie) — keine Produktionsdatenbank berührt.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Fundament für Plan 12-02 bis 12-05 steht: Buchungstyp, Vertragstypen und Perioden-Lese-API sind vorhanden und verifiziert.
- `workPeriodChangeService.ts` (Plan 12-02/12-03) kann `TransactionParams.type = 'model_change'` und `referenceType = 'work_period'` typsicher verwenden.
- `WorkTimeChangeInput`/`WorkTimeChangePreview`/`WorkTimeChangeOutcome` liegen bereit für den Dry-Run-Mechanismus, den 12-PATTERNS.md als "kein Bestandsmuster — muss neu entworfen werden" kennzeichnet (Plan 12-03/12-04).
- Kein Blocker für die nächste Welle.

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle erstellten Dateien und alle drei Task-Commits (2f3b41e, 566b7dc, a457c55) wurden gegen die Arbeitskopie bzw. `git log --oneline --all` verifiziert.
