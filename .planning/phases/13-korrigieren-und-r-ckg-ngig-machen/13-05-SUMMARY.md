---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 05
subsystem: api
tags: [express, hmac, previewtoken, authorization, work-periods]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 02)
    provides: "getWorkPeriodsWithFlags(), WorkPeriodCorrectionInput/Preview/Outcome, WorkPeriodDeletionInput/Preview/Outcome"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 03)
    provides: "correctWorkPeriod() — Korrekturdienst mit WorkPeriodCorrectionValidationError"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 04)
    provides: "deleteWorkPeriod() — Löschdienst mit WorkPeriodDeletionValidationError"
  - phase: 12-stundenwechsel-bedienen
    provides: "workTimeChangeToken.ts (PreviewTokenBinding/issuePreviewToken/verifyPreviewToken), workTimeChangePreviewLimiter, das Router-/Fehlerübersetzungsmuster in workPeriods.ts"
provides:
  - "Vier neue admin-geschützte Endpunkte: POST /:id/correct/preview, PUT /:id, POST /:id/delete/preview, DELETE /:id — getrennte Pfade statt eines mode-Parameters (D1)"
  - "Getrennte, gegenseitig nicht einlösbare Vorschau-Token für Korrektur und Löschung (issueCorrectionPreviewToken/verifyCorrectionPreviewToken, issueDeletionPreviewToken/verifyDeletionPreviewToken)"
  - "GET /api/work-periods liefert jetzt isFirst/isCurrent serverseitig mit (getWorkPeriodsWithFlags)"
  - "HTTP-Autorisierungsnachweis (D5): ein Mitarbeiter bekommt auf jedem der fünf Perioden-Endpunkte eines fremden Nutzers 403, belegt über echtes HTTP, nicht über Service-Aufruf"
affects: [13-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "signCanonical()/verifyCanonical() als gemeinsame private Hilfsfunktionen für alle drei Token-Arten (Stundenwechsel/Korrektur/Löschung) — die kanonischen Zeichenketten selbst bleiben pro Aktion getrennt und tragen ab Plan 13-05 ein Zweckfeld ('correct'/'delete'), das nie eine Zahl sein kann"
    - "Body-Typwächter statt Cast: parseWorkPeriodCorrectionBody()/parseWorkPeriodDeleteBody() nach dem Muster von parseWorkTimeChangeRequestBody() — reason/previewToken permissiv, Rechenfelder strikt mit 400 bei Fehltyp"
    - "HTTP-Autorisierungstest mit echter express-App (app.listen(0) + fetch) statt direktem Funktionsaufruf, weil nur so eine Prüfung IN DER ROUTE nachgewiesen ist (Muster aus vacationTransactionRoutes.test.ts)"

key-files:
  created:
    - server/src/routes/workPeriods.authorization.test.ts
  modified:
    - server/src/services/workTimeChangeToken.ts
    - server/src/services/workTimeChangeToken.test.ts
    - server/src/routes/workPeriods.ts

key-decisions:
  - "Fehlender/mismatch previewToken auf allen vier neuen Endpunkten führt einheitlich zu 409 mit dem wortgleichen PREVIEW_STALE-Text aus Phase 12 (DD-21) — der Desktop erkennt das Präfix bereits, keine dritte Fehlertextvariante nötig"
  - "employeeB im HTTP-Autorisierungstest bekommt zwei Perioden (nicht nur eine), damit periodB nicht die erste (nicht löschbare) Periode der Kette ist — für die hier belegte Autorisierung/Tokenkopplung nicht zwingend nötig (403/409 entstehen vor Erreichen der Service-Validierung), macht die Fixture aber realistischer und robuster gegen künftige Testerweiterungen"
  - "Token für 'eine andere Periode' im HTTP-Tokenkopplungstest über periodB.id + 999 gebildet, ohne diese Periode real anzulegen — die Prüfung schlägt bereits an der periodId-Bindung fehl, bevor der Löschdienst je aufgerufen würde, eine echte zweite Zielperiode ist für den Nachweis nicht nötig"

requirements-completed: [REQ-30, REQ-31]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 13 Plan 05: Vier neue Endpunkte, Rollenprüfung, Vorschau-Token Summary

**Vier admin-geschützte Endpunkte (`POST /:id/correct/preview`, `PUT /:id`, `POST /:id/delete/preview`, `DELETE /:id`) mit je eigener, gegenseitig nicht einlösbarer HMAC-Vorschau-Token-Bindung, plus ein HTTP-Autorisierungstest, der über echte `fetch`-Aufrufe belegt, dass ein Mitarbeiter auf keinem der fünf Perioden-Endpunkte an fremde Daten kommt.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (1 neu, 3 geändert)

## Accomplishments

- `workTimeChangeToken.ts` um `CorrectionPreviewTokenBinding`/`issueCorrectionPreviewToken`/`verifyCorrectionPreviewToken` und `DeletionPreviewTokenBinding`/`issueDeletionPreviewToken`/`verifyDeletionPreviewToken` erweitert (DD-20). Die gemeinsame Signatur-/Prüfmechanik wurde in zwei private Hilfsfunktionen `signCanonical()`/`verifyCanonical()` gezogen; die bestehende Stundenwechsel-Bahn (`issuePreviewToken`/`verifyPreviewToken`) ruft dieselben Hilfsfunktionen jetzt auf, ihre kanonische Zeichenkette blieb dabei **wortgleich unverändert** — Phase 12 läuft exakt gleich weiter (alle 14 Bestandstests weiterhin grün).
- Die beiden neuen kanonischen Zeichenketten tragen an zweiter Stelle ein Zweckfeld (`'correct'`/`'delete'`), das nie eine Zahl sein kann — dadurch ist keine der drei Token-Arten in eine andere umdeutbar (10 neue Tests belegen das in beide Richtungen, plus fremder `adminId`/`periodId` und Ablauf nach 15 Minuten).
- `workPeriods.ts` bekam vier neue Routen nach DD-19: `POST /:id/correct/preview` und `POST /:id/delete/preview` mit `workTimeChangePreviewLimiter` VOR `requireAuth`/`requireAdmin` (echte Schreib-Rebuilds, kein billiger Lesezugriff), `PUT /:id` und `DELETE /:id` mit `requireAuth`/`requireAdmin`. Getrennte Pfade statt eines `mode`-Parameters (D1) — die Trennung von „korrigieren" und „löschen" ist damit auch im Router sichtbar.
- `GET /api/work-periods` liefert jetzt `getWorkPeriodsWithFlags()` statt `getWorkPeriods()` (DD-23) — `isFirst`/`isCurrent` kommen serverseitig berechnet mit, der Desktop muss sie nicht mehr selbst nachrechnen.
- Zwei neue Typwächter (`parseWorkPeriodCorrectionBody`, `parseWorkPeriodDeleteBody`) lesen die Anfragekörper der vier neuen Routen ohne Cast (DD-22); `:id` wird über `Number.parseInt` gelesen und bei `NaN` mit 400 abgewiesen. Fehlerübersetzung nach DD-21: `WorkPeriodCorrectionValidationError`/`WorkPeriodDeletionValidationError` → 400, `WorkPeriodConflictError` → 409, ein abgelehntes Token → 409 mit dem wortgleichen `PREVIEW_STALE`-Text aus Phase 12 — der Ablehnungsgrund selbst landet ausschließlich in `logger.warn` (WR-08-Muster, T-13-22).
- Neue Datei `workPeriods.authorization.test.ts` (13 Testfälle) belegt D5 und das vierte ROADMAP-Erfolgskriterium über echtes HTTP (`app.listen(0)` + `fetch`, nicht über direkten Funktionsaufruf): 403 für einen Mitarbeiter auf allen vier neuen Endpunkten UND auf den beiden Phase-12-Endpunkten (`POST /preview`, `POST /change` — Bestandsschutz bleibt belegt), 401 ohne Sitzung auf allen sechs Schreib-/Vorschauaufrufen, zwei Wirkungstests (`deletedAt`/`weeklyHours` nach abgelehntem Schreibversuch unverändert) und zwei Tokenkopplungstests über HTTP (fehlendes Token → 409 `PREVIEW_STALE`; Token für eine andere Periode → 409, Periode danach unverändert).
- Vollständiger Testlauf: 478 grün / 3 rot (Baseline aus 13-04-SUMMARY.md: 455/3 — die 3 roten Tests sind unverändert die bekannten Vorbestandsfehler, +23 neue grüne Tests aus diesem Plan).

## Task Commits

1. **Task 1: Getrennte Vorschau-Token für Korrektur und Löschung** - `20eae40` (feat)
2. **Task 2: Die vier neuen Endpunkte mit Rollenprüfung und Fehlerübersetzung** - `def58d2` (feat)
3. **Task 3: HTTP-Autorisierungstest — 403 für fremde Perioden mit Mitarbeiter-Sitzung** - `3ca08f2` (test)

**Plan metadata:** siehe finaler Commit dieses Plans (nach diesem SUMMARY).

## Files Created/Modified

- `server/src/services/workTimeChangeToken.ts` - `signCanonical()`/`verifyCanonical()`-Hilfsfunktionen, `CorrectionPreviewTokenBinding`/`DeletionPreviewTokenBinding` + je ein Ausstell-/Prüfpaar
- `server/src/services/workTimeChangeToken.test.ts` - 10 neue Tests (gegenseitige Nichtverwendbarkeit, fremder adminId/periodId, Ablauf)
- `server/src/routes/workPeriods.ts` - vier neue Routen, zwei neue Body-Typwächter, `GET /` auf `getWorkPeriodsWithFlags()` umgestellt
- `server/src/routes/workPeriods.authorization.test.ts` - neu, 13 HTTP-Autorisierungstests

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

Keine — die drei Fixerkategorien (Rule 1/2/3) kamen in diesem Plan nicht zum Einsatz.

### Sonstige Abweichungen (informativ, kein Verhaltensunterschied)

**1. Zwei Acceptance-Grep-Zählungen aus dem Plantext treffen nicht exakt, ohne dass die zugrunde liegende Zusicherung verletzt ist**
- **`grep -c "requireAdmin" server/src/routes/workPeriods.ts` liefert 8, nicht die im Plantext genannten 6.** Ursache: der Plantext zählte nur die sechs Middleware-Einsatzstellen (2 aus Phase 12 + 4 neue), tatsächlich trifft der Grep zusätzlich die Import-Zeile und eine Stelle im neuen Kopfkommentar dieses Plans, der die vier neuen Endpunkte beschreibt. Die geforderte Zusicherung selbst — „requireAdmin auf allen sechs Schreib-/Vorschau-Routen" — ist erfüllt (per `grep -n` einzeln nachgewiesen: Zeilen 287, 339, 434, 496, 587, 634).
- **`router.put('/:id'`/`router.delete('/:id'` als Ein-Zeilen-Literal aus dem Plantext trifft nicht.** Der Router-Aufruf ist wie bei allen bestehenden Routen dieser Datei (z. B. `router.post(\n '/preview',`) über mehrere Zeilen formatiert (`router.put(\n '/:id',`) — bestehender Dateistil, kein Abweichen vom Muster. Per `grep -n "router\.\(get\|post\|put\|delete\)"` sind alle sieben Registrierungen (1× GET, 6× Schreib-/Vorschau) einzeln nachgewiesen.
- **Files modified:** keine — reine Beobachtung zur Interpretation der Acceptance-Kriterien, keine Codeänderung ausgelöst.
- **Verification:** Beide Zusicherungen (requireAdmin auf allen sechs Nicht-GET-Routen, alle sieben Routenregistrierungen vorhanden) einzeln per `grep -n` nachgewiesen, siehe Verifikationsabschnitt unten.

---

**Total deviations:** 0 Rule-1/2/3-Fixes, 2 dokumentierte Diskrepanzen zwischen der wörtlichen Acceptance-Grep-Formulierung im Plantext und dem tatsächlichen (unveränderten Datei-)Stil — keine davon berührt die materielle Zusicherung des jeweiligen Kriteriums.
**Impact on plan:** Kein Einfluss auf Funktion, Sicherheit oder Testabdeckung.

## Issues Encountered

Ein TypeScript-Namenskonflikt beim Schreiben von `workPeriods.authorization.test.ts`: Der benannte Import `Response` aus `express` überschattete den globalen `fetch`-`Response`-Typ, den `sendJson()` als Rückgabetyp nutzt. Behoben durch Umbenennung auf `Response as ExpressResponse` beim Import — kein Verhaltensunterschied, reine Typkollision beim Schreiben des Tests (kein Deviation-Fall, da vor dem ersten Commit entdeckt und behoben).

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten, keine Migration in diesem Plan.

## Next Phase Readiness

- Plan 13-10 (Oberfläche) kann die vier neuen Endpunkte direkt verdrahten — Vorschau-Routen liefern `{ ...preview, previewToken }`, die Speicher-Routen verlangen exakt dieses Token zurück. Die 403-Toast-Unterdrückung in `desktop/src/api/client.ts` (`endpoint.startsWith('/work-periods')`) greift automatisch, da alle vier Endpunkte unter `/work-periods` liegen — keine Änderung an dieser Datei nötig (DD-19).
- `GET /api/work-periods` liefert jetzt `UserWorkPeriodListItem[]` (mit `isFirst`/`isCurrent`) statt `UserWorkPeriod[]` — ein Desktop-Client, der diese Route bereits konsumiert, sollte vor dem nächsten Release geprüft werden, ob er die beiden neuen Felder ignoriert (additiv, keine bestehenden Felder entfernt) oder erwartet.
- Alle drei Schreibwege der Phase (Korrigieren, Löschen, Umstellen aus Phase 12) sind jetzt über eigene, admin-geschützte HTTP-Endpunkte mit eigener Vorschau-Token-Bindung erreichbar — kein gemeinsamer Endpunkt mit Modus-Flag entstanden (D1 durchgängig eingehalten).

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Datei `server/src/routes/workPeriods.authorization.test.ts` verifiziert vorhanden. Alle drei
Commit-Hashes (`20eae40`, `def58d2`, `3ca08f2`) in `git log --oneline --all` verifiziert (siehe
Bash-Ausgabe unten). `server/src/services/workTimeChangeToken.ts` enthält `export function
issueCorrectionPreviewToken`, `export function verifyCorrectionPreviewToken`, `export function
issueDeletionPreviewToken`, `export function verifyDeletionPreviewToken` (4 Treffer). `npx tsc
--noEmit` Exit 0. `npx vitest run` — 478 grün / 3 rot (Baseline aus 13-04-SUMMARY.md: 455/3,
unverändert — 2× unifiedOvertimeService.test.ts, 1× vacationBackfillService.test.ts).
