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

---

## 6. Die eine Ausnahme, die Plan 14-08 übernimmt

Ein Punkt mit unmittelbarem Bezug zum Fenster wird **nicht** nach Phase 9.1 vertagt: die
Aufrufreihenfolge von `fix-overtime.ts` im Deploy-Workflow. Das Skript läuft dort **vor** dem
PM2-Start — also bevor `runMigrations()` die Tabelle `user_work_periods` angelegt hat — und
greift über `ensureOvertimeBalanceEntries` → `unifiedOvertimeService` → `getDailyTargetHours()`
genau auf diese Tabelle zu. Das ist kein 9.1-Restpunkt, sondern eine unmittelbare Folge dieses
Deployments und gehört deshalb in Plan 14-08.
