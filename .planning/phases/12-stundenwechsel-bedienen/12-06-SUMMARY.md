---
phase: 12-stundenwechsel-bedienen
plan: 06
subsystem: ui
tags: [react, typescript, tanstack-query, tauri, desktop, modal]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 02
    provides: "Modal-Stack, Modal.tsx/ConfirmDialog.tsx mit zIndexClass, Portal-Rendering, Fokusfalle/-rueckgabe"
  - phase: 12-stundenwechsel-bedienen
    plan: 04
    provides: "useWorkPeriods/usePreviewWorkTimeChange/useSaveWorkTimeChange, Desktop-Vertragstypen"
  - phase: 12-stundenwechsel-bedienen
    plan: 05
    provides: "POST /api/work-periods/preview und /change, previewToken-Vertrag (PREVIEW_STALE bei Ablehnung)"
provides:
  - "desktop/src/components/worktime/WorkTimeChangeModal.tsx — der Wechsel-Dialog als eigenstaendige Komponente mit allen 15 UI-SPEC-Zustaenden"
affects: [12-07]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "previewToken-Verwerfung synchron im selben State-Update wie die Feldaenderung (nicht im entprellten Callback) — Grundlage fuer T-12-28"
    - "Vorschaupanel liest jede Zahl unveraendert aus WorkTimeChangePreviewResponse (D2); keine Differenzrechnung im Client, belegt durch grep-Zusicherung auf balanceAfter-balanceBefore/targetHoursAfter-targetHoursBefore = 0"
    - "PREVIEW_STALE-Fehlschlagzaehler (staleFailureCount) verhindert eine Endlosschleife aus automatischer Neuberechnung und automatischer Ablehnung (T-12-32) — erster Fehlschlag loest automatische Neuberechnung aus, zweiter faellt in den Fehlerzustand des Panels zurueck"

key-files:
  created:
    - desktop/src/components/worktime/WorkTimeChangeModal.tsx
  modified: []

key-decisions:
  - "Zustand 8 (nichts umzustellen) wechselt zwischen Task 1 und Task 2 die Datenquelle: Task 1 vergleicht client-seitig (currentPeriod vs. Eingabe, reine Gleichheitspruefung, keine Zahl), Task 2 ersetzt das vollstaendig durch preview.isNoOp vom Server, sobald usePreviewWorkTimeChange verdrahtet ist — im fertigen Dialog gibt es keine Client-Vergleichslogik mehr"
  - "Randfall Differenz = 0: formatSignedHours() zeigt '± 0:00h' statt '+0:00h' — eine unveraenderte Groesse ist weder Gutschrift noch Belastung, wortgleich mit dem in 12-UI-SPEC.md beschriebenen Randfall"
  - "Ueberlappungsfehler des Servers ('... existiert bereits eine Periode ...') wird anhand eines Teilstrings der Fehlermeldung erkannt und als Feldfehler am Stichtag gezeigt (Zustand 10), statt als generischer Vorschau-Fehlerzustand (Zustand 5) — einzige Unterscheidung, die ohne einen vom Server gelieferten Fehlercode moeglich ist"
  - "requestPreview() wird sowohl vom entprellten Effekt als auch von der manuellen 'Vorschau erneut berechnen'-Schaltflaeche und der automatischen Neuberechnung nach dem ersten PREVIEW_STALE-Fehlschlag aufgerufen — eine einzige Aufrufstelle fuer den Serveraufruf"

patterns-established:
  - "Vorschaupanel als einzelner role=status aria-live=polite aria-busy-Container mit sechs Inhaltszweigen (placeholder/loading/error/noop/future/past) statt fuenf getrennter Komponenten — haelt Kopfzeile (Ueberschrift+Badge) und Fussnote (REQ-28) an einer Stelle im Code"

requirements-completed: [REQ-26, REQ-27, REQ-28]

# Metrics
duration: ~70min
completed: 2026-08-22
---

# Phase 12 Plan 06: Der Wechsel-Dialog Summary

**`WorkTimeChangeModal.tsx` — ein 693-Zeilen-Dialog mit automatischer, 400ms entprellter Server-Vorschau, synchron verworfenem `previewToken`, fuenf farblich unterscheidbaren Panelvarianten und einer eigenen `ConfirmDialog`-Bestaetigung fuer rueckwirkende Stichtage, ausschliesslich Serverwerte im Vorschaupanel (D2/REQ-27).**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2/2 completed
- **Files modified:** 1 (neu)

## Accomplishments

- `WorkTimeChangeModal.tsx` (693 Zeilen) implementiert alle 15 in `12-UI-SPEC.md` verlangten
  Zustaende: Laden/Fehler der Periodenliste, Vorbelegung aus der aktuell gueltigen Periode
  ohne Vorbelegung des Stichtags, Validierung nach dem Textbuch, automatische Server-Vorschau,
  fuenf Panelvarianten, Bestaetigung bei rueckwirkendem Stichtag, Speicherpfad inklusive
  `PREVIEW_STALE`-Behandlung mit begrenzter automatischer Neuberechnung.
- Der Dialog rechnet nichts selbst: `grep -cE "balanceAfter\s*-\s*balanceBefore|targetHoursAfter\s*-\s*targetHoursBefore"` liefert 0 — jede angezeigte Zahl (Sollstunden
  bisher/neu/Differenz, Saldo heute/nachher, die hervorgehobene Aenderung) stammt unveraendert
  aus `WorkTimeChangePreviewResponse`.
- Der Primaerbutton haengt strikt am `previewToken`: jede Aenderung an Stichtag, Wochenstunden
  oder Tagesplan verwirft `preview` (und damit das Token) im selben State-Update wie die
  Feldaenderung — nicht im 400-ms-entprellten Callback (T-12-28).
- Zukunft und Vergangenheit unterscheiden sich in Flaechenfarbe, Icon, Badge, Zeitraumsatz und
  Buttonlabel; der rueckwirkende Pfad fuehrt zusaetzlich ueber einen eigenen
  `ConfirmDialog variant="warning" zIndexClass="z-[70]"`, gerendert ausserhalb des `<form>`.
- `npx tsc --noEmit` bleibt gruen; kein `any`, kein nacktes `fetch()`, kein `console.*`, kein
  `toISOString`.

## Task Commits

Each task was committed atomically:

1. **Task 1: Dialoggeruest, Formular, Vorbelegung und Validierung (Zustaende 1-3, 8, 9)** - `36773fe` (feat)
2. **Task 2: Vorschaupanel, previewToken-Kopplung, Bestaetigung und Speicherpfad (Zustaende 4-7, 10-15)** - `5fa88b7` (feat)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified

- `desktop/src/components/worktime/WorkTimeChangeModal.tsx` - Der Wechsel-Dialog: Formular
  (Stichtag, Wochenstunden, Tagesplan via `WorkScheduleEditor`, Begruendung), Vorschaupanel
  (fuenf Varianten + Zustand 8), `ConfirmDialog`-Bestaetigung, Speicherpfad ueber
  `useSaveWorkTimeChange`

## Zustandsabdeckung

| # | Zustand | Codestelle (Zeile) | Notiz |
|---|---------|---------------------|-------|
| 1 | Dialog öffnet, Perioden laden | `WorkTimeChangeModal.tsx:436` | Infopanel zeigt zentrierten `LoadingSpinner` (`py-8`) während `periodsQuery.isLoading`; Primärbutton ist gesperrt, weil `preview === null` |
| 2 | Periodenliste Fehler | `WorkTimeChangeModal.tsx:440` | Fallbacktext im Infopanel bei `periodsQuery.isError`; Primärbutton wird dadurch NICHT gesperrt (Vorschau ist eigenständig serverseitig geprüft) |
| 3 | Vorschau noch nicht möglich | `WorkTimeChangeModal.tsx:381` (Zustandsermittlung), `554` (Text) | `getPreviewPanelState()` liefert `'placeholder'`, solange Stichtag/Wochenstunden fehlen oder noch keine Antwort vorliegt |
| 4 | Vorschau lädt | `WorkTimeChangeModal.tsx:381`, `560-563` | `previewM.isPending` → `LoadingSpinner size="sm"` + Text, `aria-busy={previewM.isPending}` auf dem Panel-Container |
| 5 | Vorschau Fehler | `WorkTimeChangeModal.tsx:567-579` | `previewErrorMessage` gesetzt (aus `requestPreview`s `onError` oder dem zweiten `PREVIEW_STALE`-Fehlschlag), Button "Vorschau erneut berechnen" ruft `requestPreview` erneut |
| 6 | Vorschau bereit — Zukunft | `WorkTimeChangeModal.tsx:540-544`, `589-627` | Blaues Panel, Badge "Keine Rückwirkung", Zeitraumsatz aus `preview.validFrom` |
| 7 | Vorschau bereit — Vergangenheit | `WorkTimeChangeModal.tsx:545-549`, `589-627` | Bernsteinfarbenes Panel, Badge "Rückwirkend", Zeitraumsatz aus `preview.rangeStart/rangeEnd/workingDaysInRange` |
| 8 | Eingaben entsprechen der aktuell gültigen Periode | `WorkTimeChangeModal.tsx:582-587` | Graues Panel, `Info`-Icon gray-500/400, Text aus `preview.currentPeriod?.validFrom ?? preview.validFrom`; Primärbutton gesperrt über `preview.isNoOp` (Zeile 335) |
| 9 | Validierungsfehler | `WorkTimeChangeModal.tsx:244-278` (`validateForm`) | Meldungen wörtlich aus dem Textbuch, Fokus auf erstes fehlerhaftes Feld (`validFromRef`/`weeklyHoursRef`/`reasonRef`), kein Serveraufruf |
| 10 | Stichtag überlappt bestehende Periode | `WorkTimeChangeModal.tsx:184-186` (Serverpfad), `254` (Client-Vorabprüfung) | Serverfehlermeldung wird per Teilstring erkannt und als Feldfehler an `validFrom` gesetzt; clientseitig zusätzlich vorab geprüft, wenn die Periodenliste bereits geladen ist |
| 11 | Bestätigung offen (nur rückwirkend) | `WorkTimeChangeModal.tsx:680-689` | `ConfirmDialog variant="warning" zIndexClass="z-[70]"`, außerhalb des `<form>` gerendert, Nulldifferenz-Textvariante in `buildConfirmMessage()` (Zeile 361-368) |
| 12 | Speichern läuft | `WorkTimeChangeModal.tsx:100` (`isSaving`), `655` (Abbrechen `disabled`), `665-672` (Primärbutton-Inhalt) | `Modal onClose={isSaving ? () => {} : handleClose}` macht ESC/Backdrop wirkungslos |
| 13 | Speichern fehlgeschlagen | `WorkTimeChangeModal.tsx:307-350` (`performSave`, `catch`-Zweig), `348` (Bannertext) | Rotes Banner am Kopf des Formulars, alle Eingaben und die Vorschau bleiben stehen |
| 14 | Vorschau veraltet (Token abgelehnt) | `WorkTimeChangeModal.tsx:328-346` | Erster Fehlschlag: Banner + `requestPreview()`-Neuaufruf; zweiter Fehlschlag in Folge: Rückfall in Zustand 5 (`previewErrorMessage` gesetzt, `staleFailureCount >= 2`) |
| 15 | Erfolg | `WorkTimeChangeModal.tsx:307-326` (`performSave`, Erfolgspfad) | `resetForm()`, `onSaved?.(result)`, `onClose()` — Toast/grünes Banner im `EditUserModal` sind Sache von Plan 12-07 |

## Decisions Made

- Zustand 8 wechselt bewusst zwischen Task 1 (client-seitiger Gleichheitsvergleich gegen
  `currentPeriod`) und Task 2 (serverseitiges `preview.isNoOp`) die Datenquelle — siehe
  `key-decisions` oben. Im fertigen Dialog (nach Task 2) gibt es keine Client-Vergleichslogik
  mehr; sie war ausschließlich die Zwischenstufe, die Task 1 für seine eigenen
  Acceptance-Criteria brauchte, bevor `usePreviewWorkTimeChange` verdrahtet war.
- `formatSignedHours()` zeigt bei einer Differenz von exakt 0 den Text `± 0:00h` (mit dem
  Unicode-Zeichen `±`) statt `+0:00h` — wortgleich mit dem in `12-UI-SPEC.md` beschriebenen
  Randfall "Differenz = 0 bei rückwirkendem Stichtag".
- Die serverseitige Überlappungsmeldung wird über `message.includes('existiert bereits eine
  Periode')` erkannt (kein strukturierter Fehlercode im Server-Vertrag vorhanden) und dann als
  Feldfehler an `validFrom` angezeigt statt als generischer Vorschau-Fehlerzustand.
- `previewToken` bindet ausschließlich Stichtag, Wochenstunden und Tagesplan (nicht die
  Begründung) — jede Änderung an einem der drei Felder ruft `setPreview(null)` synchron im
  selben Event-Handler auf wie die eigentliche Feldänderung, nicht im 400-ms-entprellten
  Preview-Callback.

## Deviations from Plan

### Beobachtungen (kein Auto-Fix nötig)

**1. Acceptance-Criterion "`grep -c \"400\"` liefert genau 1" trifft nicht literal zu**
- **Gefunden während:** Task 2 Verifikation
- **Befund:** `grep -c "400"` zählt aktuell 22 Treffer statt 1. Davon ist genau **eine** Zeile
  die tatsächliche Zeitkonstante (`const PREVIEW_DEBOUNCE_MS = 400;`, Zeile 40); die
  verbleibenden 21 Treffer sind ausschließlich Tailwind-Dark-Mode-Farbklassen der Stufe 400
  (z. B. `dark:text-blue-400`, `dark:text-amber-400`, `dark:text-red-400`,
  `dark:text-gray-400`), die aus der Dark-Mode-Pflicht (`.claude/CLAUDE.md` → Quality Gates)
  zwingend folgen und projektweit an jeder farbcodierten Stelle in diesem Muster auftreten
  (siehe `OvertimeTransactions.tsx`, `WorkTimePeriodList.tsx`).
- **Bewertung:** Die fachliche Anforderung — "der Wert 400 kommt als Zeitkonstante genau
  einmal vor" — ist erfüllt und per `grep -n "400" | grep -v -- "-400"` isoliert nachgewiesen
  (genau eine Trefferzeile: die Konstante selbst). Begleitende Kommentare, die "400 ms" im
  Fließtext nannten, wurden entfernt, um die Störgröße zu minimieren. Ein Verzicht auf
  Dark-Mode-Klassen der Stufe 400 zur Erfüllung eines wörtlichen `grep -c`-Ergebnisses würde
  gegen die Dark-Mode-Pflicht verstoßen — dieselbe Kategorie Zählkonflikt wie bereits in
  `12-01-SUMMARY.md` (`work_period` kollidierte mit `user_work_periods`) und
  `12-05-SUMMARY.md` (`requireAdmin` zählte die Importzeile mit) dokumentiert. Kein Code
  geändert außer der Kommentarbereinigung.

## Known Stubs

Keine. Der Dialog ist vollständig funktionsfähig (Formular, Vorschau, Bestätigung, Speichern);
er wird lediglich noch nicht in `EditUserModal.tsx` eingebunden — das ist ausdrücklich Aufgabe
von Plan 12-07 (siehe Objective dieses Plans: "Der Dialog wird in Plan 12-07 eingebunden").

## Threat Flags

Keine neue, im `<threat_model>` dieses Plans nicht bereits erfasste Angriffsfläche gefunden.
T-12-28 (veraltetes Token), T-12-29 (Repudiation), T-12-30 (Information Disclosure),
T-12-31 (Spoofing), T-12-32 (DoS durch Automatik-Schleife) sind wie im Plan vorgesehen
mitigiert — belegt durch die grep-Zusicherungen und die Zustandsabdeckungstabelle oben.

## Issues Encountered

- Zwei der Task-2-Acceptance-Criteria kollidierten anfänglich mit der Quelltextformatierung:
  Der noop-Text "Es gibt nichts umzustellen" war über einen JSX-Zeilenumbruch auf zwei
  Quellcodezeilen verteilt (im gerenderten Ergebnis identisch, aber `grep -c` prüft den
  Quelltext) — auf eine Zeile zusammengezogen. Die Kommentare zur 400-ms-Entprellzeit haben
  denselben Zählkonflikt wie oben unter "Deviations" dokumentiert; dort blieb er bestehen, da
  er fachlich unvermeidbar ist (Dark-Mode-Pflicht).

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- `WorkTimeChangeModal.tsx` exportiert `WorkTimeChangeModal({ isOpen, onClose, user, onSaved })`
  — Plan 12-07 kann die Komponente direkt in `EditUserModal.tsx` importieren und außerhalb
  dessen `<form>` rendern (Formulargrenzen-Vorgabe aus `12-UI-SPEC.md`).
- Der Erfolgspfad ruft `onSaved?.(result)` vor `onClose()` auf — Plan 12-07 kann darüber das
  grüne 8-Sekunden-Banner und den `toast.success(...)` im `EditUserModal` auslösen, ohne diese
  Komponente erneut anzufassen.
- Kein Blocker für Plan 12-07.

## UAT-Punkte für Phase 14

1. **Visuelle Abnahme des Dialogs im hellen und dunklen Modus:** Die hervorgehobene
   Saldoänderung (`text-lg font-bold`, grün/rot, Trendpfeil) ist das erste Element, auf das der
   Blick fällt; kein zweites Element im Dialog konkurriert mit dieser Farb-Größe-Kombination.
   Zu prüfen, sobald der Dialog über Plan 12-07 in `EditUserModal.tsx` sichtbar ist.
2. **Bedienung ausschließlich mit der Tastatur:** Tab-Reihenfolge folgt der Leserichtung, Fokus
   liegt beim Öffnen auf "Stichtag" (code-seitig über `validFromRef.current?.focus()`
   verdrahtet), ESC schließt nur den obersten Dialog (Modal-Stack aus Plan 12-02), nach dem
   Schließen steht der Fokus auf "Stundenwechsel ab Datum …" (Fokusrückgabe-Mechanismus in
   `Modal.tsx`, dort bereits verifiziert). Interaktiver Test steht aus, bis der Dialog
   eingebettet ist.
3. **Rückwirkender Wechsel mit Differenz 0:** Zeitraumsatz erscheint, Saldozeile und die
   hervorgehobene Änderung zeigen "± 0:00h", die `ConfirmDialog`-Bestätigung läuft mit der
   Nulldifferenz-Textvariante (`buildConfirmMessage()`, code-seitig verifiziert über die
   Verzweigung auf `preview.balanceDelta === 0`). Interaktiver Test mit echten Daten steht aus.
4. **Fenster auf unter 640 px ziehen:** Stichtag und Wochenstunden stehen untereinander
   (`grid-cols-1 md:grid-cols-2`), die Sollstunden-Kennzahlen ebenfalls
   (`grid-cols-1 sm:grid-cols-3`), nichts wird abgeschnitten. Code-seitig nach der UI-SPEC
   umgesetzt; visuelle Bestätigung steht aus.
5. **Vorschau abrufen, 15 Minuten warten, dann speichern:** Zustand 14 erscheint mit
   automatischer Neuberechnung; beim zweiten Fehlschlag in Folge Rückfall in Zustand 5. Die
   15-Minuten-Gültigkeit des Tokens wurde bereits serverseitig in `12-05-SUMMARY.md`
   verifiziert; der End-to-End-Test mit einem tatsächlich 15 Minuten offenen Dialogfenster
   steht für Phase 14 aus.
6. **Ein Nutzer ohne jede vorherige Periode (frisch angelegt):** Infopanel zeigt "Aktuell
   gültig seit {Eintrittsdatum}: {Stammdaten-Wochenstunden} h/Woche" als Fallback
   (`currentPeriod?.validFrom ?? user.hireDate`), da `resolveWorkPeriodIn` in diesem Fall keine
   Periode findet. Code-seitig plausibel, gegen einen echten Neuanlage-Fall in Phase 14 zu
   verifizieren.

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

`desktop/src/components/worktime/WorkTimeChangeModal.tsx` und diese SUMMARY.md verifiziert
vorhanden. Beide Task-Commits (`36773fe`, `5fa88b7`) in `git log --oneline --all` nachgewiesen.
`npx tsc --noEmit` läuft ohne Ausgabe (Exitcode 0) in `desktop/`. Alle grep-basierten
Acceptance-Criteria beider Tasks wurden nach dem jeweiligen Commit erneut gemessen und
erfüllt (Ausnahme: das "400"-Kriterium — siehe "Deviations from Plan").
