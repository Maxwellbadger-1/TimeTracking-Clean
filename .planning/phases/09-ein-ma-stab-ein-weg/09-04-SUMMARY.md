---
phase: 09-ein-ma-stab-ein-weg
plan: 04
subsystem: overtime-calculation
tags: [overtime, tdd, sqlite, absence, req-19]

# Dependency graph
requires:
  - phase: 09-01
    provides: "REQ-19-Kernbefund (Hypothese), 09-PRUEFNUTZER.csv (Nutzer C)"
  - phase: 09-02
    provides: "npm run validate:overtime:paths (D3-Werkzeug), Guard-Muster aus compareOvertimePaths.ts"
  - phase: 09-03
    provides: "09-ANGLEICHUNG-NACHWEIS.md als Regressionsgrenze (204/207 Tests), Angleichung von overtimeService.ts/overtimeLiveCalculationService.ts auf getDailyTargetHours()"
provides:
  - "server/src/scripts/reproduceOvertimeCompDefect.ts: lesendes Reproduktionswerkzeug fuer den REQ-19-Defekt, Produktions-Guard auf Modulebene, npm run repro:overtime-comp"
  - "09-REQ19-BEFUND.md: Reproduktion, Hypothesenpruefung (H1/H2/H3), Ursache mit datei:zeile, D2-Entscheidung (Zweig A), Ergebnis mit Vorher/Nachher-Zahlen"
  - "unifiedOvertimeService.ts + overtimeTransactionRebuildService.ts: overtime_comp senkt den Saldo um die Sollstunden des Ausgleichstags statt saldoneutral zu bleiben"
  - "deferred-items.md: pre-existierende, vom Fix unabhaengige targetHours-Abweichung in overtimeTransactionRebuildService.ts dokumentiert, nicht behoben"
affects: [11-datumsabhaengige-berechnung, 12-stundenwechsel-bedienen, 14-legacy-rueckbau]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reproduktionsskript vergleicht die absenceCredit-Summe der betroffenen Tage statt des gespeicherten overtime_balance-Werts, weil die Datenbankzeile nur beim naechsten Schreibpfad aktualisiert wird - das Skript bleibt dadurch lesend (D5) und trotzdem aussagekraeftig."
    - "Gegenprobe per git checkout -- <eine Datei> + Wegwerfkopie der DB, um zu belegen, dass ein Nebenbefund pre-existierend und nicht durch die eigene Aenderung verursacht ist (statt die Behauptung unbelegt zu lassen)."

key-files:
  created:
    - server/src/scripts/reproduceOvertimeCompDefect.ts
    - .planning/phases/09-ein-ma-stab-ein-weg/09-REQ19-BEFUND.md
    - .planning/phases/09-ein-ma-stab-ein-weg/deferred-items.md
  modified:
    - server/package.json
    - server/src/services/unifiedOvertimeService.ts
    - server/src/services/unifiedOvertimeService.test.ts
    - server/src/services/overtimeTransactionRebuildService.ts

key-decisions:
  - "Zweig A gewaehlt (Fix in Phase 9): 2 Services betroffen (unifiedOvertimeService.ts, overtimeTransactionRebuildService.ts), keine Datenmigration noetig, weil overtime_balance bei jedem Dashboard-/Berichtsaufruf ueber ensureOvertimeBalanceEntries() ohnehin vollstaendig neu berechnet wird (self-heal)."
  - "Beide Services mussten geaendert werden, nicht nur unifiedOvertimeService.ts: updateMonthlyOvertime() schreibt overtime_balance zweimal nacheinander (erst unifiedOvertimeService-UPSERT, dann rebuildOvertimeTransactionsForMonth-UPSERT); der zweite Schreibvorgang haette den Fix im ersten sonst wieder ueberschrieben."
  - "Pre-existierende, vom Fix unabhaengige targetHours-Abweichung in overtimeTransactionRebuildService.ts (36h statt 40h fuer Nutzer C) per Gegenprobe (git checkout -- <Datei> auf den Vorzustand, Wegwerfkopie der DB) als bereits vorher vorhanden verifiziert und in deferred-items.md dokumentiert statt im Rahmen von REQ-19 mitbehoben - ausserhalb des Scopes, betrifft nicht den ueber GET /api/overtime/:userId angezeigten Saldo."

requirements-completed: [REQ-19]

# Metrics
duration: ~50min
completed: 2026-08-21
---

# Phase 9 Plan 4: Ein Maßstab, ein Weg - REQ-19-Klärung Summary

**overtime_comp-Ausgleichstage senken den Überstundensaldo jetzt nachweislich um ihre Sollstunden (Nutzer C: -3,83h → -7,83h) statt saldoneutral zu bleiben — Ursache in zwei unabhängigen, strukturgleichen Kreditlogiken belegt und in beiden Services behoben, keine Datenmigration nötig.**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-21
- **Tasks:** 3 (Task 3 als TDD: RED → GREEN)
- **Files modified:** 7 (3 neu erstellt, 4 geändert)

## Accomplishments

- **Task 1:** `server/src/scripts/reproduceOvertimeCompDefect.ts` angelegt — liest für einen
  Nutzer/Monat Stammdaten, genehmigte `overtime_comp`-Anträge, den erwarteten Abzug
  (Sollstunden über `calculateAbsenceHoursWithWorkSchedule()`), `overtime_transactions` je Typ,
  die `overtime_balance`-Zeile, das `unifiedOvertimeService`-Breakdown je Tag und Monat, und
  stellt erwarteten gegen tatsächlichen Saldo gegenüber. Produktions-Guard exakt nach dem
  Muster aus `compareOvertimePaths.ts`: `assertNotProduction()` synchron auf Modulebene, nur
  import-sichere Module am Dateikopf, Service-Module erst per `await import()` in `main()`.
  Kanarienprobe verifiziert: Exit 2, kein angelegtes Verzeichnis. Realer Lauf gegen Nutzer C
  (Carmen Rothemund, `userId 17`, Monat `2026-04`): Exit 1 — der genehmigte Antrag (`id=56`,
  13.04.2026, 4h) erreichte den Saldo nicht.
- **Task 2:** `09-REQ19-BEFUND.md` erstellt. Alle drei Hypothesen aus Plan 09-01 geprüft: H1
  (Gutschrift neutralisiert den Tag, `unifiedOvertimeService.ts:336-346`) bestätigt und als
  Ursache identifiziert; H2 (Buchung in totem Konto, `overtimeTransactionService.ts:114-129/
  406-419`) bestätigt, aber nicht ursächlich für den Zahlenunterschied; H3 (direkter Abzug wird
  überschrieben, `absenceService.ts:832→850`) bestätigt und als Mechanismus beschrieben, durch
  den der überschreibende zweite Schreibvorgang zustande kommt. Als eigentliche Ursache
  identifiziert: `updateMonthlyOvertime()` schreibt `overtime_balance` zweimal nacheinander —
  einmal über `unifiedOvertimeService.calculateMonthlyOvertime()`, einmal über
  `rebuildOvertimeTransactionsForMonth()` → `updateOvertimeBalanceForMonth()` — beide mit einer
  eigenen, strukturgleichen Kreditlogik, die `overtime_comp` wie `vacation`/`sick` behandelt.
  D2-Entscheidung: Zweig A, 2 Services, keine Datenmigration (Selbstheilung über
  `ensureOvertimeBalanceEntries()`, die bei jedem Dashboard-/Berichtsaufruf läuft). Nebenwirkung
  lesend ermittelt: 3 Nutzer mit genehmigtem `overtime_comp`-Antrag in
  `server/database/development.db`.
- **Task 3 (Zweig A, TDD):** RED-Test in `unifiedOvertimeService.test.ts` belegt das
  Sollverhalten aus dem Plan-Interfaces-Block. Fix in `unifiedOvertimeService.ts:336-353`
  (`getAbsenceCredit`, `overtime_comp` aus der Kreditliste entfernt) UND in
  `overtimeTransactionRebuildService.ts` (`updateOvertimeBalanceForMonth`,
  `handleAbsenceDay`, `calculateRunningBalanceAfterAbsence`) — beide Stellen waren nötig, weil
  der zweite Schreibvorgang den ersten sonst unverändert überschrieben hätte. GREEN bestätigt:
  Reproduktion Exit 1 → Exit 0, `validate:overtime:paths` gegen alle drei Prüfnutzer Exit 0
  (Nutzer C: `-3,83h → -7,83h`, exakt die erwarteten 4h), 206/209 Tests bestanden (vorher
  204/207, dieselben drei bekannten, unabhängigen Fehlschläge), `npx tsc --noEmit` ohne Fehler.
  Ein pre-existierender, vom Fix unabhängiger Nebenbefund (abweichende `targetHours`-Summe in
  `overtimeTransactionRebuildService.ts` bei erneutem Aufruf von `updateMonthlyOvertime()`) per
  Gegenprobe (Code-Rücksetzung + Wegwerfkopie der DB) als bereits vor dem Fix vorhanden
  verifiziert und in `deferred-items.md` dokumentiert, nicht behoben — betrifft nicht den über
  `GET /api/overtime/:userId` angezeigten Saldo, da dieser ausschließlich über
  `ensureOvertimeBalanceEntries()` (nur `unifiedOvertimeService`-Pfad) läuft.

## Task Commits

1. **Task 1: Defekt an einem realen Nutzer reproduzieren** - `0276de5` (feat)
2. **Task 2: Ursache belegen und die Entscheidung nach D2 treffen** - `040ba44` (docs)
3. **Task 3: Entscheidung ausführen — RED** - `7c7e0c9` (test)
3. **Task 3: Entscheidung ausführen — GREEN** - `608b62e` (feat)

**Plan metadata:** wird mit diesem Commit erstellt (siehe unten)

_Hinweis: Task 3 hat zwei Commits (TDD RED/GREEN) — beide sind für sich abgeschlossene,
verifizierbare Zustände._

## Files Created/Modified

- `server/src/scripts/reproduceOvertimeCompDefect.ts` - lesendes Reproduktionswerkzeug,
  Produktions-Guard, acht Erhebungspunkte, Exit-Code als Reproduktionsnachweis
- `server/package.json` - neues Skript `repro:overtime-comp`
- `.planning/phases/09-ein-ma-stab-ein-weg/09-REQ19-BEFUND.md` - Reproduktion,
  Hypothesenprüfung, Ursache, D2-Entscheidung, Nebenwirkung, Ergebnis Zweig A
- `server/src/services/unifiedOvertimeService.ts` - `getAbsenceCredit()`: `overtime_comp`
  nicht mehr kreditiert
- `server/src/services/unifiedOvertimeService.test.ts` - zwei neue Testfälle (REQ-19-Sollwert,
  vacation/sick-Regressionsgrenze)
- `server/src/services/overtimeTransactionRebuildService.ts` - `updateOvertimeBalanceForMonth`,
  `handleAbsenceDay`, `calculateRunningBalanceAfterAbsence`: dieselbe Ausnahme für
  `overtime_comp`
- `.planning/phases/09-ein-ma-stab-ein-weg/deferred-items.md` - pre-existierender, unabhängiger
  Nebenbefund dokumentiert (nicht behoben)

## Decisions Made

- Zweig A statt Zweig B: 2 Services, keine Datenmigration (self-heal über
  `ensureOvertimeBalanceEntries()`).
- Beide Services mussten geändert werden — nicht nur `unifiedOvertimeService.ts` —, weil
  `updateMonthlyOvertime()` `overtime_balance` zweimal nacheinander schreibt und der zweite
  Schreibvorgang den ersten sonst überschrieben hätte.
- Reproduktionsskript vergleicht die `absenceCredit`-Summe der Ausgleichstage statt des
  gespeicherten `overtime_balance`-Werts, um lesend (D5) zu bleiben und trotzdem den Defekt
  unabhängig vom zuletzt gelaufenen Schreibpfad zuverlässig zu erkennen.
- Pre-existierender Nebenbefund (`targetHours`-Abweichung in `overtimeTransactionRebuildService.ts`)
  per Gegenprobe (Code-Rücksetzung auf eine Wegwerfkopie) als nicht durch diesen Plan verursacht
  verifiziert, dokumentiert statt mitbehoben — außerhalb des REQ-19-Scopes.

## Deviations from Plan

### Auto-fixed Issues

Keine Rule-1/2/3-Auto-Fixes im engeren Sinne — dieser Plan hat wie vorgesehen den REQ-19-Defekt
untersucht und behoben. Eine dokumentierte Erweiterung des Umsetzungsumfangs innerhalb von
Task 3, die sich erst während der Verifikation als notwendig erwies:

**1. [Rule 1 - Bug, im Rahmen von Task 3 entdeckt] Fix in `unifiedOvertimeService.ts` allein
hätte den angezeigten Saldo nicht korrigiert**
- **Gefunden während:** Task 3, End-zu-Ende-Verifikation gegen eine Wegwerfkopie der
  Datenbank direkt nach dem ersten Teilfix.
- **Issue:** `updateMonthlyOvertime()` überschreibt `overtime_balance` nach dem
  `unifiedOvertimeService`-UPSERT sofort ein zweites Mal über
  `rebuildOvertimeTransactionsForMonth()` → `updateOvertimeBalanceForMonth()` — mit einer
  eigenen, unabhängigen Kreditlogik, die denselben H1-Fehler enthielt. Ein Fix nur in
  `unifiedOvertimeService.ts` hätte für den `unified`-Berechnungsweg funktioniert, aber der
  zweite Schreibvorgang hätte den korrekten Wert sofort wieder überschrieben, sobald
  `updateMonthlyOvertime()` läuft (z. B. nach einer Abwesenheitsgenehmigung).
- **Fix:** `overtimeTransactionRebuildService.ts` (`updateOvertimeBalanceForMonth`,
  `handleAbsenceDay`, `calculateRunningBalanceAfterAbsence`) erhielt dieselbe Ausnahme für
  `overtime_comp` — bereits in der D2-Entscheidung aus Task 2 als „2 Services" vorgesehen, hier
  umgesetzt und verifiziert.
- **Verifikation:** Gegenprobe mit `git checkout -- <Datei>` auf den unfixierten Stand gegen
  eine Wegwerfkopie der Datenbank bestätigte den überschreibenden Effekt; nach dem Fix in
  beiden Dateien liefert `validate:overtime:paths` für alle fünf Wege (inkl. `balance_row`)
  übereinstimmend `-7,83h`.
- **Committed in:** `608b62e`

---

**Total deviations:** 0 unerwartete Rule-1-4-Fixes — die Notwendigkeit, beide Services zu
ändern, war bereits Teil der D2-Entscheidung aus Task 2 (09-REQ19-BEFUND.md, Abschnitt
„Entscheidung nach D2", Punkt (a)) und wurde in Task 3 wie geplant umgesetzt, nicht nachträglich
entdeckt und improvisiert.
**Impact on plan:** Keine Abweichung von den Akzeptanzkriterien.

## Issues Encountered

- Pre-existierende, vom REQ-19-Fix unabhängige `targetHours`-Abweichung in
  `overtimeTransactionRebuildService.ts` entdeckt (36h statt 40h für Nutzer C bei einem
  erneuten Aufruf von `updateMonthlyOvertime()`). Per Gegenprobe (Code-Rücksetzung, Wegwerfkopie
  der Datenbank) als bereits vor diesem Plan vorhanden verifiziert — nicht behoben, da außerhalb
  des REQ-19-Scopes (SCOPE BOUNDARY) und ohne Einfluss auf den über
  `GET /api/overtime/:userId` angezeigten Saldo. Dokumentiert in `deferred-items.md`.

## Next Phase Readiness

- **REQ-19 abgeschlossen (behoben).** Alle vier Debug-Sessions aus Plan 09-01 haben jetzt einen
  abgeschlossenen Ausgang (drei bereits in `09-DEBUG-SICHTUNG.md`, der vierte — REQ-19 — mit
  diesem Plan).
- **Phase 12 (Stundenwechsel bedienen):** Salden werden jetzt korrekt für `overtime_comp`
  berechnet — relevant für die Korrektheit von Salden zum Umstellungsstichtag.
- **Phase 14 (Legacy-Rückbau):** `deferred-items.md` hält die pre-existierende
  `targetHours`-Diskrepanz zwischen `unifiedOvertimeService` und
  `overtimeTransactionRebuildService` als offenen Folgepunkt fest — relevant, falls
  `rebuildOvertimeTransactionsForMonth()` beim Legacy-Rückbau ohnehin überarbeitet wird.
- **Kein Blocker:** Alle drei Tasks vollständig, alle Acceptance-Criteria und
  `<verify><automated>`-Blöcke gegen den finalen Stand ausgeführt und bestanden (siehe
  Self-Check unten). `npx tsc --noEmit` grün, Serversuite ohne Regression (206/209, dieselben
  drei bekannten Fehlschläge wie vor diesem Plan).

---
*Phase: 09-ein-ma-stab-ein-weg*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `server/src/scripts/reproduceOvertimeCompDefect.ts`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-REQ19-BEFUND.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/deferred-items.md`
- FOUND: `server/src/services/unifiedOvertimeService.ts`
- FOUND: `server/src/services/unifiedOvertimeService.test.ts`
- FOUND: `server/src/services/overtimeTransactionRebuildService.ts`
- FOUND: `server/package.json`
- FOUND: commit `0276de5` (Task 1)
- FOUND: commit `040ba44` (Task 2)
- FOUND: commit `7c7e0c9` (Task 3, RED)
- FOUND: commit `608b62e` (Task 3, GREEN)
