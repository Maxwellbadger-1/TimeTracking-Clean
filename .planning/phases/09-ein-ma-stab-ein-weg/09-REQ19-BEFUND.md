# REQ-19-Befund: „overtime_comp erreicht den Saldo nicht"

**Erstellt:** 2026-08-21 (Plan 09-04, Task 2)
**Zweck:** D2 (09-CONTEXT.md) verlangt erst Reproduktion, dann Ursache mit `datei:zeile`, dann
eine belegte Entscheidung zwischen Zweig A (Fix in Phase 9) und Zweig B (Phase 9.1). Alle Zeilen
sind gegen den heutigen Arbeitsstand gelesen, nicht gegen die Behauptung einer Debug-Session.

---

## Reproduktion

**Werkzeug:** `server/src/scripts/reproduceOvertimeCompDefect.ts` (Task 1 dieses Plans), Aufruf:

```
cd server && npx tsx src/scripts/reproduceOvertimeCompDefect.ts --userId=17 --month=2026-04
```

**Nutzer:** Carmen Rothemund, `userId 17` (Nutzer C aus `09-PRUEFNUTZER.csv`, D4-Kriterium:
genehmigter `overtime_comp`-Antrag). `weeklyHours=12`,
`workSchedule={"monday":4,"tuesday":4,"wednesday":0,"thursday":4,"friday":0,"saturday":0,"sunday":0}`.

**Monat:** 2026-04. Genehmigter Antrag `id=56`, `startDate=endDate=2026-04-13`,
`daysRequired=1`.

**erwarteterAbzug:** 4h (Sollstunden des 13.04.2026 über
`calculateAbsenceHoursWithWorkSchedule()`, `server/src/utils/workingDays.ts:117-155`).

**Tatsächlicher Saldo (Monat 2026-04, `unifiedOvertimeService.calculateMonthlyOvertime`):**
`targetHours=40, actualHours=36.17, overtime=-3.83`.

**erwarteterSaldo (tatsächlicherSaldo - erwarteterAbzug):** `-3.83 - 4 = -7.83h`.

**Differenz — absenceCredit-Summe über die Ausgleichstage:** `4h` (muss `0h` sein, wenn der
Ausgleich den Saldo erreicht; ist `4h`, weil der 13.04.2026 als saldoneutral berechnet wird:
`calculateDailyOvertime(17, '2026-04-13')` liefert `targetHours=4, actualHours=4, overtime=0,
breakdown.absenceCredit=4`).

**Exit-Code:** 1 (Defekt reproduziert — das erwartete Ergebnis dieses Laufs).

**Zusätzlicher Befund aus `overtime_transactions` (Schritt 4 des Skriptlaufs):** Für Nutzer C
und Monat 2026-04 existieren `0` Zeilen vom Typ `compensation`, aber `1` Zeile vom Typ
`overtime_comp_credit` (Summe `4.00h`). Das deckt sich mit dem Kommentar in
`server/src/services/overtimeTransactionRebuildService.ts:107` („Production had 0 'compensation'
rows against 3 approved overtime_comp requests — every one of them had been silently deleted by
a later rebuild") — der historische Verlust der `compensation`-Zeile ist auch in der lokalen
Entwicklungsdatenbank sichtbar, nicht nur laut Kommentar behauptet.

---

## Hypothesenprüfung

### H1 — Gutschrift neutralisiert den Ausgleichstag

**Urteil: bestätigt.**

`server/src/services/unifiedOvertimeService.ts:336-338`:
```
private getAbsenceCredit(userId: number, date: string, targetHours: number): number {
    // Only credit for absences that give credit (vacation, sick, overtime_comp, special)
    // NOT for unpaid leave
```
Die SQL-Bedingung (`unifiedOvertimeService.ts:346`) filtert `type IN ('vacation', 'sick',
'overtime_comp', 'special')` — `overtime_comp` steht in derselben Reihe wie `vacation` und
`sick`. Ergebnis in `calculateDailyOvertime()` (`unifiedOvertimeService.ts:125-126`):
`actualHours = worked + absenceCredit + corrections`, `overtime = actualHours - targetHours`.
Für den 13.04.2026 (kein Zeiteintrag, keine Korrektur): `actualHours = 0 + 4 + 0 = 4`,
`overtime = 4 - 4 = 0` — exakt der reproduzierte Wert aus Schritt 7 des Skriptlaufs.

### H2 — Die Ausgleichsbuchung liegt in einem Konto, das den Saldo nicht speist

**Urteil: bestätigt, aber nicht die Ursache des reproduzierten Zahlenunterschieds.**

`server/src/services/overtimeTransactionService.ts:114-129` (`recordOvertimeCompensation`)
schreibt eine Zeile `type='compensation'` nach `overtime_transactions`.
`server/src/services/overtimeTransactionService.ts:406-419` (`getOvertimeBalance`) summiert
`SUM(actualHours - targetHours) FROM overtime_balance` — nicht aus `overtime_transactions`.
Aufgerufen wird `recordOvertimeCompensation` von `server/src/services/absenceService.ts:870`.
Das ist ein echter, unabhängig existierender Konstruktionsfehler: Diese Buchung erreicht
`overtime_balance` konstruktiv nie, unabhängig vom Zustand von H1. Sie ist aber NICHT die
Ursache des in diesem Plan reproduzierten Zahlenunterschieds, weil `overtime_balance`
(die tatsächlich angezeigte Quelle, siehe `09-ANGLEICHUNG-NACHWEIS.md` Abschnitt „Belegkette
REQ-18") an keiner Stelle aus `overtime_transactions` abgeleitet wird — auch nicht über den
Umweg von `updateOvertimeBalanceForMonth()` (siehe Abschnitt „Ursache" unten). H2 wirkt parallel
zu H1/H3, nicht als deren Auslöser.

### H3 — Der direkte Abzug wird überschrieben

**Urteil: bestätigt, mit exaktem Ablauf statt Vermutung.**

`server/src/services/absenceService.ts` — Aufrufreihenfolge innerhalb von
`approveAbsenceRequest()`:
1. Zeile 822-834 (`applyApproval`-Transaktion): Statuswechsel, dann Zeile 832
   `updateBalancesAfterApproval(id, approvedBy)`.
2. `updateBalancesAfterApproval()` (Zeile 1213-1250) ruft für `type === 'overtime_comp'`
   (Zeile 1241-1246) `deductOvertimeHours(request.userId, hoursToDeduct)` auf — diese Funktion
   (Zeile 1528 ff.) reduziert `overtime_balance.actualHours` direkt per `UPDATE`.
3. Direkt danach, NACH der Transaktion aus Schritt 1, ruft `approveAbsenceRequest()`
   (Zeile 838-855) für jeden betroffenen Monat `updateMonthlyOvertime(request.userId, month)`
   auf (`overtimeService.ts:406`) — diese Funktion überschreibt `overtime_balance` UNBEDINGT
   per UPSERT (`overtimeService.ts:459-471`) mit dem Ergebnis von
   `unifiedOvertimeService.calculateMonthlyOvertime()` (Zeile 439).

Der in Schritt 2 vorgenommene, korrekte Abzug wird durch den UPSERT aus Schritt 3 vollständig
verworfen — noch bevor irgendjemand den Saldo betrachtet. Das ist innerhalb desselben
Funktionsaufrufs `approveAbsenceRequest()`, nicht erst bei einem späteren, unabhängigen Lauf.

### Gegenprobe: `type='vacation'` im selben Rechenweg

`getAbsenceCredit()` (`unifiedOvertimeService.ts:346`) behandelt `vacation` fachlich korrekt
gleich wie hier `overtime_comp` — beide erhalten eine volle Tagesgutschrift. Für Urlaub ist das
richtig: Urlaub wird aus dem Urlaubskonto bezahlt (`vacation_balance`/`vacation_transactions`),
der Tag zählt beim Überstundenkonto zu Recht als „wie gearbeitet" (`.claude/CLAUDE.md`:
„Krankheit/Urlaub: Als gearbeitete Stunden zählen"). Für `overtime_comp` ist dieselbe Behandlung
fachlich falsch: Der Ausgleichstag wird AUS dem Überstundenkonto selbst bezahlt — eine
zusätzliche Gutschrift auf genau dieses Konto zahlt den Tag zweimal. Der Unterschied zwischen
Urlaub (Gutschrift aus einem ANDEREN Konto korrekt) und Überstundenausgleich (Gutschrift auf das
ABGEBUCHTE Konto falsch) ist in `getAbsenceCredit()` heute nicht abgebildet — beide Typen landen
in derselben `IN (...)`-Liste.

---

## Ursache

**Ein Satz:** Zwei voneinander unabhängige, aber inhaltlich identische Implementierungen — die
`IN ('vacation', 'sick', 'overtime_comp', 'special')`-Bedingung in
`unifiedOvertimeService.ts:346` (`getAbsenceCredit`) UND die Bedingung
`day.absence.type !== 'unpaid'` in `overtimeTransactionRebuildService.ts:486`
(`updateOvertimeBalanceForMonth`) — kreditieren einen genehmigten `overtime_comp`-Tag mit
seinen vollen Sollstunden, wodurch `actualHours = targetHours` und der Tag saldoneutral wird,
statt den Saldo um die Sollstunden zu senken.

**Die Kette bis zum angezeigten Saldo:** `updateMonthlyOvertime()` (`overtimeService.ts:406`)
schreibt `overtime_balance` bei jedem Aufruf ZWEIMAL, nacheinander, für dieselbe
(`userId`, `month`)-Zeile:
1. Zeile 439 + 459-471: UPSERT mit dem Ergebnis von
   `unifiedOvertimeService.calculateMonthlyOvertime()` — betroffen von H1.
2. Zeile 478: Aufruf von `rebuildOvertimeTransactionsForMonth()`
   (`overtimeTransactionRebuildService.ts:52`), das am Ende (Zeile 190 dort)
   `updateOvertimeBalanceForMonth()` aufruft — ein ZWEITER, unabhängiger UPSERT auf dieselbe
   Zeile, mit einer eigenen, zu H1 strukturgleichen Kreditlogik (Zeile 486-488:
   `if (day.absence.type && day.absence.type !== 'unpaid') { dayActual += day.targetHours; }`).

Der zweite UPSERT läuft IMMER als letzter und überschreibt den ersten vollständig. Beide
Berechnungen liefern für `overtime_comp`-Tage denselben falschen Wert (saldoneutral), weil beide
denselben Fehler unabhängig voneinander enthalten — deshalb zeigt der reproduzierte
`overtime_balance`-Wert (`-3.83h`) exakt das Ergebnis, das man erhält, wenn man NUR eine der
beiden Stellen fixt: keines. Ein Fix müsste beide Stellen treffen, weil die zweite die erste
sonst wieder überschreibt. Der in `absenceService.ts:1246` vorgenommene direkte Abzug
(`deductOvertimeHours`, H3) wird von beiden UPSERTs ohnehin verworfen — er ist bereits heute
wirkungslos, unabhängig vom Ausgang dieser Entscheidung, und ist nicht Teil der Ursachenkette,
die den angezeigten Saldo bestimmt.

---

## Entscheidung nach D2

**(a) Anzahl der Services, die geändert werden müssten: 2 Services.**
1. `server/src/services/unifiedOvertimeService.ts` — `getAbsenceCredit()`
   (Zeile 336-353): `overtime_comp` aus der kreditierenden Typliste entfernen, damit
   `calculateDailyOvertime()`/`calculateMonthlyOvertime()` für Ausgleichstage `actualHours=0`
   statt `actualHours=targetHours` liefern (`overtime = -targetHours` für den Tag).
2. `server/src/services/overtimeTransactionRebuildService.ts` —
   `updateOvertimeBalanceForMonth()` (Zeile 466-519, konkret die Bedingung Zeile 486) muss
   dieselbe Ausnahme erhalten, weil dieser zweite UPSERT den ersten sonst unverändert
   überschreibt (siehe Abschnitt „Ursache"). In derselben Datei müssen zusätzlich
   `handleAbsenceDay()` (Zeile 310-374) und `calculateRunningBalanceAfterAbsence()`
   (Zeile 386-399) angepasst werden, damit die in `overtime_transactions` erzeugte
   Audit-Trail-Buchung (`overtime_comp_credit`) und der dort mitgeführte `balanceAfter`-Lauf
   nicht weiterhin eine Neutralisierung behaupten, die `overtime_balance` nach dem Fix nicht
   mehr zeigt — sonst entstünde eine NEUE Diskrepanz zwischen Journal und Saldo, die REQ-18
   (Ein Maßstab) widerspräche. Alle vier Änderungen liegen in genau diesen zwei Dateien; kein
   drittes Service-Modul muss angefasst werden.

**(b) Datenmigration an Bestandsbuchungen: nicht nötig.**
`overtime_balance` wird durch `updateMonthlyOvertime()` bei jedem Aufruf vollständig neu
berechnet (kein inkrementelles Fortschreiben, siehe UPSERT in beiden oben genannten Stellen).
`ensureOvertimeBalanceEntries()` (`overtimeService.ts:669-767`) läuft bei jedem
`GET /api/overtime/:userId` und `GET /api/reports/overtime/user/:userId` unbedingt über ALLE
Monate von `hireDate` bis zum Zielmonat (Schleife `overtimeService.ts:697`, ohne Bedingung,
verifiziert in `09-DEBUG-SICHTUNG.md`, Angelpunkt „Eigene Verifikation"). Nach dem Deployment des
Fixes wird `overtime_balance` also beim nächsten Dashboard- oder Berichtsaufruf für jeden
Nutzer automatisch neu berechnet — kein Backfill-Skript und keine manuelle Korrektur an
`overtime_balance`- oder `overtime_transactions`-Zeilen nötig. Die historisch bereits verlorene
`compensation`-Zeile (H2, siehe Abschnitt „Reproduktion") bleibt davon unberührt — sie ist ein
Audit-Trail-Datenverlust, kein Saldofehler, und ihre Nachbildung wäre eine echte
Datenkorrektur; sie ist nicht Voraussetzung für die Behebung des hier reproduzierten
Saldofehlers und wird in diesem Plan nicht rückwirkend nachgebildet.

**(c) Ergebnis: Zweig A — Fix in Phase 9.**
2 Services, keine Datenmigration — beide zulässigen Kriterien für Zweig A sind erfüllt.

---

## Nebenwirkung

**Betroffene Nutzer, lesend ermittelt:**
```sql
SELECT COUNT(DISTINCT userId) as c
FROM absence_requests
WHERE type = 'overtime_comp' AND status = 'approved';
```
Ergebnis gegen `server/database/development.db`: **3 Nutzer** (`userId` 18/`reqId` 25,
17/`reqId` 56, 3/`reqId` 64 — dieselben drei Kandidaten, aus denen Nutzer C in
`09-PRUEFNUTZER.md` gewählt wurde).

**Welche Salden ändern sich:** Für alle drei Nutzer sinkt `overtime_balance.overtime` im Monat
des jeweiligen Ausgleichsantrags um die Sollstunden des Ausgleichszeitraums, sobald der Fix
greift und die nächste Neuberechnung läuft (Dashboard- oder Berichtsaufruf, oder ein manueller
`ensureOvertimeBalanceEntries`-Lauf). Für Nutzer C (`userId 17`, Monat 2026-04) beträgt diese
Korrektur exakt die in der Reproduktion gemessenen 4h. Diese Zahl ist für Phase 12
(Stundenwechsel bedienen — Salden müssen beim Umstellungsstichtag korrekt sein) und Phase 14
(Legacy-Rückbau) relevant: Drei real betroffene Nutzer, keine Rückwirkung auf Monate ohne
`overtime_comp`-Antrag.

---

## Ergebnis Zweig A

**Geänderte Stellen (2 Services, wie unter „Entscheidung nach D2" festgelegt):**
1. `server/src/services/unifiedOvertimeService.ts:336-353` (`getAbsenceCredit`) —
   `overtime_comp` aus der kreditierenden Typliste entfernt (`IN ('vacation', 'sick',
   'special')` statt zuvor zusätzlich `'overtime_comp'`).
2. `server/src/services/overtimeTransactionRebuildService.ts`:
   - `updateOvertimeBalanceForMonth()` (Zeile 474 ff., Bedingung ehemals Zeile 486): Kredit für
     `actualHours` jetzt nur für `vacation`/`sick`/`special`, nicht mehr für `overtime_comp`.
   - `handleAbsenceDay()` (Zeile 310 ff.): erzeugt für `overtime_comp` keine neutralisierende
     Gutschrift-Transaktion mehr — nur die `earned`-Transaktion (`-targetHours`) bleibt.
   - `calculateRunningBalanceAfterAbsence()` (Zeile 386 ff.): `creditChange = 0` für
     `overtime_comp` statt `targetHours`, sodass der laufende Saldo netto um `targetHours`
     sinkt.

**TDD-Nachweis (`server/src/services/unifiedOvertimeService.test.ts`):**
- RED-Commit: neuer Test „should reduce overtime by targetHours on an approved overtime_comp
  day" schlägt vor dem Fix fehl (`actualHours=8` statt `0`, `overtime=0` statt `-8`).
- Regressionstest ergänzt: `vacation`/`sick` bleiben saldoneutral (`actualHours=targetHours`,
  `overtime=0`) — besteht unverändert vor und nach dem Fix.
- GREEN-Commit: beide Tests bestehen nach dem Fix.

**Reproduktions-Exit-Code (Nutzer C, `userId 17`, Monat `2026-04`):**
- Vorher: Exit 1 (Defekt reproduziert, Differenz `4h`).
- Nachher: Exit 0 (`npm run repro:overtime-comp -- --userId=17 --month=2026-04`, Differenz
  `0h`).

**`npm run validate:overtime:paths -- --from=../.planning/phases/09-ein-ma-stab-ein-weg/09-PRUEFNUTZER.csv` (alle drei Prüfnutzer, nach dem Fix):**
Exit 0, alle fünf Wege (`unified`, `dashboard`, `report_summary`, `report_daily`,
`balance_row`) stimmen für alle drei Nutzer überein:
- Nutzer A (`userId 2`): `-6.50h` (unverändert — kein `overtime_comp` betroffen).
- Nutzer B (`userId 16`): `-29.75h` (unverändert — kein `overtime_comp` betroffen).
- Nutzer C (`userId 17`): `-7.83h` (vorher `-3.83h` — Saldo um exakt `4h` gesunken, dem
  `erwarteterAbzug` aus der Reproduktion).

**Testzahl vorher/nachher (`cd server && npx vitest run`):**
- Vorher (Ausgangswert dieses Plans, identisch mit dem in Plan 09-03 gemessenen Endstand):
  207 Tests gesamt, 204 bestanden, 3 fehlgeschlagen.
- Nachher: 209 Tests gesamt, 206 bestanden, 3 fehlgeschlagen — dieselben drei bereits vor
  diesem Plan bekannten, unabhängigen Fehlschläge (User-6/7-Hire-Date-Regressionstests in
  `unifiedOvertimeService.test.ts`, ein Test in `vacationBackfillService.test.ts`). Kein
  Rückgang: 206 ≥ 204.

**`npx tsc --noEmit`:** ohne Fehler.

**Saldenunterschied für Nutzer C:** `4h` (von `-3.83h` auf `-7.83h`) — exakt die Sollstunden
des genehmigten Ausgleichstags (`erwarteterAbzug` aus der Reproduktion).

**Pre-existierender, unveränderter Nebenbefund (nicht Teil dieses Fixes, dokumentiert in
`deferred-items.md`):** `overtimeTransactionRebuildService.ts`s eigene `targetHours`-Summe
weicht bei erneutem Aufruf von `updateMonthlyOvertime()` (z. B. nach einer neuen
Abwesenheitsgenehmigung) unabhängig vom REQ-19-Fix von der `unifiedOvertimeService`-Summe ab
(`36h` statt `40h` für Nutzer C/2026-04) — verifiziert als bereits vor diesem Fix vorhanden
(Gegenprobe mit zurückgesetztem Code gegen eine Wegwerfkopie der Datenbank). Betrifft NICHT den
über `GET /api/overtime/:userId` angezeigten Saldo, weil dieser ausschließlich über
`ensureOvertimeBalanceEntries()` (nur `unifiedOvertimeService`-Pfad) läuft, siehe
`deferred-items.md`.

**REQ-19-Urteil: behoben.** Ein genehmigter `overtime_comp`-Antrag reduziert den
Überstundensaldo jetzt nachweislich um seine Sollstunden, statt saldoneutral zu bleiben.
