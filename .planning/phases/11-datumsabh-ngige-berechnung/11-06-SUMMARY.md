---
phase: 11-datumsabh-ngige-berechnung
plan: 06
subsystem: api
tags: [overtime, sqlite, typescript, work-periods, vitest]

# Dependency graph
requires:
  - phase: 11-datumsabh-ngige-berechnung (Plan 11-04)
    provides: "getDailyTargetHours(user, date, periods) neue Pflicht-Signatur, MissingWorkPeriodError, WorkPeriodContext"
  - phase: 11-datumsabh-ngige-berechnung (Plan 11-02/11-03)
    provides: "createWorkPeriodContext(), directWorkPeriodLookup (workPeriodContext.ts)"
provides:
  - "overtimeService.ts (Legacy-Pfad, 9 Fundstellen) periodenbewusst: ensureOvertimeBalanceEntries, ensureDailyOvertimeTransactions, ensureAbsenceTransactions plus 5 toter Code"
  - "overtimeLiveCalculationService.ts (Live-Anzeige) periodenbewusst: getAllWorkingDaysBetween mit periods-Pflichtparameter, calculateLiveOvertimeTransactions mit EINEM Kontext je Lauf"
  - "D7-Nachweis fuer beide Dateien in 11-AUFRUFER-TEIL-06.md (Teilbeleg fuer Plan 11-09)"
affects: [11-09, 11-10]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Ein WorkPeriodContext je Sicherstellungs-/Berechnungslauf: createWorkPeriodContext() einmal am Funktionsanfang schleifender Funktionen, danach durchgereicht (D1/D2)"
    - "Einzeltag-Funktionen nutzen directWorkPeriodLookup statt einen eigenen Kontext zu bauen"
    - "Toter Code wird mitgezogen statt gelöscht, mit einzeiligem Inventar-Vermerk statt stillem Auskommentieren"

key-files:
  created:
    - .planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-06.md
  modified:
    - server/src/services/overtimeService.ts
    - server/src/services/overtimeLiveCalculationService.ts
    - server/src/services/overtimeLiveCalculationService.test.ts
    - server/src/services/overtimeService.test.ts
    - server/src/services/overtimeTransactionCentralization.test.ts

key-decisions:
  - "ensureAbsenceTransactionsForMonth (toter Code, PHASE 1+PHASE 2) teilt sich EINEN Kontext, weil beide Phasen im selben Funktionskörper laufen — kein zweiter Kontext nötig"
  - "ensureOvertimeBalanceEntries() aendert ihre öffentliche Signatur NICHT: der Kontext wird intern erzeugt und intern an unifiedOvertimeService.calculateMonthlyOvertime() durchgereicht — jeder der ~15 Aufrufer (Routen, reportService, fix-overtime.ts-Cron, Entwicklungsskripte) profitiert automatisch ohne eigene Anpassung"
  - "getAllWorkingDaysBetween() bekommt dagegen einen echten vierten Pflichtparameter, weil sie exportiert ist und ein interner Default-Kontext einen Cache je Aufruf erzeugt hätte (D1-Verlust); der einzige Aufrufer liegt in derselben Datei und reicht seinen Kontext durch"

patterns-established:
  - "Wenn eine Funktion ihre öffentliche Signatur nicht ändern kann/soll (viele externe Aufrufer), wird der Perioden-Kontext intern gekapselt statt als Parameter durchgereicht — D7 ist dann strukturell erfüllt, weil kein Aufrufer sich ändern muss"

requirements-completed: [REQ-23]

# Metrics
duration: 65min
completed: 2026-08-22
---

# Phase 11 Plan 06: Legacy-Pfad und Live-Anzeige periodenbewusst Summary

**overtimeService.ts (9 Fundstellen: 3 produktiv, 5 toter Code, 1 zusätzlich) und overtimeLiveCalculationService.ts (5 Fundstellen + neuer hireDate-Feld) lösen Sollstunden jetzt über einen WorkPeriodContext auf statt über die neue Pflichtparameter-Signatur von getDailyTargetHours() zu stolpern; D7-Nachweis schriftlich in 11-AUFRUFER-TEIL-06.md.**

## Performance

- **Duration:** ca. 65 min
- **Started:** 2026-08-22T06:50:00Z (geschätzt anhand des vorherigen Plans 11-04-Commits)
- **Completed:** 2026-08-22T07:55:00Z
- **Tasks:** 3
- **Files modified:** 6 (2 Produktivdateien, 3 Testdateien, 1 neuer Teilbeleg)

## Accomplishments
- Alle neun `getDailyTargetHours()`-Fundstellen in `overtimeService.ts` auf die neue
  3-Parameter-Signatur gebracht — sechs schleifende Funktionen mit `createWorkPeriodContext()`,
  eine Einzeltagfunktion mit `directWorkPeriodLookup`
- `ensureOvertimeBalanceEntries()` reicht ihren Kontext an
  `unifiedOvertimeService.calculateMonthlyOvertime()` durch (D1-Vorteil bleibt über die
  Monatsschleife erhalten), ohne die eigene öffentliche Signatur zu ändern
- `overtimeLiveCalculationService.ts` (die Datei hinter `GET
  /api/overtime/transactions/live`, dem Weg, den der Mitarbeiter im Dashboard sieht) baut EINEN
  Kontext vor der ersten Schleife und reicht ihn an alle fünf Fundstellen sowie an
  `getAllWorkingDaysBetween()` durch; `userForCalc` um `hireDate` ergänzt (D4-Ausnahme)
- D7-Nachweis mit vier wörtlichen Befehlen und Ausgaben in `11-AUFRUFER-TEIL-06.md`: kein
  Aufrufer aus dem Legacy-Pfad rechnet an der neuen Signatur vorbei — bei
  `ensureOvertimeBalanceEntries()` strukturell garantiert, weil ihre öffentliche Signatur
  unverändert blieb

## Task Commits

Each task was committed atomically:

1. **Task 1: overtimeService — Produktivpfad und toter Code auf die neue Signatur** - `2ad8235` (feat)
2. **Task 2: overtimeLiveCalculationService — die Anzeige, die der Mitarbeiter sieht** - `3b619df` (feat)
3. **Task 3: Tests des Legacy-Pfads nachziehen und den D7-Nachweis erbringen** - `91d96bb` (test) + `18e713e` (docs)

**Plan metadata:** siehe finaler Metadaten-Commit dieses Ausführungslaufs.

## Files Created/Modified
- `server/src/services/overtimeService.ts` - Neun Fundstellen periodenbewusst; sechs
  `createWorkPeriodContext()`-Aufrufe (Funktionsanfang), ein `directWorkPeriodLookup`;
  `ensureOvertimeBalanceEntries()` reicht den Kontext an `unifiedOvertimeService` durch
- `server/src/services/overtimeLiveCalculationService.ts` - `getAllWorkingDaysBetween()` mit
  `periods`-Pflichtparameter; `calculateLiveOvertimeTransactions()` mit einem Kontext für den
  gesamten Lauf; `userForCalc` um `hireDate` ergänzt; bleibt nebenwirkungsfrei
- `server/src/services/overtimeLiveCalculationService.test.ts` - Bestehende Tests auf
  `stubWorkPeriodContext()`/`insertTestWorkPeriod()` umgestellt; zwei neue D7-Regressionstests
  (Wochenplanwechsel in `getAllWorkingDaysBetween`, Periodenwechsel in
  `calculateLiveOvertimeTransactions`)
- `server/src/services/overtimeService.test.ts` - `insertTestWorkPeriod()` nach dem
  `INSERT INTO users` ergänzt (D4); Erwartungswerte unverändert
- `server/src/services/overtimeTransactionCentralization.test.ts` - `insertTestWorkPeriod()`
  defensiv für beide Testnutzer ergänzt (aktuell nicht zwingend erforderlich, da
  `ensureCorrectionTransactions()` `getDailyTargetHours()` nicht aufruft, aber D4-konform für
  künftige Erweiterungen dieser Testdatei)
- `.planning/phases/11-datumsabh-ngige-berechnung/11-AUFRUFER-TEIL-06.md` - D7-Nachweis mit
  vier Befehlen/Ausgaben, Fundstellen-Tabelle, Testnachweis; `11-AUFRUFER-CHECKLISTE.md`
  bewusst nicht angefasst (Plan 11-09 führt sequenziell zusammen)

## Decisions Made
- `ensureOvertimeBalanceEntries()`, `ensureDailyOvertimeTransactions()` und
  `ensureAbsenceTransactions()` bekommen JEWEILS einen eigenen `createWorkPeriodContext()` am
  Funktionsanfang (nicht einen gemeinsam durchgereichten Kontext über die Aufrufkette
  `ensureDailyOvertimeTransactions()` → `ensureAbsenceTransactions()`), weil die Plananweisung
  „Funktionen, die über mehrere Tage oder Monate schleifen: `createWorkPeriodContext()` EINMAL
  am Funktionsanfang" wörtlich pro Funktion gilt. D1 ist damit pro Funktionsaufruf erfüllt
  (kein Neuladen je Tag), auch wenn zwei verschachtelte Sicherstellungsläufe zwei separate
  Perioden-Ladevorgänge auslösen — ein bewusster Kompromiss zwischen Kapselung und maximaler
  Cache-Wiederverwendung, dokumentiert statt stillschweigend optimiert
- `ensureOvertimeBalanceEntries()` behält ihre öffentliche 2-Parameter-Signatur; der
  Perioden-Kontext ist ein reines Implementierungsdetail. Das macht D7 für diese Funktion
  strukturell beweisbar (kein Aufrufer kann an der neuen Logik vorbeirechnen, weil niemand
  Zugriff auf den Kontext hat) — anders als bei `getAllWorkingDaysBetween()`, wo der Kontext
  wegen Export und Testbarkeit als echter Parameter nötig war

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Zwei D7-Regressionstests für den Stichtag-Fall ergänzt**
- **Found during:** Task 2 (overtimeLiveCalculationService)
- **Issue:** Die Behavior-Vorgaben des Plans („Dienstage vor dem Stichtag Arbeitstage, danach
  nicht"; „Tage vor und nach dem Stichtag mit jeweils gültigen Sollstunden") waren nicht durch
  vorhandene Tests abgedeckt — nur der Regressionsfall „ohne Modellwechsel" war bereits
  vorhanden
- **Fix:** Zwei neue Tests ergänzt: `getAllWorkingDaysBetween` mit zwei Stub-Perioden über
  einen Stichtag hinweg; `calculateLiveOvertimeTransactions` mit zwei echten DB-Perioden
  (4h/Tag vor, 8h/Tag ab Stichtag), Prüfung der Sollstunden in der Transaktionsbeschreibung
- **Files modified:** `server/src/services/overtimeLiveCalculationService.test.ts`
- **Verification:** Beide Tests grün (12/12 in der Datei)
- **Committed in:** `3b619df` (Task 2 commit)

**2. [Rule 2 - Missing Critical] insertTestWorkPeriod() auch in overtimeTransactionCentralization.test.ts ergänzt**
- **Found during:** Task 3
- **Issue:** Diese Testdatei ruft aktuell nur `ensureCorrectionTransactions()` auf, die
  `getDailyTargetHours()` nicht direkt aufruft — die Tests waren also schon vor diesem Plan
  grün, ohne Periode. Die Plananweisung „Nach jedem solchen INSERT insertTestWorkPeriod()
  aufrufen" bezieht sich wörtlich auf beide Testdateien
- **Fix:** `insertTestWorkPeriod()` für `testUserId` und `testAdminId` ergänzt, mit denselben
  Werten wie im jeweiligen `INSERT INTO users`
- **Files modified:** `server/src/services/overtimeTransactionCentralization.test.ts`
- **Verification:** Weiterhin 4/4 grün, keine Erwartungswerte geändert
- **Committed in:** `91d96bb` (Task 3 commit)

---

**Total deviations:** 2 auto-fixed (2 fehlende kritische Testabdeckung)
**Impact on plan:** Beide Ergänzungen erhöhen nur die Testabdeckung für bereits im Plan
geforderte Verhaltensweisen; keine Scope-Erweiterung über den Plan hinaus.

## Issues Encountered
- **Wettlauf mit Plan 11-05 (parallele Welle):** `ensureOvertimeBalanceEntries()` sollte laut
  Plan ihren Kontext als drittes Argument an `unifiedOvertimeService.calculateMonthlyOvertime()`
  durchreichen — diese Funktion hatte zum Zeitpunkt der Bearbeitung von Task 1 noch die alte
  2-Parameter-Signatur, weil Plan 11-05 (parallel, gleiche Welle) sie erst währenddessen auf
  einen optionalen dritten `periods`-Parameter mit Vorgabewert erweiterte. Der Aufruf mit drei
  Argumenten wurde trotzdem sofort geschrieben (laut Planvorgabe); `tsc --noEmit` bestätigte
  nach Abschluss aller drei Tasks dieses Plans, dass Plan 11-05 inzwischen gelandet war —
  `overtimeService.ts` kompiliert fehlerfrei. Keine Anpassung an fremden Dateien nötig, keine
  Wartezeit eingebaut; die Reihenfolge hat sich von selbst gelöst
- **Akzeptanzkriterium „grep -c createWorkPeriodContext = Anzahl schleifender Funktionen":**
  Der tatsächliche `grep -c`-Wert in `overtimeService.ts` ist 7, nicht 6 — die Import-Zeile
  (`import { createWorkPeriodContext, directWorkPeriodLookup } from './workPeriodContext.js';`)
  enthält den Suchbegriff ebenfalls und zählt als achte Fundzeile mit. Die sechs schleifenden
  Funktionen (`ensureOvertimeBalanceEntries`, `ensureDailyOvertimeTransactions`,
  `ensureAbsenceTransactions`, `_calculateAbsenceCreditsForMonth`,
  `_calculateUnpaidLeaveForMonth`, `ensureAbsenceTransactionsForMonth`) rufen die Funktion
  jeweils genau einmal am Funktionsanfang auf — die inhaltliche Vorgabe ist erfüllt, das
  wörtliche Zahlenkriterium zählt die Import-Zeile mit

## User Setup Required
None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- `overtimeService.ts` und `overtimeLiveCalculationService.ts` sind vollständig periodenbewusst
  und `tsc`-fehlerfrei (projektweit 0 Fehler zum Abschluss dieses Plans — alle fünf
  Wellenpläne 11-05/11-06/11-07/11-08/11-11 sind gelandet)
- D7-Teilbeleg liegt vor; Plan 11-09 kann `11-AUFRUFER-CHECKLISTE.md` mit den Zeilen aus
  `11-AUFRUFER-TEIL-06.md` abhaken
- Keine Blocker für Plan 11-09/11-10 erkennbar

---
*Phase: 11-datumsabh-ngige-berechnung*
*Completed: 2026-08-22*

## Self-Check: PASSED
