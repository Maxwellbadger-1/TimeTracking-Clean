---
phase: 11-datumsabh-ngige-berechnung
plan: 02
subsystem: work-period-resolution
tags: [tdd, cache, resolution, backend]
dependency-graph:
  requires: []
  provides:
    - resolveWorkPeriodIn (reine Auflösungsfunktion, workPeriodService.ts)
    - WorkPeriodContext / createWorkPeriodContext / directWorkPeriodLookup (workPeriodContext.ts)
  affects:
    - Plan 11-04 und Folgepläne, die den Kontext künftig aufrufen werden
tech-stack:
  added: []
  patterns:
    - "Vorladender, per Closure gekapselter Cache statt modul-globalem Map (D1/D2)"
    - "Eine Auflösungsstelle (resolveWorkPeriodIn), alle Aufrufer delegieren statt zu duplizieren"
key-files:
  created:
    - server/src/services/workPeriodContext.ts
    - server/src/services/workPeriodContext.test.ts
  modified:
    - server/src/services/workPeriodService.ts
    - server/src/services/workPeriodService.test.ts
decisions:
  - "resolveWorkPeriodIn iteriert linear über die übergebene Periodenliste statt Binärsuche vorauszusetzen — bei ein bis drei Perioden je Nutzer (typischer Fall) ist das die einfachste korrekte Lösung, keine Sortier-Annahme nötig"
  - "vi.spyOn auf dem Namespace-Import (import * as workPeriodService) als Nachweis für 'genau ein Ladevorgang je Nutzer' verifiziert — fängt auch Aufrufe ab, die aus workPeriodContext.ts über einen benannten Import erfolgen (per Machbarkeitstest bestätigt vor dem eigentlichen RED)"
metrics:
  duration: "45min"
  completed: "2026-08-22"
---

# Phase 11 Plan 02: workPeriodContext — der Perioden-Cache Summary

Die Intervall-Auflösung `[validFrom, validTo)` existiert jetzt projektweit exakt einmal in
`resolveWorkPeriodIn()` (datenbankfrei), und ein neuer, ausschließlich per Closure lebender
Perioden-Cache (`createWorkPeriodContext()`) lädt die Perioden eines Nutzers vor D1-konform,
ohne D2 zu verletzen (kein modul-globaler Zustand).

## Was gebaut wurde

**Task 1 — `resolveWorkPeriodIn` (TDD, `test → feat`, Commits `8a3ae3b` → `6e9663b`):**
`server/src/services/workPeriodService.ts` bekam eine neue, reine Funktion
`resolveWorkPeriodIn(periods: UserWorkPeriod[], date: string): UserWorkPeriod | null`, die
das halboffene Intervall aus D1 (Phase 10) per Zeichenkettenvergleich auswertet — kein
Datenbankzugriff, kein `new Date`, kein SQL-`date()`/`strftime()`. `resolveWorkPeriodAt()`
delegiert jetzt auf `resolveWorkPeriodIn(getWorkPeriods(userId), date)` statt die
`WHERE validFrom <= ? AND (validTo IS NULL OR validTo > ?)`-Bedingung als eigene SQL-Kopie zu
pflegen. Damit gibt es die Intervall-Semantik im gesamten Projekt nur noch einmal.

**Task 2 — `workPeriodContext.ts` (TDD, `test → feat`, Commits `8bb3dea` → `88ff1da`):**
Neues Modul mit exakt dem im Plan-Interfaces-Block festgelegten Vertrag:
- `createWorkPeriodContext(): WorkPeriodContext` — baut bei jedem Aufruf eine neue
  `Map<number, UserWorkPeriod[]>` in der Funktions-Closure. Der erste `resolve(userId, date)`
  je `userId` lädt `getWorkPeriods(userId)` und merkt das Ergebnis (auch ein leeres Array),
  jeder weitere Aufruf für dieselbe `userId` löst nur noch über `resolveWorkPeriodIn` im
  Speicher auf. Kein modul-globales `Map`, kein Singleton, kein `static` (D2).
- `directWorkPeriodLookup: WorkPeriodContext` — Fallback für Aufrufer ohne eigenen
  Berechnungslauf: ruft bei jedem `resolve()` erneut `resolveWorkPeriodAt(userId, date)` auf,
  baut die Auflösung also nicht nach, ist aber bewusst ungecacht (D2-Fallback für
  Einzelabfragen, nicht für Tagesschleifen).

Dieser Plan ändert kein Verhalten: `grep -rn "workPeriodContext" server/src --include=*.ts`
findet außerhalb der beiden neuen Dateien nur zwei erklärende Kommentarzeilen im
Kopfkommentar von `workPeriodService.ts` (Nennung des Dateinamens in Prosa, kein Import, kein
Aufruf) — kein tatsächlicher Aufrufer.

## Deviations from Plan

None — plan exakt wie geschrieben umgesetzt. Eine kurze Machbarkeitsprobe (zwei temporäre,
nicht committete Dateien) hat vor dem eigentlichen RED-Test bestätigt, dass `vi.spyOn` auf
einem Namespace-Import (`import * as workPeriodService`) auch Aufrufe abfängt, die aus einem
anderen Modul über einen benannten Import erfolgen — das war die Voraussetzung für den im
Plan geforderten "Test mit Zähler" statt einer Kommentar-Behauptung. Diese Probedateien wurden
vor jedem Commit wieder entfernt und sind nicht Teil der Historie.

## Verifikation

- `npx vitest run src/services/workPeriodService.test.ts src/services/workPeriodContext.test.ts`
  — 45/45 grün (34 in `workPeriodService.test.ts`, davon 6 neu für `resolveWorkPeriodIn`;
  11 neu in `workPeriodContext.test.ts`).
- Gesamte Server-Testsuite (`npx vitest run`): 328/331 grün. Die 3 Fehlschläge sind exakt die
  dokumentierten, unabhängigen Vorbestände (2× `unifiedOvertimeService.test.ts`,
  1× `vacationBackfillService.test.ts`) — unverändert gegenüber der Ausgangsbasis 311/314.
  NO REGRESSION eingehalten.
- `npx tsc --noEmit` — fehlerfrei.
- `grep -c "toISOString\|new Date(\|strftime\|date(" server/src/services/workPeriodService.ts`
  (Kommentarzeilen ausgeschlossen) — 0.
- `grep -n "validTo IS NULL OR validTo >"` — Treffer nur noch im erklärenden Kopfkommentar,
  keine aktive SQL-Zeichenkette mehr.
- `grep -n "^const \|^let \|^var " server/src/services/workPeriodContext.ts` — leer (die
  einzige Modul-Konstante ist `export const directWorkPeriodLookup`, vom Muster nicht
  erfasst — Kriterium trivial erfüllt).
- `grep -c ": any\|async " server/src/services/workPeriodContext.ts` — 0.
- `grep -rn "workPeriodContext" server/src --include=*.ts` — außerhalb der eigenen Dateien
  nur zwei Kommentarerwähnungen in `workPeriodService.ts`, kein Aufrufer.

## Self-Check: PASSED

- FOUND: server/src/services/workPeriodContext.ts
- FOUND: server/src/services/workPeriodContext.test.ts
- FOUND: server/src/services/workPeriodService.ts (resolveWorkPeriodIn vorhanden, geprüft per grep)
- FOUND: server/src/services/workPeriodService.test.ts (neue Testfälle für resolveWorkPeriodIn vorhanden)
- FOUND commit 8a3ae3b (test: resolveWorkPeriodIn RED)
- FOUND commit 6e9663b (feat: resolveWorkPeriodIn GREEN)
- FOUND commit 8bb3dea (test: workPeriodContext RED)
- FOUND commit 88ff1da (feat: workPeriodContext GREEN)
