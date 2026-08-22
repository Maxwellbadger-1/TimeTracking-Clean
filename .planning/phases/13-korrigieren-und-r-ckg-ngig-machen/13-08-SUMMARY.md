---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 08
subsystem: desktop
tags: [react, tanstack-query, typescript-contracts, modal, tauri]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 07)
    provides: "Desktop-Verträge (WorkTimePeriod inkl. isFirst/isCurrent, WorkPeriodCorrectionInput/Preview/Outcome), ConfirmDialog um details/confirmDisabled/confirmLoading/cancelDisabled/closeOnConfirm erweitert, useCorrectWorkPeriodPreview/useCorrectWorkPeriod-Hooks, useWorkPeriods() mit FORBIDDEN-Unterscheidung"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 05)
    provides: "POST /:id/correct/preview, PUT /:id mit getrennter Vorschau-Token-Bindung, GET /api/work-periods liefert isFirst/isCurrent"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 03)
    provides: "correctWorkPeriod() — der Server-Schreibweg, den dieser Dialog bedient"
provides:
  - "WorkTimePeriodEditModal.tsx — Korrektur-Dialog mit immer sichtbarem Warnbanner (Ausweg-Satz in beiden Panelvarianten), Pflichtbegründung ab 10 Zeichen, servergerechneter Vorschau, Bestätigungsschritt bei rückwirkender Korrektur"
  - "workTimePeriodEditRules.ts — vier reine Entscheidungsfunktionen (isRetroactivePeriod, primaryButtonLabel, isPrimaryDisabled, validateCorrectionForm), maschinell geprüft ohne vitest"
  - "WorkTimePeriodList.tsx: Zustand „Kein Zugriff" (403), dauerhafte Fußnote-Prop, isCurrent kommt jetzt vom Server statt aus einer zweiten Client-Berechnung"
affects: [13-09, 13-10, 13-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Vier reine Formular-/Steuerentscheidungen liegen in workTimePeriodEditRules.ts, nicht in der Komponente — Task 2 baute sie zunächst inline (damit die Task-2-Akzeptanzkriterien literale Textstrings in der Modal-Datei finden), Task 3 zog sie in die eigene Datei und verdrahtete die Komponente auf den Import um (mechanischer Extraktions-Refactor über zwei Task-Commits)"
    - "Warnbanner (immer sichtbar) und Vorschaupanel (serverabhängig) sind zwei getrennte Elemente im Korrektur-Dialog — anders als WorkTimeChangeModal, das beides in einem Panel vereint, weil der Korrektur-Dialog schon vor jeder Vorschau eine Warnung zeigen muss (13-UI-SPEC Reihenfolge 2 vs. 8)"
    - "isRetroactivePeriod(validFrom, today) ist ein reiner Zeichenkettenvergleich für Panel-/Knopfsteuerung — die BUSINESS-Zahlen (Arbeitstage, Sollstunden, Saldodifferenz) kommen weiterhin ausschließlich aus der Server-Vorschau (DD-34)"

key-files:
  created:
    - desktop/src/components/worktime/WorkTimePeriodEditModal.tsx
    - desktop/src/components/worktime/workTimePeriodEditRules.ts
    - desktop/src/components/worktime/workTimePeriodEditRules.check.ts
  modified:
    - desktop/src/components/worktime/WorkTimePeriodList.tsx

key-decisions:
  - "CR-03-Tagesplan-Validierung (0-24 Stunden je Tag) bleibt in der Komponente, nicht in workTimePeriodEditRules.ts — sie ist keine der vier im Plan benannten Entscheidungen, sondern betrifft den WorkScheduleEditor-Teilbaum"
  - "Warnbanner-Zeitraumangabe vor Preview: aus period.validFrom/validTo benannt (nicht aus der aktuell eingegebenen validFrom), Arbeitstageangabe weggelassen statt geschätzt (DD-34)"
  - "Bestätigungsdialog-Zeitraum verwendet preview.rangeFrom/rangeTo (Server-Wahrheit), nicht die Formular-validFrom — konsistent mit WorkTimeChangeModal.buildConfirmMessage()"
  - "isForbiddenMessage() prüft auf den Präfix 'Forbidden' (Server: 'Forbidden - Admin access required', middleware/auth.ts requireAdmin) statt auf 'FORBIDDEN' (das ist der Sondertext für useWorkPeriods()/GET, nicht für PUT-Fehlermeldungen)"

requirements-completed: [REQ-30, REQ-31]

# Metrics
duration: ~55min
completed: 2026-08-22
---

# Phase 13 Plan 08: Korrektur-Dialog Summary

**Neue Komponente `WorkTimePeriodEditModal.tsx` mit immer sichtbarem, zweivariantem Warnbanner samt Ausweg-Satz, Pflichtbegründung, servergerechneter Vorschau und rückwirkender Bestätigung — die vier reinen Formularentscheidungen liegen maschinell geprüft in `workTimePeriodEditRules.ts`; `WorkTimePeriodList.tsx` unterscheidet jetzt „kein Zugriff" von „keine Daten" und rechnet die aktuelle Periode nicht mehr selbst.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files modified:** 4 (3 neu, 1 geändert)

## Accomplishments

- `WorkTimePeriodList.tsx`: zwei neue optionale Props `accessDenied?`/`footnote?`. Zustand 3
  ("Kein Zugriff") als eigener Zweig **vor** der Leerzustandsprüfung eingefügt (Zeile 105 vs.
  Leerzustand Zeile 138) — ein 403 zeigt jetzt das Schloss-Panel mit dem wörtlichen Text
  `Kein Zugriff auf die Arbeitszeit-Perioden`, nicht mehr fälschlich "Noch kein Stichtag
  hinterlegt". Die Komponente erkennt `FORBIDDEN` aus `useWorkPeriods()` (Plan 13-07, DD-31)
  selbst; die Prop bleibt als Übersteuerung bestehen.
- `WorkTimePeriodList.tsx`: clientseitige `isCurrent`-Berechnung (WR-19/WR-06-Kommentare aus
  Phase 12) entfernt — die Badges "Aktuell"/"Geplant" hängen jetzt an `period.isCurrent`, das
  seit Plan 13-05 vom Server kommt (`getWorkPeriodsWithFlags()`). DD-35 eingehalten: entfernt,
  nicht ergänzt.
- `WorkTimePeriodEditModal.tsx` (neu, 870 Zeilen): vollständiger Korrektur-Dialog nach
  `13-UI-SPEC.md` Abschnitt 2. Warnbanner (immer sichtbar, amber bei Vergangenheitsberührung
  mit zwei Sätzen aus der Vorschau bzw. aus `period.validFrom/validTo` vor der ersten Vorschau,
  blau bei vollständiger Zukunft) trägt in beiden Varianten Satz 3, den Ausweg-Hinweis auf
  „Stundenwechsel ab Datum …". Getrenntes Vorschaupanel ("Was diese Korrektur bewirkt") mit
  400 ms entprellter, servergerechneter Berechnung über `useCorrectWorkPeriodPreview`, dem
  visuellen Anker (`text-lg font-bold`, grün/rot, `TrendingUp`/`TrendingDown`) und der immer
  sichtbaren REQ-28-Fußnote. Primärknopf gesperrt ohne `previewToken`, während des Speicherns
  oder bei Begründung < 10 Zeichen. Rückwirkende Korrektur öffnet
  `ConfirmDialog variant="warning" zIndexClass="z-[70]"` mit Zeitraum und konkreter
  Saldoänderung aus der Vorschau.
- Vorbelegung aus der **Periode** (`period`-Prop), nicht aus `user` (DD-33) — Muster aus
  `VacationBalanceEditModal.tsx:60-67`, ein `useEffect` synchronisiert bei `[isOpen, period.id]`.
  `validTo` ist nie editierbar (schreibgeschütztes `Input`, `READONLY_INPUT_CLASS` wortgleich
  zum Stundenfeld aus Phase 12). Bei `period.isFirst` ist `validFrom` zusätzlich gesperrt, der
  Anfangsfokus weicht dann auf "Wochenstunden" aus — nie auf ein `readOnly`-Feld.
- `handleSubmit` ruft `e.preventDefault()` **und** `e.stopPropagation()` (T-13-38); jedes
  Bedienelement im Teilbaum ist `type="button"`.
- 403 auf den Speicherpfad zeigt `Ihnen fehlt die Berechtigung für diese Änderung. Es wurde
  nichts verändert.` (der globale Toast ist für `/work-periods*` unterdrückt, Plan 13-07/DD-19).
  Ein abgelehntes Token (`PREVIEW_STALE`-Präfix) löst dieselbe Zwei-Versuche-Eskalation aus
  Phase 12 aus (`staleFailureCount`).
- `workTimePeriodEditRules.ts` (neu): `isRetroactivePeriod(validFrom, today)` (reiner
  Zeichenkettenvergleich, Gleichstand = nicht rückwirkend), `primaryButtonLabel(isRetroactive)`,
  `isPrimaryDisabled({hasPreviewToken, isSaving, trimmedReasonLength})`,
  `validateCorrectionForm(args)` (liefert die neun Textbuch-Fehlermeldungen inklusive
  "nichts geändert" als `formError` und `conflictPeriodId` bei Nachbarschaftskollision).
  `WorkTimePeriodEditModal.tsx` importiert alle vier und führt sie nicht mehr inline
  (Task-3-Refactor, siehe Deviations).
- `workTimePeriodEditRules.check.ts` (neu, `npx tsx` + `node:assert`, Muster
  `modalStack.test.ts`): 16 Testfälle — 3× `isRetroactivePeriod`, 2× `primaryButtonLabel`,
  1× `isPrimaryDisabled` (alle acht Kombinationen in einer Schleife), 9× `validateCorrectionForm`
  (je eine der neun Fehlerlagen, **vollständiger** Zeichenkettenvergleich, kein `includes`),
  1× gültige Eingabe → leere Fehlerzuordnung.

## Task Commits

1. **Task 1: WorkTimePeriodList um „Kein Zugriff" und die Fußnote erweitern, Doppelrechnung entfernen** - `d5c66c8` (feat)
2. **Task 2: WorkTimePeriodEditModal — Formular, Warnbanner, Vorschau, Bestätigung** - `ba81d40` (feat)
3. **Task 3: Prüfskript für die reinen Ableitungsfunktionen des Dialogs** - `9dbe3b8` (test)

**Plan metadata:** siehe finaler Commit dieses Plans (nach diesem SUMMARY).

## Files Created/Modified

- `desktop/src/components/worktime/WorkTimePeriodList.tsx` - `accessDenied`/`footnote`-Props, Zustand "Kein Zugriff" vor dem Leerzustand, `isCurrent` jetzt aus `period.isCurrent`
- `desktop/src/components/worktime/WorkTimePeriodEditModal.tsx` - neu, vollständiger Korrektur-Dialog
- `desktop/src/components/worktime/workTimePeriodEditRules.ts` - neu, vier reine Entscheidungsfunktionen
- `desktop/src/components/worktime/workTimePeriodEditRules.check.ts` - neu, 16 Verhaltenstests

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Kommentar mit dem Wortlaut "toISOString" verletzte das eigene Akzeptanzkriterium**
- **Found during:** Task 2, beim ersten Grep-Nachweis der Akzeptanzkriterien
  (`grep -c "console.log\|: any\| as any\|toISOString" ... liefert 0`)
- **Issue:** Der Kopfkommentar zu `formatGermanDate()` erklärte, dass die Funktion niemals
  über `toISOString().split('T')[0]` datiert — genau dieser erklärende Text enthielt die
  literale Zeichenkette `toISOString` und ließ den Grep-Zähler auf 1 statt 0 laufen.
- **Fix:** Kommentar auf eine Umschreibung ohne die literale Zeichenkette umformuliert
  (Verweis auf `.claude/CLAUDE.md` "Timezone bugs!" statt der wörtlichen Methode).
- **Files modified:** desktop/src/components/worktime/WorkTimePeriodEditModal.tsx
- **Verification:** `grep -c "console.log\|: any\| as any\|toISOString" WorkTimePeriodEditModal.tsx` → 0
- **Committed in:** ba81d40 (Task 2 commit)

### Sonstige Beobachtungen (kein Verhaltensunterschied)

**2. Reihenfolge der Erstellung der Rules-Datei vs. der Task-Nummerierung**
- Der Plan listet `workTimePeriodEditRules.ts`/`.check.ts` unter Task 3, deren Akzeptanzkriterium
  aber verlangt, dass `WorkTimePeriodEditModal.tsx` (Task 2) bereits daraus importiert. Da Task 2
  gleichzeitig verlangt, dass die literalen Textbausteine (u. a. `Korrektur rückwirkend
  speichern`) direkt in `WorkTimePeriodEditModal.tsx` per Grep auffindbar sind, wurden die vier
  Entscheidungen in Task 2 zunächst **inline** gebaut (Task-2-Akzeptanz bestätigt, siehe unten)
  und in Task 3 mechanisch in die eigene Datei extrahiert — der Import ersetzt die inline-Logik
  vollständig (Task-3-Akzeptanz: `grep "from './workTimePeriodEditRules'"` findet die Import-Zeile,
  die vier Entscheidungen sind nicht mehr inline geführt). Kein Verhaltensunterschied zwischen
  beiden Ständen, nur eine Umverteilung des Quelltexts über zwei Commits.
- **Files modified:** keine zusätzlichen — der beschriebene Ablauf ist genau die beiden
  Task-Commits `ba81d40`/`9dbe3b8`.

---

**Total deviations:** 1 auto-fixed (Rule 3 — Blocking, notwendig für einen grünen Akzeptanz-Grep),
1 dokumentierte Beobachtung zur Reihenfolge der Extraktion (kein Verhaltensunterschied).
**Impact on plan:** Keine der Abweichungen ändert das im Plan beschriebene Verhalten oder die
öffentliche API.

## Issues Encountered

Keine über die oben dokumentierten Deviations hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten (`13-UI-SPEC.md`: „Neue
Abhängigkeiten: keine"), keine Migration.

## Next Phase Readiness

- Plan 13-09 kann `WorkTimePeriodEditModal` direkt aus zwei Türen öffnen (Zeilenaktion
  „Korrigieren" und der Block-Button „Stammdaten rückwirkend korrigieren …", DD-32): die
  Komponente kennt nur `period`/`previousPeriod`/`nextPeriod`/`onConflict`/`onSaved`, keine
  eigene Auswahllogik.
- `WorkTimePeriodList.tsx` erwartet von Plan 13-09 die Übergabe von `renderActions` (Zeilenaktionen
  „Korrigieren"/„Löschen" bzw. den Hinweis-Chip „Nicht löschbar" bei `isFirst`), `accessDenied`
  wird i. d. R. nicht explizit gesetzt (die Komponente erkennt 403 selbst), `footnote` trägt die
  dauerhafte Begründung "Die erste Periode … lässt sich korrigieren, aber nicht löschen …" aus
  dem Textbuch.
- Der Löschdialog (`WorkTimePeriodDeleteModal` o. ä., voraussichtlich Plan 13-09) ist NICHT Teil
  dieses Plans — `useDeleteWorkPeriodPreview`/`useDeleteWorkPeriod` (Plan 13-07) liegen bereits
  bereit, aber ungenutzt.
- Die visuelle Prüfung des Korrektur-Dialogs (Warnbanner-Varianten, Vorschaupanel, Bestätigung)
  geht laut Plan-Objective in die UAT-Sammlung für Phase 14 (Plan 13-11) — hier nicht
  durchgeführt.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle vier geänderten/neu angelegten Dateien auf der Festplatte verifiziert vorhanden
(`WorkTimePeriodEditModal.tsx`, `workTimePeriodEditRules.ts`, `workTimePeriodEditRules.check.ts`,
`WorkTimePeriodList.tsx`). Alle drei Commit-Hashes (`d5c66c8`, `ba81d40`, `9dbe3b8`) in
`git log --oneline --all` verifiziert. `cd desktop && npx tsc --noEmit` Exit 0.
`cd desktop && npx tsx src/components/worktime/workTimePeriodEditRules.check.ts` Exit 0
(16/16 Tests grün). `cd server && npx vitest run` — 478 grün / 3 rot (Baseline aus
13-07-SUMMARY.md unverändert: 2× unifiedOvertimeService.test.ts, 1× vacationBackfillService.test.ts).
