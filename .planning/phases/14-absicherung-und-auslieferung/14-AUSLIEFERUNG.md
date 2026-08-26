# 14-AUSLIEFERUNG — Produktionsauslieferung, Bereinigung, Backfill, Nachtlauf

**Datum:** 2026-08-26
**Zeitfenster:** 04:35–04:58 UTC (06:35–06:58 Berlin)
**Ausführender:** Claude (GSD Plan Executor), Freigabe des Anwenders liegt vor
**Zieldatenbank:** `/home/ubuntu/databases/production.db` (Oracle Cloud, 129.159.8.19)
**Ergebnis:** **Vollständig durchgeführt. Kein Abbruch. Kein Rückweg nötig.**

---

## 0. Ausgangslage — nachgeprüft, nicht übernommen

| Behauptung im Auftrag | Nachprüfung | Befund |
|---|---|---|
| Produktion auf `41c9c09` | `git rev-parse --short HEAD` auf dem Server | **bestätigt** |
| 116 Commits unveröffentlicht, HEAD `eaf5f5c` | `git rev-list --count 41c9c09..HEAD` = **116** | **bestätigt** — davon lagen 3 (reine `docs`-Commits ohne `server/**`) bereits auf `origin/main`, ohne Deployment auszulösen; **113** waren tatsächlich zu pushen |
| Nachtlauf pausiert (`#PAUSIERT-14-08`) | `crontab -l` | **bestätigt** |
| Sicherung `production.PRE-RELEASE_20260826_063302.db`, SHA-256 `c3d7becb…1943f` | `sha256sum` auf dem Server | **bit-genau bestätigt** — keine zweite Sicherung gezogen |
| 3 Zukunfts-Monatszeilen (3/2026-09, 17/2026-09, 30/2026-10) | Trockenlauf `purgeFutureOvertimeRows.ts` | **bestätigt** |
| 100 Journalbuchungen mit Zukunftsdatum | Trockenlauf | **bestätigt** |
| Aggregat gegen Journal: 49 ok / 37 abweichend / 14 Nutzer (= 86 Zeilen) | eigene Messung | **NICHT REPRODUZIERBAR — siehe Abweichung A-1** |
| Lokal keine Migration über 015 hinaus | `ls server/src/database/migrations/` | **bestätigt**, höchste ist `015_unique_reversal_of_index` |

### Abweichung A-1 — die Zahl „49 von 86" ist nicht reproduzierbar

Gemessen wurde: für jede Zeile in `overtime_balance` die Spalte `overtime` gegen
`SUM(hours)` der `overtime_transactions` desselben Nutzers und Monats (Toleranz 0,005 h).

| Abgrenzung | Zeilen | übereinstimmend | abweichend | Nutzer |
|---|---:|---:|---:|---:|
| alle Nutzer | 144 | 81 | 63 | 16 |
| nur `deletedAt IS NULL` | 117 | 76 | 41 | 12 |
| nur `status='active'` | 117 | 76 | 41 | 12 |
| lokal `development.db`, alle | 621 | 267 | 354 | 60 |

Keine Abgrenzung ergibt 86 Zeilen oder 49 Treffer. Die Zahl stammt aus einer nicht
rekonstruierbaren Erhebung. **Sie wird nicht verwendet.** Maßgeblich ist die oben definierte,
in allen drei Messpunkten (Schritt 1, 3, 6) unverändert angewandte Kennzahl über **alle**
Nutzer: Ausgangswert **81 von 144**. Die Abweichung wird benannt, nicht verrechnet.

---

## 1. Schritt 1 — Ist-Stand VOR der Auslieferung

**Werkzeug:** `server/scripts/14-ist-stand-report.mjs`, ausschließlich lesend
(`better-sqlite3 { readonly: true }`), direkt gegen die Produktionsdatenbank auf dem Server —
nicht gegen eine Dateikopie, damit der WAL-Inhalt mitgelesen wird.

**Dateien:**
`14-AUSLIEFERUNG-VOR.json` / `14-AUSLIEFERUNG-VOR.md`

| Kennzahl | Wert |
|---|---|
| SHA-256 Nutzdatenkern | `516cadd67c79b51a4fa62e2f7bc1d86e517a98fe7858a8d2ed6e4a6d68893d33` |
| SHA-256 JSON-Datei | `f895b7dc1832c22a05cd6b744980f69c8923672eed8240c2b3fe3d6301144f6b` |
| `integrity_check` | `ok` |
| `foreign_key_check` | leer |
| Nutzer | 20 (15 aktiv, 5 soft-gelöscht) |

Der Dateihash wurde nach dem Herunterladen lokal gegengeprüft und stimmt überein — die
Übertragung ist damit belegt, nicht behauptet.

### Die fünf geschützten Tabellen (Werkzeug `protectedTablesChecksum.ts`)

| Tabelle | Zeilen | SHA-256 |
|---|---:|---|
| `time_entries` | 718 | `0972d332454ad0fe6ce640e41265355b03629af6dbddeadd9e9573ebfecd5e93` |
| `absence_requests` | 43 | `286f291c830dad171fba64fe0fb0d83a21a8ed95cd4215fe7131a50ada6614aa` |
| `overtime_corrections` | 4 | `f55792d4da5f4dd096d2ae0271503380b69dc82f5f300d10e61820a82c14a227` |
| `vacation_balance` | 40 | `ca5e82502b4e5b403a3341429a1043f62c6b4c363a1adf8d10ecfe0295ea63dd` |
| `vacation_transactions` | 59 | `df1c7d2c8f6dafb01f2170a2652a39bfcd4e6aea94f3ecdbdc3c5cfb2a2e54e0` |

Entspricht exakt der zugesicherten Ausgangslage 718/43/4/40/59.

### Saldo je Nutzer — angezeigter Wert und Rohsumme

Beleg: `14-auslieferung-belege/schritt1-saldo-je-nutzer.md`.
`angezeigt` = Summe über Monatszeilen mit `month <= 2026-08`; `roh` = Summe über alle Zeilen.

| ID | Name | Wochenstd. | angezeigt | roh | Differenz | Zukunftsmonate |
|---|---|---:|---:|---:|---:|---|
| 1 | System Administrator | 0 | 0 | 0 | 0 | — |
| 2 | Karin Jochem | 5 | 10 | 10 | 0 | — |
| 3 | Christine Glas | 8 | 5,19 | −14,81 | **−20** | 2026-09 |
| 15 | Test Test *(gelöscht)* | 0 | −83,46 | −83,46 | 0 | — |
| 16 | Benedikt Jochem | 30 | 8 | 8 | 0 | — |
| 17 | Carmen Rothemund | 12 | 1,24 | −42,76 | **−44** | 2026-09 |
| 18 | Silvia Lachner | 20 | 11,5 | 11,5 | 0 | — |
| 19 | Ute Stock | 2,5 | 12,41 | 12,41 | 0 | — |
| 20 | Hans Schauer | 7 | −18,6 | −18,6 | 0 | — |
| 21 | Maria Schauer | 5 | −16 | −16 | 0 | — |
| 22 | Beate Walleiter | 0 | 47,5 | 47,5 | 0 | — |
| 23 | Sepp Wasensteiner | 0 | 0 | 0 | 0 | — |
| 24 | Kathrin Leeb | 0 | 201,5 | 201,5 | 0 | — |
| 25 | Heidemarie Tretter | 8 | −239,35 | −239,35 | 0 | — |
| 26 | Test Test *(gelöscht)* | 0 | 0 | 0 | 0 | — |
| 27 | Reinhold Merl | 0 | 0 | 0 | 0 | — |
| 28 | Test Test *(gelöscht)* | 12 | −192,5 | −192,5 | 0 | — |
| 29 | Christina Wasensteiner | 0 | 65,28 | 65,28 | 0 | — |
| 30 | Test Urlaub *(gelöscht)* | 40 | −1272 | −1448 | **−176** | 2026-10 |
| 31 | UA T *(gelöscht)* | 40 | −1272 | −1272 | 0 | — |

**Urlaub:** 40 Konten, **40 davon schlüssig** (`Anspruch + Übertrag − Genommen = Rest`).
**Kanonischer Rechenweg** (`snapshotBalances.ts`, `unifiedOvertimeService.calculatePeriodOvertime()`):
**10 von 15** auswertbaren Nutzern deckungsgleich mit dem Aggregat.
**Zukunftszeilen:** 100 Journalbuchungen, 3 Monatszeilen.

---

## 2. Schritt 2 — Ausliefern

```
git push origin main
   22f9cdc..eaf5f5c  main -> main
```

### Deployment-Verifikation nach `.claude/CLAUDE.md` (Pflicht)

**1. GitHub Actions**

```
gh run list --workflow="deploy-server.yml" --limit 1
completed  success  docs(14.2): Phase 14.2 verifiziert …  main  push  32931242550  6m15s  2026-08-26T04:42:47Z
```

Status `completed`, Conclusion **`success`**, Dauer 6 m 15 s. Alle Schritte grün, einschließlich
`Verify DB path post-deploy` (belegt, dass PM2 tatsächlich `/home/ubuntu/databases/production.db`
geöffnet hat). Vollständiges Protokoll: `14-auslieferung-belege/schritt2-deploy-32931242550.txt`
(849 Zeilen). Einzige Anmerkung ist ein Hinweis auf die Node-20-Abkündigung bei
`actions/checkout@v4` — kein Fehler.

**2. Health-Check**

```
curl -s http://129.159.8.19:3000/api/health
{"status":"ok","message":"TimeTracking Server is running","version":"0.1.0","timestamp":"2026-08-26T04:49:30.925Z"}
```

Server-Code nach dem Deployment: `eaf5f5c` — deckungsgleich mit dem lokalen HEAD.
PM2: `timetracking-server`, `online`, Neustartzähler 0.

**3. Migrationsstand**

Aus dem Deployment-Protokoll:

```
🗄️  Running migrations on PRODUCTION database
✅ No pending migrations - database is up to date!
```

Direkt gegen die Produktionsdatenbank gemessen: **18 Einträge in `migrations`, höchste
`015_unique_reversal_of_index`** — identisch mit dem Stand vor dem Deployment.
**Erwartung „keine neue Migration" ist eingetreten.**

**4. `fix-overtime.ts` (läuft laut Workflow nach dem PM2-Start)**

```
📊 Found 15 active users
…
✅ DONE!
📊 Users processed: 15
🔄 Total entries updated: 117
```

Beim letzten Deployment bewegte dieser Lauf 99 Werte, diesmal berührte er 117 Monatseinträge.
Die Wirkung wurde gemessen, nicht verhindert — siehe Schritt 3.

### Nebenbefund B-1 — der Deploy-Workflow schaltet den Nachtlauf selbst wieder an

`deploy-server.yml` enthält:

```bash
(crontab -l 2>/dev/null | grep -v "fix-overtime.ts"; echo "$CRON_COMMAND") | crontab -
```

Das `grep -v` entfernt auch die auskommentierte Zeile `#PAUSIERT-14-08 … fix-overtime.ts` und
schreibt die **aktive** Zeile neu. Der nächtliche Lauf war damit bereits mit dem Deployment
wieder scharf, bevor Schritt 7 an der Reihe war. Das Ergebnis entspricht dem Auftrag; der Weg
dorthin war ein anderer als vorgesehen und wird deshalb hier benannt. Siehe Schritt 7.

### Nebenbefund B-2 — der Deploy löscht `.mjs`-Werkzeuge im `server/`-Baum

`find server -name "*.mjs" -delete` im Workflow entfernt `server/scripts/14-ist-stand-report.mjs`
und `14-ist-stand-vergleich.mjs` aus dem Checkout. Die Werkzeuge wurden vor jeder Messung neu
auf den Server kopiert. Rein lesende Werkzeuge, kein Eingriff in den ausgelieferten Code.

---

## 3. Schritt 3 — Messung nach dem Deployment

**Dateien:** `14-AUSLIEFERUNG-NACH-DEPLOY.json` / `.md`
SHA-256 Nutzdatenkern: `39ec9993efad900c895228fe3d94dc6663642a5cf92d3a65ad8ba22fac4fa042`
`integrity_check: ok`, `foreign_key_check` leer.

### Die fünf geschützten Tabellen — unverändert

Zeilenzahlen 718/43/4/40/59 **und alle fünf SHA-256 bit-identisch** mit Schritt 1.

> **Hinweis zum Datei-SHA-256:** Der Hash der Datei `production.db` war vor und nach dem
> Deployment identisch (`96c6e69d…ddb2`), obwohl 117 Einträge geschrieben wurden. Grund ist der
> WAL-Modus: die Änderungen standen zu diesem Zeitpunkt in `production.db-wal` (1 648 032 Bytes),
> nicht in der Hauptdatei. Genau davor warnt `.claude/CLAUDE.md`. **Der Datei-Hash ist hier kein
> Beleg für Unverändertheit.** Belegkraft haben ausschließlich die tabellenweisen SHA-256, die
> über eine lesende SQL-Verbindung erhoben werden und den WAL-Inhalt einschließen.

### Bewegungen durch das Deployment — namentlich

Beleg: `14-auslieferung-belege/schritt3-vergleich-1-gegen-3.md`

| ID | Name | angezeigt vorher | angezeigt nachher | Betrag |
|---|---|---:|---:|---:|
| 16 | Benedikt Jochem | 8 h | 2 h | **−6 h** |
| 18 | Silvia Lachner | 11,5 h | 3,5 h | **−8 h** |
| 20 | Hans Schauer | −18,6 h | −20 h | **−1,4 h** |
| 21 | Maria Schauer | −16 h | −17 h | **−1 h** |
| 25 | Heidemarie Tretter | −239,35 h | −240,95 h | **−1,6 h** |

**5 von 20 Nutzern bewegt.** Die Rohsumme bewegte sich bei denselben fünf um dieselben Beträge.

### Der maschinelle Feldvergleich und warum sein Urteil hier nicht gilt

`server/scripts/14-ist-stand-vergleich.mjs` meldet **20 Abweichungen** und schließt mit
`ERGEBNIS: 20 BLOCKER`. Dieses Werkzeug wurde für das Migrationsfenster geschrieben, in dem
zugesichert war, dass sich an den Stunden **nichts** ändern darf. Für diesen Auftrag gilt
ausdrücklich das Gegenteil: die Neuberechnung durch `fix-overtime.ts` ist gewollt.

Entscheidend ist, **worin** die 20 Abweichungen bestehen. Vollständig geprüft, alle 20:

- Sie betreffen **ausschließlich den laufenden Monat 2026-08** sowie die daraus folgenden
  Jahressummen `sumTargetHours` / `sumOvertime`.
- Verändert wurde in jedem Fall nur `targetHours` (nach oben) und dadurch `overtime`.
- **Kein einziger vergangener Monat wurde angefasst. Kein einziger `actualHours`-Wert wurde
  verändert.** Kein Stammdatenfeld, kein Urlaubswert, keine Zeilenzahl.

Beispiel Benedikt Jochem: `2026-08 targetHours 102 → 108`, `overtime −7,5 → −13,5`.

Das ist die schlüssige Folge davon, dass der letzte Lauf am 23.08. stattfand und heute der
26.08. ist: drei weitere Arbeitstage Soll sind aufgelaufen. `fix-overtime.ts` hat **keine
Historie umgeschrieben**, sondern den laufenden Monat fortgeschrieben. Damit ist die Wirkung
nicht nur gemessen, sondern erklärt.

**Zeilenzahlen:** `users` 20, `time_entries` 718, `absence_requests` 43,
`overtime_transactions` 2690, `overtime_balance` 144, `vacation_balance` 40,
`vacation_transactions` 59, `user_work_periods` 20 — **sämtlich unverändert**.
**Urlaub:** kein einziger Jahreswert bewegt. 40 von 40 Konten schlüssig.
**Aggregat gegen Journal:** 80 von 144 übereinstimmend (vorher 81) — leicht schlechter.
**Zukunftszeilen:** unverändert 100 + 3, das Deployment hat sie weder entfernt noch vermehrt.

---

## 4. Schritt 4 — Zukunftszeilen bereinigen

### Zusätzliche Sicherung vor dem Eingriff

```
VACUUM INTO '/home/ubuntu/databases/backups/production.PRE-PURGE-ZUKUNFTSZEILEN_20260826_045127.db'
```

`VACUUM INTO`, **nicht `cp`** — ein Dateikopiervorgang auf eine WAL-aktive Datei kann die
jüngsten Transaktionen verlieren (`14-ROLLBACK-RUNBOOK.md`, Abschnitt 1).

| Prüfung | Ergebnis |
|---|---|
| SHA-256 | `220fa80c5b0b49c40524e3179926417976628060b514e1c10b9df174b28b1e90` |
| Größe | 1 331 200 Bytes |
| `integrity_check` | `ok` |
| `foreign_key_check` | leer |
| Zeilen | users 20, time_entries 718, absence_requests 43, overtime_corrections 4, vacation_balance 40, vacation_transactions 59, **overtime_transactions 2690, overtime_balance 144** |

Dass die Sicherung 2690/144 enthält — also den Stand *nach* dem Deployment — belegt zugleich,
dass `VACUUM INTO` den WAL-Inhalt mitgenommen hat.

### Stufe 1 — Trockenlauf

```
DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
  npx tsx src/scripts/purgeFutureOvertimeRows.ts --allow-production
```

Auswahlprädikat, wie vom Werkzeug ausgegeben:

```
overtime_transactions: date > '2026-08-26'
                       AND type IN (worked, time_entry, earned, vacation_credit, sick_credit,
                                    overtime_comp_credit, special_credit, unpaid_deduction,
                                    unpaid_adjustment, holiday_credit, weekend_credit)
                       AND userId NOT IN (15015)
overtime_balance:      month > '2026-08' AND userId NOT IN (15015)
```

**Fundliste Journal**

| Nutzer | Monat | Typ | Zeilen | davon ≠ 0 | SUM(hours) |
|---|---|---|---:|---:|---:|
| 3 Christine Glas | 2026-09 | `overtime_comp_credit` | 1 | 1 | +4 |
| 3 Christine Glas | 2026-09 | `time_entry` | 29 | 9 | −36 |
| 3 Christine Glas | 2026-09 | `vacation_credit` | 8 | 3 | +12 |
| 17 Carmen Rothemund | 2026-09 | `time_entry` | 29 | 13 | −52 |
| 17 Carmen Rothemund | 2026-09 | `vacation_credit` | 3 | 2 | +8 |
| 30 Test Urlaub | 2026-10 | `time_entry` | 30 | 22 | −176 |
| **Summe** | | | **100** | **50** | **−240** |

**Fundliste Monatsaggregat:** 3/2026-09 (−20 h), 17/2026-09 (−44 h), 30/2026-10 (−176 h) —
**3 Zeilen**.

**Die Erwartung von 100 Journalzeilen und 3 Monatszeilen ist eingetreten.** Eine Abweichung
zur Erwartung gab es nicht; die vom Werkzeug selbst gemeldete Diskrepanz betrifft die
Roadmap-Zahl 59, die weder mit 100 noch mit 50 deckungsgleich ist — sie wird vom Werkzeug
benannt und nicht verrechnet.

**Ausschlussprädikat geprüft, obwohl der Testnutzer nicht existiert:**

```
(a) durch den Nutzerausschluss (userId IN 15015): keine
    Summe ausgenommen: 0 Journalzeilen, 0 Monatszeilen.
(b) durch den Typfilter (book-once-Typen, insbesondere model_change):
    keine — im Bestand trägt heute keine book-once-Zeile ein Datum in der Zukunft.
```

Bestätigt: Nutzer 15015 existiert in der Produktion nicht (0 ausgenommene Zeilen), und der
Typfilter hat keine `model_change`-Zeile fälschlich eingefangen — es gibt keine.

### Stufe 2 — `--apply`

```
=== Schreiblauf abgeschlossen ===
  overtime_transactions: 100 Zeilen entfernt (im Trockenlauf gefunden: 100).
  overtime_balance:      3 Zeilen entfernt (im Trockenlauf gefunden: 3).

=== Nachkontrolle ===
  overtime_transactions unter dem Praedikat verblieben: 0 (erwartet 0)
  overtime_transactions mit Zukunftsdatum ausserhalb des Testnutzers, ALLE Typen: 0 (erwartet 0)
  overtime_balance unter dem Praedikat verblieben: 0 (erwartet 0)

integrity_check: [{"integrity_check":"ok"}]
foreign_key_check: []
```

Die fünf geschützten Tabellen wies das Werkzeug vor **und** nach dem Lauf aus — Zeilenzahlen
und SHA-256 **identisch**.

### Wirkung auf den Saldo — allein durch die Bereinigung

Beleg: `14-auslieferung-belege/schritt4-vergleich-3-gegen-zwischen.md`

| ID | Name | angezeigt vorher | angezeigt nachher | Betrag | roh vorher | roh nachher | Betrag roh |
|---|---|---:|---:|---:|---:|---:|---:|
| 3 | Christine Glas | 5,19 h | 5,19 h | **0 h** | −14,81 h | 5,19 h | +20 h |
| 17 | Carmen Rothemund | 1,24 h | 1,24 h | **0 h** | −42,76 h | 1,24 h | +44 h |
| 30 | Test Urlaub | −1272 h | −1272 h | **0 h** | −1448 h | −1272 h | +176 h |

**Der für Mitarbeiter sichtbare Saldo hat sich bei keinem einzigen Nutzer bewegt.** Bewegt hat
sich nur die Rohsumme — und zwar exakt um die Beträge der entfernten Zukunftsmonate. Das ist
die richtige Wirkung: entfernt wurde, was ohnehin nicht angezeigt wurde.

---

## 5. Schritt 5 — Journal-Backfill, Variante Vollaufbau

### Zusätzliche Sicherung vor dem Eingriff

```
VACUUM INTO '/home/ubuntu/databases/backups/production.PRE-BACKFILL-ALLMONTHS_20260826_045220.db'
```

| Prüfung | Ergebnis |
|---|---|
| SHA-256 | `8583e48e1b4b77a80a3b6ae536508fed68eb99c108cce5735dd1f33f6a952d49` |
| `integrity_check` | `ok` |
| Zeilen | time_entries 718, absence_requests 43, overtime_corrections 4, vacation_balance 40, vacation_transactions 59, **overtime_transactions 2590, overtime_balance 141** |

2590 = 2690 − 100 und 141 = 144 − 3: die Sicherung enthält nachweislich den Stand nach der
Bereinigung.

### Stufe 1 — Trockenlauf

```
DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
  npx tsx src/scripts/backfillOvertimeJournal.ts --all-months --allow-production
```

| Nutzer | unvollständige Monate |
|---|---|
| 2 Karin Jochem | 4 — 2026-01, 04, 05, 07 |
| 3 Christine Glas | 3 — 2026-01, 03, 06 |
| 16 Benedikt Jochem | 6 — 2026-01, 03, 04, 05, 06, 07 |
| 17 Carmen Rothemund | 4 — 2026-03, 04, 05, 06 |
| 18 Silvia Lachner | 3 — 2026-01, 04, 07 |
| 19 Ute Stock | 5 — 2026-01, 02, 03, 04, 05 |
| 20 Hans Schauer | 3 — 2026-04, 06, 07 |
| 21 Maria Schauer | 3 — 2026-04, 06, 07 |
| 22 Beate Walleiter | 1 — 2026-07 |
| 24 Kathrin Leeb | 1 — 2026-05 |
| 25 Heidemarie Tretter | 5 — 2026-03, 04, 05, 06, 07 |
| 29 Christina Wasensteiner | 1 — 2026-07 |

```
Summe: 12 betroffene Nutzer, 39 unvollständige Monate. Übersprungene (soft-gelöschte) Nutzer: 5.
--all-months gesetzt: der Schreiblauf verarbeitet stattdessen ALLE 100 vergangenen Monate über 15 Nutzer.

overtime_transactions vor dem Lauf: COUNT=2590, SUM(hours)=-133.76, model_change-Zeilen=0
```

Die 100 Monate über 15 Nutzer decken sich mit der Messlage, auf der die Empfehlung beruhte.

### Stufe 2 — `--apply`

```
100 von 100 Monaten verarbeitet — userId=29, Monat=2026-07

overtime_transactions nach dem Lauf: COUNT=3581, SUM(hours)=-207.09, model_change-Zeilen=0
Differenz: COUNT=991, SUM(hours)=-73.33
integrity_check: [{"integrity_check":"ok"}]
model_change-Zeilen unveraendert (0 vor, 0 nach dem Lauf).

### FERTIG ###
```

Alle 100 Monate verarbeitet, kein Abbruch. **+991 Journalzeilen.** Der unabhängige
`model_change`-Zähler des Werkzeugs bestätigt: 0 vor, 0 nach dem Lauf.

### Wirkung auf den Saldo — allein durch den Backfill

Beleg: `14-auslieferung-belege/schritt5-vergleich-zwischen-gegen-6.md`

> **Keine Bewegung.** Der Saldo ist bei jedem Nutzer in beiden Abgrenzungen unverändert.
> **0 von 20 Nutzern bewegt.**

| Tabelle | vor Backfill | nach Backfill | Bewegung |
|---|---:|---:|---|
| `overtime_transactions` | 2590 | 3581 | **+991** |
| `overtime_balance` | 141 | 141 | unverändert |
| alle übrigen | | | unverändert |

**Das ist das bestmögliche Ergebnis.** Der Vollaufbau hat den für Mitarbeiter sichtbaren Saldo
nicht angetastet — er hat ausschließlich das **Journal** wieder in Deckung mit dem Aggregat
gebracht. Das Monatsaggregat war nach dem Lauf von `fix-overtime.ts` bereits richtig; der
Backfill hat die Buchungsliste darunter nachgezogen. Der Kontoauszug zeigt damit oben und
unten dieselbe Rechnung, ohne dass sich für einen Mitarbeiter eine Zahl geändert hätte.

---

## 6. Schritt 6 — Abschlussmessung

**Dateien:** `14-AUSLIEFERUNG-NACH.json` / `.md`
SHA-256 Nutzdatenkern: `dd270dc5cfb5f2f3e5d234f8808f6d836ed836bfcd7153a2bdc9f4ca8a412da0`
`integrity_check: ok`, `foreign_key_check` leer.

### Die fünf geschützten Tabellen — über alle vier Messpunkte identisch

| Tabelle | Schritt 1 | Schritt 3 | nach Bereinigung | Schritt 6 | SHA-256 (durchgehend) |
|---|---:|---:|---:|---:|---|
| `time_entries` | 718 | 718 | 718 | **718** | `0972d332…d5e93` |
| `absence_requests` | 43 | 43 | 43 | **43** | `286f291c…6614aa` |
| `overtime_corrections` | 4 | 4 | 4 | **4** | `f55792d4…2c14a227` |
| `vacation_balance` | 40 | 40 | 40 | **40** | `ca5e8250…5ea63d` |
| `vacation_transactions` | 59 | 59 | 59 | **59** | `df1c7d2c…2a2e54e0` |

Nicht nur die Zahl ist gleich — die SHA-256 sind an allen vier Messpunkten **bit-identisch**.
Damit ist belegt, dass in diesen Tabellen keine Zeile hinzugekommen, verschwunden oder
verändert ist. Die Zusicherung „es darf nichts verloren gehen" ist mit Prüfsummen erfüllt.

### Vergleich gegen Schritt 1 — Gesamtbewegung

Beleg: `14-auslieferung-belege/schritt6-vergleich-1-gegen-6.md`

| ID | Name | angezeigt vorher | angezeigt nachher | Betrag | roh vorher | roh nachher | Betrag roh |
|---|---|---:|---:|---:|---:|---:|---:|
| 3 | Christine Glas | 5,19 h | 5,19 h | 0 h | −14,81 h | 5,19 h | +20 h |
| 16 | Benedikt Jochem | 8 h | 2 h | **−6 h** | 8 h | 2 h | −6 h |
| 17 | Carmen Rothemund | 1,24 h | 1,24 h | 0 h | −42,76 h | 1,24 h | +44 h |
| 18 | Silvia Lachner | 11,5 h | 3,5 h | **−8 h** | 11,5 h | 3,5 h | −8 h |
| 20 | Hans Schauer | −18,6 h | −20 h | **−1,4 h** | −18,6 h | −20 h | −1,4 h |
| 21 | Maria Schauer | −16 h | −17 h | **−1 h** | −16 h | −17 h | −1 h |
| 25 | Heidemarie Tretter | −239,35 h | −240,95 h | **−1,6 h** | −239,35 h | −240,95 h | −1,6 h |
| 30 | Test Urlaub *(gelöscht)* | −1272 h | −1272 h | 0 h | −1448 h | −1272 h | +176 h |

**8 von 20 Nutzern bewegt.** Davon änderte sich der **angezeigte** Saldo bei **5** Nutzern —
und diese fünf Bewegungen stammen sämtlich aus Schritt 2 (`fix-overtime.ts` beim Deployment),
nicht aus Bereinigung oder Backfill. Bei den übrigen drei bewegte sich nur die Rohsumme,
verursacht durch die Bereinigung.

**Zuordnung jeder Bewegung zu ihrem Verursacher:**

| Verursacher | Nutzer mit bewegtem *angezeigtem* Saldo | Nutzer mit bewegter *Rohsumme* |
|---|---:|---:|
| Schritt 2 — Deployment / `fix-overtime.ts` | **5** (16, 18, 20, 21, 25) | 5 |
| Schritt 4 — Bereinigung Zukunftszeilen | **0** | 3 (3, 17, 30) |
| Schritt 5 — Backfill `--all-months` | **0** | 0 |

### Vergleich gegen Schritt 3

Beleg: `14-auslieferung-belege/schritt6-vergleich-3-gegen-6.md` — 3 von 20 Nutzern bewegt,
ausschließlich in der Rohsumme (3: +20 h, 17: +44 h, 30: +176 h), angezeigter Saldo bei allen
unverändert. Das ist deckungsgleich mit der Wirkung der Bereinigung allein.

### Übereinstimmung mit dem kanonischen Rechenweg

Werkzeug `snapshotBalances.ts` (`unifiedOvertimeService.calculatePeriodOvertime()`), gegen eine
`VACUUM INTO`-Messkopie des jeweiligen Standes, `--asOf=2026-08-26`.
Beleg: `14-auslieferung-belege/schritt6-kanonisch-vergleich.txt`

| | vorher | nachher |
|---|---:|---:|
| auswertbar | 15 | 15 |
| **deckungsgleich mit dem kanonischen Weg** | **10** | **15** |
| abweichend | 5 | **0** |
| nicht auswertbar (soft-gelöschte Testnutzer 15, 26, 28, 30, 31) | 5 | 5 |

| ID | Diff vorher | Diff nachher | Urteil |
|---|---:|---:|---|
| 16 Benedikt Jochem | 6 h | **0 h** | jetzt deckungsgleich |
| 18 Silvia Lachner | 8 h | **0 h** | jetzt deckungsgleich |
| 20 Hans Schauer | 1,4 h | **0 h** | jetzt deckungsgleich |
| 21 Maria Schauer | 1 h | **0 h** | jetzt deckungsgleich |
| 25 Heidemarie Tretter | 1,6 h | **0 h** | jetzt deckungsgleich |
| 1, 2, 3, 17, 19, 22, 23, 24, 27, 29 | 0 h | 0 h | unverändert deckungsgleich |

**15 von 15 — kein Nutzer wurde schlechter.** Die Prognose lautete 13 von 15; erreicht wurden
15 von 15. Der Grund: `fix-overtime.ts` hatte das Aggregat beim Deployment bereits auf den
kanonischen Stand gezogen, der Backfill hat es dort belassen.

### Übereinstimmung Monatszeilen gegen Journal

Kennzahl wie unter Abweichung A-1 definiert, über alle Nutzer:

| Messpunkt | Monatszeilen | übereinstimmend | abweichend | betroffene Nutzer |
|---|---:|---:|---:|---:|
| Schritt 1 (vorher) | 144 | 81 | 63 | 16 |
| Schritt 3 (nach Deployment) | 144 | 80 | 64 | 16 |
| **Schritt 6 (Abschluss)** | **141** | **112** | **29** | **11** |

Von 63 abweichenden Monatszeilen sind 29 geblieben — **34 wurden geschlossen**, die Zahl der
betroffenen Nutzer sank von 16 auf 11. Die verbliebenen 11 umfassen 4 soft-gelöschte
Testnutzer (15, 28, 30, 31), die der Backfill bewusst überspringt; unter den aktiven Nutzern
sind es **7** (2, 16, 18, 19, 20, 21, 25).

### Stehen noch Zeilen für Monate in der Zukunft?

**Nein.** Zweifach gemessen:

```
--- eigene Messung ---
  overtime_transactions mit date > heute: 0
  overtime_balance mit month > 2026-08:   0  []

--- Nachkontrolle über purgeFutureOvertimeRows.ts (Trockenlauf) ---
=== Fundliste overtime_transactions ===  Keine Zukunftszeilen gefunden.
=== Fundliste overtime_balance ===       Keine Zukunftsmonate gefunden.
```

Der Backfill hat die bereinigten Zeilen **nicht** wieder angelegt — der Deckel auf „heute" aus
dem BL-01-Fix hält. Genau dafür war die Reihenfolge Bereinigung → Backfill vorgesehen.

### Urlaub

- **40 Konten, 40 davon schlüssig** — unverändert gegenüber Schritt 1.
- Maschineller Feldvergleich Schritt 1 gegen Schritt 6: *„Urlaub unverändert: kein einziger
  Jahreswert hat sich zwischen A und B bewegt."*
- `vacation_balance` (40) und `vacation_transactions` (59) bit-identisch nach SHA-256.

### Tabellenumfang gesamt

| Tabelle | Schritt 1 | Schritt 6 | Bewegung |
|---|---:|---:|---|
| `users` | 20 | 20 | unverändert |
| `time_entries` | 718 | 718 | **unverändert** |
| `absence_requests` | 43 | 43 | **unverändert** |
| `overtime_corrections` | 4 | 4 | **unverändert** |
| `vacation_balance` | 40 | 40 | **unverändert** |
| `vacation_transactions` | 59 | 59 | **unverändert** |
| `user_work_periods` | 20 | 20 | unverändert |
| `overtime_transactions` | 2690 | 3581 | +891 (−100 Bereinigung, +991 Backfill) |
| `overtime_balance` | 144 | 141 | −3 (Bereinigung) |

**Bereinigung und Backfill haben ausschließlich `overtime_transactions` und `overtime_balance`
angefasst.** Die Zusicherung ist eingehalten.

---

## 7. Schritt 7 — Nächtlicher Lauf

```
$ crontab -l
0 2 * * 0 /home/ubuntu/TimeTracking-Staging/server/scripts/sync-prod-to-staging.sh >> /home/ubuntu/logs/db-sync.log 2>&1
0 3 * * * cd /home/ubuntu/TimeTracking-Clean/server && DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production npx tsx scripts/fix-overtime.ts >> /home/ubuntu/logs/overtime-fix.log 2>&1
```

| Prüfung | Ergebnis |
|---|---|
| Beginnt die `fix-overtime`-Zeile mit `#`? | **Nein — die Zeile ist aktiv** |
| Marker `#PAUSIERT-14-08` noch vorhanden? | **0 Treffer — verschwunden** |
| Sicherungsdatei `/home/ubuntu/crontab.PRE-14-08-PAUSE.bak` | **steht**, 322 Bytes, 23.08. 11:04, SHA-256 `285e9d44e595890e6388e50363209701cf5dba14a5d09f2e16f02128a2cd539d` |
| Nächste Ausführung | 03:00 Serverzeit (UTC); Serverzeit bei Abschluss 04:58 UTC → nächster Lauf in rund 22 Stunden |

Die aktive Zeile ist **wortgleich** mit der Zeile in der Sicherung
`crontab.PRE-14-08-PAUSE.bak` — der Zustand vor der Pause ist exakt wiederhergestellt.

**Das Entkommentieren war nicht mehr nötig:** Der Deploy-Workflow hat die Zeile in Schritt 2
selbst neu geschrieben (Nebenbefund B-1). Der geforderte Endzustand ist erreicht und belegt,
der Weg dorthin war ein anderer als im Auftrag vorgesehen. Die Sicherungsdatei wurde wie
verlangt stehen gelassen.

---

## 8. Schritt 8 — Funktionstest am laufenden System

### 8.1 Health-Check

```
$ curl -s -i http://129.159.8.19:3000/api/health
HTTP/1.1 200 OK
…
{"status":"ok","message":"TimeTracking Server is running","version":"0.1.0","timestamp":"2026-08-26T04:58:10.117Z"}
```

Sicherheits-Header vollständig (CSP, HSTS, `X-Content-Type-Options`, `X-Frame-Options`),
Rate-Limiter aktiv (`RateLimit-Policy: 600;w=60`).

### 8.2 Anmeldeversuch gegen die API

```
$ curl -s -i -X POST http://129.159.8.19:3000/api/auth/login \
    -H "Content-Type: application/json" -d '{"username":"admin","password":"admin123"}'
HTTP/1.1 401 Unauthorized
RateLimit-Policy: 20;w=3600
{"success":false,"error":"Authentication failed"}

$ curl -s -X POST … -d '{"username":"BenediktJochem","password":"falsch-absichtlich"}'
HTTP 401  {"success":false,"error":"Invalid username or password"}
```

Der Anmeldeweg antwortet korrekt: **401, nicht 500** — die Datenbank ist erreichbar, `bcrypt`
läuft, der strengere Login-Rate-Limiter (`20;w=3600`) greift.

**Grenze, die benannt gehört:** Ein **erfolgreicher** Anmeldevorgang war nicht möglich. Es lagen
keine Produktions-Zugangsdaten vor. Die in `14-ABNAHME-SERVER.md` dokumentierten Daten
(`admin`/`admin123`) stammen aus einer Entwicklungsdatenbank — dort tragen die Nutzer IDs im
Bereich 48 000, in der Produktion 1–31. Ein Kennwort in der Produktion zurückzusetzen, um an
eine Sitzung zu kommen, wäre ein nicht beauftragter Eingriff in `users` gewesen und wurde
**nicht** vorgenommen. Vor dem Versuch wurde geprüft, dass `authService` **keine** Sperre nach
Fehlversuchen kennt — ein fehlgeschlagener Anmeldeversuch konnte das Produktivkonto also nicht
aussperren.

### 8.3 Abruf des Kontoauszugs

**Zwei Befunde vorab.**

**(a) Es gibt in der Produktion keinen Nutzer mit Modellwechsel.** Geprüft über
`user_work_periods`: kein einziger Nutzer hat mehr als eine Arbeitszeitperiode.

```sql
SELECT p.userId, COUNT(*) c FROM user_work_periods p
  JOIN users u ON u.id = p.userId GROUP BY p.userId HAVING c > 1
-- Ergebnis: keine
```

Der Abruf „für einen Nutzer mit Modellwechsel" ist gegen die Produktion daher nicht
durchführbar. Ersatzweise wurden die Nutzer herangezogen, deren Saldo sich in diesem Lauf
bewegt hat.

**(b) Der Endpunkt ist erreichbar und geschützt.**

```
$ curl -s "http://129.159.8.19:3000/api/overtime/transactions/live?userId=16&from=2026-08-01&to=2026-08-31"
HTTP 401  {"success":false,"error":"Unauthorized - Please login"}
```

Der `requireAuth`-Wächter arbeitet. Ohne Sitzung — siehe 8.2 — kein Inhalt.

**(c) Inhaltlicher Abruf über das vorgesehene Werkzeug.** `verifyBalanceVsJournal.ts` ruft
exakt die beiden Funktionen auf, die die Kontoauszugs-Route benutzt
(`calculateCurrentOvertimeBalance` für den fetten Saldo, `calculateLiveOvertimeTransactions`
für die Buchungsliste), mit identischen Argumenten und **ohne** die Kürzung durch `limit`, die
die Route vornimmt. Ausgeführt gegen eine `VACUUM INTO`-Abbildung des Produktionsstands nach
allen Eingriffen:

```
Heute (Berlin):            2026-08-26
Zeitraum von/bis:          2026-08-01 bis 2026-08-31
Zukunftsfenster:           2026-08-31 liegt hinter heute — BL-01 ist in diesem Lauf messbar.

  userId   SummeJournal   SaldoMonat   SaldoHeute   Zukunftsdiff   JournalDiff
       1           0.00         0.00         0.00           0.00          0.00
       2          -9.00        -9.00        -9.00           0.00          0.00
       3           4.93         0.93         0.93           0.00          4.00  <== Gutschriften
      16          16.50       -13.50       -13.50           0.00         30.00  <== Gutschriften
      17           9.25         1.25         1.25           0.00          8.00  <== Gutschriften
      18         -12.75       -12.75       -12.75           0.00          0.00
      19           1.41         1.41         1.41           0.00          0.00
      20         -25.20       -25.20       -25.20           0.00          0.00
      21         -18.00       -18.00       -18.00           0.00          0.00
      22           0.00         0.00         0.00           0.00          0.00
      23           0.00         0.00         0.00           0.00          0.00
      24           0.00         0.00         0.00           0.00          0.00
      25         -28.80       -28.80       -28.80           0.00          0.00
      27           0.00         0.00         0.00           0.00          0.00
      29           0.00         0.00         0.00           0.00          0.00

Nutzer mit Zukunftsdiff ungleich 0,00 h (BL-01):        0
Nutzer mit Fehler beim Berechnen:                       0

ERGEBNIS: BL-01 GESCHLOSSEN — fuer jeden aktiven Nutzer ist die Zukunftsdiff 0,00 h.
```

**BL-01 ist in der Produktion geschlossen:** Ein Enddatum in der Zukunft verändert den Saldo
bei keinem einzigen Nutzer mehr. Kein Nutzer wirft beim Berechnen.

Die verbliebene `JournalDiff` bei drei Nutzern (3, 16, 17) ist **nicht** BL-01, sondern der
bereits bekannte, in `deferred-items.md` vermerkte Befund: Für einen Abwesenheitstag erzeugt
der Kontoauszug nur die Gutschriftszeile und überspringt die zugehörige negative Tageszeile.
Der Betrag entspricht exakt der Summe der Gutschriften im Zeitraum. **Dieser Befund war vor
diesem Lauf vorhanden und ist nicht Gegenstand dieses Auftrags.**

---

## 9. Rückwege — stehen bereit, wurden nicht gebraucht

| Zeitpunkt | Datei | SHA-256 | Größe |
|---|---|---|---:|
| vor allem (Rückfallpunkt) | `production.PRE-RELEASE_20260826_063302.db` | `c3d7becb…1943f` | 1 331 200 |
| vor Schritt 4 | `production.PRE-PURGE-ZUKUNFTSZEILEN_20260826_045127.db` | `220fa80c…b1e90` | 1 331 200 |
| vor Schritt 5 | `production.PRE-BACKFILL-ALLMONTHS_20260826_045220.db` | `8583e48e…52d49` | 1 318 912 |

Dazu die vom Deploy-Workflow selbst angelegte `production.predeploy_*.db`. Alle drei
eigenen Sicherungen wurden mit `VACUUM INTO` gezogen und **nach dem Ziehen geprüft**
(`integrity_check: ok`, `foreign_key_check` leer, Zeilenzahlen ausgewiesen) — nicht bloß
angelegt.

Zuständiger Rückweg im Bedarfsfall: `14-ROLLBACK-RUNBOOK.md`, **Abschnitt 3 — Rückweg A: nur
Daten**, da der Code fehlerfrei ausgeliefert wurde und ausschließlich Daten zu bewegen wären.
**Nicht in Anspruch genommen.**

---

## 10. Abschlussbild

| Prüfpunkt | Ergebnis |
|---|---|
| Actions-Lauf | `completed` / **`success`**, 6 m 15 s, Run 32931242550 |
| Produktionscode | `41c9c09` → **`eaf5f5c`** |
| Health-Check | `{"status":"ok"}` |
| PM2 | `timetracking-server` online, Neustartzähler 0 |
| Migrationsstand | 18 Einträge, höchste `015` — **keine neue Migration** |
| `integrity_check` / `foreign_key_check` | `ok` / leer |
| Zukunftszeilen | **0 Journalzeilen, 0 Monatszeilen** |
| Kanonischer Rechenweg | **15 von 15** deckungsgleich (vorher 10 von 15) |
| Monatszeilen gegen Journal | **112 von 141** (vorher 81 von 144) |
| BL-01 | **geschlossen** — Zukunftsdiff 0,00 h für jeden aktiven Nutzer |
| Fünf geschützte Tabellen | 718/43/4/40/59 — **Zeilenzahl und SHA-256 durchgehend identisch** |
| Urlaub | 40 Konten, 40 schlüssig, **kein Jahreswert bewegt** |
| Nachtlauf | **aktiv**, Sicherungsdatei steht |
| Angezeigter Saldo bewegt | 5 Nutzer, ausschließlich durch `fix-overtime.ts` beim Deployment |
| Rückweg gebraucht | **nein** |

### Ist der Stand für das Release tragfähig?

**Ja — mit einer Einschränkung, die vor dem Release zu schließen ist.**

Tragfähig, weil: Der Code läuft, das Deployment ist grün und verifiziert, keine Migration
steht aus, die Datenbank ist unversehrt. Die Datenlage ist nachweislich **besser** als vor dem
Lauf: alle 15 auswertbaren Nutzer stimmen jetzt mit dem kanonischen Rechenweg überein, 34
zuvor abweichende Monatszeilen sind geschlossen, keine einzige Zukunftszeile ist übrig, BL-01
ist geschlossen. Verloren gegangen ist nichts — mit Prüfsummen belegt, nicht behauptet. Kein
Nutzer wurde schlechter gestellt.

Einschränkung: **Ein erfolgreicher, angemeldeter Funktionstest gegen die Produktion steht
aus.** Health-Check, Anmeldeweg und Wächter sind belegt, der Kontoauszug wurde inhaltlich über
das projekteigene Werkzeug gegen ein exaktes Abbild der Produktion nachgewiesen — aber niemand
hat sich in dieser Sitzung tatsächlich an der Produktion angemeldet und einen Kontoauszug im
Programm gesehen. Dafür werden Zugangsdaten benötigt, die nicht vorlagen; ein Kennwort in der
Produktion zurückzusetzen wäre ein nicht beauftragter Eingriff gewesen.

**Empfehlung:** Vor dem Desktop-Release (Plan 14-11) eine Anmeldung mit echten Zugangsdaten
durchführen und für einen der fünf bewegten Nutzer (16 Benedikt Jochem, 18 Silvia Lachner,
20 Hans Schauer, 21 Maria Schauer, 25 Heidemarie Tretter) den Kontoauszug im Programm
ansehen. Die zu erwartenden Zahlen stehen oben in Abschnitt 8.3 (c) und sind damit vorab
prüfbar.

**Kein Release, kein Tag, kein `gh release` wurde erzeugt.** Plan 14-11 war ausdrücklich nicht
Gegenstand dieses Auftrags.

### Offene Punkte, unverändert übernommen

1. **Abweichung A-1** — die Kennzahl „49 von 86" ist nicht reproduzierbar; verwendet wurde die
   oben definierte, durchgehend gleich angewandte Kennzahl.
2. **Gutschriften-Gegenbuchung im Kontoauszug** (Nutzer 3, 16, 17) — bekannter Befund aus
   `deferred-items.md`, unverändert offen, wartet auf eine Entscheidung des Anwenders.
3. **29 Monatszeilen** stimmen weiterhin nicht mit dem Journal überein, davon betreffen
   4 der 11 Nutzer soft-gelöschte Testkonten, die der Backfill bewusst überspringt.
4. **Nebenbefund B-1** — der Deploy-Workflow schaltet den Nachtlauf bei jedem Deployment
   selbsttätig wieder an. Wer ihn künftig pausieren will, muss wissen, dass ein Deployment die
   Pause aufhebt.
5. **Nebenbefund B-2** — `find server -name "*.mjs" -delete` im Deploy-Workflow löscht die
   Mess-Werkzeuge `14-ist-stand-report.mjs` und `14-ist-stand-vergleich.mjs` bei jedem
   Deployment aus dem Server-Checkout.

---

## Belege

Alle Rohausgaben unter `14-auslieferung-belege/`:

| Datei | Inhalt |
|---|---|
| `schritt1-geschuetzte-tabellen.md` | Zeilen + SHA-256 der fünf Tabellen, vorher |
| `schritt1-zukunftszeilen-trockenlauf.txt` | Trockenlauf vor dem Deployment |
| `schritt1-aggregat-journal.txt` | Aggregat gegen Journal, je Monatszeile |
| `schritt1-saldo-je-nutzer.md` | Saldo-Doppelmessung je Nutzer |
| `schritt2-deploy-32931242550.txt` | vollständiges Deployment-Protokoll (849 Zeilen) |
| `schritt3-geschuetzte-tabellen.md`, `schritt3-aggregat-journal.txt` | Messung nach dem Deployment |
| `schritt3-feldvergleich.md` | maschineller Feldvergleich, alle 20 Abweichungen |
| `schritt3-vergleich-1-gegen-3.md` | Bewegung durch das Deployment |
| `schritt4-trockenlauf.txt`, `schritt4-schreiblauf.txt` | Bereinigung, beide Stufen |
| `schritt4-vergleich-3-gegen-zwischen.md` | Wirkung allein der Bereinigung |
| `schritt5-trockenlauf.txt`, `schritt5-schreiblauf.txt` | Backfill, beide Stufen |
| `schritt5-vergleich-zwischen-gegen-6.md` | Wirkung allein des Backfills |
| `schritt6-geschuetzte-tabellen.md`, `schritt6-aggregat-journal.txt` | Abschlussmessung |
| `schritt6-zukunftszeilen-nachkontrolle.txt` | Nachkontrolle: keine Zukunftszeilen |
| `schritt6-kanonisch.json`, `schritt6-kanonisch-vergleich.txt` | kanonischer Rechenweg vorher/nachher |
| `schritt6-vergleich-1-gegen-6.md`, `schritt6-vergleich-3-gegen-6.md` | Gesamtvergleiche |
| `schritt8-kontoauszug.txt` | Kontoauszugszahlen, BL-01-Nachweis |
| `messung.mjs` | die verwendete READONLY-Messabfrage |

Vollständige Ist-Stände im Phasenverzeichnis:
`14-AUSLIEFERUNG-VOR.json`/`.md`, `14-AUSLIEFERUNG-NACH-DEPLOY.json`/`.md`,
`14-AUSLIEFERUNG-ZWISCHEN-NACH-PURGE.json`/`.md`, `14-AUSLIEFERUNG-NACH.json`/`.md`.
