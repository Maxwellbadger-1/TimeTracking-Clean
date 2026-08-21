# Debug-Sichtung: Vier offene Überstunden-Debug-Sessions

**Erstellt:** 2026-08-21 (Plan 09-01)
**Zweck:** Die vier in `.planning/STATE.md` als „Milestone v3.0" zurückgestellten Überstunden-
Debug-Sessions gegen den heutigen Code-Stand prüfen und je einem Status, einem Requirement und
einem Nachfolgeplan zuordnen. Jede Aussage ist mit `datei:zeile` aus dem aktuellen
Arbeitsverzeichnis belegt — nicht mit dem, was die Session selbst behauptet hat.

---

## Angelpunkte (gegen heutigen Code geprüft)

Drei bereits bekannte Verdachtsstellen wurden zuerst isoliert geprüft, weil sie in mehreren
Sessions wiederkehren.

### (a) `getOvertimeBalance()` in `server/src/services/overtimeTransactionService.ts:406`

Aktuelle SQL (`overtimeTransactionService.ts:414-419`):

```
SELECT COALESCE(SUM(actualHours - targetHours), 0) as balance
FROM overtime_balance
WHERE userId = ?
  AND month <= strftime('%Y-%m', 'now')
```

**Der Filter `AND month <= strftime('%Y-%m', 'now')` ist heute vorhanden**
(`overtimeTransactionService.ts:418`). Der umgebende Kommentar (Zeile 411-413) erklärt den Grund
explizit: „Filter month <= current month to exclude future months. Future months may have
negative balances (e.g. approved future vacation already recorded in overtime_balance) which must
NOT count against current balance."

### (b) `getOvertimeSummary()` in `server/src/services/overtimeService.ts`

Aktuelle SQL (`overtimeService.ts:629-636`):

```
SELECT month, targetHours, actualHours, overtime
FROM overtime_balance
WHERE userId = ? AND month LIKE ? AND month >= strftime('%Y-%m', ?) AND month <= ?
ORDER BY month DESC
```

**Der Filter `AND month <= ?` ist heute vorhanden** (`overtimeService.ts:633`), gebunden an den
Parameter `endMonth` (`overtimeService.ts:636`: `.all(userId, ..., hireDate, endMonth)`).

### (c) `overtimeTransactionRebuildService.ts` — Typfilter beim Monats-Rebuild

Aktueller Code (`overtimeTransactionRebuildService.ts:115-134`):

```
const REBUILDABLE_TYPES = [
  'worked', 'time_entry', 'earned', 'vacation_credit', 'sick_credit',
  'overtime_comp_credit', 'special_credit', 'unpaid_deduction',
  'unpaid_adjustment', 'holiday_credit', 'weekend_credit',
];

const deleteResult = db.prepare(`
  DELETE FROM overtime_transactions
  WHERE userId = ?
    AND date BETWEEN ? AND ?
    AND type IN (${REBUILDABLE_TYPES.map(() => '?').join(', ')})
`).run(userId, monthFirstDay, monthLastDay, ...REBUILDABLE_TYPES);
```

Es gibt heute die Liste `REBUILDABLE_TYPES` (`overtimeTransactionRebuildService.ts:115`), und das
`DELETE` löscht **nicht** mehr alle Transaktionen eines Monats ohne Typfilter — der Typ
`compensation` ist nicht in `REBUILDABLE_TYPES` enthalten und wird beim Rebuild folglich nicht
gelöscht. Der Kommentar darüber (`overtimeTransactionRebuildService.ts:98-100`) datiert den Fix auf
den 18.08.2026 und beschreibt den vorherigen Zustand: „This used to delete EVERY transaction in the
month with no type filter. [...] book-once records were wiped and never came back."

**Selbstauskunft des Codes zum verbleibenden Defekt** (`overtimeTransactionRebuildService.ts:110-113`,
wörtliches Zitat):

```
SCOPE: This restores the audit trail. It does NOT by itself change any balance,
because getOvertimeBalance() sums the monthly overtime_balance aggregate rather
than these transactions. That the overtime_comp debit never reaches the balance at
all is a separate defect in the dual calculation system — tracked, not fixed here.
```

Diese Zeile ist der direkte Anknüpfungspunkt für REQ-19 (in `09-CONTEXT.md` als „bekannter Defekt"
benannt). Der Kommentar verweist auf `.planning/debug/urlaubstage-bei-ablehnung-verloren.md
(Bug 9/10)` — das ist ein Diskrepanz-Fund dieser Sichtung: In der aktuellen Fassung dieser Datei
trägt der zutreffende Abschnitt die Nummern **Bug 3** („Überstunden-Ausgleich wird nie vom Konto
abgebucht", Zeile 85-94) und **Bug 4** (`deductOvertimeHours()` verpufft", Zeile 96-100) — nicht
Bug 9/10 (das sind dort Urlaubsanspruch-Bugs, Zeile 132-147, thematisch unverwandt). Der
Code-Kommentar zitiert also eine veraltete oder falsche Bug-Nummer aus einer früheren Fassung des
Dokuments. Das wird hier festgehalten, nicht stillschweigend korrigiert.

**Eigene Verifikation, dass der Defekt heute noch existiert (nicht nur laut Kommentar):**
`ensureOvertimeBalanceEntries()` (`overtimeService.ts:684-783`) läuft bei jedem Aufruf über **alle**
Monate von `hireDate` bis zum Zielmonat (Schleife `overtimeService.ts:712-715`, ohne Bedingung) und
überschreibt `targetHours`/`actualHours` per UPSERT unbedingt aus
`unifiedOvertimeService.calculateMonthlyOvertime()` (`overtimeService.ts:745, 762-771`).
`unifiedOvertimeService` (`unifiedOvertimeService.ts:109-140`) kennt ausschließlich `worked`,
`absenceCredit`, `corrections` und `unpaidReduction` (Zeile 121-125) — **keinen** Posten für
`type='compensation'`-Transaktionen. Derselbe Effekt gilt für den zweiten Schreibpfad
`updateOvertimeBalanceForMonth()` (`overtimeTransactionRebuildService.ts:466-519`): `actualHours`
wird ausschließlich aus `dailyCalculations` (ZeitEinträge + Abwesenheits-Gutschriften + Korrekturen,
Zeile 482-494) neu berechnet, ebenfalls ohne Bezug zu `compensation`-Buchungen.
`ensureOvertimeBalanceEntries()` wird bei jedem Aufruf von `GET /api/overtime/:userId` und
`GET /api/reports/overtime/user/:userId` ausgeführt (siehe 09-INVENTAR-SOLLSTUNDEN.md). Damit wird
jede von `recordOvertimeCompensation()`/`deductOvertimeHours()` vorgenommene Reduktion spätestens
beim nächsten Dashboard-/Report-Aufruf durch die Neuberechnung überschrieben. **Der Defekt ist
heute noch aktiv**, nicht nur laut Code-Kommentar behauptet.

---

## Session 1: `carmen-rothemund-overtime-analysis`

**Behaupteter Defekt (drei Teilbefunde, Datei vom 2026-04-01):**
1. Frontend/Backend summiert Zukunftsmonate (Mai/Juni 2026) in die Jahres-Überstundenanzeige
   → Carmen sieht -62:31h statt +9:29h.
2. April 2026 hatte `targetHours = 0` statt der erwarteten ~48h.
3. Mai/Juni 2026 hatten bereits `overtime_balance`-Einträge, obwohl „heute" der 1. April 2026 war.

**Betroffene Codestelle laut Session:** `server/src/services/overtimeService.ts`, Funktion
`getOvertimeSummary()` — Query ohne `AND month <= ?` (Session-Zitat, Zeile 96-100 der Analyse-Datei).

**IST-Zustand heute:** Siehe Angelpunkt (b) oben — `overtimeService.ts:633` enthält
`AND month <= ?`, gebunden an `endMonth`. Der Teilbefund 1 (der als „🔴 CRITICAL" priorisierte
Hauptdefekt der Session) ist damit durch den heutigen Code widerlegt/behoben.

Teilbefund 2 und 3 waren an einen konkreten Zeitpunkt (1. April 2026, Testdaten für Mai/Juni 2026)
gebunden. Dieser Zeitraum liegt heute (21.08.2026) in der Vergangenheit; ob die
`overtime_balance`-Einträge für April/Mai/Juni 2026 in der aktuellen Datenbank noch die
beschriebenen Fehlwerte enthalten, lässt sich ohne Datenbankabfrage nicht feststellen — dieser Plan
liest laut Threat-Model keine Datenbank. Das bleibt eine **offene Frage**, keine erfundene
Gewissheit: Sollte Plan 09-04 (REQ-19) reale Nutzerdaten prüfen (D4 aus `09-CONTEXT.md`, mindestens
drei reale Nutzer), gehört die Kontrolle „Ist `targetHours` für vergangene Monate mit
`workSchedule`-Nutzern korrekt?" mit hinein.

**Status:** `behoben — Beleg im Code` (für den kritischen Teilbefund 1, den einzigen mit
eindeutigem, heute nachprüfbarem Code-Bezug).

---

## Session 2: `overtime-compensation-workschedule-bug`

**Behaupteter Defekt:** Nutzer mit individuellem `workSchedule` sehen falsche Überstunden bei
Überstundenausgleich-Anträgen; Hypothese der Session war, das System nutze fälschlich `weeklyHours`
statt `workSchedule`.

**Betroffene Codestelle laut Session:** Die gesamte Berechnungskette von
`getDailyTargetHours()` (`workingDays.ts`) über `unifiedOvertimeService.ts` bis
`overtimeService.ts:getOvertimeSummary()`.

**IST-Zustand heute:** Die Session kam bereits selbst zu dem Schluss „NO CODE BUG FOUND" (Zeile 397
der Session-Datei) — die Priorität-Reihenfolge sei backend-seitig durchgängig korrekt
implementiert. Diese Sichtung verifiziert das unabhängig gegen den heutigen Code, nicht nur gegen
die Behauptung der Session:
- `workingDays.ts:73-76`: `if (user.workSchedule) { const dayName = getDayName(date); return
  user.workSchedule[dayName] || 0; }` — `workSchedule` hat Vorrang vor `weeklyHours`, exakt wie in
  der Session zitiert.
- `unifiedOvertimeService.ts:115`: `const rawTargetHours = getDailyTargetHours(user, date);` —
  ruft die kanonische Funktion auf.
- `unifiedOvertimeService.ts:318-321` (`getUser()`): `workSchedule: user.workSchedule ?
  JSON.parse(user.workSchedule) : null` — parst das JSON-Feld aus der Datenbank korrekt.

Alle drei von der Session zitierten Code-Ausschnitte stimmen wörtlich mit dem heutigen Code
überein (Zeilennummern haben sich seit dem 01.04.2026 teils verschoben, der Inhalt nicht). Die
Session selbst vermutete als wahrscheinlichste Ursache veraltete Datenbank-Werte (Stale Data), kein
Code-Problem, und empfahl `POST /api/overtime/recalculate-all` als Abhilfe — das ist keine
Code-Änderung.

**Status:** `behoben — Beleg im Code` (die Session fand keinen Code-Defekt; die heutige
Nachprüfung bestätigt, dass der beschriebene Mechanismus korrekt implementiert ist).

---

## Session 3: `overtime-validation-backend-mismatch`

**Behaupteter Defekt:** `getOvertimeBalance()` in `overtimeTransactionService.ts` hatte keinen
Monatsfilter und summierte alle Monate inklusive Zukunft mit negativen Salden aus genehmigtem
zukünftigem Urlaub — Carmen konnte einen Überstundenausgleich-Antrag nicht stellen, obwohl das
Frontend genug Stunden anzeigte (`-66.51h` statt `+5.29h` laut Fehlermeldung im Dokument).

**Betroffene Codestelle laut Session:** `overtimeTransactionService.ts:406-417`,
`getOvertimeBalance()`, SQL ohne `AND month <= ...` (Session-Zitat, Zeile 38 der Session-Datei).

**IST-Zustand heute:** Siehe Angelpunkt (a) oben — `overtimeTransactionService.ts:418` enthält
heute `AND month <= strftime('%Y-%m', 'now')`. Die Session-Datei selbst dokumentiert den Fix im
`## Resolution`-Abschnitt (Zeile 61-68): „fix: Add 'AND month <= strftime(...)' [...] files_changed:
[server/src/services/overtimeTransactionService.ts]" mit `status: awaiting_human_verify` im
Frontmatter (Zeile 2). Der heutige Code bestätigt, dass der beschriebene Fix angewendet wurde.

**Status:** `behoben — Beleg im Code`.

---

## Session 4: `OVERTIME-FIX-PLAN`

**Behaupteter Defekt:** Identisch mit dem kritischen Teilbefund aus Session 1
(`carmen-rothemund-overtime-analysis`) — dieses Dokument ist der Umsetzungsplan für exakt jenen
Fix, nicht eine eigenständige neue Analyse. Root Cause laut Datei (Zeile 5): „`getOvertimeSummary()`
filtert nicht bis `endMonth`".

**Betroffene Codestelle laut Session:** `server/src/services/overtimeService.ts:629-636` (Zeile 13
der Plan-Datei), mit explizitem Vorher/Nachher-Diff (Zeile 15-35).

**IST-Zustand heute:** Der im Diff vorgeschlagene Code (`AND month <= ?` plus `endMonth`-Parameter)
ist wortgleich im heutigen `overtimeService.ts:633,636` vorhanden — siehe Angelpunkt (b). Das
Dokument enthält unter „📋 KNOWN ISSUES & FOLLOW-UPS" (Zeile 400-418) zusätzlich zwei
Nachfolgepunkte: „Issue 1: April 2026 targetHours = 0" (als eigene, spätere Analyse vorgesehen) und
„Issue 2: Future Months Prevention" (als Design-Frage offen gelassen, Entscheidung „Option 3 für
jetzt" — Zukunftsmonate weiter erstellen, aber aus der Summierung ausschließen).

**Status:** `behoben — Beleg im Code` (der im Plan beschriebene Fix ist im heutigen Code
vorhanden; die beiden dort selbst als offen benannten Folgefragen sind keine Behauptung eines
bestehenden Defekts, sondern explizit vertagte Entscheidungen ohne Code-Bezug in dieser Datei).

---

## Übersichtstabelle

| Session | Status | Zuordnung | Nachfolgeplan |
|---|---|---|---|
| `carmen-rothemund-overtime-analysis` | behoben — Beleg im Code | REQ-17/18 (Monatsfilter-Fix bestätigt); Teilbefunde 2/3 zeitgebunden, offene Frage für reale Datenprüfung | 09-04 (falls D4-Nutzerprüfung den April-2026-Fall erneut aufwirft), sonst keiner |
| `overtime-compensation-workschedule-bug` | behoben — Beleg im Code | kein Code-Defekt, Stale-Data-Hypothese | keiner |
| `overtime-validation-backend-mismatch` | behoben — Beleg im Code | REQ-19 (Vorstufe: Balance-Berechnung korrekt monatsgefiltert) | keiner |
| `OVERTIME-FIX-PLAN` | behoben — Beleg im Code | REQ-17/18 (identischer Fix wie Session 1) | keiner |

**Zusätzlicher, in keiner der vier Sessions dokumentierter, aber über den Angelpunkt (c) direkt
verifizierter offener Befund:** Der `overtime_comp`-Debit erreicht den Saldo nach wie vor nicht
(siehe Angelpunkt (c), „Eigene Verifikation" oben) — das ist der Kernfall von **REQ-19** und gehört
in **Plan 09-04**.

---

## Fußzeile: zurückgestellte Sessions

Die beiden Debug-Sessions `unpaid-leave-logic-issues` und `notifications-position-column-missing`
sind laut `09-CONTEXT.md` ausdrücklich zurückgestellt und werden in diesem Milestone **nicht**
bearbeitet. Sie sind hier nur der Vollständigkeit halber genannt und wurden im Rahmen dieser
Sichtung nicht gelesen.
