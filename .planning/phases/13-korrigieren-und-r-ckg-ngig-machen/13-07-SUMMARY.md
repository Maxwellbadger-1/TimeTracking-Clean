---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 07
subsystem: desktop
tags: [react, tanstack-query, typescript-contracts, modal, tauri]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 02)
    provides: "Server-Verträge WorkPeriodCorrectionInput/Preview/Outcome, WorkPeriodDeletionInput/Preview/Outcome"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 05)
    provides: "Vier neue Endpunkte (POST /:id/correct/preview, PUT /:id, POST /:id/delete/preview, DELETE /:id) mit getrennten previewToken-Bindungen"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 06)
    provides: "Storno-Felder (id, reversalOf, reversedBy, reversedAt, reversedByName) im Kontoauszug-Lesepfad"
provides:
  - "Desktop-Spiegelung aller acht Phase-13-Verträge in types/index.ts, feldgleich zur Serverfassung"
  - "WorkTimePeriod um isFirst/isCurrent erweitert (Pflichtfelder, serverseitig berechnet)"
  - "OvertimeTransactionRow um die fünf Storno-Felder ergänzt"
  - "ConfirmDialog um details/confirmDisabled/confirmLoading/cancelDisabled/closeOnConfirm erweitert, Warnfarbe auf amber angeglichen"
  - "useModalLayer(isOpen, onClose, label, options?) mit escDisabled — ESC-Sperre ohne Duplikat in ConfirmDialog"
  - "Vier Hooks: useCorrectWorkPeriodPreview, useCorrectWorkPeriod, useDeleteWorkPeriodPreview, useDeleteWorkPeriod"
  - "useWorkPeriods() unterscheidet 403 (Error('FORBIDDEN')) von jedem anderen Fehler"
  - "ApiResponse<T> trägt jetzt optional den HTTP-Statuscode"
affects: [13-08, 13-09, 13-10, 13-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Desktop-Verträge spiegeln Server-Verträge feldgleich (types/index.ts), ohne eine zweite Berechnung — Hooks reichen Servermeldung/-antwort unverändert durch (D7)"
    - "escDisabled als vierter, optionaler useModalLayer-Parameter statt einer zweiten ESC-Prüfung in ConfirmDialog (DD-28)"
    - "*.check.ts als eigene, von tsc ausgeschlossene Dateikategorie neben *.test.ts — beide umgehen denselben eingeschränkten typeRoots (desktop/node_modules/@types ist durch npm-Workspace-Hoisting leer)"

key-files:
  created:
    - desktop/src/components/ui/confirmDialogProps.check.ts
  modified:
    - desktop/src/types/index.ts
    - desktop/src/hooks/useWorkTimeAccounts.ts
    - desktop/src/components/ui/useModalLayer.ts
    - desktop/src/components/ui/ConfirmDialog.tsx
    - desktop/src/hooks/useWorkTimeChange.ts
    - desktop/src/api/client.ts
    - desktop/src/utils/timeUtils.periods.test.ts
    - desktop/tsconfig.json

key-decisions:
  - "WorkPeriodCorrectionOutcome.period referenziert den bestehenden Desktop-Typ WorkTimePeriod (inkl. isFirst/isCurrent) statt einer dritten Periodenform mit deletedAt/deletedBy — dieselbe Vereinfachung, die der Server bereits für UserWorkPeriodListItem vs. UserWorkPeriod vornimmt; eine gerade korrigierte Periode ist per Definition nicht gelöscht"
  - "desktop/tsconfig.json exclude um src/**/*.check.ts ergänzt (Rule 3) — ohne die Ergänzung brach tsc --noEmit an node:assert/strict in der neuen Prüfdatei, aus demselben Grund, aus dem *.test.ts bereits ausgeschlossen ist (eingeschränkter typeRoots)"
  - "timeUtils.periods.test.ts: makePeriod()-Fixture um isFirst: false/isCurrent: false ergänzt (Rule 3) — die geprüften Funktionen lesen diese Felder nicht, Platzhalterwerte genügen"
  - "apiClient.delete() unterstützte bereits einen Anfragekörper (Muster identisch zu put()) — keine Ergänzung nötig, in DD-30 als Prüfpunkt vorgesehen"
  - "ApiResponse<T>.status nur im Fehlerpfad gesetzt (DD-31) — die einzige Stelle, an der der Aufrufer (useWorkPeriods) ihn braucht"

requirements-completed: [REQ-30, REQ-31]

# Metrics
duration: ~50min
completed: 2026-08-22
---

# Phase 13 Plan 07: Desktop-Grundlage — Verträge, ConfirmDialog-Erweiterung, vier Hooks Summary

**Acht feldgleiche Desktop-Spiegelungen der Server-Verträge, fünf additive `ConfirmDialog`-Props (inkl. `confirmLoading`/`cancelDisabled` für den sperrbaren Löschzustand), eine ESC-Sperre in `useModalLayer` ohne Duplikat, und vier Hooks, die die vier neuen Perioden-Endpunkte ansprechen, ohne selbst zu rechnen.**

## Performance

- **Duration:** ~50 min
- **Tasks:** 3/3 completed
- **Files modified:** 8 (7 geändert, 1 neu)

## Accomplishments

- `WorkTimePeriod` (desktop) um `isFirst: boolean`/`isCurrent: boolean` erweitert (Pflichtfelder — der Server liefert sie seit Plan 13-05 immer über `getWorkPeriodsWithFlags()`), mit Kommentar, warum sie nicht aus der Listenposition abgeleitet werden dürfen (13-UI-SPEC.md).
- Acht neue Verträge in `desktop/src/types/index.ts`, feldgleich zur Serverfassung aus `server/src/types/index.ts` (Plan 13-02): `WorkPeriodCorrectionInput`, `WorkPeriodCorrectionPreview`, `WorkPeriodCorrectionPreviewResponse`, `WorkPeriodCorrectionOutcome`, `WorkPeriodDeletionInput`, `WorkPeriodDeletionPreview`, `WorkPeriodDeletionPreviewResponse`, `WorkPeriodDeletionOutcome`. Feldnamen-Abgleich (nicht nur behauptet, siehe „Feldnamen-Abgleich" unten).
- `OvertimeTransactionRow` (`useWorkTimeAccounts.ts`) um die fünf Storno-Felder (`id`, `reversalOf`, `reversedBy`, `reversedAt`, `reversedByName`) ergänzt — Spiegel von `LiveOvertimeTransaction` (Plan 13-06), nur bei `type === 'model_change'` gesetzt.
- `useModalLayer(isOpen, onClose, label, options?)` bekam den vierten, optionalen Parameter `{ escDisabled?: boolean }` (DD-28): Ref-gehalten, im ESC-Effekt gelesen, Abhängigkeitsliste bleibt `[isOpen]`. `Modal.tsx` ruft unverändert ohne vierten Parameter auf.
- `ConfirmDialog` um `details?`, `confirmDisabled?`, `confirmLoading?`, `cancelDisabled?`, `closeOnConfirm?` erweitert — alle optional, additiv. `cancelDisabled` sperrt „Abbrechen", das rohe X-`<button>` (inkl. `disabled:opacity-50 disabled:cursor-not-allowed`, da kein `Button`-Primitiv) und ESC (über `useModalLayer`); kein Backdrop-Handler ergänzt (DD-29, das Overlay hatte nie einen). `isConfirmButtonDisabled()`/`shouldCloseAfterConfirm()` als reine, exportierte Ableitungsfunktionen statt Inline-Bedingungen.
- `iconColors.warning` von `text-yellow-600 dark:text-yellow-400` auf `text-amber-600 dark:text-amber-400` angeglichen (Befund E2). `grep -rn 'variant="warning"' desktop/src` findet einen bestehenden Aufrufer: `WorkTimeChangeModal.tsx:881` (Phase 12, rückwirkende Umstellung) — laut 13-UI-SPEC.md ausdrücklich mitgemeint („die einzigen Nutzer sind die Bestätigungen aus Phase 12 und Phase 13"), keine Abweichung.
- Vier neue Hooks in `useWorkTimeChange.ts` nach DD-30: `useCorrectWorkPeriodPreview()`, `useCorrectWorkPeriod()`, `useDeleteWorkPeriodPreview()`, `useDeleteWorkPeriod()`. Alle vier laufen über `apiClient` (kein `universalFetch`-Import). Die beiden Speicher-Hooks invalidieren `['work-periods', userId]` und rufen `invalidateUserAffectedQueries` (wortgleich zu `useSaveWorkTimeChange`); die beiden Vorschau-Hooks invalidieren nichts.
- `useWorkPeriods()` unterscheidet nach DD-31 einen 403 (`Error('FORBIDDEN')`) von jedem anderen Fehler (Servermeldung wie bisher) — Grundlage für Zustand 3 „Kein Zugriff" vs. Zustand 2 Ladefehler in Plan 13-08.
- `confirmDialogProps.check.ts` (neu, `npx tsx` + `node:assert`) belegt zwei Dinge: (1) per Compiler-Beweis, dass ein Objektliteral mit nur den bisherigen Pflichtfeldern weiterhin ein gültiger `ConfirmDialogProps`-Wert ist; (2) alle vier bzw. zwei Wertekombinationen von `isConfirmButtonDisabled()`/`shouldCloseAfterConfirm()`.

## Feldnamen-Abgleich (Task 1, Nachweis statt Behauptung)

Jeder der acht neuen Typen wurde Feld für Feld gegen `server/src/types/index.ts` (Zeilen 411–523, Plan 13-02) gelesen und abgeglichen:

| Typ | Server-Felder | Desktop-Felder | Ergebnis |
|-----|---------------|-----------------|----------|
| `WorkPeriodCorrectionInput` | periodId, validFrom, weeklyHours, workSchedule, reason | identisch | ✅ |
| `WorkPeriodCorrectionPreview` | periodId, userId, isRetroactive, rangeFrom, rangeTo, workingDays, targetHoursBefore/After/Delta, balanceBefore/After/Delta, isNoOp, period{validFrom,validTo,weeklyHours,workSchedule}, previousPeriod\|null{validFrom,weeklyHours,newValidTo}, affectedMonths | identisch | ✅ |
| `WorkPeriodCorrectionPreviewResponse` | Preview & {previewToken} | identisch | ✅ |
| `WorkPeriodCorrectionOutcome` | preview, period: UserWorkPeriod\|null, transactionId | preview, period: **WorkTimePeriod**\|null, transactionId — siehe Simplifikationsvermerk im Typkommentar (deletedAt/deletedBy sind für eine gerade korrigierte, also nicht gelöschte Periode ohne Bedeutung) | ✅ (dokumentierte Vereinfachung) |
| `WorkPeriodDeletionInput` | periodId, reason | identisch | ✅ |
| `WorkPeriodDeletionPreview` | periodId, userId, deletedPeriod{validFrom,validTo,weeklyHours}, previousPeriod{validFrom,weeklyHours,newValidTo\|null}, reversedTransactions[{id,date,hours}], rebuildFrom, balanceBefore/After/Delta, affectedMonths | identisch | ✅ |
| `WorkPeriodDeletionPreviewResponse` | Preview & {previewToken} | identisch | ✅ |
| `WorkPeriodDeletionOutcome` | preview, reversalTransactionIds | identisch | ✅ |

`grep -c ": any" desktop/src/types/index.ts` → 0.

## Task Commits

1. **Task 1: Verträge im Desktop spiegeln** - `2167b9e` (feat)
2. **Task 2: ConfirmDialog um fünf optionale Eigenschaften erweitern, Warnfarbe angleichen** - `e461271` (feat)
3. **Task 3: Vier Datenhooks und ein Prüfskript für die Eigenschaftsverträge** - `d4e2924` (feat)

## Files Created/Modified

- `desktop/src/types/index.ts` - `WorkTimePeriod` um isFirst/isCurrent erweitert, acht neue Phase-13-Verträge
- `desktop/src/hooks/useWorkTimeAccounts.ts` - `OvertimeTransactionRow` um fünf Storno-Felder erweitert
- `desktop/src/components/ui/useModalLayer.ts` - vierter optionaler Parameter `{ escDisabled? }`
- `desktop/src/components/ui/ConfirmDialog.tsx` - fünf neue optionale Props, zwei exportierte Ableitungsfunktionen, Warnfarbe amber
- `desktop/src/hooks/useWorkTimeChange.ts` - vier neue Hooks, `useWorkPeriods()` mit 403-Unterscheidung
- `desktop/src/api/client.ts` - `ApiResponse<T>.status` (nur Fehlerpfad)
- `desktop/src/utils/timeUtils.periods.test.ts` - `makePeriod()`-Fixture um isFirst/isCurrent ergänzt (Typfehler-Fix)
- `desktop/tsconfig.json` - exclude um `src/**/*.check.ts` ergänzt
- `desktop/src/components/ui/confirmDialogProps.check.ts` - neu, Prüfskript

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] `timeUtils.periods.test.ts` kompilierte nach der WorkTimePeriod-Erweiterung nicht mehr**
- **Found during:** Task 1, unmittelbar nach der Erweiterung von `WorkTimePeriod` um `isFirst`/`isCurrent`
- **Issue:** `makePeriod()` baut ein `WorkTimePeriod`-Objektliteral ohne die beiden neuen Pflichtfelder — `npx tsc --noEmit` schlug fehl.
- **Fix:** `isFirst: false, isCurrent: false` mit erklärendem Kommentar ergänzt (die geprüften Funktionen `resolveWorkTimePeriodIn`/`countWorkingDaysForUser`/`calculateAbsenceHoursWithWorkSchedule` lesen diese Felder nicht).
- **Files modified:** desktop/src/utils/timeUtils.periods.test.ts
- **Verification:** `npx tsc --noEmit` Exit 0, `npx tsx src/utils/timeUtils.periods.test.ts` weiterhin 9/9 grün
- **Committed in:** 2167b9e (Task 1 commit)

**2. [Rule 3 - Blocking] `confirmDialogProps.check.ts` brach `tsc --noEmit` an `node:assert/strict`**
- **Found during:** Task 3, beim ersten `tsc --noEmit`-Lauf nach Anlegen des Prüfskripts
- **Issue:** `desktop/tsconfig.json` setzt `typeRoots: ["./node_modules/@types"]` — dieser Ordner ist durch npm-Workspace-Hoisting leer (`desktop/node_modules` ist praktisch leer, alle Pakete liegen im Root-`node_modules`). Ohne einen expliziten Ausschluss wird JEDE `.ts`-Datei unter `src`, die einen `node:`-Import trägt, von `tsc` erfasst und schlägt mit „Cannot find module 'node:assert/strict'" fehl. Genau aus diesem Grund schließt `tsconfig.json` bereits `src/**/*.test.ts` aus — die bestehenden `npx tsx`-Prüfskripte (`modalStack.test.ts`, `timeUtils.periods.test.ts`) nutzen denselben Import und sind nur durch diesen Ausschluss unsichtbar für `tsc`. Der Plan verlangt für dieses Skript aber ausdrücklich den Dateinamen `confirmDialogProps.check.ts` (kein `.test.ts`) — dieses Muster fiel bislang nicht unter den bestehenden Ausschluss.
- **Fix:** `desktop/tsconfig.json` `exclude` um `"src/**/*.check.ts"` ergänzt — derselbe Mechanismus wie für `*.test.ts`, konsistent mit der bereits etablierten Konvention dieses Projekts.
- **Files modified:** desktop/tsconfig.json
- **Verification:** `npx tsc --noEmit` Exit 0, `npx tsx src/components/ui/confirmDialogProps.check.ts` Exit 0 (3/3 Tests grün)
- **Committed in:** d4e2924 (Task 3 commit)

### Sonstige Beobachtungen (kein Verhaltensunterschied)

**3. `apiClient.delete()` unterstützte bereits einen Anfragekörper**
- DD-30 verlangte eine Prüfung, ob `apiClient` eine `delete`-Methode mit Anfragekörper anbietet, und andernfalls eine Ergänzung nach dem Muster von `put()`. Geprüft (`desktop/src/api/client.ts`, `async delete<T>(endpoint: string, data?: unknown)`): die Methode existierte bereits zeichengleich zu `put()`. Keine Änderung nötig.

**4. `variant="warning"` hat einen bestehenden Aufrufer**
- Der Plantext (13-UI-SPEC.md Zeile 716) formuliert „kein Bestandsaufrufer" leicht verkürzt; der ausführlichere Absatz an anderer Stelle (Zeile 172–176) stellt klar, dass „die einzigen Nutzer... die Bestätigungen aus Phase 12 und Phase 13" sind — die Amber-Angleichung soll den bestehenden Phase-12-Aufrufer (`WorkTimeChangeModal.tsx:881`) also ausdrücklich mit erfassen. Per Grep verifiziert, keine Abweichung vom Plan, nur Dokumentation des tatsächlichen Befunds statt der wörtlichen (unpräzisen) Kurzformel.

---

**Total deviations:** 2 auto-fixed (beide Rule 3 — Blocking, notwendig für einen grünen `tsc --noEmit`), 2 dokumentierte Beobachtungen ohne Codeänderung.
**Impact on plan:** Keine der Abweichungen ändert das im Plan beschriebene Verhalten oder die öffentliche API. Die `tsconfig.json`-Ergänzung folgt exakt dem bereits etablierten Muster für `*.test.ts`.

## Issues Encountered

Keine über die oben dokumentierten Deviations hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten (`13-UI-SPEC.md`: „Neue Abhängigkeiten: keine"), keine Migration.

## Next Phase Readiness

- Plan 13-08 kann `useWorkPeriods()` verwenden und `error.message === 'FORBIDDEN'` gegen Zustand 3 („Kein Zugriff") prüfen — jeder andere Fehler bleibt Zustand 2 (Ladefehler mit Servermeldung).
- Plan 13-08/13-09 (Korrektur-/Löschdialog) können `useCorrectWorkPeriodPreview`/`useCorrectWorkPeriod`/`useDeleteWorkPeriodPreview`/`useDeleteWorkPeriod` direkt verdrahten — kein weiterer Hook nötig, keine Client-seitige Neuberechnung.
- `ConfirmDialog` kann jetzt Zustand 21 der 13-UI-SPEC (Löschen läuft: Spinner im Bestätigungsknopf, Abbrechen/X/ESC gesperrt) direkt abbilden — `confirmLoading` und `cancelDisabled` sind einsatzbereit, ohne dass ein zweiter Dialogstil entstanden ist.
- `desktop/src/api/client.ts` selbst (403-Präzisierung per Präfix-/Regex-Vergleich, Entfernen der 42 `console.log`) ist laut 13-UI-SPEC.md „Änderungen an Bestandskomponenten" weiterhin offen — bewusst NICHT Teil dieses Plans (Task 3 verlangte ausschließlich die Statuscode-Ergänzung für DD-31), gehört zu dem Plan, der die konsumierenden Komponenten (`WorkTimePeriodList.tsx`, `OvertimeTransactions.tsx`, `EditUserModal.tsx`) baut.
- `desktop/tsconfig.json` schließt jetzt auch `*.check.ts` aus — künftige Prüfskripte dieses Namensmusters sind für `tsc --noEmit` automatisch unsichtbar, ohne dass jeder Plan das erneut lösen muss.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle drei Commit-Hashes (2167b9e, e461271, d4e2924) in `git log --oneline --all` verifiziert.
Alle acht geänderten/neu angelegten Dateien auf der Festplatte verifiziert vorhanden
(`desktop/src/types/index.ts`, `desktop/src/hooks/useWorkTimeAccounts.ts`,
`desktop/src/components/ui/useModalLayer.ts`, `desktop/src/components/ui/ConfirmDialog.tsx`,
`desktop/src/hooks/useWorkTimeChange.ts`, `desktop/src/components/ui/confirmDialogProps.check.ts`,
`desktop/src/api/client.ts`, `desktop/tsconfig.json`). `cd desktop && npx tsc --noEmit` Exit 0.
`cd server && npx tsc --noEmit` Exit 0. `cd desktop && npx tsx src/components/ui/confirmDialogProps.check.ts`
Exit 0 (3/3 Tests grün). `cd server && npx vitest run` — 478 grün / 3 rot (Baseline aus
13-05-SUMMARY.md unverändert: 2× unifiedOvertimeService.test.ts, 1× vacationBackfillService.test.ts).
