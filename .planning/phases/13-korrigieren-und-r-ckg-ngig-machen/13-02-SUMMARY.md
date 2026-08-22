---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 02
subsystem: database
tags: [sqlite, better-sqlite3, soft-delete, work-periods, typescript-contracts]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 01)
    provides: "Migration 013 (deletedAt/deletedBy + work_period_chain_guard auf user_work_periods), Migration 014 (reversalOf auf overtime_transactions)"
  - phase: 12-stundenwechsel-bedienen
    provides: "applyWorkTimeChange()/PreviewRollback-Muster in workPeriodChangeService.ts, das dieser Plan zur Wiederverwendung freigibt"
provides:
  - "getWorkPeriods()/getCurrentWorkPeriod() filtern deletedAt IS NULL — weggenommene Perioden erreichen keinen Berechnungspfad mehr"
  - "softDeleteWorkPeriod() als der eine Soft-Delete-Schreibweg (D2), extendWorkPeriodTo() als der eine Lückenschluss-Schreibweg inkl. null (D3/DD-7)"
  - "getWorkPeriodById(), withSuspendedChainGuard(), getWorkPeriodsWithFlags() (isFirst/isCurrent serverseitig, DD-6)"
  - "Verträge WorkPeriodCorrectionInput/Preview/Outcome, WorkPeriodDeletionInput/Preview/Outcome, UserWorkPeriodListItem in types/index.ts"
  - "workPeriodChangeService.ts: toGermanDate/formatWeeklyHoursDe/workScheduleEquals/sumTargetHoursInRange/monthsInRange exportiert, PreviewRollback<T> generisch, runWithPreviewRollback() als geteilte Trockenlauf-Hülle"
affects: [13-03, 13-04, 13-05, 13-06]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ein Sammel-Lesepfad (getWorkPeriods) trägt den deletedAt-Filter zentral — jeder Aufrufer (workPeriodContext.ts, resolveWorkPeriodAt, checkPeriodChain) erbt ihn automatisch, keine zweite Filterstelle nötig"
    - "Zwei getrennte Schreibfunktionen (closeWorkPeriod unverändert vs. extendWorkPeriodTo neu) statt eine Funktion nachträglich um ein optionales Argument zu erweitern — vermeidet Nichtregressions-Prüfung an bestehenden Aufrufern"
    - "withSuspendedChainGuard<T>(fn) mit try/finally-Rücksetzung, verbindliche Nutzungsbedingung (nur innerhalb db.transaction(), sofort gefolgt von checkPeriodChain()) im Kopfkommentar dokumentiert, nicht erzwungen"
    - "Freigabe interner Bausteine (Phase 12) über zusätzliche export-Schlüsselwörter und eine generische Hülle (PreviewRollback<T>/runWithPreviewRollback) statt Kopie — kein Dual Calculation System"

key-files:
  created: []
  modified:
    - server/src/services/workPeriodService.ts
    - server/src/services/workPeriodChangeService.ts
    - server/src/types/index.ts
    - server/src/scripts/verifyDesktopEffectiveness.ts
    - server/src/scripts/snapshotBalances.ts
    - server/src/scripts/applyMigrationsToCopy.ts
    - server/src/services/workPeriodService.test.ts
    - server/src/test-support/workPeriodFixtures.ts

key-decisions:
  - "UserWorkPeriod/UserWorkPeriodRow um deletedAt/deletedBy erweitert (nicht nur UserWorkPeriodRow wie im Plantext wörtlich stand) — DD-6 verlangt 'UserWorkPeriod bleibt die reine Abbildung der Tabellenzeile', und Migration 013 hat der Tabellenzeile diese beiden Spalten bereits hinzugefügt; rowToWorkPeriod() hätte sonst nicht kompiliert"
  - "UserWorkPeriodListItem zunächst lokal in workPeriodService.ts definiert (Task 1), dann nach types/index.ts verschoben und von dort reimportiert (Task 2) — vermeidet einen Kompilierfehler zwischen den beiden Task-Commits, ohne die geforderte zentrale Lage in types/index.ts (Task-2-Abnahmekriterium) zu verfehlen"
  - "workPeriodFixtures.ts (stubWorkPeriodContext) und workPeriodService.test.ts (makePeriod-Helper) um deletedAt: null/deletedBy: null ergänzt (Rule 3 — Typfehler durch die UserWorkPeriod-Erweiterung, blockierte tsc --noEmit)"
  - "Kommentartext 'DELETE FROM user_work_periods' zweimal umformuliert zu 'ein echtes DELETE-Statement auf dieser Tabelle' — das wörtliche Acceptance-Grep auf 'DELETE FROM user_work_periods' hätte sonst auch Kommentare (keine echten DELETE-Aufrufe) als Treffer gezählt"
  - "applyMigrationsToCopy.ts: deletedAt IS NULL unbedingt (nicht defensiv per PRAGMA table_info geprüft) — die Kennzahl wird erst NACH runMigrations() erhoben, zu dem Zeitpunkt hat Migration 013 die Spalte immer schon angelegt"

requirements-completed: [REQ-31]

# Metrics
duration: ~35min
completed: 2026-08-22
---

# Phase 13 Plan 02: Datenmodell-Unterbau für Korrigieren/Löschen Summary

**deletedAt-bewusste Lesepfade, ein Soft-Delete- und ein Lückenschluss-Schreibweg, serverseitige isFirst/isCurrent-Flags und die Verträge für Korrektur/Löschung — plus Freigabe der Phase-12-Rechenbausteine (PreviewRollback, sumTargetHoursInRange, monthsInRange) zur Wiederverwendung durch Plan 13-03/13-04.**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-08-22T18:15:00Z (geschätzt)
- **Completed:** 2026-08-22T18:51:02Z
- **Tasks:** 3/3 completed
- **Files modified:** 8

## Accomplishments

- `getWorkPeriods()`/`getCurrentWorkPeriod()` filtern `deletedAt IS NULL` — da `workPeriodContext.ts`, `resolveWorkPeriodAt()` und `checkPeriodChain()` ausschließlich über `getWorkPeriods()` laden, erreicht der Filter die gesamte Sollstunden-Berechnung mit einer einzigen Änderungsstelle
- `softDeleteWorkPeriod(periodId, deletedBy)` als der eine Soft-Delete-Schreibweg (D2): setzt `deletedAt`/`deletedBy` über `datetime('now')`, wirft bei bereits gelöschter Periode
- `extendWorkPeriodTo(periodId, validTo)` als der eine Lückenschluss-Schreibweg, der auch `null` (offene Periode) setzen kann (DD-7) — `closeWorkPeriod()` aus Phase 10 bleibt dabei unverändert
- `getWorkPeriodById()`, `withSuspendedChainGuard<T>()` (Riegel-Aussetzung mit garantierter `finally`-Rücksetzung) und `getWorkPeriodsWithFlags()` (`isFirst`/`isCurrent` serverseitig über `resolveWorkPeriodIn`, kein zweiter Intervallvergleich) ergänzt
- Drei Prüfskripte (`verifyDesktopEffectiveness.ts`, `snapshotBalances.ts`, `applyMigrationsToCopy.ts`) filtern jetzt `deletedAt IS NULL`, damit ihre Kennzahlen nach Phase 13 mit den Vorher-Messungen aus Phase 11/12 vergleichbar bleiben
- Sieben neue Verträge in `types/index.ts`: `UserWorkPeriodListItem`, `WorkPeriodCorrectionInput/Preview/PreviewResponse/Outcome`, `WorkPeriodDeletionInput/Preview/PreviewResponse/Outcome` — Feldnamen exakt aus 13-UI-SPEC.md übernommen, Abweichung (`reversedTransactions` als Liste statt `reversedTransaction` im Singular) im Typkommentar dokumentiert
- `workPeriodChangeService.ts`: `toGermanDate`, `formatWeeklyHoursDe`, `workScheduleEquals`, `sumTargetHoursInRange`, `monthsInRange` exportiert; `PreviewRollback` generisch gemacht (`PreviewRollback<T>`) und `runWithPreviewRollback<T>()` als geteilte Trockenlauf-Hülle ergänzt — `applyWorkTimeChange()` ruft sie jetzt auf statt den try/catch-Block inline zu führen; Phase-12-Verhalten unverändert (23/23 Tests weiterhin grün)
- 8 neue Verhaltenstests (Präfix `test-13-02-`) belegen Filter, beide Schreibwege, die Flags und die Riegel-Rücksetzung auch im Ausnahmefall

## Task Commits

1. **Task 1: Lesepfade filtern, Soft-Delete- und Lückenschluss-Schreibweg anlegen** - `842aa14` (feat)
2. **Task 2: Verträge für Korrektur und Löschung, Freigabe der Phase-12-Rechenbausteine** - `0c851ea` (feat)
3. **Task 3: Tests für Filter, Flags und die beiden neuen Schreibwege** - `6189514` (test)

## Files Created/Modified

- `server/src/services/workPeriodService.ts` - deletedAt-Filter auf den beiden Sammel-Lesepfaden, vier neue Schreib-/Lesefunktionen, Kommentare an den vier Rücklese-Stellen
- `server/src/services/workPeriodChangeService.ts` - fünf Helfer exportiert, `PreviewRollback<T>` generisch, `runWithPreviewRollback()` neu
- `server/src/types/index.ts` - `deletedAt`/`deletedBy` auf `UserWorkPeriod`/`UserWorkPeriodRow`, sieben neue Phase-13-Verträge
- `server/src/scripts/verifyDesktopEffectiveness.ts` - vier Abfragen um `deletedAt IS NULL` erweitert
- `server/src/scripts/snapshotBalances.ts` - eine Abfrage um `deletedAt IS NULL` erweitert
- `server/src/scripts/applyMigrationsToCopy.ts` - eine Abfrage um `deletedAt IS NULL` erweitert
- `server/src/services/workPeriodService.test.ts` - 8 neue Tests, `makePeriod()`-Fixture um `deletedAt`/`deletedBy` ergänzt
- `server/src/test-support/workPeriodFixtures.ts` - `stubWorkPeriodContext()`-Fixture um `deletedAt`/`deletedBy` ergänzt (Typfehler-Fix)

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `UserWorkPeriod`/`UserWorkPeriodRow` mussten um `deletedAt`/`deletedBy` erweitert werden**
- **Found during:** Task 1, unmittelbar nach der `rowToWorkPeriod()`-Änderung
- **Issue:** Der Plantext nennt für Task 1 wörtlich nur „UserWorkPeriodRow und rowToWorkPeriod() entsprechend ergänzen" — `rowToWorkPeriod()` gibt aber ein `UserWorkPeriod` zurück; ohne die beiden Felder auch dort hätte `tsc --noEmit` mit einem Typfehler abgebrochen
- **Fix:** Beide Felder auf `UserWorkPeriod` UND `UserWorkPeriodRow` ergänzt (Migration 013 hat sie der zugrunde liegenden Tabellenzeile bereits hinzugefügt — DD-6 nennt `UserWorkPeriod` ausdrücklich „die reine Abbildung der Tabellenzeile")
- **Files modified:** server/src/types/index.ts
- **Verification:** `npx tsc --noEmit` Exit 0
- **Committed in:** 842aa14 (Task 1 commit)

**2. [Rule 3 - Blocking] Zwei Test-Support-Dateien kompilierten nach der Typerweiterung nicht mehr**
- **Found during:** Task 1, beim ersten `tsc --noEmit`-Lauf
- **Issue:** `workPeriodFixtures.ts` (`stubWorkPeriodContext`) und `workPeriodService.test.ts` (`makePeriod()`-Helper) bauen `UserWorkPeriod`-Objektliterale ohne `deletedAt`/`deletedBy` — beide Dateien waren nach der Typerweiterung unvollständig und `tsc --noEmit` schlug fehl
- **Fix:** Beide Fixture-Funktionen um `deletedAt: null, deletedBy: null` (bzw. `overrides.deletedAt ?? null`) ergänzt
- **Files modified:** server/src/test-support/workPeriodFixtures.ts, server/src/services/workPeriodService.test.ts
- **Verification:** `npx tsc --noEmit` Exit 0, bestehende 37 Tests weiterhin grün
- **Committed in:** 842aa14 (Task 1 commit)

**3. [Rule 1 - Bug] Kopfkommentare enthielten den wörtlichen Text des verbotenen Musters**
- **Found during:** Task 1, beim Ausführen des Abnahme-Greps `grep -rn "DELETE FROM user_work_periods" server/src --include=*.ts | grep -v "\.test\.ts"`
- **Issue:** Zwei erklärende Kommentare zitierten den Text „DELETE FROM user_work_periods" wörtlich, um zu erklären, wofür der Trigger schützt — das ließ den Abnahme-Grep fälschlich 2 Treffer statt 0 melden, obwohl kein Code-Pfad ein echtes DELETE ausführt
- **Fix:** Beide Kommentare zu „ein echtes DELETE-Statement auf dieser Tabelle" umformuliert — inhaltlich identisch, ohne die wörtliche Zeichenkette
- **Files modified:** server/src/services/workPeriodService.ts
- **Verification:** Grep liefert 0 Treffer, Bedeutung der Kommentare unverändert
- **Committed in:** 842aa14 (Task 1 commit)

**4. [Rule 4 → im Voraus geklärt] Reihenfolgekonflikt: `getWorkPeriodsWithFlags()` (Task 1) braucht `UserWorkPeriodListItem`, das laut Plan erst in Task 2 in `types/index.ts` entsteht**
- **Found during:** Planung von Task 1, vor dem ersten Edit
- **Entscheidung:** `UserWorkPeriodListItem` zunächst lokal in `workPeriodService.ts` definiert (kompiliert eigenständig für Task 1), in Task 2 nach `types/index.ts` verschoben und dort reimportiert — kein Nutzerentscheid nötig, da beide Task-Acceptance-Kriterien (Task 1: `tsc` grün; Task 2: Typ steht in `types/index.ts`) dadurch unabhängig voneinander erfüllt werden, ohne den Typ doppelt zu exportieren
- **Files modified:** server/src/services/workPeriodService.ts (Task 1: lokale Definition; Task 2: Import statt Definition), server/src/types/index.ts (Task 2: zentrale Definition)
- **Committed in:** 842aa14 (Task 1), 0c851ea (Task 2)

---

**Total deviations:** 4 (3× Rule 1/3 — Bugfix/Blocking, notwendig für einen grünen `tsc --noEmit` und ein sauberes Abnahme-Grep; 1× Ablauf-Entscheidung ohne Nutzerentscheid, da beide betroffenen Task-Acceptance-Kriterien dadurch unabhängig erfüllbar blieben)
**Impact on plan:** Keine der vier Abweichungen ändert das im Plan beschriebene Verhalten oder die öffentliche API — alle vier sind innerhalb der von Task 1/2 ohnehin berührten Dateien geblieben.

## Issues Encountered

Keine über die oben dokumentierten Deviations hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten, keine Migrationen in diesem Plan (Migrationen 013/014 liefen bereits in Plan 13-01).

## Next Phase Readiness

- Plan 13-03 (Korrigieren) und Plan 13-04 (Löschen) können `softDeleteWorkPeriod()`,
  `extendWorkPeriodTo()`, `withSuspendedChainGuard()`, `getWorkPeriodById()` und die
  Verträge `WorkPeriodCorrectionInput/Preview/Outcome` bzw. `WorkPeriodDeletionInput/Preview/Outcome`
  direkt verwenden. Die in T-13-07 verlangte Zusage — `checkPeriodChain()` unmittelbar nach
  `withSuspendedChainGuard()` innerhalb derselben Transaktionsklammer — ist von diesem Plan
  NICHT eingelöst, das bleibt Aufgabe von Plan 13-03 (wie bereits in 13-01-SUMMARY.md für
  den aussetzbaren Riegel selbst vermerkt).
- Plan 13-05 (Routen/Rollenprüfung) kann `getWorkPeriodsWithFlags()` für den erweiterten
  Lesepfad verwenden — `isFirst`/`isCurrent` müssen dann nicht mehr im Desktop nachgerechnet
  werden (Dual-Calculation-Risiko aus 13-PATTERNS.md Abschnitt 6 damit serverseitig
  geschlossen).
- `PreviewRollback<T>`/`runWithPreviewRollback()` und die fünf exportierten Helfer aus
  `workPeriodChangeService.ts` stehen für Plan 13-03/13-04 bereit — beide Pläne sollten sie
  aufrufen statt eine zweite Trockenlauf-Mechanik zu bauen (sonst entsteht doch noch ein
  Dual Calculation System, das dieser Plan gerade vermeiden sollte).

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle drei Commit-Hashes (842aa14, 0c851ea, 6189514) in `git log --oneline --all` verifiziert.
`server/src/services/workPeriodService.ts` enthält `export function softDeleteWorkPeriod(`,
`export function extendWorkPeriodTo(`, `export function getWorkPeriodById(`,
`export function getWorkPeriodsWithFlags(`, `export function withSuspendedChainGuard`.
`server/src/types/index.ts` enthält `WorkPeriodDeletionPreview` (3 Treffer: Definition,
Response-Type, Outcome-Feld). `npx tsc --noEmit` Exit 0. `npx vitest run` — 435 grün / 3 rot
(Baseline aus 13-01-SUMMARY.md unverändert: 2× unifiedOvertimeService.test.ts,
1× vacationBackfillService.test.ts).
