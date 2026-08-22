---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 09
subsystem: ui
tags: [react, tanstack-query, typescript-contracts, modal, tauri, accessibility]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 08)
    provides: "WorkTimePeriodEditModal.tsx (Korrektur-Dialog), WorkTimePeriodList.tsx mit accessDenied/footnote-Props und server-seitigem isCurrent"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 07)
    provides: "ConfirmDialog um details/confirmDisabled/confirmLoading/cancelDisabled/closeOnConfirm erweitert, useDeleteWorkPeriodPreview/useDeleteWorkPeriod-Hooks"
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 05)
    provides: "POST /:id/delete/preview, DELETE /:id mit previewToken-Bindung"
provides:
  - "workTimePeriodActions.tsx — Aktionszelle je Periodenzeile (Korrigieren/Löschen/Hinweis-Chip), erste Komponente, die den Phase-12-Andockpunkt renderActions tatsächlich aufruft"
  - "workTimePeriodDeleteRules.ts — acht reine Textfunktionen der Löschbestätigung, maschinell geprüft ohne vitest"
  - "EditUserModal.tsx: Korrekturblock, dauerhafte Fußnote, Löschbestätigung mit Server-Vorschau, grünes Erfolgsbanner — der Bildschirm, auf dem Korrigieren und Löschen nebeneinander stehen und trotzdem nicht verwechselt werden können"
  - "ConfirmDialog.tsx: sechste additive Prop confirmAriaLabel"
affects: [13-11]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Aktionszelle als eigene Datei (DD-36), aus EditUserModal.tsx ausgelagert — Props period/hireDate/onCorrect/onDelete/isDeleting/correctButtonRef/deleteButtonRef, kennt keine Rollenlogik selbst"
    - "Löschbestätigung: dauerhaft gemountet mit isOpen-Toggle (wie WorkTimePeriodEditModal-Nachbardialoge), weil closeOnConfirm={false} sie waehrend des Loeschens/Fehlerfalls offen haelt; Korrektur-Dialog dagegen bedingt gemountet ({correctionPeriod && <...>}) — verlangt eine echte, nicht-nullable period-Prop, useModalLayer fuehrt Anfangsfokus/Fokusrueckgabe beim ersten Render genauso aus wie bei einem isOpen-Wechsel"
    - "Punkt 1 der Löschbestätigung (Lückenschluss) ist client-seitig aus periodsAscending + D3 ableitbar (newValidTo = deletionPeriod.validTo); Punkt 2 (Storno-Betrag) und Punkt 3 (Saldoänderung) hängen beide an derselben Server-Vorschau und teilen sich denselben loading/error/ready-Zyklus — abweichend von DD-38, das faelschlich behauptet, Punkt 2 sei ebenfalls vorab bekannt"
key-files:
  created:
    - desktop/src/components/worktime/workTimePeriodActions.tsx
    - desktop/src/components/worktime/workTimePeriodDeleteRules.ts
    - desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts
  modified:
    - desktop/src/components/users/EditUserModal.tsx
    - desktop/src/components/ui/ConfirmDialog.tsx

key-decisions:
  - "Pflichtbegründung (≥10 Zeichen) für das Löschen als Textarea im details-Panel der Löschbestätigung ergänzt (Rule 2) — 13-UI-SPEC.md zeigt für die Löschbestätigung keinen Begründungs-Schritt, aber der Server (workPeriodDeletionService.ts, validateDeletionInput, dryRun===false) weist eine leere/kurze Begründung im Speicherpfad ab; ohne das Feld wäre jeder echte Löschversuch ein serverseitiger 400 'Begründung ist erforderlich'"
  - "ConfirmDialog um die sechste additive Prop confirmAriaLabel erweitert (nicht in 13-09-PLAN.md files_modified gelistet) — 13-UI-SPEC.md Barrierefreiheit fordert einen konkreten aria-label am Bestätigungsknopf ('Periode vom {Datum} löschen und stornieren'), den Task 2 bereits als deleteConfirmAriaLabel() geliefert hatte, aber ConfirmDialog bot dafür keinen Andockpunkt; additiv, optional, rückwärtskompatibel"
  - "Punkt 1 der details-Liste (Lückenschluss) wird sofort beim Öffnen gerendert (D3: newValidTo der Vorperiode = deletionPeriod.validTo, clientseitig bekannt); Punkt 2 (Storno-Betrag) wartet zusammen mit Punkt 3 auf die Server-Vorschau, weil reversedTransactions dem Client vorher nicht bekannt ist — DD-38 behauptet pauschal 'Punkt 1 und Punkt 2 stehen schon vorher', was für Punkt 2 technisch nicht zutrifft"
  - "Löschbestätigungsdialog bleibt dauerhaft gemountet (isOpen-Toggle), der Korrektur-Dialog wird bedingt gerendert ({correctionPeriod && ...}) — WorkTimePeriodEditModal verlangt eine nicht-nullable period-Prop, ein Platzhalterobjekt für den geschlossenen Zustand wäre unehrlich; useModalLayer reagiert bereits beim ersten Render identisch zu einem isOpen-Wechsel"
  - "openDeletion/handleConfirmDeletion nutzen ein gemeinsames Ref pro Aktionstyp (rowDeleteButtonRef) statt Perioden-ID-indizierter Refs (DD-39 wörtlich: 'je ein eigenes ref' pro Auslösertyp, nicht pro Zeile) — nach erfolgreichem Löschen verschwindet die Zeile aus der Liste, der Fokus kehrt dann nicht sichtbar zurück (kein Crash, akzeptierte Einschränkung des Musters)"

requirements-completed: [REQ-30, REQ-31]

# Metrics
duration: ~75min
completed: 2026-08-22
---

# Phase 13 Plan 09: Korrigieren und Löschen im selben Bildschirm Summary

**Periodenzeilen tragen jetzt „Korrigieren"/„Löschen" (oder einen fokussierbaren „Nicht löschbar"-Hinweis-Chip auf der ersten Periode), ein optisch leiserer Korrekturblock unter der Liste öffnet denselben Korrektur-Dialog wie die Zeilenaktion, und eine erweiterte `ConfirmDialog`-Löschbestätigung lädt vor der Bestätigung eine servergerechnete Saldoänderung — sechs unabhängige Merkmale trennen die harmlose von der folgenschweren Aktion (REQ-30/REQ-31).**

## Performance

- **Duration:** ~75 min
- **Tasks:** 3/3 completed
- **Files modified:** 5 (3 neu, 2 geändert)

## Accomplishments

- `workTimePeriodActions.tsx` (neu): Aktionszelle je Periodenzeile. Normale Periode: „Korrigieren"
  (`Pencil`) und „Löschen" (`Trash2`, rot, wortgleiches Muster aus `CorrectionsTable.tsx`).
  Erste Periode (`isFirst`): kein Löschknopf, stattdessen ein fokussierbarer Chip „Nicht
  löschbar" (`tabIndex={0}`, `role="note"`, vollständiger `aria-label`-Satz). Das
  Tooltip-Bestandsmuster aus `OvertimeTransactions.tsx` (hover-only) wurde um
  `group-focus-within` UND eine ESC-Ausblendbarkeit mit `stopPropagation()` ergänzt (WCAG 2.2,
  1.4.13) — das Bestandsmuster allein hätte sehende Tastaturnutzer ausgeschlossen. Läuft das
  Löschen für eine Zeile, ersetzt `LoadingSpinner` den Löschknopf, beide Aktionen sind
  `disabled`. Unter 640 px nur Icons mit `p-2` (32×32 px Trefferfläche), Beschriftung über
  `aria-label`/`title`.
- `workTimePeriodDeleteRules.ts` + `.check.ts` (neu): acht reine Funktionen für Titel, Nachricht,
  die drei `details`-Punkte (Lückenschluss/Storno/Saldoänderung) und die Bestätigungssteuerung.
  Mehrzahlform für `deleteDetailReversal`, wenn `reversedTransactions.length > 1` (eine Periode
  kann mehr als eine `model_change`-Buchung tragen, dokumentierte Abweichung vom
  Textbuch-Singular aus 13-02-PLAN.md). 14 Testfälle über `npx tsx` + `node:assert`, vollständige
  Zeichenkettenvergleiche.
- `EditUserModal.tsx`: `renderActions`/`footnote` an `WorkTimePeriodList` gesetzt (nur für
  Administratoren, T-13-41) — der in Phase 12 gebaute Andockpunkt bekommt seinen ersten
  Aufrufer. Korrekturblock unter der Liste (Ghost-Knopf, `AlertTriangle` amber, eigene
  Überschrift „Sonderfall: Die Werte waren von jeher falsch") ist ausgeblendet ohne Periode
  (Zustand 4) und für Nicht-Admins; sein Knopf ist `disabled` bei Ladefehler der Periodenliste.
  Der Block-Knopf öffnet `WorkTimePeriodEditModal` vorbelegt mit der heute gültigen Periode,
  ersatzweise der ersten (DD-37); die Zeilenaktion „Korrigieren" öffnet denselben Dialog mit der
  angeklickten Periode. Löschbestätigung (`ConfirmDialog variant="danger" zIndexClass="z-[60]"`)
  lädt beim Öffnen `useDeleteWorkPeriodPreview`; Punkt 1 der `details`-Liste steht sofort
  (client-seitig aus D3 ableitbar), Punkt 2 und 3 warten gemeinsam auf die Vorschau. Der
  Bestätigungsknopf bleibt gesperrt, bis die Vorschau steht UND eine Begründung ≥10 Zeichen
  eingetragen ist; scheitert die Vorschau, bleibt er gesperrt (DD-38). `confirmLoading`/
  `cancelDisabled` während des Löschens, `closeOnConfirm={false}` — der Dialog schließt sich
  selbst erst nach Erfolg. Grünes 8-Sekunden-Banner + `toast.success` nach Korrektur/Löschen,
  kein „Rückgängig"-Aktionsknopf im Toast (T-13-44). Beide neuen Dialoge stehen als Geschwister
  nach `</form>` (Zeilen 898/939/955, `</form>` bei Zeile 892) — DD-40/T-13-42.
- `ConfirmDialog.tsx`: sechste additive Prop `confirmAriaLabel?: string`, angewandt auf den
  Bestätigungsknopf (`aria-label`) — ungesetzt bleibt das bisherige Verhalten (accessible name
  aus `confirmText`) unverändert für alle Bestandsaufrufer.

## Task Commits

1. **Task 1: Aktionszelle je Periodenzeile** - `6163e23` (feat)
2. **Task 2: Löschbestätigung — Regeln und Prüfskript** - `45ae5c4` (test)
3. **Task 3: EditUserModal — Korrekturblock, Fußnote, Zeilenaktionen, Löschbestätigung, Erfolgsbanner** - `84fb059` (feat)

**Plan metadata:** siehe finaler Commit dieses Plans (nach diesem SUMMARY).

## Files Created/Modified

- `desktop/src/components/worktime/workTimePeriodActions.tsx` - neu, Aktionszelle je Periodenzeile
- `desktop/src/components/worktime/workTimePeriodDeleteRules.ts` - neu, acht reine Textfunktionen
- `desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts` - neu, 14 Verhaltenstests
- `desktop/src/components/users/EditUserModal.tsx` - Korrekturblock, Fußnote, Dialogsteuerung, Erfolgsbanner
- `desktop/src/components/ui/ConfirmDialog.tsx` - sechste additive Prop `confirmAriaLabel`

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] Pflichtbegründung für das Löschen ergänzt**
- **Found during:** Task 3, beim Nachvollziehen des Serverpfads (`workPeriodDeletionService.ts`)
- **Issue:** `13-09-PLAN.md` beschreibt die Löschbestätigung ausschließlich mit `title`,
  `message` und den drei `details`-Punkten — keinerlei Eingabefeld für eine Begründung. Der
  Server verlangt sie aber zwingend im Speicherpfad (`validateDeletionInput`, `dryRun === false`:
  wirft `Begründung ist erforderlich` bzw. `Begründung muss mindestens 10 Zeichen lang sein`).
  Ohne ein Eingabefeld hätte der Bestätigungsknopf zwar geklickt werden können, jeder echte
  Löschversuch wäre aber serverseitig mit 400 gescheitert — die Löschfunktion wäre faktisch
  nicht benutzbar gewesen.
- **Fix:** `Textarea label="Begründung (Pflicht)"` im `details`-Panel ergänzt (einziger von
  `ConfirmDialog` angebotener Inhaltsslot außerhalb der festen drei Punkte), Zeichenzähler
  `{n}/10 Zeichen (Minimum)`. `confirmDisabled` kombiniert `isDeleteConfirmDisabled(...)` mit
  `deletionReason.trim().length < 10`. `isDeleteConfirmDisabled()` selbst (Task 2, bereits
  committet) wurde NICHT verändert — die Kombination erfolgt an der Aufrufstelle.
- **Files modified:** desktop/src/components/users/EditUserModal.tsx
- **Verification:** `cd server && npx vitest run` bestätigt die Serverregel
  (`workPeriodDeletionService.test.ts`, nicht Teil dieses Plans, aber gegengelesen); `cd desktop
  && npx tsc --noEmit` Exit 0
- **Committed in:** 84fb059 (Task 3 commit)

**2. [Rule 2 - Missing Critical] ConfirmDialog um `confirmAriaLabel` erweitert**
- **Found during:** Task 3, beim Verdrahten von `deleteConfirmAriaLabel()` (Task 2)
- **Issue:** 13-UI-SPEC.md, Abschnitt „Barrierefreiheit": „Die Löschbestätigung nennt im
  `aria-label` des Bestätigungsknopfes die Periode." `ConfirmDialog.tsx` (Plan 13-07, fünf
  additive Props) bot dafür keinen Andockpunkt — der Bestätigungsknopf trug ausschließlich den
  sichtbaren `confirmText` als zugänglichen Namen.
- **Fix:** Sechste additive, optionale Prop `confirmAriaLabel?: string` ergänzt, angewandt als
  `aria-label` auf den Bestätigungsknopf. Ungesetzt (alle Bestandsaufrufer inkl. der
  Korrekturbestätigung aus Plan 13-08) bleibt das Verhalten unverändert.
- **Files modified:** desktop/src/components/ui/ConfirmDialog.tsx
- **Verification:** `cd desktop && npx tsc --noEmit` Exit 0; `desktop/src/components/ui/confirmDialogProps.check.ts`
  weiterhin 3/3 grün (Regressionstest der fünf Plan-13-07-Props)
- **Committed in:** 84fb059 (Task 3 commit)

**3. [Rule 1 - Bug] `toISOString`-Literal im Kopfkommentar von `workTimePeriodDeleteRules.ts`**
- **Found during:** Task 2, beim ersten Grep-Nachweis des Akzeptanzkriteriums
  (`grep -c "toISOString" ... liefert 0`)
- **Issue:** Derselbe Fehler wie in 13-08-SUMMARY.md dokumentiert: der erklärende Kommentar zu
  `formatGermanDate()` enthielt die literale Zeichenkette `toISOString().split('T')[0]` als
  Negativbeispiel und ließ den eigenen Akzeptanz-Grep auf 1 statt 0 laufen.
- **Fix:** Kommentar auf eine Umschreibung ohne die literale Zeichenkette umformuliert.
- **Files modified:** desktop/src/components/worktime/workTimePeriodDeleteRules.ts
- **Verification:** `grep -c "toISOString" ...` → 0
- **Committed in:** 45ae5c4 (Task 2 commit)

### Sonstige Beobachtungen (kein Verhaltensunterschied)

**4. Randfälle in `workTimePeriodDeleteRules.ts` ergänzt, die das Textbuch nicht ausdrücklich nennt**
- `deleteConfirmMessage`: `validTo === null` (die zu löschende Periode ist selbst offen/aktuell)
  zeigt „bis offen" statt eines Datums — Muster aus `WorkTimePeriodEditModal.tsx`.
- `deleteDetailGapClosure`: `newValidTo === null` (die Vorperiode wird durch die Löschung selbst
  zur offenen Periode, weil die gelöschte Periode die letzte war) zeigt „gilt danach unbefristet
  weiter" statt „bis zum {Datum}".
  Beide Fälle sind technisch möglich (letzte Periode eines Nutzers wird gelöscht, hat aber eine
  Vorperiode) und im Textbuch nicht behandelt; ohne Fallback stünde „Invalid Date" in der
  Oberfläche.

**5. DD-38-Abweichung: Punkt 2 der `details`-Liste wartet auf die Server-Vorschau**
- DD-38 behauptet, Punkt 1 UND Punkt 2 stünden schon vor der Vorschau fest, weil sie „aus den
  Periodendaten selbst folgen". Für Punkt 1 (Lückenschluss) trifft das zu (D3:
  `newValidTo = deletionPeriod.validTo`, rein client-seitig). Für Punkt 2 (Storno-Betrag) trifft
  es NICHT zu: `WorkTimePeriod` (Desktop-Typ) trägt keine Referenz auf ihre `model_change`-
  Buchung(en); die Summe kommt ausschließlich aus `WorkPeriodDeletionPreview.reversedTransactions`.
  Punkt 2 ist deshalb an denselben loading/error/ready-Zyklus wie Punkt 3 gekoppelt.
- **Files modified:** desktop/src/components/users/EditUserModal.tsx (keine zusätzliche Datei —
  Teil des Task-3-Commits)

---

**Total deviations:** 3 auto-fixed (2× Rule 2 — Missing Critical, 1× Rule 1 — Bug), 2 dokumentierte
Beobachtungen ohne Codeänderung über die bereits gelisteten Dateien hinaus.
**Impact on plan:** Deviation 1 und 2 sind notwendig, damit die Löschfunktion tatsächlich
funktioniert (ohne Begründungsfeld: serverseitiger 400 bei jedem echten Löschversuch; ohne
`confirmAriaLabel`: ein von der 13-UI-SPEC geforderter Barrierefreiheits-Vertrag wäre unerfüllbar
gewesen). Deviation 3 ist eine reine Textkorrektur ohne Verhaltensänderung. Keine der Abweichungen
ändert die im Plan beschriebene öffentliche API der Task-2-Funktionen (`isDeleteConfirmDisabled`
blieb unverändert, die Kombination mit der Begründungslänge erfolgt am Aufrufort).

## Issues Encountered

Keine über die oben dokumentierten Deviations hinaus.

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten (`13-UI-SPEC.md`: „Neue Abhängigkeiten:
keine"), keine Migration.

## Known Stubs

Keine. Alle Datenpfade (Periodenliste, Korrektur-Vorschau, Lösch-Vorschau, Erfolgsbanner) sind an
echte Server-Endpunkte angebunden; keine hartcodierten Platzhalterwerte.

## Threat Flags

Keine neue Angriffsfläche über die im Plan-`<threat_model>` bereits benannten Punkte hinaus. Die
Pflichtbegründung fürs Löschen (Deviation 1) ist eine zusätzliche Eingabevalidierung, kein neuer
Endpunkt und keine neue Vertrauensgrenze — die Server-Route existierte bereits (Plan 13-05) und
verlangte die Begründung bereits vor diesem Plan.

## Next Phase Readiness

- REQ-30/REQ-31 sind aus Sicht der Oberfläche vollständig umgesetzt: Korrigieren und Löschen
  stehen im selben Bildschirm, nach sechs unabhängigen Merkmalen unterscheidbar (Ort, Rahmung,
  Buttonstil, Wortwahl, Dialog, Bestätigung), das Löschen bestätigt sich nur mit einer
  servergerechneten Zahl vor Augen.
- Die visuelle Prüfung (Tooltip-Verhalten, Responsive-Umbruch unter 640 px, Dunkelmodus-Kontrast
  der neuen Panels, tatsächliches Klickverhalten der drei Dialoge im laufenden Tauri-Fenster)
  geht laut Plan-Objective in die UAT-Sammlung für Phase 14/Plan 13-11 — hier nicht durchgeführt
  (kein Dev-Server verfügbar, Port 3000 belegt).
- `WorkTimePeriodActions.tsx` und `workTimePeriodDeleteRules.ts` sind eigenständig wiederverwendbar
  — keine Kopplung an `EditUserModal.tsx` über Props hinaus.
- Offene, im Plan bewusst zurückgestellte Punkte (unverändert aus 13-CONTEXT.md): kein
  Wiederherstellen einer gelöschten Periode.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle fünf geänderten/neu angelegten Dateien auf der Festplatte verifiziert vorhanden
(`workTimePeriodActions.tsx`, `workTimePeriodDeleteRules.ts`, `workTimePeriodDeleteRules.check.ts`,
`EditUserModal.tsx`, `ConfirmDialog.tsx`). Alle drei Commit-Hashes (`6163e23`, `45ae5c4`, `84fb059`)
in `git log --oneline --all` verifiziert. `cd desktop && npx tsc --noEmit` Exit 0.
`cd desktop && npx tsx src/components/worktime/workTimePeriodDeleteRules.check.ts` Exit 0
(14/14 Tests grün). Regressionstests weiterhin grün:
`workTimePeriodEditRules.check.ts` (16/16), `confirmDialogProps.check.ts` (3/3).
`cd server && npx vitest run` — 478 grün / 3 rot (Baseline aus 13-08-SUMMARY.md unverändert:
2× unifiedOvertimeService.test.ts, 1× vacationBackfillService.test.ts — keine neuen Fehlschläge).
