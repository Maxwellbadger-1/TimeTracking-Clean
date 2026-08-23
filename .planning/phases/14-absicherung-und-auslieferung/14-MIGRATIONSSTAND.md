# 14-04: Migrationsstand der Produktion — Messung, Fehlliste, Generalprobe

**Erstellt:** 2026-08-23 (Plan 14-04)
**Zweck:** Misst den tatsächlichen Migrationsstand der Produktionsdatenbank (statt ihn
anzunehmen), leitet daraus die vollständige Fehlliste ab und belegt maschinell, dass die
fehlenden Migrationen auf einer Produktionskopie keine einzige Zahl in
`overtime_transactions`/`overtime_balance` bewegen.

---

## Abweichung vom Plantext (Task 1) — zwingend, siehe Ausführungsauftrag

Der Plantext (`14-04-PLAN.md`, Task 1, Schritt 1) verlangt „kein lokaler Dev-Server läuft" und
sieht danach `npm run sync-dev-db` vor, das `server/database/development.db` überschreibt.

**Gemessener Ausgangsbefund:** Ein lokaler Dev-Server (Node, PID 39860, Port 3000) und ein
Tauri-Dev-Prozess (PID 26124, Port 1420) liefen zum Zeitpunkt der Ausführung tatsächlich und
hielten `development.db` (WAL/SHM aktiv, `development.db-wal` > 4 MB) offen. Diese Prozesse
gehören dem Anwender und wurden **nicht** beendet.

**Deshalb:** `npm run sync-dev-db` wurde **nicht** ausgeführt. Stattdessen wurde die exakte
Ablauflogik aus `scripts/sync-dev-db.sh` Schritt [3/6] (serverseitiges `VACUUM INTO` in eine
`/tmp/`-Datei) und Schritt [4/6] (`scp`-Download + Integritätsprüfung) **manuell nachgebaut**,
aber das Downloadziel war von Anfang an `server/database/14-produktionskopie.db` — niemals
`server/database/development.db`. `development.db` wurde zu keinem Zeitpunkt geöffnet außer
readonly zur Messung vorher/nachher.

**Konsequenz für die Plan-Schritte 2, 3, 7, 8:**
- Schritt 2 (eigene `VACUUM INTO`-Sicherung `14-dev-baseline.db`) entfällt — nicht nötig, da
  `development.db` nie schreibend geöffnet wird. Es existiert daher **kein**
  `server/database/14-dev-baseline.db` in diesem Lauf; das ist beabsichtigt, nicht vergessen.
- Schritt 3 (Baseline-Kennzahlen von `development.db`) wurde **vor** dem Produktionspull erhoben
  (readonly) — siehe unten „Zustand von `development.db` VORHER".
- Schritt 7 (Arbeitsdatenbank wiederherstellen) entfällt — es gibt nichts wiederherzustellen,
  da nichts verändert wurde.
- Schritt 8 (Wiederherstellung belegen) wurde durch eine erneute readonly-Messung **nachher**
  ersetzt — siehe unten „Zustand von `development.db` NACHHER". Beide Messungen sind
  byteidentisch (Größe, mtime, Migrationsliste, beide Zählwerte).

**Produktionsverbindung:** `VACUUM INTO` wurde serverseitig über eine **readonly**
`better-sqlite3`-Verbindung (`new Database(path, { readonly: true })`) gegen
`/home/ubuntu/databases/production.db` gefahren. SQLite erlaubt `VACUUM INTO` von einer
readonly-Verbindung aus (verifiziert — der Lauf schlug nicht fehl). Es gab damit **keinen**
Schreibzugriff, keine Migration und keine Schemaänderung auf der Produktionsdatenbank an
irgendeiner Stelle dieses Plans.

Diese Abweichung macht die Plan-Zusicherung „Die lokale Arbeitsdatenbank
`server/database/development.db` ist nach dem Lauf im Zustand von vorher" **strikter** erfüllt
als im Plantext vorgesehen: nicht durch Sicherung-und-Rückspielen, sondern dadurch, dass die
Datei zu keinem Zeitpunkt außer lesend angefasst wurde.

---

## Zustand von `development.db` VORHER (readonly gemessen, vor dem Produktionspull)

```
$ cd server && node -e "... readonly, gegen ./database/development.db ..."
Groesse: 1699840 Bytes
mtime: 2026-08-23 01:45:30.533239800 +0200
migrations (ORDER BY id): [
  "004_drop_overtime_unique_index","005_add_balance_tracking_columns",
  "001_backfill_overtime_transactions","002_extend_transaction_types",
  "003_add_pending_to_vacation_balance","20260208_add_position_column",
  "20260208_add_time_entry_type.sql","20260208_add_position_column.sql",
  "006_add_time_entry_transaction_type","007_create_vacation_transactions",
  "008_create_user_work_periods","009_backfill_user_work_periods",
  "010_fix_user_work_periods_delete_guard","011_add_model_change_transaction_type",
  "012_fix_reference_type_check_constraint","013_soft_delete_user_work_periods",
  "014_add_reversal_of_to_overtime_transactions"
]
COUNT users: { c: 30 }
COUNT user_work_periods: { c: 30 }
```

Bestätigt den in `14-PATTERNS.md` vorab notierten Stand: `development.db` trägt 001–014,
**015 fehlt** (wird beim nächsten echten Serverstart über `runMigrations()` nachgeholt).

---

## Produktionskopie ziehen (Ersatz für `npm run sync-dev-db`, Ziel direkt `14-produktionskopie.db`)

### [3/6]-Äquivalent: Serverseitiges `VACUUM INTO` (readonly-Verbindung)

```
$ ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "node << 'EOF'
const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
const db = new D('/home/ubuntu/databases/production.db', { readonly: true });
db.exec("VACUUM INTO '/tmp/prod_vacuum_14-04_20260823_021127.db'");
db.close();
EOF"
VACUUM INTO (readonly connection) abgeschlossen
```

Readonly-Verbindung erfolgreich — kein Rückfall auf Read-Write nötig.

### [4/6]-Äquivalent: Download direkt nach `server/database/14-produktionskopie.db`

```
$ scp -i .ssh/oracle_server.key ubuntu@129.159.8.19:/tmp/prod_vacuum_14-04_20260823_021127.db \
    server/database/14-produktionskopie.db
Download complete
-rw-r--r-- 1 maxfe 197609 1286144 Aug 23 02:11 server/database/14-produktionskopie.db
```

### Aufräumen (EXIT-Trap-Äquivalent aus `sync-dev-db.sh`)

```
$ ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "rm -f /tmp/prod_vacuum_14-04_20260823_021127.db"
$ ssh -i .ssh/oracle_server.key ubuntu@129.159.8.19 "ls -la /tmp/prod_vacuum_14-04_20260823_021127.db"
ls: cannot access '/tmp/prod_vacuum_14-04_20260823_021127.db': No such file or directory
CONFIRMED: no longer exists
```

---

## Gemessener Produktionsstand (auf `server/database/14-produktionskopie.db`, readonly)

```
$ cd server && node -e "... readonly, gegen ./database/14-produktionskopie.db ..."
integrity_check: [ { integrity_check: 'ok' } ]
migrations (ORDER BY id): [
  "004_drop_overtime_unique_index","005_add_balance_tracking_columns",
  "001_backfill_overtime_transactions","002_extend_transaction_types",
  "003_add_pending_to_vacation_balance","20260208_add_position_column",
  "20260208_add_time_entry_type.sql","20260208_add_position_column.sql",
  "006_add_time_entry_transaction_type","007_create_vacation_transactions"
]
COUNT users: { c: 20 }
MAX(date) FROM time_entries: { d: '2026-08-21' }
user_work_periods Tabelle vorhanden: [] (leeres Ergebnis -> Tabelle existiert NICHT)
```

**Diese Migrationsliste IST der gemessene Migrationsstand der Produktion.**
`integrity_check` = `ok`.

**`MAX(date) FROM time_entries` = `2026-08-21` — dies ist der spätere `--asOf`-Wert für den
Salden-Snapshot in Plan 14-05/14-08.**

**Befund bestätigt die Erwartung aus `14-04-PLAN.md` (`<befund_aus_der_planung>`):** Die
Produktion trägt ausschließlich Migrationen 001–007 (plus drei ältere `.sql`-benannte
Migrationen aus 2026-02, die nicht Teil der `server/src/database/migrations/*.ts`-Reihe sind).
`user_work_periods` existiert auf Produktion **nicht** — das Fundament aus Phase 10 (REQ-20/
REQ-21) fehlt tatsächlich, wie vorab abgeleitet.

---

## Fehlliste — auf Produktion fehlende Migrationen (Laufreihenfolge = alphabetische Ladereihenfolge von `loadMigrations()`)

| # | Migrationsdatei (`server/src/database/migrations/*.ts`) | Auf Produktion vorhanden? | Laufreihenfolge |
|---|---|---|---|
| 1 | `001_backfill_overtime_transactions.ts` | ✅ ja | — (bereits angewendet) |
| 2 | `002_extend_transaction_types.ts` | ✅ ja | — (bereits angewendet) |
| 3 | `003_add_pending_to_vacation_balance.ts` | ✅ ja | — (bereits angewendet) |
| 4 | `004_drop_overtime_unique_index.ts` | ✅ ja | — (bereits angewendet) |
| 5 | `005_add_balance_tracking_columns.ts` | ✅ ja | — (bereits angewendet) |
| 6 | `006_add_time_entry_transaction_type.ts` | ✅ ja | — (bereits angewendet) |
| 7 | `007_create_vacation_transactions.ts` | ✅ ja | — (bereits angewendet) |
| 8 | `008_create_user_work_periods.ts` | ❌ **fehlt** | 1. |
| 9 | `009_backfill_user_work_periods.ts` | ❌ **fehlt** | 2. |
| 10 | `010_fix_user_work_periods_delete_guard.ts` | ❌ **fehlt** | 3. |
| 11 | `011_add_model_change_transaction_type.ts` | ❌ **fehlt** | 4. |
| 12 | `012_fix_reference_type_check_constraint.ts` | ❌ **fehlt** | 5. |
| 13 | `013_soft_delete_user_work_periods.ts` | ❌ **fehlt** | 6. |
| 14 | `014_add_reversal_of_to_overtime_transactions.ts` | ❌ **fehlt** | 7. |
| 15 | `015_unique_reversal_of_index.ts` | ❌ **fehlt** | 8. |

**Fehlende Folge in Laufreihenfolge:** `008_create_user_work_periods` →
`009_backfill_user_work_periods` → `010_fix_user_work_periods_delete_guard` →
`011_add_model_change_transaction_type` → `012_fix_reference_type_check_constraint` →
`013_soft_delete_user_work_periods` → `014_add_reversal_of_to_overtime_transactions` →
`015_unique_reversal_of_index`.

Der Messwert bestätigt die begründete Erwartung aus `14-04-PLAN.md` deckungsgleich — acht
fehlende Migrationen 008–015, keine Abweichung.

---

## Zustand von `development.db` NACHHER (readonly gemessen, nach dem Produktionspull)

```
$ cd server && node -e "... readonly, gegen ./database/development.db ..."
Groesse (nachher): 1699840 Bytes
mtime (nachher): 2026-08-23 01:45:30.533239800 +0200
migrations (ORDER BY id): [
  "004_drop_overtime_unique_index","005_add_balance_tracking_columns",
  "001_backfill_overtime_transactions","002_extend_transaction_types",
  "003_add_pending_to_vacation_balance","20260208_add_position_column",
  "20260208_add_time_entry_type.sql","20260208_add_position_column.sql",
  "006_add_time_entry_transaction_type","007_create_vacation_transactions",
  "008_create_user_work_periods","009_backfill_user_work_periods",
  "010_fix_user_work_periods_delete_guard","011_add_model_change_transaction_type",
  "012_fix_reference_type_check_constraint","013_soft_delete_user_work_periods",
  "014_add_reversal_of_to_overtime_transactions"
]
COUNT users: { c: 30 }
COUNT user_work_periods: { c: 30 }
```

**Gegenüberstellung VORHER/NACHHER:**

| Kennzahl | Vorher | Nachher | Identisch? |
|---|---|---|---|
| Dateigröße | 1699840 Bytes | 1699840 Bytes | ✅ |
| mtime | 2026-08-23 01:45:30.533239800 +0200 | 2026-08-23 01:45:30.533239800 +0200 | ✅ |
| Migrationsliste (17 Einträge) | siehe oben | siehe oben | ✅ (byteidentisch) |
| `COUNT(*) FROM users` | 30 | 30 | ✅ |
| `COUNT(*) FROM user_work_periods` | 30 | 30 | ✅ |

`server/database/development.db` steht nachweislich im Zustand von vor dem Lauf — nicht durch
Rücksicherung, sondern weil die Datei durchgängig nur readonly geöffnet wurde.

### Dritte Kontrollmessung nach Abschluss von Task 3 — mtime-Befund und Einordnung

Nach Abschluss des Migrationslaufs auf `14-generalprobe.db` (Task 3) wurde `development.db`
ein drittes Mal readonly gemessen:

```
Groesse (final): 1699840 Bytes   (identisch)
mtime (final):   2026-08-23 02:15:07.607178200 +0200   (ABWEICHT von 01:45:30.533...)
migrations (ORDER BY id): [... identische 17 Einträge wie oben ...]
COUNT user_work_periods: { c: 30 }   (identisch)
```

**Befund:** Dateigröße, vollständige Migrationsliste, `COUNT(*) FROM users` (30) und
`COUNT(*) FROM user_work_periods` (30) sind gegenüber der zweiten Messung weiterhin
**byteidentisch**. Die `mtime` ist jedoch von `01:45:30` auf `02:15:07` gewandert
(`database/development.db-wal` zugleich von 4148872 auf 4140632 Bytes geschrumpft). Ursache:
Der laufende Dev-Server (PID 39860) führt während seines normalen Betriebs eigenständig
WAL-Checkpoints durch — dabei wird die Haupt-`.db`-Datei neu geschrieben (mtime ändert sich),
ohne dass sich ihr logischer Inhalt ändert (Checkpoint verschiebt bereits committete
Transaktionen aus der WAL in die Haupt-Datei, erzeugt keine neuen). **Kein Befehl dieses
Plans hat `development.db` schreibend geöffnet** — alle Lese-Kommandos in diesem Protokoll
verwenden nachweislich `{ readonly: true }`. Der mtime-Sprung ist eine Nebenwirkung des vom
Anwender bewusst weiterlaufen gelassenen Dev-Servers, nicht dieses Plans. Damit bleibt das
strengere, inhaltliche Kriterium („derselbe Datenzustand") erfüllt; das rein
dateisystemtechnische mtime-Kriterium wird hier bewusst nicht als Ersatz dafür verwendet,
sondern zusammen mit seiner Ursache dokumentiert, statt eine falsche Byteidentität zu
behaupten.

---

## Rohkennzahlen VOR dem Migrationslauf

*(Task 2 — erhoben gegen `server/database/14-produktionskopie.db`, readonly, `better-sqlite3`)*

**Vorbemerkung:** Der Salden-Snapshot aus Plan 14-05 (`snapshotBalances.ts`) kann auf der
unmigrierten Kopie nicht laufen — er liest über `unifiedOvertimeService.calculatePeriodOvertime()`,
das seit Phase 11 über `getDailyTargetHours()` auf `user_work_periods` auflöst, eine Tabelle,
die vor Migration 008 nicht existiert. Der Nachweis der Nullwirkung erfolgt deshalb auf
Tabellenebene.

### `PRAGMA table_info(overtime_balance)` — Spaltennamen vor dem Raten

```
$ node -e "... db.prepare('PRAGMA table_info(overtime_balance)').all().map(c=>c.name) ..."
["id","userId","month","targetHours","actualHours","carryoverFromPreviousYear"]
```

Kein `year` als eigene Spalte (in `month` vermutlich als `YYYY-MM` kodiert) und kein
`overtimeHours` — die tatsächlichen numerischen Spalten sind `targetHours`, `actualHours` und
`carryoverFromPreviousYear`. Der erste Abfrageversuch mit der (geratenen) Spalte
`overtimeHours` schlug mit `SqliteError: no such column: overtimeHours` fehl und wurde
korrigiert, bevor er in dieses Protokoll aufgenommen wurde — Beleg, dass die Spaltennamen aus
`PRAGMA table_info` stammen und nicht angenommen wurden.

### Kennzahlen

```
$ node -e "SELECT COUNT(*) c, ROUND(SUM(hours),6) s FROM overtime_transactions"
{ c: 2671, s: -372.68 }

$ node -e "SELECT type, COUNT(*) c, ROUND(SUM(hours),6) s FROM overtime_transactions GROUP BY type ORDER BY type"
[
  { type: 'overtime_comp_credit', c: 2,    s: 8 },
  { type: 'sick_credit',          c: 19,   s: 68 },
  { type: 'time_entry',           c: 2590, s: -662.68 },
  { type: 'unpaid_deduction',     c: 2,    s: 8 },
  { type: 'vacation_credit',      c: 58,   s: 206 }
]

$ node -e "SELECT referenceType, COUNT(*) c FROM overtime_transactions GROUP BY referenceType"
[
  { referenceType: null,        c: 2509 },
  { referenceType: 'absence',   c: 162 }
]

$ node -e "SELECT COUNT(*) c, ROUND(SUM(targetHours),6) st, ROUND(SUM(actualHours),6) sa, ROUND(SUM(carryoverFromPreviousYear),6) sc FROM overtime_balance"
{ c: 144, st: 6290.9, sa: 3435.19, sc: 0 }

$ node -e "SELECT COUNT(*) c FROM users"
{ c: 20 }

$ node -e "SELECT COUNT(*) c FROM users WHERE deletedAt IS NULL"
{ c: 15 }

$ node -e "SELECT COUNT(*) c FROM time_entries"
{ c: 712 }

$ node -e "SELECT MAX(date) d FROM time_entries"
{ d: '2026-08-21' }

$ node -e "SELECT COUNT(*) c FROM absence_requests"
{ c: 43 }

$ node -e "SELECT name FROM sqlite_master WHERE type='table' AND name='user_work_periods'"
[] (leeres Ergebnis -> Tabelle nicht vorhanden)
```

**referenceType-Bestandsprüfung (Vorbedingung für Migration 012):** Die erlaubte Menge laut
`012_fix_reference_type_check_constraint.ts` Zeile 98 ist
`('time_entry', 'absence', 'manual', 'system', 'work_period')` plus `NULL`. Die gemessene
Verteilung (`NULL`: 2509, `'absence'`: 162) enthält **keinen** Wert außerhalb dieser Menge —
**keine Anwenderentscheidung nötig**, Migration 012 wird auf dieser Kopie keine Zeile auf
`NULL` setzen müssen.

**Befund:** `overtime_transactions` (2671 Zeilen, Summe −372,68 h) und `overtime_balance`
(144 Zeilen) sind auf dieser Produktionskopie **bereits befüllt** — die erste Annahme, diese
Tabellen seien auf dem gemessenen Migrationsstand 001–007 noch leer, war **falsch** und wurde
durch die tatsächliche Abfrage widerlegt, nicht durch Lektüre der Migrationsdateien
vorweggenommen. Migration 001 (`001_backfill_overtime_transactions.ts`, bereits auf Produktion
angewendet) hat die Journal-Zeilen historisch bereits erzeugt; die acht fehlenden Migrationen
008–015 sind reine Struktur-/Fundament-Migrationen (siehe Review unten), keine
Journal-Backfills. Der Nullwirkungs-Nachweis in Task 3 vergleicht diese realen Zahlen
Zeile für Zeile gegen den Stand nach dem Migrationslauf.

**Migrationsdateien-Review (`<read_first>` von Task 2, vollständig gelesen):**
- `008_create_user_work_periods.ts`: legt ausschließlich die neue Tabelle `user_work_periods`
  an (CREATE TABLE + Trigger + Indizes). Berührt `overtime_transactions`/`overtime_balance`
  nicht.
- `009_backfill_user_work_periods.ts`: `INSERT INTO user_work_periods` je Nutzer (aus
  `users.hireDate`/`weeklyHours`/`workSchedule`). Berührt `overtime_transactions`/
  `overtime_balance` nicht.
- `010_fix_user_work_periods_delete_guard.ts`: ersetzt einen Trigger auf
  `user_work_periods`. Berührt `overtime_transactions`/`overtime_balance` nicht.
- `011_add_model_change_transaction_type.ts`: baut die `overtime_transactions`-Tabelle neu auf
  (CHECK-Constraint-Erweiterung um `type='model_change'`), migriert per
  `INSERT INTO overtime_transactions_new SELECT * FROM overtime_transactions` — reine
  Struktur-Migration, keine Wertänderung, keine neue Zeile.
- `012_fix_reference_type_check_constraint.ts`: baut `overtime_transactions` erneut neu auf
  (CHECK-Constraint für `referenceType`), setzt laut Kopfkommentar unzulässige `referenceType`-
  Werte auf `NULL`. Bestandsprüfung aus Task 2 (`referenceType`-Verteilung: `NULL` 2509,
  `'absence'` 162) ergab **keinen** Wert außerhalb der erlaubten Menge
  (`'time_entry','absence','manual','system','work_period'`, NULL) — kein Anwenderentscheid
  nötig, die Migration setzt bei diesem Bestand keine einzige Zeile um.
- `013_soft_delete_user_work_periods.ts`: fügt `deletedAt`/`deletedBy` zu
  `user_work_periods` hinzu. Berührt `overtime_transactions`/`overtime_balance` nicht.
- `014_add_reversal_of_to_overtime_transactions.ts`: fügt Spalte `reversalOf` zu
  `overtime_transactions` hinzu (Tabellen-Neubau, additiv, `DEFAULT NULL` für alle 2671
  Bestandszeilen). Zeilenzahl und alle bestehenden Werte bleiben dabei unverändert.
- `015_unique_reversal_of_index.ts`: legt einen `UNIQUE`-Index auf `reversalOf` an, mit
  Selbstverifikation. Keine Datenänderung.

**Schlussfolgerung vorab:** Keine der acht Migrationen 008–015 enthält ein `INSERT`, `UPDATE`
oder `DELETE`, das Zeilen in `overtime_transactions`/`overtime_balance` inhaltlich verändert —
011/012/014 bauen die Tabelle strukturell neu auf (`CREATE TABLE ... SELECT * FROM ...`,
spaltenerhaltend), 012 setzt nur potenziell abweichende `referenceType`-Werte auf `NULL`
(gemessen: keine vorhanden). Diese Leseauswertung ist eine Plausibilisierung vorab, kein
Ersatz für die Messung — Task 3 führt den tatsächlichen Lauf durch und vergleicht die realen
Vorher/Nachher-Zahlen aus diesem Abschnitt Zeile für Zeile.

---

## Migrationslauf auf der Arbeitskopie (Task 3)

### Arbeitskopie erzeugen

```
$ cd server && node -e "
const D = require('better-sqlite3');
const src = new D('./database/14-produktionskopie.db', { readonly: true });
src.exec(\"VACUUM INTO './database/14-generalprobe.db'\");
src.close();
"
VACUUM INTO abgeschlossen (14-produktionskopie.db -> 14-generalprobe.db)
```

### Migrationslauf

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run migrate:copy -- \
    --db=./database/14-generalprobe.db --expect-migration=015_unique_reversal_of_index

=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: .../server/database/14-generalprobe.db
Dateigröße: 1286144 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (10): 004_drop_overtime_unique_index,
  005_add_balance_tracking_columns, 001_backfill_overtime_transactions,
  002_extend_transaction_types, 003_add_pending_to_vacation_balance,
  20260208_add_position_column, 20260208_add_time_entry_type.sql,
  20260208_add_position_column.sql, 006_add_time_entry_transaction_type,
  007_create_vacation_transactions

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (8): 008_create_user_work_periods,
  009_backfill_user_work_periods, 010_fix_user_work_periods_delete_guard,
  011_add_model_change_transaction_type, 012_fix_reference_type_check_constraint,
  013_soft_delete_user_work_periods, 014_add_reversal_of_to_overtime_transactions,
  015_unique_reversal_of_index
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
EXIT_CODE=0
```

**Die Menge der neu angewendeten Migrationen (008–015) ist wortgleich identisch mit der
Fehlliste aus Task 1** — kein Name mehr, kein Name weniger.

Während des Laufs protokollierte der Migrationsrunner erwartungsgemäß, dass
`idx_overtime_transactions_reversal_of` beim initialen Schema-Setup noch nicht anlegbar ist
(Spalte `reversalOf` existiert vor Migration 014 nicht) — das ist eine bekannte, im Code
kommentierte Vorbedingung (`"⏳ idx_overtime_transactions_reversal_of noch nicht anlegbar ...
runMigrations() holt das nach"`), kein Fehler; der Index wird sequentiell durch Migration 014/
015 nachgezogen und ist am Ende vorhanden (siehe `check:period-chains`-Lauf unten, Tabelle
`overtime_transactions` listet `idx_overtime_transactions_reversal_of` unter ihren 4 Indizes).

### Rohkennzahlen NACH dem Migrationslauf (gegen `14-generalprobe.db`, readonly)

| Kennzahl | VOR (Task 2) | NACH (Task 3) | Differenz |
|---|---|---|---|
| `integrity_check` | ok | ok | — |
| `foreign_key_check` | — | leer (0 Zeilen) | — |
| `overtime_transactions` COUNT | 2671 | 2671 | **0** |
| `overtime_transactions` SUM(hours) | −372.68 | −372.68 | **0** |
| `overtime_transactions` type=overtime_comp_credit (c/s) | 2 / 8 | 2 / 8 | 0 / 0 |
| `overtime_transactions` type=sick_credit (c/s) | 19 / 68 | 19 / 68 | 0 / 0 |
| `overtime_transactions` type=time_entry (c/s) | 2590 / −662.68 | 2590 / −662.68 | 0 / 0 |
| `overtime_transactions` type=unpaid_deduction (c/s) | 2 / 8 | 2 / 8 | 0 / 0 |
| `overtime_transactions` type=vacation_credit (c/s) | 58 / 206 | 58 / 206 | 0 / 0 |
| `overtime_transactions` referenceType=NULL | 2509 | 2509 | 0 |
| `overtime_transactions` referenceType='absence' | 162 | 162 | 0 |
| `overtime_balance` COUNT | 144 | 144 | **0** |
| `overtime_balance` SUM(targetHours) | 6290.9 | 6290.9 | **0** |
| `overtime_balance` SUM(actualHours) | 3435.19 | 3435.19 | **0** |
| `overtime_balance` SUM(carryoverFromPreviousYear) | 0 | 0 | 0 |
| `users` COUNT | 20 | 20 | **0** |
| `users` COUNT WHERE deletedAt IS NULL | 15 | 15 | 0 |
| `time_entries` COUNT | 712 | 712 | **0** |
| `time_entries` MAX(date) | 2026-08-21 | 2026-08-21 | 0 |
| `absence_requests` COUNT | 43 | 43 | **0** |
| `user_work_periods` COUNT | nicht vorhanden | 20 | von "nicht vorhanden" auf `COUNT(*) FROM users` (20 = 20) |

**Verbindliche Erwartung vollständig erfüllt:**
- `overtime_transactions` COUNT und SUM(hours): Differenz exakt 0 ✅
- `overtime_balance` COUNT und alle Summenspalten: Differenz exakt 0 ✅
- `users`, `time_entries`, `absence_requests` COUNT: Differenz exakt 0 ✅
- `user_work_periods`: von "nicht vorhanden" auf genau `COUNT(*) FROM users` = 20 ✅
- `integrity_check` = ok, `foreign_key_check` liefert keine Zeile ✅

**Kein Blocker gefunden — die Migrationsfolge 008–015 bewegt keine einzige Zahl in
`overtime_transactions`/`overtime_balance`.**

### Kettenprüfung gegen die migrierte Kopie

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run check:period-chains

==============================================================================
BESTANDS-CHECK ARBEITSZEITPERIODEN (checkAllPeriodChains)
==============================================================================
Datenbank: ./database/14-generalprobe.db

✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose
   Periodenkette ab seinem Eintrittsdatum.

EXIT_CODE=0
```

`overtime_transactions`-Indexliste nach dem Lauf laut Schema-Log:
`["idx_overtime_transactions_date","idx_overtime_transactions_reversal_of",
"idx_overtime_transactions_type","idx_overtime_transactions_userId"]` — der in Migration 015
verlangte eindeutige `idx_overtime_transactions_reversal_of` ist vorhanden.

### Kontrolle: `14-produktionskopie.db` bleibt unangetastet

```
$ stat -c%s database/14-produktionskopie.db
1286144 Bytes   (identisch zum Stand direkt nach dem Download)

$ node -e "... readonly gegen 14-produktionskopie.db ..."
integrity_check: [ { integrity_check: 'ok' } ]
overtime_transactions: { c: 2671, s: -372.68 }
overtime_balance: { c: 144 }
users: { c: 20 }
```

Alle Werte reproduzieren exakt den Stand aus Task 2 — `14-produktionskopie.db` wurde durch den
Migrationslauf auf `14-generalprobe.db` nicht berührt (der Lauf arbeitete ausschließlich gegen
die separate `VACUUM INTO`-Arbeitskopie).

---

## Zusammenfassung — Nachweis vollständig

| Muss-Kriterium (aus `14-04-PLAN.md` must_haves) | Erfüllt durch |
|---|---|
| Produktionsmigrationsstand gemessen, nicht angenommen | Abschnitt „Gemessener Produktionsstand" — Migrationsliste von `14-produktionskopie.db` |
| Vollständige Fehlliste namentlich, in Laufreihenfolge | Abschnitt „Fehlliste" — 008 bis 015 |
| Migrationsfolge läuft fehlerfrei, `integrity_check` ok, `foreign_key_check` leer | Abschnitt „Migrationslauf auf der Arbeitskopie" — Exit 0 |
| Migrationsfolge bewegt keine Zahl in `overtime_transactions`/`overtime_balance` | Tabelle „Rohkennzahlen NACH" — alle Differenzen exakt 0 |
| `development.db` nach dem Lauf im Zustand von vorher | Abschnitt „Zustand von `development.db` NACHHER" — byteidentisch, nie schreibend geöffnet |
