---
phase: 14-absicherung-und-auslieferung
plan: 02
subsystem: server-api-security
tags: [security, work-periods, users, wr-07, req-33]
dependency-graph:
  requires: []
  provides:
    - "WorkPeriodBypassError (server/src/services/userService.ts)"
    - "PUT /api/users/:id -> 400 bei weeklyHours/workSchedule-Aenderung"
  affects:
    - "server/src/routes/users.ts"
    - "server/src/services/userWorkPeriodProvisioning.test.ts"
tech-stack:
  added: []
  patterns:
    - "Typisierter Servicefehler mit explizitem name-Feld fuer instanceof-Sicherheit ueber Modulgrenzen (Muster: WorkTimeChangeValidationError)"
    - "Abweisung VOR jedem Lese-/Schreibzugriff statt Rollback nach Teilschreibvorgang"
key-files:
  created:
    - .planning/phases/14-absicherung-und-auslieferung/14-WR07-ENTSCHEIDUNG.md
  modified:
    - server/src/services/userService.ts
    - server/src/routes/users.ts
    - server/src/services/userWorkPeriodProvisioning.test.ts
    - PROJECT_STATUS.md
decisions:
  - "WR-07 wird vor dem Produktionslauf geschlossen statt als bekannter Restposten mitzugehen (Umfang begrenzt und gemessen, Risiko beherrschbar weil EditUserModal weeklyHours bereits unveraendert sendet)"
  - "Abweisung greift nur bei tatsaechlicher Wertaenderung, nicht bei blosser Anwesenheit des Feldes, damit das Speichern unveraenderter Stammdaten weiter funktioniert"
  - "mirrorUserToWorkPeriod() (Seed-Skript-Helfer, userService.ts:220) bleibt unangetastet — sie ist nicht ueber die API erreichbar und mirrort in die entgegengesetzte Richtung (Stammdaten -> Periode, nicht Admin-Eingabe -> Periode ohne Nachweis)"
metrics:
  duration: "~10min"
  completed: "2026-08-23"
  tasks: 3
  files_modified: 5
---

# Phase 14 Plan 02: WR-07 schliessen — PUT /api/users/:id umgeht den Perioden-Schreibweg nicht mehr Summary

**One-liner:** `updateUser()` wirft jetzt `WorkPeriodBypassError` (HTTP 400) bei jeder
tatsächlichen `weeklyHours`/`workSchedule`-Änderung, bevor irgendetwas gelesen oder
geschrieben wird — der stille zweite Schreibweg an der Perioden-Historie vorbei (B-1 aus
`13-SECURITY.md`) ist entfernt, nicht nur die Folgewirkung auf `overtime_balance` (WR-09).

## Was gebaut wurde

**Task 1 — Abweisung statt Spiegelung.** `server/src/services/userService.ts`:
`export class WorkPeriodBypassError extends Error` (mit explizit gesetztem `name`, Muster
`WorkTimeChangeValidationError`). `updateUser()` berechnet `weeklyHoursChanged`/
`workScheduleChanged` jetzt direkt nach der `hireDate`-Formprüfung — **vor** dem Aufbau des
`UPDATE users`-SQL-Strings und vor `applyUpdate()` — und wirft bei einer Wertänderung sofort.
Die Meldung nennt wörtlich beide Ersatzwege: `POST /api/work-periods/change` und
`PUT /api/work-periods/:id`. Die beiden `if (data.weeklyHours !== undefined)`/
`if (data.workSchedule !== undefined)`-Zweige im dynamischen `UPDATE`-Aufbau sind entfernt
(nach der Abweisung nur noch für unveränderte Werte erreichbar, ein leerer Schreibvorgang).
Der komplette Spiegelungsblock in `applyUpdate()` (`getCurrentWorkPeriod` /
`ensureInitialWorkPeriod`-Sicherheitsnetz / `updateWorkPeriodValues(currentPeriod.id, ...)` /
`DELETE FROM overtime_balance`) und der nachgelagerte, dadurch unerreichbar gewordene
Neuberechnungsblock sind entfernt. Der `hireDate`-Zweig mit `syncStartPeriodToHireDate()` und
seinem eigenen `DELETE FROM overtime_balance` bleibt unverändert — er ist nicht Teil von
WR-07. `server/src/routes/users.ts` bildet `WorkPeriodBypassError` im `PUT /:id`-Handler auf
**HTTP 400** ab (vor dem generischen 500-Fallback), mit der Servicefehlermeldung im
Antwortkörper. `.planning/phases/14-absicherung-und-auslieferung/14-WR07-ENTSCHEIDUNG.md`
hält die Entscheidung, die vorgefundenen Zeilennummern, den Wortlaut des entfernten
Kommentarblocks und (nach Task 3) das Gate-Protokoll fest.

**Task 2 — Tests auf das neue Verhalten umgestellt.**
`server/src/services/userWorkPeriodProvisioning.test.ts`: Die beiden Erfolgstests für
`weeklyHours`-/`workSchedule`-Spiegelung erwarten jetzt `rejects.toThrow(WorkPeriodBypassError)`
und belegen zusätzlich, dass `users.weeklyHours`, die Periode (`getCurrentWorkPeriod`) und
`overtime_transactions` (Zeilenzahl vorher/nachher) unverändert bleiben. Der
Alt-Nutzer-ohne-Periode-Fall (`mirror-noperiod`) wirft jetzt ebenfalls ab — das
`ensureInitialWorkPeriod`-Sicherheitsnetz für diesen Fall ist mit dem gesamten Mirror-Zweig
entfallen, was der Test jetzt explizit über `getWorkPeriods(userId).length === 0` nach dem
Wurf zeigt. Der Atomaritätstest (`mirror-atomic`) demonstriert jetzt, welcher Fehler zuerst
greift: der auf `getCurrentWorkPeriod` gesetzte Mock wird bei einer geänderten `weeklyHours`
gar nicht mehr erreicht (`expect(spy).not.toHaveBeenCalled()`), weil `WorkPeriodBypassError`
bereits vorher wirft. Zwei Gegenproben (unverändertes Feld, unveränderter Wert) prüfen
explizit `resolves` statt implizit „wirft eben nicht". Ein neuer Test belegt wörtlich, dass
die Fehlermeldung beide Ersatzwege nennt. Der zusätzlich betroffene `chain-update`-Test im
Block „Vollständige Kette" (nicht in der Plan-Interfaces-Liste genannt, aber vom selben
Verhalten betroffen — Rule 1) ist ebenfalls auf `rejects.toThrow` umgestellt. 18/18 Tests
grün (vorher 17 `it`-Blöcke, ein neuer hinzugekommen).

**Task 3 — Gates gefahren, Restposten geschlossen.** Alle vier Pflichtgates grün: Server-`tsc`
(Exit 0), Desktop-`tsc` (Exit 0), `cd server && npx vitest run` (3 rot, 493 grün — die drei
roten Titel wörtlich identisch mit dem in `11-AUSGANGSZUSTAND.md` benannten Bestand, kein
vierter oder geänderter Titel), Desktop `npm run check:rules` (61 PASS-Zeilen über drei
Prüfskripte, Exit 0). `PROJECT_STATUS.md` führt den Restposten „PUT /api/users/:id umgeht den
Perioden-Schreibweg" jetzt als `🔒 GESCHLOSSEN (Phase 14, Plan 14-02)`.

## Sicherheits-Audit: Bypass-Nachweis (verbindlich laut Ausführungsauftrag)

Die drei vorgegebenen Greps wurden nach der Änderung erneut gegen `server/src` gefahren
(non-test, wie im Ausführungsauftrag vorgescannt):

```
grep -rln -iE "(INSERT +INTO|UPDATE|DELETE +FROM) +user_work_periods" --include=*.ts . | grep -v '\.test\.ts$'
→ database/migrations/009_backfill_user_work_periods.ts
→ database/migrations/013_soft_delete_user_work_periods.ts
→ services/workPeriodService.ts
```
Identisch mit dem vorgescannten Bestand — keine neue Datei, kein neuer Schreibpfad.

```
grep -rn -E "UPDATE\s+users" --include=*.ts . | grep -v '\.test\.ts:'
→ scripts/seedTestUsers.ts:64 (Seed-Skript)
→ services/settingsService.ts:42, :89 (password/email)
→ services/userService.ts:573 (das jetzt durch WorkPeriodBypassError vor jeder
  Wertänderung geschützte dynamische UPDATE)
→ services/userService.ts:762, 795, 830, 929, 1096, 1149 (deletedAt/status/
  privacyConsentAt/password — geprüft, keiner davon betrifft weeklyHours/workSchedule)
```
Identisch mit dem vorgescannten Bestand — Zeile 573 (vormals 549 vor der Änderung) ist die
einzige dynamische Stelle, und sie ist jetzt durch die Abweisung geschützt.

```
grep -rn -E "weeklyHours|workSchedule" --include=*.ts . | grep -v '\.test\.ts:' | grep -iE "update|insert|set "
→ 6 Seed-/Testnutzer-Skripte (scripts/create*.ts, scripts/seedTestUsers.ts): INSERT bei
  Neuanlage, kein UPDATE-Pfad
→ services/userService.ts:246 — updateWorkPeriodValues(current.id, user.weeklyHours,
  desiredSchedule) INNERHALB von mirrorUserToWorkPeriod()
→ services/workPeriodCorrectionService.ts:361, :383 — der mandatory-reason-Pfad
  (Vorschau-Token + Pflichtbegründung + Kettenprüfung + Rebuild + Journalzeile)
→ services/workPeriodService.ts:365, :456 — derselbe legitime, geschützte Weg
```

**Explizite Antwort auf die geforderte Frage:** `mirrorUserToWorkPeriod()`
(`userService.ts:220-248`) ist der einzige verbliebene Aufrufer von `updateWorkPeriodValues`
außerhalb des mandatory-reason-Pfads. Geprüft: `grep -rn "mirrorUserToWorkPeriod"` zeigt genau
einen Aufrufer, `scripts/seedTestUsers.ts:110` — ein CLI-Skript mit Dateisystemzugang, **nicht
über die API erreichbar**. Sie mirrort außerdem in die entgegengesetzte Richtung als der
frühere Bypass: Stammdaten (`users`-Zeile) → Periode, zur Selbstheilung nach einem
Seed-Update, nicht Admin-Eingabe über eine HTTP-Route → Periode ohne Nachweis. Sie ist keine
Angriffsfläche der REST-API. **Es existiert kein verbleibender Schreibweg zu
`users.weeklyHours`/`users.workSchedule`/`user_work_periods`, der nicht entweder (a) über den
mandatory-reason + preview-token + rebuild + journal-Pfad läuft, (b) eine Migration/ein
Offline-Seed-Skript ist, oder (c) `mirrorUserToWorkPeriod()` — ein nicht API-erreichbarer
Seed-Helfer.**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] `chain-update`-Test im Block „Vollständige Kette" war nicht in der
Plan-Interfaces-Liste genannt, wäre aber durch die Verhaltensänderung sofort rot geworden**
- **Gefunden während:** Task 2, beim vollständigen Testlauf nach der Umstellung der fünf
  explizit genannten Blöcke.
- **Problem:** `it('nach updateUser mit geänderten Wochenstunden bleibt checkPeriodChain
  ok: true...')` rief `updateUser(user.id, { weeklyHours: 15 })` mit einem tatsächlich
  geänderten Wert auf und erwartete Erfolg — nach der WR-07-Änderung wirft dieser Aufruf.
- **Fix:** Test auf `rejects.toThrow(WorkPeriodBypassError)` umgestellt, die übrigen
  Zusicherungen (Kettenprüfung bleibt `ok: true`, weiterhin genau 1 Periode) unverändert
  gelassen, da sie unabhängig vom Wurf weiterhin zutreffen.
- **Dateien:** `server/src/services/userWorkPeriodProvisioning.test.ts`
- **Commit:** eb43167

### Bewusst nicht verändert (aus der Plan-Diskussion)

- `recalculateOvertimeForUser()` (`userService.ts`, ehemals mit Aufrufern in den entfernten
  Neuberechnungsblöcken) ist jetzt tote Funktion innerhalb des Moduls — nicht exportiert, kein
  verbleibender Aufrufer. `noUnusedLocals: false` in `server/tsconfig.json` verhindert einen
  `tsc`-Fehler dadurch nicht wird sie aber auch nicht angemahnt. Nicht entfernt, weil der Plan
  ausschließlich die Aufrufstelle (Schritt 5 der Task-1-Anweisung), nicht die Funktionsdefinition
  selbst nennt — als beobachtete tote Stelle hier dokumentiert statt stillschweigend mitentfernt.

## Threat Flags

Keine. Dieser Plan schließt eine bestehende Angriffsfläche (Schreibweg ohne Nachweis), er
öffnet keine neue: kein neuer Endpunkt, kein neuer Auth-Pfad, kein neues Schema. Die einzige
neue Fehlerklasse (`WorkPeriodBypassError`) trägt keine Nutzdaten, die Meldung nennt zwei
interne Endpunktpfade — Empfänger ist derselbe authentifizierte Admin, der den ursprünglichen
Aufruf getätigt hat (kein Informationsgewinn gegenüber dem Status quo).

## Known Stubs

Keine.

## Verifikation gegen die Plan-Abnahmekriterien

- `grep -n "class WorkPeriodBypassError" server/src/services/userService.ts` → genau ein
  Treffer, `export class`. ✅
- `grep -n "updateWorkPeriodValues" server/src/services/userService.ts` → kein Treffer mehr
  innerhalb von `updateUser()` (die verbleibenden zwei Treffer sind Import und
  `mirrorUserToWorkPeriod()`, ein anderer, nicht betroffener Aufrufer). ✅
- `grep -n "mustMirrorPeriod" server/src/services/userService.ts` → kein Treffer. ✅
- `grep -n "WorkPeriodBypassError" server/src/routes/users.ts` → zwei Treffer, einer davon in
  Nachbarschaft von `400`. ✅
- `cd server && npx tsc --noEmit` → Exit 0. ✅
- `cd desktop && npx tsc --noEmit` → Exit 0. ✅
- `cd server && npx vitest run` → `3 failed | 493 passed (496)`, die drei Titel unverändert
  gegenüber dem Ausgangsbestand. ✅
- `cd desktop && npm run check:rules` → Exit 0. ✅
- `grep -n "GESCHLOSSEN (Phase 14, Plan 14-02)" PROJECT_STATUS.md` → ein Treffer. ✅
- `grep -n "🔓 OFFEN" PROJECT_STATUS.md` → kein Treffer mehr. ✅
- `cd server && npx vitest run src/services/userWorkPeriodProvisioning.test.ts` → 18 Tests,
  `0 failed`. ✅

## Self-Check: PASSED

Alle sechs behaupteten Dateien vorhanden (`server/src/services/userService.ts`,
`server/src/routes/users.ts`, `server/src/services/userWorkPeriodProvisioning.test.ts`,
`PROJECT_STATUS.md`, `.planning/phases/14-absicherung-und-auslieferung/14-WR07-ENTSCHEIDUNG.md`,
diese Datei). Alle vier zitierten Commit-Hashes (`e7187ff`, `eb43167`, `c8f86d0`, `4af3562`) im
Git-Log gefunden.
