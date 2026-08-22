# Teilbeleg Plan 11-05 — unifiedOvertimeService.ts, overtimeTransactionRebuildService.ts

**Erstellt:** 2026-08-22 (Plan 11-05, Task 2)
**Zweck:** Teilbeleg für Plan 11-09 (sequenzielle Zusammenführung aller Teilbelege in
`11-AUFRUFER-CHECKLISTE.md`). Enthält ausschließlich die beiden Zeilen, für die Plan 11-05
zuständig ist. `11-AUFRUFER-CHECKLISTE.md` selbst wird von diesem Plan NICHT angefasst
(Parallelität der Welle 3, s. `11-05-PLAN.md` Task 2 Begründung).

Spalten wie in der Haupttabelle: `Fundstelle` (datei:zeile), `Funktion/Kontext`,
`Produktivpfad` (ja/nein, mit Beleg), `Zuständiger Plan`, `Disposition`, `✓`.

---

## `server/src/services/unifiedOvertimeService.ts` — der vorgesehene gemeinsame Weg

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/unifiedOvertimeService.ts:130` (Zeilendrift von `:115` in `11-AUFRUFER-CHECKLISTE.md` durch neu eingefügte JSDoc-Kommentare in diesem Plan) | `calculateDailyOvertime(userId, date, periods = directWorkPeriodLookup)`, Aufruf `getDailyTargetHours(user, date, periods)` | ja (Beleg: `calculateMonthlyOvertime()` ← `updateMonthlyOvertime()` (`overtimeService.ts:454`) ← `routes/overtime.ts` (`GET /api/overtime/balance/:userId/:month`); zusätzlich ← `ensureOvertimeBalanceEntries()` ← `GET /api/overtime/:userId`) | 11-05 | **Erledigt.** Perioden-Kontext wird durchgereicht: `calculateDailyOvertime` erhält `periods: WorkPeriodContext = directWorkPeriodLookup` (Vorgabewert nur für Routen-Aufrufer ohne eigenen Berechnungslauf, D2-konform kein Modul-Cache); `calculateMonthlyOvertime`/`calculatePeriodOvertime` bauen `periods: WorkPeriodContext = createWorkPeriodContext()` einmal je Lauf und reichen ihn an jeden Tag der Schleife durch (D1, Zähler-Nachweis-Test: `getWorkPeriods` genau 1x je Monatslauf statt 1x je Tag). Datei bleibt reiner Lesepfad (grep-verifiziert: 0 INSERT/UPDATE/DELETE/`.run(`). Commits: `b196529` (test), `c09fda0` (feat). | ✓ |

**Wörtliche grep-Ausgabe** (`grep -n "getDailyTargetHours(" server/src/services/unifiedOvertimeService.ts`):
```
101:   * - Target Hours = getDailyTargetHours(user, date), reduced to 0 for unpaid leave
130:    const rawTargetHours = getDailyTargetHours(user, date, periods);
```
(Zeile 101 ist ein JSDoc-Kommentar, keine Aufrufstelle — Formelbeschreibung im Docblock von `calculateDailyOvertime`, unverändert seit vor diesem Plan.)

---

## `server/src/services/overtimeTransactionRebuildService.ts`

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/overtimeTransactionRebuildService.ts:276` (Zeilendrift von `:263` in `11-AUFRUFER-CHECKLISTE.md` durch neu eingefügte Importe/Kommentare in diesem Plan) | `collectDailyCalculations()`, Aufruf `getDailyTargetHours(user, dateStr, periods)` | ja (Beleg: `rebuildOvertimeTransactionsForMonth()` ← `updateMonthlyOvertime()` (`overtimeService.ts:493`) ← `routes/overtime.ts`; zusätzlich ← `updateAllOvertimeLevels()`, aufgerufen bei jedem Zeiteintrag) | 11-05 | **Erledigt.** `collectDailyCalculations()` bekommt `periods: WorkPeriodContext` als Pflichtparameter (kein Vorgabewert — die Funktion ist intern, nicht von Routen direkt aufgerufen). `rebuildOvertimeTransactionsForMonth()` erzeugt den Kontext mit `createWorkPeriodContext()` genau einmal vor der Tagesschleife (grep-verifiziert: genau ein Treffer für `createWorkPeriodContext` in der Datei, Namensraum-Import verhindert einen zweiten Treffer in der Importzeile). `handleAbsenceDay()` geprüft (nicht angenommen): ruft `getDailyTargetHours` nicht selbst auf, rechnet ausschließlich mit dem bereits aufgelösten `day.targetHours` — unverändert. `user: any` auf `UserPublic` gezogen (`getUserById()` liefert bereits `UserPublic`). REQ-24-Idempotenztest (zwei Rebuild-Läufe, maschineller Vergleich über sortiertes JSON von `overtime_transactions` + `overtime_balance`) grün. D1-Zähler-Nachweis (`getWorkPeriods` genau 1x je Rebuild-Lauf) grün. Commits: `b2c2524` (test), `5ad1169` (feat). | ✓ |

**Wörtliche grep-Ausgabe** (`grep -n "getDailyTargetHours(" server/src/services/overtimeTransactionRebuildService.ts`):
```
276:    const targetHours = getDailyTargetHours(user, dateStr, periods);
```

---

## Zusatzbeleg: `createWorkPeriodContext`-Aufrufstelle (Acceptance Criteria Task 2)

**Wörtliche grep-Ausgabe** (`grep -n "createWorkPeriodContext" server/src/services/overtimeTransactionRebuildService.ts`):
```
165:    const periods: WorkPeriodContext = workPeriodContextModule.createWorkPeriodContext();
```
Genau ein Treffer, steht in `rebuildOvertimeTransactionsForMonth` vor der Tagesschleife (STEP 4b, vor STEP 5 „Collect daily calculations").

---

## Status

Beide Fundstellen dieses Plans sind abgehakt. `11-AUFRUFER-CHECKLISTE.md` wurde durch diesen
Plan nicht verändert (`git diff --name-only` bestätigt keine Änderung an dieser Datei) — das
Abhaken der Haupttabelle erfolgt sequenziell in Plan 11-09 durch Zusammenführung aller
Teilbelege (`11-AUFRUFER-TEIL-05.md` bis `11-AUFRUFER-TEIL-08.md` und 11-11).
