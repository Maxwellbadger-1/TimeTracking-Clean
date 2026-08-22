# Teilbeleg Plan 11-07 — absenceService.ts, exportService.ts

**Erstellt:** 2026-08-22 (Plan 11-07, Task 3)
**Zweck:** Abhak-Nachweis für den Anteil von Plan 11-07 an der zentralen
`11-AUFRUFER-CHECKLISTE.md` (REQ-23). Diese Pläne (11-05 bis 11-08, 11-11) laufen in
derselben Welle parallel (`parallelization: true`); die Checkliste selbst wird **nicht**
angefasst, um kein verlorenes Update zu riskieren. Plan 11-09 führt alle Teilbelege
sequenziell zusammen und hakt dort in `11-AUFRUFER-CHECKLISTE.md` ab.

Spaltenform identisch zur Haupttabelle (`Fundstelle`, `Funktion/Kontext`, `Produktivpfad`,
`Zuständiger Plan`, `Disposition`, `✓`). Zeilen wörtlich aus der Haupttabelle übernommen
(Stand vor dieser Ausführung), jetzt mit Haken für den in Plan 11-07 erledigten Anteil.

---

## Erledigt in Plan 11-07 (✓)

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/absenceService.ts:360` (heute: `:364`, Zeilendrift durch neue Kommentare) | `getAbsenceRequestsPaginated()`, Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` zur Anzeige-Anreicherung (`calculatedHours`) | ja (Beleg: `routes/absences.ts:47,55,149` importieren und rufen `getAbsenceRequestsPaginated` auf) | 11-07 | Umgestellt auf `calculateAbsenceHoursWithWorkSchedule(user, absence.startDate, absence.endDate, periods)`; `periods = createWorkPeriodContext()` einmal vor dem `rows.map` | ✓ |
| `server/src/services/absenceService.ts:791` (heute: `:828`) | `approveAbsenceRequest()`, Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` für `actualHoursRequired` vor Genehmigung (Genehmigungsvorbehalt) | ja (Beleg: `export async function approveAbsenceRequest` ← `routes/absences.ts:495`) | 11-07 | Nutzer jetzt über neue Hilfsfunktion `getUserForOvertimeCompCalculation()` (löst über `getUserById()`, Fallback für soft-gelöschte Nutzer ohne Passwort-Hash, T-11-24); Aufruf über `directWorkPeriodLookup` | ✓ |
| `server/src/services/absenceService.ts:863` (heute: `:902`) | `approveAbsenceRequest()`, Aufruf `calculateAbsenceHoursWithWorkSchedule(...)` für `hoursToDeduct` bei `overtime_comp`-Genehmigung (Abbuchung) | ja (wie Zeile 791) | 11-07 | Wörtlich identisch aufgebaut wie die Zeile darüber (T-11-01/CR-01: gleiche Funktion, gleiche Argumentreihenfolge, gleicher Nutzerobjekt-Ursprung `getUserForOvertimeCompCalculation()`) | ✓ |
| `server/src/services/absenceService.ts:1195` (heute: `:1236`) | `calculateAbsenceCredits(userId, startDate, endDate)`, Aufruf `getDailyTargetHours(user, d)` | ja (Beleg: `updateBalancesAfterApproval()` → `deductOvertimeHours()` ← `approveAbsenceRequest()` ← `routes/absences.ts:495`; zusätzlich Aufrufer in `createAbsenceRequest()` für den `overtime_comp`-Vorbehalt bei Antragstellung) | 11-07 | `periods = createWorkPeriodContext()` einmal vor der Tagesschleife erzeugt und durchgereicht; bestehender Wochenend-/Feiertagsvorfilter unverändert | ✓ |
| `server/src/services/exportService.ts:98` (heute: `:103`) | `generateDATEVExport()`, Aufruf `getDailyTargetHours(fullUser, entry.date)` | ja (Beleg: `server/src/routes/exports.ts:18` importiert `generateDATEVExport`) | 11-07 | `periods = createWorkPeriodContext()` einmal je Export, außerhalb aller Schleifen (auch außerhalb der Nutzerschleife); `fullUser` war bereits ein vollständiges `UserPublic` aus `getUserById()` | ✓ |

### Wörtliche grep-Ausgabe (Stand nach Task 1–3, `cd server`)

```
$ grep -n "getDailyTargetHours(\|calculateAbsenceHoursWithWorkSchedule(" src/services/absenceService.ts src/services/exportService.ts
src/services/absenceService.ts:364:      const calculatedHours = calculateAbsenceHoursWithWorkSchedule(
src/services/absenceService.ts:828:    const actualHoursRequired = calculateAbsenceHoursWithWorkSchedule(
src/services/absenceService.ts:902:    const hoursToDeduct = calculateAbsenceHoursWithWorkSchedule(
src/services/absenceService.ts:1193: * Iterates through each working day and sums getDailyTargetHours()
src/services/absenceService.ts:1236:    const dailyHours = getDailyTargetHours(user, d, periods);
src/services/exportService.ts:101:        // CRITICAL: Use getDailyTargetHours() to respect individual work schedules
src/services/exportService.ts:103:        const dailyTargetHours = getDailyTargetHours(fullUser, entry.date, periods);
```

Fünf tatsächliche Aufrufe (364, 828, 902, 1236, 1236-Kommentar ausgenommen, 103) — deckungsgleich
mit den fünf Fundstellen der Tabelle oben (`absenceService.ts` 360/791/863/1195, `exportService.ts` 98).

```
$ cd server && npx tsc --noEmit 2>&1 | grep -E "services/absenceService.ts|services/exportService.ts"
(keine Ausgabe — beide Dateien fehlerfrei)
```

```
$ cd server && npx vitest run 2>&1 | tail -5
Test Files  2 failed | 25 passed (27)
     Tests  3 failed | 370 passed (373)
```

Die 3 Fehlschläge sind exakt die vorbestehenden (2× `unifiedOvertimeService.test.ts`, 1×
`vacationBackfillService.test.ts`, s. `.continue-here.md`) — kein neuer roter Test durch
Plan 11-07.

---

## NICHT in Plan 11-07 — Disposition wiederholt, ausdrücklich NICHT abgehakt

Diese vier Zeilen betreffen `countWorkingDaysForUser(...)`, das Urlaubs**tage** zählt, keine
Sollstunden — laut Haupttabelle explizit außerhalb des Umfangs von Plan 11-07 (und ganz Phase
11).

| Fundstelle | Funktion/Kontext | Produktivpfad | Zuständiger Plan | Disposition | ✓ |
|---|---|---|---|---|---|
| `server/src/services/absenceService.ts:464` | `countWorkingDaysForUser(...)` — zählt Urlaubstage, keine Sollstunden | ja (Teil des Urlaubsantrags-Wegs) | — (in Phase 11 unverändert) | **In Phase 11 unverändert.** Ein Urlaubsantrag über einen Stichtag hinweg ist laut `13-CONTEXT.md` D3 in Phase 12/14 zu bewerten, nicht hier | — |
| `server/src/services/absenceService.ts:472` | `countWorkingDaysForUser(...)` — wie oben | ja | — (in Phase 11 unverändert) | wie oben | — |
| `server/src/services/absenceService.ts:697` | `countWorkingDaysForUser(...)` — wie oben | ja | — (in Phase 11 unverändert) | wie oben | — |
| `server/src/services/absenceService.ts:700` | `countWorkingDaysForUser(...)` — wie oben | ja | — (in Phase 11 unverändert) | wie oben | — |

---

## Zusatzfund (Deviation, dokumentiert): Testfixture in `absenceVacationBooking.test.ts`

Nicht Teil der Aufrufer-Checkliste (keine `getDailyTargetHours`/
`calculateAbsenceHoursWithWorkSchedule`-Fundstelle), aber eine direkte Folge der Umstellung
von Task 1: `beforeEach` legte Testnutzer per rohem `INSERT INTO users` an, ohne über
`createUser()` zu laufen — und damit ohne Arbeitszeitperiode. Nach Task 1 wirft
`calculateAbsenceCredits` für diese Nutzer `MissingWorkPeriodError` (D4, Plan 11-04). Fix:
`ensureInitialWorkPeriod()` (bereits vorhanden in `userService.ts`) im `beforeEach` ergänzt.
Rule 1 (Bugfix, direkt durch die Task-1-Änderung ausgelöst) — Details in `11-07-SUMMARY.md`.
