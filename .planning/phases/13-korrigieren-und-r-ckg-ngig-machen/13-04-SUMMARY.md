---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 04
subsystem: api
tags: [sqlite, better-sqlite3, work-periods, overtime, deletion, soft-delete, reversal]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 01)
    provides: "Migration 013 (deletedAt/deletedBy + work_period_chain_guard auf user_work_periods), Migration 014 (reversalOf auf overtime_transactions)"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 02)
    provides: "getWorkPeriodById(), softDeleteWorkPeriod(), extendWorkPeriodTo(), getWorkPeriodsWithFlags(), WorkPeriodDeletionInput/Preview/Outcome, PreviewRollback<T>/runWithPreviewRollback() aus workPeriodChangeService.ts"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 03)
    provides: "Das bewiesene Muster 'checkPeriodChain() unbedingt nach dem Schreiben, innerhalb derselben Transaktionsklammer' (T-13-14) sowie der reparierte INSERT-Guard-Trigger auf development.db"
  - phase: 12-stundenwechsel-bedienen
    provides: "applyWorkTimeChange() als Erzeuger der zu stornierenden model_change-Buchung, monthsInRange()/toGermanDate() als wiederverwendete Rechenbausteine"
  - phase: milestone-v2.0 (absenceService.ts)
    provides: "revertBalancesAfterDeletion() als Bestandsmuster fuer 'Gegenbuchung statt Loeschung, mit reason-Parameter'"
provides:
  - "deleteWorkPeriod() — der gefaehrlichste Schreibweg der Phase: Soft-Delete (D2), Lueckenschluss ueber die Vorperiode (D3), begrenzter Rebuild ab validFrom (D4) und eine Gegenbuchung je stornierter Originalzeile (DD-15), alles in einer db.transaction()-Klammer (D6), ohne den Kettenriegel auszusetzen (DD-16)"
  - "Der Doppelzaehlungs-Nachweis: ein Test, der den TATSAECHLICH BERECHNETEN Saldo (getOvertimeBalance) nach dem Loeschen gegen den Saldo vor dem Eintragen prueft, nicht die Journalsumme — Test 1 in workPeriodDeletionService.test.ts"
affects: [13-05, 13-06, 13-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Gegenbuchung mit hours = -original.hours und journal-neutralem balanceBefore/balanceAfter (getJournalBalanceBeforeDate) — die tatsaechliche Saldo-Ruecknahme kommt ausschliesslich aus dem Rebuild ab validFrom, niemals aus der Gegenbuchung selbst (DD-14, Wiederholung/Bestaetigung der Phase-12-Regel fuer den Loeschweg)"
    - "DD-15: alle unstornierten model_change-Zeilen einer Periode werden storniert (NOT EXISTS-Unterabfrage auf reversalOf) — nicht nur die urspruengliche Umstellungsbuchung, sondern auch jede spaetere Korrekturbuchung derselben Periode"
    - "Kettenriegel bleibt beim Loeschen AKTIV (kein withSuspendedChainGuard) — anders als beim Verschieben von validFrom in Plan 13-03 ist beim Soft-Delete + Lueckenschluss jeder Zwischenzustand der Schreibreihenfolge gueltig (DD-16)"

key-files:
  created:
    - server/src/services/workPeriodDeletionService.ts
    - server/src/services/workPeriodDeletionService.test.ts
  modified: []

key-decisions:
  - "isFirst-Pruefung (DD-17) laeuft UNBEDINGT, auch im Trockenlauf — analog zur Reason-Pruefung, aber bewusst NICHT dryRun-gegated, weil eine Vorschau auf eine nicht loeschbare Periode irrefuehrend waere (13-UI-SPEC Zustand 23 verlangt serverseitige Durchsetzung unabhaengig von der umgangenen Oberflaeche)"
  - "previousPeriod.newValidTo im Vorschauergebnis traegt bewusst period.validTo (den Wert VOR dem Wegnehmen), nicht das nach extendWorkPeriodTo() zurueckgelesene validTo — beide sind identisch, aber die Herkunft aus der Vorschau-Rechnung (nicht aus der Rueckerlese) haelt Vorschau und Speichern strukturell auf derselben Rechenbahn"
  - "Im Doppelzaehlungs-Test (Test 1) wird summeVorher/saldoVorher VOR dem Eintragen der Umstellung gemessen (nicht danach) — ein frueherer Entwurf des DD-15-Tests mass die Baseline versehentlich NACH der Umstellung und schlug fehl (383,25h Abweichung), weil der Rebuild beim Loeschen die Tageszeilen auf das URSPRUENGLICHE Sollmodell zurueckdreht, nicht auf den Zwischenstand nach der Umstellung"

requirements-completed: [REQ-31]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 13 Plan 04: Periode loeschen — Loeschdienst mit Storno statt Loeschung Summary

**`workPeriodDeletionService.ts` mit `deleteWorkPeriod()` — Soft-Delete, Lueckenschluss, begrenzter Rebuild und eine Gegenbuchung je stornierter Buchung in einer Transaktionsklammer, mit dem nicht verhandelbaren Nachweis, dass der tatsaechlich berechnete Ueberstundensaldo nach dem Loeschen exakt dem Stand vor dem Eintragen entspricht (nicht nur die Journalsumme).**

## Performance

- **Duration:** ~50 min
- **Completed:** 2026-08-22T19:30:36Z
- **Tasks:** 2/2 completed
- **Files modified:** 2 (beide neu)

## Accomplishments

- `deleteWorkPeriod(input, { dryRun, createdBy })` implementiert D2 (Soft-Delete statt `DELETE`), D3 (Lueckenschluss ueber die Vorperiode, erste Periode nicht loeschbar), D4 (Rebuild ab `validFrom` der geloeschten Periode bis heute, inklusive materialisierter Zukunftsmonate), D6 (alles in einer `db.transaction()`-Klammer) und D7 (Pflichtbegruendung nur im Speicherpfad)
- DD-14 wortgetreu umgesetzt: die Gegenbuchung traegt `hours = -original.hours` und journal-neutrales `balanceBefore`/`balanceAfter` — die tatsaechliche Saldo-Ruecknahme kommt ausschliesslich aus dem Rebuild in Schritt 9, nicht aus der Gegenbuchung. Der **nicht verhandelbare Test** dafuer (13-04-PLAN.md, Task 2, Zusicherung A) ist `workPeriodDeletionService.test.ts`, Test **„Zusicherung A/B/C/D — Umstellung eintragen, loeschen: der TATSAECHLICH BERECHNETE Saldo ist danach auf die Minute genau wieder der Stand von vorher"** — er prueft `Math.abs(getOvertimeBalance(userId) - saldoVorher) < 0.017` (auf die Minute genau) ueber den tatsaechlich berechneten Saldo, ausdruecklich NICHT ueber eine Journalsumme
- DD-15 umgesetzt und bewiesen (Test „DD-15: mehrere Buchungen an derselben Periode…"): alle unstornierten `model_change`-Zeilen einer Periode werden storniert — die Umstellungsbuchung aus Phase 12 UND jede spaetere Korrekturbuchung derselben Periode, unabhaengig davon ob eine oder mehrere existieren
- DD-16 umgesetzt: `softDeleteWorkPeriod()` gefolgt von `extendWorkPeriodTo(previous.id, period.validTo)`, der Kettenriegel bleibt dabei AKTIV (kein `withSuspendedChainGuard`, verifiziert per Grep), `checkPeriodChain()` laeuft trotzdem als Zusicherung unmittelbar danach innerhalb derselben Klammer
- DD-17 umgesetzt: die erste Periode eines Nutzers ist serverseitig nicht loeschbar, mit dem woertlichen Text aus 13-UI-SPEC.md, unabhaengig von der umgangenen Oberflaeche (Zustand 23)
- DD-18 umgesetzt: die Gegenbuchungs-Beschreibung folgt woertlich dem Textbuch „Storno zur Buchung vom {TT.MM.JJJJ}: Periode ab {TT.MM.JJJJ} gelöscht (Grund: {Begründung})"
- 7 neue Verhaltenstests (Praefix `test-13-04-`) decken alle im Plan geforderten Faelle ab: der Doppelzaehlungs-Nachweis (Test 1, mit vier Einzelzusicherungen A–D), Lueckenschluss in der Mitte der Kette (Test 2), Wiedereroeffnung der Vorperiode bei geloeschter offener letzter Periode (Test 3), gesperrte erste Periode (Test 4), Pflichtbegruendung im Service (Test 5), Trockenlauf schreibt nicht plus balanceDelta-Konsistenz (Test 6), mehrere Buchungen an derselben Periode (Test 7)
- Vollstaendiger Testlauf: 455 gruen / 3 rot (Baseline aus 13-03-SUMMARY.md: 448/3 — die 3 roten Tests sind unveraendert die bekannten Vorbestandsfehler, keine neue Regression)

## Task Commits

1. **Task 1: deleteWorkPeriod() — Soft-Delete, Luekenschluss, Rebuild und Gegenbuchung in einer Klammer** - `a8dfa19` (feat)
2. **Task 2: Der Doppelzaehlungs-Nachweis und die Storno-Sichtbarkeit** - `92f1920` (test)

## Files Created/Modified

- `server/src/services/workPeriodDeletionService.ts` - `deleteWorkPeriod()`, `WorkPeriodDeletionValidationError`, lokale Validierung (`validateDeletionInput`)
- `server/src/services/workPeriodDeletionService.test.ts` - 7 Verhaltenstests, Praefix `test-13-04-`

## Decisions Made

Siehe `key-decisions` im Frontmatter oben. Kernentscheidung: die `isFirst`-Pruefung (DD-17) ist NICHT `dryRun`-gegated — anders als die Begruendungspruefung (D7), die bewusst nur im Speicherpfad laeuft, damit die Vorschau schon vor dem Eintippen der Begruendung berechnet werden kann. Eine Vorschau auf eine nicht loeschbare erste Periode waere dagegen in jedem Fall irrefuehrend, unabhaengig vom `dryRun`-Flag.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fehlerhafte Baseline-Messung im urspruenglichen DD-15-Test (Testcode, kein Produktionscode)**
- **Found during:** Task 2, beim ersten Testlauf von `workPeriodDeletionService.test.ts`
- **Issue:** Der erste Entwurf des Tests „DD-15: mehrere Buchungen an derselben Periode…" mass `summeVorher` (die Journalsumme-Baseline fuer Zusicherung B) NACH dem Anwenden der retroaktiven Umstellung, aber VOR der Loeschung. Der anschliessende Rebuild beim Loeschen dreht die betroffenen Tageszeilen jedoch auf das URSPRUENGLICHE Sollmodell (vor der Umstellung) zurueck, nicht auf den Zwischenstand nach der Umstellung — die beiden Werte durften strukturell gar nicht uebereinstimmen. Der Test schlug mit einer Abweichung von 383,25h fehl.
- **Fix:** `summeVorher` wird jetzt — wie in Test 1 vorgemacht — VOR dem Aufruf von `applyWorkTimeChange()` gemessen, also auf derselben Rechenbahn wie der Endzustand nach der Loeschung (Original- und Zweitbuchung heben sich mit ihren Gegenbuchungen exakt auf, die Tageszeilen kehren zum Ausgangsmodell zurueck).
- **Files modified:** server/src/services/workPeriodDeletionService.test.ts
- **Verification:** `npx vitest run src/services/workPeriodDeletionService.test.ts` — 7/7 gruen; voller Lauf unveraendert 455/3
- **Committed in:** 92f1920 (Task 2 commit — der Fix war Teil des ersten Commits dieses Tests, kein separater Nachtrag noetig, da noch nicht committet)

---

**Total deviations:** 1 auto-fixed (Rule 1 — Bugfix in eigenem Testcode vor dem ersten Commit, kein Produktionscode betroffen)
**Impact on plan:** Keine Aenderung am Produktionscode (`workPeriodDeletionService.ts`) oder an der geforderten Testabdeckung — reine Korrektur einer falschen Testerwartung innerhalb derselben Datei, vor dem Commit entdeckt und behoben.

## Issues Encountered

Keine ueber die oben dokumentierte Deviation hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhaengigkeiten, keine neue Migration (Migrationen 013/014 liefen bereits in Plan 13-01).

## Next Phase Readiness

- Plan 13-05 (Routen/Rollenpruefung) kann `deleteWorkPeriod()` direkt hinter neuen Endpunkten (`POST /:id/delete/preview`, `DELETE /:id`) verdrahten — Vertrag (`WorkPeriodDeletionInput/Preview/Outcome`) und Fehlerklasse (`WorkPeriodDeletionValidationError` → 400, geerbter `WorkPeriodConflictError`-Cause) sind bereits vorhanden und folgen demselben Muster wie `correctWorkPeriod()`/`applyWorkTimeChange()`.
- Plan 13-06 (Kontoauszug-Lesepfad, bereits abgeschlossen) liefert `reversalOf`/`reversedBy`/`reversedAt`/`reversedByName` fuer das von diesem Plan erzeugte Storno-Paar bereits vollstaendig — keine weitere Serveraenderung fuer die Anzeige noetig.
- Plan 13-10 (Oberflaeche: Zustands-Badges, Beleg-Chip) kann sich auf die Beschreibungstexte aus DD-18 verlassen — sie sind woertlich aus 13-UI-SPEC.md uebernommen und durch keinen Test dieses Plans mehr veraenderbar, ohne den Test brechen zu lassen.
- Alle drei Schreibwege der Phase (Korrigieren, Loeschen, Umstellen aus Phase 12) folgen jetzt demselben bewiesenen Muster: `db.transaction()`-Klammer, `runWithPreviewRollback()`, `checkPeriodChain()` als Zusicherung, journal-neutrale `model_change`-Zeilen. Kein „Dual Calculation System" ist in dieser Phase entstanden.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Beide erstellten Dateien verifiziert vorhanden (`server/src/services/workPeriodDeletionService.ts`,
`server/src/services/workPeriodDeletionService.test.ts`). Beide Commit-Hashes (`a8dfa19`, `92f1920`)
in `git log --oneline --all` verifiziert. `npx tsc --noEmit` Exit 0. `npx vitest run` — 455 gruen /
3 rot (Baseline aus 13-03-SUMMARY.md: 448/3, unveraendert — 2x unifiedOvertimeService.test.ts,
1x vacationBackfillService.test.ts).
