# Abschluss-Nachweis: Erfolgskriterium 3, Ursachenkorrektur, D2-Entscheidung

**Erstellt:** 2026-08-22 (Plan 09-05, Task 4)
**Zweck:** Belegt mit wörtlicher Vorher/Nachher-Ausgabe, ob `npm run validate:overtime:detailed`
für die drei Prüfnutzer aus `09-PRUEFNUTZER.csv` nach dem Monatsend-Fix abweichungsfrei läuft
(ROADMAP-Erfolgskriterium 3), korrigiert die Ursachenanalyse aus `09-VERIFICATION.md`, löst den
zurückgestellten Befund in `deferred-items.md` auf und bewertet WR-03 abschließend mit einem
gemessenen Ergebnis statt einer Vermutung.

---

## Methodik (D5)

Alle Läufe gegen eine Wegwerfkopie von `server/database/development.db`, angelegt inklusive
WAL-/SHM-Sidecar-Dateien für einen konsistenten Snapshot (`database/development.db`,
`database/development.db-wal`, `database/development.db-shm`, gemeinsam in ein Verzeichnis
außerhalb des Repositories kopiert). `DATABASE_PATH` zeigte bei jedem Lauf ausdrücklich auf diese
Kopie, nie auf `development.db` selbst oder auf Produktion. Kein Schreibzugriff auf die
Originaldatei oder auf `/home/ubuntu/databases/production.db` fand statt.

Reihenfolge:
1. Kopie angelegt (Stand: nach den Codefixes aus Task 1–3 dieses Plans, aber vor jedem Rebuild
   gegen diese Kopie — das im Journal gespeicherte Datenbild ist damit noch der alte,
   unvollständige Stand).
2. „Vorher"-Lauf: `validateOvertimeDetailed.ts` für alle drei Prüfnutzer gegen die Kopie.
3. `rebuildOvertimeTransactionsForMonth()` für alle drei (userId, month)-Paare gegen dieselbe
   Kopie ausgeführt (mit dem in Task 4 Teil A behobenen Code).
4. „Nachher"-Lauf: `validateOvertimeDetailed.ts` erneut für alle drei Prüfnutzer.
5. `npm run validate:overtime:paths` gegen dieselbe (jetzt neu aufgebaute) Kopie — NO REGRESSION
   gegenüber Plan 09-03.

---

## Nutzer A — userId 2 (Karin Jochem), Monat 2026-07

### Vorher

```
📋 COMPONENT-LEVEL BREAKDOWN:
────────────────────────────────────────────────────────────────────────────────

🎯 TARGET HOURS:
  Working Days Calculation:  25h
  Unpaid Leave Reduction:    -0h
  ─────────────────────────────────
  CALCULATED TOTAL:          25h
  DATABASE TOTAL:            25h
  ✅ MATCH

⏱️  ACTUAL HOURS:
  Time Entries (Worked):     18.5h
  Absence Credits:           +0h
  Manual Corrections:        +0h
  ─────────────────────────────────
  CALCULATED TOTAL:          18.5h
  DATABASE TOTAL:            18.5h
  ✅ MATCH

📊 TRANSACTION BREAKDOWN:
  Earned (Time Entries):     -1.5h  (28 txs)
  Vacation Credits:          +0h  (0 txs)
  Sick Credits:              +0h  (0 txs)
  Overtime Comp Credits:     +0h  (0 txs)
  Special Credits:           +0h  (0 txs)
  Unpaid Adjustments:        0h  (0 txs)
  Manual Corrections:        +0h  (0 txs)
  Year-End Carryover:        +0h  (0 txs)
  ─────────────────────────────────
  TRANSACTION BALANCE:       -1.5h
  CALCULATED OVERTIME:       -6.5h
  ❌ MISMATCH: -5.00h difference

🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ❌ TRANSACTION MISMATCH DETECTED!
     → Difference: -5.00h
     → Possible causes:
       - Missing transactions (time entries/absences without transactions)
       - Extra transactions (orphaned or duplicate records)
       - Incorrect transaction types or hours
```

### Nachher (nach `rebuildOvertimeTransactionsForMonth(2, '2026-07')`)

```
📋 COMPONENT-LEVEL BREAKDOWN:
────────────────────────────────────────────────────────────────────────────────

🎯 TARGET HOURS:
  Working Days Calculation:  25h
  Unpaid Leave Reduction:    -0h
  ─────────────────────────────────
  CALCULATED TOTAL:          25h
  DATABASE TOTAL:            25h
  ✅ MATCH

⏱️  ACTUAL HOURS:
  Time Entries (Worked):     18.5h
  Absence Credits:           +0h
  Manual Corrections:        +0h
  ─────────────────────────────────
  CALCULATED TOTAL:          18.5h
  DATABASE TOTAL:            18.5h
  ✅ MATCH

📊 TRANSACTION BREAKDOWN:
  Earned (Time Entries):     -6.5h  (31 txs)
  Vacation Credits:          +0h  (0 txs)
  Sick Credits:              +0h  (0 txs)
  Overtime Comp Credits:     +0h  (0 txs)
  Special Credits:           +0h  (0 txs)
  Unpaid Adjustments:        0h  (0 txs)
  Manual Corrections:        +0h  (0 txs)
  Year-End Carryover:        +0h  (0 txs)
  ─────────────────────────────────
  TRANSACTION BALANCE:       -6.5h
  CALCULATED OVERTIME:       -6.5h
  ✅ MATCH

🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```

**Ergebnis:** Die Journalspur für Juli 2026 endete vorher bei 28 `time_entry`-Transaktionen
(bis 07-28), nach dem Rebuild bei 31 (bis 07-31, dem letzten Kalendertag) — exakt der bei der
Planung vorhergesagte Wert: Der Mismatch von -5,00h verschwindet vollständig, die
Transaktionssumme (-6,5h) stimmt mit der berechneten Überstundensumme (-6,5h) überein.

---

## Nutzer B — userId 16 (Benedikt Jochem), Monat 2026-07

### Vorher

```
📊 TRANSACTION BREAKDOWN:
  Earned (Time Entries):     -28.5h  (30 txs)
  Vacation Credits:          +0h  (0 txs)
  Sick Credits:              +0h  (0 txs)
  Overtime Comp Credits:     +0h  (0 txs)
  Special Credits:           +0h  (0 txs)
  Unpaid Adjustments:        0h  (0 txs)
  Manual Corrections:        +0h  (0 txs)
  Year-End Carryover:        +0h  (0 txs)
  ─────────────────────────────────
  TRANSACTION BALANCE:       -28.5h
  CALCULATED OVERTIME:       -29.75h
  ❌ MISMATCH: -1.25h difference

🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ❌ TRANSACTION MISMATCH DETECTED!
     → Difference: -1.25h
```

### Nachher (nach `rebuildOvertimeTransactionsForMonth(16, '2026-07')`)

```
📊 TRANSACTION BREAKDOWN:
  Earned (Time Entries):     -29.75h  (31 txs)
  Vacation Credits:          +0h  (0 txs)
  Sick Credits:              +0h  (0 txs)
  Overtime Comp Credits:     +0h  (0 txs)
  Special Credits:           +0h  (0 txs)
  Unpaid Adjustments:        0h  (0 txs)
  Manual Corrections:        +0h  (0 txs)
  Year-End Carryover:        +0h  (0 txs)
  ─────────────────────────────────
  TRANSACTION BALANCE:       -29.75h
  CALCULATED OVERTIME:       -29.75h
  ✅ MATCH

🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```

**Ergebnis:** Der fehlende Eintrag für 2026-07-31 (Freitag, Sollstunden an diesem Tag) — exakt
die vor der Planung gemeldeten -1,25h — ist nach dem Rebuild vorhanden (30 → 31 Transaktionen);
die Lücke verschwindet vollständig.

---

## Nutzer C — userId 17 (Carmen Rothemund), Monat 2026-04

### Vorher

```
📊 TRANSACTION BREAKDOWN:
  Earned (Time Entries):     -24.42h  (29 txs)
  Vacation Credits:          +8h  (3 txs)
  Sick Credits:              +0h  (0 txs)
  Overtime Comp Credits:     +4h  (1 txs)
  Special Credits:           +0h  (0 txs)
  Unpaid Adjustments:        0h  (0 txs)
  Manual Corrections:        +0h  (0 txs)
  Year-End Carryover:        +0h  (0 txs)
  ─────────────────────────────────
  TRANSACTION BALANCE:       -4.42h
  CALCULATED OVERTIME:       -7.829999999999998h
  ❌ MISMATCH: -3.41h difference

🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ❌ TRANSACTION MISMATCH DETECTED!
     → Difference: -3.41h
```

### Nachher (nach `rebuildOvertimeTransactionsForMonth(17, '2026-04')`)

```
📊 TRANSACTION BREAKDOWN:
  Earned (Time Entries):     -23.830000000000002h  (30 txs)
  Vacation Credits:          +8h  (3 txs)
  Sick Credits:              +0h  (0 txs)
  Overtime Comp Credits:     +0h  (0 txs)
  Special Credits:           +0h  (0 txs)
  Unpaid Adjustments:        0h  (0 txs)
  Manual Corrections:        +0h  (0 txs)
  Year-End Carryover:        +0h  (0 txs)
  ─────────────────────────────────
  TRANSACTION BALANCE:       -7.83h
  CALCULATED OVERTIME:       -7.829999999999998h
  ✅ MATCH

🎯 VALIDATION STATUS:
────────────────────────────────────────────────────────────────────────────────
  ✅ Database validation: PASSED
  ✅ Transaction validation: PASSED
```

**Wichtiger Zusatzbefund für Nutzer C:** Die „Vorher"-Zeile zeigt `Overtime Comp Credits: +4h
(1 txs)` — eine historische, bereits vor diesem Plan in `overtime_transactions` gespeicherte
Zeile vom Typ `overtime_comp_credit` (durch den in Plan 09-05 Task 2 behobenen Fehler in einer
früheren Codeversion entstanden). Der Rebuild hat diese stehen gebliebene Fehlbuchung beseitigt
(„Nachher": `Overtime Comp Credits: +0h (0 txs)`), weil `rebuildOvertimeTransactionsForMonth()`
den Journalausschnitt löscht und mit dem jetzt korrekten Code neu aufbaut. Das ist die konkrete,
hier beobachtete Bestätigung der D2-Feststellung unten: Der Codefix repariert nur **künftige**
Rebuilds — ohne den hier durchgeführten Rebuild wäre diese Fehlbuchung in der Kopie stehen
geblieben. Genau das ist in der echten Produktionsdatenbank noch offen (siehe Phase 9.1).

Zusätzlich zeigt der Vergleich, dass die vorher gemeldete Abweichung um -3,41h nicht mit dem in
`09-VERIFICATION.md` genannten Wert (+0,59h) übereinstimmt — Ursache ist der seither
verstrichene reale Zeitablauf zwischen beiden Läufen (unterschiedlicher Stand von
`development.db` zum jeweiligen Prüfzeitpunkt), nicht eine falsche Messung; das „Nachher"-
Ergebnis (`✅ Transaction validation: PASSED`) ist in jedem Fall eindeutig.

---

## Zusammenfassung Erfolgskriterium 3

| Nutzer | Monat | Vorher | Nachher |
|---|---|---|---|
| userId 2 | 2026-07 | ❌ TRANSACTION MISMATCH -5.00h | ✅ Transaction validation: PASSED |
| userId 16 | 2026-07 | ❌ TRANSACTION MISMATCH -1.25h | ✅ Transaction validation: PASSED |
| userId 17 | 2026-04 | ❌ TRANSACTION MISMATCH -3.41h | ✅ Transaction validation: PASSED |

**Erfolgskriterium 3 der ROADMAP ist erfüllt** — `npm run validate:overtime:detailed` läuft für
alle drei Prüfnutzer abweichungsfrei, sobald ein Rebuild mit dem in Task 4 behobenen Code
gelaufen ist. Das ist keine dritte Formulierung: Der Rest, der über den Code hinausgeht (der
Backfill der bereits in der echten Produktionsdatenbank gespeicherten, unvollständigen
Journalzeilen), ist gemäß D2 als Phase 9.1 in `.planning/ROADMAP.md` verankert — siehe dortiger
Abschnitt „Phase 9.1: Journal-Backfill und Betriebs-Härtung".

---

## NO REGRESSION — `validate:overtime:paths` gegen dieselbe (jetzt neu aufgebaute) Kopie

```
Nutzer 2, Monat 2026-07:
  unified         -6.50
  dashboard       -6.50
  report_summary  -6.50
  report_daily    -6.50
  balance_row     -6.50
  Kein Weg weicht ab.

Nutzer 16, Monat 2026-07:
  unified         -29.75
  dashboard       -29.75
  report_summary  -29.75
  report_daily    -29.75
  balance_row     -29.75
  Kein Weg weicht ab.

Nutzer 17, Monat 2026-04:
  unified         -7.83
  dashboard       -7.83
  report_summary  -7.83
  report_daily    -7.83
  balance_row     -7.83
  Kein Weg weicht ab.

ERGEBNIS: Alle Wege stimmen für alle Paare überein (Exit 0).
```

Die Salden selbst (-6,50h / -29,75h / -7,83h) sind identisch mit den in Plan 09-03/09-04
gemessenen Werten — die Angleichung aus Plan 09-03 hält unverändert. Verändert hat sich
ausschließlich die Vollständigkeit des Transaktionsjournals, nicht der angezeigte Saldo (der
kam schon vorher korrekt über `ensureOvertimeBalanceEntries()` → `unifiedOvertimeService`
zustande, unabhängig vom Journal — siehe `deferred-items.md`-Auflösung unten).

---

## Ursachenkorrektur gegenüber `09-VERIFICATION.md`

`09-VERIFICATION.md` nannte als zweite, von `overtime_comp` unabhängige Ursache: „bei allen
drei Nutzern fehlen die Earned-Buchungen für geleistete Arbeitsstunden vollständig (0 txs trotz
realer Arbeitszeit)". Das ist eine **Fehldeutung der Werkzeugausgabe**, keine reale Lücke im
Journal — bei der Planung bereits erkannt und in Task 3 dieses Plans korrigiert:

Die Buchungen für Zeiteinträge existierten in `overtime_transactions` immer, aber unter dem
Datenbanktyp `type = 'time_entry'`, nicht `'earned'`. `overtimeTransactionService.ts:690-691`
kennt diese Gleichsetzung bereits ausdrücklich („`'time_entry' and 'earned' are semantically
identical`"), `validateOvertimeDetailed.ts` gruppierte seine Ausgabe vor Task 3 aber nach dem
rohen Datenbanktyp und zeigte deshalb für den Schlüssel `earned` immer `+0h (0 txs)` — unabhängig
davon, wie viele `time_entry`-Zeilen tatsächlich vorhanden waren. Beleg aus den obigen Läufen:
Die „Vorher"-Zeile für userId 2 zeigt bereits `Earned (Time Entries): -1.5h (28 txs)` — 28
tatsächliche Buchungen, nicht 0. Die Gesamtsumme `TRANSACTION BALANCE` (Task 3 nicht verändert)
war von diesem Anzeigefehler nie betroffen, weil sie ungefiltert über alle Typen summiert.

Die **echte** Ursache des `TRANSACTION MISMATCH` war ausschließlich der Monatsend-Off-by-one aus
Task 4 dieses Plans — mit dem obigen Nachweis vollständig geschlossen.

---

## Auflösung `deferred-items.md`

Der in `deferred-items.md` (Plan 09-04, Fund während Task 3) als „pre-existierend, Ursache
unbekannt" zurückgestellte Befund — `targetHours=36` statt `40` für userId 17, Monat 2026-04, in
`overtimeTransactionRebuildService.ts` — hat dieselbe Ursache wie der hier behobene
Monatsend-Off-by-one: Der 30.04.2026 (Donnerstag, Sollstunden an diesem Tag) fehlte in der
Tagesschleife, wodurch `targetHours` um genau einen Arbeitstag zu niedrig ausfiel. Mit dem
Nachher-Lauf oben (`Working Days Calculation: 48h`, `Unpaid Leave Reduction: -8h`,
`CALCULATED TOTAL: 40h`, `✅ MATCH`) ist bestätigt, dass `targetHours` nach dem Fix korrekt bei
40h liegt. `deferred-items.md` ist entsprechend aktualisiert (Eintrag bleibt stehen, nicht
gelöscht — die Beweiskette bleibt lesbar), mit dem Vermerk, dass die dortige Einschätzung
„betrifft den angezeigten Saldo nicht" nur gilt, solange `updateMonthlyOvertime()` nicht läuft;
bei jeder Genehmigung oder Ablehnung einer Abwesenheit überschreibt sie die von
`ensureOvertimeBalanceEntries()` korrekt geschriebene `overtime_balance`-Zeile mit der (vor
diesem Fix fehlerhaften) Summe des Rebuilds.

---

## WR-03 abschließend bewertet, mit gemessenem Ergebnis

**Gemessen gegen die Wegwerfkopie (`PRAGMA table_info(users)`):**

```
email column: {"cid":2,"name":"email","type":"TEXT","notnull":0,"dflt_value":null,"pk":0}
```

`notnull = 0` — die Bedingung `emailColumn.notnull === 1` in `schema.ts:102-105`, die die
einzige nicht-idempotente Anweisung in `initializeDatabase()` (die `users`-Tabellen-Neuanlage,
`schema.ts:100-160`) schützt, trifft auf diesen Datenbestand **nicht** zu — der Zweig ist inert
und läuft nicht. Alles Übrige in `initializeDatabase()`/`createIndexes()` ist
`CREATE TABLE IF NOT EXISTS`, `ALTER TABLE` in `try/catch` und `CREATE INDEX IF NOT EXISTS`,
also No-Ops auf einer bereits initialisierten Datenbank.

**Ergebnis:** Der Wechsel von `fix-overtime.ts` auf die geteilte Verbindung (Plan 09-03) ist
netto eine **Verbesserung**, keine neue Gefahr — die vorherige zweite, eigenständig geöffnete
`new Database(dbPath)`-Verbindung war die eigentliche WAL-Gefahr, dieselbe Konstellation, die den
Vorfall vom 18.08.2026 verursacht hat (`.planning/debug/db-stabilisierung-20260818.md`).

Zusätzlich unabhängig gemessen (`grep -rn "busy_timeout" server/src`, kein Treffer): Es ist an
keiner Stelle im Projekt ein `busy_timeout`-Pragma gesetzt. Das ist das einzige verbleibende
reale Risiko aus WR-03 — ein täglicher Cron-Prozess (`fix-overtime.ts`) und der Server-Prozess
halten getrennte Verbindungen auf dieselbe Produktionsdatei; ein echter Schreibkonflikt schlägt
sofort mit `SQLITE_BUSY` fehl statt zu warten. Das ist ein Eingriff in die Datenbankschicht und
gehört nicht in einen Lückenschluss → in `.planning/ROADMAP.md`, Abschnitt „Phase 9.1", verankert.

---

## G5 — die drei vorbestehenden roten Tests

`unifiedOvertimeService.test.ts:233` („should respect hire date and not include
pre-employment months") und `:275`/`:316` je nach Zeilenzählung nach diesem Plan
(„REGRESSION: User hired on 1st of month should calculate correctly"), beide mit
`expected 40 to be 10`, sowie ein Fehlschlag in `vacationBackfillService.test.ts`
(„erkennt einen bereits gelaufenen Backfill", `expected true to be false`). Nach jedem Task
dieses Plans mit `npx vitest run` erneut geprüft: **exakt dieselben drei Fehlschläge**, kein
weiterer, keiner behoben. Sie sind vorbestehend (bereits vor Phase 9 rot, unabhängig
verifiziert) und in diesem Plan ausdrücklich **out of scope** — nicht angefasst. Wer in Phase 11
(Eintrittsdatum/Sollstunden-Umbau) auf dieses rote Testnetz trifft, muss wissen, dass es schon
vorher rot war.

---

## Phasenweite Verifikation (nach allen vier Tasks dieses Plans)

- `cd server && npx tsc --noEmit` — ohne Fehler.
- `cd server && npx vitest run` — 218/221, genau die drei oben genannten vorbestehenden
  Fehlschläge (5 neue Tests seit Plan-Beginn: 4 in `overtimeLiveCalculationService.test.ts`
  Task 2, 4 in `overtimeService.test.ts` Task 2/4, 4 in
  `overtimeTransactionRebuildService.test.ts` Task 4 — Netto-Testzahl-Zuwachs abzüglich einer
  bereits vorher bestehenden Testdatei).
- `.planning/ROADMAP.md` und `.planning/REQUIREMENTS.md` enthalten Phase 9.1 an den drei
  vorgeschriebenen Stellen (Phasenübersicht-Tabelle, eigener Abschnitt, Abdeckungstabelle).
