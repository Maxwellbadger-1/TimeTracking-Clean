---
phase: 11-datumsabh-ngige-berechnung
plan: 07
subsystem: absence-export-period-resolution
tags: [absence, overtime_comp, datev-export, workPeriodContext, REQ-23]
dependency-graph:
  requires:
    - "getDailyTargetHours(user, date, periods) / calculateAbsenceHoursWithWorkSchedule(user, startDate, endDate, periods) — Plan 11-04"
    - "createWorkPeriodContext() / directWorkPeriodLookup — Plan 11-02, workPeriodContext.ts"
    - "insertTestWorkPeriod() — Plan 11-04, workPeriodFixtures.ts"
    - "ensureInitialWorkPeriod() — userService.ts (bereits vorhanden)"
  provides:
    - "absenceService.ts: alle vier Sollstunden-Fundstellen periodenbewusst (Anreicherung, Genehmigungsvorbehalt, Abbuchung, calculateAbsenceCredits)"
    - "exportService.ts: DATEV-Export periodenbewusst"
    - "getUserForOvertimeCompCalculation() — gemeinsame Nutzerauflösung für Vorbehalt und Abbuchung (T-11-01/CR-01)"
    - ".planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-07.md"
  affects:
    - "server/src/routes/absences.ts (über getAbsenceRequestsPaginated, approveAbsenceRequest)"
    - "server/src/routes/exports.ts (über generateDATEVExport)"
tech-stack:
  added: []
  patterns:
    - "Ein WorkPeriodContext je Berechnungslauf (Liste/Export), nicht je Einzeleintrag (D1/D2, T-11-26)"
    - "directWorkPeriodLookup für Einzelabfragen ohne Tagesschleife (Genehmigungsvorbehalt/Abbuchung)"
    - "Gemeinsame Hilfsfunktion statt zweiter Kopie der Nutzerauflösung (T-11-01/CR-01)"
key-files:
  created:
    - server/src/services/absencePeriodAwareness.test.ts
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-07.md
  modified:
    - server/src/services/absenceService.ts
    - server/src/services/exportService.ts
    - server/src/services/absenceVacationBooking.test.ts
decisions:
  - "getUserForOvertimeCompCalculation() neu eingeführt statt getUserById() direkt zu nutzen an :791/:863: getUserById() schließt soft-gelöschte Nutzer aus (deletedAt IS NULL), ein bestehender overtime_comp-Antrag kann aber einen inzwischen soft-gelöschten Nutzer referenzieren. Fallback-Query lädt gezielt dieselbe Spaltenliste wie getUserById() (kein SELECT *, kein Passwort-Hash im Speicher, T-11-24)"
  - "absenceVacationBooking.test.ts beforeEach um ensureInitialWorkPeriod() ergänzt (Rule 1 Bugfix): die Testnutzer wurden per rohem INSERT ohne Arbeitszeitperiode angelegt, was nach der Task-1-Umstellung MissingWorkPeriodError auslöste"
metrics:
  duration: "~90min"
  completed: "2026-08-22"
---

# Phase 11 Plan 07: Abwesenheiten und Export periodenbewusst Summary

Alle vier Sollstunden-Fundstellen in `absenceService.ts` (Anreicherung, Genehmigungsvorbehalt
und Abbuchung bei `overtime_comp`, `calculateAbsenceCredits`) sowie die eine Fundstelle in
`exportService.ts` (`generateDATEVExport`) lösen jetzt über die am jeweiligen Tag gültige
Arbeitszeitperiode auf (REQ-23) statt über den heutigen Stammdatensatz — mit einem
dedizierten Test, der eine Abwesenheit über einen Periodenstichtag hinweg gegen die
Datenbank fährt und beweist, dass Genehmigungsvorbehalt und Abbuchung denselben Wert nennen.

## Was gebaut wurde

**Task 1 — `absenceService.ts` (Commit `e1e09ca`):**

- **Anreicherung** (`getAbsenceRequestsPaginated`, Zeile 364): `calculateAbsenceHoursWithWorkSchedule(user, absence.startDate, absence.endDate, periods)` statt der alten Signatur mit `user.workSchedule`/`user.weeklyHours`. `periods = createWorkPeriodContext()` einmal vor dem `rows.map()` erzeugt (D1/D2, T-11-26) — eine Liste mit vielen Anträgen desselben Nutzers lädt die Perioden nur einmal.
- **Neue Hilfsfunktion `getUserForOvertimeCompCalculation(userId)`**: löst zuerst über `getUserById()` auf; liefert der keinen Treffer (soft-gelöschter Nutzer, `deletedAt IS NOT NULL`), fällt sie auf eine gezielte Spaltenliste zurück (dieselben Spalten wie `getUserById()`, explizit ohne `password`) statt der vorherigen rohen `SELECT * FROM users`-Zeile — kein Passwort-Hash mehr im Speicher (T-11-24).
- **Genehmigungsvorbehalt** (`approveAbsenceRequest`, Zeile 828) und **Abbuchung** (Zeile 902) rufen jetzt beide `getUserForOvertimeCompCalculation(request.userId)` gefolgt von `calculateAbsenceHoursWithWorkSchedule(user, request.startDate, request.endDate, directWorkPeriodLookup)` auf — wörtlich identischer Aufbau (T-11-01/CR-01, dieselbe Regel, die Phase 9 zwölffach kopiert vorfand).
- **`calculateAbsenceCredits`** (Zeile 1236): `periods = createWorkPeriodContext()` einmal vor der Tagesschleife, durchgereicht an `getDailyTargetHours(user, d, periods)`. Der bestehende Wochenend-/Feiertagsvorfilter blieb unverändert (Ist-Verhalten, wie vom Plan gefordert).
- **Deviation (Rule 1, Bugfix):** `absenceVacationBooking.test.ts` legte Testnutzer per rohem `INSERT INTO users` an, ohne über `createUser()` zu laufen — ohne Arbeitszeitperiode. Test 7b (Überstundenausgleich) warf nach der Umstellung `MissingWorkPeriodError` (D4). Fix: `ensureInitialWorkPeriod()` (bereits in `userService.ts` vorhanden, genau für diesen Fall gebaut) im `beforeEach` für beide Testnutzer ergänzt. Alle 14 Tests grün.

**Task 2 — `exportService.ts` (Commit `2db8525`):**

- `generateDATEVExport()`: `periods = createWorkPeriodContext()` einmal je Export, außerhalb sowohl der Nutzer- als auch der Zeiteintrags-Schleife (der Export schleift über viele Zeiteinträge, teils mehrerer Nutzer, T-11-26). `getDailyTargetHours(fullUser, entry.date, periods)`. `fullUser` stammte bereits aus `getUserById()` (vollständiges `UserPublic`), keine Ergänzung nötig.

**Task 3 — Nachweistest (Commits `a413ec7`, `3c3d884`):**

- `absencePeriodAwareness.test.ts` (4 Tests, gegen die geteilte `development.db`, Testnutzer-Präfix `t1107-`, zwei echte Perioden über `insertTestWorkPeriod`, Stichtag 15.07.2026, 40h davor / 20h danach, kein Wochenplan):
  1. Anreicherung einer Abwesenheit 13.–17.07.2026 (2 Tage in P1, 3 Tage in P2) liefert `calculatedHours = 28` (2×8h + 3×4h), explizit nicht 40 und nicht 20.
  2. Ein Antrag vollständig vor dem Stichtag (06.–10.07.2026) liefert unverändert 40h.
  3. Genehmigungsvorbehalt und Abbuchung eines `overtime_comp`-Antrags über den Stichtag: Guthaben-Grenzfälle (5h → muss mit „Benötigt: 28.00h" ablehnen, sonst hätte ein fälschlich mit 20h rechnender Vorbehalt durchgelassen; 15h → muss gelingen, sonst hätte ein fälschlich mit 40h rechnender Vorbehalt abgelehnt) plus Prüfung der gebuchten `overtime_transactions`-Zeile (`hours = -28`) — ein eigener Test, keine Nebenzusicherung.
  4. Aufräumnachweis: kein Testnutzer mit Präfix `t1107-` bleibt zurück (maschinell geprüft über `createdUserIds`).
- `11-AUFRUFER-TEIL-07.md`: Teilbeleg mit den fünf erledigten Fundstellen (Tabellenform identisch zur Haupttabelle, alle ✓), wörtlicher grep-Ausgabe, tsc- und vitest-Nachweis, sowie den vier `countWorkingDaysForUser`-Zeilen ausdrücklich ohne Haken. `11-AUFRUFER-CHECKLISTE.md` selbst blieb unangetastet (parallele Welle, `git diff --name-only` bestätigt keine Änderung; Plan 11-09 führt zusammen).

## Verifikation

- `cd server && npx tsc --noEmit 2>&1 | grep -E "services/absenceService.ts|services/exportService.ts"` → keine Ausgabe (beide Dateien fehlerfrei).
- `grep -n "SELECT \* FROM users WHERE id = ?" server/src/services/absenceService.ts` → keine Zeile mehr.
- `grep -n "createWorkPeriodContext(" server/src/services/absenceService.ts` → 2 Aufrufstellen (Anreicherungs-`map`, `calculateAbsenceCredits`); `grep -n "createWorkPeriodContext(" server/src/services/exportService.ts` → 1 Aufrufstelle, außerhalb aller Schleifen. (Hinweis: `grep -c "createWorkPeriodContext"` ohne `(` zählt zusätzlich die Import-Zeile mit — die Acceptance-Criteria-Zahlen 2 bzw. 1 beziehen sich, wie im Klartext des Plans präzisiert, auf die tatsächlichen Aufrufstellen, nicht auf Textvorkommen inklusive Import.)
- Die Aufrufe bei `:828` und `:902` sind wörtlich identisch aufgebaut (gleiche Funktion, gleiche Argumentreihenfolge, gleicher Nutzerobjekt-Ursprung über `getUserForOvertimeCompCalculation()`).
- `cd server && npx vitest run src/services/absencePeriodAwareness.test.ts` → 4/4 grün.
- `cd server && npx vitest run src/services/absenceVacationBooking.test.ts` → 14/14 grün.
- `cd server && npx vitest run` (voller Serverlauf) → **370/373 grün, exakt die 3 vorbestehenden roten Tests** (2× `unifiedOvertimeService.test.ts`, 1× `vacationBackfillService.test.ts`, s. `.continue-here.md`) — kein neuer roter Test. Dies belegt zugleich, dass die parallel laufenden Pläne 11-05/11-06/11-08/11-11 zum Zeitpunkt dieses Laufs ebenfalls abgeschlossen waren (volle Suite, nicht mehr die 32 Fehlschläge aus dem 11-04-Zwischenzustand).
- `server/database/11-nullwirkung.db` nicht angefasst (kein Skript in diesem Plan hat darauf zugegriffen).
- `git diff --name-only` zeigt keine Änderung an `11-AUFRUFER-CHECKLISTE.md`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `absenceVacationBooking.test.ts` — Testnutzer ohne Arbeitszeitperiode**
- **Found during:** Task 1 (Verifikationslauf nach der Umstellung von `calculateAbsenceCredits`)
- **Issue:** `beforeEach` legte Testnutzer per rohem `INSERT INTO users` an (Umgehung von `createUser()`, das automatisch eine Periode anlegt). Test 7b („Überstundenausgleich — keine Urlaubsbuchung") warf `MissingWorkPeriodError`, weil `calculateAbsenceCredits` jetzt über `user_work_periods` auflöst statt über `users.weeklyHours`.
- **Fix:** `ensureInitialWorkPeriod()` (bereits in `userService.ts` vorhanden) im `beforeEach` für `userId` und `adminId` ergänzt.
- **Files modified:** `server/src/services/absenceVacationBooking.test.ts`
- **Commit:** `e1e09ca`

### Prozedurale Anmerkung (kein Rule-1-4-Fall)

Task 1 wurde als ein einzelner `feat`-Commit statt eines eigenen TDD-RED/GREEN-Zyklus
umgesetzt, weil Task 1 keine eigene Testdatei im Scope hat (`files_modified` nennt nur
`absenceService.ts`) — die Verhaltensabsicherung für alle vier Fundstellen liefert Task 3
(`absencePeriodAwareness.test.ts`), das im TDD-Sinn GREEN gegen die bereits in Task 1/2
implementierten Fundstellen läuft. Diese Struktur war im Plan selbst so angelegt (Tasks 1/2
Implementierung, Task 3 Test + Verifikation).

## Bekannte Beobachtung (nicht behoben, außerhalb des Scopes)

`approveAbsenceRequest()` berechnet die abzubuchenden Stunden für `overtime_comp` an ZWEI
unabhängigen Stellen: einmal über `calculateAbsenceCredits()` (in `updateBalancesAfterApproval`
→ `deductOvertimeHours()`, verändert `overtime_balance` direkt) und einmal über
`calculateAbsenceHoursWithWorkSchedule()` (die „Abbuchung" bei `:902`, über
`recordOvertimeCompensation()`, schreibt einen `overtime_transactions`-Eintrag). Beide
Mechanismen existierten bereits vor diesem Plan und wurden hier unverändert übernommen —
lediglich beide wurden periodenbewusst gemacht (beide liefern für das Testszenario korrekt
28h). Ob diese Doppelspurigkeit zu einer doppelten Verbuchung führt, war nicht Teil dieses
Plans (Task 1 verbietet ausdrücklich eine zweite Rechenregel, nicht eine zweite Buchungsstelle)
und wird hier zur weiteren Prüfung vermerkt statt stillschweigend übernommen.

## Self-Check: PASSED

- `server/src/services/absencePeriodAwareness.test.ts` — FOUND
- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-07.md` — FOUND
- Commits `e1e09ca`, `2db8525`, `a413ec7`, `3c3d884` — alle im Git-Log auffindbar (`git log --oneline --all | grep "11-07"`)
