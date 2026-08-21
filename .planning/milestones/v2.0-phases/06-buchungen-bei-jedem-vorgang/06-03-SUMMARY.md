---
phase: 06-buchungen-bei-jedem-vorgang
plan: 03
subsystem: database
tags: [sqlite, better-sqlite3, vacation, journal, admin-correction]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: "06-01/06-02: recordVacationTransaction()-Muster, db.transaction()-Klammer um
      Statuswechsel/Kontoänderung + Buchung, Anspruchs-/Übertragsbuchung bei Neuanlage"
provides:
  - Admin-Änderungen am Urlaubskonto erzeugen jetzt eine correction-Buchung statt eines
    stillen Überschreibens — in updateVacationBalance (PUT) UND upsertVacationBalance
    (POST, der von der Admin-Oberfläche tatsächlich genutzte Editier-Pfad)
  - Gebucht wird die Differenz je geändertem Feld (entitlement/carryover/taken), nicht der
    neue Wert; unveränderte Felder und eine Differenz von 0 buchen nicht
  - Begründung ist Pflicht in dem Sinn, dass eine leere Zeichenkette mit HTTP 400
    abgewiesen wird; fehlt das Feld ganz, entsteht ein als solcher gekennzeichneter
    Ersatztext ("Korrektur durch Admin: ...") — Übergangsregel bis Phase 8 ein
    Begründungsfeld in der Oberfläche ergänzt
  - upsertVacationBalance schließt eine bestehende Lücke: Legt ein Admin über die
    Oberfläche ein neues Konto an (POST bei nicht existierendem Konto), wird jetzt
    Anspruch/Übertrag gebucht statt gar nicht
  - 11 Regressionstests, die den Auslöser des Milestones rückwärts nachbilden (Konto von
    30 auf 0 korrigieren → Kontoauszug beantwortet wer/wann/warum in einer Zeile)
affects: [07-saldo-aus-buchungen-backfill, 08-kontoauszug]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Korrekturbeschreibung zentral in buildCorrectionDescription() gebaut — konsistent
       zwischen updateVacationBalance und upsertVacationBalance, Feldlabels (Anspruch/
       Übertrag/Genommen) identisch zu den Labels der Admin-Oberfläche"
    - "skipCreationBooking-Flag auf VacationBalanceCreateInput unterdrückt die generische
       Anspruchs-/Übertragsbuchung in upsertVacationBalance für interne Aufrufer, die selbst
       mit einer spezifischeren Beschreibung buchen (z. B. Pro-rata-Hinweis bei Neuanlage) —
       verhindert Doppelbuchung, ohne die Buchungslogik zu duplizieren"
    - "Gebucht wird die Differenz (newValue - oldValue), bei taken mit gedrehtem Vorzeichen
       (oldValue - newValue), da sinkendes taken mehr verfügbaren Urlaub bedeutet"

key-files:
  created:
    - server/src/services/vacationCorrectionBooking.test.ts
  modified:
    - server/src/services/vacationBalanceService.ts
    - server/src/routes/vacationBalance.ts

key-decisions:
  - "Leere-Begründung-Validierung liegt im Service (updateVacationBalance/
     upsertVacationBalance), nicht nur in der Route — beide Schreibpfade teilen dieselbe
     Prüfung, die Route fügt zusätzlich eine frühe 400-Antwort hinzu, bevor der Service
     überhaupt aufgerufen wird"
  - "upsertVacationBalance bucht jetzt auch bei Neuanlage (Konto existiert nicht) Anspruch/
     Übertrag — vorher unbucht, weil 06-02 nur die Aufrufer (initializeVacationAccounts...,
     bulkInitialize...) angepasst hatte, nicht die Funktion selbst. Das ist der reale
     Admin-Editier-Pfad (VacationBalanceEditModal.tsx ruft für Neuanlage UND Bearbeitung
     immer POST auf, PUT/updateVacationBalance wird vom Frontend nicht verwendet)"
  - "skipCreationBooking: true in initializeVacationAccountsForNewUser ergänzt (Rule 1) —
     ohne das Flag hätte die neue generische Buchung in upsertVacationBalance zu einer
     Doppelbuchung neben der bereits bestehenden, pro-rata-bewussten Buchung dieser
     Funktion geführt"

patterns-established:
  - "Korrekturbuchungen datieren auf 'heute' (getTodayString()), nicht auf ein historisches
     Datum — die Korrektur geschieht jetzt, unabhängig davon, für welches Jahr das Konto gilt"

requirements-completed: [REQ-06]

# Metrics
duration: ~25min
completed: 2026-08-19
---

# Phase 06 Plan 03: Buchungen bei jedem Vorgang Summary

**Admin-Änderungen am Urlaubskonto (PUT und POST, letzterer der tatsächlich genutzte
Editier-Pfad der Oberfläche) erzeugen jetzt eine `correction`-Buchung mit Differenz, altem/
neuem Wert und Begründung — leere Begründung wird abgewiesen, fehlende erzeugt einen
gekennzeichneten Ersatztext.**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-08-19
- **Tasks:** 4
- **Files modified:** 3 (2 modified, 1 created)

## Accomplishments
- `updateVacationBalance(id, data)` bucht für jedes geänderte Feld (`entitlement`,
  `carryover`, `taken`) eine `correction`-Buchung über die Differenz — UPDATE und Buchung
  laufen atomar in einer `db.transaction()`.
- `upsertVacationBalance(data)` unterscheidet jetzt zwei Fälle: Existiert das Konto nicht,
  wird Anspruch/Übertrag gebucht (wie bei den Entstehungswegen aus 06-02); existiert es,
  wird die Differenz als `correction` gebucht. Das schließt eine bislang offene Lücke —
  legte ein Admin bisher über die Oberfläche ein neues Konto an, entstand **keine einzige
  Buchung**.
- Beschreibung nennt Feld, alten und neuen Wert und die Begründung:
  `Korrektur Anspruch 30 → 0 (Grund: Stammdaten korrigiert)`. Fehlt die Begründung, entsteht
  ein gekennzeichneter Ersatztext: `Korrektur durch Admin: Anspruch 30 → 0`.
- Eine leere Zeichenkette als Begründung wird mit HTTP 400 abgewiesen (Route und Service);
  fehlt das Feld ganz, greift der Ersatztext — die Admin-Oberfläche bleibt funktionsfähig,
  obwohl sie noch kein Begründungsfeld besitzt (kommt in Phase 8).
- `POST /` und `PUT /:id` reichen `reason` aus dem Body und `req.session.user!.id` als
  `actorId` durch.
- 11 Regressionstests (8 aus dem Plan plus 3 zusätzliche für den in Produktion tatsächlich
  genutzten `upsertVacationBalance`-Pfad) — darunter der 18.08.-Fall rückwärts gelesen: ein
  Konto von 30 auf 0 korrigieren und danach aus dem Journal ablesen, wer, wann und warum
  geändert hat.

## Task Commits

Each task was committed atomically:

1. **Task 1: Korrekturbuchung in updateVacationBalance** - `ed1d5f0` (feat)
2. **Task 2: Korrekturbuchung in upsertVacationBalance** - `50f1165` (feat)
3. **Task 3: Routen reichen reason/actorId durch** - `4596da6` (feat)
4. **Task 4: Regressionstests** - `1668863` (test)
5. **[Deviation] Optional Chaining für description in Tests** - `f7d00f8` (fix)

**Plan metadata:** _folgt in diesem Commit_ (docs: complete plan)

## Files Created/Modified
- `server/src/services/vacationBalanceService.ts` — `CORRECTION_FIELD_LABELS` und
  `buildCorrectionDescription()` als gemeinsame Basis für beide Funktionen;
  `VacationBalanceUpdateInput`/`VacationBalanceCreateInput` um `reason`/`actorId` erweitert,
  `VacationBalanceCreateInput` zusätzlich um `skipCreationBooking`; `updateVacationBalance`
  und `upsertVacationBalance` buchen jetzt Korrekturen bzw. Anspruch/Übertrag atomar mit der
  Kontoänderung; `initializeVacationAccountsForNewUser` übergibt `skipCreationBooking: true`
  an seine beiden `upsertVacationBalance`-Aufrufe
- `server/src/routes/vacationBalance.ts` — `POST /` und `PUT /:id` nehmen `reason` entgegen,
  weisen leere Zeichenketten mit HTTP 400 ab und reichen `req.session.user!.id` als
  `actorId` durch
- `server/src/services/vacationCorrectionBooking.test.ts` — 11 neue Regressionstests

## Decisions Made
- **Validierung der leeren Begründung im Service statt nur in der Route**: Beide
  Schreibpfade (`updateVacationBalance`, `upsertVacationBalance`) teilen dieselbe Prüfung.
  Die Route ergänzt zusätzlich eine frühe 400-Antwort, damit der Fehlertext bereits vor dem
  Service-Aufruf feststeht — beide Ebenen werfen denselben Fehler, der bestehende
  Catch-Block der Route übersetzt ihn ohnehin in HTTP 400.
- **`upsertVacationBalance` bucht jetzt auch bei Neuanlage**: 06-02 hatte nur die Aufrufer
  (`initializeVacationAccountsForNewUser`, `bulkInitializeVacationBalances`) angepasst,
  nicht die Funktion selbst. Recherche im Frontend (`VacationBalanceEditModal.tsx`) ergab,
  dass die Admin-Oberfläche für Neuanlage UND Bearbeitung ausschließlich `POST` verwendet —
  `PUT`/`updateVacationBalance` wird vom Frontend nicht aufgerufen. Ohne diese Ergänzung
  hätte die manuelle Neuanlage eines Kontos über die Oberfläche weiterhin keine Buchung
  erzeugt.
- **`skipCreationBooking`-Flag statt Verhaltensänderung an `initializeVacationAccountsForNewUser`**:
  Die neue generische Buchung in `upsertVacationBalance` hätte ohne dieses Flag zu einer
  Doppelbuchung neben der bereits bestehenden, pro-rata-bewussten Buchung dieser Funktion
  geführt. Ein Flag hält die Buchungslogik an einer Stelle und vermeidet, dass zwei
  Codepfade dieselbe Bewegung erfassen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `skipCreationBooking`-Flag verhindert Doppelbuchung bei Nutzeranlage**
- **Found during:** Task 2 (Korrekturbuchung in upsertVacationBalance)
- **Issue:** `initializeVacationAccountsForNewUser` (06-02) ruft `upsertVacationBalance`
  zur Kontoanlage auf und bucht danach selbst mit einer pro-rata-bewussten Beschreibung.
  Ohne Gegenmaßnahme hätte die neue "Konto existiert nicht → Anspruch/Übertrag buchen"-Logik
  aus Task 2 zu einer zweiten, generischen Buchung für dieselbe Bewegung geführt.
- **Fix:** `VacationBalanceCreateInput` um `skipCreationBooking?: boolean` erweitert;
  `initializeVacationAccountsForNewUser` übergibt `true` an beide `upsertVacationBalance`-
  Aufrufe. Verifiziert mit dem bestehenden 06-02-Testsuite (`vacationEntitlementBooking.test.ts`,
  6/6 grün, keine doppelten Buchungen).
- **Files modified:** `server/src/services/vacationBalanceService.ts`
- **Committed in:** `50f1165` (Task 2 commit)

**2. [Rule 1 - Bug] Optional Chaining für `description` in Tests**
- **Found during:** Abschließender `npx tsc --noEmit` nach Task 4
- **Issue:** `VacationTransaction.description` ist `string | null`; `.find((t) =>
  t.description.includes(...))` schlug im strikten TypeScript-Modus fehl.
- **Fix:** `t.description?.includes(...)` in zwei `find()`-Prädikaten.
- **Files modified:** `server/src/services/vacationCorrectionBooking.test.ts`
- **Verification:** `npx tsc --noEmit` fehlerfrei, alle 11 Tests weiterhin grün.
- **Committed in:** `f7d00f8`

---

**Total deviations:** 2 auto-fixed (2 Bugfixes — Doppelbuchungsvermeidung und Typsicherheit)
**Impact on plan:** Beide notwendig für Korrektheit; kein Scope Creep über die im Plan
gelisteten Dateien (`vacationBalanceService.ts`, `vacationBalance.ts` Route,
`vacationCorrectionBooking.test.ts`) hinaus.

## Issues Encountered
- Test 8 (Konsistenzprüfung `Journal-Saldo == entitlement + carryover − taken`) schlug in
  der ersten Fassung fehl, weil das Testkonto per direktem SQL-INSERT angelegt wurde (ohne
  Anspruchsbuchung) — die Prüfung ist nur aussagekräftig, wenn das Journal die gesamte
  Historie des Kontos trägt. Behoben durch Anlage über `upsertVacationBalance` (bucht jetzt
  selbst den Anspruch), bevor die Korrektur angewendet wird. Kein Produktivcode betroffen,
  nur der Testaufbau.
- `upsertVacationBalance`s Übertrag-Validierung (max. 5 Tage über dem Vorjahresrest) griff
  in Test 10 wie erwartet — das Testfixture legt deshalb ein Vorjahreskonto mit
  ausreichendem Rest an, statt die Validierung zu umgehen.

## User Setup Required

None - keine externe Konfiguration erforderlich.

## Next Phase Readiness
- Alle drei REQ-06-Anforderungen erfüllt: Pflichtbegründung (leer abgewiesen, fehlend
  ersetzt), Korrekturbuchung mit Auslöser, alter/neuer Wert nachvollziehbar im Journal.
- Zusammen mit 06-01 (Genehmigung/Ablehnung/Löschung) und 06-02 (Anspruch/Übertrag bei
  Entstehung) bucht jetzt **jede** Bewegung des Urlaubskontos ins Journal — die
  Voraussetzung, unter der Phase 7 `taken` zur abgeleiteten Summe der Buchungen machen kann.
- Zwei vorbestehende, unveränderte Fehlschläge in `unifiedOvertimeService.test.ts`
  (datumsabhängige Regressionstests, nicht Gegenstand dieses Plans) — Gesamtsuite 135/137
  grün (06-02: 124/126, +11 neue Tests aus diesem Plan).

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: server/src/services/vacationCorrectionBooking.test.ts
- FOUND: server/src/services/vacationBalanceService.ts
- FOUND: server/src/routes/vacationBalance.ts
- FOUND: ed1d5f0 (Task 1)
- FOUND: 50f1165 (Task 2)
- FOUND: 4596da6 (Task 3)
- FOUND: 1668863 (Task 4)
- FOUND: f7d00f8 (Deviation fix)
