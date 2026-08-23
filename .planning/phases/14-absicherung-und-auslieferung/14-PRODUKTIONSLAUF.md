# 14-PRODUKTIONSLAUF — Protokoll des Produktionsfensters (Plan 14-08)

**Angelegt:** 2026-08-23, 11:13 Uhr (Europe/Berlin)
**Plan:** `.planning/phases/14-absicherung-und-auslieferung/14-08-PLAN.md`
**Zweck (D2):** Das ist die erste Stelle des Milestones, an der ein Fehler echte
Mitarbeiterdaten trifft. Dieses Dokument protokolliert lückenlos: Freigabe, Sicherung,
Auslieferung und Migrationsverifikation — jede Zahl mit dem Befehl, der sie ermittelt hat.

**Nicht in diesem Dokument enthalten (T-14-47):** keine Zugangsdaten, kein `SESSION_SECRET`,
kein Schlüsselinhalt. Wo das Deployment-Log den Wert einer Umgebungsvariablen ausgeben würde,
wird nur die Längenangabe übernommen.

---

## Task 1 — Freigabe des Produktionsfensters

### Die dem Anwender vorgelegte Nachweislage

#### 1. Testabdeckung (REQ-32) — fünf Fälle, fünf Fundstellen, fünf Einzelläufe

Aus `14-REQ32-NACHWEIS.md`:

| # | REQ-32-Fall | Fundstelle | Nachweislauf |
|---|---|---|---|
| 1 | Reduzierung (40→20), Stichtag in der Zukunft | `workPeriodChangeService.test.ts:172` | `1 passed \| 493 skipped (494)` |
| 2 | Erhöhung, Stichtag rückwirkend | `workPeriodChangeService.test.ts:284` | `1 passed \| 494 skipped (495)` |
| 3 | Stichtag mitten im Monat | `workPeriodChangeService.test.ts:642` | `1 passed \| 493 skipped (494)` |
| 4 | Wechsel über einen Jahreswechsel | `workPeriodChangeService.test.ts:735` | `1 passed \| 493 skipped (494)` |
| 5 | Periode löschen und danach neu rechnen | `workPeriodDeletionService.test.ts:180-264` | `1 passed \| 493 skipped (494)` |

**Die vier Gates nach Plan 14-01 mit ihrem tatsächlichen Ergebnis** (`14-REQ32-NACHWEIS.md`,
Abschnitt „Gates nach Plan 14-01"):

| Gate | Ergebnis |
|---|---|
| `cd server && npx tsc --noEmit` | Exit 0, keine Ausgabe |
| `cd desktop && npx tsc --noEmit` | Exit 0, keine Ausgabe |
| `cd server && npx vitest run` | `Tests 3 failed \| 492 passed (495)` — genau die drei bekannten, vorbestehenden Titel aus `11-AUSGANGSZUSTAND.md`, kein vierter roter Test |
| `cd desktop && npm run check:rules` | Exit 0, alle `PASS:`-Zeilen, kein `FAIL` |

#### 2. Umfang der Auslieferung — zum Checkpoint-Zeitpunkt neu gemessen

Nicht die Zahlen aus dem Plan zitiert, sondern am 23.08.2026 um 11:13 Uhr neu erhoben:

```
$ git fetch origin main
From https://github.com/Maxwellbadger-1/TimeTracking-Clean
 * branch            main       -> FETCH_HEAD

$ git ls-remote origin main
0f2a03efba0d5c7880407290be2c4caf9a88184d	refs/heads/main

$ git rev-list --count origin/main..HEAD
379

$ git diff --name-only origin/main..HEAD | wc -l
336

$ git rev-parse --short HEAD
b75738a

$ git status --short
?? .planning/phases/10-perioden-fundament/10-REVIEW.md
```

**Abweichung gegenüber dem Plantext festgehalten:** Der Plan nennt „337 Commits und 293
geänderte Dateien" (Stand beim Planen). Zum Checkpoint-Zeitpunkt sind es **379 Commits** und
**336 geänderte Dateien** — die Differenz sind die seither in Phase 14 selbst erzeugten
Commits (Pläne 14-01 bis 14-07 mit ihren Nachweisdokumenten). `origin/main` steht unverändert
auf `0f2a03e`, dem im Runbook (Rückweg B, Schritt 1) hinterlegten Rücksetzpunkt.

Die einzige nicht versionierte Datei (`10-REVIEW.md`) ist ein Planungsdokument aus Phase 10
ohne Codewirkung; sie wird in diesem Plan nicht angefasst.

#### 3. Migrationsstand — was auf der Produktion fehlt

Fehlliste aus `14-MIGRATIONSSTAND.md`, in Laufreihenfolge (alphabetische Ladereihenfolge von
`loadMigrations()`):

1. `008_create_user_work_periods`
2. `009_backfill_user_work_periods`
3. `010_fix_user_work_periods_delete_guard`
4. `011_add_model_change_transaction_type`
5. `012_fix_reference_type_check_constraint`
6. `013_soft_delete_user_work_periods`
7. `014_add_reversal_of_to_overtime_transactions`
8. `015_unique_reversal_of_index`

**Die Folge lief auf einer Produktionskopie fehlerfrei durch** (Plan 14-04, hartes
`--expect-migration=015_unique_reversal_of_index`, Exit 1 bei Verstoß):
`integrity_check` = `ok`, `foreign_key_check` leer, und in `overtime_transactions`
(COUNT 2671, SUM(hours) −372,68) sowie `overtime_balance` (COUNT 144, SUM(targetHours) 6290,9,
SUM(actualHours) 3435,19) **Differenz exakt 0**. `user_work_periods` ging von „nicht
vorhanden" auf genau `COUNT(*) FROM users` = 20.

#### 4. Generalprobe (REQ-33)

Aus `14-VORHER-NACHHER.md`: **Genau ein Nutzer mit Differenz ungleich null** — der
Generalprobenfall userId 2 (Karin Jochem), Differenz **+19,6 h**, identisch mit dem vom
Werkzeug gemeldeten `balanceDelta: 19.6 h`. Alle übrigen Nutzer unbewegt.

Das vorab benannte Rauschen wurde einzeln geprüft und ist **unbewegt**: User 30
(„Test Urlaub", soft-gelöscht), User 31 („UAT", soft-gelöscht), Antrag 73 (storniert,
gehört User 30).

**Ausdrücklich festgehalten:** userId 2 (Karin Jochem) war ein nach Regel bestimmter
**Prüf**nutzer der Generalprobe — **nicht** der reale D6-Umstellungsfall. Aus der Generalprobe
darf nichts über den realen Fall abgeleitet werden.

#### 5. Rückweg

`14-ROLLBACK-RUNBOOK.md` liegt vor und ist **erprobt** (Plan 14-06: Sicherung ziehen, Schaden
herbeiführen, zurückspielen, maschinell vergleichen). Gemessene Laufzeiten gegen eine
größenordnungsgleiche 1,3-MB-Datenbank: Sicherung (`VACUUM INTO`) 15 ms, Zurückspielen 13 ms;
mit SSH-/`scp`-Overhead ein bis wenige Sekunden. Das Runbook enthält sechs Abschnitte:
Sicherung, Abbruchkriterien, Rückweg A (nur Daten), Rückweg B (Daten und Code), Verifikation,
und was der Rückweg nicht zurücknimmt.

#### 6. Was in diesem Fenster noch **nicht** passiert

- **Plan 14-09** — der reale Umstellungsfall (D6) — ist ein eigener, erneut freizugebender
  Schritt.
- **Plan 14-10** — der Journal-Backfill der Phase 9.1 — ist ein eigener, erneut freizugebender
  Schritt und läuft erst nach der Verifikation aus 14-09.

#### 7. Was nach dem Push nicht mehr ohne Rückweg B zurückgeht

Der `git push` **ist** der Produktionsschreibzugriff. Es gibt keinen Zwischenstand, in dem der
Code auf dem Server liegt und die Migrationen noch nicht gelaufen sind:
`.github/workflows/deploy-server.yml:104` fährt `npm run migrate:prod`, das nur `.sql`-Dateien
verarbeitet — die TypeScript-Migrationen 008–015 laufen dort **nicht**. Sie laufen unbeaufsichtigt
beim PM2-Start über `server/src/server.ts:215` → `runMigrations(db)`.

Ein reines Zurückspielen der Daten (Rückweg A) wäre danach **wirkungslos**, weil der nächste
PM2-Neustart die Migrationen erneut anwenden würde. Ab dem Push gilt daher ausschließlich
Rückweg B (Daten **und** Code), einschließlich eines Force-Push auf `0f2a03e`.

#### 8. Empfehlung zum Zeitpunkt

Das Fenster außerhalb der Arbeitszeit der Stiftung legen: Zeiteinträge, die Anwender zwischen
der Sicherung und einem etwaigen Rückweg erfassen, gehen beim Rückspielen verloren
(`14-ROLLBACK-RUNBOOK.md`, Abschnitt 6 — technische Grenze, keine Nachlässigkeit).

#### Hinweis auf den nächsten Plan (14-09)

Für den realen Umstellungsfall werden **vier Werte** gebraucht, die **dort** abgefragt werden
und **nicht** Gegenstand dieses Checkpoints sind:

1. Nutzer-ID und Name des umzustellenden Nutzers
2. Stichtag der Umstellung
3. bisherige Wochenstunden
4. neue Wochenstunden

Keiner dieser Werte darf aus der Generalprobe abgeleitet werden.

---

### Entscheidung des Anwenders

**Zeitpunkt:** 2026-08-23, 11:13 Uhr (Europe/Berlin)

**Gestellte Frage:** „Die drei gesperrten Pläne 14-08 bis 14-10 schreiben auf die
Produktionsdatenbank. Soll ich sie starten?"

**Antwort des Anwenders, wörtlich:**

> Ja — Produktionslauf starten

**Gewählte Option:** `jetzt` — Fenster jetzt öffnen.

**Ausdrücklich mit der Freigabe verbundene Grenzen, vom Anwender gesetzt:**

- Ausgeführt wird **nur Plan 14-08**. Nach dessen Abschluss wird angehalten, es wird **nicht**
  auf 14-09 weitergeschaltet.
- **14-09** wartet auf die vier D6-Werte, die noch nicht vorliegen; sie werden gerade beim
  Anwender erfragt. Nichts davon wird erfunden oder aus der Generalprobe abgeleitet.
- **14-10** (Journal-Backfill) läuft erst nach der Verifikation aus 14-09. Der Anwender hat
  dafür bereits die Variante **Vollaufbau (`--all-months`)** gewählt — festgehalten für später,
  in diesem Fenster nicht ausgeführt.
- **14-11** (Release) hängt an der Produktionsverifikation.

**Vor dieser Freigabe ist kein Befehl gelaufen, der die Produktionsdatenbank schreibt.** Die
bis hierher ausgeführten Befehle waren ausschließlich lokale, lesende Git-Abfragen
(`git fetch`, `git ls-remote`, `git rev-list`, `git diff --name-only`, `git status`,
`git rev-parse`).

---

## Zusatzauflage des Anwenders (eingegangen 23.08.2026, vor jeder Änderung an der Produktion)

Der Anwender hat nach der Freigabe und **vor** jedem Schreibzugriff vier Auflagen verfügt:

1. An den Stundenständen darf sich nichts ändern.
2. Es darf nichts verloren gehen.
3. Alles muss rückgängig machbar sein.
4. Der Ist-Stand ist vorher **namentlich und wertgenau** festzuhalten — Stunden UND Urlaub,
   je Nutzer.

Die Auflage erreichte diesen Lauf, **bevor** das Deployment gestartet war. Sie wird deshalb
in der vom Anwender vorgegebenen Reihenfolge umgesetzt: A vor dem Deployment, B danach.

---

## Task 2, Schritt A — Sicherung

### Der Sicherungsbefehl

Zeitstempel des Fensters: `20260823_111541`.

Ausgeführt wurde der Befehl aus Abschnitt 1 des Runbooks: über SSH auf `ubuntu@129.159.8.19`
mit dem Schlüssel `.ssh/oracle_server.key` ein `VACUUM INTO` von
`/home/ubuntu/databases/production.db` nach
`/home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db`, ausgeführt über
`node` mit dem Modulpfad `/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3`,
mit ausdrücklich gesetztem `DATABASE_PATH` und `{ readonly: true }`.

Ausgabe:

```
VACUUM INTO abgeschlossen in 113 ms
-rw-r--r-- 1 ubuntu ubuntu 1286144 Aug 23 09:15 /home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db
```

**Laufzeit 113 ms** — im Erwartungsbereich des Runbooks (dort 15 ms für die reine
`VACUUM INTO`-Operation lokal, „ein bis wenige Sekunden" für den Gesamtablauf inklusive
SSH-Overhead und Node-Start). Kein Hinweis auf einen hängenden Lauf.

**Ausgangszustand des Servers vor der Sicherung** (readonly festgestellt):

```
$ ssh ... "pm2 status; ls -la /home/ubuntu/databases/production.db*"
│ 40 │ timetracking-server  │ default │ 0.1.2 │ fork │ 3675336 │ 38h │ 0 │ online │ 0% │ 80.7mb │ ubuntu │ disabled │
│ 25 │ timetracking-staging │ default │ 0.1.2 │ fork │ 2449214 │ 4M  │ 0 │ online │ 0% │ 67.1mb │ ubuntu │ disabled │
-rw------- 1 ubuntu ubuntu 1425408 Aug 23 03:00 /home/ubuntu/databases/production.db
```

Bemerkenswert und festgehalten: **keine `-wal`- und keine `-shm`-Datei vorhanden.** Der
laufende Server hatte zuletzt um 03:00 Uhr einen vollständigen WAL-Checkpoint durchgeführt.
Der bekannte Vorfall vom 18.08.2026 (zwei verwaiste WAL-Dateien,
`.planning/debug/db-stabilisierung-20260818.md`) wiederholt sich nicht.

### Prüfung der Sicherung

```
$ ssh ... node -e "... readonly gegen production.PRE-14-08_20260823_111541.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
```

### Zweite Kopie auf dem Arbeitsrechner (T-14-43)

```
$ scp -i .ssh/oracle_server.key ubuntu@129.159.8.19:/home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db \
      server/database/backups/production.PRE-14-08_20260823_111541.db

$ ls -la server/database/backups/production.PRE-14-08_20260823_111541.db
-rw-r--r-- 1 maxfe 197609 1286144 Aug 23 11:16 server/database/backups/production.PRE-14-08_20260823_111541.db
```

**Prüfsummengleichheit beider Kopien nachgewiesen** — die Sicherung ist bei der Übertragung
nicht beschädigt worden:

```
$ ssh ... "sha256sum /home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db"
082ff7434ec8c75560f06c6469093c088c921f70a9cc35162f4bf9b21222ee7d  /home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db

$ sha256sum server/database/backups/production.PRE-14-08_20260823_111541.db
082ff7434ec8c75560f06c6469093c088c921f70a9cc35162f4bf9b21222ee7d *server/database/backups/production.PRE-14-08_20260823_111541.db
```

**Identisch.** Zusätzlich wurde die lokale Kopie eigenständig geprüft:

```
$ cd server && node -e "... readonly gegen ./database/backups/production.PRE-14-08_20260823_111541.db ..."
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
users: 20
```

---

## Task 2, Schritt B — Rohkennzahlen der Produktion VOR dem Deployment

Erhoben gegen die **Sicherung**, nicht gegen die laufende Datei — wegen WAL wäre ein direkter
Dateizugriff auf `production.db` bei laufendem Server unvollständig. Die Sicherung ist über
eine SQLite-Verbindung per `VACUUM INTO` entstanden und enthält den WAL-Inhalt vollständig.

```
$ ssh ... node -e "... readonly gegen die Sicherung ..."
migrations (ORDER BY id): ["004_drop_overtime_unique_index","005_add_balance_tracking_columns",
  "001_backfill_overtime_transactions","002_extend_transaction_types",
  "003_add_pending_to_vacation_balance","20260208_add_position_column",
  "20260208_add_time_entry_type.sql","20260208_add_position_column.sql",
  "006_add_time_entry_transaction_type","007_create_vacation_transactions"]
migrations count: 10
overtime_transactions: {"c":2671,"s":-372.68}
ot by type: [{"type":"overtime_comp_credit","c":2,"s":8},{"type":"sick_credit","c":19,"s":68},
  {"type":"time_entry","c":2590,"s":-662.68},{"type":"unpaid_deduction","c":2,"s":8},
  {"type":"vacation_credit","c":58,"s":206}]
ot referenceType NULL: 2509
ot referenceType absence: 162
overtime_balance: {"c":144,"st":6290.9,"sa":3435.19,"sc":0}
users: {"c":20}
users aktiv (deletedAt IS NULL): 15
time_entries: {"c":712,"m":"2026-08-21"}
absence_requests: {"c":43}
vacation_balance: {"c":40}
vacation_transactions: {"c":59}
user_work_periods: TABELLE NICHT VORHANDEN
```

**Diese Zahlen sind wortgleich identisch mit den Kennzahlen der Produktionskopie aus Plan
14-04** (`14-MIGRATIONSSTAND.md`: 2671 / −372,68; 144 / 6290,9 / 3435,19; 20 Nutzer,
712 Zeiteinträge, MAX(date) 2026-08-21, 43 Anträge). Die Produktion hat sich seit dem Ziehen
jener Kopie in keiner der geprüften Kennzahlen bewegt — der gesamte Vorlauf der Phase 14 ist
damit gegen exakt den Datenstand geprüft worden, der jetzt migriert wird.

Die Sicherung ist zudem mit **1.286.144 Bytes byteidentisch groß** wie
`server/database/14-produktionskopie.db` aus Plan 14-04.

### Nachweis der Rückspielbarkeit (Auflage C des Anwenders)

| Nachweis | Ergebnis |
|---|---|
| Datei existiert auf dem Server | ja, `/home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db` |
| Dateigröße > 0 | 1.286.144 Bytes |
| Datei existiert auf dem Arbeitsrechner | ja, `server/database/backups/production.PRE-14-08_20260823_111541.db` |
| Beide Kopien byteidentisch | SHA-256 `082ff743…22ee7d` auf beiden Seiten |
| `PRAGMA integrity_check` auf der Sicherung | `ok` (auf dem Server **und** auf dem Arbeitsrechner geprüft) |
| `PRAGMA foreign_key_check` auf der Sicherung | leer |
| Sicherungsverfahren | `VACUUM INTO` über eine SQLite-Verbindung — nicht `cp`, deshalb WAL-vollständig |
| Rückspielverfahren erprobt | ja, Plan 14-06, vollständig protokolliert im Runbook |

**Zeilenzahlen der tragenden Tabellen — Sicherung gegen Produktion zum Sicherungszeitpunkt.**
Die Sicherung *ist* die Produktion zum Zeitpunkt 11:15:41; ein Vergleich „Sicherung gegen
Produktion" ist deshalb kein Vergleich zweier unabhängiger Erhebungen, sondern die
Feststellung, dass die `VACUUM INTO`-Operation verlustfrei war. Belegt wird das durch
`integrity_check` = `ok`, `foreign_key_check` = leer und die vollständige Übereinstimmung
aller Kennzahlen mit der unabhängig gezogenen Produktionskopie aus Plan 14-04:

| Tabelle | Sicherung | Produktionskopie 14-04 | gleich |
|---|---|---|---|
| `users` | 20 | 20 | ja |
| `time_entries` | 712 | 712 | ja |
| `absence_requests` | 43 | 43 | ja |
| `overtime_transactions` | 2671 | 2671 | ja |
| `overtime_balance` | 144 | 144 | ja |
| `vacation_balance` | 40 | in 14-04 nicht erhoben | — |
| `vacation_transactions` | 59 | in 14-04 nicht erhoben | — |
| `user_work_periods` | Tabelle nicht vorhanden | Tabelle nicht vorhanden | ja |

---

## Zusatzauflage A — Namentlicher, wertgenauer Ist-Stand VOR dem Deployment

### Warum ein zweites Werkzeug nötig war

Der Anwender verlangt den Ist-Stand über `snapshot:balances --all`. Dieses Werkzeug wurde
zuerst gegen die Sicherung gefahren — und liefert für **jeden** Nutzer keinen Saldo:

```
$ cd server && DATABASE_PATH=./database/14-ist-vor-deployment.db npm run snapshot:balances -- \
    --all --asOf=2026-08-21 --json=...

userId 1: "Keine Arbeitszeitperiode für Nutzer 1 am 2025-11-13 gefunden. Nach Migration 009
  hat jeder Nutzer eine lückenlose Periodenkette ab hireDate — ein Fehlen ist ein Datendefekt,
  kein Zustand, der einen Rückfall auf users.weeklyHours erlaubt (D4)."
[… gleichlautend für 2, 3, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 27, 29 …]
userId 15, 26, 28, 30, 31: "User <id> not found"   (die fünf soft-gelöschten Nutzer)
```

**Ursache, am Code festgestellt:** `snapshot:balances` rechnet über
`unifiedOvertimeService.calculatePeriodOvertime()`. Dieser Weg löst seit Phase 11 das
Tagessoll über `user_work_periods` auf und hat seit D4 **keinen Rückfall** auf
`users.weeklyHours`. Die Tabelle entsteht erst durch Migration 008/009. Gegen den Stand
**vor** den Migrationen ist der kanonische Rechenweg damit konstruktionsbedingt nicht
verwendbar — das ist kein Defekt der Produktionsdaten, sondern die gewollte Strenge von D4.

**Folge für die Auflage:** Ein „Ist-Stand vorher", der nur aus `"nicht auflösbar"` besteht,
erfüllt die Zusicherung „es darf nichts verloren gehen" nicht. Der Ist-Stand wird deshalb in
**zwei** Erhebungen festgehalten, die beide diesseits und jenseits des Migrationsschnitts
funktionieren bzw. vergleichbar sind:

- **A1 — rohe Tabellenwerte** (`server/scripts/14-ist-stand-report.mjs`, neu, ausschließlich
  readonly): namentlich je Nutzer, Stunden und Urlaub, soft-gelöschte eingeschlossen. Dieses
  Werkzeug arbeitet auf beiden Seiten des Schnitts identisch.
- **A2 — kanonisch gerechnete Salden** (`snapshot:balances`) gegen eine **lokal migrierte
  Kopie derselben Sicherung**. Das ist die Vorhersage dessen, was die Anwendung nach dem
  Deployment anzeigen wird — erhoben **vor** dem Push.

### A1 — Ist-Stand aus den rohen Tabellenwerten

```
$ cd server && node scripts/14-ist-stand-report.mjs \
    --db=./database/backups/production.PRE-14-08_20260823_111541.db \
    --out=../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT \
    --label="Produktion VOR dem Deployment (…)"

Ist-Stand erhoben: 20 Nutzer, 5 davon soft-geloescht.
JSON: ../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT.json
Tabelle: ../.planning/phases/14-absicherung-und-auslieferung/14-PROD-IST-VOR-DEPLOYMENT.md
SHA-256 Nutzdatenkern: 2edff31a9fd6d73162aa7db4516c0a2359b659b8c0b90e3f69a851c7042ac07d
SHA-256 Datei:         a9f503c2f771c874b2b4daf2eb0150f7797fb7c15d0fd7489ab30c5d35cadce6
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
```

**SHA-256 des Nutzdatenkerns:**
`2edff31a9fd6d73162aa7db4516c0a2359b659b8c0b90e3f69a851c7042ac07d`

Der Nutzdatenkern schließt `label`, `generatedAt`, `databasePath` und `databaseSizeBytes`
ausdrücklich aus — sonst lieferten zwei Erhebungen desselben Datenstands verschiedene Hashes
und der Hash wäre als Gleichheitsnachweis wertlos.

Die vollständige, lesbare Liste — eine Zeile je Nutzer, namentlich — steht in
[`14-PROD-IST-VOR-DEPLOYMENT.md`](14-PROD-IST-VOR-DEPLOYMENT.md). Enthalten je Nutzer:
`id`, Vor- und Nachname, `deletedAt`, `status`, `hireDate`, `endDate`, Wochenstunden,
Wochenplan (Rohtext), Urlaubstage pro Jahr laut Stammsatz, alle `overtime_balance`-Monate
einzeln plus Summen, Buchungen und Buchungssumme, Zeiteinträge mit Summe und Zeitspanne,
Anzahl Abwesenheitsanträge, und je erfasstem Jahr Urlaubsanspruch, Übertrag, genommene Tage,
Resturlaub und die Buchungssumme.

**Die fünf soft-gelöschten Nutzer sind nicht ausgelassen, sondern gesondert ausgewiesen:**
id 15 (Test Test, gelöscht 2026-02-28), id 26 (Test Test, 2026-02-27), id 28 (Test Test,
2026-08-21), id 30 (Test Urlaub, 2026-08-21), id 31 (UA T, 2026-08-21). Für sie liefert der
kanonische Rechenweg `"User <id> not found"`; ihre Werte stehen deshalb direkt aus den
Tabellen im Bericht.

### A2 — Vorhersage der kanonisch gerechneten Salden, erhoben VOR dem Push

Dieselbe Sicherung, lokal migriert — exakt das Verfahren aus Plan 14-04, aber gegen den
Datenstand von heute 11:15:41 statt gegen die ältere Kopie:

```
$ cd server && node -e "... VACUUM INTO './database/14-vorhersage-nach-migration.db' aus der Sicherung ..."
Vorhersagekopie angelegt.

$ npm run migrate:copy -- --db=./database/14-vorhersage-nach-migration.db \
    --expect-migration=015_unique_reversal_of_index

=== applyMigrationsToCopy: vor dem Lauf ===
Aufgelöster Pfad: …\server\database\14-vorhersage-nach-migration.db
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
EXIT=0
```

Der kanonische Saldo-Snapshot gegen diese migrierte Kopie:

```
$ cd server && DATABASE_PATH=./database/14-vorhersage-nach-migration.db npm run snapshot:balances -- \
    --all --asOf=2026-08-21 \
    --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-VORHERSAGE-NACH-MIGRATION.json

=== snapshotBalances: Ausgangslage ===
Aufgelöster Datenbankpfad: …\server\database\14-vorhersage-nach-migration.db
Dateigröße: 1593344 Bytes
Anzahl Zeilen in users (ungefiltert): 20
Anzahl Zeilen in user_work_periods: 20
asOf: 2026-08-21

Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
ERGEBNIS: Snapshot erhoben (Exit 0).
```

### Nullwirkung der Migrationen — nachgewiesen VOR dem Push, auf den heutigen Produktionsdaten

```
$ cd server && node scripts/14-ist-stand-vergleich.mjs \
    --vorher=…/14-PROD-IST-VOR-DEPLOYMENT.json \
    --nachher=…/14-PROD-IST-VORHERSAGE-NACH-MIGRATION.json \
    --erwarte-migrationen=008_create_user_work_periods,009_backfill_user_work_periods,\
010_fix_user_work_periods_delete_guard,011_add_model_change_transaction_type,\
012_fix_reference_type_check_constraint,013_soft_delete_user_work_periods,\
014_add_reversal_of_to_overtime_transactions,015_unique_reversal_of_index

Geprüfte Nutzer: 20 vorher / 20 nachher (namentlich, soft-gelöschte eingeschlossen)

## Ergebnis: KEINE unerwartete Differenz

Kein Stundenwert, kein Urlaubswert, kein Stammdatenfeld und kein Zählwert hat sich
bewegt. Nichts ist verschwunden, nichts ist hinzugekommen.

## Ausdrücklich erwartete Strukturänderungen (9)
| Tabellenzählwerte | user_work_periods (Migration 009, REQ-21) | Tabelle nicht vorhanden | 20 (= COUNT(*) FROM users = 20) |
| Migrationen | neu angewendet: 008_create_user_work_periods | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 009_backfill_user_work_periods | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 010_fix_user_work_periods_delete_guard | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 011_add_model_change_transaction_type | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 012_fix_reference_type_check_constraint | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 013_soft_delete_user_work_periods | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 014_add_reversal_of_to_overtime_transactions | nicht angewendet | angewendet |
| Migrationen | neu angewendet: 015_unique_reversal_of_index | nicht angewendet | angewendet |

ERGEBNIS: keine unerwartete Differenz; 9 erwartete Strukturänderung(en) (Exit 0).
EXITCODE=0
```

Der Vergleich prüft je Nutzer namentlich: alle dreizehn Stammdatenfelder, jeden einzelnen
`overtime_balance`-Monat mit Soll, Ist, Saldo und Übertrag, die Summen darüber, Anzahl und
Summe der Überstundenbuchungen, Anzahl, Summe und Zeitspanne der Zeiteinträge, die Anzahl der
Abwesenheitsanträge sowie je Urlaubsjahr Anspruch, Übertrag, genommene Tage, Resturlaub und
die Buchungssumme. Jede Abweichung außer den beiden ausdrücklich benannten
Strukturänderungen wäre ein Blocker mit Exitcode 1 gewesen.

Vollständiger Bericht: [`14-VERGLEICH-VORHERSAGE.md`](14-VERGLEICH-VORHERSAGE.md).

**Bedeutung:** Die Nullwirkung der Migrationen 008–015 ist damit nicht nur auf der älteren
Kopie aus Plan 14-04 belegt, sondern auf **exakt dem Datenstand, der gleich migriert wird** —
und zwar, bevor der Push ausgelöst wurde.
