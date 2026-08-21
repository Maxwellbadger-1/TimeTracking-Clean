---
phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
plan: 03
subsystem: ui
tags: [react, typescript, tanstack-query, tailwind, forms]

# Dependency graph
requires:
  - phase: 06-buchungen-bei-jedem-vorgang
    provides: "Serverseitiger Vertrag POST /api/vacation-balances mit reason → correction-Buchung, leere Zeichenkette → 400"
provides:
  - "Pflichtfeld `reason` im Upsert-Vertrag (VacationBalanceCreateInput) zwischen Admin-Dialog und Server"
  - "Admin-Dialog verlangt eine Begründung (min. 5 Zeichen) und sendet sie als `reason`"
  - "Kontoauszug-Query (`vacation-transactions`) wird nach Urlaubskonto-Änderungen automatisch invalidiert"
affects: [08-04, kontoauszug-verifikation]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Formular-Pflichtfeld mit clientseitiger Mindestlängen-Validierung, die serverseitige 400-Regel client-seitig vorwegnimmt"
    - "Zentrale invalidationHelpers.ts-Gruppe um neue Query-Keys erweitern statt Ad-hoc-Invalidierung im Hook"

key-files:
  created: []
  modified:
    - desktop/src/hooks/useVacationBalanceAdmin.ts
    - desktop/src/hooks/invalidationHelpers.ts
    - desktop/src/components/vacation/VacationBalanceEditModal.tsx

key-decisions:
  - "reason ist in VacationBalanceCreateInput nicht optional, damit ein Aufruf ohne Begründung schon beim Typcheck auffällt; in VacationBalanceUpdateInput bleibt es optional, da useUpdateVacationBalance vom Frontend nicht verwendet wird"
  - "Mindestlänge 5 Zeichen client-seitig gewählt, um Platzhalter wie 'x' zu verhindern und sich an die serverseitige Ablehnung leerer Zeichenketten anzulehnen"
  - "Kein neues Input-Wrapper-Component für die Begründung — natives textarea mit den Dark-Mode-Klassen der bestehenden Input.tsx nachgebildet, da Input.tsx kein textarea unterstützt"

patterns-established: []

requirements-completed: [REQ-12]

# Metrics
duration: 4min
completed: 2026-08-20
---

# Phase 08 Plan 03: Begründungspflicht im Admin-Dialog für Urlaubskonto-Korrekturen Summary

**Admin-Dialog verlangt jetzt eine Begründung (min. 5 Zeichen), sendet sie als `reason` an `POST /api/vacation-balances`, und der Kontoauszug invalidiert sich nach der Korrektur automatisch.**

## Performance

- **Duration:** 4 min
- **Started:** 2026-08-20T20:45:06+02:00 (Basis-Commit)
- **Completed:** 2026-08-20T20:49:03+02:00
- **Tasks:** 2/2
- **Files modified:** 3

## Accomplishments
- `VacationBalanceCreateInput.reason` ist Pflichtbestandteil des Upsert-Vertrags (Typcheck erzwingt Aufruf mit Begründung)
- `vacation-transactions` ist Teil der zentralen `vacation`-Invalidierungsgruppe, sodass der Kontoauszug nach Korrektur/Genehmigung/Storno ohne manuelles Neuladen aktualisiert wird
- `VacationBalanceEditModal` hat ein neues Pflichtfeld „Begründung" mit Mindestlängen-Validierung, Reset bei Dialog-Wechsel/-Schließen, und Hinweistext zur Sichtbarkeit im Kontoauszug

## Task Commits

Each task was committed atomically:

1. **Task 1: reason im Anfragevertrag und Auszug-Invalidierung** - `1635c70` (feat)
2. **Task 2: Pflichtfeld Begründung im Admin-Dialog** - `de42725` (feat)

**Plan metadata:** committed together with this SUMMARY.md (worktree mode — orchestrator commits STATE.md/ROADMAP.md separately)

## Files Created/Modified
- `desktop/src/hooks/useVacationBalanceAdmin.ts` - `reason: string` (Pflicht) in `VacationBalanceCreateInput`, `reason?: string` (optional) in `VacationBalanceUpdateInput`
- `desktop/src/hooks/invalidationHelpers.ts` - `'vacation-transactions'` zur `vacation`-Query-Gruppe ergänzt
- `desktop/src/components/vacation/VacationBalanceEditModal.tsx` - Neues Textarea-Feld „Begründung *", Validierung, Reset-Logik, Hinweistext, `reason: reason.trim()` im Request

## Decisions Made
- `reason` in `VacationBalanceCreateInput` nicht-optional gemacht (Typcheck-Sicherheit statt Laufzeit-Prüfung)
- Mindestlänge 5 Zeichen für die Begründung (deckt sich mit der serverseitigen Ablehnung leerer Strings, verhindert Trivial-Eingaben)
- Natives `textarea` statt neuer Komponente, mit den bestehenden Dark-Mode-Klassen von `Input.tsx` nachgebildet

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `VacationBalanceEditModal` und der Upsert-Vertrag sind bereit; die serverseitige Korrekturbuchung aus Phase 6 erhält nun immer eine echte Begründung aus der Oberfläche
- Der Kontoauszug (`vacation-transactions`) lädt nach einer Admin-Korrektur automatisch neu
- Die tatsächliche Sichtprüfung (Korrektur mit eigenem Text im Kontoauszug sichtbar) ist laut Plan-Verifikation Teil des Human-Verify-Checkpoints von Plan 08-04

---
*Phase: 08-kontoauszug-f-r-mitarbeiter-und-admin*
*Completed: 2026-08-20*

## Self-Check: PASSED

All modified files verified present (`useVacationBalanceAdmin.ts`, `invalidationHelpers.ts`, `VacationBalanceEditModal.tsx`). All commits verified in `git log` (`1635c70`, `de42725`, `0432da7`).
