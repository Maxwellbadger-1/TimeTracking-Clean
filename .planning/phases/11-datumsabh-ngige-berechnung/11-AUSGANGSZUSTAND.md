# Ausgangszustand vor dem Umbau des Rechenwerks (Phase 11)

**Erstellt:** 2026-08-22 (Plan 11-01)
**Zweck:** Misst und protokolliert wörtlich den Zustand vor der Signaturänderung von
`getDailyTargetHours()` (D3). Diese fünf Kennzahlen sind die Vergleichsgrundlage, gegen die
Plan 11-10 am Ende der Phase die Unversehrtheit des Nachweises prüft, bevor er misst:
1. Migrationen 008/009 angewendet
2. Nutzerzahl / Periodenzahl
3. Datenvoraussetzung für D4 (Periodenkette lückenlos, `hireDate` auflösbar)
4. Drift-Zahl (users.weeklyHours/workSchedule vs. offene Periode)
5. Wochenend-Risiko-Zahl

Datenquelle: `server/database/11-nullwirkung.db` — eine per `VACUUM INTO` gezogene Kopie von
`server/database/development.db` (dem einzigen zulässigen lokalen Datenbestand, kein
Produktionszugriff, D5-Analogie aus Phase 9/10). Diese Kopie wird ab jetzt **nur noch gelesen**;
Probeläufe und Seeds späterer Pläne laufen gegen `11-werkzeugprobe.db`.

---

## Task 1: Arbeitskopie und Datenvoraussetzung für D4

### Arbeitskopie ziehen

```
$ cd server && rm -f database/11-nullwirkung.db && node -e "
const Database = require('better-sqlite3');
const db = new Database('./database/development.db', {readonly:true});
db.exec(\"VACUUM INTO './database/11-nullwirkung.db'\");
console.log('VACUUM INTO abgeschlossen.');
db.close();
"
VACUUM INTO abgeschlossen.
```

`VACUUM INTO` statt Dateikopie: `sqlite3`-CLI ist auf diesem Rechner nicht verfügbar (Lehre aus
Plan 03-01), und der Dev-Server könnte `development.db` offen halten (Muster aus
`10-NULLWIRKUNG-NACHWEIS.md`).

### (a) Angewandte Migrationen

```
$ node -e "
const Database = require('better-sqlite3');
const db = new Database('./database/11-nullwirkung.db', {readonly:true});
const fs = require('fs');
console.log('Dateigröße:', fs.statSync('./database/11-nullwirkung.db').size, 'Bytes');
console.log('integrity_check:', JSON.stringify(db.prepare('PRAGMA integrity_check').get()));
console.log('users:', db.prepare('SELECT COUNT(*) c FROM users').get());
console.log('user_work_periods:', db.prepare('SELECT COUNT(*) c FROM user_work_periods').get());
console.log('008/009 vorhanden:', JSON.stringify(db.prepare(\"SELECT name FROM migrations WHERE name IN ('008_create_user_work_periods','009_backfill_user_work_periods')\").all()));
console.log('letzter time_entries.date:', JSON.stringify(db.prepare('SELECT MAX(date) d FROM time_entries').get()));
db.close();
"
Dateigröße: 1306624 Bytes
integrity_check: {"integrity_check":"ok"}
users: { c: 20 }
user_work_periods: { c: 20 }
008/009 vorhanden: [{"name":"008_create_user_work_periods"},{"name":"009_backfill_user_work_periods"}]
letzter time_entries.date: {"d":"2026-08-20"}
```

Vollständige Migrationsliste (Tabellenname `migrations`, siehe
`server/src/database/migrationRunner.ts:145` `CREATE TABLE migrations (...)`, geladen über
`ensureMigrationsTable()`, Zeile 134):

```
$ node -e "... SELECT name FROM migrations ORDER BY id DESC ..."
migrations (alle, neueste zuerst): [
  {"name":"009_backfill_user_work_periods"},
  {"name":"008_create_user_work_periods"},
  {"name":"007_create_vacation_transactions"},
  {"name":"006_add_time_entry_transaction_type"},
  {"name":"20260208_add_position_column.sql"},
  {"name":"20260208_add_time_entry_type.sql"},
  {"name":"20260208_add_position_column"},
  {"name":"003_add_pending_to_vacation_balance"},
  {"name":"002_extend_transaction_types"},
  {"name":"001_backfill_overtime_transactions"},
  {"name":"005_add_balance_tracking_columns"},
  {"name":"004_drop_overtime_unique_index"}
]
```

**Befund:** Migrationen `008_create_user_work_periods` und `009_backfill_user_work_periods` sind
verzeichnet. `integrity_check: ok`.

### (b) Nutzerzahl / Periodenzahl (ungefiltert)

```
$ node -e "... SELECT COUNT(*) c FROM users ..."
users: { c: 20 }
$ node -e "... SELECT COUNT(*) c FROM user_work_periods ..."
user_work_periods: { c: 20 }
```

20 Nutzer, 20 Perioden — deckt sich mit `10-NULLWIRKUNG-NACHWEIS.md` (dieselbe Quelle
`development.db`, dort ebenfalls 20 Nutzer vor dem dortigen Rücksetzen auf den Vor-008-Stand).

### (c) Periodenkette — Datenvoraussetzung für D4

Gemessen mit einem einmaligen tsx-Skript (`server/src/scripts/tmp-11-01-messung.ts`, nach dem
Lauf gelöscht — nicht Teil der Plan-Artefakte), das `checkPeriodChain(userId)` und
`resolveWorkPeriodAt(userId, hireDate)` für jeden ungefilterten `users.id` aufruft:

```
$ cd server && DATABASE_PATH=./database/11-nullwirkung.db npx tsx src/scripts/tmp-11-01-messung.ts
Anzahl Nutzer (ungefiltert): 20
checkPeriodChain: 0 von 20 Nutzern mit Findings
resolveWorkPeriodAt(hireDate) unresolved: [] (Anzahl: 0)
```

**Befund:** 0 von 20 Nutzern haben eine Auffälligkeit in `checkPeriodChain()` (keine Lücke, keine
Überlappung, keine zweite offene Periode). 0 von 20 Nutzern liefern `resolveWorkPeriodAt(userId,
hireDate)` = `null`. **Die Datenvoraussetzung für D4 ist erfüllt: Jeder Nutzer der Kopie hat eine
lückenlose Periodenkette ab `hireDate`.** Plan 11-04 wird für keinen der 20 Nutzer dieser Kopie
einen harten D4-Fehler auslösen (Stand dieser Messung — ein späterer Datenzustand kann
abweichen).

### (d) Drift-Messung: `users.weeklyHours`/`users.workSchedule` vs. offene Periode

Gleicher Skriptlauf, Fortsetzung der Ausgabe:

```
Drift-Zahl (weeklyHours/workSchedule != offene Periode): 0 — userIds: []
```

**Befund:** 0 Nutzer weichen ab. Erwartung nach Migration 009 erfüllt — keine Verletzung von D5
(Nullwirkung) durch einen bereits jetzt bestehenden Unterschied zwischen den flachen Feldern und
der offenen Periode.

### (e) Wochenend-Risiko

Gleicher Skriptlauf, Fortsetzung der Ausgabe:

```
Wochenend-Risiko (workSchedule.saturday>0 oder sunday>0): 0 — userIds: []
```

**Befund:** 0 von 20 Nutzern haben `workSchedule.saturday > 0` oder `workSchedule.sunday > 0`.
**Bedeutung für Plan 11-04:** Auf diesem Datenbestand kann die Umstellung von
`calculateAbsenceHoursWithWorkSchedule` (die Wochenenden bedingungslos überspringt, Zeile
226–229 in `workingDays.ts`, s. `11-AUFRUFER-CHECKLISTE.md`) gegenüber `getDailyTargetHours`
(das Wochenenden nur überspringt, wenn kein `workSchedule` gesetzt ist) **keine Zahl bewegen** —
kein Nutzer im aktuellen Bestand hätte einen Samstag/Sonntag mit positiven Sollstunden, dessen
Berücksichtigung sich durch die Umstellung ändern könnte. Das ist ein Befund dieser Kopie zu
diesem Zeitpunkt, keine strukturelle Garantie für alle künftigen Nutzer.

### (f) Letzter `time_entries.date`

```
letzter time_entries.date: {"d":"2026-08-20"}
```

**Verwendet als `--asOf`-Wert für Snapshot A (Task 2).**

### Produktionsschutz

Kein Befehl in diesem Protokoll enthält `production.db` oder eine SSH-Verbindung. Alle Befehle
tragen `DATABASE_PATH=./database/11-nullwirkung.db` bzw. lesen die readonly-Kopie direkt über
`better-sqlite3`.

---

## Task 2: Snapshot A und Baseline der Testsuite

### Vorbedingung

`server/src/scripts/snapshotBalances.ts` existiert (Plan 10-05), `server/package.json` enthält
das npm-Skript `"snapshot:balances": "tsx src/scripts/snapshotBalances.ts"`. Vorbedingung
erfüllt — kein Abbruch.

### Snapshot A ziehen

```
$ cd server && DATABASE_PATH=./database/11-nullwirkung.db npm run snapshot:balances -- --all --asOf=2026-08-20 --json=../.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.json
=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\11-nullwirkung.db
Dateigröße: 1306624 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 20
asOf: 2026-08-20

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
Vollständige Datei geschrieben: ../.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.json
Vergleichsdatei (nur users-Array) geschrieben: ../.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.users.json

ERGEBNIS: Snapshot erhoben (Exit 0).
```

`--all` wurde verwendet (nicht `--users`), die 2 soft-gelöschten Nutzer wurden nicht
herausgefiltert (siehe Prüfung unten).

### Bekannte Einschränkung: soft-gelöschte Nutzer

```
$ node -e "
const s=require('./.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.json');
console.log('entries:', s.users.length);
const withError = s.users.filter(u=>u.overtimeError);
console.log('overtimeError count:', withError.length);
withError.forEach(u=>console.log('userId',u.userId,'deletedAt',u.masterData.deletedAt,'error:',u.overtimeError));
"
entries: 20
overtimeError count: 2
userId 15 deletedAt 2026-02-28 14:01:48 error: User 15 not found
userId 26 deletedAt 2026-02-27 15:50:29 error: User 26 not found
```

**Bestätigt die bekannte, in `11-01-PLAN.md` benannte Einschränkung:** Der kanonische Lesepfad
(`unifiedOvertimeService.calculatePeriodOvertime()`, intern über `getUser()`, das
`deletedAt IS NULL` filtert) wirft für die 2 soft-gelöschten Nutzer (`userId` 15 und 26) `"User
<id> not found"`. `snapshotBalances.ts` hält das als `overtimeError` fest statt eines Saldos
(siehe `overtimeError`-Feld, `snapshotBalances.ts:294-301`). Ein späterer Byte-Vergleich in Plan
11-10 vergleicht für diese beiden Nutzer also zwei identische Fehlertexte, keine Salden. Plan
11-10 hat dafür laut Vorgabe ein eigenes Ersatzwerkzeug.

Die Stammdaten (`masterData`) beider Nutzer bleiben trotzdem Teil der Population — 20 Einträge im
`users`-Array, wie gefordert.

### Baseline `npx tsc --noEmit`

```
$ cd server && npx tsc --noEmit
src/services/workPeriodService.test.ts(5,3): error TS2724: '"./workPeriodService.js"' has no exported member named 'resolveWorkPeriodIn'. Did you mean 'resolveWorkPeriodAt'?
```

**Ein Fehler, nicht fehlerfrei.** Abweichung von der Plan-Erwartung („muss vor dem Umbau
fehlerfrei sein") — wörtlich vermerkt statt beschönigt:

Dieser Fehler stammt **nicht** aus Plan 11-01 selbst, sondern aus dem zeitgleich laufenden,
parallelen Plan 11-02 (Task 1, TDD-RED-Phase): `git log --oneline -1` zeigt zum Zeitpunkt dieser
Messung den Commit `8a3ae3b test(11-02): add failing tests for resolveWorkPeriodIn` als jüngsten
Commit — Plan 11-02 hat bereits einen fehlschlagenden Test für eine neue Funktion
`resolveWorkPeriodIn` committet, deren Implementierung (GREEN-Phase) zum Zeitpunkt dieser Messung
noch nicht committet war. Dieser `tsc`-Fehler ist damit ein **Momentaufnahme-Artefakt der
parallelen Ausführung**, kein vorbestehender Fehler der Codebasis vor Phase 11 und kein durch
Plan 11-01 verursachter Fehler. Er gehört nicht zum vereinbarten Ausgangszustand im Sinne
„Zustand vor Phase 11", sondern zum Zwischenzustand „Phase 11 läuft bereits, mehrere Pläne
gleichzeitig". Er wird hier trotzdem wörtlich festgehalten (Plan-Vorgabe: „gilt die gemessene
Menge, nicht die Erwartung") und darf nicht mit einer durch Plan 11-01 verursachten Regression
verwechselt werden. Erwartbar: Sobald Plan 11-02 seine GREEN-Phase committet, verschwindet dieser
Fehler unabhängig von Plan 11-01.

### Baseline `npx vitest run`

```
$ cd server && npx vitest run
 Test Files  3 failed | 21 passed (24)
      Tests  8 failed | 312 passed (320)
```

**8 rote Tests, nicht 3 wie in der Plan-Erwartung.** Abweichung wörtlich vermerkt — die gemessene
Menge gilt.

**Titel aller 8 fehlschlagenden Tests:**

1. `unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > should respect hire date and not include pre-employment months`
   — `AssertionError: expected 40 to be 10` (Zeile 268)
2. `unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly`
   — `AssertionError: expected 40 to be 10` (Zeile 316)
3. `vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill`
   — `AssertionError: expected true to be false` (Zeile 138)
4. `workPeriodService.test.ts > resolveWorkPeriodIn — die eine Auflösung, jetzt datenbankfrei (Plan 11-02) > leere Liste liefert null`
   — `TypeError: resolveWorkPeriodIn is not a function` (Zeile 106)
5. `workPeriodService.test.ts > resolveWorkPeriodIn — die eine Auflösung, jetzt datenbankfrei (Plan 11-02) > eine laufende Periode [2026-01-01, null) löst am validFrom auf`
   — `TypeError: resolveWorkPeriodIn is not a function` (Zeile 111)
6. `workPeriodService.test.ts > resolveWorkPeriodIn — die eine Auflösung, jetzt datenbankfrei (Plan 11-02) > zwei Perioden: 2026-07-14 löst die erste, 2026-07-15 die zweite auf (halboffen, D1 Phase 10)`
   — `TypeError: resolveWorkPeriodIn is not a function` (Zeile 117)
7. `workPeriodService.test.ts > resolveWorkPeriodIn — die eine Auflösung, jetzt datenbankfrei (Plan 11-02) > Datum vor der ersten Periode liefert null`
   — `TypeError: resolveWorkPeriodIn is not a function` (Zeile 123)
8. `workPeriodService.test.ts > resolveWorkPeriodIn — die eine Auflösung, jetzt datenbankfrei (Plan 11-02) > ein Datum ohne YYYY-MM-DD-Muster wirft mit einer Meldung, die den Wert zitiert`
   — `AssertionError: expected [Function] to throw error including '2026-8-1' but got '... is not a function'` (Zeile 127)

**Einordnung:** Tests 1–3 entsprechen exakt der Plan-Erwartung („3 vorbestehende rote Tests: 2× in
`unifiedOvertimeService.test.ts` zu Eintrittsdatum/Sollstunden, 1× in
`vacationBackfillService.test.ts`") — diese drei sind der tatsächliche, von Phase 11 unabhängige
Ausgangszustand. Diese Phase behebt sie nicht (out of scope), erzeugt aber auch keinen weiteren
in Bezug auf sie.

Tests 4–8 sind **derselbe Momentaufnahme-Effekt wie beim `tsc`-Befund oben**: Sie stammen aus dem
neuen Testfile `workPeriodService.test.ts`, das Plan 11-02 im Rahmen seiner TDD-RED-Phase
(Commit `8a3ae3b`) hinzugefügt hat, bevor die zugehörige Implementierung `resolveWorkPeriodIn`
committet war. Sie sind kein durch Plan 11-01 verursachter Fund und keine Regression der
bestehenden Suite — sie sind der beabsichtigte rote Zustand einer TDD-RED-Phase eines parallel
laufenden Plans, zufällig zum Messzeitpunkt dieses Plans eingefangen. **Für den Vergleich „vor
Phase 11" vs. „nach Phase 11" (Plan 11-10) sind ausschließlich die drei oben genannten,
tatsächlich vorbestehenden Tests relevant**, nicht die fünf hier zusätzlich gezählten.

**Zusammenfassender Ausgangszustand für Plan 11-10:** Die für den Rest der Phase verbindliche
Erwartung bleibt „3 vorbestehende rote Tests" (Titel 1–3 oben). Die Abweichung auf 8 zum
Zeitpunkt dieser Messung ist ein dokumentiertes, durch parallele Ausführung erklärtes Artefakt,
kein neuer Referenzwert.

---

## Zusammenfassung der fünf Kennzahlen (Manipulationsschutz für Plan 11-10)

| # | Kennzahl | Wert |
|---|---|---|
| 1 | Migrationen 008/009 angewendet | ja (beide verzeichnet, `integrity_check: ok`) |
| 2 | Nutzerzahl / Periodenzahl | 20 / 20 |
| 3 | Datenvoraussetzung D4 (Periodenkette lückenlos, `hireDate` auflösbar) | erfüllt — 0 von 20 Nutzern mit Findings, 0 unresolved |
| 4 | Drift-Zahl (`users.weeklyHours`/`workSchedule` vs. offene Periode) | 0 |
| 5 | Wochenend-Risiko (`workSchedule.saturday`/`sunday` > 0) | 0 |

Diese fünf Werte sind der Referenzpunkt, gegen den Plan 11-10 vor der eigentlichen Messung
prüft, ob `11-nullwirkung.db` seit diesem Plan unverändert geblieben ist.
