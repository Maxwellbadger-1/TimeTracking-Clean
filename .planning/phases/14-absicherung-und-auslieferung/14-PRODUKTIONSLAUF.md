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

---

## Task 2, Schritt C — Aufrufreihenfolge im Deploy-Workflow korrigiert (T-14-42)

Der Schritt „Fix overtime calculations" stand in `.github/workflows/deploy-server.yml` an
Zeile 116-121 — unmittelbar nach `validate:schema` und **vor** dem PM2-Start. Er wurde
mitsamt seinen Echo-Zeilen hinter den PM2-Start **und** hinter den Health-Check des Workflows
verschoben. An seiner alten Stelle steht ein Verweis, damit die Verschiebung beim Lesen des
Workflows nicht als Verlust erscheint.

Über dem verschobenen Schritt steht die Begründung als Kommentar; sie nennt `runMigrations`,
`server/src/server.ts:215`, `user_work_periods`, `ensureOvertimeBalanceEntries`,
`getDailyTargetHours()` und den Befund WR-05 der Phase 9.

**Prüfung über die Zeilennummern, wie im Akzeptanzkriterium verlangt:**

```
$ grep -n "pm2 save" .github/workflows/deploy-server.yml
164:            pm2 save

$ grep -n "fix-overtime.ts" .github/workflows/deploy-server.yml
122:            CRON_COMMAND="0 3 * * * cd /home/ubuntu/TimeTracking-Clean/server && DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production npx tsx scripts/fix-overtime.ts >> /home/ubuntu/logs/overtime-fix.log 2>&1"
124:            (crontab -l 2>/dev/null | grep -v "fix-overtime.ts"; echo "$CRON_COMMAND") | crontab - || {
192:            # scripts/fix-overtime.ts importiert seit Plan 09-05 `ensureOvertimeBalanceEntries`,
201:            # nicht abbrechen (fix-overtime.ts hat laut Befund WR-05 der Phase 9 keine
206:            DATABASE_PATH=$DATABASE_PATH NODE_ENV=production npx tsx scripts/fix-overtime.ts || {

$ grep -n "runMigrations\|user_work_periods" .github/workflows/deploy-server.yml
190:            # beim Serverstart ueber `runMigrations(db)` in server/src/server.ts:215.
195:            # `user_work_periods` auf. Diese Tabelle entsteht erst durch Migration 008/009.
197:            # in der `user_work_periods` noch nicht existiert, und schreibt dabei per UPSERT
```

**Die ausführende Zeile steht auf 206, `pm2 save` auf 164 — 206 > 164, das Kriterium ist
erfüllt.** Die Treffer auf 122 und 124 sind der Cron-Eintrag, an dem auftragsgemäß nichts
geändert wurde; 192 und 201 sind Kommentarzeilen.

**Das `||`-Konstrukt ist erhalten geblieben** — der Schritt darf das Deployment weiterhin
nicht abbrechen. Zusätzlich wurde ein ausdrückliches `cd /home/ubuntu/TimeTracking-Clean/server`
über den Schritt gesetzt: Die Shell steht an dieser Stelle zwar bereits dort (Zeile 89
`cd server`, danach kein weiterer Verzeichniswechsel), aber der Schritt hat seine Position
gewechselt und soll nicht stillschweigend von einem Zustand abhängen, den ein späterer Umbau
verändern könnte.

**T-14-44 mitbestätigt** — `DATABASE_PATH` ist in jedem datenberührenden Schritt gesetzt:
Zeile 50 (`export DATABASE_PATH=/home/ubuntu/databases/production.db`), 104 (`migrate:prod`),
113 (`validate:schema`), 158 (PM2-Start) und 206 (`fix-overtime.ts` an seiner neuen Stelle).

---

## Task 2, Schritt D — Die vier Gates vor dem Push

### Gate 1 — `cd server && npx tsc --noEmit`

```
$ cd server && npx tsc --noEmit
EXIT=0
```

Keine Ausgabe, Exit 0.

### Gate 2 — `cd desktop && npx tsc --noEmit`

```
$ cd desktop && npx tsc --noEmit
EXIT=0
```

Keine Ausgabe, Exit 0.

### Gate 3 — `cd server && npx vitest run`

```
$ cd server && npx vitest run

 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > should respect hire date and not include pre-employment months
AssertionError: expected 40 to be 10 // Object.is equality

 FAIL  src/services/unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly
AssertionError: expected 40 to be 10 // Object.is equality

 FAIL  src/services/vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill
AssertionError: expected true to be false // Object.is equality

⎯⎯⎯⎯⎯⎯⎯ Failed Tests 3 ⎯⎯⎯⎯⎯⎯⎯
 Test Files  2 failed | 36 passed (38)
      Tests  3 failed | 527 passed (530)
   Duration  15.64s
```

**Genau 3 rote Tests, die drei bekannten Titel wörtlich unverändert** gegenüber
`11-AUSGANGSZUSTAND.md` und `14-REQ32-NACHWEIS.md`. Kein vierter roter Test, keine
Titeländerung. Die grüne Zahl ist von 492 auf 527 gestiegen — das sind die in den Plänen
14-01 bis 14-07 hinzugekommenen Tests; die Zahl der Testdateien ist von 36 auf 38 gewachsen.

### Gate 4 — `cd desktop && npm run check:rules`

```
$ cd desktop && npm run check:rules
[…]
PASS: isDeleteConfirmDisabled deckt alle acht Kombinationen korrekt ab

19 Tests bestanden.
EXIT=0
```

Ausschließlich `PASS:`-Zeilen, kein `FAIL`, Exit 0.

### Zustand des Arbeitsverzeichnisses vor dem Push

```
$ git status --short
 M .github/workflows/deploy-server.yml
?? .planning/phases/10-perioden-fundament/10-REVIEW.md

$ git diff --stat .github/workflows/deploy-server.yml
 .github/workflows/deploy-server.yml | 38 +++++++++++++++++++++++++++++++------
 1 file changed, 32 insertions(+), 6 deletions(-)
```

Sauber bis auf die in diesem Plan geänderte Datei und das nicht versionierte Planungsdokument
aus Phase 10, das keine Codewirkung hat.

### T-14-SC — keine neue Abhängigkeit

Die im Bedrohungsregister geforderte Prüfung vor dem Push, ob die Auslieferung eine neue
Abhängigkeit einführt:

```
$ git show origin/main:server/package.json | node -e "… gibt dependencies und devDependencies aus …"
ALT deps:    {"@types/bcrypt":"^6.0.0","@types/better-sqlite3":"^7.6.13","@types/express-session":"^1.18.2","@types/jsonwebtoken":"^9.0.10","@types/ws":"^8.18.1","bcrypt":"^6.0.0","better-sqlite3":"^12.4.1","cors":"^2.8.5","date-fns":"^3.6.0","date-fns-tz":"^3.2.0","express":"^4.18.2","express-rate-limit":"^8.2.1","express-session":"^1.18.2","helmet":"^8.1.0","jsonwebtoken":"^9.0.3","node-cron":"^4.2.1","node-fetch":"^2.7.0","pino":"^10.1.0","pino-pretty":"^13.1.2","ws":"^8.18.3"}
ALT devDeps: {"@types/cors":"^2.8.17","@types/express":"^4.17.21","@types/node":"^20.11.5","@types/node-cron":"^3.0.11","@typescript-eslint/eslint-plugin":"^6.21.0","@typescript-eslint/parser":"^6.21.0","@vitest/ui":"^4.0.8","@yao-pkg/pkg":"^6.10.1","eslint":"^8.56.0","tsx":"^4.7.0","typescript":"^5.7.2","vitest":"^4.0.8"}

$ node -e "… dasselbe fuer HEAD …"
NEU deps:    (byteidentisch mit ALT deps)
NEU devDeps: (byteidentisch mit ALT devDeps)
```

**Der Unterschied in `server/package.json` zwischen `origin/main` und `HEAD` besteht
ausschließlich aus neuen `scripts`-Einträgen** — sechs neue Werkzeugaufrufe (`migrate:copy`,
`snapshot:balances`, `apply:model-change`, `backfill:overtime-journal`, `seed:model-change`,
`verify:period-nulleffect`, `validate:overtime:paths`, `repro:overtime-comp`,
`check:period-chains`), alle auf bereits im Repository liegende TypeScript-Dateien. **Keine
einzige neue Abhängigkeit.** Das serverseitige `npm install --legacy-peer-deps` im Deployment
zieht damit nichts, was es nicht schon vorher gezogen hätte.

---

## Task 2, Schritt E — Ausliefern

### Befund vor dem Push: der Push hing an einer interaktiven Anmeldung

Der erste `git push origin main` lief fünf Minuten ohne jede Fortschrittsausgabe und wurde
abgebrochen. Ein zweiter Versuch im Hintergrund lief zehn Minuten ohne Ausgabe. Prüfung des
tatsächlichen Zustands statt Wiederholung:

```
$ git ls-remote origin main
0f2a03efba0d5c7880407290be2c4caf9a88184d	refs/heads/main
$ gh run list --workflow="deploy-server.yml" --limit 1
completed	success	feat(06-07): …	2026-08-21T18:32:03Z
```

**Der Push war nicht angekommen, kein Deployment war ausgelöst, die Produktion war unberührt.**

Ursachensuche:

```
$ tasklist | grep -i "git\|credential"
git-remote-https.exe         28104
git-credential-manager.ex    41220
```

`git-credential-manager.exe` wartete auf eine interaktive Anmeldung, die aus einer nicht
interaktiven Sitzung nicht beantwortet werden kann. Das ist eine Anmeldeschranke, kein
Fehler des Codes und kein Fehler des Deployments — `git ls-remote` funktionierte, weil
Lesezugriff auf das öffentliche Repository keine Anmeldung braucht.

**Behebung ohne neue Berechtigung:** `gh` war bereits angemeldet, mit den Rechten `repo` und
`workflow`:

```
$ gh auth status
✓ Logged in to github.com account Maxwellbadger-1 (keyring)
  Token scopes: 'repo', 'workflow', […]
```

Die hängenden Prozesse wurden beendet, danach wurde geprüft, dass nichts beschädigt ist:

```
$ ls -la .git/*.lock
keine Sperrdatei
$ git ls-remote origin main
0f2a03efba0d5c7880407290be2c4caf9a88184d	refs/heads/main
$ git status --short
?? .planning/phases/10-perioden-fundament/10-REVIEW.md
$ git rev-parse --short HEAD
41c9c09
```

Der Push wurde dann über die **bereits erteilten** `gh`-Zugangsdaten geführt, ohne ein
Geheimnis irgendwo abzulegen — zuerst als Probelauf ohne Übertragung:

```
$ GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c credential.helper='!gh auth git-credential' push --dry-run origin main
To https://github.com/Maxwellbadger-1/TimeTracking-Clean.git
   0f2a03e..41c9c09  main -> main
EXIT=0
```

### Der Push

```
$ date "+PUSH-START %Y-%m-%d %H:%M:%S"
PUSH-START 2026-08-23 11:47:56
$ GIT_TERMINAL_PROMPT=0 git -c credential.helper= -c credential.helper='!gh auth git-credential' push origin main
To https://github.com/Maxwellbadger-1/TimeTracking-Clean.git
   0f2a03e..41c9c09  main -> main
PUSH-EXIT=0
PUSH-ENDE 2026-08-23 11:48:00
$ git ls-remote origin main
41c9c097790ae5bf9337f425f877ee070726a051	refs/heads/main
```

**Ab hier lief das Deployment.** Ausgeliefert wurden 382 Commits (die im Plan genannten 337
zuzüglich der in Phase 14 selbst entstandenen), 336 geänderte Dateien.

**Nebenwirkung dokumentiert:** `gh auth setup-git` hat die globale git-Konfiguration um
`credential.helper = !gh auth git-credential` ergänzt. Das leitet GitHub-Anmeldungen über
`gh`, das der Anwender ohnehin nutzt; es speichert kein Geheimnis im Projekt. Der eigentliche
Push nutzte davon unabhängig die `-c`-Schalter.

---

## Task 2, Schritt F — Deployment beobachtet

```
$ gh run list --workflow="deploy-server.yml" --limit 1
completed	success	fix(14-08): fix-overtime laeuft erst nach dem PM2-Start, wenn die Mig…	CD - Deploy Server to Oracle Cloud	main	push	32632007657	6m2s	2026-08-23T09:48:09Z

$ gh run view 32632007657 --json jobs --jq '[.jobs[].conclusion] | unique'
["success"]

$ gh run view 32632007657 --json conclusion,status,headSha
{"conclusion":"success","status":"completed","headSha":"41c9c097790ae5bf9337f425f877ee070726a051"}
```

**Lauf-Id 32632007657, Status `completed`, Conclusion `success`, alle Jobs `success`,
Laufzeit 6 min 2 s.**

### Deployment-Log der geforderten Schritte, wörtlich

```
[09:53:28] 🗄️  Running database migrations...
[09:53:29] > server@0.1.2 migrate:prod
[09:53:29] > tsx scripts/migrate.ts prod
[09:53:31] ⚠️  WARNING: Running migrations on PRODUCTION database!
[09:53:31]    Press Ctrl+C within 5 seconds to cancel...
[09:53:36] 🗄️  Running migrations on PRODUCTION database
[09:53:36] 📁 Database: /home/***/databases/production.db
[09:53:36] ✅ No pending migrations - database is up to date!
[09:53:36] ✅ Migrations completed successfully
```

**Bestätigt den Befund des Plans:** `migrate:prod` meldet „No pending migrations", weil es nur
`.sql`-Dateien verarbeitet. Die TypeScript-Migrationen 008–015 laufen hier ausdrücklich
**nicht**.

```
[09:53:36] 🔍 Validating database schema...
[09:53:38] 📋 Validating database schema...
[09:53:38] ⚠️  No schema definition for table: audit_log
[09:53:38] ⚠️  No schema definition for table: migrations
[09:53:38] ⚠️  No schema definition for table: overtime_corrections
[09:53:38] ⚠️  No schema definition for table: overtime_daily
[09:53:38] ⚠️  No schema definition for table: overtime_weekly
[09:53:38] ⚠️  No schema definition for table: password_change_log
[09:53:38] ⚠️  No schema definition for table: vacation_transactions
[09:53:38] ⚠️  No schema definition for table: work_time_accounts
[09:53:38] ❌ VALIDATION FAILED: Database schema has missing required columns!
[09:53:38] 📊 Validation Results:
[09:53:38] absence_requests   ❌  Missing: approverId | Extra: adminNote, approvedBy
[09:53:38] overtime_balance   ❌  Missing: overtime, carryover, balance, createdAt, updatedAt | Extra: carryoverFromPreviousYear
[09:53:38] overtime_transactions ❌ Missing: balance | Extra: referenceType, balanceBefore, balanceAfter, createdBy
[09:53:38] time_entries       ❌  Missing: projectId, activityId, description, isHomeOffice | Extra: startTime, endTime, …
[09:53:38] users              ✅
[09:53:38] vacation_balance   ❌  Missing: totalDays, usedDays, … | Extra: entitlement, carryover, taken
[09:53:38] npm error Lifecycle script `validate:schema` failed with error: code 1
[09:53:38] ✅ Schema validation completed
```

**Einordnung, ohne zu beschönigen:** `validate:schema` schlägt fehl und wird durch das
`|| true` im Workflow abgefangen. Die Ursache ist eine **veraltete Schema-Erwartung in
`scripts/validateSchema.ts`**, nicht ein Defekt der Produktionsdatenbank: Das Skript erwartet
Spaltennamen (`totalDays`, `usedDays`, `approverId`, `isHomeOffice`), die dieses Projekt seit
Langem nicht mehr verwendet. Das ist ein **vorbestehender** Zustand, nicht durch dieses
Deployment entstanden, und liegt außerhalb des Auftrags dieses Plans. Vermerkt in
`deferred-items.md`.

```
[09:53:38] ✅ Environment ready (SESSION_SECRET length: 64)
[09:53:38] 🔄 Restarting PM2...
[09:53:39] [PM2] Applying action stopProcessId on app [timetracking-server](ids: [ 40 ])
[09:53:40] [PM2] Applying action deleteProcessId on app [timetracking-server](ids: [ 40 ])
[09:53:40] [PM2] Starting /home/***/TimeTracking-Clean/server/dist/server.js in fork_mode (1 instance)
[09:53:41] [PM2] Done.
[09:53:41] │ 41 │ timetracking-server │ default │ 0.1.2 │ fork │ 3684814 │ 0s │ 0 │ online │
[09:53:42] [PM2] Saving current process list...
[09:53:42] [PM2] Successfully saved in /home/***/.pm2/dump.pm2
[09:53:42] ⏳ Waiting for server to start...
[09:53:47] 🏥 Running health check...
[09:53:47] ✅ Deployment successful! Server is healthy
[09:53:48] │ 41 │ timetracking-server │ default │ 0.1.2 │ fork │ 3684814 │ 7s │ 0 │ online │ 108.4mb │
```

```
[09:53:48] 📊 Fixing overtime calculations...
[09:54:02] 📁 Using database: /home/***/databases/production.db
[09:54:02] 🔧 Starting overtime recalculation...
[09:54:02] 📊 Found 15 active users
[09:54:02] 👤 Processing: System Administrator (ID: 1)
[09:54:02] 👤 Processing: Karin Jochem (ID: 2)
[09:54:02] 👤 Processing: Christine Glas (ID: 3)
[09:54:02] 👤 Processing: Benedikt Jochem (ID: 16)
[09:54:03] 👤 Processing: Carmen Rothemund (ID: 17)
[09:54:03] 👤 Processing: Silvia Lachner (ID: 18)
[09:54:03] 👤 Processing: Ute Stock (ID: 19)
[09:54:03] 👤 Processing: Hans Schauer (ID: 20)
[09:54:03] 👤 Processing: Maria Schauer (ID: 21)
[09:54:04] 👤 Processing: Beate Walleiter (ID: 22)
[09:54:04] 👤 Processing: Sepp Wasensteiner (ID: 23)
[09:54:04] 👤 Processing: Kathrin Leeb (ID: 24)
[09:54:04] 👤 Processing: Heidemarie Tretter (ID: 25)
[09:54:04] 👤 Processing: Reinhold Merl (ID: 27)
[09:54:05] 👤 Processing: Christina Wasensteiner (ID: 29)
[09:54:05] ✅ Overtime calculations updated
```

**Der Schritt „Fix overtime calculations" (09:53:48) steht im Log nach „Restarting PM2"
(09:53:38) und nach dem Health-Check (09:53:47)** — das Akzeptanzkriterium ist erfüllt.

**Die Verschiebung hat gewirkt:** `fix-overtime.ts` verarbeitete alle 15 aktiven Nutzer
fehlerfrei. Kein `⚠️  Overtime fix had issues`. An der alten Position wäre der Lauf beim
ersten Nutzer gescheitert, weil `user_work_periods` dort noch nicht existiert hätte.

```
[09:54:07] Verifying DB path...
[09:54:07] PM2 PID: 3684814
[09:54:07] DB verification PASSED: /home/***/databases/production.db
[09:54:08] ✅ Deployment to Oracle Cloud successful!
```

---

## Task 3, Schritt A — Health-Check

```
$ curl -s http://129.159.8.19:3000/api/health
{"status":"ok","message":"TimeTracking Server is running","version":"0.1.0","timestamp":"2026-08-23T09:55:27.430Z"}

$ curl -s -o /dev/null -w "%{http_code}\n" http://129.159.8.19:3000/api/health
200
```

`status` = `ok`, HTTP 200.

### ⚠ Abweichung von der Erwartung — am Code geprüft, nicht gedeutet

Der Plan und `.claude/CLAUDE.md` erwarten zusätzlich `"database":"connected"`. Dieses Feld
**fehlt in der Antwort**. Statt daraus etwas zu schließen, wurde der Endpunkt auf beiden
Seiten des Deployments am Code gelesen:

```
$ sed -n '158,166p' server/src/server.ts          # Stand NACH dem Deployment
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'TimeTracking Server is running',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

$ git show 0f2a03e:server/src/server.ts | grep -A 8 "app.get('/api/health'"   # Stand VOR dem Deployment
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'TimeTracking Server is running',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});
```

**Byteidentisch.** Der Endpunkt hat **nie** ein `database`-Feld geliefert — weder vor noch
nach dem Deployment. Die Erwartung in `.claude/CLAUDE.md` („Deployment Verification Rules")
und im Akzeptanzkriterium dieses Plans ist **veraltete Dokumentation**, kein Rückschritt und
kein Abbruchkriterium. Abschnitt 2 des Runbooks fordert `status: ok` — das liegt vor.

Daraus folgt aber auch: **Ein grüner Health-Check belegt hier keine Datenbankverbindung.**
Diese wird weiter unten über tatsächliche Lesezugriffe belegt.

**Für `.claude/CLAUDE.md` vorgemerkt** (nicht in diesem Plan geändert, um die Auslieferung
nicht mit einer unnötigen Änderung zu belasten): Die Erwartung `database: connected` gehört
korrigiert oder der Endpunkt um eine echte Datenbankprüfung erweitert. Vermerkt in
`deferred-items.md`.

---

## Task 3, Schritt B — Migrationsstand der Produktion

```
$ ssh ... "DATABASE_PATH=/home/ubuntu/databases/production.db node -e \"... readonly gegen production.db ...\""
migrations count: 18
   1. 004_drop_overtime_unique_index
   2. 005_add_balance_tracking_columns
   3. 001_backfill_overtime_transactions
   4. 002_extend_transaction_types
   5. 003_add_pending_to_vacation_balance
   6. 20260208_add_position_column
   7. 20260208_add_time_entry_type.sql
   8. 20260208_add_position_column.sql
   9. 006_add_time_entry_transaction_type
  10. 007_create_vacation_transactions
  11. 008_create_user_work_periods
  12. 009_backfill_user_work_periods
  13. 010_fix_user_work_periods_delete_guard
  14. 011_add_model_change_transaction_type
  15. 012_fix_reference_type_check_constraint
  16. 013_soft_delete_user_work_periods
  17. 014_add_reversal_of_to_overtime_transactions
  18. 015_unique_reversal_of_index
integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
```

**Jeder Name der Fehlliste aus `14-MIGRATIONSSTAND.md` ist verzeichnet, `015_unique_reversal_of_index`
eingeschlossen.** Von 10 auf 18 Migrationen, exakt die acht erwarteten neu — kein Name mehr,
kein Name weniger. `integrity_check` = `ok`, `foreign_key_check` leer.

```
$ ssh ... "ls -la /home/ubuntu/databases/production.db*"
-rw------- 1 ubuntu ubuntu 1425408 Aug 23 03:00 /home/ubuntu/databases/production.db
-rw------- 1 ubuntu ubuntu   32768 Aug 23 09:54 /home/ubuntu/databases/production.db-shm
-rw------- 1 ubuntu ubuntu 3102392 Aug 23 09:54 /home/ubuntu/databases/production.db-wal
```

Die `mtime` der Hauptdatei steht weiterhin auf 03:00, der gesamte neue Inhalt liegt in einer
3-MB-WAL-Datei. Genau deshalb wurde readonly über eine SQLite-Verbindung gelesen und nicht
über einen Dateivergleich — SQLite löst die WAL beim Lesen transparent auf, ein
Byte-Vergleich der `.db`-Datei hätte den Migrationsstand nicht gesehen.

### Bekannte Warnung im PM2-Log — geprüft, kein Abbruchkriterium

Abbruchkriterium 2 des Runbooks verlangt, die PM2-Logs auf Migrationsfehler zu prüfen:

```
$ ssh ... "pm2 logs timetracking-server --lines 300 --nostream | grep -i 'runMigrations\|Migration.*failed\|Migration.*abgebrochen'"
41|timetra | 2026-08-23T09:53:44: {"level":40,…,"error":{"type":"SqliteError","message":"no such column: reversalOf",…},
  "msg":"⏳ idx_overtime_transactions_reversal_of noch nicht anlegbar (Spalte reversalOf fehlt bis
   Migration 014 gelaufen ist) — runMigrations() holt das nach"}
```

Das ist **Stufe 40 (Warnung), nicht Stufe 50**, und wörtlich die in `14-MIGRATIONSSTAND.md`
vorab benannte, im Code kommentierte Vorbedingung: Beim initialen Schema-Setup existiert die
Spalte `reversalOf` noch nicht; Migration 014/015 zieht den Index nach. Gegenprobe, dass er
tatsächlich nachgezogen wurde:

```
$ node -e "... readonly gegen ./database/14-prod-nach-migration.db ..."
["idx_overtime_transactions_date","idx_overtime_transactions_reversal_of",
 "idx_overtime_transactions_type","idx_overtime_transactions_userId"]
```

`idx_overtime_transactions_reversal_of` ist vorhanden. **Kein Migrationsfehler, kein
Abbruchkriterium.** Keine weiteren Treffer im Log.

---

## Task 3, Schritt C — Frische Produktionskopie

### Abweichung vom Plan, bewusst und begründet

Der Plan sieht `npm run sync-dev-db` vor, mit vorheriger Sicherung und anschließender
Wiederherstellung von `server/database/development.db` (Bedrohung T-14-45). Stattdessen wurde
die Kopie über denselben Weg gezogen wie die Sicherung: ein `VACUUM INTO` auf dem Server,
danach `scp`.

**Begründung:** Das erreicht dasselbe Ergebnis — eine WAL-vollständige Kopie der laufenden
Produktion — **ohne `development.db` überhaupt anzufassen**. T-14-45 wird damit nicht
gemildert, sondern beseitigt. Ein Sicherungs-/Wiederherstellungstanz um eine Datei, die gar
nicht berührt werden muss, ist zusätzliches Risiko ohne Gegenwert.

```
$ ssh ... "DATABASE_PATH=/home/ubuntu/databases/production.db node -e \"
    const D = require('/home/ubuntu/TimeTracking-Clean/node_modules/better-sqlite3');
    const db = new D('/home/ubuntu/databases/production.db', { readonly: true });
    db.exec(\\\"VACUUM INTO '/tmp/prod-nach-migration_20260823_115627.db'\\\");
    db.close();\""
Kopie erzeugt
-rw-r--r-- 1 ubuntu ubuntu 1323008 Aug 23 09:56 /tmp/prod-nach-migration_20260823_115627.db
2486c7582070422c118e1e5c1ddf159de95b08e3ce5f42dce535e7aa10ac94fa  /tmp/prod-nach-migration_20260823_115627.db

$ scp ... server/database/14-prod-nach-migration.db
-rw-r--r-- 1 maxfe 197609 1323008 Aug 23 11:56 server/database/14-prod-nach-migration.db
2486c7582070422c118e1e5c1ddf159de95b08e3ce5f42dce535e7aa10ac94fa *server/database/14-prod-nach-migration.db

$ ssh ... "rm -f /tmp/prod-nach-migration_20260823_115627.db"
temporaere Serverkopie entfernt
```

Prüfsummen identisch. Die temporäre Serverkopie wurde wieder entfernt.

### Nachweis, dass `development.db` unberührt blieb

```
                       VORHER (11:28)                                              NACHHER
Dateigröße             1699840 Bytes                                               1699840 Bytes
mtime                  Aug 23 11:28                                                Aug 23 11:28
SHA-256                8b3b08c2881b8625d1604a5b8b72d84e5ba24b39c11917b078d7137a8b1a4fcb   (identisch)
COUNT migrations       17                                                          17
COUNT users            30                                                          30
```

**Byteidentisch.** Es wurde kein Sync gefahren, keine Wiederherstellung nötig.

---

## Task 3, Schritt D — Wirkung auf die Zahlen: BLOCKER

### Tabellenzählwerte — nichts verloren, nichts hinzugekommen

| Tabelle | vorher | nachher | Differenz |
|---|---|---|---|
| `users` | 20 | 20 | **0** |
| `time_entries` | 712 | 712 | **0** |
| `absence_requests` | 43 | 43 | **0** |
| `overtime_transactions` | 2671 | 2671 | **0** |
| `overtime_balance` | 144 | 144 | **0** |
| `vacation_balance` | 40 | 40 | **0** |
| `vacation_transactions` | 59 | 59 | **0** |
| `user_work_periods` | Tabelle nicht vorhanden | 20 | erwartet (= `COUNT(*) FROM users` = 20) |

`overtime_transactions`: COUNT 2671 → 2671, `SUM(hours)` −372,68 → −372,68 — **Differenz 0.**
Urlaubsjahre mit Abweichung: **0.** Kettenprüfung gegen den Produktionsbestand:

```
$ cd server && DATABASE_PATH=./database/14-prod-nach-migration.db npm run check:period-chains
✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose
   Periodenkette ab seinem Eintrittsdatum.
EXITCODE=0
```

### Aber: 99 Wertänderungen in `overtime_balance`

```
$ cd server && node scripts/14-ist-stand-vergleich.mjs \
    --vorher=…/14-PROD-IST-VOR-DEPLOYMENT.json \
    --nachher=…/14-PROD-IST-NACH-MIGRATION.json \
    --erwarte-migrationen=008_…,…,015_unique_reversal_of_index

## Ergebnis: **99 BLOCKER**
ERGEBNIS: 99 BLOCKER — nicht weiterarbeiten (Exit 1).
EXITCODE=1
```

**Alle 99 liegen im Bereich „Stunden", ausschließlich in `overtime_balance`.** Kein Befund in
Stammdaten, Zeiteinträgen, Abwesenheiten, Urlaub, Journal oder Nutzerbestand.

### Betroffene Nutzer, namentlich

| ID | Name | Saldo vorher | Saldo nachher | Differenz | Soll vorher | Soll nachher | Ist vorher | Ist nachher |
|---|---|---|---|---|---|---|---|---|
| 2 | Karin Jochem | 6 | 10 | **+4** | 159 | 155 | 165 | 165 |
| 3 | Christine Glas | −46,43 | −15,23 | **+31,2** | 290,4 | 288 | 243,97 | 272,77 |
| 16 | Benedikt Jochem | 104 | 20 | **−84** | 954 | 954 | 1058 | 974 |
| 17 | Carmen Rothemund | −46,06 | −45,26 | **+0,8** | 428,8 | 420 | 382,74 | 374,74 |
| 18 | Silvia Lachner | −4,5 | 11,5 | **+16** | 636 | 640 | 631,5 | 651,5 |
| 19 | Ute Stock | 10,41 | 12,41 | **+2** | 79,5 | 77,5 | 89,91 | 89,91 |
| 24 | Kathrin Leeb | 249,5 | 201,5 | **−48** | 0 | 0 | 249,5 | 201,5 |
| 29 | Christina Wasensteiner | 85,78 | 65,28 | **−20,5** | 0 | 0 | 85,78 | 65,28 |

**8 betroffene Nutzer, Summe aller Saldodifferenzen −98,5 h.**

Unverändert geblieben: 1 (System Administrator), 20 (Hans Schauer), 21 (Maria Schauer),
22 (Beate Walleiter), 23 (Sepp Wasensteiner), 25 (Heidemarie Tretter), 27 (Reinhold Merl)
sowie alle fünf soft-gelöschten Nutzer (15, 26, 28, 30, 31).

### Die Ursache ist NICHT die Migration — sie ist `fix-overtime.ts`

Zwei Vergleiche isolieren die Ursache eindeutig:

| Vergleich | Ergebnis |
|---|---|
| Vor dem Deployment **gegen** dieselbe Sicherung, nur mit 008–015 migriert (Vorhersage) | **0 unerwartete Differenzen** |
| Vorhersage (nur migriert) **gegen** Produktion (migriert **und** `fix-overtime.ts`) | **exakt dieselben 99 Differenzen** |

```
$ node scripts/14-ist-stand-vergleich.mjs \
    --vorher=…/14-PROD-IST-VORHERSAGE-NACH-MIGRATION.json \
    --nachher=…/14-PROD-IST-NACH-MIGRATION.json
## Ergebnis: **99 BLOCKER**
   99 | Stunden |     ← alle Befunde in einem einzigen Bereich
```

**Die Migrationen 008–015 haben keine einzige Zahl bewegt.** Die verbindliche Erwartung des
Plans für Task 3 ist damit erfüllt. Bewegt hat die Zahlen der Schritt „Fix overtime
calculations" am Ende des Deployments: `fix-overtime.ts` schreibt `overtime_balance` per
UPSERT neu — und rechnet dabei erstmals mit dem neuen, periodenbasierten Rechenwerk der
Phase 11, während die gespeicherten Werte vom alten Rechenwerk stammten.

**Was das sachlich ist:** keine Datenzerstörung. Das Journal (`overtime_transactions`) ist
unangetastet, kein Zeiteintrag, kein Urlaubswert, kein Stammdatenfeld hat sich bewegt, keine
Zeile ist verschwunden oder hinzugekommen. Was sich geändert hat, sind die **abgeleiteten,
gespeicherten Monatssalden** — sie zeigen jetzt das Ergebnis des neuen Modells.

**Was das für die Zusicherung des Anwenders bedeutet:** Die Auflage lautete „An den
Stundenständen darf sich nichts ändern" und „Wenn sich auch nur ein Wert bewegt, ist das ein
BLOCKER: sofort anhalten, nicht weiterarbeiten, nicht selbst reparieren." Acht Mitarbeiter
sehen ab sofort einen anderen Überstundensaldo als vor dem Deployment, im Einzelfall um 84
Stunden abweichend. **Das ist der Blockerfall. Der Lauf wird hier abgebrochen.**

**Anzumerken, ohne es zu einer Entwarnung zu machen:** Diese Änderung wäre bei **jedem**
Deployment dieses Milestones eingetreten — `fix-overtime.ts` läuft seit jeher in jedem
Deployment und zusätzlich täglich um 3 Uhr per Cron. Die Verschiebung des Schritts durch
diesen Plan hat sie nicht verursacht; sie hat lediglich dafür gesorgt, dass der Schritt
überhaupt durchlief statt zu scheitern. Wäre er an der alten Stelle geblieben, wäre er
gescheitert — und der **Cron-Lauf um 3 Uhr in der kommenden Nacht** hätte dieselbe Änderung
unbeaufsichtigt und unprotokolliert herbeigeführt. Der Befund wäre also nicht ausgeblieben,
sondern nur später und ohne Messung aufgetreten.

---

## ABBRUCH — Task 3 nicht zu Ende geführt

Nicht ausgeführt wurden, weil nach dem Blockerbefund nicht weitergearbeitet wird:

- **Schritt F** — Funktionstest mit Anmeldung (erfordert zudem Zugangsdaten, die nicht vorliegen)
- **Schritt G** — `14-SNAPSHOT-PROD-VORHER.json` als Ausgangsstand für Plan 14-09

**Plan 14-09 ist nicht anlaufbereit.** Er würde gegen einen Ausgangsstand messen, über den
der Anwender noch nicht entschieden hat.

### Zustand der Produktion in diesem Augenblick

| Gegenstand | Zustand |
|---|---|
| Server | läuft, PM2-Id 41, PID 3684814, `online` |
| Health-Check | `status: ok`, HTTP 200 |
| Codestand | `41c9c09` (v3.0-Milestone vollständig ausgeliefert) |
| Migrationen | 18, einschließlich 008–015 |
| `integrity_check` | `ok` |
| `foreign_key_check` | leer |
| Periodenketten | keine Befunde |
| Datenbestand | vollständig, keine Zeile verloren |
| Überstundensalden | bei 8 Nutzern gegenüber 11:15:41 verändert |

Die Produktion ist **lauffähig und in sich konsistent**. Sie zeigt lediglich andere
Überstundensalden als vor dem Fenster.

### Rückweg, falls der Anwender ihn will

**Es greift Rückweg B** (`14-ROLLBACK-RUNBOOK.md`, Abschnitt 4) — Daten **und** Code
gemeinsam. Rückweg A allein wäre wirkungslos: Der nächste PM2-Neustart würde die Migrationen
008–015 über `runMigrations()` erneut anwenden und `fix-overtime.ts` würde die Salden erneut
überschreiben.

Rückweg B in der Reihenfolge des Runbooks:

1. `git push origin +0f2a03e:main` — ausdrücklich als Historienumschreibung gekennzeichnet,
   nimmt den gesamten v3.0-Milestone von der Produktion zurück.
2. Deploy-Workflow abwarten und prüfen.
3. Rückweg A für die Daten, Schritte 1–7 (Server stoppen, Sicherung per `VACUUM INTO`
   zurückschreiben, alte Datei beiseiteschieben, neue an ihre Stelle, `pm2 start` mit
   vollständiger Umgebungszeile, Health-Check, Funktionstest).
4. Verifikation nach Abschnitt 5.

**Die Sicherung dafür liegt bereit und ist geprüft:**
`/home/ubuntu/databases/backups/production.PRE-14-08_20260823_111541.db` auf dem Server und
`server/database/backups/production.PRE-14-08_20260823_111541.db` auf dem Arbeitsrechner,
je 1.286.144 Bytes, SHA-256 `082ff7434ec8c75560f06c6469093c088c921f70a9cc35162f4bf9b21222ee7d`,
`integrity_check` = `ok`.

**Preis des Rückwegs, damit die Entscheidung vollständig ist:**

- Der gesamte v3.0-Milestone verschwindet wieder von der Produktion.
- Zeiteinträge, die zwischen 11:15:41 und dem Rückspielen erfasst wurden, gehen verloren.
  Zum Zeitpunkt der Messung war `MAX(date)` in `time_entries` unverändert `2026-08-21` und
  die Zeilenzahl unverändert 712 — es ist also nichts hinzugekommen, aber das kann sich mit
  jeder Minute ändern.
- Der Cron-Lauf um 3 Uhr würde `fix-overtime.ts` erneut fahren. Beim alten Code stellt das
  die alten Werte wieder her; das ist der Grund, warum Code und Daten gemeinsam
  zurückgenommen werden müssen.

### Die Alternative, über die nur der Anwender entscheiden kann

Die neuen Werte stammen aus dem Rechenwerk, das dieser gesamte Milestone einführt und das in
den Phasen 9 bis 13 aufgebaut und geprüft wurde. Sie sind nicht „falsch", sondern
**anders** — und der Anwender hat verfügt, dass er jede Bewegung vorher sehen will. Die
Tabelle oben ist diese Liste. Ob die neuen Werte übernommen werden oder zurückgerollt wird,
ist eine fachliche Entscheidung über die Stundenkonten von acht Mitarbeitern und wird hier
nicht getroffen.

---

## Nachtrag zum Blockerbefund — wohin sich die Zahlen bewegt haben

Der Befund oben stellt fest, **dass** sich 99 Werte bewegt haben. Diese Frage ist damit
beantwortet. Die zweite, für die Entscheidung des Anwenders wesentliche Frage — **wohin** sie
sich bewegt haben — wurde anschließend gemessen, weil eine Zahlenbewegung ohne Richtung keine
Entscheidungsgrundlage ist.

### Der bestehende Blocker in `STATE.md` nennt dieselben Kennzahlen

Aus `STATE.md`, Abschnitt „Blockers", eingetragen durch Plan 14-07:

> „Plan 14-10 blockiert: Der Journal-Backfill bewegt den fuer Mitarbeiter sichtbaren Saldo
> (overtime_balance) bei **8 von 20 Nutzern** der Produktionskopie um **bis zu 84 Stunden**."

Gemessen wurde hier: 8 betroffene Nutzer, größte Einzelbewegung 84 h (userId 16, Benedikt
Jochem). Das ist keine Ähnlichkeit, sondern derselbe Effekt aus derselben Ursache: Sowohl der
Journal-Backfill als auch `fix-overtime.ts` schreiben `overtime_balance` mit dem neuen,
periodenbasierten Rechenwerk neu. Was Plan 14-07 auf einer Kopie für den Backfill gemessen
hat, hat `fix-overtime.ts` jetzt auf der Produktion herbeigeführt.

### Die neuen Werte sind die kanonisch gerechneten

Gegenübergestellt wurden der gespeicherte Aggregatwert (`SUM(overtime)` über alle
`overtime_balance`-Monate) und der kanonische Rechenweg
(`unifiedOvertimeService.calculatePeriodOvertime()`, erhoben in
`14-SNAPSHOT-VORHERSAGE-NACH-MIGRATION.users.json`, `asOf=2026-08-21`):

| ID | Name | kanonisch | Aggregat VORHER | Aggregat NACHHER | Abweichung vorher | Abweichung nachher | |
|---|---|---|---|---|---|---|---|
| 1 | System Administrator | 0 | 0 | 0 | 0 | 0 | deckungsgleich |
| 2 | Karin Jochem | 10 | 6 | **10** | 4 | **0** | deckungsgleich |
| 3 | Christine Glas | 4,77 | −46,43 | −15,23 | 51,2 | **20** | besser |
| 16 | Benedikt Jochem | 20 | 104 | **20** | 84 | **0** | deckungsgleich |
| 17 | Carmen Rothemund | −1,26 | −46,06 | −45,26 | 44,8 | **44** | besser |
| 18 | Silvia Lachner | 11,5 | −4,5 | **11,5** | 16 | **0** | deckungsgleich |
| 19 | Ute Stock | 12,41 | 10,41 | **12,41** | 2 | **0** | deckungsgleich |
| 20 | Hans Schauer | −15,8 | −15,8 | −15,8 | 0 | 0 | deckungsgleich |
| 21 | Maria Schauer | −14 | −14 | −14 | 0 | 0 | deckungsgleich |
| 22 | Beate Walleiter | 47,5 | 47,5 | 47,5 | 0 | 0 | deckungsgleich |
| 23 | Sepp Wasensteiner | 0 | 0 | 0 | 0 | 0 | deckungsgleich |
| 24 | Kathrin Leeb | 201,5 | 249,5 | **201,5** | 48 | **0** | deckungsgleich |
| 25 | Heidemarie Tretter | −236,15 | −236,15 | −236,15 | 0 | 0 | deckungsgleich |
| 27 | Reinhold Merl | 0 | 0 | 0 | 0 | 0 | deckungsgleich |
| 29 | Christina Wasensteiner | 65,28 | 85,78 | **65,28** | 20,5 | **0** | deckungsgleich |

**Ergebnis:**

- **Vorher** stimmte das Aggregat bei **7 von 15** aktiven Nutzern mit dem kanonischen
  Rechenweg überein.
- **Nachher** stimmt es bei **13 von 15** exakt überein.
- Die verbleibenden zwei (userId 3 Christine Glas, userId 17 Carmen Rothemund) sind
  **näher** an den kanonischen Wert gerückt, nicht weiter weg.
- **Kein einziger Nutzer steht schlechter als vorher.**

### Das ist zahlengleich der Zustand, den der Anwender für Plan 14-10 gewählt hat

`14-URTEIL-PHASE-9.1.md`, Abschnitt 7.6, misst für die Variante **Vollaufbau** auf der
Produktionskopie:

> „Nach dem Vollaufbau stimmt das Aggregat bei **13 von 15** aktiven Nutzern EXAKT mit dem
> kanonischen Rechenweg überein (vorher: **7 von 15**). **Kein Nutzer steht danach schlechter
> als vorher.**"

Die dort tabellierten Zielwerte — userId 2 → 10,00; 16 → 20,00; 18 → 11,50; 19 → 12,41;
24 → 201,50; 29 → 65,28 — sind **wertgleich** mit dem, was jetzt in der Produktion steht.

**Der Anwender hat für Plan 14-10 die Variante Vollaufbau (`--all-months`) gewählt.** Das
Aggregat `overtime_balance` steht damit bereits auf dem Stand, den diese Wahl herbeiführen
sollte.

### Was dadurch NICHT vorweggenommen wurde

Ausdrücklich festgehalten, damit daraus kein Freibrief wird:

- **Das Journal ist unangetastet.** `overtime_transactions` steht unverändert bei 2671 Zeilen
  mit `SUM(hours)` = −372,68. Plan 14-10 (Journal-Backfill, +995 Zeilen beim Vollaufbau) ist
  **nicht** erledigt und bleibt offen.
- **Die Reihenfolge aus Teil 2 des Urteils ist verletzt.** Dort steht, der Backfill laufe „in
  **jedem** Fall erst **nach** der Verifikation aus Plan 14-09, weil er genau die Größen
  bewegt, über die diese Verifikation urteilt." Genau diese Größen hat `fix-overtime.ts` jetzt
  vor Plan 14-09 bewegt. Plan 14-09 muss seinen Ausgangsstand deshalb neu erheben — der Stand
  von 11:15:41 taugt nicht mehr als Bezugspunkt.
- **Die Auflage des Anwenders bleibt verletzt.** Er wollte jede Bewegung vorher sehen. Er sieht
  sie jetzt nachher. Dass die Richtung günstig ist, ändert daran nichts.

### Was das für die Entscheidung bedeutet

Die Lage ist damit anders, als der reine Blockerbefund nahelegt:

- **Rückweg B** nähme nicht nur die Änderung zurück, sondern den gesamten v3.0-Milestone —
  und stellte einen Aggregatstand wieder her, der bei 8 von 15 aktiven Nutzern **nicht** mit
  dem kanonischen Rechenweg übereinstimmt.
- **Bestehenlassen** akzeptiert eine Bewegung, die der Anwender vorher hätte sehen wollen, die
  aber zahlengleich dem Zustand entspricht, den er für Plan 14-10 bereits gewählt hat.

Diese Abwägung wird hier **nicht** entschieden. Sie betrifft die Stundenkonten von acht
Mitarbeitern und gehört dem Anwender. Die Zahlen, die er dafür sehen wollte, stehen in den
beiden Tabellen dieses Abschnitts und in `14-PROD-IST-VOR-DEPLOYMENT.md` gegen
`14-PROD-IST-NACH-MIGRATION.md`.
