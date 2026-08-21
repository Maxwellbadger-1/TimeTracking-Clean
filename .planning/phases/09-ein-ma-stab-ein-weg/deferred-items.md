# Deferred Items — Phase 9

Funde außerhalb des Aufgabenbereichs der jeweiligen Task, während der Ausführung entdeckt,
nicht behoben (SCOPE BOUNDARY, execute-plan.md).

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
