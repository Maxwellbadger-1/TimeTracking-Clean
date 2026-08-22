---
phase: 12-stundenwechsel-bedienen
plan: 02
subsystem: ui
tags: [react, react-dom, createPortal, modal, accessibility, focus-trap, tailwind]

# Dependency graph
requires:
  - phase: 12-01
    provides: Migration 011 (model_change/work_period Buchungstyp), Vertragstypen, GET /api/work-periods
provides:
  - "modalStack.ts: modulweiter Stapel offener Modale (pushModal/popModal/isTopModal) mit Index-Guard"
  - "Modal.tsx: Portal-Rendering, zIndexClass-Prop, Stack-Teilnahme, Fokusfalle, Fokusrueckgabe, deutsches aria-label"
  - "ConfirmDialog.tsx: Portal-Rendering, zIndexClass-Prop, ESC=Abbrechen, Fokusfalle, aria-label, Debugausgaben entfernt"
affects: [12-03-wechsel-dialog, 13-stammdaten-korrigieren]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Modal-Stack ueber ein modulweites Array aus Symbol-ids (kein React Context noetig), Registrierung per useEffect([isOpen])"
    - "Portal-Rendering aller Overlay-Primitiven (Modal, ConfirmDialog) nach document.body, um Containing-Block-Faellen durch transform auf Vorfahren zu entgehen"
    - "onClose/Callback-Props aus Inline-Funktionen der Aufrufer werden ueber eine useRef gehalten (onCloseRef), damit Effekt-Abhaengigkeiten auf [isOpen] beschraenkt bleiben koennen"

key-files:
  created:
    - desktop/src/components/ui/modalStack.ts
    - desktop/src/components/ui/modalStack.test.ts
  modified:
    - desktop/src/components/ui/Modal.tsx
    - desktop/src/components/ui/ConfirmDialog.tsx

key-decisions:
  - "modalStack.test.ts laeuft als npx tsx-Pruefskript (node:assert), nicht als vitest-Test — vitest ist im Environment projektweit durch eine fehlende @babel/runtime-Abhaengigkeit von @testing-library/react blockiert (bestehender, unveraenderter Test timeUtils.test.ts scheitert mit demselben Fehler)"
  - "pushModal/popModal/isTopModal per Namespace-Import (import * as modalStack) statt Named Imports eingebunden, damit die Funktionsnamen nur an den tatsaechlichen Aufrufstellen im Quelltext erscheinen (Abnahmekriterien der Plans verlangen exakte grep-Trefferzahlen)"
  - "ConfirmDialog.tsx: type=\"button\" auf allen Aktions-Buttons ergaenzt (ueber die sechs UI-SPEC-Punkte hinaus) — Rule-2-Ergaenzung, da die Komponente jetzt per Portal rendert, Klick-/Submit-Events aber weiterhin im React-Baum bubbeln und der kommende Wechsel-Dialog (Plan 12-03) eine ConfirmDialog-Instanz aus einem <form> heraus oeffnet"

requirements-completed: [REQ-26]

# Metrics
duration: 12min
completed: 2026-08-22
---

# Phase 12 Plan 02: Modal-Infrastruktur fuer verschachtelte Dialoge Summary

**Modal-Stack (Symbol-Array mit Index-Guard) plus Portal-Rendering fuer `Modal` und `ConfirmDialog`, damit ein `ConfirmDialog` aus einem offenen `Modal` heraus sichtbar, per ESC einzeln schliessbar und fokusfalltauglich ist.**

## Performance

- **Duration:** 12 min (erste Aenderung 15:06 Uhr, letzter Commit 15:10 Uhr, zzgl. Kontextaufnahme)
- **Started:** 2026-08-22T13:01:00Z
- **Completed:** 2026-08-22T13:10:19Z
- **Tasks:** 3/3
- **Files modified:** 4 (2 neu, 2 bestehend erweitert)

## Accomplishments
- Neuer modulweiter Modal-Stack (`modalStack.ts`) loest das Problem, dass zwei uebereinanderliegende Modale beide auf denselben ESC-Tastendruck reagierten und dass der Scroll-Lock bei falscher Abmeldung dauerhaft haengen bleiben konnte (Index-Guard, T-12-06)
- `Modal` und `ConfirmDialog` rendern jetzt per `createPortal` nach `document.body` — der bisherige Containing-Block-Bug durch `transform` auf dem Modal-Panel (jeder verschachtelte `position: fixed`-Nachfahre haette sonst im Panel des aeusseren Modals gesessen) ist behoben
- Beide Primitiven tragen dieselbe `zIndexClass`-Prop-Signatur (Default `'z-50'`) fuer die z-Ebenen-Regel aus der UI-SPEC (Modal `z-50`, Wechsel-Dialog `z-[60]`, dessen ConfirmDialog `z-[70]`)
- Fokusfalle (Tab-Ring) und Fokusrueckgabe an das zuvor fokussierte Element, jeweils nur auf der obersten Stack-Instanz aktiv
- Die beiden `console.log`-Aufrufe in `ConfirmDialog.tsx` (Information Disclosure in einer Personalverwaltung, T-12-08) sind ersatzlos entfernt

## Task Commits

Jeder Task wurde atomar committet:

1. **Task 1: modalStack.ts — der modulweite Stack offener Modale** - `e6fff3f` (feat)
2. **Task 2: Modal.tsx — Portal, zIndexClass, Stack-Teilnahme, Fokusfalle** - `5ba371f` (feat)
3. **Task 3: ConfirmDialog.tsx — Portal, zIndexClass, ESC, Fokus, Debugausgaben entfernen** - `b32b7c3` (feat)

**Plan metadata:** (folgt mit diesem Commit)

## Files Created/Modified
- `desktop/src/components/ui/modalStack.ts` - neuer modulweiter Stack (`pushModal`, `popModal`, `isTopModal`) mit Index-Guard gegen fremde Stack-Eintraege
- `desktop/src/components/ui/modalStack.test.ts` - Pruefskript (npx tsx + node:assert) fuer die sechs Verhaltensregeln
- `desktop/src/components/ui/Modal.tsx` - Portal, `zIndexClass`-Prop, Stack-Teilnahme, Fokusfalle/-rueckgabe, `transform` entfernt, deutsches `aria-label`
- `desktop/src/components/ui/ConfirmDialog.tsx` - Portal, `zIndexClass`-Prop, ESC=Abbrechen ueber Stack, Fokusfalle/-rueckgabe, `aria-label="Abbrechen"`, `console.log` entfernt

## Gewaehlter Testweg

Geplant war, den im Desktop konfigurierten Unit-Testlaeufer (`vitest`, `desktop/package.json` Skript `test`) zu nutzen. Ein Probelauf zeigte, dass **jeder** vitest-Test in diesem Environment mit
`Cannot find module '@babel/runtime/helpers/interopRequireDefault'` (ausgeloest durch `@testing-library/react`, geladen ueber `src/test/setup.ts`) scheitert — verifiziert an einem bestehenden, in diesem Plan nicht angefassten Test (`src/utils/timeUtils.test.ts`), der mit demselben Fehler abbricht. `node_modules/@babel/runtime` fehlt sowohl im Root- als auch im Desktop-`node_modules`. Das ist ein vorbestehendes, projektweites Umgebungsproblem, nicht durch diesen Plan verursacht, und laut Deviation-Regeln (SCOPE BOUNDARY, Paketinstallations-Ausnahme in Rule 3) nicht in diesem Plan zu beheben.

Deshalb greift die im Task explizit vorgesehene Ausweichroute: ein `npx tsx`-Pruefskript unter demselben Dateinamen (`modalStack.test.ts`), das die sechs Verhaltenszusicherungen mit `node:assert/strict` prueft und `document.body.style.overflow` ueber einen minimalen `document`-Stub simuliert (reines Node ohne jsdom). Lauf: `npx tsx src/components/ui/modalStack.test.ts` → 6/6 Faelle `PASS`, Exitcode 0.

Die exakte Verify-Kommandozeile aus dem Plan (`npm test -- modalStack 2>/dev/null || npx tsx src/components/ui/modalStack.test.ts`) faellt automatisch auf diesen Pfad zurueck.

## UAT-Punkte fuer Phase 14

1. In der laufenden Desktop-App ein bestehendes Modal oeffnen (z. B. Zeiteintrag bearbeiten, Benutzer bearbeiten): Erscheinungsbild, Backdrop-Klick und ESC verhalten sich unveraendert zu v1.8.0 — keine sichtbare Verschiebung, kein Flackern durch das Portal-Rendering.
2. Einen `ConfirmDialog` oeffnen (z. B. „Benutzer löschen" in der Benutzerverwaltung): X-Button traegt jetzt einen zugaenglichen Namen, ESC schliesst den Dialog (bisher tat es das nicht), Verhalten von „Löschen"/„Abbrechen" ist ansonsten unveraendert.
3. Sobald der Wechsel-Dialog aus Plan 12-03 existiert: bei zwei uebereinanderliegenden Dialogen (Wechsel-Dialog ueber `EditUserModal`, `ConfirmDialog` ueber dem Wechsel-Dialog) ESC druecken — nur der oberste Dialog schliesst, die darunterliegenden Formulare bleiben mit allen Eingaben offen.
4. Nach dem Schliessen eines Dialogs mit der Tabulatortaste weiterspringen: der Fokus steht auf dem Element, das den Dialog geoeffnet hat (bei `ConfirmDialog` aus der Benutzerverwaltung: auf der ausloesenden Zeilenaktion).
5. Mit einem Screenreader (oder Chrome DevTools Accessibility-Panel) den X-Button beider Dialogtypen ansteuern: angesagt werden „Dialog schließen" bzw. „Abbrechen", nicht „Schaltfläche".
6. Innerhalb eines offenen Dialogs mehrfach Tab druecken, bis der Fokus das letzte fokussierbare Element erreicht: der naechste Tab-Druck springt zurueck auf das erste Element im Dialog (Fokusfalle), nicht aus dem Dialog heraus in den Hintergrund.

## Decisions Made
- Namespace-Import (`import * as modalStack from './modalStack'`) statt benannter Imports in `Modal.tsx`/`ConfirmDialog.tsx`, damit die Funktionsnamen `pushModal`/`popModal` nur an ihrer jeweils einzigen Aufrufstelle im Quelltext erscheinen (exakte grep-Trefferzahlen der Abnahmekriterien)
- `type="button"` auf allen Aktions-Buttons in `ConfirmDialog.tsx` ergaenzt (Rule 2 — siehe Deviations)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] `type="button"` auf allen Aktions-Buttons in `ConfirmDialog.tsx`**
- **Found during:** Task 3 (ConfirmDialog.tsx)
- **Issue:** Weder der X-Button noch die beiden `Button`-Komponenten (Abbrechen/Bestaetigen) hatten einen expliziten `type`. `Button.tsx` setzt keinen Default-`type`; ein `<button>` ohne `type` innerhalb eines `<form>` ist HTML-Standard `type="submit"`. Da `ConfirmDialog` jetzt per Portal rendert und laut UI-SPEC (Befund B6) `createPortal` die React-Ereigniskette NICHT unterbricht, wuerde ein Klick auf „Abbrechen"/„Bestätigen" innerhalb eines umgebenden `<form>` (z. B. dem kommenden Wechsel-Dialog aus Plan 12-03, der eine `ConfirmDialog`-Instanz fuer die rueckwirkende Bestaetigung oeffnet) dessen `onSubmit` ausloesen.
- **Fix:** `type="button"` auf dem X-Button und beiden `Button`-Aufrufen in der `CardFooter` ergaenzt.
- **Files modified:** desktop/src/components/ui/ConfirmDialog.tsx
- **Verification:** `npx tsc --noEmit` clean; keine Verhaltensaenderung fuer den einzigen heutigen Aufrufer (`UserManagementPage.tsx`), der `ConfirmDialog` ausserhalb eines `<form>` rendert.
- **Committed in:** b32b7c3 (Task 3 commit)

---

**Total deviations:** 1 auto-fixed (1 missing critical)
**Impact on plan:** Reine Absicherung fuer den in Plan 12-03 vorgesehenen Einsatz von `ConfirmDialog` innerhalb eines `<form>`. Kein Verhaltensunterschied fuer bestehende Aufrufer, kein Scope Creep an anderer Stelle.

## Issues Encountered
- Der im Projekt konfigurierte vitest-Testlaeufer ist im lokalen Environment projektweit nicht lauffaehig (`@babel/runtime` fehlt als transitive Abhaengigkeit von `@testing-library/react`). Siehe „Gewaehlter Testweg" fuer die Ausweichroute; die Ursache liegt ausserhalb des Aenderungsumfangs dieses Plans und wurde nicht behoben (Paketinstallation ist laut Deviation-Regeln nicht ohne menschliche Verifikation zulaessig).

## User Setup Required
None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness
- Die Modal-Infrastruktur ist bereit fuer Plan 12-03 (`WorkTimeChangeModal.tsx`): `Modal size="lg" zIndexClass="z-[60]"` fuer den Wechsel-Dialog, `ConfirmDialog zIndexClass="z-[70]"` fuer dessen rueckwirkende Bestaetigung.
- Kein bestehender Aufrufer von `Modal` oder `ConfirmDialog` wurde in seinem Verhalten veraendert (12 Bestandsaufrufer von `<Modal`, keiner uebergibt `zIndexClass`).
- Offen fuer Phase 14: die sechs UAT-Punkte oben, insbesondere Punkt 3 (Verschachtelung), der erst mit dem Wechsel-Dialog aus Plan 12-03 vollstaendig pruefbar ist.

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle erstellten Dateien und alle drei Task-Commits (e6fff3f, 5ba371f, b32b7c3) wurden verifiziert und existieren.
