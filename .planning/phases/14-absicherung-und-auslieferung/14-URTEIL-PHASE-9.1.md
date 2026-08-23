# Urteil zu Phase 9.1 im Produktionsfenster der Phase 14

**Gefällt in:** Plan 14-07 (Welle 4, `autonomous: true`)
**Datum:** 2026-08-23
**Grundlage:** Quelltext im Stand des Arbeitsbaums (jede Zeilennummer unten am Quelltext
nachgeschlagen, nicht aus dem Planungstext übernommen — Zero-Hallucination-Policy,
`.claude/CLAUDE.md`)

---

## 1. Die Frage

Phase 9.1 („Journal-Backfill und Betriebs-Härtung") hat bis heute keine Pläne. Der
ROADMAP-Eintrag hält seit dem 22.08.2026 fest, dass sie „**gemeinsam mit dem Produktionslauf
der Phase 14** ausgeführt" wird — „ein Wartungsfenster, ein Backup, eine Verifikation".

Was dort **nicht** steht: ob damit die **ganze** Phase 9.1 gemeint ist oder nur ihr Datenanteil,
und an welcher Stelle innerhalb des Fensters der Datenlauf steht. Genau das ist zu entscheiden,
denn:

- Zwei Fenster bedeuten zwei Sicherungen, zwei Risikofenster und zwei Freigaben für denselben
  Datenbestand.
- Ein Datenlauf **während** der Verifikation der Phase 14 macht eine Überraschung im Ergebnis
  nicht mehr eindeutig einer Ursache zuzuordnen.

---

## 2. Was Phase 9.1 umfasst

Aus dem ROADMAP-Abschnitt `### Phase 9.1: Journal-Backfill und Betriebs-Härtung`
(`.planning/ROADMAP.md`, Abschnitt „Umfang"):

| Teil | Inhalt | Art |
|------|--------|-----|
| Backfill | `overtime_transactions`-Journal über Bestandsdaten neu aufbauen (alle Nutzer, alle vollständig durchlaufenen Monate) | **Datenlauf** auf Produktion |
| WR-05 | `server/scripts/fix-overtime.ts` ohne Fehlerisolierung je Nutzer; kein `db.close()` im Fehlerpfad | Codearbeit |
| WR-03 (Rest) | Kein `busy_timeout`-Pragma im Projekt | Codearbeit |
| WR-04 | `server/scripts/**` ist über `tsconfig.json` ausgeschlossen und damit ungetypt | Codearbeit |
| WR-02 (Rest) | Weitere Servicefunktionen ohne dedizierte Tests | Codearbeit |
| WR-07 | `overtimeLiveCalculationService.test.ts` hängt an einem Feiertags-Fixture in `development.db` | Codearbeit — **bereits erledigt** |

**Anmerkung zu WR-07:** Der ROADMAP-Eintrag der Phase 9.1 führt WR-07 noch als offen. Plan
14-02 hat ihn geschlossen; die Begründung steht in
`.planning/phases/14-absicherung-und-auslieferung/14-WR07-ENTSCHEIDUNG.md`. WR-07 ist damit
kein Gegenstand dieses Urteils mehr.

**Der Defekt, den der Backfill behebt** (ROADMAP, Abschnitt „Auslöser", wörtlich): Plan 09-05
hat den Monatsend-Off-by-one in `overtimeTransactionRebuildService.ts` und `overtimeService.ts`
behoben, aber der Codefix „repariert damit nur **künftige** Rebuilds. Die schon in der
Produktionsdatenbank gespeicherten `overtime_transactions`-Zeilen bleiben unvollständig — jeder
vollständig durchlaufene Monat endet dort am vorletzten Kalendertag".

---

## 3. Der Codebefund zur Verfälschungsfrage

Zur Entscheidung stand die Frage: **Kann der Backfill die Größe bewegen, über die die
Verifikation der Phase 14 urteilt?** Der Vorher/Nachher-Vergleich der Phase 14 ist nach D5
(`14-CONTEXT.md:56-60`) maschinell und läuft über `snapshotBalances.ts`.

### 3.1 Was der Backfill schreibt

`rebuildOvertimeTransactionsForMonth()` — `server/src/services/overtimeTransactionRebuildService.ts:78-239`

Das Werkzeug hat **keine eigene Schreiblogik**; jeder Monat läuft über diese eine Funktion.
Sie schreibt an **zwei** Stellen:

| # | Ort | Zeile | Was |
|---|-----|-------|-----|
| A | `overtime_transactions` | `:168-173` (`DELETE`, gefiltert auf `REBUILDABLE_TYPES` aus `:154-166`), danach Neuanlage über `overtimeTransactionManager` | Die derivierten Journalzeilen des Monats |
| B | **`overtime_balance`** | STEP 7, Aufruf `:233` → `updateOvertimeBalanceForMonth()` `:574-631`, `INSERT … ON CONFLICT DO UPDATE` `:610-615` | Das Monatsaggregat `targetHours`/`actualHours` |

`REBUILDABLE_TYPES` (`:154-166`) enthält `'model_change'` **nicht** — der Rebuild löscht keine
Modellwechsel-Buchung. Ebenso wenig `'compensation'`, `'correction'`, `'carry_over'`,
`'payout'`, `'initial_balance'`, `'year_end_balance'`.

### 3.2 Was die Messgrößen lesen

| Funktion | Datei : Zeile | Liest aus | Vom Backfill bewegt? |
|----------|---------------|-----------|----------------------|
| `UnifiedOvertimeService.calculateDailyOvertime()` | `unifiedOvertimeService.ts:120-155` | `user_work_periods` (über `getDailyTargetHours`), `holidays`, `time_entries` (`:373-383`), `absence_requests` (`:385-407`, `:421-436`), `overtime_corrections` (`:409-419`) | **Nein** |
| `UnifiedOvertimeService.calculatePeriodOvertime()` | `unifiedOvertimeService.ts:265-327` | ruft für jeden Tag des Zeitraums `calculateDailyOvertime()` auf (`:287`), aggregiert nur | **Nein** |
| `getOvertimeBalance()` | `overtimeTransactionService.ts:454-479` | `overtime_balance` (`SELECT SUM(actualHours - targetHours) … WHERE month <= ?`) | **Ja, mittelbar** (über 3.1 B) |
| `getOvertimeBalanceAtDate()` | `overtimeTransactionService.ts:549-562` | `overtime_transactions` (`SELECT SUM(hours) … WHERE date <= ? AND type <> 'model_change'`, Konstante `EXCLUDE_JOURNAL_ONLY_TYPES` `:49`) | **Ja, unmittelbar** (über 3.1 A) |

**Maschineller Gegenbeleg zur ersten Zeile:** `grep -n "overtime_transactions"
server/src/services/unifiedOvertimeService.ts` liefert **null Treffer**. Die einzigen
`FROM`-Klauseln der Datei sind `users`, `time_entries`, `absence_requests` (zweimal) und
`overtime_corrections`. Der Rechenweg, den D5 misst, kennt das Journal nicht.

### 3.3 Was der D5-Snapshot tatsächlich enthält

`server/src/scripts/snapshotBalances.ts` schreibt zwei Dateien (`:282` die Volldatei, `:286`
die Vergleichsdatei `*.users.json`). Je Nutzer enthält der Snapshot:

| Feld | Quelle | Datei : Zeile |
|------|--------|---------------|
| `masterData` | `users` | `:353-358` |
| `overtimePeriod` | `unifiedOvertimeService.calculatePeriodOvertime()` | `:378-382` |
| `overtimeBalanceRows` | **`overtime_balance`** | `:404-409` |
| `vacationYears` | `vacation_balance`, `vacation_transactions` | `:411-437` |

### 3.4 ⚠ ABWEICHUNG vom Kontextblock des Plans 14-07

Der Kontextblock `urteil_phase_9_1` in `14-07-PLAN.md` (Begründung 3 zu Teil 1) behauptet:

> „Der Backfill schreibt ausschließlich in `overtime_transactions` und kann die D5-Zahlen daher
> nicht bewegen."

**Dieser Satz ist am Quelltext widerlegt.** Der Plan schreibt für genau diesen Fall vor: „Weicht
ein Befund vom Kontextblock ab, gilt der Befund." Zwei Feststellungen:

1. `rebuildOvertimeTransactionsForMonth()` schreibt **auch** `overtime_balance`
   (`overtimeTransactionRebuildService.ts:233` → `:574-631`, siehe 3.1 B). Die Prämisse
   „ausschließlich `overtime_transactions`" trifft nicht zu.
2. `snapshotBalances.ts` liest **auch** `overtime_balance` (`:404-409`) und legt das Ergebnis
   als `overtimeBalanceRows` in die Vergleichsdatei `*.users.json` (siehe 3.3). Die Prämisse
   „Kein Lesezugriff auf `overtime_transactions`" ist zwar richtig — sie genügt aber nicht,
   weil sie die falsche Tabelle ausschließt.

**Folge:** Die vom Backfill bewegte Menge und die von D5 gemessene Menge **überschneiden sich**
im Aggregat `overtime_balance`. Der ursprünglich behauptete Beweis („kann die D5-Zahlen nicht
bewegen") entfällt.

**Was der Befund richtigstellt und was er stehen lässt:**

- Der Teil des Snapshots, der aus dem **Rechenweg** kommt (`overtimePeriod`), bleibt
  nachweislich unberührt — dieser Weg liest das Journal nicht (3.2, Zeile 1 und 2) und liest
  auch `overtime_balance` nicht.
- Der Teil, der das **gespeicherte Aggregat** wiedergibt (`overtimeBalanceRows`), kann sich
  bewegen — dann nämlich, wenn das gespeicherte Aggregat den Monatsend-Off-by-one noch trägt
  und der Rebuild es richtigstellt.
- Ob er sich auf dem konkreten Produktionsbestand tatsächlich bewegt, ist keine Frage der
  Auslegung, sondern eine Messung. Sie steht unten im Abschnitt „Probelauf des Backfills".

Diese Richtigstellung **stürzt Teil 1 des Urteils nicht**, aber sie verschiebt seine
Begründung und macht Teil 2 von einer Vorsichtsmaßnahme zu einer **zwingenden** Anordnung.

---

## 4. Das Urteil in drei Teilen

**Aufgeteilt: der Datenlauf kommt mit, die Codearbeit bleibt in Phase 9.1.**

### Teil 1 — Der Journal-Backfill läuft im Produktionsfenster der Phase 14 mit

1. **Dieselbe Infrastruktur, dasselbe Fenster.** Sicherung, Generalprobe auf der
   Produktionskopie, Vorher/Nachher-Vergleich und Freigabe sind für Phase 14 und für den
   9.1-Backfill identisch. Ein zweites Fenster bedeutete eine zweite Sicherung, ein zweites
   Risikofenster und eine zweite Freigabe für denselben Datenbestand.
2. **Der Backfill wird durch das Deployment der Phase 14 überhaupt erst möglich.** Der
   Monatsend-Off-by-one ist in `overtimeTransactionRebuildService.ts:104-106` behoben (Plan
   09-05: `month.split('-').map(Number)` statt `new Date(month + '-01')`), aber dieser Code
   liegt bis Plan 14-08 nicht auf dem Server. Ein Rebuild vor dem Deployment würde den Fehler
   reproduzieren statt ihn zu beheben — er liefe über denselben defekten Codepfad.
3. **Es gibt keinen Grund, ihn aus dem Fenster herauszuhalten** — wohl aber einen, ihn darin
   nach hinten zu stellen (Teil 2). Der ursprünglich hier stehende Grund „er kann die D5-Zahlen
   nicht bewegen" ist nach 3.4 hinfällig; er wird durch die Sequenzierung in Teil 2 ersetzt,
   nicht durch eine Vertagung.

### Teil 2 — Der Backfill läuft als ZWEITER, eigens freigegebener Schritt NACH der Verifikation der Phase 14

**Nach dem Befund aus 3.4 ist das keine Vorsichtsmaßnahme mehr, sondern die Bedingung dafür,
dass die Verifikation der Phase 14 überhaupt aussagekräftig bleibt.**

1. Der Backfill bewegt `overtime_transactions` — und `getOvertimeBalanceAtDate()`
   (`overtimeTransactionService.ts:549-562`) summiert genau diese Tabelle. Der Kontoauszug, den
   die Verifikation des realen Umstellungsfalls liest, listet genau diese Zeilen.
2. Der Backfill bewegt zusätzlich `overtime_balance` (3.1 B) — und das ist die Tabelle, aus der
   sowohl `getOvertimeBalance()` (`:454-479`) als auch der D5-Snapshot
   (`snapshotBalances.ts:404-409`) lesen.
3. Liefe er vor oder während der Verifikation, wäre jede Auffälligkeit in Kontoauszug oder
   Saldenvergleich nicht mehr eindeutig zuzuordnen: Modellwechsel oder Backfill. Genau die
   Vermischung, die D1 mit „jeder Schritt ist ein eigener Plan-Abschnitt mit eigenem Nachweis"
   verhindern soll.

**Reihenfolge im Fenster:** 14-08 (Deployment) → 14-09 (Migration + realer Umstellungsfall +
Verifikation) → **14-10 (Backfill, eigene Freigabe)** → 14-11 (Release).

### Teil 3 — Die Code-Härtung WR-02 bis WR-05 bleibt in Phase 9.1

Betroffen: Fehlerisolierung je Nutzer in `server/scripts/fix-overtime.ts` und der fehlende
`db.close()` im Fehlerpfad (WR-05), das fehlende `busy_timeout`-Pragma (WR-03), die
Untypisiertheit von `server/scripts/**` durch den Ausschluss in `tsconfig.json` (WR-04) und die
fehlenden Tests weiterer Servicefunktionen (WR-02).

Begründung: Das ist Codearbeit ohne Bezug zum Produktionsfenster. Sie in dieses Fenster zu
ziehen hieße, während eines laufenden Datenlaufs ein zweites Deployment einzuschieben. Die
Härtung wird nicht dringender dadurch, dass gerade ein Fenster offen ist.

---

## 5. Was daraus für die Planung folgt

- **Plan 14-07** (dieser Plan) baut das Werkzeug
  `server/src/scripts/backfillOvertimeJournal.ts` und probt es auf einer Produktionskopie.
- **Plan 14-10** fährt den Backfill gegen die echte Produktionsdatenbank — als zweiter,
  eigens freigegebener Schritt nach der Verifikation aus Plan 14-09.
- **Phase 9.1 bleibt offen** mit dem Restumfang WR-02, WR-03 (Rest), WR-04 und WR-05. Sie ist
  nach dem Produktionsfenster neu zuzuschneiden — der Backfill fällt dann aus ihrem Umfang
  heraus.
- **Der D5-Vergleich der Phase 14** (Plan 14-09) ist vor dem Backfill zu ziehen und
  auszuwerten. Ein nach dem Backfill gezogener Snapshot ist für D5 nicht mehr verwendbar.

> **⚠ Nachtrag nach dem Probelauf (Abschnitt 7).** Plan 14-10 ist **blockiert**. Der Backfill
> bewegt nachweislich den Saldo, den der Mitarbeiter sieht (8 von 20 Nutzern, bis zu 84
> Stunden), und der in 14-10 vorgesehene Teilaufbau ist der messbar schlechtere der beiden
> Wege. Die Entscheidung zwischen Teilaufbau, Vollaufbau (`--all-months`) und Verschieben
> liegt beim Anwender — Einzelheiten und Messwerte in Abschnitt 8.

---

## 6. Die eine Ausnahme, die Plan 14-08 übernimmt

Ein Punkt mit unmittelbarem Bezug zum Fenster wird **nicht** nach Phase 9.1 vertagt: die
Aufrufreihenfolge von `fix-overtime.ts` im Deploy-Workflow. Das Skript läuft dort **vor** dem
PM2-Start — also bevor `runMigrations()` die Tabelle `user_work_periods` angelegt hat — und
greift über `ensureOvertimeBalanceEntries` → `unifiedOvertimeService` → `getDailyTargetHours()`
genau auf diese Tabelle zu. Das ist kein 9.1-Restpunkt, sondern eine unmittelbare Folge dieses
Deployments und gehört deshalb in Plan 14-08.

---

## 7. Probelauf des Backfills (Plan 14-07)

Gefahren am 23.08.2026 gegen eine eigens gezogene Kopie der Produktionskopie.
`server/database/14-produktionskopie.db` und `server/database/14-generalprobe.db` blieben
unberührt (beide nur `readonly` geöffnet; Nachweis in Abschnitt 7.9).

### 7.0 Probekopie anlegen und migrieren

```
$ node -e "... new Database('./database/14-produktionskopie.db', { readonly: true })
               .exec(VACUUM INTO './database/14-backfill-probe.db') ..."
users: { c: 20 }
overtime_transactions: { c: 2671, s: -372.68 }
```

Beide Werte stimmen mit den Rohkennzahlen aus `14-MIGRATIONSSTAND.md` überein (2671 Zeilen,
Summe −372,68) — die Kopie trägt den Produktionsstand.

```
$ DATABASE_PATH=./database/14-backfill-probe.db npm run migrate:copy -- \
    --db=./database/14-backfill-probe.db --expect-migration=015_unique_reversal_of_index

Bereits angewendete Migrationen (18): … 014_add_reversal_of_to_overtime_transactions,
                                        015_unique_reversal_of_index
Neu angewendete Migrationen (0): (keine)
integrity_check: ok
foreign_key_check: (leer, keine Verstöße)
user_work_periods: 20 Zeilen
ERGEBNIS: integrity_check ok, foreign_key_check leer (Exit 0).
EXIT=0
```

**Gegenprobe, dass `--expect-migration` überhaupt greift** — sonst wäre „Exit 0" wertlos:

```
$ … --expect-migration=999_gibt_es_nicht
ERGEBNIS: erwartete Migration "999_gibt_es_nicht" steht nach dem Lauf nicht in der
          migrations-Tabelle (Exit 1).
EXIT=1
```

### 7.1 Snapshot VORHER

```
$ DATABASE_PATH=./database/14-backfill-probe.db npm run snapshot:balances -- \
    --all --asOf=2026-08-21 \
    --json=../.planning/phases/14-absicherung-und-auslieferung/14-SNAPSHOT-BF-VORHER.json
Zeilenzahl users (ungefiltert): 20; Länge users[] im Snapshot: 20 — stimmen überein.
ERGEBNIS: Snapshot erhoben (Exit 0).
```

### 7.2 Trockenlauf — und eine Korrektur der Findelogik

**Erster Trockenlauf, mit der in `<behavior>` des Plans vorgesehenen Regel** („letzter Tag mit
Sollstunden"): 9 betroffene Nutzer, 32 unvollständige Monate.

**Die Plausibilitäts-Gegenprobe des Plans hat diese Regel widerlegt.** Der ROADMAP-Eintrag der
Phase 9.1 nennt userId 3, 15, 17, 21, 22 und 29 als Beispiele. Gefunden wurden nur 3, 17 und
21. Statt das als „der Bestand hat sich seit Phase 9 geändert" abzutun, wurde jeder der drei
Ausreißer einzeln am Bestand geprüft:

| userId | Befund am Bestand | Bewertung |
|--------|-------------------|-----------|
| 15 | existiert, aber `deletedAt = '2026-02-28 14:01:48'` | **korrekt übersprungen** — soft-gelöschte Nutzer werden ausdrücklich gezählt und ausgelassen |
| 22 | `weeklyHours = 0` (Aushilfe), aber Zeiteintrag am **31.07.2026 über 3,0 h ohne Journalzeile** | **Fehler der Findelogik** |
| 29 | `weeklyHours = 0` (Aushilfe), aber Zeiteintrag am **31.07.2026 über 2,0 h ohne Journalzeile** | **Fehler der Findelogik** |

Beleg für 22 und 29 — Abfrage nach Zeiteinträgen ohne zugehörige Journalzeile:

```
userId 22: time_entries gesamt { c: 25, s: 47.5 } — Journalstunden gesamt { c: 119, s: 44.5 }
           ohne Journalzeile: [{"date":"2026-07-31","hours":3}]
userId 29: time_entries gesamt { c: 31, s: 85.78 } — Journalstunden gesamt { c: 205, s: 63.28 }
           ohne Journalzeile: [{"date":"2026-07-31","hours":2}]
```

Das ist genau der Off-by-one der Phase 9.1 — mit echten, bezahlten Stunden. Die Regel des
Plans übersieht ihn, weil eine Aushilfe mit `weeklyHours = 0` an **keinem** Tag Sollstunden hat
(`workingDays.ts:209-211`: bei `period.weeklyHours === 0` liefert `getDailyTargetHours()` 0)
und der „letzte Tag mit Sollstunden" damit `null` ist.

**Korrektur (Abweichung von `<behavior>`, hiermit dokumentiert):** Maßgeblich ist jetzt der
letzte Tag des Monats, an dem der Nutzer **Sollstunden ODER einen Zeiteintrag ODER eine
genehmigte Abwesenheit** hatte — `MonthCandidate.lastRelevantDay`.

Vor der Umstellung wurden alle drei denkbaren Regeln gegen die Produktionskopie gemessen:

| Regel | gefundene Monate | Bewertung |
|-------|------------------|-----------|
| A — letzter Tag mit Sollstunden (Plan) | 32 | übersieht 22 und 29 |
| **C — letzter relevanter Tag (umgesetzt)** | **40** | echte Obermenge von A (A ohne C = leer), findet 22 und 29 |
| B — letzter Kalendertag (Rebuild 1:1 gespiegelt) | 100 | 60 Monate ohne jede Wirkung, reine Nullzeilen |

**Zweiter Trockenlauf, mit Regel C:**

```
$ DATABASE_PATH=./database/14-backfill-probe.db npm run backfill:overtime-journal
Aufgelöster Datenbankpfad: …\server\database\14-backfill-probe.db
### TROCKENLAUF — es wird nichts geschrieben ###

=== Fundliste ===
userId=2 Karin Jochem: 4 unvollständige Monate — 2026-01, 2026-04, 2026-05, 2026-07
userId=3 Christine Glas: 3 unvollständige Monate — 2026-01, 2026-03, 2026-06
userId=16 Benedikt Jochem: 6 unvollständige Monate — 2026-01, 2026-03, 2026-04, 2026-05, 2026-06, 2026-07
userId=17 Carmen Rothemund: 5 unvollständige Monate — 2026-03, 2026-04, 2026-05, 2026-06, 2026-07
userId=18 Silvia Lachner: 3 unvollständige Monate — 2026-01, 2026-04, 2026-07
userId=19 Ute Stock: 5 unvollständige Monate — 2026-01, 2026-02, 2026-03, 2026-04, 2026-05
userId=20 Hans Schauer: 3 unvollständige Monate — 2026-04, 2026-06, 2026-07
userId=21 Maria Schauer: 3 unvollständige Monate — 2026-04, 2026-06, 2026-07
userId=22 Beate Walleiter: 1 unvollständige Monate — 2026-07
userId=24 Kathrin Leeb: 1 unvollständige Monate — 2026-05
userId=25 Heidemarie Tretter: 5 unvollständige Monate — 2026-03, 2026-04, 2026-05, 2026-06, 2026-07
userId=29 Christina Wasensteiner: 1 unvollständige Monate — 2026-07
Summe: 12 betroffene Nutzer, 40 unvollständige Monate. Übersprungene (soft-gelöschte) Nutzer: 5.

overtime_transactions vor dem Lauf: COUNT=2671, SUM(hours)=-372.68, model_change-Zeilen=0

Trockenlauf beendet. Mit --apply ausfuehren.
EXIT=0
```

**Plausibilitäts-Gegenprobe erfüllt:** 5 der 6 im ROADMAP genannten Beispiel-IDs (3, 17, 21,
22, 29) stehen in der Fundliste; die sechste (15) ist soft-gelöscht und damit regelkonform
übersprungen.

**Nachweis, dass der Trockenlauf nichts geschrieben hat** — unabhängig gemessen, nicht der
Selbstauskunft des Skripts entnommen:

| Kennzahl | vor dem Trockenlauf | nach dem Trockenlauf |
|----------|---------------------|----------------------|
| `COUNT(*) FROM overtime_transactions` | 2671 | 2671 |
| `ROUND(SUM(hours),6)` | −372,68 | −372,68 |
| `COUNT(*) FROM overtime_balance` | 144 | 144 |
| `SUM(targetHours)` / `SUM(actualHours)` | 6290,9 / 3435,19 | 6290,9 / 3435,19 |

### 7.3 Schreiblauf

```
$ DATABASE_PATH=./database/14-backfill-probe.db npm run backfill:overtime-journal -- --apply
…
40 von 40 Monaten verarbeitet — userId=29, Monat=2026-07

overtime_transactions nach dem Lauf: COUNT=2979, SUM(hours)=-446.01, model_change-Zeilen=0
Differenz: COUNT=308, SUM(hours)=-73.33
integrity_check: [{"integrity_check":"ok"}]
model_change-Zeilen unveraendert (0 vor, 0 nach dem Lauf).
### FERTIG ###
EXIT=0
```

Exit 0, `COUNT`-Differenz +308 (also größer als 0), `integrity_check` = `ok`.

**Die `model_change`-Prüfung ist auf dieser Kopie inhaltsleer** (0 vor, 0 nach — die
Generalprobe-Buchung liegt in `14-generalprobe.db`, nicht hier). Ein Kriterium, das 0 mit 0
vergleicht, belegt nichts. Deshalb zusätzlich auf einer **Kopie von `14-generalprobe.db`**
(`14-backfill-mc-probe.db`; das Original wurde nur `readonly` geöffnet):

```
vor dem Lauf: [{"id":33626,"userId":2,"date":"2026-06-01","hours":19.6,
                "description":"Stundenwechsel ab 01.06.2026: 5,0 → 3,0 h/Woche …"}]

$ … npm run backfill:overtime-journal -- --all-months --apply
100 von 100 Monaten verarbeitet
model_change-Zeilen unveraendert (1 vor, 1 nach dem Lauf).
EXIT=0

nach dem Lauf: [{"id":33626,"userId":2,"date":"2026-06-01","hours":19.6}]
```

Die Modellwechsel-Buchung hat einen Vollaufbau **ihres eigenen Monats** (2026-06) unverändert
überstanden — dieselbe `id`, dasselbe Datum, derselbe Betrag. **T-14-34 ist damit nicht nur
formal, sondern inhaltlich belegt.**

### 7.4 Snapshot NACHHER und der entscheidende Diff

```
$ DATABASE_PATH=./database/14-backfill-probe.db npm run snapshot:balances -- \
    --all --asOf=2026-08-21 --json=…/14-SNAPSHOT-BF-NACHHER.json
ERGEBNIS: Snapshot erhoben (Exit 0).

$ diff 14-SNAPSHOT-BF-VORHER.users.json 14-SNAPSHOT-BF-NACHHER.users.json
diff EXIT=1
Zeilen im Diff: 164
```

> ### ⚠ Der Diff ist NICHT leer. Die verbindliche Erwartung des Plans ist widerlegt.

Feldweise ausgewertet:

| Feld des Snapshots | Quelle | Unterschied? |
|--------------------|--------|--------------|
| `masterData` | `users` | nein, bei allen 20 Nutzern identisch |
| **`overtimePeriod`** | `unifiedOvertimeService.calculatePeriodOvertime()` | **nein, bei allen 20 Nutzern byte-identisch** |
| `overtimeError` | — | nein |
| **`overtimeBalanceRows`** | **`overtime_balance`** | **ja, bei 8 von 20 Nutzern** (2, 3, 16, 17, 18, 19, 20, 25) |
| `vacationYears` | `vacation_balance`, `vacation_transactions` | nein |

Das ist **genau** der in Abschnitt 3.4 am Quelltext vorhergesagte Befund, jetzt maschinell
bestätigt: Der Rechenweg bleibt unberührt, das gespeicherte Aggregat nicht.

### 7.5 Gegenprobe: hat der Backfill überhaupt gewirkt?

`getOvertimeBalanceAtDate()` vor und nach dem Schreiblauf:

| userId | Datum | vorher | nachher | Differenz |
|--------|-------|--------|---------|-----------|
| 22 | 2026-07-31 | 44,50 | **47,50** | **+3,00** — exakt der fehlende Zeiteintrag |
| 29 | 2026-07-31 | 63,28 | **65,28** | **+2,00** — exakt der fehlende Zeiteintrag |
| 17 | 2026-07-31 | 5,65 | −0,01 | −5,66 |
| 3 | 2026-06-30 | 4,25 | 5,10 | +0,85 |
| 21 | 2026-07-31 | −59,50 | −60,00 | −0,50 |

Die Gegenprobe ist erfüllt — und bei 22 und 29 stimmt die Differenz **auf die Stunde** mit den
in 7.2 gefundenen fehlenden Zeiteinträgen überein. Der Backfill wirkt, und er wirkt an der
Stelle, an der er wirken soll.

### 7.6 Der eigentliche Befund: der Teilaufbau hinterlässt einen gemischten Saldo

Weil der Diff nicht leer war, wurde nachgemessen, **in welche Richtung** sich das Aggregat
bewegt. Bezugsgröße ist der kanonische Rechenweg (`overtimePeriod.overtime`), der sich
nachweislich nicht bewegt hat.

| userId | kanonisch | Aggregat vorher | Aggregat nachher | Abweichung vorher | Abweichung nachher | Richtung |
|--------|-----------|-----------------|------------------|-------------------|--------------------|----------|
| 2 | 10,00 | 6,00 | 2,00 | 4,00 | 8,00 | **schlechter** |
| 3 | 4,77 | −26,43 | −21,63 | 31,20 | 26,40 | besser |
| 16 | 20,00 | 104,00 | 20,00 | 84,00 | **0,00** | besser |
| 17 | −1,26 | −2,06 | 1,94 | 0,80 | 3,20 | **schlechter** |
| 18 | 11,50 | −4,50 | −32,50 | 16,00 | 44,00 | **schlechter** |

Bilanz: 2 Nutzer näher am kanonischen Wert, **3 Nutzer weiter weg**, 10 unverändert.

**Ursache — nachgemessen, nicht vermutet:** Ein Teilaufbau mischt zwei Rechenstände im
Aggregat. Die neu aufgebauten Monate folgen dem heutigen Code, die übrigen dem Stand, in dem
sie zuletzt geschrieben wurden. Gegenprobe mit einem **Vollaufbau aller 100 vergangenen
Monate** auf einer frischen Kopie (`14-backfill-vollprobe.db`):

| userId | kanonisch | Aggregat vorher | Aggregat nach Vollaufbau | Ergebnis |
|--------|-----------|-----------------|--------------------------|----------|
| 2 | 10,00 | 6,00 | **10,00** | deckungsgleich |
| 3 | 4,77 | −26,43 | 2,37 | Rest 2,40 |
| 16 | 20,00 | 104,00 | **20,00** | deckungsgleich |
| 17 | −1,26 | −2,06 | 9,14 | Rest 10,40 |
| 18 | 11,50 | −4,50 | **11,50** | deckungsgleich |
| 19 | 12,41 | 10,41 | **12,41** | deckungsgleich |
| 24 | 201,50 | 249,50 | **201,50** | deckungsgleich |
| 29 | 65,28 | 85,78 | **65,28** | deckungsgleich |

**Nach dem Vollaufbau stimmt das Aggregat bei 13 von 15 aktiven Nutzern EXAKT mit dem
kanonischen Rechenweg überein** (vorher: 7 von 15). Kein Nutzer steht danach schlechter als
vorher. Auch hier bleibt `overtimePeriod` bei allen 20 Nutzern byte-identisch.

Die verbleibenden zwei (userId 3 und 17) sind das in `.claude/CLAUDE.md` beschriebene
Dual-Calculation-Problem: `updateOvertimeBalanceForMonth()`
(`overtimeTransactionRebuildService.ts:574-631`) und
`unifiedOvertimeService.calculateDailyOvertime()` (`:120-155`) behandeln `overtime_comp` und
`unpaid` unterschiedlich. Das ist ein eigener Defekt und **nicht** Gegenstand dieses Plans.

Deshalb hat das Werkzeug den ausdrücklichen Schalter `--all-months` bekommen (Vorgabe: aus).
Welcher der beiden Wege in Produktion gefahren wird, ist eine Entscheidung des Anwenders und
gehört nach D2 in Plan 14-10 — sie wird hier **nicht** vorweggenommen.

### 7.7 Kettenprüfung

```
$ DATABASE_PATH=./database/14-backfill-probe.db npm run check:period-chains
✅ Keine Befunde — jeder nicht gelöschte Nutzer hat eine lückenlose
   Periodenkette ab seinem Eintrittsdatum.
EXIT=0
```

### 7.8 Die vier Gates

| Gate | Befehl | Ergebnis |
|------|--------|----------|
| 1 | `cd server && npx tsc --noEmit` | Exit 0 |
| 2 | `cd desktop && npx tsc --noEmit` | Exit 0 |
| 3 | `cd desktop && npm run check:rules` | Exit 0, „19 Tests bestanden." |
| 4 | `cd server && npx vitest run` | `3 failed, 527 passed (530)` |

Die drei roten sind unverändert die drei vorbestehenden — namentlich bestätigt, nicht nur
gezählt:

```
FAIL src/services/unifiedOvertimeService.test.ts > … > should respect hire date and not
     include pre-employment months                                        (:285)
FAIL src/services/unifiedOvertimeService.test.ts > … > REGRESSION: User hired on 1st of
     month should calculate correctly                                     (:340)
FAIL src/services/vacationBackfillService.test.ts > … > erkennt einen bereits gelaufenen
     Backfill                                                             (:138)
```

Die Menge ist nicht gewachsen. Die 20 neuen Tests aus `backfillOvertimeJournal.test.ts` sind
sämtlich grün.

### 7.9 Unversehrtheit der geschützten Datenbanken

| Datei | Zustand |
|-------|---------|
| `server/database/14-produktionskopie.db` | unberührt — nur `readonly` geöffnet, als Quelle von `VACUUM INTO` |
| `server/database/14-generalprobe.db` | unberührt — nur `readonly` geöffnet; nach allen Läufen weiterhin 2682 Zeilen und 1 `model_change`-Zeile |
| `server/database/development.db` | nicht angefasst — `DATABASE_PATH` war in **jedem** Aufruf explizit gesetzt |
| Produktionsdatenbank auf `129.159.8.19` | **nicht berührt** — kein Aufruf mit `--allow-production`, keine SSH-Verbindung, kein `git push` |

Neu angelegte Wegwerfkopien, alle über `.gitignore` ausgeschlossen:
`14-backfill-probe.db`, `14-backfill-vollprobe.db`, `14-backfill-mc-probe.db`.

---

## 8. Folgen für Plan 14-10 — offene Entscheidung des Anwenders

Der Probelauf hat getan, wofür er da ist: Er hat **vor** dem Produktionszugriff zwei Dinge
zutage gefördert, die der Plan so nicht vorgesehen hatte.

1. **Der Backfill bewegt den Saldo, den der Mitarbeiter sieht.** `getOvertimeBalance()`
   (`overtimeTransactionService.ts:454-479`) liest `overtime_balance`, und der Backfill
   schreibt diese Tabelle mit. Auf der Produktionskopie bewegt sich der Saldo bei 8 von 20
   Nutzern, im Einzelfall um bis zu 84 Stunden. Das ist keine unsichtbare Journalpflege,
   sondern eine sichtbare Änderung an Mitarbeiterdaten — sie braucht eine eigene, ausdrückliche
   Freigabe.
2. **Der Teilaufbau ist nicht die bessere Variante.** Er verschlechtert die Übereinstimmung mit
   dem kanonischen Rechenweg bei 3 von 15 Nutzern; der Vollaufbau bei keinem — und stellt sie
   bei 13 von 15 exakt her.

**Plan 14-10 ist damit blockiert, bis der Anwender entscheidet:**

| Variante | Aufruf | auf der Produktionskopie gemessene Wirkung |
|----------|--------|--------------------------------------------|
| **(a) Teilaufbau** — wie in 14-10 vorgesehen | ohne `--all-months` | 40 Monate, +308 Journalzeilen; 2 Nutzer besser, 3 schlechter |
| **(b) Vollaufbau** — Empfehlung nach Messlage | `--all-months` | 100 Monate, +995 Journalzeilen; 13 von 15 Nutzern deckungsgleich mit dem kanonischen Weg, keiner schlechter |
| **(c) Verschieben** | — | Journal bleibt unvollständig, der Off-by-one bleibt im Bestand |

Unberührt von dieser Entscheidung bleibt die Reihenfolge aus Teil 2 des Urteils: Der Backfill
läuft in **jedem** Fall erst **nach** der Verifikation aus Plan 14-09, weil er genau die
Größen bewegt, über die diese Verifikation urteilt.
