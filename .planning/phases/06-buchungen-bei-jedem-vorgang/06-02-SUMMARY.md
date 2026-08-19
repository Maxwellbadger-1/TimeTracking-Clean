---
phase: 06-buchungen-bei-jedem-vorgang
plan: 02
subsystem: database
tags: [sqlite, better-sqlite3, vacation, journal, year-end-rollover]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: "06-01: Genehmigung/Ablehnung/Löschung buchen bereits ins Journal
      (recordVacationTransaction, db.transaction()-Muster)"
provides:
  - Anlage eines Mitarbeiters bucht den anteiligen Jahresanspruch für das laufende Jahr und
    den vollen Jahresanspruch für das Folgejahr — atomar mit der Kontoanlage
  - Admin-Massenanlage (bulkInitializeVacationBalances) bucht Anspruch und, falls vorhanden,
    Übertrag aus dem Vorjahr — für jedes neu angelegte Konto, idempotent
  - Jahreswechsel (performYearEndRollover) bucht dadurch automatisch dieselben zwei
    Buchungen, da er bulkInitializeVacationBalances aufruft
  - 0 Urlaubstage erzeugen bewusst keine Buchung (recordVacationTransaction lehnt days=0 ab)
    — an allen drei Entstehungswegen konsistent gehandhabt
  - initializeVacationAccountsForNewUser() als eigenständige, testbare Funktion in
    vacationBalanceService.ts (aus der POST-/api/users-Route extrahiert)
  - 6 Regressionstests für REQ-07 inkl. Vollständigkeitsprüfung
    Journal-Saldo == entitlement + carryover − taken
affects: [07-saldo-aus-buchungen-backfill, 08-kontoauszug]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Buchungslogik sitzt in einer testbaren Service-Funktion, nicht im HTTP-Route-Handler
       (initializeVacationAccountsForNewUser) — Fortsetzung des in 06-01 etablierten Musters
       'Buchung an der Stelle, die den Zähler verändert'"
    - "bulkInitializeVacationBalances ist der einzige Ort, an dem vacation_balance-Zeilen per
       Massenanlage entstehen — sowohl Admin-Route als auch performYearEndRollover rufen ihn
       auf und erben dadurch dieselbe Buchungslogik für entitlement UND carryover"
    - "Kontoanlage (INSERT/upsert) und Buchung laufen atomar in einer db.transaction()"

key-files:
  created:
    - server/src/services/vacationEntitlementBooking.test.ts
  modified:
    - server/src/routes/users.ts
    - server/src/services/vacationBalanceService.ts
    - server/src/services/yearEndRolloverService.ts
    - server/src/routes/vacationBalance.ts

key-decisions:
  - "Buchungslogik der Nutzeranlage aus routes/users.ts nach vacationBalanceService.ts
     extrahiert (initializeVacationAccountsForNewUser) — nicht explizit im Plan gefordert,
     aber notwendig, um die Anlage-Szenarien (0 Tage, Pro-rata) direkt zu testen, statt
     über den HTTP-Layer, für den es im Projekt keine Testkonvention gibt (Rule 2)"
  - "bulkInitializeVacationBalances bucht entitlement UND carryover in derselben Funktion
     statt sie auf zwei Codepfade zu verteilen — da performYearEndRollover diese Funktion
     direkt aufruft, erbt der Jahreswechsel die Buchungslogik automatisch, ohne Duplikation"
  - "createdBy bei bulkInitializeVacationBalances/performYearEndRollover: Admin-ID bei
     manuellem Aufruf, null beim automatischen Cron-Jahreswechsel ohne menschlichen Auslöser"

patterns-established:
  - "Buchungsdatum folgt dem tatsächlichen Entstehungszeitpunkt: Eintrittsdatum bei
     unterjährigem Eintritt, sonst 1. Januar des jeweiligen Jahres — der Kontoauszug soll
     den Anspruch dort zeigen, wo er entsteht"

requirements-completed: [REQ-07]

# Metrics
duration: ~35min
completed: 2026-08-19
---

# Phase 06 Plan 02: Buchungen bei jedem Vorgang Summary

**Anspruch und Übertrag werden jetzt auf allen drei Wegen gebucht, auf denen ein
Urlaubskonto entsteht — Nutzeranlage, Admin-Massenanlage und Jahreswechsel —, wobei
Massenanlage und Jahreswechsel dieselbe Buchungsfunktion teilen und 0 Urlaubstage
strukturell keine Buchung erzeugen.**

## Performance

- **Duration:** ~35 min
- **Completed:** 2026-08-19
- **Tasks:** 3
- **Files modified:** 5 (4 modified, 1 created)

## Accomplishments
- `POST /api/users` bucht den anteiligen Jahresanspruch für das laufende Jahr (Pro-rata bei
  unterjährigem Eintritt) und den vollen Jahresanspruch für das Folgejahr — atomar mit der
  Kontoanlage über `initializeVacationAccountsForNewUser()`.
- `bulkInitializeVacationBalances()` bucht pro neu angelegtem Konto den Jahresanspruch und,
  falls ein Rest aus dem Vorjahr übertragen wird, zusätzlich den Übertrag mit Herkunftsjahr
  in der Beschreibung (`Übertrag aus 2031`) — idempotent, ein zweiter Lauf erzeugt keine
  weitere Buchung.
- `performYearEndRollover()` ruft dieselbe Funktion auf und bucht dadurch automatisch
  Anspruch und Übertrag für das neue Jahr, ohne eigene Buchungslogik.
- 0 Urlaubstage erzeugen an allen drei Wegen ein Konto ohne Buchung — der historische Fehler
  (`0 || 30` gab sechs Mitarbeitern fälschlich 30 Tage) ist strukturell ausgeschlossen, da
  `recordVacationTransaction` `days = 0` ablehnt und der Code das bewusst überspringt.
- 6 Regressionstests decken alle drei Entstehungswege ab, inklusive der Vollständigkeits-
  prüfung `Journal-Saldo == entitlement + carryover − taken` nach Anlage und genehmigtem
  Urlaub — die Grundlage, auf der Phase 7 `taken` zur abgeleiteten Größe macht.

## Task Commits

Each task was committed atomically:

1. **Task 1: Anspruch bei der Nutzeranlage buchen** - `f70ef88` (feat)
2. **Task 2: Massenanlage und Jahreswechsel buchen** - `25e26aa` (feat)
3. **[Deviation] Anspruchsbuchung bei Nutzeranlage in Service extrahiert** - `8576e76` (refactor)
4. **Task 3: Regressionstests** - `13c2af8` (test)

**Plan metadata:** _folgt in diesem Commit_ (docs: complete plan)

## Files Created/Modified
- `server/src/routes/users.ts` — ruft `initializeVacationAccountsForNewUser()` auf statt
  Buchungslogik inline zu enthalten; nicht mehr benötigte Imports entfernt
- `server/src/services/vacationBalanceService.ts` — neue Funktion
  `initializeVacationAccountsForNewUser()` (Anlage-Buchung, extrahiert und direkt testbar);
  `bulkInitializeVacationBalances()` bucht jetzt `entitlement` und `carryover`, nimmt
  `createdBy` als Parameter, Kontoanlage + Buchung atomar in `db.transaction()`
- `server/src/services/yearEndRolloverService.ts` — reicht `executedBy` als `createdBy` an
  `bulkInitializeVacationBalances()` durch (null beim Cron-Lauf)
- `server/src/routes/vacationBalance.ts` — Bulk-Initialize-Route übergibt den anlegenden
  Admin als `createdBy`
- `server/src/services/vacationEntitlementBooking.test.ts` — 6 neue Regressionstests

## Decisions Made
- **Extraktion der Anlage-Buchungslogik in einen Service** (nicht explizit im Plan
  gefordert): Die Buchungslogik lag zunächst inline in der `POST /api/users`-Route. Für die
  im Plan geforderten Tests (0-Tage-Fall, Pro-rata) gibt es im Projekt keine Konvention für
  Route-Level-Tests (alle sechs bestehenden Testdateien testen ausschließlich die
  Service-Schicht). Die Logik wurde daher unverändert nach
  `vacationBalanceService.initializeVacationAccountsForNewUser()` verschoben und die Route
  ruft sie nur noch auf — keine Verhaltensänderung, aber direkt testbar.
- **`bulkInitializeVacationBalances` bucht entitlement UND carryover** statt die
  Carryover-Buchung separat in `performYearEndRollover` zu platzieren: Da Letzteres
  Erstere aufruft und die Carryover-*Berechnung* ohnehin bereits in
  `bulkInitializeVacationBalances` sitzt (nicht in `performYearEndRollover`), wäre eine
  Aufteilung der Buchung auf zwei Funktionen eine künstliche Trennung von Berechnung und
  Buchung gewesen. Die gewählte Lösung bucht beides an der Stelle, an der auch die
  zugrundeliegenden Werte entstehen — für Admin-Route und Jahreswechsel gleichermaßen.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Buchungslogik der Nutzeranlage in eine testbare Funktion extrahiert**
- **Found during:** Vorbereitung von Task 3 (Tests)
- **Issue:** Der must_have-Artefakt „Tests für Anspruch, Übertrag und den 0-Tage-Fall"
  verlangt Testabdeckung für die Nutzeranlage. Die Buchungslogik aus Task 1 lag jedoch
  inline im `POST /api/users`-Route-Handler und war damit nur über den HTTP-Layer
  erreichbar — im Projekt existiert keine einzige Route-Level-Testdatei (alle sechs
  bestehenden Tests decken ausschließlich Services ab).
- **Fix:** Logik unverändert nach `initializeVacationAccountsForNewUser()` in
  `vacationBalanceService.ts` verschoben, Route ruft die Funktion auf. Keine
  Verhaltensänderung — Rückgabewerte und Seiteneffekte sind identisch zum vorherigen
  Inline-Code, nur der Aufrufort hat sich geändert.
- **Files modified:** `server/src/routes/users.ts`, `server/src/services/vacationBalanceService.ts`
- **Verification:** `npx tsc --noEmit` fehlerfrei; Tests 1, 2, 3 und 6 der neuen Testdatei
  rufen die Funktion direkt auf und bestätigen Anlage-, 0-Tage- und Pro-rata-Fall.
- **Committed in:** `8576e76` (eigener Refactor-Commit vor Task 3)

---

**Total deviations:** 1 auto-fixed (1 missing critical / Testbarkeit)
**Impact on plan:** Notwendig, um die im Plan geforderte Testabdeckung für REQ-07 zu
erreichen. Keine Verhaltensänderung an der Route, kein Scope Creep über die drei geplanten
Dateien hinaus (Extraktion blieb innerhalb der ohnehin im Plan als `files_modified` gelisteten
Dateien `routes/users.ts` und `vacationBalanceService.ts`).

## Issues Encountered
- `bulkInitializeVacationBalances`/`performYearEndRollover` verarbeiten beim Testen ALLE
  aktiven Nutzer der (lokalen) Entwicklungsdatenbank, nicht nur die im Test angelegten
  Nutzer — inklusive eines Nebeneffekts im Überstundensystem (`performYearEndRollover` ruft
  intern auch `bulkInitializeOvertimeBalancesForNewYear` auf). Die Tests für Massenanlage
  und Jahreswechsel verwenden deshalb exklusive, weit in der Zukunft liegende Jahre
  (2031–2033) und räumen alle Nebeneffekte (`vacation_balance`, `vacation_transactions`,
  `overtime_balance`, `audit_log`) in `finally`-Blöcken vollständig wieder auf. Verifiziert:
  Vor und nach dem Testlauf sind für diese Jahre 0 Zeilen in der Datenbank vorhanden.
- Ein erster Testlauf schlug bei den Tests 5 und 6 mit `FOREIGN KEY constraint failed` beim
  Löschen der Testnutzer fehl, weil `approveAbsenceRequest`/`performYearEndRollover` auch
  Zeilen in `overtime_transactions`, `overtime_balance`, `work_time_accounts` und
  `time_entries` anlegen. Die `afterEach`-Aufräumroutine wurde um diese Tabellen ergänzt
  (analog zum Muster in `absenceVacationBooking.test.ts` aus 06-01). Vier dadurch verwaiste
  Testnutzer aus dem fehlgeschlagenen ersten Lauf wurden manuell nachträglich bereinigt.

## User Setup Required

None - keine externe Konfiguration erforderlich.

## Next Phase Readiness
- Alle drei Entstehungswege eines Urlaubskontos (Nutzeranlage, Massenanlage, Jahreswechsel)
  buchen jetzt Anspruch und Übertrag ins Journal — zusammen mit 06-01 (Genehmigung,
  Ablehnung, Löschung) ist der Saldo damit an jeder Stelle, an der er sich ändert,
  vollständig aus Buchungen ableitbar.
- **Berührungspunkt für Phase 7:** `performYearEndRollover` berechnet den Übertrag über
  `bulkInitializeVacationBalances` als `previousBalance.remaining` (= `entitlement +
  carryover - taken` des Vorjahres, aus der `vacation_balance`-Tabelle). Sobald Phase 7
  `taken` zur abgeleiteten Journalsumme macht, muss diese Formel weiter korrekte Werte
  liefern — in diesem Plan bewusst nicht angefasst.
- Zwei vorbestehende, unveränderte Fehlschläge in `unifiedOvertimeService.test.ts`
  (datumsabhängige Regressionstests, nicht Gegenstand dieses Plans) — Gesamtsuite 124/126
  grün (06-01: 118/120, +6 neue Tests aus diesem Plan, +2 Referenz auf dieselben
  vorbestehenden Fehlschläge).

---
*Phase: 06-buchungen-bei-jedem-vorgang*
*Completed: 2026-08-19*

## Self-Check: PASSED

- FOUND: server/src/services/vacationEntitlementBooking.test.ts
- FOUND: server/src/routes/users.ts
- FOUND: server/src/services/vacationBalanceService.ts
- FOUND: server/src/services/yearEndRolloverService.ts
- FOUND: server/src/routes/vacationBalance.ts
- FOUND: f70ef88 (Task 1)
- FOUND: 25e26aa (Task 2)
- FOUND: 8576e76 (Deviation refactor)
- FOUND: 13c2af8 (Task 3)
