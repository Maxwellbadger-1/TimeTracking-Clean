# Angleichungs-Nachweis: REQ-17/REQ-18 nach Plan 09-03

**Erstellt:** 2026-08-21 (Plan 09-03, Task 5)
**Zweck:** Nachweis statt Behauptung (D3, `09-CONTEXT.md`): Vorher/Nachher-Vergleich der fünf
Berechnungswege für dieselben drei Prüfnutzer (D4, `09-PRUEFNUTZER.csv`) gegen dieselbe lokale
Datenbank `server/database/development.db`, mit denen Plan 09-02 den Erstbefund erhoben hat
(`09-VERGLEICH-BEFUND.md`), nach den Änderungen aus Task 1-4 dieses Plans (Live-Service auf
`getDailyTargetHours()` gezogen, fünf Vorfilter in `overtimeService.ts` entfernt,
`fix-overtime.ts` auf den kanonischen Weg gezogen).

---

## Vorher/Nachher

Werkzeuglauf: `cd server && npm run validate:overtime:paths -- --from=../.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv --json=../.planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-BASELINE.json`,
gegen `server/database/development.db` (kein `DATABASE_PATH`-Override — dieselbe Datenbank wie
der Erstbefund in `09-02`).

### Nutzer A — Karin Jochem, `userId 2`, Prüfmonat 2026-07

| Weg | vorher (`09-VERGLEICH-BEFUND.md`) | nachher | Delta |
|---|---|---|---|
| `unified` | -6.50 | -6.50 | 0.00 |
| `dashboard` | -6.50 | -6.50 | 0.00 |
| `report_summary` | -6.50 | -6.50 | 0.00 |
| `report_daily` | -6.50 | -6.50 | 0.00 |
| `balance_row` | -6.50 | -6.50 | 0.00 |

### Nutzer B — Benedikt Jochem, `userId 16`, Prüfmonat 2026-07

| Weg | vorher | nachher | Delta |
|---|---|---|---|
| `unified` | -29.75 | -29.75 | 0.00 |
| `dashboard` | -29.75 | -29.75 | 0.00 |
| `report_summary` | -29.75 | -29.75 | 0.00 |
| `report_daily` | -29.75 | -29.75 | 0.00 |
| `balance_row` | -29.75 | -29.75 | 0.00 |

### Nutzer C — Carmen Rothemund, `userId 17`, Prüfmonat 2026-04

| Weg | vorher | nachher | Delta |
|---|---|---|---|
| `unified` | -3.83 | -3.83 | 0.00 |
| `dashboard` | -3.83 | -3.8299999999999983 | ~0.00 (Gleitkomma, < TOLERANCE_HOURS) |
| `report_summary` | -3.83 | -3.8299999999999983 | ~0.00 (Gleitkomma, < TOLERANCE_HOURS) |
| `report_daily` | -3.83 | -3.83 | 0.00 |
| `balance_row` | -3.83 | -3.8299999999999983 | ~0.00 (Gleitkomma, < TOLERANCE_HOURS) |

**Einordnung:** Für alle drei Prüfnutzer sind vorher und nachher identisch (bis auf die bereits
im Erstbefund bekannte IEEE-754-Gleitkommaabweichung von `1.7763568394002505e-15` bei Nutzer C,
weit unterhalb `TOLERANCE_HOURS = 0.01`). Das ist erwartungsgemäß: Diese drei Prüfnutzer hatten
schon vor Plan 09-03 keine Abweichung zwischen den fünf Wegen (`09-VERGLEICH-BEFUND.md`,
Abschnitt „Ausgangswert für 09-03"), weil `fix-overtime.ts` (der einzige damals bekannte
Bypass, A-1) nur die Produktionsdatenbank beschreibt, nicht `development.db`. Die Wirkung von
Task 1-4 zeigt sich deshalb nicht in einer Änderung dieser drei Prüfnutzer, sondern darin, dass
A-1 jetzt separat und gezielt mit einer eigenen Vorher/Nachher-Messung belegt ist
(`09-A1-NACHWEIS.md`) und dass ein vierter, hier nicht geprüfter Fall — ein Nutzer mit
`workSchedule.saturday > 0` im Live-Service und im Legacy-Pfad — jetzt korrekt behandelt wird
(Regressionsnetz: `overtimeLiveCalculationService.test.ts`, sechs Testfälle).

---

## Exit-Codes

| Lauf | Exit-Code |
|---|---|
| Erstlauf (Plan 09-02, Task 3, vor jeder Codeänderung) | 0 |
| Dieser Lauf (Plan 09-03, Task 5, nach Task 1-4) | 0 |

Beide Läufe sind grün. Das war für die drei lokalen Prüfnutzer bereits vor Plan 09-03 der Fall
(siehe Abschnitt „Vorher/Nachher" oben) — der Exit-Code allein ist deshalb kein Beleg dafür,
dass Plan 09-03 etwas verändert hat. Der eigentliche Wirkungsbeleg dieses Plans liegt in
`09-A1-NACHWEIS.md` (gemessene Deltas gegen eine Kopie, die den Bypass tatsächlich reproduziert)
und im Regressionstest für den Samstag-Fall (`overtimeLiveCalculationService.test.ts`).

---

## Belegkette REQ-18 (D1)

Jedes Glied mit wörtlichem Codezitat, gelesen und verifiziert (Zero-Hallucination-Policy):

1. **`GET /api/overtime/:userId`** — `server/src/routes/overtime.ts:642`: `'/:userId',`
   (Routendefinition beginnt `router.get(` in Zeile 641, Pfad-String in Zeile 642).
2. → **`getOvertimeSummary()`** — `server/src/services/overtimeService.ts:580`:
   `export async function getOvertimeSummary(userId: number, year: number):
   Promise<OvertimeSummary> {` (im Plan-Interfaces-Abschnitt zum Zeitpunkt der Planerstellung
   als `overtimeService.ts:595` benannt; Task 2 hat die Datei durch die Entfernung der fünf
   Vorfilter um 15 Zeilen an dieser Stelle nach oben verschoben — die Funktion selbst ist
   inhaltlich unverändert).
3. → **`overtime_balance`** wird gelesen (`overtimeService.ts:614-620`: `SELECT month,
   targetHours, actualHours, overtime FROM overtime_balance WHERE userId = ? AND month LIKE ?
   ...`) — geschrieben von:
4. **`updateMonthlyOvertime()`** — `server/src/services/overtimeService.ts:406`:
   `export function updateMonthlyOvertime(userId: number, month: string): void {` (Plan-Stand:
   `overtimeService.ts:421`, wie bei Punkt 2 um 15 Zeilen verschoben durch Task 2).
5. → **`unifiedOvertimeService.calculateMonthlyOvertime()`** —
   `server/src/services/overtimeService.ts:439`: `const monthlyResult =
   unifiedOvertimeService.calculateMonthlyOvertime(userId, month);` (Plan-Stand:
   `overtimeService.ts:454`, ebenfalls um 15 Zeilen verschoben).
6. → **`getDailyTargetHours()`** — `server/src/services/unifiedOvertimeService.ts:115`:
   `const rawTargetHours = getDailyTargetHours(user, date);` (unverändert, diese Datei wurde in
   Plan 09-03 nicht bearbeitet).
7. → **`workingDays.ts:63`** — `server/src/utils/workingDays.ts:63`:
   `export function getDailyTargetHours(user: UserPublic, date: Date | string): number {` — die
   kanonische Stelle, unverändert.

**D1 ausdrücklich bestätigt:** `overtimeService.ts` existiert weiterhin, schreibt weiterhin
`overtime_balance` (Belegkette Punkt 3-5 oben) und hat unverändert 16 Exporte
(`grep -c "^export \(async \)\?function" server/src/services/overtimeService.ts` → 16, sowohl
vor als auch nach Task 2, siehe `09-03`-Commit `2826f68`). Kein Aufrufer wurde umgehängt, keine
Route geändert, kein Export entfernt — Angleichen statt Stilllegen, wie von D1 verlangt.

---

## Regressionsnetz

| Zeitpunkt | Testdateien | Tests gesamt | bestanden | fehlgeschlagen |
|---|---|---|---|---|
| Vor jeder Codeänderung (Task 1, Ausgangswert) | 14 | 201 | 198 | 3 |
| Nach Task 1-4 (dieser Lauf) | 15 | 207 | 204 | 3 |

**Kein Rückgang:** 204 ≥ 198 bestandene Tests. Die drei fehlschlagenden Tests sind in beiden
Läufen identisch (`unifiedOvertimeService.test.ts` → zwei Regressionstests zu Hire-Date/User
6&7-Bug, `vacationBackfillService.test.ts` → ein Test zu einem bereits gelaufenen Backfill) —
bekannt und laut `server/vitest.config.ts`-Kommentar bereits vor Plan 09-03 zurückgestellt,
unabhängig vom Gegenstand dieses Plans. Die sechs zusätzlichen bestandenen Tests stammen aus
`overtimeLiveCalculationService.test.ts` (Task 1, RED-Commit `348b70f`, GREEN-Commit `9a984b6`)
— dem neuen Regressionsnetz gegen den Rückfall in eine eigene Arbeitstags-Entscheidung.

---

## Restabweichungen

**Keine Restabweichung im Sinne von REQ-17/18.** Der Exit-Code des Vergleichswerkzeugs bleibt
bei 0 (siehe Abschnitt „Exit-Codes"). Die einzige in `09-INVENTAR-SOLLSTUNDEN.md` festgehaltene
Abweichung (A-1, `fix-overtime.ts`) ist in Task 3/4 gemessen behoben (`09-A1-NACHWEIS.md`,
Abschnitt „Nachher": Delta 0,00 für alle drei Prüfnutzer).

**Bekannter, nicht in diesem Plan behandelter Befund (kein REQ-17/18-Fall, siehe unten):** Alle
drei Prüfnutzer zeigen weiterhin einen `TRANSACTION MISMATCH` zwischen `CALCULATED OVERTIME`
und der Summe aus `overtime_transactions` (`npm run validate:overtime:detailed`):

| userId | Monat | Differenz |
|---|---|---|
| 2 | 2026-07 | -5,00h |
| 16 | 2026-07 | -1,25h |
| 17 | 2026-04 | +0,59h |

Bei allen drei Nutzern stimmt `CALCULATED` exakt mit `DATABASE` überein (`🎯 TARGET HOURS` und
`⏱️ ACTUAL HOURS` beide `✅ MATCH`) — die Abweichung betrifft ausschließlich die
Vollständigkeit des `overtime_transactions`-Journals, nicht die Sollstunden-Auflösung. Das
deckt sich unverändert mit dem in `09-01-SUMMARY.md` und `09-VERGLEICH-BEFUND.md` festgehaltenen
REQ-19-Kernbefund. **Ursache nicht offen** — sie ist bereits dem REQ-19-Kernbefund zugeordnet
und fällt in Plan 09-04, nicht in Plan 09-03 (Objective dieses Plans: „REQ-17 verlangt genau
einen Weg zur Sollstundenermittlung, REQ-18 übereinstimmende Werte in Dashboard und
Berichten" — beides ist erfüllt; das Transaktions-Journal ist ein separater Gegenstand).
