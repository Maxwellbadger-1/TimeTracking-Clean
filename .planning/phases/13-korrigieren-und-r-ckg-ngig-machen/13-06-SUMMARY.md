---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 06
subsystem: api
tags: [sqlite, better-sqlite3, overtime, kontoauszug, storno, reversal]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 01)
    provides: "Migration 014 — overtime_transactions.reversalOf (Selbstreferenz-Spalte plus Teilindex), overtimeTransactionManager.createTransaction() akzeptiert reversalOf"
provides:
  - "calculateLiveOvertimeTransactions() liefert für jede model_change-Zeile id, reversalOf, reversedBy, reversedAt, reversedByName"
  - "Beide Zeilen eines Storno-Paars tragen dieselbe referenceId (die Id der Originalbuchung, DD-24) als gemeinsame Belegnummer"
  - "Stabile Sortierung: Original steht bei gleichem Datum unmittelbar vor seiner Gegenbuchung (ot.date DESC, ot.id ASC)"
affects: [13-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Selbst-Join auf overtime_transactions (LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id) leitet die Rückrichtung des Storno-Paars ab, statt eine redundante Spalte auf der Originalzeile zu führen (DD-25, konsistent mit 13-01-PLAN.md DD-4)"
    - "documentedDelta bleibt für Gegenbuchungen der wortgleiche Pfad wie für das Original — kein zweiter Sonderzweig (DD-26), verhindert den in Phase 12 behobenen Doppelzählungs-Bug"

key-files:
  created: []
  modified:
    - server/src/services/overtimeLiveCalculationService.ts
    - server/src/services/overtimeLiveCalculationService.test.ts

key-decisions:
  - "referenceId auf beiden Paarzeilen ist row.reversalOf ?? row.id (DD-24) — die Id der Buchungszeile selbst, nicht der Periode, weil eine Periode mehrere Storno-Paare tragen kann und deshalb keine eindeutige Belegnummer wäre"
  - "id/reversalOf/reversedBy/reversedAt/reversedByName sind ausschließlich bei type === 'model_change' gesetzt — keine Bedeutungsänderung für die übrigen sechs Transaktionstypen"
  - "Test-Cleanup löscht user_work_periods NICHT explizit (der BEFORE-DELETE-Riegel aus Migration 008/010 würde ein echtes DELETE der letzten Periode verweigern) — das Löschen des Nutzers räumt über ON DELETE CASCADE auf, wie bereits in den bestehenden D7-/CR-01-Testblöcken derselben Datei vorgemacht"

requirements-completed: [REQ-31]

# Metrics
duration: ~35min
completed: 2026-08-22
---

# Phase 13 Plan 06: Kontoauszug-Lesepfad für das Storno-Paar Summary

**`calculateLiveOvertimeTransactions()` liefert jetzt für jede `model_change`-Zeile ihre eigene Id sowie — über einen Selbst-Join auf `reversalOf` — den vollständigen, maschinenlesbaren Bezug zu ihrer Gegenbuchung, ohne die non-summierende `hours: 0`/`documentedDelta`-Regel aus Phase 12 zu verletzen.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-22T18:24:00Z (geschätzt)
- **Completed:** 2026-08-22T18:59:20Z
- **Tasks:** 2/2 completed
- **Files modified:** 2

## Accomplishments

- `LiveOvertimeTransaction` um fünf neue, optionale Felder erweitert (`id`, `reversalOf`, `reversedBy`, `reversedAt`, `reversedByName`), jeweils dokumentiert als nur bei `type === 'model_change'` gesetzt
- `modelChangeQuery` liest zusätzlich `ot.reversalOf` und leitet über `LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id` plus `LEFT JOIN users ru ON ru.id = r.createdBy` die Rückrichtung ab (welche Zeile diese Original-Buchung storniert hat, wann, von wem) — kein `any`, weiterhin ein Prepared Statement ohne Zeichenkettenverkettung von Werten
- `referenceId` trägt jetzt auf beiden Zeilen des Storno-Paars denselben Wert (`row.reversalOf ?? row.id`, DD-24) — der bestehende Beleg-Chip-Text im Textbuch funktioniert damit unverändert für beide Zeilen
- Sortierung um `ot.id ASC` als zweites Kriterium ergänzt (`ORDER BY ot.date DESC, ot.id ASC`, DD-27) — bei gleichem Datum steht das Original nachweisbar stabil vor seiner Gegenbuchung; die äußere `transactions.sort()` ist stabil (Array.prototype.sort, garantiert seit ES2019) und erhält diese Reihenfolge, weil beide Zeilen dieselbe Typpriorität (`model_change: 4`) tragen
- Route `GET /api/overtime/transactions/live` (`server/src/routes/overtime.ts:519`) reicht `LiveOvertimeTransaction[]` unverändert durch — keine engere Zwischentyp-Abbildung gefunden, keine Anpassung dort nötig
- Zwei neue Tests im bestehenden `overtimeLiveCalculationService.test.ts` (Präfix `test-13-06-`) legen ein echtes Storno-Paar direkt über `createTransaction()` an und weisen alle sieben in der Planung geforderten Zusicherungen nach (Vollständigkeit, beidseitiger Bezug, gemeinsame Belegnummer, `hours: 0`/entgegengesetztes `documentedDelta`, unveränderte Anzeigesumme, Nachbarschaft, `reversedByName` gesetzt/`null`)

## Task Commits

1. **Task 1: Storno-Felder im Kontoauszug-Lesepfad** - `c7b1dda` (feat)
2. **Task 2: Tests für das Storno-Paar im Kontoauszug** - `9491b05` (test)

## Files Created/Modified

- `server/src/services/overtimeLiveCalculationService.ts` - `LiveOvertimeTransaction` um fünf Felder erweitert, `modelChangeQuery` um Selbst-Join und `reversalOf` erweitert, `referenceId`-Logik auf DD-24 umgestellt, Sortierung um `ot.id ASC` ergänzt
- `server/src/services/overtimeLiveCalculationService.test.ts` - neuer `describe`-Block „Storno-Paar (Phase 13, REQ-31)" mit zwei Tests, `createTransaction`-Import ergänzt

## Decisions Made

Siehe `key-decisions` im Frontmatter oben. Keine Abweichung von den in 13-06-PLAN.md festgelegten DD-24 bis DD-27 — alle vier Design-Entscheidungen wurden wörtlich umgesetzt.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Test-Cleanup schlug am BEFORE-DELETE-Riegel von `user_work_periods` fehl**
- **Found during:** Task 2, beim ersten Testlauf der neuen Tests
- **Issue:** Das ursprüngliche `afterEach` löschte `user_work_periods` explizit vor `users` — `trg_user_work_periods_delete_guard` (Migration 008/010) verweigert ein echtes `DELETE`, das den Nutzer periodenlos zurückließe, und wirft `SqliteError: user_work_periods: Löschen würde den Nutzer ohne jede Periode zurücklassen`. Der fehlgeschlagene Cleanup ließ zusätzlich Datensätze mit dem Präfix `test-13-06-` in der Arbeitsdatenbank zurück, wodurch der zweite Testlauf mit `UNIQUE constraint failed: users.email` fehlschlug.
- **Fix:** Das explizite `DELETE FROM user_work_periods` entfernt — `users` trägt `ON DELETE CASCADE` auf `user_work_periods` (schema.ts), das Löschen des Nutzers räumt seine Periode(n) mit auf, ohne den Riegel zu verletzen. Exakt das Muster, das die bestehenden `D7`-/`CR-01`-Testblöcke in derselben Datei bereits verwenden. Zusätzlich wurden die durch den fehlgeschlagenen Lauf zurückgelassenen `test-13-06-*`-Datensätze manuell aus `server/database/development.db` entfernt (kein Code-Fix, reine Datenbereinigung).
- **Files modified:** server/src/services/overtimeLiveCalculationService.test.ts
- **Verification:** `npx vitest run src/services/overtimeLiveCalculationService.test.ts` — 14/14 grün; `npx vitest run` (voller Lauf) — 437 grün / 3 rot (Baseline aus 13-02-SUMMARY.md unverändert)
- **Committed in:** 9491b05 (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (Rule 3 — Blocking, notwendig für einen grünen Testlauf und eine saubere Arbeitsdatenbank)
**Impact on plan:** Reine Testinfrastruktur-Korrektur innerhalb der von Task 2 ohnehin berührten Testdatei. Kein Scope-Creep, keine Änderung am Produktionscode aus Task 1.

## Issues Encountered

Keine über die oben dokumentierte Deviation hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten, keine neue Migration (Migration 014 lief bereits in Plan 13-01).

## Next Phase Readiness

- Plan 13-10 (Oberfläche: Zustands-Badges, Beleg-Chip, Sprungmarke im Kontoauszug) kann `id`, `reversalOf`, `reversedBy`, `reversedAt`, `reversedByName` und die gemeinsame `referenceId` direkt aus `GET /api/overtime/transactions/live` lesen — keine weitere Serveränderung nötig, die Route reicht den erweiterten Vertrag bereits unverändert durch.
- Der Löschweg (D2/D3, vermutlich Plan 13-04) muss beim Anlegen der Gegenbuchung `reversalOf` auf die Id der stornierten `model_change`-Zeile setzen — dieser Plan hat den Lesepfad vorbereitet, aber keinen Schreibpfad für echte Stornierungen aus der Oberfläche heraus gebaut (das war nicht Teil dieses Plans; Task 2 legt das Paar direkt über `createTransaction()` an, um den Lesepfad isoliert zu prüfen).

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Beide Commit-Hashes (c7b1dda, 9491b05) in `git log --oneline --all` verifiziert.
`server/src/services/overtimeLiveCalculationService.ts` enthält `reversalOf?: number | null`,
`reversedBy?: number | null`, `reversedAt?: string | null`, `reversedByName?: string | null`,
`id?: number` in `LiveOvertimeTransaction` sowie `LEFT JOIN overtime_transactions r ON r.reversalOf = ot.id`
und `referenceId: row.reversalOf ?? row.id`. `npx tsc --noEmit` Exit 0. `npx vitest run` — 437 grün / 3 rot
(Baseline aus 13-02-SUMMARY.md unverändert: 2× unifiedOvertimeService.test.ts, 1× vacationBackfillService.test.ts).
