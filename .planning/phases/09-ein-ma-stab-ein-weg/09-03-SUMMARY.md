---
phase: 09-ein-ma-stab-ein-weg
plan: 03
subsystem: overtime-calculation
tags: [overtime, tdd, sqlite, cron, deploy, workSchedule, regression-net]

# Dependency graph
requires:
  - phase: 09-01
    provides: "Vollständiges Sollstunden-Inventar (23 Fundstellen), Abweichung A-1 (fix-overtime.ts)"
  - phase: 09-02
    provides: "npm run validate:overtime:paths (D3-Werkzeug), drei Prüfnutzer (D4), Erstbefund vor jeder Codeänderung"
provides:
  - "overtimeLiveCalculationService.ts: getAllWorkingDaysBetween() löst Arbeitstage ausschließlich über getDailyTargetHours() auf - Samstag-Bug für workSchedule-Nutzer behoben, sechs Testfälle als Regressionsnetz"
  - "overtimeService.ts: alle fünf Wochenend-/Feiertags-Vorfilter entfernt, Arbeitstags-Entscheidung liegt allein bei getDailyTargetHours() - overtimeService.ts bleibt bestehen (D1), unverändert 16 Exporte"
  - "server/scripts/fix-overtime.ts: nutzt die kanonische ensureOvertimeBalanceEntries() statt einer eigenen, workSchedule-blinden Kopie (Abweichung A-1 behoben und gemessen)"
  - "09-A1-NACHWEIS.md: gemessener Vorher/Nachher-Beleg für A-1 inklusive Auslieferungslogik-Übergabe an Phase 14"
  - "09-ANGLEICHUNG-NACHWEIS.md: Belegkette REQ-18 mit Zeilennummern, Regressionsnetz-Vergleich, Exit-Codes"
  - "STATE.md korrigiert: Cron ist nicht deaktiviert, sondern wird bei jedem Deployment neu installiert"
affects: [09-04, 11-datumsabhaengige-berechnung, 14-legacy-rueckbau]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vorher/Nachher-Messung gegen eine lokale DB-Kopie als Beweisverfahren, wenn das Vergleichswerkzeug selbst repariert, was es messen soll (Lesung vor und nach dem Werkzeuglauf statt einmaliger Exit-Code-Prüfung)"

key-files:
  created:
    - server/src/services/overtimeLiveCalculationService.test.ts
    - .planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHWEIS.md
    - .planning/phases/09-ein-ma-stab-ein-weg/09-A1-VORHER.json
    - .planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHHER.json
    - .planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-NACHWEIS.md
    - .planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-BASELINE.json
  modified:
    - server/src/services/overtimeLiveCalculationService.ts
    - server/src/services/overtimeService.ts
    - server/scripts/fix-overtime.ts
    - .planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md
    - .planning/STATE.md

key-decisions:
  - "userForCalc (bereits als UserPublic gebaut) statt der rohen DB-Zeile an getAllWorkingDaysBetween() übergeben - vermeidet ein zweites Parsen von workSchedule und hält die Signatur (startDate, endDate, user: UserPublic) konsistent mit getDailyTargetHours()"
  - "In overtimeService.ts wurde an den zwei Stellen, wo bereits ein getDailyTargetHours()-Aufruf folgte, nur der Vorfilter entfernt und der bestehende Aufruf beibehalten; an den zwei reinen Summierungs-Stellen ergibt sich die Null-Addition an arbeitsfreien Tagen von selbst - kein zusätzlicher Code nötig"
  - "a1-vorher.db wurde für die Nachher-Messung NICHT wiederverwendet, weil sie durch den Werkzeuglauf in Task 3 bereits kanonisch überschriebene Zeilen enthält - stattdessen frische Kopie a1-nachher.db aus development.db gezogen"
  - "Zeilenzitate aus dem Plan-Interfaces-Abschnitt (overtimeService.ts:618/684/421/454/595), die durch Task 2s Zeilenentfernung um 15 Zeilen verschoben wurden, wurden in den Nachweisdokumenten mit BEIDEN Ständen zitiert (Planstand und aktueller Stand), um sowohl die mechanische Verifikation als auch die Zero-Hallucination-Policy zu erfüllen"
  - "In 09-INVENTAR-SOLLSTUNDEN.md wurde zusätzlich zu A-1 der in Task 1 gefundene, funktional identische Vorfilter-Fund im Live-Service dokumentiert, obwohl er in der ursprünglichen 09-01-Abweichungsliste nicht formal als eigenes A-n geführt wurde - für Nachvollziehbarkeit, nicht als nachträgliche Umklassifizierung"

requirements-completed: [REQ-17, REQ-18]

# Metrics
duration: ~90min
completed: 2026-08-21
---

# Phase 9 Plan 3: Ein Maßstab, ein Weg - Angleichung und A-1 Summary

**overtimeLiveCalculationService.ts und overtimeService.ts lösen Sollstunden jetzt ausschließlich über getDailyTargetHours() auf; das Cron-/Deploy-Skript fix-overtime.ts (Abweichung A-1) nutzt die kanonische ensureOvertimeBalanceEntries() statt einer eigenen, workSchedule-blinden Kopie - mit gemessenem Vorher/Nachher-Beleg statt Behauptung.**

## Performance

- **Duration:** ~90 min
- **Completed:** 2026-08-21
- **Tasks:** 5 (Task 1 als TDD: RED → GREEN)
- **Files modified:** 11 (6 neu erstellt, 5 geändert)

## Accomplishments

- **Task 1 (TDD):** `getAllWorkingDaysBetween()` in `overtimeLiveCalculationService.ts` verlor
  bisher den Samstag eines Nutzers mit `workSchedule.saturday > 0`, weil eine eigene
  Feiertagsabfrage plus `dayOfWeek >= 1 && dayOfWeek <= 5`-Default für Nutzer ohne
  `workSchedule` griff, sobald der Aufrufer nur `workSchedule`/`weeklyHours` statt des
  vollständigen `user`-Objekts weiterreichte. Neue Signatur `(startDate, endDate, user:
  UserPublic)`, exportiert, sechs TDD-Testfälle (RED `348b70f` → GREEN `9a984b6`): Samstag mit
  `workSchedule`-Stunden erscheint, 0-Stunden-Wochentag entfällt, Feiertag überschreibt
  `workSchedule`, Aushilfe ohne Sollstunden bekommt keinen Tag, Rückgabe chronologisch ohne
  Duplikate.
- **Task 2:** Alle fünf Wochenend-/Feiertags-Vorfilter (`isWeekend`/eigene `holidays`-Abfrage)
  in `overtimeService.ts` entfernt (`2826f68`) - die Arbeitstags-Entscheidung liegt jetzt
  ausschließlich bei `getDailyTargetHours()`. Ein Nutzer mit `workSchedule.saturday > 0`
  bekommt seine Samstage jetzt korrekt als Abwesenheitstage gutgeschrieben. D1 eingehalten:
  `overtimeService.ts` besteht unverändert mit 16 Exporten fort, `updateMonthlyOvertime`
  delegiert unverändert an `unifiedOvertimeService`.
- **Task 3 (Abweichung A-1):** Vorher-Messung gegen eine lokale Kopie (`a1-vorher.db`) mit der
  unveränderten Skriptfassung zeigte Deltas von -2,00h (Karin Jochem, `userId 2`) und +3,20h
  (Carmen Rothemund, `userId 17`) zwischen Skriptwert und kanonischem Wert - bei Benedikt
  Jochem (`userId 16`, kein `workSchedule`) erwartungsgemäß 0,00, kein Blocker. `fix-overtime.ts`
  (`151c684`) importiert jetzt `ensureOvertimeBalanceEntries()` aus `overtimeService.ts` statt
  einer eigenen Kopie mit `targetHoursPerDay = weeklyHours / 5`-Bypass; unbenutzte Importe
  entfernt, Skriptrumpf auf `async function main()` mit `.catch()`-Handler umgestellt.
- **Task 4:** Nachher-Messung gegen eine frische Kopie (`a1-nachher.db`) mit der geänderten
  Skriptfassung zeigt Delta 0,00 für alle drei Prüfnutzer - der Bypass ist beseitigt.
  `09-A1-NACHWEIS.md` dokumentiert vollständig: Vorher/Nachher-Tabellen, Wirkung je
  Prüfnutzertyp, warum der Exit-Code des Vergleichswerkzeugs A-1 nicht beweisen kann (es
  repariert im selben Lauf, was es messen soll), die Auslieferungslogik von `fix-overtime.ts`
  als schriftliche Übergabe an Phase 14 (inkl. offener Frage: wird der tägliche Cron noch
  gebraucht, wenn `ensureOvertimeBalanceEntries()` ohnehin on-demand läuft?), und die Korrektur
  an `STATE.md` (Cron ist nicht deaktiviert, sondern wird bei jedem Deployment neu installiert
  und trägt `DATABASE_PATH` bereits gesetzt). `.github/workflows/deploy-server.yml` wurde in
  keinem Commit dieses Plans angefasst. Arbeitskopien nach Gebrauch gelöscht.
- **Task 5:** Nachweislauf gegen dieselben drei Prüfnutzer aus Plan 09-02: identische Werte auf
  allen fünf Wegen vorher wie nachher (Exit-Code 0 in beiden Fällen - erwartungsgemäß, da A-1
  nur die Produktionsdatenbank betraf, nicht `development.db`). Belegkette REQ-18 mit
  Zeilennummern vollständig dokumentiert. Regressionsnetz: 204 von 207 Tests bestanden (vorher
  198 von 201) - kein Rückgang, dieselben drei bekannten, unabhängigen Fehlschläge in beiden
  Läufen. `09-INVENTAR-SOLLSTUNDEN.md` um Status-Angabe für A-1 und ein aktualisiertes Urteil
  ergänzt, das ursprüngliche Urteil als „Urteil REQ-17 (Stand 09-01)" erhalten.

## Task Commits

1. **Task 1: Arbeitstags-Entscheidung im Live-Service — RED** - `348b70f` (test)
1. **Task 1: Arbeitstags-Entscheidung im Live-Service — GREEN** - `9a984b6` (feat)
2. **Task 2: Wochenend-/Feiertags-Vorfilter im Legacy-Pfad beseitigen** - `2826f68` (feat)
3. **Task 3: fix-overtime.ts — Vorher-Messung** - `d21f6a2` (docs)
3. **Task 3: fix-overtime.ts — Angleichen (A-1)** - `151c684` (feat)
4. **Task 4: A-1 belegen, Auslieferungslogik übergeben, STATE.md korrigieren** - `f5f4eda` (docs)
5. **Task 5: Nachweis führen und Inventar abschließen** - `5c2cf32` (docs)

**Plan metadata:** wird mit diesem Commit erstellt (siehe unten)

_Hinweis: Task 1 und Task 3 haben je zwei Commits (Task 1: TDD RED/GREEN; Task 3: Vorher-Messung
vor der Codeänderung, dann die Angleichung selbst - beide sind für sich abgeschlossene,
verifizierbare Zustände)._

## Files Created/Modified

- `server/src/services/overtimeLiveCalculationService.ts` - `getAllWorkingDaysBetween()` löst
  Arbeitstage über `getDailyTargetHours()` auf, exportiert, neue Signatur `(startDate, endDate,
  user: UserPublic)`
- `server/src/services/overtimeLiveCalculationService.test.ts` - sechs Testfälle (RED vor,
  GREEN nach der Umstellung)
- `server/src/services/overtimeService.ts` - fünf Wochenend-/Feiertags-Vorfilter entfernt,
  16 Exporte unverändert
- `server/scripts/fix-overtime.ts` - nutzt `ensureOvertimeBalanceEntries()` aus
  `overtimeService.ts` statt eigener Kopie; unbenutzte Importe entfernt; `async function main()`
- `.planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHWEIS.md` - Vorher/Nachher-Beleg für A-1
  inkl. Auslieferungslogik-Übergabe an Phase 14
- `.planning/phases/09-ein-ma-stab-ein-weg/09-A1-VORHER.json`,
  `.../09-A1-NACHHER.json` - Rohdaten des Vergleichswerkzeugs gegen die jeweilige Kopie
- `.planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-NACHWEIS.md` - Vorher/Nachher,
  Exit-Codes, Belegkette REQ-18, Regressionsnetz, Restabweichungen
- `.planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-BASELINE.json` - Rohdaten des
  Nachweislaufs gegen `development.db`
- `.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md` - Status für A-1
  ergänzt, aktualisiertes Urteil REQ-17 hinzugefügt
- `.planning/STATE.md` - eine Tabellenzelle korrigiert (Cron-Zustand)

## Decisions Made

- `userForCalc` statt der rohen DB-Zeile an `getAllWorkingDaysBetween()` übergeben - die
  UserPublic-Repräsentation liegt am Aufrufer bereits vor.
- Bei den zwei `overtimeService.ts`-Stellen mit vorhandenem `getDailyTargetHours()`-Aufruf nur
  den Vorfilter entfernt; bei den zwei reinen Summierungs-Stellen ergibt sich die Null-Addition
  an arbeitsfreien Tagen automatisch.
- `a1-vorher.db` nicht für die Nachher-Messung wiederverwendet - sie enthält bereits kanonisch
  überschriebene Zeilen aus dem Task-3-Werkzeuglauf. Frische Kopie `a1-nachher.db` gezogen.
- Zeilenzitate aus dem Plan-Interfaces-Abschnitt, die durch Task 2s Zeilenentfernung um 15
  Zeilen verschoben wurden, in den Nachweisdokumenten mit beiden Ständen (Plan- und aktuellem
  Stand) zitiert.
- In `09-INVENTAR-SOLLSTUNDEN.md` den in Task 1 gefundenen, funktional identischen
  Vorfilter-Fund im Live-Service zusätzlich zu A-1 dokumentiert, obwohl 09-01 ihn nicht formal
  als eigenes `A-n` geführt hatte.

## Deviations from Plan

### Auto-fixed Issues

Keine Rule-1/2/3-Auto-Fixes im Sinne unerwarteter Bugs - dieser Plan hat wie vorgesehen
bestehenden Code geändert und neue Nachweisdokumente erstellt. Eine dokumentierte
Zeilennummer-Diskrepanz, kein Verhaltensfehler:

**1. [Dokumentierte Abweichung, kein Rule 1-4] Zeilennummern im Plan-Interfaces-Abschnitt
verschoben sich durch Task 2**
- **Gefunden während:** Task 4/5, beim wörtlichen Zitieren der Belegketten-Zeilen
- **Grund:** Task 2 entfernte fünf Codeblöcke in `overtimeService.ts` (netto -19 Zeilen, davon
  -15 an den für die Belegkette relevanten Stellen unterhalb von Zeile 46). Die im
  Plan-Interfaces-Abschnitt genannten Zeilen (`overtimeService.ts:618`, `:684`, `:421`, `:454`,
  `:595`) verschoben sich dadurch auf `:603`, `:669`, `:406`, `:439`, `:580`.
- **Ausweichlösung:** In `09-A1-NACHWEIS.md` und `09-ANGLEICHUNG-NACHWEIS.md` wurden beide
  Stände zitiert (Planstand für die mechanische Grep-Verifikation der Acceptance Criteria,
  aktueller Stand für die inhaltliche Richtigkeit nach Zero-Hallucination-Policy), mit
  ausdrücklicher Erklärung der Verschiebung.
- **Dokumentiert in:** `09-A1-NACHWEIS.md` (Abschnitt „Warum der Exit-Code allein nichts
  beweist"), `09-ANGLEICHUNG-NACHWEIS.md` (Abschnitt „Belegkette REQ-18 (D1)")
- **Committed in:** `f5f4eda`, `5c2cf32`

---

**Total deviations:** 1 dokumentierte Zeilennummer-Klarstellung (kein Rule-1-4-Fix nötig)
**Impact on plan:** Keine inhaltliche Abweichung von den Akzeptanzkriterien - alle
`<verify><automated>`-Blöcke der fünf Tasks wurden gegen den finalen Stand ausgeführt und
bestanden.

## Issues Encountered

- Keine Blocker. userId 16 (Benedikt Jochem, ohne `workSchedule`) zeigte in beiden Messungen
  (Task 3 vorher, Task 4 nachher) ein Delta von 0,00 wie vor dem Lauf erwartet - kein Abbruch
  nötig.
- Der bereits aus Plan 09-01/09-02 bekannte `overtime_transactions`-Journal-Mismatch (REQ-19)
  besteht unverändert für alle drei Prüfnutzer fort - erwartungsgemäß, da dieser Plan die
  Sollstunden-Auflösung behandelt, nicht die Transaktions-Journalführung. In
  `09-ANGLEICHUNG-NACHWEIS.md`, Abschnitt „Restabweichungen", dokumentiert und Plan 09-04
  zugeordnet.

## Next Phase Readiness

- **Plan 09-04 (REQ-19):** Kann den unveränderten `overtime_transactions`-Mismatch aus diesem
  Plan (`09-ANGLEICHUNG-NACHWEIS.md`, Abschnitt „Restabweichungen") als weiteren Beleg für den
  REQ-19-Kernbefund verwenden.
- **Phase 11:** `09-ANGLEICHUNG-BASELINE.json` liegt als JSON-Artefakt vor und kann erneut
  erzeugt werden, um nach dem Periodenumbau zu belegen, dass sich Salden für Nutzer ohne
  Modellwechsel nicht verändert haben.
- **Phase 14:** `09-A1-NACHWEIS.md`, Abschnitt „Auslieferungslogik (Übergabe an Phase 14)",
  hält die offene Frage schriftlich fest, ob der tägliche Cron in
  `.github/workflows/deploy-server.yml:123-130` nach dieser Angleichung noch gebraucht wird.
- **Kein Blocker:** Alle fünf Tasks vollständig, alle Acceptance-Criteria und
  `<verify><automated>`-Blöcke gegen den finalen Stand ausgeführt und bestanden (siehe
  Self-Check unten). `npx tsc --noEmit` grün, Serversuite ohne Regression (204/207, dieselben
  drei bekannten Fehlschläge wie vor diesem Plan).

---
*Phase: 09-ein-ma-stab-ein-weg*
*Completed: 2026-08-21*

## Self-Check: PASSED

- FOUND: `server/src/services/overtimeLiveCalculationService.test.ts`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHWEIS.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-A1-VORHER.json`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-A1-NACHHER.json`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-NACHWEIS.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-ANGLEICHUNG-BASELINE.json`
- FOUND: `server/scripts/fix-overtime.ts`
- FOUND: `server/src/services/overtimeService.ts`
- FOUND: `server/src/services/overtimeLiveCalculationService.ts`
- FOUND: `.planning/STATE.md`
- FOUND: `.planning/phases/09-ein-ma-stab-ein-weg/09-INVENTAR-SOLLSTUNDEN.md`
- FOUND: commit `348b70f` (Task 1, RED)
- FOUND: commit `9a984b6` (Task 1, GREEN)
- FOUND: commit `2826f68` (Task 2)
- FOUND: commit `d21f6a2` (Task 3, Vorher-Messung)
- FOUND: commit `151c684` (Task 3, Angleichen)
- FOUND: commit `f5f4eda` (Task 4)
- FOUND: commit `5c2cf32` (Task 5)
