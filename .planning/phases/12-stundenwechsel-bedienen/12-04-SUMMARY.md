---
phase: 12-stundenwechsel-bedienen
plan: 04
subsystem: ui
tags: [react, typescript, tanstack-query, tauri, desktop]

# Dependency graph
requires:
  - phase: 12-stundenwechsel-bedienen
    plan: 01
    provides: "Serververtrag (WorkTimeChangeInput/Preview/PreviewResponse), GET /api/work-periods mit Rollenpruefung (D6)"
provides:
  - "Desktop-Vertragstypen WorkTimePeriod, WorkTimeChangeInput, WorkTimeChangePreview, WorkTimeChangePreviewResponse, WorkTimeChangeResult (desktop/src/types/index.ts)"
  - "useWorkPeriods, usePreviewWorkTimeChange, useSaveWorkTimeChange (desktop/src/hooks/useWorkTimeChange.ts) — ausschliesslich ueber apiClient, keine eigene Rechnung im Client (D2)"
  - "WorkTimePeriodList.tsx — Periodenliste mit Lade-, Fehler- und Leerzustand, renderActions-Schnitt fuer Phase 13"
affects: [12-05, 12-06, 12-08]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Hook-Schicht kopiert das useQuery/useMutation-Muster aus useVacationBalanceAdmin.ts/useOvertimeCorrections.ts, bewusst OHNE optimistisches Update (der Speichern-Button haengt ohnehin am previewToken)"
    - "invalidateUserAffectedQueries (bestehender Helper) deckt 'users' und die Ueberstunden-Queries in einem Aufruf ab; nur der work-periods-Schluessel wird separat invalidiert"
    - "formatDateLocal (lokale Kopie aus useTimeEntries.ts:80-81) statt toISOString().split('T')[0] fuer den zeitzonensicheren Vergleich 'heute' gegen validFrom/validTo"

key-files:
  created:
    - desktop/src/hooks/useWorkTimeChange.ts
    - desktop/src/components/worktime/WorkTimePeriodList.tsx
  modified:
    - desktop/src/types/index.ts

key-decisions:
  - "Wochenstunden- und Tagesplan-Werte werden mit toLocaleString('de-DE') formatiert statt einer fest erzwungenen Nachkommastelle — konsistent mit dem Bestand (WorkScheduleEditor.tsx zeigt Ganzzahlen ohne Nachkommastelle)"
  - "useSaveWorkTimeChange invalidiert den work-periods-Schluessel manuell und ruft zusaetzlich den bestehenden invalidateUserAffectedQueries-Helper (deckt 'users' und alle Ueberstunden-Query-Gruppen ab) statt einzelne Ueberstunden-Schluessel von Hand aufzuzaehlen"

patterns-established:
  - "WorkTimePeriodList ist reine Anzeige ohne Card-Wrapper, fuer die Einbettung in Modale (Plan 12-06 EditUserModal/WorkTimeChangeModal)"

requirements-completed: [REQ-26, REQ-27]

# Metrics
duration: ~35min
completed: 2026-08-22
---

# Phase 12 Plan 04: Datenschicht Desktop — Typen, Hooks, Periodenliste Summary

**Desktop-Vertragstypen als zeichengleiche Spiegelung des Serververtrags, drei Query/Mutation-Hooks ausschließlich über `apiClient` (keine Zwischenrechnung im Client, D2), und `WorkTimePeriodList.tsx` als reine, wiederverwendbare Anzeigekomponente mit `renderActions`-Schnitt für Phase 13.**

## Performance

- **Duration:** ~35 min
- **Tasks:** 2/2 completed
- **Files modified:** 3 (2 neu, 1 geändert)

## Accomplishments
- `desktop/src/types/index.ts` trägt jetzt `WorkTimePeriod`, `WorkTimeChangeInput`, `WorkTimeChangePreview`, `WorkTimeChangePreviewResponse` und `WorkTimeChangeResult` — Feldnamen und Typen zeichengleich zu `server/src/types/index.ts` (Zeile für Zeile verglichen)
- `useWorkPeriods`, `usePreviewWorkTimeChange`, `useSaveWorkTimeChange` in `desktop/src/hooks/useWorkTimeChange.ts` — alle drei laufen ausschließlich über `apiClient` (belegt: `grep -cE "\bfetch\("` = 0), rechnen nichts selbst (D2) und invalidieren nach dem Speichern `work-periods`, `users` und alle Überstunden-Query-Gruppen
- `WorkTimePeriodList.tsx` zeigt vier Spalten (Gültig ab, Gültig bis, Wochenstunden, Tagesplan), sortiert absteigend nach `validFrom`, kennt Lade-, Fehler- (mit „Perioden erneut laden") und Leerzustand, hebt bei Bedarf eine Zeile hervor (`highlightPeriodId`) und blockiert das Speichern nie
- Alle im Plan definierten Acceptance-Criteria (grep-basiert) und `npx tsc --noEmit` sind grün — siehe Self-Check

## Task Commits

Each task was committed atomically:

1. **Task 1: Vertragstypen und Hook-Schicht für den Stundenwechsel** - `9e8708c` (feat)
2. **Task 2: WorkTimePeriodList.tsx — die Periodenliste als reine Anzeige** - `5304c62` (feat)

**Plan metadata:** (folgt mit diesem Commit — docs: complete plan)

## Files Created/Modified
- `desktop/src/types/index.ts` - fünf neue exportierte Typen (Stundenwechsel-Vertrag), zeichengleich zum Server
- `desktop/src/hooks/useWorkTimeChange.ts` - `useWorkPeriods` (Query), `usePreviewWorkTimeChange`/`useSaveWorkTimeChange` (Mutations), alle über `apiClient`
- `desktop/src/components/worktime/WorkTimePeriodList.tsx` - Tabellarische Periodenliste, keine `Card`, `renderActions`-Prop für Phase 13

## Decisions Made
- Kein optimistisches Update in `useSaveWorkTimeChange` — der Speichern-Button hängt ohnehin an einem gültigen `previewToken` (D2); ein optimistisches Update nähme den vom Server erst zu bestätigenden Saldo vorweg. Wortgleiche Begründung wie in `12-PATTERNS.md` Abschnitt 12 vorgegeben.
- Stundenwerte (Wochenstunden, Tagesplan) werden mit `toLocaleString('de-DE')` ohne erzwungene Nachkommastelle formatiert — passt zum Bestandsmuster in `WorkScheduleEditor.tsx`, das Ganzzahlen ebenfalls ohne `,0` zeigt.
- `useSaveWorkTimeChange` ruft den bestehenden Helper `invalidateUserAffectedQueries` (deckt `users`- und alle Überstunden-Query-Gruppen in einem Aufruf ab) statt einzelne Überstunden-Schlüssel von Hand aufzuzählen — weniger Drift-Risiko gegenüber künftigen neuen Überstunden-Queries.
- `formatDateLocal` wird lokal in `WorkTimePeriodList.tsx` repliziert (Muster aus `useTimeEntries.ts:80-81`) statt `toISOString().split('T')[0]` — Pflicht aus `.claude/CLAUDE.md` (Timezone-Bug-Vermeidung).

## Deviations from Plan

None - plan executed exactly as written. Alle grep-basierten Acceptance-Criteria beider Tasks wurden vor dem jeweiligen Commit gemessen und exakt erfüllt (siehe Self-Check).

## Issues Encountered

**Live-UI-Verifikation (Plan-Abschnitt `<verification>`, Punkte 3 und 4) nicht in dieser Form durchführbar.** Diese Komponenten sind in Plan 12-04 bewusst noch nicht in eine Seite oder ein Modal eingebettet (das objective des Plans nennt ausdrücklich, dass erst Plan 12-06 den Wechsel-Dialog und die Einbindung in `EditUserModal.tsx` liefert). Ein visueller Nachweis der Badges „Aktuell"/„Geplant" und des Fehler-/Wiederholzustands gegen den laufenden Dev-Server erfordert einen sichtbaren Einbettungsort, den es in diesem Plan noch nicht gibt. Statt eines künstlichen, sonst nirgends verwendeten Test-Mounts wurde die Komponente gegen die vom Server tatsächlich gelieferte Datenform geprüft:
- Feldabgleich `UserWorkPeriod` (`server/src/types/index.ts:272-286`) gegen `WorkTimePeriod` (`desktop/src/types/index.ts`) Zeile für Zeile — identisch.
- `GET /api/work-periods` wurde bereits in Plan 12-01 mit drei echten HTTP-Aufrufen gegen den lokalen Dev-Server verifiziert (siehe `12-01-SUMMARY.md`, inkl. 403 bei fremdem Zugriff) — diese Route wird von `useWorkPeriods` unverändert konsumiert, keine erneute Serveränderung in diesem Plan.
- `npx tsc --noEmit` bestätigt, dass `WorkTimePeriodList` korrekt gegen die von `useWorkPeriods` gelieferten Typen kompiliert (kein struktureller Mismatch).

Die tatsächliche visuelle/interaktive Prüfung (Badges, Hover, Fehler-Retry-Klick) wird nachgeholt, sobald Plan 12-06 die Komponente in `EditUserModal.tsx` einbindet — dokumentiert unten unter „UAT-Punkte für Phase 14".

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Plan 12-05 (Server-Schreibrouten `POST .../preview`, `POST .../change`) kann sich auf die hier festgelegten Antwortformen (`WorkTimeChangePreviewResponse`, `WorkTimeChangeResult`) verlassen — Desktop-Seite ist bereits fertig verdrahtet und wartet lediglich auf die Endpunkte.
- Plan 12-06 (Wechsel-Dialog, `EditUserModal.tsx`-Einbindung) kann `useWorkPeriods`, `usePreviewWorkTimeChange`, `useSaveWorkTimeChange` und `WorkTimePeriodList` direkt importieren — keine weitere Datenschicht-Arbeit nötig.
- Plan 12-08 (WR-12-Nachzug) hat jetzt die in `11-DESKTOP-DISPOSITION.md` als fehlend benannte Lese-Fähigkeit über `useWorkPeriods`.
- Kein Blocker für die nächste Welle.

## UAT-Punkte für Phase 14

1. **Periodenliste im hellen und im dunklen Modus:** Kontrast der Badges („Aktuell"/„Geplant", `bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300`) und der Tabellentexte augenscheinlich mindestens so gut wie im bestehenden Kontoauszug (`OvertimeTransactions.tsx`). Zu prüfen, sobald die Liste über Plan 12-06 in `EditUserModal.tsx` sichtbar ist.
2. **Schmal gezogenes Fenster (unter 640 px):** Die Liste ist horizontal scrollbar (`overflow-x-auto`), es wird kein Inhalt abgeschnitten. Zu prüfen im selben Einbettungskontext wie Punkt 1.
3. **Ein Nutzer mit mehreren Perioden:** Die jüngste Umstellung steht oben (Sortierung `validFrom` absteigend, code-seitig verifiziert), die heute gültige trägt „Aktuell", eine künftige trägt „Geplant". Visuelle Bestätigung gegen echte Mehrperioden-Daten steht aus, weil diese erst über den in Plan 12-06/12-08 gebauten Wechsel-Dialog entstehen.
4. **Fehler-/Wiederholzustand der Periodenliste bei gestopptem Server:** `AlertCircle` + „Perioden konnten nicht geladen werden: {Meldung}" erscheint, „Perioden erneut laden" löst nach Serverneustart ein erfolgreiches Nachladen aus. Logik ist über `retry: false` und `refetch()` aus `useWorkPeriods` code-seitig korrekt verdrahtet; interaktiver Klick-Test steht aus, bis die Komponente sichtbar eingebettet ist.

---
*Phase: 12-stundenwechsel-bedienen*
*Completed: 2026-08-22*

## Self-Check: PASSED

Beide Dateien existieren und beide Task-Commits (`9e8708c`, `5304c62`) sind in `git log --oneline` nachweisbar. Alle grep-basierten Acceptance-Criteria beider Tasks wurden vor dem jeweiligen Commit gemessen (siehe oben, exakte Übereinstimmung mit den Plan-Vorgaben). `npx tsc --noEmit` läuft ohne Ausgabe (Exitcode 0) in `desktop/`.
