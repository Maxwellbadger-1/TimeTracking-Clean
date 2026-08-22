# Idempotenz-Nachweis REQ-24 (Plan 11-09, Task 3)

**Erstellt:** 2026-08-22
**Zweck:** REQ-24 auf echten Daten belegen — ein zweifacher Rebuild über einen Zeitraum mit
echtem Modellwechsel liefert denselben Datenbestand. Aufbau wie
`.planning/phases/10-perioden-fundament/10-NULLWIRKUNG-NACHWEIS.md`: nummerierte Schritte,
wörtlicher Befehl und wörtliche Ausgabe je Schritt, Urteilstabelle am Ende, Abschnitt „Was
dieser Nachweis NICHT zeigt".

**Arbeitskopie:** `server/database/11-modellwechsel.db` (per `VACUUM INTO` aus
`server/database/development.db` gezogen). `server/database/11-nullwirkung.db` wurde von
keinem Befehl dieses Nachweises berührt — Kontrolle in Schritt 8.

---

## Schritt 1: Weigerung gegen `11-nullwirkung.db` (T-11-32)

**Befehl:**
```
$ cd server && DATABASE_PATH=./database/11-nullwirkung.db npx tsx src/scripts/seedModelChangeUser.ts
```

**Wörtliche Ausgabe:**
```
FEHLER: Schreibzugriff auf 11-nullwirkung.db verweigert (T-11-32, 11-09-PLAN.md).
  Aufgelöster Datenbankpfad: <repo>\server\database\11-nullwirkung.db
  Diese Arbeitskopie trägt Snapshot A für den Nullwirkungs-Nachweis in Plan 11-10 — nach dem Umbau existiert der Vor-Umbau-Code nicht mehr, ein Schreibzugriff hier entwertet den Nachweis unwiederbringlich.
  Nutze DATABASE_PATH=./database/11-modellwechsel.db (oder eine andere, ausdrücklich benannte Arbeitskopie).
```
Exit-Code: 2. Die Weigerung ist eine eigene Prüfung mit eigener Fehlermeldung (grep-Beleg im
Quelltext: `path.basename(resolvedPath) === '11-nullwirkung.db'`, `seedModelChangeUser.ts`).

---

## Schritt 2: Arbeitskopie `11-modellwechsel.db` frisch ziehen

**Befehl:**
```
$ cd server && rm -f database/11-modellwechsel.db && node -e "
const Database = require('better-sqlite3');
const db = new Database('./database/development.db', {readonly:true});
db.exec(\"VACUUM INTO './database/11-modellwechsel.db'\");
console.log('VACUUM INTO abgeschlossen.');
db.close();
"
```

**Wörtliche Ausgabe:**
```
VACUUM INTO abgeschlossen.
```

`VACUUM INTO` statt Dateikopie: `sqlite3`-CLI ist auf diesem Rechner nicht verfügbar, der Dev-
Server hält `development.db` offen (dasselbe Muster wie `11-AUSGANGSZUSTAND.md`,
`10-NULLWIRKUNG-NACHWEIS.md`).

---

## Schritt 3: Fixture anlegen — `seed:model-change`, erster Lauf

**Befehl:**
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npx tsx src/scripts/seedModelChangeUser.ts
```

Vorgabewerte: `hireDate=2025-01-01`, `stichtag=2026-05-14` (Donnerstag, mitten im Monat, D6),
`weeklyHoursBefore=40`, `weeklyHoursAfter=20`.

**Wörtliche Ausgabe (Logger-Rauschen der Schema-Initialisierung entfernt):**
```
=== seedModelChangeUser v1.0.0 ===
Aufgelöster Datenbankpfad: <repo>\server\database\11-modellwechsel.db
hireDate: 2025-01-01, stichtag: 2026-05-14
weeklyHoursBefore: 40, weeklyHoursAfter: 20

Nutzer angelegt: userId=12291 (username=t1109-modellwechsel-2026-05-14).
Zeiteinträge erzeugt: 21 (jeder Werktag im Monat 05/2026, 8h, 08:00-16:00, location=office).

userId: 12291
Perioden:
  id=2164 validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40
  id=2165 validFrom=2026-05-14 validTo=null (laufend) weeklyHours=20
checkPeriodChain(12291): {"ok":true,"findings":[]}
hireDate: 2025-01-01
Erzeugt in diesem Lauf: ja
Referenzdatum dieses Laufs (Europe/Berlin): 2026-08-22
```
Exit-Code: 0. Mai 2026 hat 21 Werktage (Mo-Fr) — deckt sich mit der erzeugten Anzahl.

---

## Schritt 4: Idempotenz der Fixture — zweiter Lauf mit identischen Argumenten

**Befehl:** derselbe wie Schritt 3.

**Wörtliche Ausgabe (Logger-Rauschen entfernt):**
```
=== seedModelChangeUser v1.0.0 ===
Aufgelöster Datenbankpfad: <repo>\server\database\11-modellwechsel.db
hireDate: 2025-01-01, stichtag: 2026-05-14
weeklyHoursBefore: 40, weeklyHoursAfter: 20

Nutzer existiert bereits: userId=12291 (username=t1109-modellwechsel-2026-05-14). Kein zweiter Lauf nötig.

userId: 12291
Perioden:
  id=2164 validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40
  id=2165 validFrom=2026-05-14 validTo=null (laufend) weeklyHours=20
checkPeriodChain(12291): {"ok":true,"findings":[]}
hireDate: 2025-01-01
Erzeugt in diesem Lauf: nein (bereits vorhanden)
Referenzdatum dieses Laufs (Europe/Berlin): 2026-08-22
```
Exit-Code: 0. Kontrollabfrage (readonly):
```
$ node -e "const Database=require('better-sqlite3');const db=new Database('./database/11-modellwechsel.db',{readonly:true});console.log(db.prepare(\"SELECT COUNT(*) c FROM users WHERE username LIKE 't1109-modellwechsel-%'\").get());console.log(db.prepare('SELECT COUNT(*) c FROM time_entries WHERE userId=12291').get());"
```
```
{ c: 1 }
{ c: 21 }
```
Kein zweiter Nutzer, keine verdoppelten Zeiteinträge.

---

## Schritt 5: Zweifacher Rebuild — Stichtagsmonat, Vormonat, Folgemonat

**Befehl** (Vergleichswerkzeug, ephemer wie `tmp-11-01-messung.ts` — nicht Teil der committeten
Artefakte, nach dem Lauf gelöscht):

```ts
// src/scripts/tmp-11-09-idempotenz.ts (gelöscht nach diesem Lauf)
import { assertNotProduction } from './productionGuard.js';
assertNotProduction();
const { rebuildOvertimeTransactionsForMonth } = await import('../services/overtimeTransactionRebuildService.js');
const { db } = await import('../database/connection.js');

const userId = 12291;
const months = ['2026-04', '2026-05', '2026-06'];

function snapshot(month: string) {
  const [y, m] = month.split('-').map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  const txs = db.prepare(
    `SELECT date, type, hours, description, referenceType, referenceId
     FROM overtime_transactions WHERE userId = ? AND date BETWEEN ? AND ?
     ORDER BY date ASC, type ASC, id ASC`
  ).all(userId, `${month}-01`, `${month}-${String(lastDay).padStart(2,'0')}`);
  const bal = db.prepare(
    `SELECT month, targetHours, actualHours FROM overtime_balance WHERE userId = ? AND month = ?`
  ).get(userId, month);
  return { txs, bal };
}

for (const m of months) rebuildOvertimeTransactionsForMonth(userId, m);
const snap1 = {}; for (const m of months) snap1[m] = snapshot(m);

for (const m of months) rebuildOvertimeTransactionsForMonth(userId, m);
const snap2 = {}; for (const m of months) snap2[m] = snapshot(m);

for (const m of months) {
  const s1 = JSON.stringify(snap1[m]);
  const s2 = JSON.stringify(snap2[m]);
  console.log(`${m}: identisch=${s1 === s2}, Länge Lauf1=${s1.length}, Länge Lauf2=${s2.length}`);
}
```

Ausgeführt mit `DATABASE_PATH=./database/11-modellwechsel.db npx tsx src/scripts/tmp-11-09-idempotenz.ts`.
`id` und `createdAt` sind bewusst NICHT Teil des Vergleichs — ein echter Rebuild löscht und
fügt neu ein (`DELETE` + `INSERT`, s. `overtimeTransactionRebuildService.ts` STEP 3/6), jede
Zeile bekommt zwangsläufig eine neue `id` und einen neuen `createdAt`-Zeitstempel. Verglichen
werden die fachlichen Spalten: `date`, `type`, `hours`, `description`, `referenceType`,
`referenceId` — kanonisch sortiert nach `date, type, id`.

**Wörtliche Ausgabe (Vergleichszeilen):**
```
2026-04: identisch=true, Länge Lauf1=4229, Länge Lauf2=4229
2026-05: identisch=true, Länge Lauf1=4349, Länge Lauf2=4349
2026-06: identisch=true, Länge Lauf1=4229, Länge Lauf2=4229
```

**Alle drei Monate: byte-identisch zwischen Lauf 1 und Lauf 2.**

---

## Schritt 6: `overtime_balance`-Zeilen der drei Monate (Lauf 2, zur Einordnung)

Aus derselben Erhebung, Rohdaten (`bal`-Feld je Monat):

| Monat | targetHours | actualHours | Einordnung |
|---|---|---|---|
| 2026-04 (Vormonat, vollständig unter altem Modell 40h/Woche) | 160 | 0 | Keine Zeiteinträge in April (Fixture erzeugt nur Mai-Einträge) — Zielstunden allein aus der alten Periode |
| 2026-05 (Stichtagsmonat, gemischt) | 104 | 168 | Mischwert aus 40h/Woche (01.-13.05.) und 20h/Woche (14.-31.05.) — genau der Fall, den REQ-24 prüft |
| 2026-06 (Folgemonat, vollständig unter neuem Modell 20h/Woche) | 84 | 0 | Keine Zeiteinträge in Juni — Zielstunden allein aus der neuen Periode |

April (160h) und Juni (84h) grenzen den Mai-Mischwert (104h) plausibel ein: Ein Monat
vollständig bei 40h/Woche liegt deutlich höher, ein Monat vollständig bei 20h/Woche deutlich
niedriger als der Mischmonat — konsistent mit einem echten Wechsel mitten im Monat.

**Nachbarmonate unbewegt:** Da Schritt 5 exakt dieselben Werte für April und Juni in Lauf 1
und Lauf 2 liefert (s. o.), bewegt der Rebuild des Stichtagsmonats die Nachbarmonate
nachweislich nicht.

---

## Schritt 7: Gegenprobe — Sollstunden vor und nach dem Stichtag müssen verschieden sein (T-11-34)

**Befehl:**
```ts
// src/scripts/tmp-11-09-gegenprobe.ts (gelöscht nach diesem Lauf)
import { assertNotProduction } from './productionGuard.js';
assertNotProduction();
const { getDailyTargetHours } = await import('../utils/workingDays.js');
const { createWorkPeriodContext } = await import('../services/workPeriodContext.js');
const { getUserById } = await import('../services/userService.js');

const user = getUserById(12291);
const periods = createWorkPeriodContext();
for (const d of ['2026-05-12', '2026-05-13', '2026-05-14', '2026-05-15', '2026-05-18']) {
  console.log(d, '->', getDailyTargetHours(user, d, periods));
}
```

**Wörtliche Ausgabe:**
```
2026-05-12 -> 8
2026-05-13 -> 8
2026-05-14 -> 0
2026-05-15 -> 4
2026-05-18 -> 4
```

**Auswertung:** `2026-05-13` (Mittwoch, letzter Tag der alten Periode, 40h/Woche) liefert `8h`.
`2026-05-15` (Freitag, erster vollständiger Werktag der neuen Periode, 20h/Woche) liefert `4h`.
**8 ≠ 4 — die Sollstunden vor und nach dem Stichtag sind nachweislich verschieden.** Damit
prüft der Idempotenzvergleich aus Schritt 5 tatsächlich einen wirksamen Modellwechsel, nicht
zwei versehentlich gleiche Werte.

**Nebenbefund, kein Fehler:** `2026-05-14` (der Stichtag selbst) liefert `0h`, nicht die
erwarteten `4h` (20h/5). Grund: `2026-05-14` ist im Jahr 2026 der Tag von Christi Himmelfahrt
(Ostern 2026 = 5. April, Himmelfahrt = Ostern + 39 Tage = 14. Mai), ein gesetzlicher Feiertag.
Bestätigt gegen die Arbeitskopie:
```
$ node -e "const Database=require('better-sqlite3');const db=new Database('./database/11-modellwechsel.db',{readonly:true});console.log(db.prepare('SELECT date FROM holidays WHERE date BETWEEN ? AND ?').all('2026-05-01','2026-05-20'));"
[{"date":"2026-05-01"},{"date":"2026-05-14"}]
```
`getDailyTargetHours()` prüft laut der kanonischen Ableitungsreihenfolge (s.
`09-INVENTAR-SOLLSTUNDEN.md`, Abschnitt „Referenz") den Feiertag ZUERST — das überschreibt
jedes Modell, alt oder neu. Das ist die korrekte, dokumentierte Reihenfolge, kein Fehler des
Fixture-Skripts oder der Berechnung. Der Vergleich in diesem Schritt verwendet deshalb bewusst
`2026-05-13`/`2026-05-15` (die Tage unmittelbar vor/nach dem Stichtag, keiner davon ein
Feiertag) statt des Stichtags selbst, um den Modellwechsel unvermischt mit dem
Feiertagseffekt zu zeigen.

---

## Schritt 8: Gesamtgrün — Compiler und Testsuite

### `npx tsc --noEmit`

**Befehl:**
```
$ cd server && npx tsc --noEmit
```
**Wörtliche Ausgabe:** (leer — 0 Fehler)

**Ergebnis: fehlerfrei.** Die seit Plan 11-04 offene Rotphase endet hier.

### `npx vitest run`

**Befehl:**
```
$ cd server && npx vitest run
```
**Ergebnis (zusammenfassende Zeile):**
```
 Test Files  2 failed | 25 passed (27)
      Tests  3 failed | 370 passed (373)
   Start at  08:15:25
   Duration  8.00s
```

**Titel aller fehlschlagenden Tests:**
1. `unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > should respect hire date and not include pre-employment months`
2. `unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly`
3. `vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill`

**Vergleich gegen `11-AUSGANGSZUSTAND.md` (verbindliche Referenz: genau drei vorbestehende rote
Tests):**

| # | Erwartet (`11-AUSGANGSZUSTAND.md`) | Gemessen (dieser Lauf) | Übereinstimmung |
|---|---|---|---|
| 1 | `unifiedOvertimeService.test.ts` — „should respect hire date and not include pre-employment months" | identisch | ja |
| 2 | `unifiedOvertimeService.test.ts` — „User hired on 1st of month should calculate correctly" | identisch | ja |
| 3 | `vacationBackfillService.test.ts` — „erkennt einen bereits gelaufenen Backfill" | identisch | ja |

**Keine Abweichung.** Alle drei roten Tests sind Zeile für Zeile dieselben wie im dokumentierten
Ausgangszustand — kein neuer roter Test durch diese Phase. Diese drei werden nicht behoben
(bewusst als Ausgangszustand dokumentiert, `11-AUSGANGSZUSTAND.md`).

---

## Schritt 9: Unversehrtheit `11-nullwirkung.db`

**Befehl:**
```
$ ls -la server/database/11-nullwirkung.db
$ node -e "const Database=require('better-sqlite3');const db=new Database('./server/database/11-nullwirkung.db',{readonly:true});console.log('users:',db.prepare('SELECT COUNT(*) c FROM users').get());console.log('user_work_periods:',db.prepare('SELECT COUNT(*) c FROM user_work_periods').get());console.log('overtime_balance:',db.prepare('SELECT COUNT(*) c FROM overtime_balance').get());"
```

**Wörtliche Ausgabe:**
```
-rw-r--r-- 1 maxfe 197609 1306624 Aug 22 07:01 server/database/11-nullwirkung.db
users: { c: 20 }
user_work_periods: { c: 20 }
overtime_balance: { c: 144 }
```
Dateigröße (1306624 Bytes) und Zeitstempel (2026-08-22 07:01) sind identisch mit dem in
`11-AUSGANGSZUSTAND.md` protokollierten Zustand nach dem `VACUUM INTO`-Zug in Plan 11-01 —
über den gesamten Verlauf dieses Plans (Task 1 bis Task 3) unverändert. `users`-Zeilenzahl
(20) und `user_work_periods`-Zeilenzahl (20) decken sich mit den in `11-AUSGANGSZUSTAND.md`
protokollierten Werten (Abschnitt „Zusammenfassung der fünf Kennzahlen", Kennzahl 2).
`overtime_balance` (144 Zeilen) ist in `11-AUSGANGSZUSTAND.md` nicht als eigene Kennzahl
protokolliert — hier erstmals als Referenzwert für künftige Vergleiche festgehalten, nicht als
Abgleich gegen eine bestehende Baseline missverstanden.

Kein Befehl dieses Nachweises hat `DATABASE_PATH` auf `11-nullwirkung.db` gesetzt (jeder
Befehl in den Schritten 2-8 trägt `DATABASE_PATH=./database/11-modellwechsel.db`, außer
Schritt 1, dessen Zweck genau die Weigerung gegen `11-nullwirkung.db` ist, und Schritt 9
selbst, das ausschließlich `readonly:true` liest).

---

## Urteilstabelle

| Kriterium | Urteil | Fundstelle |
|---|---|---|
| Fixture weigert sich gegen `11-nullwirkung.db` | bestanden | Schritt 1 |
| Fixture idempotent (zweiter Lauf legt keinen zweiten Nutzer an) | bestanden | Schritt 4 |
| Rebuild des Stichtagsmonats zweifach identisch | bestanden | Schritt 5 (2026-05) |
| Rebuild des Vormonats zweifach identisch, unbewegt | bestanden | Schritt 5 (2026-04) |
| Rebuild des Folgemonats zweifach identisch, unbewegt | bestanden | Schritt 5 (2026-06) |
| Gegenprobe: Sollstunden vor/nach Stichtag verschieden | bestanden (8h vs. 4h) | Schritt 7 |
| `npx tsc --noEmit` fehlerfrei | bestanden | Schritt 8 |
| Testsuite: keine Abweichung von den drei vorbestehenden roten Tests | bestanden | Schritt 8 |
| `11-nullwirkung.db` unverändert | bestanden | Schritt 9 |

**REQ-24 ist auf echten Daten belegt.**

---

## Was dieser Nachweis NICHT zeigt

- **Keine Aussage über gleichzeitige, konkurrierende Schreibzugriffe.** Der Rebuild lief in
  diesem Nachweis sequenziell, ohne parallele Schreiber auf denselben Nutzer. Ob zwei
  gleichzeitige Rebuild-Läufe (z. B. durch zwei HTTP-Requests) atomar bleiben, ist nicht Teil
  dieses Nachweises — `rebuildOvertimeTransactionsForMonth()` läuft zwar in einer
  `db.transaction()`, aber Nebenläufigkeit zweier Prozesse wurde hier nicht geprüft.
- **Keine Aussage über einen Modellwechsel über einen Jahreswechsel.** Der hier geprüfte
  Stichtag liegt mitten im Jahr (Mai). Ein Wechsel über den 31.12./01.01. (mit
  Jahres-Rollover-Logik, `getYearEndOvertimeBalance()`) ist nicht Gegenstand dieses Nachweises
  — das ist laut `.planning/ROADMAP.md`, Phase 14, „Wechsel über einen Jahreswechsel"
  ausdrücklich vorgesehen.
- **Keine Aussage über einen Wechsel mit `workSchedule` statt `weeklyHours`.** Beide Perioden
  dieses Fixture-Nutzers haben `workSchedule = null` (reine `weeklyHours`-Fälle). Ein Wechsel
  zwischen zwei individuellen Wochenplänen ist strukturell derselbe Codepfad
  (`getDailyTargetHours()` prüft `workSchedule` vor `weeklyHours`), wurde hier aber nicht
  eigens mit echten `workSchedule`-Werten durchgespielt.
- **Keine Aussage über mehr als zwei Perioden.** Dieser Nutzer hat genau einen Wechsel (zwei
  Perioden). Eine Kette aus drei oder mehr Perioden wurde nicht geprüft.
- **Keine Aussage über Abwesenheiten (Urlaub/Krankheit) im Stichtagsmonat.** Der Fixture-Nutzer
  hat ausschließlich Zeiteinträge, keine Abwesenheitsanträge. Der Abwesenheits-Kredit-Pfad
  (`handleAbsenceDay()` in `overtimeTransactionRebuildService.ts`) wird von diesem Nachweis
  nicht mitgeprüft.
- **Der Nutzer bleibt in der Arbeitskopie zurück.** `seedModelChangeUser.ts` räumt sich nicht
  selbst auf — das ist beabsichtigt, weil Plan 11-10 denselben Nutzer wiederverwendet (D6).
