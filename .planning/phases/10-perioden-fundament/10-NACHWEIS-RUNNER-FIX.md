# Nachweis: Migrationsläufer-Fix (CR-01) und DELETE-Riegel-Nachrüstung (WR-01) gegen eine frische Kopie

**Erstellt:** 2026-08-22 (Plan 10-06, Task 4)
**Zweck:** Belegt mit wörtlicher Konsolenausgabe, dass der reparierte `migrationRunner.ts`
(CR-01) und die nachgerüstete Migration 010 (WR-01) gegen echte Daten in der Ausgangslage
laufen, die Phase 14 in Produktion vorfindet — nicht nur gegen Testfixtures. Zusätzlich:
Nachweis, dass die Testsuite nach Task 1–3 keine neue Regression zeigt.

Kein Produktionszugriff, keine Arbeit an `server/database/development.db` (der Dev-Server
hält sie offen) — beide Kopien entstehen ausschließlich per `VACUUM INTO` aus bereits
vorhandenen, unangetasteten Dateien.

---

## Ausgangslage

Geprüfte Migrationsstände der verfügbaren Kopien (`migrations`-Tabelle ausgelesen):

| Datei | angewendete Migrationen | `user_work_periods` |
|---|---|---|
| `backups/database-backup-2026-08-21T00-00-00-046Z.db` | 001–007 | nein |
| `server/database/10-02-migrationslauf.db` | 001–009 | ja (alter, löchriger DELETE-Trigger) |

`backups/database-backup-2026-08-21T00-00-00-046Z.db` trägt 001–007, aber weder 008 noch
009 — genau die Ausgangslage, die Phase 14 in Produktion vorfindet. Migration 001 läuft dort
nicht erneut (bereits verbucht), der Nachweis unten prüft also exakt die Phase-14-relevanten
Migrationen 008/009/010.

```
$ node -e "... SELECT name FROM migrations ORDER BY id ..." (backups/database-backup-2026-08-21T00-00-00-046Z.db)
migrations: [
  '004_drop_overtime_unique_index',
  '005_add_balance_tracking_columns',
  '001_backfill_overtime_transactions',
  '002_extend_transaction_types',
  '003_add_pending_to_vacation_balance',
  '20260208_add_position_column',
  '20260208_add_time_entry_type.sql',
  '20260208_add_position_column.sql',
  '006_add_time_entry_transaction_type',
  '007_create_vacation_transactions'
]
user_work_periods table exists: false
```

```
$ node -e "... SELECT name FROM migrations ORDER BY id ..." (server/database/10-02-migrationslauf.db)
migrations: [
  '004_drop_overtime_unique_index', '005_add_balance_tracking_columns',
  '001_backfill_overtime_transactions', '002_extend_transaction_types',
  '003_add_pending_to_vacation_balance', '20260208_add_position_column',
  '20260208_add_time_entry_type.sql', '20260208_add_position_column.sql',
  '006_add_time_entry_transaction_type', '007_create_vacation_transactions',
  '008_create_user_work_periods', '009_backfill_user_work_periods'
]
```

Trigger vor dem Lauf gegen `10-02-migrationslauf.db` (belegt: der alte, löchrige Riegel ohne
WR-01-Klausel ist dort tatsächlich verbucht):

```
$ node -e "... trg_user_work_periods_delete_guard aus sqlite_master lesen ..."
vorher enthaelt ohne jede Periode: false
erste 3 userIds: [ { id: 1 }, { id: 2 }, { id: 3 } ]
```

---

## Schritt 1: Kopie für den Runner-Fix (CR-01) ziehen

```
$ node -e "const db = new Database('../backups/database-backup-2026-08-21T00-00-00-046Z.db', {readonly:true}); db.exec(\"VACUUM INTO './database/10-06-runnerfix.db'\");"
VACUUM INTO abgeschlossen.
```

```
$ ls -la database/10-06-runnerfix.db
-rw-r--r-- 1 maxfe 197609 1286144 Aug 22 06:51 database/10-06-runnerfix.db
```

`VACUUM INTO` statt Dateikopie — dieselbe Begründung wie in `10-NULLWIRKUNG-NACHWEIS.md`
(WAL-Inhalt einer offen gehaltenen Quelle wäre bei einer reinen Dateikopie sonst nicht
enthalten; hier zusätzlich schlicht die sauberste Art, aus einer readonly geöffneten Quelle
eine unabhängige Kopie zu ziehen, ohne die Quelle zu berühren).

---

## Schritt 2: erster Migrationslauf (008, 009, 010 neu)

```
$ npm run migrate:copy -- --db=./database/10-06-runnerfix.db --expect-migration=009_backfill_user_work_periods

> server@0.1.2 migrate:copy
> tsx src/scripts/applyMigrationsToCopy.ts --db=./database/10-06-runnerfix.db --expect-migration=009_backfill_user_work_periods

=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: <repo>\server\database\10-06-runnerfix.db
Dateigröße: 1286144 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (10): 004_drop_overtime_unique_index, 005_add_balance_tracking_columns,
  001_backfill_overtime_transactions, 002_extend_transaction_types, 003_add_pending_to_vacation_balance,
  20260208_add_position_column, 20260208_add_time_entry_type.sql, 20260208_add_position_column.sql,
  006_add_time_entry_transaction_type, 007_create_vacation_transactions

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (3): 008_create_user_work_periods, 009_backfill_user_work_periods, 010_fix_user_work_periods_delete_guard
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
```

Auszug aus dem parallel mitgeschriebenen `logger`-Protokoll (bestätigt den reparierten
Läufer in Aktion — je Migration erst `up()`, dann die Selbstverifikation, dann `recordMigration`):

```
{"msg":"⏳ Running migration: 008_create_user_work_periods"}
{"msg":"🚀 Migration 008: Creating user_work_periods (Arbeitszeit-Perioden)..."}
{"columns":9,"indexes":3,"triggers":3,"rows":0,"msg":"✅ Migration 008 verified: user_work_periods ready (0 Zeilen geschrieben, users unangetastet)"}
{"msg":"✅ Migration completed: 008_create_user_work_periods"}
{"msg":"⏳ Running migration: 009_backfill_user_work_periods"}
{"msg":"🚀 Migration 009: Backfilling user_work_periods (Bestandsüberführung)..."}
{"inserted":20,"skipped":0,"fallbacks":0,"msg":"✅ Migration 009 verified: 20 Periode(n) eingefügt, 0 Nutzer bereits versorgt übersprungen, users unangetastet"}
{"msg":"✅ Migration completed: 009_backfill_user_work_periods"}
{"msg":"⏳ Running migration: 010_fix_user_work_periods_delete_guard"}
{"msg":"🚀 Migration 010: Nachrüstung des korrigierten DELETE-Riegels auf user_work_periods..."}
{"msg":"🗑️  Dropping trg_user_work_periods_delete_guard..."}
{"msg":"📝 Recreating trg_user_work_periods_delete_guard..."}
{"msg":"✅ Migration 010 verified: trg_user_work_periods_delete_guard trägt den WR-01-Riegel"}
{"msg":"✅ Migration completed: 010_fix_user_work_periods_delete_guard"}
{"msg":"✅ All migrations completed successfully"}
```

**Beobachtung (kein Fund dieses Plans, dokumentiert für Transparenz):** `loadMigrations()`
importiert per `import(pathToFileURL(...))` sämtliche Dateien im Migrationsverzeichnis,
darunter `001_backfill_overtime_transactions.ts`, die statisch `overtimeService.js` importiert,
welches wiederum statisch `../database/connection.js` importiert. Dieser Import öffnet beim
Laden `server/database/development.db` und ruft `initializeDatabase()` darauf auf (sichtbar an
den zusätzlichen Log-Zeilen "📁 Database path" mit Pfad auf `development.db` und
"UnifiedOvertimeService initialized"). Das ist bereits seit Migration 001 (Milestone v2.0) so
und nicht durch diesen Plan verändert — Migration 001 wird in diesem Plan nicht angefasst
(Task-1-Abnahmekriterium: `grep -c "await"` unverändert). Da `initializeDatabase()`
ausschließlich `CREATE TABLE/INDEX IF NOT EXISTS` verwendet, bleibt der Effekt auf einer
bereits vollständig initialisierten `development.db` folgenlos — es werden keine neuen Objekte
angelegt und keine Zeile geschrieben. Außerhalb des Scopes dieses Plans (Rule: nur Befunde
direkt verursacht durch diesen Plan werden behoben); in `deferred-items.md` nicht gesondert
aufgenommen, da kein neuer Fund, sondern eine bereits vor Phase 10 bestehende Eigenschaft von
Migration 001, die auch `10-NULLWIRKUNG-NACHWEIS.md` (Plan 10-05) beim gleichen Werkzeug nicht
gesondert vermerkt hat.

---

## Schritt 3: zweiter Lauf gegen dieselbe Kopie (Idempotenz, D7)

```
$ npm run migrate:copy -- --db=./database/10-06-runnerfix.db --expect-migration=009_backfill_user_work_periods

=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: <repo>\server\database\10-06-runnerfix.db
Dateigröße: 1306624 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (13): 004_drop_overtime_unique_index, 005_add_balance_tracking_columns,
  001_backfill_overtime_transactions, 002_extend_transaction_types, 003_add_pending_to_vacation_balance,
  20260208_add_position_column, 20260208_add_time_entry_type.sql, 20260208_add_position_column.sql,
  006_add_time_entry_transaction_type, 007_create_vacation_transactions, 008_create_user_work_periods,
  009_backfill_user_work_periods, 010_fix_user_work_periods_delete_guard

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (0): (keine)
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
```

Zweiter Lauf: `(keine)` neu angewendete Migrationen, Exit 0 — Idempotenz über den reparierten
Läufer belegt (D7).

---

## Schritt 4: Migration 010 auf einer bereits mit 008/009 migrierten Datenbank

Kopie aus `server/database/10-02-migrationslauf.db` (trägt bereits 008/009, den alten
löchrigen Trigger — siehe Ausgangslage oben):

```
$ node -e "const db = new Database('./database/10-02-migrationslauf.db', {readonly:true}); db.exec(\"VACUUM INTO './database/10-06-triggerfix.db'\");"
VACUUM INTO abgeschlossen.

$ ls -la database/10-06-triggerfix.db
-rw-r--r-- 1 maxfe 197609 1306624 Aug 22 06:52 database/10-06-triggerfix.db
```

```
$ npm run migrate:copy -- --db=./database/10-06-triggerfix.db --expect-migration=010_fix_user_work_periods_delete_guard

=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: <repo>\server\database\10-06-triggerfix.db
Dateigröße: 1306624 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (12): 004_drop_overtime_unique_index, 005_add_balance_tracking_columns,
  001_backfill_overtime_transactions, 002_extend_transaction_types, 003_add_pending_to_vacation_balance,
  20260208_add_position_column, 20260208_add_time_entry_type.sql, 20260208_add_position_column.sql,
  006_add_time_entry_transaction_type, 007_create_vacation_transactions, 008_create_user_work_periods,
  009_backfill_user_work_periods

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (1): 010_fix_user_work_periods_delete_guard
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
```

**Trigger-Quelltext nach Migration 010, aus `sqlite_master` ausgelesen:**

```
$ node -e "... SELECT sql FROM sqlite_master WHERE type='trigger' AND name='trg_user_work_periods_delete_guard' ..."
=== Trigger-SQL nach Migration 010 ===
CREATE TRIGGER trg_user_work_periods_delete_guard
      BEFORE DELETE ON user_work_periods
      BEGIN
        SELECT RAISE(ABORT, 'user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen')
        WHERE EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
          AND NOT EXISTS (
            SELECT 1 FROM user_work_periods p
            WHERE p.userId = OLD.userId AND p.id <> OLD.id
          );
        SELECT RAISE(ABORT, 'user_work_periods: Löschen würde eine Lücke in der Periodenkette hinterlassen')
        WHERE OLD.validTo IS NOT NULL
          AND EXISTS (SELECT 1 FROM users u WHERE u.id = OLD.userId)
          AND EXISTS (SELECT 1 FROM user_work_periods p
                      WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.validTo = OLD.validFrom)
          AND EXISTS (SELECT 1 FROM user_work_periods p
                      WHERE p.userId = OLD.userId AND p.id <> OLD.id AND p.validFrom = OLD.validTo);
      END

enthaelt ohne jede Periode: true
```

**Echter DELETE-Versuch gegen die einzige Periode eines real vorhandenen Nutzers** (`userId=1`,
Bestandsdaten aus der Kopie, kein Testfixture):

```
Bestehende Periode Nutzer 1: {"id":1,"userId":1,"validFrom":"2025-11-13","validTo":null}
Abgewiesen mit Meldung: user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen
```

Der alte, vor Migration 010 auf dieser Kopie verbuchte Trigger hätte diesen `DELETE` klaglos
durchgelassen (siehe „Ausgangslage" oben — WR-01 aus `10-REVIEW.md`). Nach Migration 010 wird
er mit der wörtlichen WR-01-Meldung abgewiesen — derselbe Beleg-Stil wie beim
Überlappungsversuch in `10-NULLWIRKUNG-NACHWEIS.md` Schritt 7.

---

## Schritt 5: vollständige Testsuite, Vorher/Nachher

| | Ausgangsstand (10-REVIEW.md) | Nach Task 1–3 (dieser Plan) |
|---|---|---|
| Tests gesamt | 302 | 314 |
| grün | 299 | 311 |
| rot | 3 | 3 |

Die drei roten Tests sind namentlich dieselben wie zuvor (unverändert, kein vierter kommt
hinzu):

```
FAIL src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > should respect hire date and not include pre-employment months
FAIL src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly
FAIL src/services/vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill

 Test Files  2 failed | 22 passed (24)
      Tests  3 failed | 311 passed (314)
```

Die Steigerung von 302 auf 314 Tests (+12) verteilt sich auf drei neue Dateien aus diesem
Plan:

| Datei | neue Tests |
|---|---|
| `server/src/database/migrationRunner.failure.test.ts` (Task 1, neu) | 5 |
| `server/src/scripts/productionGuard.test.ts` (Task 3, neu) | 5 |
| `server/src/database/userWorkPeriods.constraints.test.ts` (Task 2, geändert: 1 Testfall umgekehrt, 2 neue Testfälle ergänzt) | +2 netto |

5 + 5 + 2 = 12, deckt sich mit 314 − 302.

---

## Schritt 6: `npx tsc --noEmit`

```
$ cd server && npx tsc --noEmit
(keine Ausgabe — Exit 0)
```

---

## Schritt 7: Aufräumen der Arbeitskopien

```
$ rm -f database/10-06-runnerfix.db database/10-06-runnerfix.db-wal database/10-06-runnerfix.db-shm \
        database/10-06-triggerfix.db database/10-06-triggerfix.db-wal database/10-06-triggerfix.db-shm
beide Arbeitskopien geloescht
```

**Ausgangssicherung unverändert** (Größe und Änderungsdatum vor und nach dem gesamten
Nachweis identisch):

| | vor dem Nachweis | nach dem Nachweis |
|---|---|---|
| Größe | 1339392 Bytes | 1339392 Bytes |
| Modify | 2026-08-21 02:00:00 | 2026-08-21 02:00:00 |

```
$ ls -la backups/database-backup-2026-08-21T00-00-00-046Z.db
-rw-r--r-- 1 maxfe 197609 1339392 Aug 21 02:00 backups/database-backup-2026-08-21T00-00-00-046Z.db
$ stat backups/database-backup-2026-08-21T00-00-00-046Z.db | grep Modify
Modify: 2026-08-21 02:00:00.049018100 +0200
```

Kein Zugriff auf `/home/ubuntu/databases/production.db`, kein Lauf mit `NODE_ENV=production`
an irgendeiner Stelle dieses Nachweises.

---

## Tabelle: Abnahmekriterien Task 4

| Kriterium | Urteil | Fundstelle |
|---|---|---|
| Schritt 2 zeigt 008/009/010 neu angewendet, integrity_check ok, foreign_key_check leer, Exit 0 | ✅ erfüllt | Schritt 2 |
| Schritt 3 zeigt „(keine)" neu angewendete Migrationen, Exit 0 | ✅ erfüllt | Schritt 3 |
| Schritt 4 zeigt die Abbruchmeldung „ohne jede Periode" aus einem echten DELETE-Versuch gegen echte Daten | ✅ erfüllt | Schritt 4 |
| Schritt 5 weist 299/302 Ausgangstests nach, dieselben drei Fehlschläge, kein vierter | ✅ erfüllt (311/314, +12 neue Tests aus Task 1–3, dieselben drei Namen) | Schritt 5 |
| Beide Arbeitskopien existieren nach Abschluss nicht mehr, Ausgangssicherung unverändert | ✅ erfüllt | Schritt 7 |
| Kein Produktionszugriff, kein NODE_ENV=production-Lauf | ✅ erfüllt | gesamter Nachweis |
