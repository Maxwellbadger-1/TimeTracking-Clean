# Nullwirkungs- und Wirkungsnachweis (Plan 11-10)

**Erstellt:** 2026-08-22 (Plan 11-10)
**Zweck:** Der Abschluss der Phase 11: der Wirkungsnachweis dort, wo gewirkt werden soll (der
Nutzer mit Modellwechsel bekommt für jeden Tag die richtigen Sollstunden), und der
Nullwirkungs-Nachweis überall sonst (kein Nutzer ohne Modellwechsel verliert oder gewinnt
eine Minute). Aufbau wie `.planning/phases/10-perioden-fundament/10-NULLWIRKUNG-NACHWEIS.md`
und `11-IDEMPOTENZ-NACHWEIS.md`: nummerierte Schritte, je Schritt der wörtliche Befehl und die
wörtliche Ausgabe, Urteilstabelle am Ende, Abschnitt „Was dieser Nachweis NICHT zeigt".

**Arbeitskopien:**
- `server/database/11-nullwirkung.db` — trägt Snapshot A (Plan 11-01), **nur gelesen** in
  diesem Plan.
- `server/database/11-modellwechsel.db` — trägt den künstlichen Nutzer mit Modellwechsel aus
  Plan 11-09 (`seed:model-change`, userId 12291, Stichtag 2026-05-14).

---

## Task 1: Der Nutzer mit Modellwechsel und die Tag-für-Tag-Gegenrechnung (Erfolgskriterium 1, D6)

### Teil 1 — Das Messwerkzeug

`server/src/scripts/verifyPeriodNullEffect.ts` wurde angelegt (npm-Skript
`verify:period-nulleffect`). Es liest `users` ungefiltert (`SELECT id FROM users` ohne
`WHERE deletedAt IS NULL`, wie `snapshotBalances.ts --all`), läuft für jeden Nutzer Tag für
Tag von `hireDate` bis `--asOf` und vergleicht je Tag zwei unabhängig berechnete Werte:

- **NEU:** `getDailyTargetHours(user, datum, ctx)` mit einem gemeinsamen
  `createWorkPeriodContext()` für den gesamten Lauf.
- **ALT:** die Regel vor dem Umbau, im Skript selbst ausgeschrieben
  (`altDailyTargetHours()`), gelesen ausschließlich aus den heutigen, flachen
  `users`-Spalten (`weeklyHours`, `workSchedule`, `hireDate`) — kein Perioden-Bezug.

Die Gegenrechnung importiert nichts aus der Datei mit `getDailyTargetHours` und ruft diese
Funktion nicht auf (`grep -c "workingDays" server/src/scripts/verifyPeriodNullEffect.ts` → 1,
der einzige Treffer ist der `await import('../utils/workingDays.js')` für die NEU-Seite).
Die Feiertagsabfrage benutzt dieselbe Tabelle und Abfrageform wie die periodengetreue
Auflösung (`SELECT 1 FROM holidays WHERE date = ?`). Die Tagesschleife baut jedes Datum aus
ganzzahligen Jahr/Monat/Tag-Komponenten und formatiert über `formatDate(date, 'yyyy-MM-dd')` —
kein `new Date('YYYY-MM-DD')`, kein `toISOString()`.

**Grep-Belege:**

```
$ grep -n "assertNotProduction\|await import" server/src/scripts/verifyPeriodNullEffect.ts
```
```
39: *   3. `assertNotProduction()` — synchron, bevor irgendetwas geöffnet wird.
40: *   4. Erst danach `await import(...)` der datenbankziehenden Module innerhalb von `main()`.
42: * Start über `tsx` — `await import()` bleibt damit ein echter dynamischer Import.
67:import { assertNotProduction } from './productionGuard.js';
282:  assertNotProduction();
305:  const { db } = await import('../database/connection.js');
306:  const { getDailyTargetHours } = await import('../utils/workingDays.js');
307:  const { createWorkPeriodContext } = await import('../services/workPeriodContext.js');
308:  const { formatDate } = await import('../utils/timezone.js');
```
`assertNotProduction()` (Zeile 282) steht vor jedem `await import()` (Zeilen 305-308) — die
Schutzprüfung läuft synchron, bevor irgendein datenbankziehendes Modul geladen wird.

```
$ grep -c "workingDays" server/src/scripts/verifyPeriodNullEffect.ts
1
```

```
$ grep -v "^\s*\*" server/src/scripts/verifyPeriodNullEffect.ts | grep -v "^\s*//" | grep -c "toISOString\|INSERT\|UPDATE\|DELETE\|\.run("
0
```

`npx tsc --noEmit` nach Anlage des Skripts: (leer — 0 Fehler).

### Teil 2 — Die Falsifizierbarkeitsprobe (T-11-39)

**Befehl:**
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npx tsx src/scripts/verifyPeriodNullEffect.ts --asOf=2026-06-30 --erwarte-abweichung=12291
```

**Wörtliche Ausgabe (Logger-Rauschen der Schema-Initialisierung entfernt):**
```
=== verifyPeriodNullEffect: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\11-modellwechsel.db
Dateigröße (vor Lauf): 1306624 Bytes
SHA-256 (vor Lauf): 5807ebcde44b73067faeca9a52c34878acfb2c895ff13c2a1df78f6e88e7261b
asOf: 2026-06-30
Erwartete abweichende userIds: [12291]

userId=12291: geprüfte Tage=546, abweichende Tage=31
  Abweichung 2026-05-15: ALT=8 NEU=4
  Abweichung 2026-05-18: ALT=8 NEU=4
  Abweichung 2026-05-19: ALT=8 NEU=4
  Abweichung 2026-05-20: ALT=8 NEU=4
  Abweichung 2026-05-21: ALT=8 NEU=4
  Abweichung 2026-05-22: ALT=8 NEU=4
  Abweichung 2026-05-26: ALT=8 NEU=4
  Abweichung 2026-05-27: ALT=8 NEU=4
  Abweichung 2026-05-28: ALT=8 NEU=4
  Abweichung 2026-05-29: ALT=8 NEU=4
  Abweichung 2026-06-01: ALT=8 NEU=4
  Abweichung 2026-06-02: ALT=8 NEU=4
  Abweichung 2026-06-03: ALT=8 NEU=4
  Abweichung 2026-06-05: ALT=8 NEU=4
  Abweichung 2026-06-08: ALT=8 NEU=4
  Abweichung 2026-06-09: ALT=8 NEU=4
  Abweichung 2026-06-10: ALT=8 NEU=4
  Abweichung 2026-06-11: ALT=8 NEU=4
  Abweichung 2026-06-12: ALT=8 NEU=4
  Abweichung 2026-06-15: ALT=8 NEU=4

=== Zusammenfassung ===
Nutzer geprüft (ungefiltert): 21
Nutzer mit Abweichung: 1 — userIds: [12291]
Erwartete abweichende userIds: [12291]
Übereinstimmung: ja
Dateigröße (nach Lauf): 1306624 Bytes
SHA-256 (nach Lauf): 5807ebcde44b73067faeca9a52c34878acfb2c895ff13c2a1df78f6e88e7261b
Unversehrtheit (SHA-256 gleich): ja

ERGEBNIS: Erwartung erfüllt (Exit 0).
```

**GENAU der eine Nutzer aus `seed:model-change` (userId 12291) weicht ab, alle anderen 20
Nutzer der Kopie weichen nicht ab.** ALT (8h, aus der heutigen, flachen `weeklyHours`-Spalte,
40h/Woche) und NEU (4h, aus der ab dem Stichtag gültigen Periode, 20h/Woche) sind genau die
erwarteten Werte — die Abweichung beginnt am ersten Werktag nach dem Stichtag (2026-05-15) und
zieht sich durch alle 31 gelisteten Werktage bis zum Ende des geprüften Zeitraums (die Liste
ist auf die ersten zwanzig begrenzt, insgesamt wurden 31 abweichende Tage gezählt).

**Gegenprobe der Falsifizierbarkeit:** Derselbe Lauf OHNE `--erwarte-abweichung` (Vorgabe:
keine Abweichung erwartet) endet mit `Übereinstimmung: nein` und `ERGEBNIS: Abweichung von der
Erwartung (Exit 1)` — das Werkzeug kann also tatsächlich fehlschlagen, wenn die Erwartung nicht
zur Realität passt. Damit ist belegt: Das Werkzeug findet Abweichungen dort, wo sie sind, und
meldet keine dort, wo keine sind.

### Teil 3 — Erfolgskriterium 1: Tagestabelle um den Stichtag

**Befehl** (ephemeres Hilfsskript, nach dem Lauf gelöscht, Muster wie
`tmp-11-09-gegenprobe.ts`):
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npx tsx src/scripts/tmp-11-10-tagestabelle.ts
```

**Wörtliche Ausgabe (formatiert als Tabelle):**

| Datum | Wochentag | Gültige Periode | Sollstunden |
|---|---|---|---|
| 2026-05-09 | Samstag | validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40 (alte Periode) | 0 |
| 2026-05-10 | Sonntag | validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40 (alte Periode) | 0 |
| 2026-05-11 | Montag | validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40 (alte Periode) | 8 |
| 2026-05-12 | Dienstag | validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40 (alte Periode) | 8 |
| 2026-05-13 | Mittwoch | validFrom=2025-01-01 validTo=2026-05-14 weeklyHours=40 (alte Periode) | 8 |
| **2026-05-14 (Stichtag)** | Donnerstag | **validFrom=2026-05-14 validTo=null weeklyHours=20 (NEUE Periode)** | 0 (Feiertag, s. u.) |
| 2026-05-15 | Freitag | validFrom=2026-05-14 validTo=null weeklyHours=20 (neue Periode) | 4 |
| 2026-05-16 | Samstag | validFrom=2026-05-14 validTo=null weeklyHours=20 (neue Periode) | 0 |
| 2026-05-17 | Sonntag | validFrom=2026-05-14 validTo=null weeklyHours=20 (neue Periode) | 0 |
| 2026-05-18 | Montag | validFrom=2026-05-14 validTo=null weeklyHours=20 (neue Periode) | 4 |
| 2026-05-19 | Dienstag | validFrom=2026-05-14 validTo=null weeklyHours=20 (neue Periode) | 4 |

```
checkPeriodChain(12291): {"ok":true,"findings":[]}
```

**Einordnung:**

- **Der Stichtag selbst (2026-05-14) gehört bereits zur NEUEN Periode** (`validFrom=2026-05-14`
  ist ihr erster gültiger Tag) — das belegt das halboffene Intervall `[validFrom, validTo)`
  (D1, Phase 10): `validTo=2026-05-14` der alten Periode schließt den 14. bereits AUS, und
  `validFrom=2026-05-14` der neuen Periode schließt ihn EIN. Vor dem Stichtag (13.05., letzter
  Tag der alten Periode) liefert die Berechnung 8h (40h/Woche), ab dem Stichtag (15.05., erster
  vollständiger Werktag der neuen Periode) 4h (20h/Woche) — **8 ≠ 4, die Sollstunden vor und
  nach dem Stichtag sind nachweislich verschieden.**
- **Beide Wochenenden liefern 0h**, unabhängig davon, welcher Periode sie angehören (Sa/So
  09./10.05. aus der alten 40h-Periode, Sa/So 16./17.05. aus der neuen 20h-Periode) — der
  Nutzer hat keinen individuellen Wochenplan (`workSchedule=null`), die Standard-5-Tage-Woche
  greift in beiden Perioden.
- **Der Stichtag selbst ist zusätzlich ein Feiertag** (Christi Himmelfahrt, bereits in
  `11-IDEMPOTENZ-NACHWEIS.md` Schritt 7 belegt): `getDailyTargetHours()` prüft den Feiertag vor
  der Periodenauflösung und liefert deshalb für den 14.05. `0h`, unabhängig vom Modell. Das ist
  die korrekte, dokumentierte Reihenfolge — kein Fehler dieser Tabelle. Dass der Stichtag
  bereits zur neuen Periode gehört, ist unabhängig davon an der Perioden-Spalte selbst ablesbar
  (`validFrom=2026-05-14`), nicht an den Sollstunden dieses einen (feiertagsüberlagerten) Tages.
- `checkPeriodChain(12291)` meldet `ok:true`, keine Findings — die Periodenkette dieses
  Nutzers ist lückenlos und widerspruchsfrei.

**Erfolgskriterium 1 ist damit belegt:** Der Nutzer mit Modellwechsel bekommt für jeden Tag die
Sollstunden, die an diesem Tag galten — vor dem Stichtag (8h, 5 Kalendertage geprüft) und nach
dem Stichtag (4h, 5 Kalendertage geprüft), inklusive der zwei Wochenenden aus beiden Perioden.

---

## Task 2: Nullwirkung auf der echten Population (D5, Erfolgskriterium 3)

### Schritt 1 — Unversehrtheit der Vergleichsgrundlage (VOR jeder Messung geprüft)

**Befehl** (ephemeres Hilfsskript, readonly, nach dem Lauf gelöscht):
```
$ cd server && DATABASE_PATH=./database/11-nullwirkung.db npx tsx src/scripts/tmp-11-10-unversehrtheit.ts
```

**Wörtliche Ausgabe:**
```
Migrationen 008/009: [{"name":"008_create_user_work_periods"},{"name":"009_backfill_user_work_periods"}]
integrity_check: {"integrity_check":"ok"}
Nutzerzahl (ungefiltert): 20
user_work_periods Zeilenzahl: { c: 20 }
checkPeriodChain findings: 0 von 20
resolveWorkPeriodAt(hireDate) unresolved: 0 []
Drift-Zahl: 0 []
Wochenend-Risiko: 0 []
letzter time_entries.date: {"d":"2026-08-20"}
```

Zusätzlich, WAL/SHM-Kontrolle:
```
$ ls -la server/database/11-nullwirkung.db*
-rw-r--r-- 1306624 Aug 22 07:01 server/database/11-nullwirkung.db
-rw-r--r-- 1     32768            server/database/11-nullwirkung.db-shm
-rw-r--r-- 1           0            server/database/11-nullwirkung.db-wal
```
Die `-wal`-Datei ist 0 Bytes (kein ungeschriebener Inhalt), die `-shm`-Datei ist eine reine
Speicherabbild-Hilfsdatei, die auch bei readonly-Zugriffen im WAL-Modus entsteht — beide
belegen keinen Schreibzugriff.

**Vergleich gegen `11-AUSGANGSZUSTAND.md` (Abschnitt „Zusammenfassung der fünf Kennzahlen"):**

| # | Kennzahl | Erwartet (`11-AUSGANGSZUSTAND.md`) | Gemessen (dieser Lauf) | Übereinstimmung |
|---|---|---|---|---|
| 1 | Migrationen 008/009 angewendet | ja, `integrity_check: ok` | ja, `integrity_check: ok` | ja |
| 2 | Nutzerzahl / Periodenzahl | 20 / 20 | 20 / 20 | ja |
| 3 | Datenvoraussetzung D4 (Periodenkette lückenlos) | 0 von 20 Findings, 0 unresolved | 0 von 20 Findings, 0 unresolved | ja |
| 4 | Drift-Zahl | 0 | 0 | ja |
| 5 | Wochenend-Risiko | 0 | 0 | ja |

**Alle fünf Kennzahlen sind unverändert. Die Vergleichsgrundlage ist unversehrt — kein
Abbruch, Task wird fortgesetzt.** (Ergänzend: der letzte `time_entries.date` ist mit
`2026-08-20` ebenfalls unverändert gegenüber `11-AUSGANGSZUSTAND.md` (f) — derselbe `--asOf`-
Wert ist für Snapshot B in Schritt 2 gültig.)

### Schritt 2 — Snapshot B

**Befehl:**
```
$ cd server && DATABASE_PATH=./database/11-nullwirkung.db npm run snapshot:balances -- --all --asOf=2026-08-20 --json=../.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.json
```

**Wörtliche Ausgabe:**
```
=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\11-nullwirkung.db
Dateigröße: 1306624 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 20
asOf: 2026-08-20

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
Vollständige Datei geschrieben: ../.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.json
Vergleichsdatei (nur users-Array) geschrieben: ../.planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.users.json

ERGEBNIS: Snapshot erhoben (Exit 0).
```

Derselbe `--all`, derselbe `--asOf=2026-08-20` wie Snapshot A (Plan 11-01,
`11-AUSGANGSZUSTAND.md` Task 2) — nur der Zielpfad unterscheidet sich.

### Schritt 3 — Byte-Vergleich

**Befehl:**
```
$ cmp .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-VORHER.users.json .planning/phases/11-datumsabh-ngige-berechnung/11-SNAPSHOT-NACHHER.users.json && echo IDENTISCH
IDENTISCH
```

Beide Dateien: 44785 Bytes, 20 Nutzer. **Byte für Byte identisch.** Keine `userId` weicht ab —
der Sonderfall „abweichender Nutzer ohne Modellwechsel" (der D5 verletzen würde) tritt nicht
ein.

### Schritt 4 — Das Loch bei den zwei soft-gelöschten Nutzern schließen

Der Byte-Vergleich in Schritt 3 belegt für `userId` 15 und 26 nur, dass ihre Stammdaten und die
gespeicherten `overtime_balance`-Zeilen unverändert sind (beide Snapshots halten für sie
`overtimeError: "User <id> not found"` statt eines berechneten Saldos, s.
`11-AUSGANGSZUSTAND.md`, Abschnitt „Bekannte Einschränkung"). Über den NEU BERECHNETEN Saldo
sagt der Byte-Vergleich nichts.

**Ersatzmessung:** `verify:period-nulleffect` geht NICHT über `unifiedOvertimeService` und
erfasst deshalb alle 20 Nutzer der Population, einschließlich der beiden soft-gelöschten.

**SHA-256 vor dem Lauf:**
```
$ node -e "console.log(require('crypto').createHash('sha256').update(require('fs').readFileSync('./database/11-nullwirkung.db')).digest('hex'))"
34f5d37e6872790288af792cbfd9b0c234b34d91ac20274892c951566248855e
```

**Befehl:**
```
$ cd server && DATABASE_PATH=./database/11-nullwirkung.db npm run verify:period-nulleffect -- --asOf=2026-08-20
```

**Wörtliche Ausgabe:**
```
=== verifyPeriodNullEffect: Ausgangslage ===
Aufgelöster Datenbankpfad: <repo>\server\database\11-nullwirkung.db
Dateigröße (vor Lauf): 1306624 Bytes
SHA-256 (vor Lauf): 34f5d37e6872790288af792cbfd9b0c234b34d91ac20274892c951566248855e
asOf: 2026-08-20
Erwartete abweichende userIds: (keine — Nullwirkung erwartet)

userId=1: geprüfte Tage=281, abweichende Tage=0
userId=2: geprüfte Tage=232, abweichende Tage=0
userId=3: geprüfte Tage=232, abweichende Tage=0
userId=15: geprüfte Tage=232, abweichende Tage=0
userId=16: geprüfte Tage=232, abweichende Tage=0
userId=17: geprüfte Tage=232, abweichende Tage=0
userId=18: geprüfte Tage=232, abweichende Tage=0
userId=19: geprüfte Tage=232, abweichende Tage=0
userId=20: geprüfte Tage=142, abweichende Tage=0
userId=21: geprüfte Tage=142, abweichende Tage=0
userId=22: geprüfte Tage=232, abweichende Tage=0
userId=23: geprüfte Tage=232, abweichende Tage=0
userId=24: geprüfte Tage=232, abweichende Tage=0
userId=25: geprüfte Tage=232, abweichende Tage=0
userId=26: geprüfte Tage=176, abweichende Tage=0
userId=27: geprüfte Tage=175, abweichende Tage=0
userId=28: geprüfte Tage=173, abweichende Tage=0
userId=29: geprüfte Tage=232, abweichende Tage=0
userId=30: geprüfte Tage=232, abweichende Tage=0
userId=31: geprüfte Tage=232, abweichende Tage=0

=== Zusammenfassung ===
Nutzer geprüft (ungefiltert): 20
Nutzer mit Abweichung: 0 — userIds: []
Erwartete abweichende userIds: []
Übereinstimmung: ja
Dateigröße (nach Lauf): 1306624 Bytes
SHA-256 (nach Lauf): 34f5d37e6872790288af792cbfd9b0c234b34d91ac20274892c951566248855e
Unversehrtheit (SHA-256 gleich): ja

ERGEBNIS: Erwartung erfüllt (Exit 0).
```

**SHA-256 vor und nach dem Lauf sind identisch** (`34f5d37e...8855e`) — das Werkzeug hat nicht
geschrieben.

**Die beiden soft-gelöschten Nutzer namentlich:**

| userId | deletedAt (aus `11-AUSGANGSZUSTAND.md`/Snapshots) | geprüfte Tage | abweichende Tage |
|---|---|---|---|
| 15 | 2026-02-28 14:01:48 | 232 | 0 |
| 26 | 2026-02-27 15:50:29 | 176 | 0 |

**Für beide ist damit belegt, was der Byte-Vergleich nicht belegen konnte: Der über die
periodengetreue Auflösung neu berechnete Sollstunden-Wert bewegt sich für keinen ihrer
geprüften Tage.**

**Alle 20 Nutzer der Population (nicht nur eine gefilterte Teilmenge) sind geprüft** — die
Zahl deckt sich mit `11-AUSGANGSZUSTAND.md` (b) (20 Nutzer).

### Schritt 5 — Was dieser Nachweis NICHT zeigt

- **Er gilt für den Datenstand der Kopie `11-nullwirkung.db` zum Zeitpunkt dieses Plans**
  (Snapshot vom 20.08.2026), nicht für einen späteren Produktionsstand. Ein künftiger
  Produktionslauf kann andere Nutzer, andere Perioden oder andere Randfälle enthalten.
- **Er ersetzt nicht die Generalprobe der Phase 14** gegen eine echte, aktuelle Kopie der
  Produktionsdatenbank — diese Kopie ist bewusst eingefroren (Plan 11-01) und wird seither nur
  gelesen.
- **Der Byte-Vergleich (Schritt 3) deckt für die zwei soft-gelöschten Nutzer (userId 15, 26)
  nur Stammdaten und gespeicherte `overtime_balance`-Zeilen ab**, nicht den berechneten Saldo
  über den kanonischen Lesepfad (`unifiedOvertimeService.getUser()` filtert `deletedAt IS
  NULL` und wirft für sie "User <id> not found"). Der berechnete Saldo ist für diese beiden
  ausschließlich über die Tag-für-Tag-Gegenrechnung in Schritt 4 belegt, nicht über den
  kanonischen Lesepfad.
- **Die Tag-für-Tag-Gegenrechnung (`verifyPeriodNullEffect.ts`) vergleicht Sollstunden, nicht
  Ist-Stunden und nicht Urlaubssalden.** Eine Nullwirkung bei den Ist-Stunden oder
  Urlaubssalden dieser beiden Nutzer ist damit nicht geprüft — dafür bleibt ausschließlich der
  (für sie nicht auflösbare) Byte-Vergleich der Stammdaten und `overtime_balance`-Zeilen als
  Beleg.
- **Keine Aussage über konkurrierende Schreibzugriffe während der Messung.** Beide Snapshots
  und der `verify:period-nulleffect`-Lauf liefen sequenziell gegen eine private, nicht vom
  Dev-Server geöffnete Arbeitskopie — keine Aussage über Nebenläufigkeit zweier gleichzeitiger
  Leser/Schreiber auf derselben Datenbank.

---

## Task 3: Das Validierungswerkzeug am Modellwechsel-Nutzer (REQ-25, Erfolgskriterium 4)

### Schritt 1 — REQ-25 in drei Monaten

**Stichtagsmonat (2026-05):**
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npm run validate:overtime:detailed -- --userId=12291 --month=2026-05
```
Auszug der Ausgabe (Perioden-Block, REQ-25-Zeile aus Plan 11-08):
```
📐 GÜLTIGE PERIODEN (REQ-25 — periodengültiger Maßstab)
────────────────────────────────────────────────────────────────────────────────
  2025-01-01 bis 2026-05-14 — 40h/Woche
  2026-05-14 bis (laufend) — 20h/Woche
```
Drei-Wege-Vergleich und Urteil:
```
┌────────────────────────┬──────────────┬──────────────┬──────────────┬────────┐
│ Component              │ Calculated   │ Database     │ Transactions │ Match  │
├────────────────────────┼──────────────┼──────────────┼──────────────┼────────┤
│ Target Hours (Soll)    │     104.00h  │     104.00h  │          —   │ ✅     │
│ Actual Hours (Ist)     │     168.00h  │     168.00h  │      64.00h  │ ✅     │
│ Overtime Balance       │ +    64.00h  │ +    64.00h  │ +    64.00h  │ ✅✅   │
└────────────────────────┴──────────────┴──────────────┴──────────────┴────────┘
...
🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```
**Keine Abweichung.** 0 gemeldete Abweichungen.

**Vormonat (2026-04, vollständig unter altem Modell 40h/Woche):**
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npm run validate:overtime:detailed -- --userId=12291 --month=2026-04
```
```
📐 GÜLTIGE PERIODEN (REQ-25 — periodengültiger Maßstab)
────────────────────────────────────────────────────────────────────────────────
  2025-01-01 bis 2026-05-14 — 40h/Woche
  2026-05-14 bis (laufend) — 20h/Woche
...
🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```
**Keine Abweichung.**

**Folgemonat (2026-06, vollständig unter neuem Modell 20h/Woche):**
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npm run validate:overtime:detailed -- --userId=12291 --month=2026-06
```
```
📐 GÜLTIGE PERIODEN (REQ-25 — periodengültiger Maßstab)
────────────────────────────────────────────────────────────────────────────────
  2025-01-01 bis 2026-05-14 — 40h/Woche
  2026-05-14 bis (laufend) — 20h/Woche
...
🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```
**Keine Abweichung.**

**Erwartung nach REQ-25 in allen drei Monaten erfüllt: keine Abweichung.** Kein Befehl in
diesem Abschnitt nennt `production.db`, `11-nullwirkung.db` oder eine SSH-Verbindung — jeder
Lauf trägt `DATABASE_PATH=./database/11-modellwechsel.db`.

### Schritt 2 — Gegenprobe: Bestandsnutzer ohne Modellwechsel

**Befehl:**
```
$ cd server && DATABASE_PATH=./database/11-modellwechsel.db npm run validate:overtime:detailed -- --userId=3 --month=2026-05
```
Nutzer 3 (Christine Glas, Bestandsnutzerin, individueller Wochenplan, 8h/Woche, kein
Modellwechsel):
```
🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```
**Keine Abweichung.** Der neue, periodengültige Maßstab erzeugt auch im Normalfall (Nutzer
ohne Modellwechsel) keinen Scheinbefund.

### Schritt 3 — Urteilstabelle über alle vier Erfolgskriterien der Phase

| # | Erfolgskriterium (`.planning/ROADMAP.md`, Abschnitt „Phase 11", wörtlich) | Urteil | Fundstelle |
|---|---|---|---|
| 1 | „Ein Testnutzer mit Modellwechsel bekommt für jeden Tag die Sollstunden, die an diesem Tag galten — vor und nach dem Stichtag geprüft" | **erfüllt** | Dieses Dokument, Task 1, Teil 3 (Tagestabelle 2026-05-09 bis 2026-05-19) |
| 2 | „Ein zweifach ausgeführter Rebuild liefert identische Ergebnisse" | **erfüllt** | `.planning/phases/11-datumsabh-ngige-berechnung/11-IDEMPOTENZ-NACHWEIS.md`, Schritt 5 (alle drei Monate byte-identisch zwischen Lauf 1 und Lauf 2) |
| 3 | „Für Nutzer ohne Modellwechsel sind alle Salden vor und nach dem Umbau unverändert" | **erfüllt** | Dieses Dokument, Task 2, Schritt 3 (Byte-Vergleich, IDENTISCH) und Schritt 4 (Tag-für-Tag-Gegenrechnung, 0 Abweichungen bei allen 20 Nutzern inkl. userId 15/26) |
| 4 | „Das Validierungswerkzeug meldet bei einem Nutzer mit Modellwechsel keine Abweichung" | **erfüllt** | Dieses Dokument, Task 3, Schritt 1 (drei Monatsläufe `validate:overtime:detailed`, alle `PASSED`) |

**Alle vier Erfolgskriterien der Phase tragen ein Urteil mit Fundstelle.**

---

## Was dieser Nachweis insgesamt NICHT zeigt

Zusätzlich zu den in Task 2, Schritt 5 genannten Punkten:

- **Kein Nachweis über einen Modellwechsel im Produktionsbestand** — der künstliche Nutzer
  (userId 12291) lebt ausschließlich in der Arbeitskopie `11-modellwechsel.db`. Ob ein echter
  Produktionsnutzer einen Modellwechsel korrekt durchläuft, ist Gegenstand der Generalprobe in
  Phase 14.
- **Kein Nachweis über die Desktop-Anzeige bei einem Nutzer mit Modellwechsel** — die
  Desktop-Disposition (`11-DESKTOP-DISPOSITION.md`) verschiebt diese Prüfung ausdrücklich nach
  Phase 12, weil der Desktop in Phase 11 noch keinen Weg hat, eine zweite Periode überhaupt
  entstehen zu lassen oder anzuzeigen.
- **Kein Nachweis über die Frontend-API-Validierung** in `validate:overtime:detailed` — der
  lokale Server lief für diese Läufe nicht, die Frontend-Prüfung wurde deshalb übersprungen
  (`⚠️ Could not fetch from Frontend API`). Das betrifft nur den optionalen Vier-Wege-Vergleich
  dieses Werkzeugs, nicht die hier belegten Datenbank-/Transaktions-Vergleiche.

---

## Abschlusszahlen für die SUMMARY

- **`11-nullwirkung.db` unverändert:** SHA-256 vor und nach dem `verify:period-nulleffect`-Lauf
  identisch (`34f5d37e6872790288af792cbfd9b0c234b34d91ac20274892c951566248855e`), Dateigröße vor
  und nach dem gesamten Plan unverändert (1306624 Bytes).
- **Testsuite gegenüber `11-AUSGANGSZUSTAND.md`:** dieser Plan hat keinen Produktionscode
  geändert (nur ein neues, eigenständiges Validierungsskript und Dokumentation) — die
  verbindliche Referenz „genau drei vorbestehende rote Tests" bleibt unverändert (zuletzt in
  `11-IDEMPOTENZ-NACHWEIS.md`, Schritt 8, mit Zeile-für-Zeile-Abgleich bestätigt).
- **Blockierende Befunde in diesem Plan: keine.**
