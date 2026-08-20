---
phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
plan: 04
subsystem: api
tags: [express, sqlite, deploy, react, tanstack-query, tauri]

# Dependency graph
requires:
  - phase: 08-01/08-02/08-03
    provides: "Journal-Endpunkt mit Rollenprüfung, Kontoauszug-Komponente, Pflichtbegründung im Admin-Dialog"
provides:
  - "Server in Produktion aktuell — Journal-Endpunkt live und mit 401 abgesichert"
  - "Saldo-Kette im Kontoauszug bleibt bei rückdatierten Buchungen konsistent (createdAt-Sortierung statt date-Sortierung)"
  - "Kontoauszug als Tab in AbsencesPage, Storno-Paar-Hervorhebung, reduziertes visuelles Rauschen"
  - "Anwender-Abnahme gegen echte Produktionsdaten erteilt — Phase 8 releasefähig"
affects: [08-05]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Anzeige-Sortierung (createdAt DESC für den Auszug) von fachlicher Sortierung (date ASC für den Konsistenzprüfer) bewusst getrennt halten, wenn beide auf demselben balanceAfter-Feld aufbauen"
    - "DATABASE_PATH muss in jedem produktionsdatenbank-berührenden Skript und Workflow-Schritt explizit gesetzt werden — der Symlink server/database.db existiert auf dem Server seit 20.08.2026 nicht mehr"

key-files:
  created: []
  modified:
    - CHANGELOG.md
    - .github/workflows/deploy-server.yml
    - server/scripts/migrate.ts
    - server/scripts/validateSchema.ts
    - server/src/services/vacationTransactionService.ts
    - server/src/services/vacationTransactionService.test.ts
    - desktop/src/components/vacation/VacationTransactions.tsx
    - desktop/src/pages/AbsencesPage.tsx
    - desktop/src/services/notificationService.ts
    - .planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/deferred-items.md

key-decisions:
  - "getVacationJournalEntries sortiert jetzt createdAt DESC, id DESC (Anzeige); getVacationTransactions bleibt bei date ASC, weil der Konsistenzprüfer aus Phase 7 die fachliche Chronologie braucht"
  - "Kontoauszug als Tab in AbsencesPage statt eigener Sidebar-Eintrag — der Auszug ist die Erklärung zu einer Zahl innerhalb der Abwesenheiten, kein eigener Tätigkeitsbereich"
  - "Buchungszeitpunkt im Auszug nur anzeigen, wenn er sich von der Zeile darüber unterscheidet — Backfill-Zeilen mit identischem Zeitstempel erzeugten sonst reine Wiederholung"
  - "Notification-Plugin steigt still aus, wenn __TAURI_INTERNALS__ fehlt — Browser-Dev-Modus hat keine Tauri-Bridge, ist aber kein Fehlerzustand"

patterns-established: []

requirements-completed: [REQ-11, REQ-12, REQ-13, REQ-14]

# Metrics
duration: 1h 41min (inkl. Wartezeit auf Anwender-Abnahme in Task 3)
completed: 2026-08-20
---

# Phase 08 Plan 04: Qualitätstor, Server-Deployment und Abnahme Summary

**Server mit Journal-Endpunkt in Produktion, ein während der Abnahme gefundener Saldo-Kettenbruch bei rückdatierten Buchungen behoben, Auszug lesbarer gemacht — Anwender hat alle sieben Abnahmepunkte gegen echte Produktionsdaten freigegeben.**

## Performance

- **Duration:** 1h 41min (Task 1 Start 21:12 Uhr bis SUMMARY-Erstellung 22:53 Uhr; darin enthalten die Wartezeit auf die manuelle Abnahme durch den Anwender in Task 3, keine durchgehende Ausführungszeit)
- **Started:** 2026-08-20T21:12:18+02:00
- **Completed:** 2026-08-20T22:53:00+02:00
- **Tasks:** 3/3 (Task 3 = Checkpoint, vom Anwender freigegeben)
- **Files modified:** 10 (über 5 Commits: Qualitätstor/Changelog, 2× Deploy-Fix, Saldo-Fix, Lesbarkeits-Verbesserungen, phasenfremder Notification-Fix)

## Accomplishments

- Qualitätstor: `tsc --noEmit` für Server und Desktop grün, gezielte Tests grün, Changelog-Eintrag zum Kontoauszug
- Server in Produktion deployed — Journal-Endpunkt live, `/api/vacation-transactions` und `/api/vacation-balances/1` je `401` ohne Anmeldung
- Anwender-Abnahme aller sieben Prüfpunkte gegen echte, per `npm run sync-dev-db` synchronisierte Produktionsdaten — **freigegeben**
- Während der Abnahme gefundener Saldo-Kettenbruch bei rückdatierten Buchungen behoben und mit Regressionstest abgesichert
- Vier vom Anwender ausgewählte Lesbarkeits-Verbesserungen am Auszug umgesetzt
- Fixes nach Produktion nachgezogen: `git push origin main`, Deploy erfolgreich, alle vier Verifikationsschritte bestanden

## Task Commits

Each task was committed atomically:

1. **Task 1: Qualitätstor und Changelog** - `ea3cb52` (docs)
2. **Task 2: Server nach Produktion deployen** - Deployment lief zunächst gegen einen bereits gepushten Stand; zwei Nachbesserungen während der Ausführung:
   - `736ea1b` (fix) — `DATABASE_PATH` fehlte in `deploy-server.yml`
   - `a6d002d` (fix) — `migrate.ts`/`validateSchema.ts` ignorierten `DATABASE_PATH`
3. **Task 3: Abnahme** - Checkpoint, vom Anwender mit „freigegeben" beantwortet. Dabei entstanden drei weitere Commits (siehe Deviations):
   - `8af5e3f` (fix) — Saldo-Kette im Kontoauszug
   - `3f6ac5f` (feat) — Lesbarkeits-Verbesserungen
   - `7b75765` (fix) — Notification-Plugin nur in der Tauri-Hülle (phasenfremd)

**Nach der Freigabe (dieser Fortsetzungslauf):** `git push origin main` (a6d002d..7b75765), Deploy-Workflow-Run `32415998514` erfolgreich, alle vier Produktionsprüfungen bestanden.

## Files Created/Modified

- `CHANGELOG.md` — Added-Eintrag zum Kontoauszug, Fixed-Eintrag zu `vacation-balances/:userId`
- `.github/workflows/deploy-server.yml` — `DATABASE_PATH` wird nach dem Checkout exportiert und an jeden produktionsdatenbank-berührenden Schritt weitergereicht
- `server/scripts/migrate.ts` — respektiert jetzt `DATABASE_PATH` statt hartkodierter `productionPath`/`developmentPath`
- `server/scripts/validateSchema.ts` — Kopierfehler behoben, der in beiden `NODE_ENV`-Zweigen denselben hartkodierten Pfad nutzte
- `server/src/services/vacationTransactionService.ts` — `getVacationJournalEntries` sortiert jetzt `createdAt DESC, id DESC`; `getVacationTransactions` unverändert bei `date ASC`
- `server/src/services/vacationTransactionService.test.ts` — `referenceId: 61` durch `absenceId`-Fixture ersetzt (Testisolation), neuer Regressionstest für rückdatierte Buchungen
- `desktop/src/components/vacation/VacationTransactions.tsx` — Storno-Paar-Hervorhebung bei Hover auf „Antrag #…", Buchungszeitpunkt nur bei Abweichung zur Vorzeile, `(rückwirkend erzeugt)` ausgeblendet, deutsche Datumsformatierung
- `desktop/src/pages/AbsencesPage.tsx` — Tabs „Anträge"/„Kontoauszug" statt Auszug über der Antragsliste
- `desktop/src/services/notificationService.ts` — `checkPermission()`/`send()` steigen still aus ohne `__TAURI_INTERNALS__`
- `.planning/phases/08-kontoauszug-f-r-mitarbeiter-und-admin/deferred-items.md` — zwei neue Befunde aus der Abnahme ergänzt

## Decisions Made

- Anzeige-Sortierung des Auszugs (`createdAt DESC`) bewusst von der fachlichen Sortierung des Konsistenzprüfers (`date ASC`) getrennt — beide lesen denselben `balanceAfter`, dürfen ihn aber nicht in derselben Reihenfolge konsumieren
- Kontoauszug als Tab statt eigener Sidebar-Eintrag — bewusste UX-Entscheidung des Anwenders während der Abnahme
- Mindestlänge/Trennlogik für Buchungszeitpunkt-Anzeige: nur bei Abweichung zur Vorzeile, um Backfill-Wiederholung zu vermeiden
- Notification-Plugin defensiv gegen fehlende Tauri-Bridge — kein Verhaltensunterschied in der ausgelieferten Desktop-App

## Deviations from Plan

### Planfehler (nicht auto-fixbar, dokumentiert statt korrigiert)

**1. Task 3 empfahl `/promote-to-prod` als Weg zur Abnahme — das ist falsch**
- **Gefunden bei:** Vorbereitung von Task 3
- **Problem:** `/promote-to-prod` merged `staging` → `main` und deployt; es schaltet die Desktop-App nicht auf Produktion um. Ausgeführt hätte es entweder am Pre-Flight-Check abgebrochen oder unbeteiligten staging-Code nach Produktion geschoben. Ein Umschalter der App-URL auf Produktion existiert nicht — `/dev` zeigt auf localhost, `/green` auf Staging (Port 3001).
- **Tatsächlicher Weg:** Abnahme lief stattdessen lokal über `npm run sync-dev-db` gegen den lokalen Dev-Server mit einer frischen Kopie der Produktionsdaten.
- **Keine Code-Änderung nötig** — reiner Ausführungsweg-Wechsel, im SUMMARY dokumentiert, damit künftige Pläne `/promote-to-prod` nicht wieder als Abnahme-Weg vorschlagen.

**2. Erwartungswert „Gesamt Verbleibend 2026 = 98 Tage" aus Phase 7 war überholt**
- **Gefunden bei:** Abnahmeschritt 7
- **Problem:** Aktueller Wert ist 112, nicht 98. Ursache: 142,5 Journal-Summe minus zwei weichgelöschte Testnutzer (4 + 25,5 Tage) ergibt 113, minus die vom Anwender in Schritt 4 gebuchte und dort bereits erwartete −1-Korrektur ergibt 112. Der Testnutzer „Test Urlaub" (id 30) entstand am 20.08. während der Phase-6/7-Abnahme und war im ursprünglichen 98er-Wert noch nicht enthalten.
- **Keine Code-Änderung** — der Plan-Erwartungswert war schlicht durch nachträgliche Testdaten überholt; die Abweichung wurde vom Anwender im Rahmen der Freigabe akzeptiert.

### Auto-fixed Issues

**1. [Rule 1 - Bug] Saldo-Kette im Kontoauszug bricht bei rückdatierten Buchungen**
- **Found during:** Task 3 (Abnahme, Schritt 2 — Carmens Auszug)
- **Issue:** `getVacationJournalEntries` sortierte nach fachlichem Datum (`date ASC, id ASC`), zeigte aber den in Erzeugungsreihenfolge fortgeschriebenen `balanceAfter`. Bei „Test Urlaub" las die Saldo-Spalte 20 → 15 → 14 → 15 → 20 und endete auf 20, während die Kopfzeile 14 Tage auswies — ein Widerspruch in derselben Ansicht. Verletzte zwei must_haves dieses Plans direkt („Saldo im Auszug stimmt mit Verbleibend überein", „Saldo läuft von Zeile zu Zeile fort"). Bei Carmen fiel es nicht auf, weil ihr Phase-7-Backfill die Zeilen in Datumsreihenfolge angelegt hatte — dort sind beide Reihenfolgen identisch.
- **Fix:** `getVacationJournalEntries` sortiert jetzt `createdAt DESC, id DESC` (neueste Buchung oben, Kopfzeile stimmt mit erster Zeile überein). `getVacationTransactions` bleibt unverändert bei `date ASC`, da der Konsistenzprüfer aus Phase 7 die fachliche Chronologie braucht.
- **Files modified:** `server/src/services/vacationTransactionService.ts`, `server/src/services/vacationTransactionService.test.ts`
- **Verification:** Neuer Regressionstest deckt rückdatierte Buchungen ab; Anwender hat den korrigierten Auszug erneut geprüft und freigegeben
- **Committed in:** `8af5e3f`

**2. [Rule 1 - Bug] Testisolation: hartkodierte referenceId traf echten Produktionsantrag**
- **Found during:** Task 3, während der Behebung von Fund 1 (nach `npm run sync-dev-db`)
- **Issue:** Zwei Tests hatten `referenceId: 61` hartkodiert und fragten global ab. Nach dem Sync der Produktionsdaten trifft das Carmen Rothemunds echten Antrag #61 — die Tests fanden 4 statt 2 Zeilen (2 echte + 2 Testzeilen).
- **Fix:** Alle Vorkommen nutzen jetzt die `absenceId`-Fixture aus `beforeEach` statt der hartkodierten Id.
- **Files modified:** `server/src/services/vacationTransactionService.test.ts`
- **Verification:** Test isoliert und in der gezielten Testdatei grün
- **Committed in:** `8af5e3f` (im selben Commit wie Fund 1)

### Vom Anwender ausgewählte Verbesserungen (kein Deviation-Regel-Fall, aber dokumentationspflichtig)

**3. [Rule 4 - vom Anwender entschieden] Vier Lesbarkeits-Verbesserungen am Kontoauszug**
- **Found during:** Task 3, Rückmeldung des Anwenders nach erster Sichtprüfung
- **Änderungen:**
  - Tabs „Anträge"/„Kontoauszug" in `AbsencesPage` statt Auszug über der Antragsliste — bewusst kein eigener Sidebar-Eintrag
  - Buchungszeitpunkt nur noch angezeigt, wenn er sich von der Zeile darüber unterscheidet (Carmens elf Backfill-Zeilen trugen denselben Zeitstempel)
  - Storno-Paar wird beim Überfahren von „Antrag #…" gemeinsam hervorgehoben
  - `(rückwirkend erzeugt)` ausgeblendet, ISO-Daten deutsch formatiert (nur Anzeige, gespeicherte Texte unverändert)
- **Files modified:** `desktop/src/components/vacation/VacationTransactions.tsx`, `desktop/src/pages/AbsencesPage.tsx`
- **Verification:** Anwender hat den überarbeiteten Auszug erneut geprüft und freigegeben
- **Committed in:** `3f6ac5f`

**4. [Rule 1 - Bug, phasenfremd] Notification-Plugin nur in der Tauri-Hülle aufrufen**
- **Found during:** Task 3, beim lokalen Testen im Browser-Dev-Modus (aufgefallen, gehört aber nicht zu Phase 8)
- **Issue:** Beim Entwickeln im Browser (localhost:1420) fehlt die Tauri-Bridge. Jeder Aufruf des Notification-Plugins scheiterte an `invoke`; da `send()` bei nicht erteiltem Recht jedes Mal erneut `checkPermission()` aufruft, geschah das einmal pro Benachrichtigung und Render — die Konsole lief mit identischen Stacktraces voll, ohne dass etwas kaputt war.
- **Fix:** `checkPermission()` und `send()` steigen jetzt still aus, wenn `__TAURI_INTERNALS__` fehlt. In der ausgelieferten Desktop-App ändert sich nichts.
- **Files modified:** `desktop/src/services/notificationService.ts`
- **Verification:** `tsc --noEmit` grün, Desktop-Build grün, Browser-Konsole ohne Stacktraces
- **Committed in:** `7b75765`

---

**Total deviations:** 2 Planfehler (dokumentiert, nicht code-relevant) + 2 auto-fixed Bugs (Rule 1) + 1 Anwender-Auswahl (Rule 4) + 1 phasenfremder Bugfix (Rule 1)
**Impact on plan:** Der Saldo-Fix war notwendig, um zwei must_haves dieses Plans überhaupt zu erfüllen — ohne ihn wäre die Abnahme nicht freigebbar gewesen. Die Lesbarkeits-Verbesserungen und der Notification-Fix sind Zusatzumfang, den der Anwender während der Abnahme ausdrücklich angefordert bzw. bemerkt hat; kein ungeplanter Scope-Creep ohne Anwenderbeteiligung.

## Deployment (dieser Fortsetzungslauf)

Vier Commits (`8af5e3f`, `3f6ac5f`, `7b75765` sowie der vorausgehende Stand) wurden nach der Freigabe mit `git push origin main` nach Produktion gebracht. Der Saldo-Fix betrifft `server/**` und löste `deploy-server.yml` aus.

Prüfreihenfolge aus `.claude/CLAUDE.md` „Deployment Verification Rules":

| Prüfung | Ergebnis |
|---|---|
| `gh run list --workflow="deploy-server.yml" --limit 1` | `completed` / `success` (Run `32415998514`, 5m30s) |
| `curl -s http://129.159.8.19:3000/api/health` | `{"status":"ok",...}` |
| `curl .../api/vacation-transactions` (ohne Anmeldung) | `401` |
| `curl .../api/vacation-balances/1` (ohne Anmeldung) | `401` |
| `git log origin/main -1 --oneline` | `7b75765` — Notification-Fix-Commit, wie erwartet |

Kein Nacharbeitsbedarf. Direkte Serveränderungen fanden nicht statt — der Weg führte ausschließlich über `git push`.

## Abnahmeergebnis Task 3 (vom Anwender mit „freigegeben" bestätigt)

Alle sieben Prüfpunkte der Prüfliste gegen echte, per `npm run sync-dev-db` synchronisierte Produktionsdaten durchgeführt. Punkte 1–5 und 7 per Sichtprüfung, Punkt 6 programmatisch über die Autorisierungsmatrix verifiziert:

- Mitarbeiter → eigenes Konto: `200` (implizit und explizit über `userId`)
- Mitarbeiter → fremdes Konto: `403` in beide Richtungen (fremde `userId` lesen, eigene Session gegen fremde Id), Fehlermeldung ohne Datenlecks
- Admin → fremdes Konto: `200`
- Ohne Token: `401`

Damit sind T-08-30 (Information Disclosure) und T-08-31 (Elevation of Privilege) aus dem Threat-Register dieses Plans als „mitigate, verifiziert" bestätigt.

## Teststand

- Journal-Tests (`vacationTransactionService.test.ts`, `vacationTransactionRoutes.test.ts`): 37/37
- Phase-5–7-Regression (`vacationConsistencyService`, `absenceVacationBooking`, `vacationCorrectionBooking`): 30/30
- Desktop-Unit-Tests: 50/50
- `tsc --noEmit` Server und Desktop: je Exit-Code 0
- Desktop-Build: grün
- Gesamtsuite `cd server && npx vitest run`: 172/176 — vier umgebungsbedingte Fehlschläge, alle in `deferred-items.md` begründet:
  - 2× `unifiedOvertimeService.test.ts` — zeitabhängig, für den 06.02.2026 geschrieben, seit Februar veraltet (unabhängig von Phase 8)
  - `vacationEntitlementBooking.test.ts` — isoliert grün, schlägt nur in der Gesamtsuite wegen geteilter Test-Datenbank fehl (bekannte Vorbelastung aus Phase 7)
  - `vacationBackfillService.test.ts` — „erkennt einen bereits gelaufenen Backfill": `hasExistingBackfill()` prüft global statt nutzerbezogen, unerfüllbar in einer DB mit echtem Phase-7-Backfill

**Wichtigster struktureller Befund (außerhalb des Scopes von Phase 8, in `deferred-items.md` festgehalten):** Die Server-Tests laufen gegen `server/database/development.db` — `getDatabasePath()` kennt kein `NODE_ENV=test`. Sie schreiben Fixtures in die Arbeitsdatenbank und lesen echte Daten mit. Ein eigener Pfad für `NODE_ENV=test` (z. B. frisch migrierte `server/database/test.db` pro Lauf) wäre die saubere Lösung.

## Issues Encountered

- Zwei Deployment-Fehlschläge in Task 2 wegen des am 20.08.2026 entfernten Symlinks `server/database.db → production.db`: `deploy-server.yml` exportierte `DATABASE_PATH` nirgends, `migrate.ts`/`validateSchema.ts` hatten den Pfad hartkodiert. Beide Root Causes behoben (`736ea1b`, `a6d002d`), dritter Deployment-Versuch erfolgreich. Nicht-deploy-relevante Skripte mit demselben Muster (`fixOvertimeTransactionsSchema.ts`, `validateOvertimeCalculation.ts`) stehen unbehoben in `deferred-items.md`.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Server in Produktion ist aktuell, der Journal-Endpunkt live und abgesichert
- Kontoauszug ist von Mitarbeitern und Admins gegen echte Daten abgenommen — Phase 8 ist releasefähig
- Plan 08-05 (Desktop-Release v1.8.0) kann beginnen; keine offenen Blocker aus diesem Plan
- Strukturelle Testinfrastruktur-Lücke (Test-DB) bleibt offen, außerhalb des Scopes dieser Phase

---
*Phase: 08-kontoauszug-f-r-mitarbeiter-und-admin*
*Completed: 2026-08-20*

## Self-Check: PASSED

Alle 10 im SUMMARY genannten Dateien vorhanden. Alle 6 Commits (`ea3cb52`, `736ea1b`, `a6d002d`, `8af5e3f`, `3f6ac5f`, `7b75765`) in `git log --all` gefunden. Deployment-Run `32415998514` `completed`/`success`, alle vier Produktionsprüfungen bestanden (Health `ok`, `/api/vacation-transactions` und `/api/vacation-balances/1` je `401`, `origin/main` zeigt auf `7b75765`).
