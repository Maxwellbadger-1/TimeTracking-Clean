# Nullwirkungs-Nachweis: Migration 008/009 auf einer Kopie der Produktionsdaten

**Erstellt:** 2026-08-22 (Plan 10-05, Task 2)
**Zweck:** Belegt mit wörtlicher Vorher/Nachher-Ausgabe, dass die Salden aller Nutzer vor
und nach der Migration (Tabelle `user_work_periods`, Bestandsüberführung) Byte für Byte
identisch sind (D6, REQ-21), und dass die Migration auf einer echten Kopie der
Produktionsdaten sauber durchläuft (ROADMAP-Erfolgskriterien 1–4).

---

## Ausgangslage

- Quelle: `server/database/development.db`, Stand 20.08.2026 (letzter `time_entries.date` =
  `2026-08-20`), 20 Nutzer — die in dieser Phase zulässige „Kopie der Produktionsdatenbank"
  (10-CONTEXT.md, `measured_facts`).
- Kopie für diesen Nachweis: `server/database/10-nullwirkung.db` (nicht committet, `*.db` in
  `.gitignore`).
- `asOf` für beide Snapshots: `2026-08-20` — ein festes Datum, der letzte Kalendertag mit
  Zeiteinträgen im Bestand, kein Rückfall auf „heute" (Task-1-Pflichtargument).

### Befund vor Schritt 1: `development.db` enthält Migration 008/009 bereits

Gemessen vor dem ersten Schritt: `server/database/development.db` hat die Migrationen
`008_create_user_work_periods` und `009_backfill_user_work_periods` bereits angewendet
(20 Zeilen in `user_work_periods`). Ursache: Der lokale Dev-Server wendet neue
Migrationsdateien bei jedem Start automatisch an (`server.ts:210`), und die parallel
gelaufenen Pläne 10-01/10-03 haben diese Migrationen bereits vor diesem Plan zusammengeführt
— exakt derselbe, bereits in `10-02-SUMMARY.md` dokumentierte Zustand („Migration 009 aus dem
parallel laufenden Plan 10-03 war zum Zeitpunkt des Migrationslaufs bereits in
`server/database/development.db` zusammengeführt").

**Auto-fix (Rule 3 — blockierendes Problem):** Eine `VACUUM INTO`-Kopie von
`development.db` hätte die Migration deshalb nicht mehr „durchlaufen" — `runMigrations()`
überspringt bereits in der `migrations`-Tabelle verzeichnete Namen vollständig
(`migrationRunner.ts:44-46`), ohne die Protokollzeilen der Migration 009 erneut zu erzeugen.
Ohne Gegenmaßnahme wäre Schritt 4 unten ein Leerlauf gewesen (0 neu angewendete Migrationen)
und hätte weder die vom Plan geforderten Protokollzeilen noch einen echten „läuft durch"-Beweis
geliefert. Wie bereits in Plan 10-02 (dortige „Zusatzverifikation") wird die Kopie deshalb vor
Schritt 2 auf den Stand **vor** Migration 008 zurückgesetzt: `DROP TABLE user_work_periods` plus
`DELETE FROM migrations WHERE name IN ('008_create_user_work_periods',
'009_backfill_user_work_periods')`. Das betrifft ausschließlich die private Kopie
`10-nullwirkung.db`, nicht `development.db` — die geteilte Arbeitsdatenbank bleibt unangetastet.

```
$ node -e "... db.exec('DROP TABLE IF EXISTS user_work_periods'); db.prepare(\"DELETE FROM migrations WHERE name IN (...)\").run(); ..."
gelöschte migrations-Zeilen: 2
migrations danach: [ 004_drop_overtime_unique_index, 005_add_balance_tracking_columns,
  001_backfill_overtime_transactions, 002_extend_transaction_types,
  003_add_pending_to_vacation_balance, 20260208_add_position_column,
  20260208_add_time_entry_type.sql, 20260208_add_position_column.sql,
  006_add_time_entry_transaction_type, 007_create_vacation_transactions ]
user_work_periods existiert noch: false
integrity_check: [{"integrity_check":"ok"}]
```

---

## Schritt 1: Kopie ziehen

```
$ node -e "const db = new Database('./database/development.db', {readonly:true}); db.exec(\"VACUUM INTO './database/10-nullwirkung.db'\");"
VACUUM INTO abgeschlossen.
```

Ausgangszustand der Kopie (nach dem oben beschriebenen Rücksetzen auf den Vor-008-Stand):

```
Dateigröße: 1306624 Bytes
Nutzerzahl: 20
integrity_check: [{"integrity_check":"ok"}]
letzter time_entries.date: 2026-08-20
```

`VACUUM INTO` statt Dateikopie, weil der lokale Dev-Server `development.db` offen hält und der
WAL-Inhalt bei einer reinen Dateikopie sonst fehlen würde (Befund aus Phase 9,
10-05-PLAN.md).

---

## Schritt 2: Snapshot A (vor der Migration)

```
$ DATABASE_PATH=./database/10-nullwirkung.db npm run snapshot:balances -- --all --asOf=2026-08-20 --json=.planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.json
=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\10-nullwirkung.db
Dateigröße: 1306624 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 0
asOf: 2026-08-20

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
Vollständige Datei geschrieben: .planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.json
Vergleichsdatei (nur users-Array) geschrieben: .planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.users.json

ERGEBNIS: Snapshot erhoben (Exit 0).
```

`user_work_periods: 0` bestätigt den Vor-Migrations-Zustand. Das Abnahmekriterium aus Task 1
(Zeilenzahl `users` ungefiltert = Länge `users[]` im Snapshot) ist erfüllt: beide 20, die
Population enthält damit auch die zwei soft-gelöschten Nutzer (`userId` 15 und 26).

---

## Schritt 3: Snapshot A′ — Eigenprobe des Werkzeugs (Nebenwirkungsfreiheit)

Derselbe Befehl ein zweites Mal, gegen dieselbe (noch unmigrierte) Kopie, in eine
Wegwerfdatei:

```
$ DATABASE_PATH=./database/10-nullwirkung.db npm run snapshot:balances -- --all --asOf=2026-08-20 --json=<scratch>/10-snapshot-a-prime.json
=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\10-nullwirkung.db
Dateigröße: 1306624 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 0
asOf: 2026-08-20
ERGEBNIS: Snapshot erhoben (Exit 0).

$ cmp 10-SNAPSHOT-VORHER.users.json <scratch>/10-snapshot-a-prime.users.json && echo IDENTISCH
IDENTISCH
```

**Ergebnis:** Byte-identisch. Erst damit ist belegt, dass `snapshotBalances.ts` selbst
nebenwirkungsfrei ist — der anschließende Vorher/Nachher-Vergleich (Schritt 6) ist deshalb
aussagekräftig und nicht bloß Zufall eines stabilen Laufs.

---

## Schritt 4: Migration

```
$ npm run migrate:copy -- --db=./database/10-nullwirkung.db --expect-migration=009_backfill_user_work_periods
=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: <repo>\server\database\10-nullwirkung.db
Dateigröße: 1306624 Bytes
Nutzerzahl (users): 20
PRAGMA foreign_keys: 1
Bereits angewendete Migrationen (10): 004_drop_overtime_unique_index, 005_add_balance_tracking_columns,
  001_backfill_overtime_transactions, 002_extend_transaction_types, 003_add_pending_to_vacation_balance,
  20260208_add_position_column, 20260208_add_time_entry_type.sql, 20260208_add_position_column.sql,
  006_add_time_entry_transaction_type, 007_create_vacation_transactions

=== applyMigrationsToCopy: nach dem Lauf ===
Neu angewendete Migrationen (2): 008_create_user_work_periods, 009_backfill_user_work_periods
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen

ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
```

Protokollzeilen der Migration 009 (Quelle je überführter Periode, aus der `note`-Spalte
ausgelesen):

```
$ node -e "... SELECT note, COUNT(*) c FROM user_work_periods GROUP BY note ..."
[ { note: '[MIGRATION-009] Bestandsüberführung, Quelle: hireDate', c: 20 } ]
```

Alle 20 Nutzer wurden über `hireDate` überführt — kein Nutzer löste den Ersatzdatum-Zweig aus
(deckt sich mit dem in `10-03-SUMMARY.md` dokumentierten Befund: der Ersatzdatum-Zweig wird auf
dem aktuellen Produktionsbestand voraussichtlich nie betreten, ist aber gebaut und getestet).

---

## Schritt 5: Snapshot B (nach der Migration)

```
$ DATABASE_PATH=./database/10-nullwirkung.db npm run snapshot:balances -- --all --asOf=2026-08-20 --json=.planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.json
=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\10-nullwirkung.db
Dateigröße: 1306624 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 20
asOf: 2026-08-20

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
Vollständige Datei geschrieben: .planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.json
Vergleichsdatei (nur users-Array) geschrieben: .planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.users.json

ERGEBNIS: Snapshot erhoben (Exit 0).
```

`user_work_periods: 20` bestätigt, dass diesmal — anders als in Schritt 3 — die Datengrundlage
sich tatsächlich verändert hat (die neue Tabelle ist befüllt). Der folgende Vergleich in
Schritt 6 ist deshalb ein echter Vorher/Nachher-Vergleich, kein Vergleich zweier identischer
Zustände.

---

## Schritt 6: Vergleich

```
$ cmp .planning/phases/10-perioden-fundament/10-SNAPSHOT-VORHER.users.json .planning/phases/10-perioden-fundament/10-SNAPSHOT-NACHHER.users.json && echo IDENTISCH
IDENTISCH
```

Beide Dateien: 44785 Bytes, 1966 Zeilen, 20 Nutzer. **Byte für Byte identisch**, obwohl
`user_work_periods` zwischen den beiden Läufen von 0 auf 20 Zeilen gewachsen ist — die
Salden selbst (Stammdaten, Überstundenberechnung, `overtime_balance`-Zeilen, Urlaubsjahre)
sind von der Migration nicht berührt. Das ist der zentrale Beleg für D6/REQ-21.

---

## Schritt 7: Erfolgskriterien 2 und 3 auf der migrierten Kopie

**Nutzer ohne Periode / Nutzer mit mehr als einer Periode:**

```
$ node -e "... Nutzer ohne Periode ..."
Nutzer ohne Periode: 0
$ node -e "... Nutzer mit mehr als einer Periode ..."
Nutzer mit mehr als einer Periode: 0
```

**Wertgleichheit Periode ↔ aktuelle `users`-Zeile** (JOIN, `IS`-Vergleich für
`workSchedule`, damit `NULL` gegen `NULL` gleich zählt, plus Prüfung `validTo IS NOT NULL`):

```
$ node -e "... JOIN user_work_periods p ON ... WHERE p.weeklyHours <> u.weeklyHours OR p.workSchedule IS NOT u.workSchedule OR p.validTo IS NOT NULL ..."
Abweichende Zeilen (erwartet 0): 0
[]
```

**Abgewiesener Überlappungsversuch** (echter Nutzer der Kopie, `userId=1`, bestehende
Periode `validFrom=2025-11-13`, `validTo=NULL`):

```
$ node -e "... INSERT INTO user_work_periods (userId, validFrom, validTo, weeklyHours, workSchedule) VALUES (1, '2026-06-01', NULL, 20, NULL) ..."
Bestehende Periode Nutzer 1: {"userId":1,"validFrom":"2025-11-13"}
Abgewiesen mit Meldung: user_work_periods: Überlappung mit einer bestehenden Periode desselben Nutzers
```

---

## Tabelle: ROADMAP-Erfolgskriterien 1–4

| # | Kriterium | Urteil | Fundstelle |
|---|-----------|--------|------------|
| 1 | Migration läuft auf einer Kopie der Produktionsdaten durch, `integrity_check` liefert `ok` | ✅ erfüllt | Schritt 4: `integrity_check: ok`, `foreign_key_check: (leer)` |
| 2 | Jeder Nutzer hat auf der Kopie danach genau eine Periode mit den Werten seiner heutigen Stammdaten | ✅ erfüllt | Schritt 7: 0 ohne Periode, 0 mit mehr als einer, 0 abweichende JOIN-Zeilen |
| 3 | Datenbankseitige Absicherung gegen Überlappungen (Trigger/Constraint) wirkt auf echten Daten | ✅ erfüllt | Schritt 7: Überlappungs-`INSERT` für `userId=1` mit wörtlicher Triggermeldung abgewiesen |
| 4 | Salden-Snapshot aller Nutzer ist vor und nach der Migration Byte für Byte identisch | ✅ erfüllt | Schritt 6: `cmp` → `IDENTISCH`, beide Dateien 44785 Bytes |

---

## Verweis auf D6

D6 (10-CONTEXT.md) verlangt genau diesen Ablauf: „Vor und nach der Migration wird auf einer
Kopie der Produktionsdatenbank ein Salden-Snapshot aller Nutzer gezogen und verglichen.
Identisch heißt identisch, nicht 'im Rahmen'." Der Byte-Vergleich in Schritt 6 erfüllt das
wörtlich — keine Toleranz, keine Rundung (`snapshotBalances.ts` rundet und normalisiert nicht,
Task-1-Vorgabe). Das Werkzeug selbst (`snapshotBalances.ts`) deckt einen Nutzer (`--user`),
eine Liste (`--users`) und alle Nutzer (`--all`) ab und steht damit unverändert für Phase 11
und Phase 14 bereit, wie D6 verlangt.

---

## Was dieser Nachweis NICHT zeigt

- Er gilt für eine Kopie vom Datenstand 20.08.2026 (`server/database/development.db`). Ein
  späterer Produktionsstand mit anderen Nutzern, anderen Abwesenheiten oder geänderten
  Stammdaten ist nicht automatisch mit abgedeckt.
- Er ersetzt **nicht** die Generalprobe der Phase 14, die dieselbe Migration gegen eine zu
  diesem Zeitpunkt frisch gezogene Produktionskopie fährt — mit demselben Werkzeug
  (`snapshotBalances.ts`, `applyMigrationsToCopy.ts`), aber neuen Daten.
- Er sagt nichts über Nutzer aus, die nach dem 20.08.2026 angelegt werden — deren
  Bestandsüberführung läuft erst beim nächsten tatsächlichen Migrationslauf.
- Er belegt Nebenwirkungsfreiheit für die in diesem Plan genutzten Lesepfade
  (`unifiedOvertimeService`, direkte `SELECT`-Abfragen auf `overtime_balance`,
  `vacation_balance`, `vacation_transactions`). Er sagt nichts über andere, in Phase 10 nicht
  aufgerufene Lesepfade aus, die beim Lesen schreiben (siehe Kopfkommentar von
  `compareOvertimePaths.ts`) — diese werden von Phase 11 abgelöst, nicht von diesem Nachweis
  geprüft.
- Für die zwei soft-gelöschten Nutzer (`userId` 15, 26) liefert der kanonische
  Überstunden-Lesepfad `"User <id> not found"`, weil er nur nicht-gelöschte Nutzer auflöst
  (`unifiedOvertimeService.ts`, `getUser()`, `WHERE ... AND deletedAt IS NULL`). Das ist kein
  Fund dieses Plans, sondern eine bereits vor Phase 10 bestehende Eigenschaft des
  Lesepfads — hier wörtlich festgehalten (`overtimeError` in beiden Snapshot-Dateien), damit
  sie nicht stillschweigend verschwindet. Die Stammdaten beider Nutzer sind trotzdem
  vollständiger Teil beider Snapshots (Zeilenzahl-Abgleich, Schritt 2/5).
