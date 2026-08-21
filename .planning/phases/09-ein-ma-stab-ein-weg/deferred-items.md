# Deferred Items — Phase 9

Funde außerhalb des Aufgabenbereichs der jeweiligen Task, während der Ausführung entdeckt,
nicht behoben (SCOPE BOUNDARY, execute-plan.md).

---

## 09-05, Task 3: `validateOvertimeCalculation.ts` — weitere, von REQ-19 unabhängige
Defekte, gefunden bei der funktionalen Verifikation des Kreditfilter-Fixes

**Gefunden während:** Task 3, funktionaler Testlauf von `npm run validate:overtime -- --userId=`
und `--scenario=all` gegen eine Wegwerfkopie von `development.db`, um den Kreditfilter-Fix
(`'overtime_comp'` raus, `'special'` ergänzt) end-to-end zu bestätigen.

**Behoben (Rule 3, blockierten den eigenen Testlauf):**
- `SELECT ... departmentId FROM users` — Spalte existiert nicht (`schema.ts:42`: `department
  TEXT`). Verhinderte jeden Aufruf mit `--userId=`, unabhängig von REQ-19. Auf `department`
  korrigiert.
- `formatOvertimeHours()`: `sign = hours >= 0 ? '+' : ''` gab für negative Stunden keine
  Zeichenkette zurück — jeder negative Saldo erschien ohne Minuszeichen. Auf `'-'` korrigiert.
- `generateTestData.ts:642`: `if (require.main === module)` ist CommonJS und warf bei jedem
  Import einen `ReferenceError`, machte `validateOvertimeCalculation.ts` vollständig unbenutzbar.
  ESM-Äquivalent eingesetzt.

**Gefunden, NICHT behoben (außerhalb des REQ-19-Scopes, SCOPE BOUNDARY):**
- `SELECT ... daysRequired FROM absence_requests` (`validateOvertimeCalculation.ts`, mehrere
  Stellen) — die tatsächliche Spalte heißt `days` (`schema.ts:192`). Ein Aufruf mit `--userId=`
  gegen einen Nutzer mit mindestens einer Abwesenheit schlägt deshalb weiterhin mit
  `SqliteError: no such column: daysRequired` fehl. Betrifft nur diesen einen, separaten
  Aufrufpfad (`--all`/`--userId=` mit Abwesenheiten); `--scenario=` ist nicht betroffen, da
  Testszenarien ihre eigenen, korrekt benannten Objekte verwenden.
- `SELECT ... deletedAt FROM time_entries` bzw. `absence_requests` (`validateOvertimeCalculation.
  ts`) — beide Tabellen kennen keine `deletedAt`-Spalte (`schema.ts:166-202`, kein Soft-Delete
  für diese beiden Tabellen). Betrifft denselben `--userId=`-Pfad.
- Zwei der zehn Testszenarien aus `generateTestData.ts` schlagen bei `--scenario=all`
  fehl, unabhängig von `overtime_comp`: `unpaid-leave` (Target/Actual-Abweichung) und
  `holiday-heavy-month` (Target/Actual/Overtime-Abweichung). Keines der beiden Szenarien
  enthält eine `overtime_comp`-Abwesenheit; beide sind von den Änderungen dieses Plans nicht
  berührt (vor und nach dem Plan identisch rot, verifiziert durch Vergleich der betroffenen
  Codepfade). Ursache nicht weiter untersucht — vermutlich veraltete Erwartungswerte gegenüber
  der heutigen `calculateTargetHoursForPeriod()`/Feiertagslogik, analog zum in Task 3 bereits
  korrigierten `overtime-compensation`-Szenario, aber unabhängig von REQ-19.

**Nicht behoben, weil:** Keine dieser vier Fundstellen hat einen Bezug zur
Abwesenheits-Kreditierungsregel (REQ-19) — sie sind vorbestehende Schema-/Testdaten-Drift in
einem Werkzeug, das schon vor diesem Plan über weite Strecken nicht lauffähig war
(`generateTestData.ts`s ESM-Bug allein hätte jeden Aufruf verhindert). Eine vollständige
Reparatur wäre eigenständige Arbeit ohne Bezug zum Lückenschluss dieses Plans.

**Empfehlung:** Eigener kleiner Plan „`validateOvertimeCalculation.ts` instand setzen" —
Spaltennamen durchgehend gegen `schema.ts` abgleichen, die beiden Szenario-Erwartungswerte neu
herleiten oder die Szenarien als veraltet markieren.

---

## 09-04, Task 3: `overtimeTransactionRebuildService.ts` — abweichende `targetHours`-Summe
gegenüber `unifiedOvertimeService.ts` (pre-existing, nicht durch REQ-19-Fix verursacht)

**Gefunden während:** Task 3, End-zu-Ende-Verifikation des Zweig-A-Fixes gegen eine
Wegwerfkopie von `server/database/development.db` (Nutzer C, `userId 17`, Monat `2026-04`).

**Beobachtung:** `updateMonthlyOvertime()` (`server/src/services/overtimeService.ts:406`)
schreibt `overtime_balance` zweimal: zuerst mit dem Ergebnis von
`unifiedOvertimeService.calculateMonthlyOvertime()` (`targetHours=40h` für Nutzer C, Monat
2026-04), danach überschreibt `rebuildOvertimeTransactionsForMonth()`
(`overtimeTransactionRebuildService.ts:52`, aufgerufen von `overtimeService.ts:478`) dieselbe
Zeile über `updateOvertimeBalanceForMonth()` mit einer eigenen `targetHours`-Summe aus
`collectDailyCalculations()` — dort `targetHours=36h`, eine Differenz von 4h (einem
Arbeitstag) gegenüber dem unified-Wert, obwohl eine manuelle Tag-für-Tag-Summierung der
`getDailyTargetHours()`-Rohwerte für denselben Nutzer/Monat exakt 40h ergibt (48h Rohsumme
minus 8h für zwei `unpaid`-Tage à 4h — deckungsgleich mit dem unified-Ergebnis).

**Verifiziert als pre-existing, nicht durch diesen Plan verursacht:** Mit
`git checkout -- server/src/services/overtimeTransactionRebuildService.ts` auf den
Stand VOR dem REQ-19-Fix zurückgesetzt und derselbe Lauf gegen eine frische Kopie wiederholt:
Die Diskrepanz (`targetHours=36h` statt `40h`) besteht identisch, unabhängig vom REQ-19-Fix.
Die absolute Größe der resultierenden `overtime`-Abweichung (rund 0,59h) ist vor und nach dem
REQ-19-Fix gleich groß (vorher `-4.42` statt korrekt `-3.83`, nachher `-8.42` statt korrekt
`-7.83`) — der REQ-19-Fix verändert diese vorbestehende Ungenauigkeit nicht.

**Warum das den angezeigten Saldo nicht betrifft:** `getOvertimeSummary()`
(`overtimeService.ts:580`, aufgerufen von `GET /api/overtime/:userId`) ruft ausschließlich
`ensureOvertimeBalanceEntries()` (`overtimeService.ts:603,669`) auf — diese Funktion schreibt
`overtime_balance` NUR über `unifiedOvertimeService.calculateMonthlyOvertime()`
(`overtimeService.ts:730`), niemals über `rebuildOvertimeTransactionsForMonth()`. Ein realer
Lauf von `npm run validate:overtime:paths -- --from=09-PRUEFNUTZER.csv` nach dem REQ-19-Fix
zeigt für alle drei Prüfnutzer exakte Übereinstimmung aller fünf Wege (inkl. `balance_row`),
weil der zuletzt ausgeführte Schreibpfad `ensureOvertimeBalanceEntries()` war. Die hier
beschriebene Diskrepanz würde nur sichtbar, wenn `updateMonthlyOvertime()` erneut läuft (z. B.
nach einer neuen Abwesenheitsgenehmigung/-ablehnung für denselben Monat) — dieser Pfad ruft
`rebuildOvertimeTransactionsForMonth()` auf.

**Nicht behoben, weil:** außerhalb des REQ-19-Scopes (Ursache ist eine abweichende
`targetHours`-Ermittlung zwischen zwei Berechnungspfaden, nicht die `overtime_comp`-Kreditlogik
aus H1/H2/H3) und nicht durch den REQ-19-Fix verursacht oder verschlimmert.

**Empfehlung:** Eigene Debug-Session/Plan — Vergleich von `collectDailyCalculations()`
(`overtimeTransactionRebuildService.ts:232-295`) gegen `unifiedOvertimeService`s Tagesschleife
(`unifiedOvertimeService.ts:186-192`) für denselben Nutzer/Monat, Tag für Tag, um die exakte
Codestelle der Abweichung zu isolieren.

---

## AUFLÖSUNG (09-05, Task 4): Ursache gefunden — Monatsend-Off-by-one

Der oben zurückgestellte Befund („36h statt 40h für userId 17, 2026-04") hat dieselbe Ursache
wie der in Plan 09-05 behobene Monatsend-Fehler: `overtimeTransactionRebuildService.ts:67`
bildete den Monatsanfang mit `new Date(month + '-01')` — das parst ISO-Datumsstrings ohne
Zeitanteil als **UTC**-Mitternacht, in `Europe/Berlin` also 02:00 lokal im Sommer bzw. 01:00 im
Winter. Die Monatsobergrenze (`:68`) wurde dagegen korrekt lokal gebildet. Die Tagesschleife in
`collectDailyCalculations()` brach dadurch systematisch einen Tag vor Monatsende ab. Für
userId 17/2026-04 fehlte exakt der 30.04.2026 (Donnerstag, Sollstunden an diesem Tag) —
`targetHours` fiel deshalb um einen Arbeitstag zu niedrig aus (36h statt 40h).

**Fix:** Lokale Zerlegung (`split('-').map(Number)` → `new Date(jahr, monat, tag)`) für
Monatsgrenzen UND Eintrittsdatum, nach dem Vorbild von `unifiedOvertimeService.ts:156-157`/
`:164-165`. Ein zweiter, tatsächlich erreichbarer Fund derselben Fehlerklasse in
`ensureAbsenceTransactions()` (`overtimeService.ts`, aktiver Schreibpfad hinter
`GET /api/overtime/transactions/monthly-summary`) wurde bei der Suche nach dem Muster ebenfalls
gefunden, empirisch reproduziert (Test „mehrtaegiger Urlaub bis zum letzten Kalendertag...",
`overtimeService.test.ts`) und mit demselben Muster behoben.

**Nachweis:** `09-ABSCHLUSS-NACHWEIS.md`, Abschnitt „Nutzer C — userId 17". Nach dem Fix zeigt
`validate:overtime:detailed` für userId 17/2026-04 `Working Days Calculation: 48h`,
`Unpaid Leave Reduction: -8h`, `CALCULATED TOTAL: 40h`, `✅ MATCH` — bestätigt gegen eine
Wegwerfkopie von `development.db`.

**Präzisierung der Einschätzung „betrifft den angezeigten Saldo nicht":** Diese Einschätzung
gilt weiterhin **nur**, solange `updateMonthlyOvertime()` nicht erneut für denselben Nutzer/
Monat läuft. `updateMonthlyOvertime()` (`overtimeService.ts:411ff`) schreibt `overtime_balance`
zuerst korrekt über `unifiedOvertimeService.calculateMonthlyOvertime()`, überschreibt die Zeile
danach aber mit der (vor diesem Fix fehlerhaften) Summe aus
`rebuildOvertimeTransactionsForMonth()`. Dieser zweite Schreibvorgang läuft bei **jeder**
Genehmigung oder Ablehnung einer Abwesenheit für den betroffenen Monat — der Fehler erreicht den
angezeigten Saldo also sehr wohl, sobald ein Antrag bearbeitet wird, nicht erst bei einem
manuellen Rebuild-Aufruf.

**Verbleibender Restpunkt (Phase 9.1, D2):** Der Codefix repariert nur künftige Rebuilds. Die
bereits in der Produktionsdatenbank gespeicherten `overtime_transactions`-Zeilen mit demselben
Off-by-one-Muster (u. a. userId 3/17 auf `2026-09-29`, userId 15 auf `2026-03-30`, userId
21/22/29 auf `2026-07-30`) bleiben unvollständig, bis ein Backfill läuft — verankert in
`.planning/ROADMAP.md`, Abschnitt „Phase 9.1: Journal-Backfill und Betriebs-Härtung".
