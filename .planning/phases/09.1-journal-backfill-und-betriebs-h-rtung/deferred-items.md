# Deferred Items — Phase 9.1

Funde außerhalb des Scopes der jeweiligen Pläne. Nicht behoben, nur dokumentiert.

## Plan 09.1-03

1. **`server/database/development.db` dieses Worktrees enthält 0 Zeilen in `holidays`**
   (gemessen per `SELECT COUNT(*) FROM holidays` — Ergebnis `0`). Dadurch schlagen 9
   zusätzliche, feiertagsabhängige Tests fehl, die über die vier bekannten Baseline-Fehler
   hinausgehen: `src/utils/workingDays.test.ts` (7 Fälle, u.a. „Heilige Drei Könige",
   „Neujahr überschreibt die Periode"), `src/services/overtimeLiveCalculationService.test.ts`
   („schließt einen Feiertag aus…") und ein Fall in
   `src/services/unifiedOvertimeService.test.ts` („ein Feiertag überschreibt das Soll
   weiterhin auf 0h"). `workingDays.test.ts:611` vermerkt selbst: „Note: These tests assume
   holidays are in database."
   **Ursache nicht dieser Plan:** Task 1 dieses Plans löscht ausschließlich 13 unreferenzierte
   Legacy-Skripte (`server/scripts/*.js`/`*.ts`), keines davon berührt die `holidays`-Tabelle
   oder deren Befüllung. `initializeHolidays()` läuft nur beim echten Serverstart
   (`server/src/server.ts`), nicht in Tests. Jede der drei parallel angelegten Worktree-Kopien
   von `development.db` hat eine eigene Dateigröße/Inode (gemessen: 512.000 / 2.035.712 /
   401.408 Bytes, drei verschiedene Inodes) — die Kopie dieses Worktrees wurde offenbar ohne
   je gepflegte Feiertagsdaten erstellt oder hat sie durch einen vorherigen Testlauf verloren,
   bevor dieser Plan zu laufen begann.
   **Nicht behoben:** Ein Nachfüllen der `holidays`-Tabelle wäre eine Datenmutation außerhalb
   des Aufgabenbereichs dieses Plans (`server/scripts/**` verschieben/löschen,
   `server/package.json` anpassen) und ist laut Vorgabe nicht Sache dieses Ausführers.
   **Empfehlung:** Vor der nächsten Phase, die sich auf `vitest run` als Regressionsnetz
   verlässt, `npm run <ein-holiday-seed-werkzeug>` oder einen echten Serverstart gegen jede
   Worktree-Kopie von `development.db` laufen lassen, um die Feiertagsdaten wiederherzustellen.

2. **`server/src/scripts/validateSchema.ts` — `EXPECTED_SCHEMA` ist gegenüber dem
   tatsächlichen Schema veraltet und meldet `npm run validate:schema` mit Exitcode 1**,
   obwohl das Werkzeug fehlerfrei lädt und einen vollständigen Bericht ausgibt (Task 3,
   Schritt 2). Gemessen: 8 von 20 Tabellen mit „Missing"/„Extra"-Abweichungen (u. a.
   `absence_requests` erwartet `approverId`, tatsächlich `approvedBy`; `overtime_balance`
   erwartet `overtime`/`carryover`/`balance`, tatsächlich `carryoverFromPreviousYear`;
   `time_entries` erwartet `projectId`/`activityId`, tatsächlich `startTime`/`endTime`/
   `activity`/`project`; 9 Tabellen ganz ohne Schemadefinition, darunter
   `user_work_periods` und `work_time_accounts` — beide erst nach v3.0 entstanden).
   **Ursache nicht dieser Plan:** `git show` auf den Verschiebungs-Commit dieses Plans zeigt
   an `validateSchema.ts` ausschließlich die Änderung der Importzeile
   (`'../src/config/database.js'` → `'../config/database.js'`) — der `EXPECTED_SCHEMA`-Block
   ist zeichengleich. Die Datei ist seit Migrationen/Perioden-Refactorings (Phasen 9–11)
   nicht nachgezogen worden.
   **Nicht behoben:** Eine Aktualisierung von `EXPECTED_SCHEMA` wäre eine inhaltliche
   Überarbeitung des Validierungswerkzeugs, keine Pfadkorrektur — außerhalb von D-09/D-11.
   Die Plan-Abnahme für diesen Schritt verlangt nur „läuft durch, kein
   Modulauflösungsfehler, Schemabericht in der Ausgabe" (nicht Exitcode 0) — das ist erfüllt.

## Plan 09.1-06

3. **`deploy-staging.yml` lässt `npm run migrate:prod` auf dem Green-Server gegen die
   falsche Datei laufen.** Gemessen beim Deployment auf `origin/staging` (Lauf `33234698132`,
   29.08.2026): Der Workflow-Schritt „Running database migrations" protokolliert
   `📁 Database: /home/ubuntu/TimeTracking-Green/server/database.db`, während die
   anschließende `validate:schema`-Prüfung und die Dateizeiger-Prüfung des laufenden
   PM2-Prozesses (`ls -l /proc/<pid>/fd`) übereinstimmend
   `/home/ubuntu/TimeTracking-Green/server/database/development.db` als tatsächlich vom
   Server offengehaltene Datenbank ausweisen — zwei verschiedene Dateien. `ls -la` bestätigt:
   `server/database.db` trägt den Zeitstempel 2. April, `development.db-wal`/`-shm` wurden
   exakt beim gemessenen Deployment (04:54 UTC) neu beschrieben.
   **Ursache nicht dieser Plan:** `git blame` auf die betroffene Zeile in `deploy-staging.yml`
   zeigt Commit `ab51e858` vom 2026-02-10 — acht Monate vor Phase 9.1. Der Aufruf setzt kein
   `DATABASE_PATH`; `src/scripts/migrate.ts` fällt im `prod`-Zweig auf
   `databaseConfig.productionPath` zurück (`server/src/config/database.ts:41-43`, hartkodiert
   auf `server/database.db`, unabhängig von `NODE_ENV`), während der laufende Serverprozess
   über `NODE_ENV=staging` und `getDatabasePath()` korrekt auf `development.db` zeigt. Auf
   Blue (Produktion) tritt dieser Mismatch nicht auf, da dort `DATABASE_PATH` in der
   PM2-Konfiguration immer explizit gesetzt ist und in `migrate.ts` Vorrang vor
   `productionPath` hat.
   **Auswirkung eingeordnet:** Kein Schaden, kein D-16-Verstoß (die berührte Datei ist nicht
   `production.db`), keine Auswirkung auf Produktion. Die tatsächlich wirksame
   Schema-Aktualisierung für Green geschieht unabhängig davon beim Serverstart über
   `runMigrations(db)` (`server/src/database/migrationRunner.ts`, aufgerufen aus
   `server.ts:217`) — im selben Deployment gemessen: 9 ausstehende TS-Migrationen wurden dort
   fehlerfrei gegen die reale `development.db` angewendet. Der `migrate:prod`-Schritt in
   `deploy-staging.yml` ist für Green faktisch wirkungslos, aber nicht schädlich.
   **Nicht behoben:** Eine Korrektur (z. B. `DATABASE_PATH` als Prefix vor `migrate:prod` in
   `deploy-staging.yml` ergänzen) wäre eine Änderung des Deployment-Workflows außerhalb des
   von Plan 09.1-06 vorgesehenen Umfangs (Auslieferung + Messung, keine Workflow-Änderung) und
   eine Architekturentscheidung über den vorgesehenen Umgang mit Green-Datenbanken.
   **Empfehlung:** Vor einer nächsten Nutzung von Green als aussagekräftiger
   Migrations-Nachweis `DATABASE_PATH=/home/ubuntu/TimeTracking-Green/server/database/development.db`
   explizit vor `npm run migrate:prod` in `deploy-staging.yml` setzen, oder den Schritt ganz
   entfernen, da `runMigrations(db)` beim Serverstart ohnehin greift.
