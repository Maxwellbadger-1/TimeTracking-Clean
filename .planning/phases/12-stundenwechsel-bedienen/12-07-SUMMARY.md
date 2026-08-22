---
phase: 12-stundenwechsel-bedienen
plan: 07
subsystem: ui
tags: [react, typescript, tanstack-query, tauri, desktop, sqlite]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 02
    provides: "Modal-Stack, Modal.tsx/ConfirmDialog.tsx mit zIndexClass, Portal-Rendering, Fokusfalle/-rueckgabe"
  - phase: 12-stundenwechsel-bedienen
    plan: 04
    provides: "Desktop-Vertragstypen, useWorkPeriods/usePreviewWorkTimeChange/useSaveWorkTimeChange, WorkTimePeriodList.tsx"
  - phase: 12-stundenwechsel-bedienen
    plan: 06
    provides: "WorkTimeChangeModal.tsx — der fertige Wechsel-Dialog (isOpen/onClose/user/onSaved)"
provides:
  - "Einstiegspunkt in den Stundenwechsel im EditUserModal (D1): schreibgeschuetzte Stundenfelder, Hinweispanel, Button 'Stundenwechsel ab Datum ...', Periodenblock, Erfolgsbanner + Toast"
  - "UserManagementPage haelt nur noch die editingUser-Id — Zustand 15 (Liste/Felder zeigen sofort den neuen Wert nach dem Speichern) ist dadurch erreichbar"
  - "model_change-Buchungen erscheinen im Ueberstunden-Kontoauszug (OvertimeTransactions.tsx) mit Badge 'Modellwechsel', Betrag, Trendpfeil und Periodenbezug (REQ-29)"
  - "calculateLiveOvertimeTransactions() liest jetzt zusaetzlich model_change-Zeilen aus overtime_transactions (vorher unerreichbar fuer die Live-Ansicht)"
affects: [13-korrigieren-und-rueckgaengig-machen, 14-absicherung-und-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Reset-Effekt auf [user.id] statt [user], plus schmaler Sync-Effekt mit Wertvergleich (JSON.stringify sortierter Schluessel) fuer die beiden schreibgeschuetzten Felder — noetig, weil `user` nach der UserManagementPage-Umstellung bei jedem Refetch ein neues Objekt ist"
    - "WorkTimeChangeModal wird als Geschwister NACH </form> gerendert, weiterhin innerhalb der Kinder von Modal — verhindert, dass ein Submit/Enter im verschachtelten Dialog handleSubmit des aeusseren Formulars erreicht (React-Baum, nicht DOM-Baum)"
    - "Live-Kontoauszug (overtimeLiveCalculationService.ts) ergaenzt um einen additiven Merge-Schritt, der overtime_transactions direkt fuer type='model_change' abfragt, statt (wie alle anderen Zeilen) aus Rohdaten neu zu rechnen"

key-files:
  created: []
  modified:
    - desktop/src/components/users/WorkScheduleEditor.tsx
    - desktop/src/pages/UserManagementPage.tsx
    - desktop/src/components/users/EditUserModal.tsx
    - desktop/src/components/worktime/OvertimeTransactions.tsx
    - desktop/src/hooks/useWorkTimeAccounts.ts
    - server/src/services/overtimeLiveCalculationService.ts

key-decisions:
  - "OvertimeTransactions.tsx haengt am /overtime/transactions/live-Endpunkt, der Transaktionen ON-DEMAND aus time_entries/absence_requests/overtime_corrections neu rechnet und overtime_transactions bisher NICHT las — eine model_change-Buchung waere ohne einen Merge dort nie sichtbar geworden, unabhaengig von den Case-Zweigen in getTypeLabel/-Description/-BadgeColor. Fix: additiver Merge-Schritt in overtimeLiveCalculationService.ts, der ausschliesslich type='model_change'-Zeilen aus overtime_transactions liest und anhaengt — keine Aenderung an der bestehenden Tagesberechnung oder an calculateCurrentOvertimeBalance() (getrennter Rechenweg, siehe 12-05-SUMMARY.md)."
  - "useWorkTimeAccounts.ts additiv um 'model_change'/'work_period'/createdAt/adminName erweitert, obwohl die Komponente die Transaktionen ohnehin als any behandelt (vorbestehende Altlast, hier nicht behoben) — reine Vertragskorrektheit, keine Verhaltensaenderung."
  - "Wochenstunden-Erfolgsbanner und Toast formatieren mit toLocaleString('de-DE', { maximumFractionDigits: 2 }) statt einer erzwungenen Nachkommastelle — konsistent mit WorkTimePeriodList.tsx (Plan 12-04)."

patterns-established: []

requirements-completed: [REQ-26, REQ-29]

# Metrics
duration: ~55min
completed: 2026-08-22
---

# Phase 12 Plan 07: Die Einbindung Summary

**Der Stundenwechsel ist im Stammdatendialog erreichbar (schreibgeschuetzte Stundenfelder mit Verweis, eigener Button, verschachtelter Dialog ausserhalb des `<form>`, Erfolgsbanner+Toast), und die entstehende `model_change`-Buchung ist im Ueberstunden-Kontoauszug sichtbar — dafuer musste zusaetzlich zur reinen Anzeigelogik der Live-Berechnungsdienst um einen additiven Lesezugriff auf `overtime_transactions` ergaenzt werden, sonst waere die Zeile nie angekommen.**

## Performance

- **Duration:** ~55 min
- **Tasks:** 3/3 completed
- **Files modified:** 6 (4 laut Plan + 2 zusaetzliche additive Dateien als dokumentierte Deviation)

## Accomplishments

- `WorkScheduleEditor.tsx` kennt eine `readOnly`-Prop (Default `false`): Toggle und Tagesfelder
  werden `disabled` mit lesbaren Kontrastklassen (kein `opacity`), das Tagesplan-Raster hat
  jetzt einen Breakpoint (`grid-cols-1 sm:grid-cols-2`).
- `UserManagementPage.tsx` haelt nur noch `editingUserId`; `editingUser` wird bei jedem Render
  aus der bestehenden Nutzerquery abgeleitet. Damit ist Zustand 15 (Liste/Feld zeigen sofort
  den neuen Wert nach einem Stundenwechsel) erreichbar. Neun `console.log` im Loeschpfad
  entfernt, `console.warn`/`console.error` bleiben.
- `EditUserModal.tsx`: Wochenstundenfeld ist `readOnly`/`aria-readonly` mit lesbaren
  Hover-Overrides (kein `disabled`, kein `tabIndex={-1}`), `WorkScheduleEditor` ist
  schreibgeschuetzt, ein Hinweispanel mit dem Button "Stundenwechsel ab Datum …" oeffnet
  `WorkTimeChangeModal` **ausserhalb** des `<form>` (T-12-38), der Periodenblock zeigt
  `WorkTimePeriodList`. Der Absende-Pfad sendet `weeklyHours`/`workSchedule` unveraendert aus
  `user` (T-12-34). Reset-Effekt auf `[user.id]`, schmaler Sync-Effekt mit Wertvergleich.
  Erfolgsbanner (8 s) + `toast.success` nach dem Speichern, Fokusrueckgabe auf den
  Einstiegs-Button. Fuenf `console.log` entfernt, `console.error` bleibt.
- `OvertimeTransactions.tsx`: neuer `case 'model_change'` in allen drei Zuordnungsfunktionen
  (Badge "Modellwechsel", Teal, Beschreibung, zweite Zeile "Periode ab … eingetragen am … von
  …"). **Zusaetzlich (Deviation, siehe unten):** `overtimeLiveCalculationService.ts` liest jetzt
  `model_change`-Zeilen aus `overtime_transactions` und mischt sie in die Live-Liste ein —
  ohne diesen Fix waere die Badge-Logik nie ausgefuehrt worden, weil der Live-Endpunkt
  `overtime_transactions` bisher gar nicht abfragte. Empirisch verifiziert (siehe Deviations).
- `npx tsc --noEmit` ist in `desktop/` und `server/` gruen; die zwoelf Bestandstests in
  `overtimeLiveCalculationService.test.ts` bleiben gruen (12/12).

## Task Commits

Each task was committed atomically:

1. **Task 1: WorkScheduleEditor readOnly-Prop und UserManagementPage auf die Id umstellen** - `bb70e8c` (feat)
2. **Task 2: EditUserModal — schreibgeschuetzte Felder, Einstiegs-Button, Periodenliste, Dialogsteuerung** - `ec76a03` (feat)
3. **Task 3: OvertimeTransactions — der Buchungstyp model_change im Kontoauszug (REQ-29)** - `7c09ac3` (feat, inkl. Deviation-Fix)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified

- `desktop/src/components/users/WorkScheduleEditor.tsx` - `readOnly`-Prop, Breakpoint im Tagesplan-Raster
- `desktop/src/pages/UserManagementPage.tsx` - `editingUserId` statt `editingUser`-Objekt, neun `console.log` entfernt
- `desktop/src/components/users/EditUserModal.tsx` - Einstiegspunkt in den Stundenwechsel, schreibgeschuetzte Felder, Periodenblock, Erfolgsbanner, fuenf `console.log` entfernt
- `desktop/src/components/worktime/OvertimeTransactions.tsx` - Anzeige des Buchungstyps `model_change`
- `desktop/src/hooks/useWorkTimeAccounts.ts` - Response-Typ additiv um `model_change`/`work_period`/`createdAt`/`adminName` erweitert (Deviation)
- `server/src/services/overtimeLiveCalculationService.ts` - Merge von `model_change`-Zeilen aus `overtime_transactions` in die Live-Transaktionsliste (Deviation)

## Gezaehlte Debugausgaben

- `EditUserModal.tsx`: 5 `console.log` entfernt (Absende-Pfad, Zeile 103-106 und 123 im
  Ausgangsstand). `console.error` (1) bleibt stehen.
- `UserManagementPage.tsx`: 9 `console.log` entfernt (Loeschpfad, Zeile 128-131, 139, 147, 148,
  152, 153 im Ausgangsstand). `console.warn` (1) und `console.error` (2) bleiben stehen.
- Zusammen mit Plan 12-02 (`ConfirmDialog.tsx`, 2 `console.log`) sind damit **genau 16**
  Debugausgaben aus dieser Phase entfernt — deckt sich mit der in `12-UI-SPEC.md`,
  "Debugausgaben — abschliessende Regelung" genannten Zahl.

## Case-Zweige in OvertimeTransactions.tsx (vor/nach)

`getTypeLabel`, `getTypeDescription` und `getTypeBadgeColor` hatten je **10** `case`-Zweige vor
dieser Aenderung (gemessen per `awk`-Ausschnitt der Funktion + `grep -c "case '"`), danach je
**11** — in allen drei Funktionen um genau einen gewachsen (`model_change`).

## Nicht angefasste Altlasten

- `EditUserModal.tsx` Zeile ~197/216/238/280 (Zaehlung vor dieser Aenderung; durch die neuen
  Einfuegungen leicht verschoben): starre `grid-cols-2`/`grid-cols-3` ohne Breakpoint —
  vorbestehend, ausdruecklich in `12-UI-SPEC.md` als "Beobachtete, hier nicht behobene Altlast"
  vermerkt, hier nicht angefasst (NO REGRESSION, kein Aufraeumfeldzug).
- `OvertimeTransactions.tsx`: `data.transactions.map((transaction: any, index: number) => ...)`
  — der vorbestehende `any`-Typ der Transaktionen bleibt unangetastet. Deshalb war die additive
  Typerweiterung in `useWorkTimeAccounts.ts` fuer die Kompilierung nicht zwingend erforderlich
  (die Komponente umgeht die Typpruefung ohnehin ueber `any`) — sie wurde trotzdem vorgenommen,
  weil sie den tatsaechlichen Serververtrag korrekt abbildet, ohne den `any`-Typ selbst
  anzufassen.
- `desktop/tests/user-edit.spec.ts`: die von `12-UI-SPEC.md` bereits benannte Anpassung dieses
  Tests (Umstellung auf den neuen Wechsel-Dialog, Reparatur des `aria-label`-Selektors) gehoert
  laut UI-SPEC-Aenderungstabelle D zum Testbestand dieser Phase, ist aber in `12-07-PLAN.md`
  weder als Task noch in `files_modified` genannt. Nicht angefasst — ausserhalb des in diesem
  Plan definierten Umfangs; als offener Punkt vermerkt (siehe "Next Phase Readiness").

## Decisions Made

Siehe `key-decisions` im Frontmatter. Zusaetzlich:
- Der Periodenblock steht im JSX vor den Feldern Eintritts-/Austrittsdatum (statt danach) —
  der Plan gibt nur "darunter, getrennt durch `pt-6 border-t`" vor, nicht die exakte Position
  relativ zu den unveraenderten Datumsfeldern. Diese Reihenfolge haelt den kompletten
  Stundenwechsel-Block (Hinweispanel + Periodenliste) zusammenhaengend direkt nach dem
  schreibgeschuetzten `WorkScheduleEditor`.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1/2 - Bug/Missing Critical] `model_change`-Buchungen waren im tatsaechlich
verwendeten Kontoauszug-Endpunkt unerreichbar**
- **Found during:** Task 3, vor dem Schreiben der Anzeigelogik (Zero-Hallucination-Pruefung
  der Datenkette `OvertimeTransactions.tsx` → `useOvertimeTransactions()` →
  `GET /api/overtime/transactions/live` → `calculateLiveOvertimeTransactions()`)
- **Issue:** `OvertimeTransactions.tsx` bezieht seine Daten ausschliesslich vom
  **Live-Berechnungsdienst** (`overtimeLiveCalculationService.ts`), der Transaktionen
  ON-DEMAND aus `time_entries`/`absence_requests`/`overtime_corrections` neu rechnet und dabei
  **niemals** die Tabelle `overtime_transactions` abfragt — genau dort legt
  `workPeriodChangeService.applyWorkTimeChange()` (Plan 12-01/12-03) die
  `model_change`-Buchung ab (D5, per Test in `12-05-SUMMARY.md` gegen `getOvertimeHistory()`
  bestaetigt, welche eine ANDERE, nicht-live Route liest). Ohne Aenderung an dieser Kette
  waeren die drei neuen `case`-Zweige in `getTypeLabel`/`getTypeDescription`/
  `getTypeBadgeColor` niemals ausgefuehrt worden — die Zeile haette nie existiert, unabhaengig
  von der Beschriftung. Das haette den Plan-Erfolgskriterium ("Eine `model_change`-Buchung
  erscheint im Kontoauszug …") und REQ-29 verfehlt, waere aber durch die grep-basierten
  Acceptance-Criteria von Task 3 (die nur den Text von `OvertimeTransactions.tsx` pruefen)
  NICHT aufgefallen — deshalb die zusaetzliche empirische Verifikation.
- **Fix:** `overtimeLiveCalculationService.ts` bekommt einen neuen, rein additiven
  Merge-Schritt (Abschnitt "6b"): eine `SELECT`-Abfrage gegen `overtime_transactions
  LEFT JOIN users` fuer `type = 'model_change'` im abgefragten Zeitraum, ergaenzt um
  `createdAt`/Admin-Name fuer die zweite Beschreibungszeile. Die bestehende Tagesberechnung
  (Schritte 1-5, 7-8) und `calculateCurrentOvertimeBalance()` (separater Rechenweg ueber
  `unifiedOvertimeService`) bleiben unveraendert — siehe `12-05-SUMMARY.md`,
  "Bestaetigung des Saldo-Lesepfads": das Loeschen einer einzelnen `model_change`-Zeile aendert
  den zurueckgegebenen Saldo dort nachweislich nicht, die Zeile ist reine Sichtbarkeit.
  `LiveOvertimeTransaction` additiv um `'model_change'`/`'work_period'`/`createdAt`/`adminName`
  erweitert; `typePriority`-Sortierung um `model_change: 4` ergaenzt.
  `desktop/src/hooks/useWorkTimeAccounts.ts` additiv um dieselben Werte im Response-Typ
  erweitert (fuer Vertragskorrektheit, ohne Verhaltensaenderung — die Komponente liest die
  Transaktionen ohnehin als `any`).
- **Files modified:** `server/src/services/overtimeLiveCalculationService.ts`,
  `desktop/src/hooks/useWorkTimeAccounts.ts`
- **Verification:** `cd server && npx tsc --noEmit` und `cd desktop && npx tsc --noEmit` beide
  gruen. `npx vitest run src/services/overtimeLiveCalculationService.test.ts` — 12/12 gruen
  (keine Regression an den bestehenden REQ-19/CR-01- und D7-Periodenwechsel-Tests, die alle
  gegen frische Testnutzer ohne `model_change`-Zeilen laufen). Zusaetzlich ein einmaliges,
  danach geloeschtes Verifikationsskript (`server/src/scripts/_tmp-verify-12-07.ts`, nicht
  committet): Testnutzer angelegt, echte `model_change`-Buchung ueber `createTransaction()`
  geschrieben, `calculateLiveOvertimeTransactions()` aufgerufen — die Zeile erschien mit
  korrektem Datum, korrekten Stunden, `source: 'work_period'`, `createdAt` gesetzt; danach
  vollstaendig aufgeraeumt (Nutzer, Buchung), `SELECT COUNT(*)`-Nachweis auf 0 nach dem
  Aufraeumen.
- **Committed in:** `7c09ac3` (Teil des Task-3-Commits — ohne diesen Fix waere Task 3 ein
  wirkungsloser Stub gewesen, siehe `<self_check>`/"Known Stubs"-Pflicht des Executors)

### Beobachtungen (kein Auto-Fix noetig)

**1. `editingUserId`-Zaehlkriterium trifft nicht literal zu**
- **Befund:** `grep -c "editingUserId" UserManagementPage.tsx` liefert 2 statt der im Plan
  geforderten "mindestens 4". Ursache: `setEditingUserId` (Grossbuchstabe `E`) matcht das
  klein geschriebene Suchmuster `editingUserId` nicht (case-sensitiv), ebenso wenig wie das
  abgeleitete `editingUser` (ohne `Id`-Suffix) an den drei Verwendungsstellen im JSX
  (`{editingUser && ...}`, `isOpen={!!editingUser}`, `user={editingUser}`).
- **Bewertung:** Fachlich vollstaendig erfuellt — sieben Fundstellen verwenden konsistent
  entweder `editingUserId`/`setEditingUserId` (State) oder `editingUser` (abgeleitet), belegt
  per `grep -n`. Derselbe Zaehlkonflikt-Charakter wie in `12-01-SUMMARY.md`
  (`work_period` vs. `user_work_periods`) und `12-05-SUMMARY.md` (`requireAdmin`-Importzeile).
  Kein Code geaendert.

**2. `useState<User | null>(null)`-Kriterium trifft nicht literal zu**
- **Befund:** `grep -c "useState<User | null>(null)" UserManagementPage.tsx` liefert 1 statt 0.
- **Bewertung:** Der verbleibende Treffer ist `resetPasswordUser` (`const [resetPasswordUser,
  setResetPasswordUser] = useState<User | null>(null);`) — ein voellig anderer, vom Plan nicht
  betroffener State fuer den Passwort-Reset-Dialog. Der Plan verlangt ausdruecklich nur die
  Umstellung von `editingUser`, nicht von `resetPasswordUser`. Kein Code geaendert.

---

**Total deviations:** 1 auto-fixed (Rule 1/2, blockierend fuer das eigentliche Plan-Ziel),
2 dokumentierte Zaehlkonflikte ohne Auto-Fix-Bedarf.
**Impact on plan:** Der Auto-Fix war notwendig, damit Task 3 sein im Plan selbst formuliertes
Ziel ("Eine `model_change`-Buchung erscheint im Kontoauszug …") tatsaechlich erreicht — ohne
ihn waere die neue Anzeigelogik ein wirkungsloser Stub gewesen. Kein Scope Creep: der Fix ist
rein additiv (neue Abfrage, keine Aenderung an bestehendem Verhalten), durch die vorhandene
Testsuite regressionsgepueft und empirisch nachgewiesen.

## Known Stubs

Keine. Die zusaetzliche Server-Anbindung (siehe Deviations) stellt sicher, dass die
`model_change`-Anzeige tatsaechlich Daten zeigt, statt eine unerreichbare Fallunterscheidung
zu sein.

## Threat Flags

Keine neue, im `<threat_model>` dieses Plans nicht bereits erfasste Angriffsflaeche. Der neue
Merge-Schritt in `overtimeLiveCalculationService.ts` ist ein reiner Lesezugriff (kein
`dangerouslySetInnerHTML`, `db.prepare` mit Platzhaltern) auf Daten, die serverseitig bereits
denselben Rollenpruefungen unterliegen wie der Rest des `/transactions/live`-Endpunkts
(`requireAuth`, Admin-vs-Eigenzugriff in der Route, unveraendert).

## Issues Encountered

- Die Zero-Hallucination-Pruefung der Datenkette fuer Task 3 (siehe Deviation oben) hat deutlich
  mehr Code-Lesearbeit gekostet als die im Plan genannten `<read_first>`-Dateien vorsahen — die
  Diskrepanz zwischen "Live-Berechnung" und "Ledger-Tabelle" ist an keiner Stelle von
  `12-PATTERNS.md`/`12-UI-SPEC.md` explizit benannt. Ohne die Pruefung waere Task 3 zwar nach
  allen grep-Kriterien "gruen" gewesen, htte aber sein fachliches Ziel verfehlt.

## User Setup Required

None - keine externe Service-Konfiguration erforderlich.

## Next Phase Readiness

- D1 ist vollstaendig umgesetzt: der Stundenwechsel ist eine eigene, klar erreichbare Aktion
  im `EditUserModal`, die Stammdatenfelder sind schreibgeschuetzt mit Verweis.
- REQ-29 ist nicht nur beschriftet, sondern tatsaechlich sichtbar — belegt durch das
  Empirie-Skript (siehe Deviations).
- Phase 13 (Bearbeiten/Loeschen von Perioden, "Stammdaten korrigieren") kann auf den
  `renderActions`-Schnitt von `WorkTimePeriodList` und die `readOnly`-Prop von
  `WorkScheduleEditor` aufsetzen — beide sind unveraendert aus Plan 12-02/12-04 uebernommen.
- **Offener Punkt fuer Phase 13/14:** `desktop/tests/user-edit.spec.ts` ist noch nicht auf den
  neuen Wechsel-Dialog umgestellt (der Test `[name="weeklyHours"]` schlaegt gegen das jetzt
  schreibgeschuetzte Feld fehl). `12-UI-SPEC.md`, Aenderungstabelle D, beschreibt die noetige
  Anpassung bereits vollstaendig; sie war weder in `12-07-PLAN.md` als Task noch in dessen
  `files_modified` aufgefuehrt und wurde daher in diesem Plan nicht ausgefuehrt.

## UAT-Punkte für Phase 14

1. **Kontrast des schreibgeschuetzten Wochenstundenfelds im hellen und dunklen Modus:**
   mindestens 4,5:1, Wert klar lesbar (kein `opacity`, `readOnly` statt `disabled`). Zu pruefen
   im `EditUserModal` gegen einen echten Nutzer.
2. **Vollstaendiger Bedienfluss im Desktop:** Nutzer bearbeiten → "Stundenwechsel ab Datum …"
   → Dialog oeffnet ueber dem Stammdatendialog (Modal-Stack aus Plan 12-02) → Stichtag,
   Wochenstunden, Tagesplan, Begruendung eintragen → Vorschau lesen → Speichern → Erfolgsbanner
   (8 s, gruen, im Abschnitt Arbeitszeit) und Toast erscheinen → Periodenliste **und** das
   schreibgeschuetzte Wochenstundenfeld zeigen sofort den neuen Wert (Zustand 15).
3. **Kontoauszug desselben Nutzers:** die Zeile "Modellwechsel" (Teal-Badge) steht mit Betrag,
   Vorzeichen, Trendpfeil, unveraenderter Begruendung und der zweiten Zeile "Periode ab … ·
   eingetragen am … von {Admin}" im Auszug — inklusive echtem Admin-Namen (im Empirie-Skript
   war `createdBy: null` gesetzt, der reale Speicherpfad traegt die Admin-Session-Id ein).
4. **Bestehende Bedienwege der Nutzerverwaltung** (Anlegen, Loeschen, Deaktivieren,
   Passwort-Reset) verhalten sich unveraendert zu v1.8.0 — insbesondere der jetzt von
   `editingUser` getrennte `resetPasswordUser`-Dialog.
5. **`desktop/tests/user-edit.spec.ts`** muss vor einem Release auf den neuen Wechsel-Dialog
   umgestellt werden (siehe "Next Phase Readiness") — der Test schlaegt aktuell am
   schreibgeschuetzten Feld fehl.
6. **Verschachtelter Dialog bei einem rueckwirkenden Stichtag:** `ConfirmDialog
   variant="warning" zIndexClass="z-[70]"` liegt sichtbar ueber dem Wechsel-Dialog, der wiederum
   ueber dem `EditUserModal` liegt (drei Ebenen, aus Plan 12-02/12-06 uebernommen, hier zum
   ersten Mal im realen Einbettungskontext sichtbar).

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Alle sechs geaenderten Dateien (`WorkScheduleEditor.tsx`, `UserManagementPage.tsx`,
`EditUserModal.tsx`, `OvertimeTransactions.tsx`, `useWorkTimeAccounts.ts`,
`overtimeLiveCalculationService.ts`) verifiziert vorhanden. Alle drei Task-Commits (`bb70e8c`,
`ec76a03`, `7c09ac3`) in `git log --oneline --all` nachgewiesen. `npx tsc --noEmit` ist sowohl
in `desktop/` als auch in `server/` sauber (Exitcode 0, keine Ausgabe). Der Bestandstest
`overtimeLiveCalculationService.test.ts` laeuft mit 12/12 gruen. Das temporaere
Verifikationsskript fuer den `model_change`-Merge wurde nach erfolgreichem Lauf geloescht
(nicht Teil der Deliverables).
