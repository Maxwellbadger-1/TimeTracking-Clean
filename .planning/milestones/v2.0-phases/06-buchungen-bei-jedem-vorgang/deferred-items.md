# Deferred Items — Phase 06 (Gap Closure, Plan 06-06)

Gefunden während der Ausführung von `06-06-PLAN.md` beim Prüfen auf neue Testfehlschläge
(`cd server && npx vitest run`). Alle drei Punkte liegen außerhalb des Dateiumfangs dieses Plans
(`files_modified`: `vacationBalanceService.ts`, `absenceService.ts`, `yearEndRolloverService.ts`,
`vacationCarryoverCalculation.test.ts`, `VacationBalanceEditModal.tsx`) und werden hier nur
dokumentiert, nicht behoben (Scope Boundary).

## 1. `overtime_transactions` fehlen die Spalten `balanceBefore`/`balanceAfter`

**Betrifft:** `balanceTracking.test.ts` (7 Tests), `overtimeTransactionCentralization.test.ts`
(3 Tests) — beide rot mit `SqliteError: no such column: balanceAfter`.

**Root Cause (verifiziert):** `server/src/database/schema.ts` definiert `balanceBefore`/
`balanceAfter` nur in der `CREATE TABLE`-Anweisung für `vacation_transactions` (Zeile 249-250),
NICHT für `overtime_transactions` (Zeile 415-434 — keine dieser beiden Spalten). Trotzdem liest
`getBalanceBeforeDate()` in `server/src/services/overtimeTransactionService.ts:43-45` per
`SELECT balanceAfter FROM overtime_transactions ...`.

**Nicht durch diesen Plan verursacht:** `git diff 130ffbf2..HEAD --stat` zeigt ausschließlich
`vacationBalanceService.ts`, `absenceService.ts`, `yearEndRolloverService.ts` als geänderte
Dateien — `schema.ts` und `overtimeTransactionService.ts` sind seit dem Basis-Commit dieses Plans
unverändert. Der Fehler existierte identisch bereits vor Ausführung von 06-06.

## 2. `workingDays.test.ts` — Feiertage für 2026 werden nicht gefunden (7 Tests rot)

**Betrifft:** 7 Tests in `Working Days Utilities > Month-Long Scenarios` /
`Edge Cases: workSchedule + Holidays`, alle mit demselben Muster: Erwartungswert geht von einem
Feiertag aus (z. B. "Heilige Drei Könige" 06.01.2026 reduziert das Soll), tatsächlicher Wert
entspricht der vollen, ungekürzten Stundenzahl — als gäbe es in der lokalen `holidays`-Tabelle
für 2026 keinen Eintrag.

**Nicht durch diesen Plan verursacht:** `workingDays.ts`/`workingDays.test.ts` sind nicht Teil von
`files_modified` dieses Plans und laut `git diff 130ffbf2..HEAD --stat` unverändert.

## 3. Nichtdeterminismus bei parallelem Testlauf (`SqliteError: database is locked`)

**Beobachtung:** `npx vitest run` (Standard-Parallelmodus, kein `pool`/`fileParallelism` in
`server/vitest.config.ts` konfiguriert) erzeugt bei mehreren aufeinanderfolgenden Läufen
unterschiedliche zusätzliche Fehlschläge (`database is locked` in
`vacationEntitlementBooking.test.ts`, `vacationTransactionService.test.ts`) — verschwindet
vollständig mit `npx vitest run --no-file-parallelism`. Alle Testdateien schreiben gegen dieselbe
SQLite-Datei (`server/database/development.db`); parallele Worker-Prozesse konkurrieren um
Schreibsperren. Kein Code-Fehler, reine Testinfrastruktur-Eigenschaft — für den
Regressions-Vergleich dieses Plans wurde deshalb `--no-file-parallelism` verwendet.

## Referenzwert für diesen Plan (06-06)

Sequentiell (`npx vitest run --no-file-parallelism`) VOR den Änderungen dieses Plans (Basis-Commit
`130ffbf2`) und NACH Task 1+2 dieses Plans: identische 18 Fehlschläge in denselben vier Dateien
(`balanceTracking.test.ts`, `overtimeTransactionCentralization.test.ts`,
`unifiedOvertimeService.test.ts`, `workingDays.test.ts`) — keiner davon in einer von 06-06
geänderten Datei. Die vom Koordinator dokumentierten "3 bekannten Fehlschläge" (2×
`unifiedOvertimeService.test.ts`, 1× `vacationBackfillService.test.ts`) sind in dieser Menge
teilweise enthalten (die zwei `unifiedOvertimeService`-Fälle), `vacationBackfillService.test.ts`
lief in beiden hier durchgeführten Läufen grün (zustandsabhängig, siehe Koordinator-Notiz).
Die zusätzlichen 15 Fehlschläge (`balanceTracking.test.ts`, `overtimeTransactionCentralization.test.ts`,
5 der 7 `workingDays.test.ts`-Fälle) scheinen zum Zeitpunkt der ursprünglichen Koordinator-Messung
noch nicht aufgetreten zu sein (vermutlich Datenumgebung/Datum-Drift seit 2026-08-19) — sie sind
aber nachweislich nicht durch 06-06 verursacht.

---

## Testzahlen aus Worktrees sind nicht vergleichbar (gefunden 2026-08-21, Welle 2)

`*.db` steht in der `.gitignore` (Zeile 27). Ein per `isolation: "worktree"` erzeugter
Worktree startet deshalb **ohne** `server/database/development.db`. Die Tests legen dort
beim ersten Lauf eine neue, praktisch leere Datenbank an — 368 KB gegenüber 1,28 MB im
Hauptbaum, der eine Kopie der Produktionsdaten enthält.

Folge: Executor-Agenten in Worktrees melden reproduzierbar **18 Fehlschläge**, wo der
Hauptbaum **3** zeigt. Die Differenz stammt aus fehlendem Schema (`overtime_transactions.
balanceAfter`) und fehlenden Feiertagsdaten für 2026 — beides Dinge, die in der
Arbeitsdatenbank vorhanden sind, in einer frisch angelegten aber nicht.

**Was daraus folgt:**
- Absolute Testzahlen aus einem Worktree taugen nicht als Gate. Der A/B-Vergleich gegen den
  Basis-Commit *innerhalb* desselben Worktrees bleibt gültig — nur der Vergleich mit
  Messungen des Orchestrators nicht.
- Das maßgebliche Regressionsgate ist der Lauf im Hauptbaum nach dem Merge.
- Zwei Executor-Agenten haben in dieser Phase je ~20 Minuten darauf verwendet, die 18
  Fehlschläge zu untersuchen und gegen den Basis-Commit zu verifizieren. Das ist vermeidbare
  Arbeit, wenn der Auftrag die Erwartung vorab klarstellt.

Die saubere Lösung ist dieselbe wie beim übergeordneten Punkt: eine eigene, pro Lauf frisch
migrierte Testdatenbank (`NODE_ENV=test`), statt der Arbeitsdatenbank. Dann sind Haupt- und
Worktree-Läufe identisch und die Frage stellt sich nicht mehr.

---

## Vier arbeitende Mitarbeiter ohne Urlaubsanspruch (gefunden 2026-08-21, Sichtprüfung Welle 2)

Beim Prüfen der Urlaubskonto-Verwaltung fielen acht Konten für 2026 ohne jede Journalbuchung
auf. **Kein Phase-6-Mangel:** Alle acht haben `users.vacationDaysPerYear = 0`, ihr
Kontostand von 0 ist korrekt abgeleitet, und es gibt schlicht keine Bewegung zu buchen.

Vier von ihnen erfassen jedoch aktiv Arbeitszeit:

| Mitarbeiter | id | Eintritt | Wochenstunden | Zeiteinträge | vacationDaysPerYear |
|---|---|---|---|---|---|
| Hans Schauer | 20 | 2026-04-01 | 7 | 27 (Apr–Jul) | 0 |
| Maria Schauer | 21 | 2026-04-01 | 5 | 21 (Apr–Jul) | 0 |
| Beate Walleiter | 22 | 2026-01-01 | 0 | 25 (Mär–Jul) | 0 |
| Christina Wasensteiner | 29 | 2026-01-01 | 0 | 31 (Jan–Jul) | 0 |

Sie bauen damit keinen Urlaubsanspruch auf. Das kann gewollt sein (geringfügige
Beschäftigung, Urlaub anders geregelt) oder beim Anlegen übersehen worden sein. Bei
Walleiter und Wasensteiner stehen zusätzlich 0 Wochenstunden trotz erfasster Zeiten, was
eher für unvollständige Stammdaten spricht — mit Folgen auch für die Überstundenberechnung,
die `weeklyHours` als Soll heranzieht.

**Keine Codeänderung geplant.** Das ist eine Stammdatenfrage für die Stiftung, keine
Fehlfunktion. Vermerkt, damit der Befund nicht verlorengeht.
