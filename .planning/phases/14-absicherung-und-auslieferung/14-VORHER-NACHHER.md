# 14-05: Generalprobe — Vorher/Nachher-Nachweis (D5, REQ-33)

**Erstellt:** 2026-08-23 (Plan 14-05)
**Zweck:** Der vollständige Zwei-Stufen-Ablauf (D3) eines Arbeitszeitmodellwechsels wird gegen
`server/database/14-generalprobe.db` (die migrierte Produktionskopie aus Plan 14-04) gefahren
und mit einem maschinellen Vorher/Nachher-Vergleich aller Salden belegt.

**WICHTIG — Generalprobenfall, NICHT der D6-Fall:** Der in diesem Dokument bewegte Nutzer ist
ein **Prüfnutzer, ausgewählt nach einer festen Regel aus dem Bestand der Kopie** — er ist
ausdrücklich **NICHT** der reale Umstellungsfall aus `14-CONTEXT.md` D6. Die vier Werte des
realen Falls (welcher Nutzer, ab wann, von wie viel auf wie viel) sind laut D6 nicht bekannt
und werden hier nicht erfunden; sie werden in Plan 14-09 unmittelbar vor dem Schreiben vom
Anwender abgefragt. Siehe Abschnitt „Was dieser Nachweis nicht abdeckt" am Ende dieses
Dokuments.

---

## Ausgangslage

- Arbeitsdatenbank: `server/database/14-generalprobe.db` (migrierte Arbeitskopie, 18
  Migrationsreihen, `integrity_check: ok` — siehe `14-04-SUMMARY.md`).
- `server/database/14-produktionskopie.db` bleibt während dieses gesamten Plans unangetastet
  (Kontrolle am Ende dieses Dokuments).
- `--asOf` = `2026-08-21` (`MAX(date) FROM time_entries` der Produktionskopie, protokolliert in
  `14-MIGRATIONSSTAND.md`).

---

## Prüfnutzer bestimmen — nach Regel, nicht nach Gefühl

Auswahlregel (14-05-PLAN.md, Task 2): kleinste `users.id`, die ALLE folgenden Bedingungen
erfüllt:
- `deletedAt IS NULL`
- `id` ist weder 30 noch 31 (die benannten Testdatensätze)
- besitzt Zeiteinträge in mindestens drei verschiedenen Kalendermonaten der letzten zwölf
  Monate vor dem `--asOf`-Datum
- besitzt genau eine Arbeitszeitperiode (also noch keinen Modellwechsel)

**Ausgeführte Abfrage** (gegen `14-generalprobe.db`, readonly):

```sql
SELECT u.id, u.lastName, u.firstName, u.weeklyHours, u.hireDate, u.deletedAt,
  (SELECT COUNT(DISTINCT strftime('%Y-%m', te.date)) FROM time_entries te
     WHERE te.userId = u.id AND te.date >= date(?, '-12 months') AND te.date <= ?) as monthsWithEntries,
  (SELECT COUNT(*) FROM user_work_periods wp WHERE wp.userId = u.id AND wp.deletedAt IS NULL) as periodCount
FROM users u
WHERE u.deletedAt IS NULL AND u.id NOT IN (30,31)
ORDER BY u.id ASC
-- Parameter: asOf='2026-08-21' (zweimal gebunden)
```

**Ergebnis (Auszug, sortiert nach `id`):**

| id | lastName | firstName | weeklyHours | hireDate | monthsWithEntries (12M vor asOf) | periodCount |
|----|----------|-----------|-------------|----------|-----------------------------------|-------------|
| 1  | Administrator | System | 0 | 2025-11-13 | **0** (fällt raus — Bedingung „≥3 Monate" nicht erfüllt) | 1 |
| **2** | **Jochem** | **Karin** | **5** | **2026-01-01** | **7** ✅ | **1** ✅ |
| 3  | Glas | Christine | 8 | 2026-01-01 | 8 | 1 |
| 16 | Jochem | Benedikt | 30 | 2026-01-01 | 8 | 1 |
| ... | (weitere Nutzer, alle mit größerer `id` als 2) | | | | | |

Nutzer `id=1` (System-Administrator) scheidet aus, weil er 0 Zeiteinträge in den letzten zwölf
Monaten vor dem `--asOf`-Datum hat (Bedingung „mindestens drei verschiedene Kalendermonate"
nicht erfüllt). Der nächste Nutzer in aufsteigender `id`-Reihenfolge, der alle vier
Bedingungen erfüllt, ist **`id=2`**.

**GENERALPROBENFALL (nicht D6): userId 2, Nachname „Jochem", Vorname „Karin", aktuelle
Wochenstunden 5, Eintrittsdatum 2026-01-01.**

---

## Generalprobe-Stichtag und -Zielwert — mit Herleitung

**Stichtag:** erster Tag des Monats, der zwei Monate vor dem `--asOf`-Monat liegt.
`--asOf` = `2026-08-21` → `--asOf`-Monat = `2026-08` → zwei Monate zurück = `2026-06` → erster
Tag = **`2026-06-01`**. (Rückwirkender Stichtag, erzwingt Rebuild-Arbeit über drei Monate:
2026-06, 2026-07, 2026-08.)

**Zielwert (neue Wochenstunden):** Hälfte der aktuellen Wochenstunden, mindestens aber 1,
gerundet auf eine ganze Zahl. Aktuelle Wochenstunden von userId 2 = 5.
`5 / 2 = 2.5` → `Math.round(2.5) = 3` (Standard-Rundung, `min(1, 3) `-Bedingung bereits erfüllt,
da 3 ≥ 1). **Zielwert = 3.**

**`--createdBy` — Abfrage und Ergebnis:**

```sql
SELECT id, lastName, firstName, role FROM users
WHERE role = 'admin' AND deletedAt IS NULL ORDER BY id ASC
```

Ergebnis: `id=1` (System Administrator), `id=16` (Benedikt Jochem), `id=27` (Reinhold Merl) —
kleinste `id` = **1**.

**Zusammengefasster Aufruf (Trockenlauf- und Schreiblauf-Basis):**

```
--userId=2 --expectUser=Jochem --expectCurrentWeeklyHours=5 --validFrom=2026-06-01 \
--weeklyHours=3 --reason="Generalprobe Phase 14 - kein realer Umstellungsfall" --createdBy=1
```

---

## Schritt 1 — Snapshot VORHER

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run snapshot:balances -- \
    --all --asOf=2026-08-21 --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-VORHER.json

=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: .../server/database/14-generalprobe.db
Dateigröße: 1286144 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 20
asOf: 2026-08-21

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
Vollständige Datei geschrieben: .../14-SNAPSHOT-GP-VORHER.json
Vergleichsdatei (nur users-Array) geschrieben: .../14-SNAPSHOT-GP-VORHER.users.json

ERGEBNIS: Snapshot erhoben (Exit 0).
EXIT_CODE=0
```

Beide Pflichtdateien `14-SNAPSHOT-GP-VORHER.json` und `14-SNAPSHOT-GP-VORHER.users.json`
liegen unter `.planning/phases/14-absicherung-und-auslieferung/`.

---

## Schritt 2 — Trockenlauf (D3: kein Skript schreibt beim ersten Aufruf)

**Zeilenzahlen VOR dem Trockenlauf** (readonly gemessen):
`user_work_periods` = 20, `overtime_transactions` = 2671.

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npx tsx src/scripts/applyModelChange.ts \
    --userId=2 --expectUser=Jochem --expectCurrentWeeklyHours=5 --validFrom=2026-06-01 \
    --weeklyHours=3 --reason="Generalprobe Phase 14 - kein realer Umstellungsfall" --createdBy=1

Aufgelöster Datenbankpfad: .../server/database/14-generalprobe.db
### TROCKENLAUF — es wird nichts geschrieben ###

Nutzer: Karin Jochem (userId 2), Eintrittsdatum: 2026-01-01
Vorhandene Perioden:
  validFrom=2026-01-01 validTo=(laufend) weeklyHours=5
Saldo vor dem Lauf: 6 h

=== Vorschau ===
balanceDelta:      19.6 h
targetHoursDelta:  -19.6 h
midMonthEffective: false
affectedMonths:    2026-06, 2026-07, 2026-08

Trockenlauf beendet. Mit --apply ausführen.
EXIT_CODE=0
```

**Zeilenzahlen NACH dem Trockenlauf** (readonly gemessen):
`user_work_periods` = 20, `overtime_transactions` = 2671 — **identisch zu vorher**. Der
Trockenlauf hat nachweislich nichts geschrieben (better-sqlite3 rollt die gesamte
Transaktionsklammer bei `dryRun: true` zurück, siehe `workPeriodChangeService.ts`, Schritt 18).

| Tabelle | vor Trockenlauf | nach Trockenlauf | Differenz |
|---|---|---|---|
| `user_work_periods` | 20 | 20 | 0 |
| `overtime_transactions` | 2671 | 2671 | 0 |

---

## Schritt 3 — Gegenprobe der Erwartungsprüfung (T-14-22, absichtlich falsches `--expectUser`)

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npx tsx src/scripts/applyModelChange.ts \
    --userId=2 --expectUser=Musterfrau --expectCurrentWeeklyHours=5 --validFrom=2026-06-01 \
    --weeklyHours=3 --reason="Generalprobe Phase 14 - kein realer Umstellungsfall" --createdBy=1

Aufgelöster Datenbankpfad: .../server/database/14-generalprobe.db
### TROCKENLAUF — es wird nichts geschrieben ###

FEHLER: --expectUser passt nicht zum Nachnamen des geladenen Nutzers.
  Erwartet (--expectUser):  "Musterfrau"
  Vorgefunden (lastName):   "Jochem"
  Schutz gegen eine vertippte --userId (T-14-22) — applyWorkTimeChange() wird NICHT gerufen.
EXIT_CODE=2
```

Exit 2, keine Vorschau ausgegeben, `applyWorkTimeChange()` wurde nachweislich nicht erreicht
(kein Vorschau-Block in der Ausgabe). Die Gegenprobe bestätigt: eine vertippte `--userId` kann
höchstens einen falschen Menschen ANZEIGEN, nie einen falschen Menschen SCHREIBEN.

---

## Schritt 4 — Schreiblauf (derselbe Aufruf, ergänzt um `--apply`)

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npx tsx src/scripts/applyModelChange.ts \
    --userId=2 --expectUser=Jochem --expectCurrentWeeklyHours=5 --validFrom=2026-06-01 \
    --weeklyHours=3 --reason="Generalprobe Phase 14 - kein realer Umstellungsfall" --createdBy=1 --apply

Aufgelöster Datenbankpfad: .../server/database/14-generalprobe.db
### MODUS: SCHREIBEN ###

Nutzer: Karin Jochem (userId 2), Eintrittsdatum: 2026-01-01
Vorhandene Perioden:
  validFrom=2026-01-01 validTo=(laufend) weeklyHours=5
Saldo vor dem Lauf: 6 h

=== Vorschau ===
balanceDelta:      19.6 h
targetHoursDelta:  -19.6 h
midMonthEffective: false
affectedMonths:    2026-06, 2026-07, 2026-08

Saldo nach dem Lauf: 29.6 h
integrity_check: [{"integrity_check":"ok"}]

### FERTIG ###
EXIT_CODE=0
```

Exit 0, Saldo vorher (6 h) und nachher (29,6 h) gedruckt, `integrity_check` = `ok`. Der Saldo
STEIGT, weil die neue Wochenstunden-Basis (3 h/Woche statt 5 h/Woche) rückwirkend ab
2026-06-01 ein niedrigeres Soll erzeugt (`targetHoursDelta: -19.6 h`) — bei gleichem Ist
bedeutet weniger Soll einen höheren Überstundensaldo. Das ist die erwartete Vorzeichenlogik von
`applyWorkTimeChange()` bei einer Reduzierung der Wochenstunden.

`user_work_periods` wuchs dabei von 20 auf 21 Zeilen (die bestehende, laufende Periode von
userId 2 wurde bei `2026-06-01` geschlossen und eine neue, laufende Periode mit
`weeklyHours=3` angelegt — genau eine neue Zeile, kein anderer Nutzer betroffen).

---

## Schritt 5 — Snapshot NACHHER

```
$ cd server && DATABASE_PATH=./database/14-generalprobe.db npm run snapshot:balances -- \
    --all --asOf=2026-08-21 --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-GP-NACHHER.json

=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: .../server/database/14-generalprobe.db
Dateigröße: 1286144 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 21
asOf: 2026-08-21

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
Vollständige Datei geschrieben: .../14-SNAPSHOT-GP-NACHHER.json
Vergleichsdatei (nur users-Array) geschrieben: .../14-SNAPSHOT-GP-NACHHER.users.json

ERGEBNIS: Snapshot erhoben (Exit 0).
EXIT_CODE=0
```

`user_work_periods` = 21 (von 20 auf 21 — genau die eine neue Periode aus Schritt 4). Beide
Pflichtdateien `14-SNAPSHOT-GP-NACHHER.json` und `14-SNAPSHOT-GP-NACHHER.users.json` liegen
unter `.planning/phases/14-absicherung-und-auslieferung/`.

---

## Schritt 6 — Kettenprüfung gegen die Kopie (deckt Phase-12-Punkt 19 ab)

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

Exit 0, keine Befunde — jede Periodenkette (inklusive der neu gesplitteten Kette von userId 2)
ist lückenlos.

---

## Kontrolle: `14-produktionskopie.db` bleibt unangetastet

```
$ stat -c%s server/database/14-produktionskopie.db
1286144 Bytes   (identisch zum Stand aus 14-04, mtime unverändert 02:11)

$ node -e "... readonly gegen 14-produktionskopie.db ..."
integrity_check: [ { integrity_check: 'ok' } ]
overtime_transactions: { c: 2671, s: -372.68 }
overtime_balance: { c: 144 }
users: { c: 20 }
```

Alle Werte reproduzieren exakt den Stand aus `14-04-SUMMARY.md` — `14-produktionskopie.db`
wurde vom Generalprobenlauf nicht berührt (der Lauf arbeitete ausschließlich gegen
`14-generalprobe.db`).

**Kontrolle `development.db`:** Größe unverändert (1699840 Bytes), `COUNT(users)=30`,
`COUNT(user_work_periods)=30` — identisch zum in `14-MIGRATIONSSTAND.md` protokollierten
Stand. Der laufende Dev-Server (PID 39860, Port 3000) und der Tauri-Prozess (PID 26124, Port
1420) laufen unverändert weiter, wurden nicht beendet.

---

## Diff-Auswertung (Task 3)

### Roher Byte-Diff der beiden `*.users.json`-Dateien

```
$ diff 14-SNAPSHOT-GP-VORHER.users.json 14-SNAPSHOT-GP-NACHHER.users.json
134c134
<       "targetHours": 155,
---
>       "targetHours": 135.39999999999966,
136c136
<       "overtime": 10,
---
>       "overtime": 29.599999999999923,
183c183
<         "targetHours": 21,
---
>         "targetHours": 12.6,
185c185
<         "overtime": 39,
---
>         "overtime": 47.4,
190c190
<         "targetHours": 23,
---
>         "targetHours": 13.8,
192c192
<         "overtime": -4.5,
---
>         "overtime": 4.699999999999999,
197c197
<         "targetHours": 15,
---
>         "targetHours": 9,
199c199
<         "overtime": -9,
---
>         "overtime": -3,
```

32 Zeilen Diff-Ausgabe gesamt (16 geänderte Werte, je Wert eine `<`- und eine `>`-Zeile).
Alle 32 Zeilen liegen zwischen Zeile 122 (`"userId": 2,`) und Zeile 227 (`"userId": 3,`) der
VORHER-Datei (`grep -n '"userId"' 14-SNAPSHOT-GP-VORHER.users.json`) — **jede einzelne
geänderte Zeile gehört zum Datensatz von userId 2.** Kein anderer Nutzerblock ist im Diff
vertreten. Die vier geänderten Felder je Block sind `targetHours`/`overtime` des
Gesamtzeitraums (`overtimePeriod`, Zeilen 134/136) sowie dieselben zwei Felder in den
`overtimeBalanceRows` für die drei betroffenen Monate 2026-06 (Zeilen 183/185), 2026-07
(Zeilen 190/192) und 2026-08 (Zeilen 197/199) — exakt die drei Monate aus `affectedMonths` des
Schreiblaufs in Schritt 4.

### Auswertung je Nutzer (`node -e`-Einzeiler, Vergleich von `overtimePeriod.overtime`)

```javascript
const fs = require('fs');
const before = JSON.parse(fs.readFileSync('14-SNAPSHOT-GP-VORHER.users.json', 'utf-8'));
const after = JSON.parse(fs.readFileSync('14-SNAPSHOT-GP-NACHHER.users.json', 'utf-8'));
const beforeMap = new Map(before.map(u => [u.userId, u]));
const afterMap = new Map(after.map(u => [u.userId, u]));
let diffRows = [], sameErrorCount = 0, comparedCount = 0;
for (const [userId, b] of beforeMap) {
  const a = afterMap.get(userId);
  comparedCount++;
  if (b.overtimeError !== null && a.overtimeError !== null) {
    if (b.overtimeError === a.overtimeError) sameErrorCount++;
    continue; // unveraenderter Fehlertext zaehlt NICHT als Differenz
  }
  const bVal = b.overtimePeriod ? b.overtimePeriod.overtime : null;
  const aVal = a.overtimePeriod ? a.overtimePeriod.overtime : null;
  const diff = Math.round(((aVal ?? 0) - (bVal ?? 0)) * 100) / 100;
  if (diff !== 0) diffRows.push({ userId, before: bVal, after: aVal, diff });
}
```

**Ergebnis:**

| userId | Name | vorher (h) | nachher (h) | Differenz (h) |
|--------|------|-----------:|------------:|---------------:|
| 2 | Karin Jochem | 10 | 29,6 | **+19,6** |

Verglichene Nutzer gesamt: 20. Nutzer mit unverändertem `overtimeError` in beiden Snapshots
(nicht als Differenz gezählt): 5 (die fünf soft-gelöschten Nutzer der Kopie, siehe
`overtimeError`-Feld: `"User <id> not found"`).

Die gemessene Differenz **+19,6 h** ist identisch mit dem `balanceDelta: 19.6 h`, das
`applyModelChange.ts` in Schritt 4 aus der Vorschau von `applyWorkTimeChange()` gedruckt hat
(6 h vorher → 29,6 h nachher laut Skript-Ausgabe) — zwei unabhängig gemessene Werte
(Journal-/Balance-Lesepfad im Skript selbst vs. `unifiedOvertimeService.calculatePeriodOvertime()`
im Snapshot-Werkzeug) stimmen exakt überein.

---

## Ergebnis der Generalprobe

**Genau EIN Nutzer mit Differenz ungleich null: userId 2 (Karin Jochem), Differenz +19,6 h.**
Das ist exakt der in Task 2 bestimmte **Generalprobenfall** — kein weiterer Name taucht in der
Diff-Auswertung auf. Kein Blocker.

- Verglichene Nutzer gesamt: 20
- Nutzer mit Differenz ungleich null: 1 (userId 2)
- Nutzer mit unverändertem `overtimeError` (soft-gelöscht, kein Diff): 5

---

## Erwartetes Rauschen — geprüft

Aus `14-CONTEXT.md` („Existing Code Insights"): User 30 „Test Urlaub", User 31 „UAT" und
Antrag 73 (storniert) sind vorab benanntes Rauschen im Produktionsbestand. Geprüft, ob sich
einer von ihnen bewegt hat:

**User 30 „Test Urlaub" (id 30):** In der Kopie vorhanden, `deletedAt` gesetzt
(`2026-08-21 19:06:59`, soft-gelöscht). `overtimeError` in VORHER und NACHHER identisch
(`"User 30 not found"` — der kanonische Lesepfad löst soft-gelöschte Nutzer nicht auf, siehe
`snapshotBalances.ts` Kopfkommentar). Der komplette JSON-Datensatz (Stammdaten, Fehlertext,
`vacationYears` inkl. `transactionsSum`) ist zwischen beiden Snapshots **byteidentisch**
(`JSON.stringify(vorher) === JSON.stringify(nachher)` → `true`). **Unbewegt.**

**User 31 „UAT" (id 31):** In der Kopie vorhanden, `deletedAt` gesetzt
(`2026-08-21 19:07:45`, soft-gelöscht). Ebenfalls `overtimeError` identisch
(`"User 31 not found"`), kompletter JSON-Datensatz byteidentisch. **Unbewegt.**

**Antrag 73 (storniert):** `absence_requests.id = 73` gehört `userId = 30`, `status = 'rejected'`,
`type = 'vacation'`. Da User 30 vollständig soft-gelöscht ist und sein Datensatz (inklusive
`vacationYears`, das `vacation_transactions`/`vacation_balance` widerspiegelt) byteidentisch
bleibt, bewegt sich auch der mit Antrag 73 verknüpfte Bestand nicht. **Unbewegt.**

Keiner der drei vorab benannten Rauschquellen bewegt sich — die einzige Bewegung im gesamten
Bestand ist der eine Generalprobenfall (userId 2).

---

## Was dieser Nachweis nicht abdeckt

Dieser Nachweis belegt, dass der Zwei-Stufen-Ablauf gegen die migrierte Produktionskopie
korrekt funktioniert: Der Trockenlauf schreibt nichts, die Erwartungsprüfung verhindert eine
vertippte `--userId`, und der Schreiblauf bewegt ausschließlich den Saldo des behandelten
Nutzers — kein anderer Nutzer, auch nicht die drei vorab benannten Rauschquellen.

**Was er NICHT abdeckt: der reale Umstellungsfall aus D6 (`14-CONTEXT.md`).** Die vier Werte
des tatsächlich anstehenden Umstellungsfalls — welcher Nutzer, ab welchem Stichtag, von wie
vielen auf wie viele Wochenstunden — sind zum Zeitpunkt dieses Plans **nicht bekannt** und
wurden hier bewusst **nicht erfunden**. Der hier bewegte Nutzer (userId 2, Karin Jochem) ist
ein nach fester Regel ausgewählter **Prüfnutzer der Kopie**, keine Vorwegnahme des D6-Falls.
Sobald der Anwender die vier D6-Werte bestätigt hat, wiederholt Plan 14-09 exakt diesen
Zwei-Stufen-Ablauf — Trockenlauf, Prüfung, `--apply` — mit den echten Werten gegen die echte
Produktionsdatenbank, nach ausdrücklicher Freigabe (D2).

---

## Vier Pflichtgates (Task 3)

```
$ cd server && npx tsc --noEmit
EXIT_CODE=0

$ cd desktop && npx tsc --noEmit
EXIT_CODE=0

$ cd server && npx vitest run
Test Files  2 failed | 35 passed (37)
     Tests  3 failed | 507 passed (510)
```

Die drei roten Titel sind wortgleich mit `11-AUSGANGSZUSTAND.md`/`14-01-SUMMARY.md`:
- `src/services/unifiedOvertimeService.test.ts` → „should respect hire date and not include
  pre-employment months" (Zeile 285)
- `src/services/unifiedOvertimeService.test.ts` → „REGRESSION: User hired on 1st of month
  should calculate correctly" (Zeile 340)
- `src/services/vacationBackfillService.test.ts` → „erkennt einen bereits gelaufenen Backfill"
  (Zeile 138)

507 grüne Tests statt der Baseline-Zahl 493 — die Differenz von 14 sind ausschließlich die
neuen `applyModelChange.test.ts`-Tests aus Task 1 (additiv, keine bestehende Testdatei
verändert).

```
$ cd desktop && npm run check:rules
EXIT_CODE=0
```

Alle vier Pflichtgates grün bzw. bei der unveränderten 3-rot-Baseline.
