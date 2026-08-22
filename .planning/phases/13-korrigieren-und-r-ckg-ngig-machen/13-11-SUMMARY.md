---
phase: 13-korrigieren-und-r-ckg-ngig-machen
plan: 11
subsystem: docs
tags: [gates, verification, uat, phase-closeout]

# Dependency graph
requires:
  - phase: 13-korrigieren-und-r-ckg-ngig-machen (Plan 01-10)
    provides: "Alle zehn Pläne dieser Phase — Datenmodell, Korrektur-/Löschdienste, Endpunkte, Kontoauszug-Lesepfad, Desktop-Dialoge, Storno-Sichtbarkeit"
provides:
  - "Gate-Protokoll (tsc Server/Desktop, vitest, vier npx-tsx-Prüfskripte) mit gemessenen, nicht behaupteten Zahlen"
  - "Entscheidungsabgleich D1-D7 mit konkreter Fundstelle im fertigen Code"
  - "ROADMAP-Erfolgskriterien-Abgleich (vier Kriterien, je mit belegendem Testnamen)"
  - "Phase-13-UAT-Sammlung (13-U1..13-U13, 13-F1..13-F10) in .planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md"
affects: [14-absicherung-und-auslieferung]

# Tech tracking
tech-stack:
  added: []
  patterns: []

key-files:
  created: []
  modified:
    - .planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md

key-decisions:
  - "Task 1 verändert keine Quelldateien (laut Plantext ausdrücklich vorgesehen) — die gesamte Task-1-Arbeit ist Messung und Protokollierung in dieser SUMMARY, kein eigener Commit"
  - "13 statt der geforderten mindestens 11 UAT-Hauptpunkte aufgenommen — die beiden zusätzlichen (13-U12 Login-Rauchtest nach api/client.ts-Bereinigung, 13-U13 confirmAriaLabel-Screenreader-Prüfung) stammen aus explizit in 13-10-SUMMARY.md bzw. 13-09-SUMMARY.md vermerkten UAT-Kandidaten, die sonst verloren gegangen wären"
  - "10 statt der geforderten mindestens 7 Festlegungen aufgenommen — drei zusätzliche (13-F8 Pflichtbegründung fürs Löschen, 13-F9 unbedingtes checkPeriodChain(), 13-F10 reversedAt-Formatierung) sind dokumentierte Ermessensentscheidungen aus 13-09/13-03/13-10, die der Plantext nicht wörtlich vorgab, aber ausdrücklich 'ergänze jede weitere Festlegung' verlangte"

requirements-completed: [REQ-30, REQ-31]

# Metrics
duration: ~70min
completed: 2026-08-22
---

# Phase 13 Plan 11: Gates, Entscheidungsabgleich, UAT-Sammlung Summary

**Alle drei Pflicht-Gates gemessen und grün (tsc Server/Desktop Exit 0, vitest 478/481 mit exakt den drei vorbestehenden Fehlschlägen aus 11-AUSGANGSZUSTAND.md, vier Desktop-Prüfskripte 50/50), alle sieben D1-D7-Entscheidungen mit Fundstelle im fertigen Code belegt, und 13 UAT-Punkte plus 10 Festlegungen aus den zehn Phase-13-Plänen zu einer nummerierten Liste in 14-UAT-SAMMLUNG.md zusammengezogen — die Abschnitte Phase 11 und Phase 12 bleiben dabei zeichengleich unangetastet.**

## Performance

- **Duration:** ~70 min
- **Tasks:** 2/2 completed
- **Files modified:** 1

## Accomplishments

### Task 1: Pflicht-Gates und Entscheidungsabgleich

**Gate 1 — `cd server && npx tsc --noEmit`:** Exit 0. Keine Ausgabe, keine Fehler.

**Gate 2 — `cd desktop && npx tsc --noEmit`:** Exit 0. Keine Ausgabe, keine Fehler.

**Gate 3 — `cd server && npx vitest run`:**
```
Test Files  2 failed | 33 passed (35)
     Tests  3 failed | 478 passed (481)
```
Genau 3 rote Tests, keine Vergrößerung gegenüber der Baseline (letzter gemessener Stand aus 13-10-SUMMARY.md: 478/3, unverändert). Namentlicher Abgleich gegen `11-AUSGANGSZUSTAND.md` (Titel 1-3, dort als "die tatsächlich vorbestehenden Tests" benannt):

| # | Titel (gemessen) | Titel (11-AUSGANGSZUSTAND.md) | Übereinstimmung |
|---|---|---|---|
| 1 | `unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > should respect hire date and not include pre-employment months` — `AssertionError: expected 40 to be 10` | identisch (Titel 1) | ✅ wortgleich |
| 2 | `unifiedOvertimeService.test.ts > UnifiedOvertimeService > REGRESSION TESTS: Corrections and Hire Date (User 6 & 7 Bug) > REGRESSION: User hired on 1st of month should calculate correctly` — `AssertionError: expected 40 to be 10` | identisch (Titel 2) | ✅ wortgleich |
| 3 | `vacationBackfillService.test.ts > vacationBackfillService > erkennt einen bereits gelaufenen Backfill` — `AssertionError: expected true to be false` | identisch (Titel 3) | ✅ wortgleich |

Kein vierter oder abweichender roter Test. **Keine Regression.** Die von 11-AUSGANGSZUSTAND.md dokumentierten Titel 4-8 (Momentaufnahme-Artefakt aus der parallelen Ausführung von Plan 11-02, `resolveWorkPeriodIn`) sind seit Phase 11 nicht mehr vorhanden — erwartungsgemäß, da 11-02 seine GREEN-Phase längst committet hat.

Phasen-Verlauf der grünen/roten Zahl (aus den zehn SUMMARY-Dateien, informativ): 13-01: 427/3 → 13-02: 435/3 → 13-03: 448/3 → 13-04: 455/3 → 13-05: 478/3 → 13-06 bis 13-10: unverändert 478/3. Kein Plan dieser Phase hat die rote Menge vergrößert.

**Vier `npx tsx`-Prüfskripte des Desktops** (per `find src -name "*.check.ts"` vollständig ermittelt — genau diese vier existieren, keine weiteren):

| Datei | Ergebnis | Tests |
|---|---|---|
| `desktop/src/components/ui/confirmDialogProps.check.ts` | Exit 0 | 3/3 grün |
| `desktop/src/components/worktime/workTimePeriodEditRules.check.ts` | Exit 0 | 16/16 grün |
| `desktop/src/components/worktime/workTimePeriodDeleteRules.check.ts` | Exit 0 | 14/14 grün |
| `desktop/src/components/worktime/overtimeTransactionFormat.check.ts` | Exit 0 | 17/17 grün |

Summe: 50/50 grün, 0 rot.

**Der nicht verhandelbare Doppelzählungs-Test** (13-04-PLAN.md, "Zusicherung A/B/C/D"): `server/src/services/workPeriodDeletionService.test.ts`, Test "Zusicherung A/B/C/D — Umstellung eintragen, loeschen: der TATSAECHLICH BERECHNETE Saldo ist danach auf die Minute genau wieder der Stand von vorher" — **existiert unverändert und besteht** (`npx vitest run src/services/workPeriodDeletionService.test.ts` → 7/7 grün, einzeln nachgewiesen). Er prüft `Math.abs(getOvertimeBalance(userId) - saldoVorher) < 0.017` gegen den tatsächlich berechneten Saldo, nicht gegen die Journalsumme — genau wie der `model_change`-Nullwirkungs-Vertrag (`hours: 0` + `documentedDelta`) es verlangt.

### Entscheidungsabgleich D1 bis D7

| # | Entscheidung | Fundstelle im fertigen Code |
|---|---|---|
| D1 | Zwei getrennte Aktionen, kein `mode`-Parameter | `server/src/services/workPeriodCorrectionService.ts:250` (`correctWorkPeriod()`, Kopfkommentar Zeile 7: "KEIN gemeinsamer Dienst mit einem `mode`-Parameter") vs. `server/src/services/workPeriodDeletionService.ts` (`deleteWorkPeriod()`) vs. `workTimeChangeService.applyWorkTimeChange()` (Phase 12) — je eigene Datei, eigene Fehlerklasse, eigener Routenpfad (`server/src/routes/workPeriods.ts:281` `POST /:id/correct/preview`, `:430` `POST /:id/delete/preview`, `:336`/`:583` Phase-12-Pfade) |
| D2 | Soft-Delete plus Storno statt `DELETE` | `server/src/services/workPeriodService.ts:652` (`export function softDeleteWorkPeriod(periodId, deletedBy)`, setzt `deletedAt`/`deletedBy`), aufgerufen aus `workPeriodDeletionService.ts:253`; die Gegenbuchungen entstehen im selben Dienst über `createTransaction({ reversalOf: ... })` |
| D3 | Vorperiode schließt die Lücke; erste Periode nicht löschbar | `server/src/services/workPeriodDeletionService.ts:254` (`extendWorkPeriodTo(previousPeriod.id, period.validTo)`), Sperre der ersten Periode: Zeilen 137-140 (`validateDeletionInput`, Parameter `isFirst`), Bestimmung `isFirst = periodIndex === 0` in Zeile 191 |
| D4 | Neuberechnung ab `validFrom` der betroffenen Periode, nicht ab Kontobeginn | `workPeriodDeletionService.ts:207` (`monthsInRange(rebuildFrom, rangeEnd)`) + `:227`/`:275` (`rebuildOvertimeTransactionsForMonth`); analog `workPeriodCorrectionService.ts:293` (`monthsInRange(rangeStart, rangeEnd)`) + `:313`/`:365` |
| D5 | Rollenprüfung serverseitig auf allen Perioden-Endpunkten | `server/src/routes/workPeriods.ts`: `requireAdmin` auf allen sechs Schreib-/Vorschau-Routen (Zeilen 287, 339, 434, 496, 587, 634), `requireAuth` + interner `isAdmin`-Vergleich auf `GET /` (Zeile 230-235, Kopfkommentar Zeile 227: "Eine fremde userId beantwortet der Server mit 403"); HTTP-Nachweis über echten `fetch` in `server/src/routes/workPeriods.authorization.test.ts` (13 Testfälle) |
| D6 | Bearbeiten/Löschen in einer Transaktion | `workPeriodCorrectionService.ts:254` (`const run = db.transaction((): WorkPeriodCorrectionOutcome => {...})`), `workPeriodDeletionService.ts:176` (`const run = db.transaction((): WorkPeriodDeletionOutcome => {...})`) |
| D7 | Pflichtbegründung im Service, nicht nur Route/Formular | `workPeriodCorrectionService.ts:225-234` (`if (!input.reason \|\| input.reason.trim().length === 0) throw new WorkPeriodCorrectionValidationError('Begründung ist erforderlich')`, Mindestlänge 10 Zeichen); analog in `workPeriodDeletionService.ts` (`validateDeletionInput`); zusätzlich im Desktop clientseitig gespiegelt (`workTimePeriodEditRules.ts`/`workTimePeriodDeleteRules.ts`), aber die Durchsetzung liegt im Service |

Alle sieben Entscheidungen sind belegt. Kein Befund (keine fehlende Fundstelle).

### Abgleich gegen die vier ROADMAP-Erfolgskriterien dieser Phase

| # | Erfolgskriterium | Belegender Test/Prüfung |
|---|---|---|
| 1 | Umstellung löschen, Überstunden entsprechen exakt dem Stand davor | `server/src/services/workPeriodDeletionService.test.ts` — "Zusicherung A/B/C/D — Umstellung eintragen, loeschen: der TATSAECHLICH BERECHNETE Saldo ist danach auf die Minute genau wieder der Stand von vorher" (7/7 grün, siehe oben) |
| 2 | Nach dem Löschen zeigt der Auszug Buchung und Storno | `server/src/services/overtimeLiveCalculationService.test.ts:423` — "liefert beide Zeilen des Storno-Paars vollstaendig, mit gemeinsamer Belegnummer, unveraenderter Anzeigesumme und stabiler Nachbarschaft" |
| 3 | Die Korrektur-Aktion ohne Begründung wird abgewiesen | `server/src/services/workPeriodCorrectionService.test.ts:161` — "D7: leere oder zu kurze Begruendung wird im Service abgewiesen, ohne etwas zu schreiben" |
| 4 | Ein Mitarbeiter kann die Perioden eines anderen weder sehen noch über die API abrufen | `server/src/routes/workPeriods.authorization.test.ts` — `describe('workPeriods routes (HTTP-Autorisierung, D5)')`, insbesondere Zeile 142 "GET /api/work-periods?userId=<fremd> mit Mitarbeiter-Sitzung: 403, kein data im Antwortkörper" sowie die vier analogen 403-Tests für die neuen Schreib-/Vorschau-Endpunkte |

Alle vier Erfolgskriterien sind mit einem konkreten, tatsächlich bestehenden Test belegt.

### Task 2: UAT-Sammlung für Phase 13 ergänzt

`.planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md` unter `## Phase 13 —
Korrigieren und rückgängig machen`: Platzhalterzeile ersetzt durch eine Einleitung, eine
Haupttabelle mit **13 Prüfpunkten** (13-U1 bis 13-U13, mehr als die geforderten mindestens
11), eine Tabelle „Fachliche Festlegungen" mit **10 Festlegungen** (13-F1 bis 13-F10, mehr
als die geforderten mindestens 7) und einen Abschnitt „Nachrichtlich: Umgebungsbefunde" mit
4 Punkten.

Zwei UAT-Punkte und drei Festlegungen gehen über die im Plantext wörtlich vorgegebenen
Mindestpunkte hinaus — sie stammen aus ausdrücklich in den SUMMARY-Dateien vermerkten
UAT-Kandidaten, die laut Plan-Auftrag ("Ergänze jeden weiteren...") nicht verloren gehen
durften:
- **13-U12** (Login-/Ladetest gegen echten Server nach der `api/client.ts`-Bereinigung) —
  aus 13-10-SUMMARY.md, „Issues Encountered": „Als UAT-Punkt fuer Plan 13-11 vermerkt".
- **13-U13** (Screenreader-Prüfung des `confirmAriaLabel`) — aus 13-09-SUMMARY.md, der
  neuen additiven Barrierefreiheits-Prop.
- **13-F8/13-F9/13-F10** — dokumentierte Ermessensentscheidungen aus 13-09 (Pflichtbegründung
  fürs Löschen), 13-03 (unbedingtes `checkPeriodChain()`) und 13-10 (`reversedAt`-Formatierung
  zur Timezone-Bug-Vermeidung).

**Verifikation der Unversehrtheit von Phase 11 und Phase 12 (Pflichtkriterium T-13-50):**

```
$ grep -c "13-U1" 14-UAT-SAMMLUNG.md          → 6   (13-U1, 13-U10..13-U13 enthalten "13-U1" als Teilstring)
$ grep -co "11-U[0-9]" 14-UAT-SAMMLUNG.md     → 6   (11-U1 bis 11-U6, unverändert — Sollwert laut Auftrag: 6)
$ grep -co "11-F[0-9]" 14-UAT-SAMMLUNG.md     → 3   (11-F1 bis 11-F3, unverändert — Sollwert laut Auftrag: 3)
$ git diff --stat -- 14-UAT-SAMMLUNG.md       → 1 file changed, 65 insertions(+), 1 deletion(-)
```

Der `git diff` zeigt **ausschließlich** die eine entfernte Platzhalterzeile (`-1`) und die
neuen Zeilen im Phase-13-Abschnitt (`+65`) — kein einziges Zeichen der Abschnitte Phase 11,
Phase 12 oder Phase 14 wurde verändert. Der Abschnitt `## Phase 14 — Absicherung und
Auslieferung` steht unverändert am Ende der Datei (durch den Diff-Ausschnitt bestätigt: die
einzige Änderung liegt zwischen Zeile 187 und 189 der Ursprungsdatei).

## Task Commits

1. **Task 1: Pflicht-Gates und Entscheidungsabgleich** — kein eigener Commit (laut Plantext: "keine Quelldateien — dieser Task führt Prüfungen aus und protokolliert sie in der SUMMARY"). Ergebnis vollständig in dieser SUMMARY dokumentiert.
2. **Task 2: UAT-Sammlung für Phase 13 in 14-UAT-SAMMLUNG.md ergänzen** — `27d5b60` (docs)

## Files Created/Modified

- `.planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md` - Platzhalter unter „## Phase 13" durch 13 UAT-Punkte, 10 Festlegungen und 4 Umgebungsbefunde ersetzt; alle anderen Abschnitte unverändert

## Decisions Made

Siehe `key-decisions` im Frontmatter oben.

## Deviations from Plan

### Auto-fixed Issues

Keine — dieser Plan führt ausschließlich Messungen/Abgleiche (Task 1) und eine additive Dokumenten-Ergänzung (Task 2) durch. Kein Code wurde verändert, keine der drei Fixerkategorien (Rule 1/2/3) kam zum Einsatz.

**Total deviations:** 0

## Issues Encountered

Keine neuen. Der bereits vor diesem Plan bekannte Umstand — Port 3000 durchgehend durch ein fremdes Next.js-Projekt belegt, dadurch kein manueller Login-/Live-Test in dieser Ausführungsumgebung möglich — gilt unverändert und ist unter 13-U1 bis 13-U13 sowie im Abschnitt „Nachrichtlich: Umgebungsbefunde" von Task 2 dokumentiert, nicht als Blocker dieses Plans behandelt (laut `<environment_constraints>` der Auftragsvorgabe ausdrücklich "Record as UAT, don't block").

## User Setup Required

None — keine externen Dienste, keine neuen Abhängigkeiten, keine Migration, kein Release (Release ist explizit Phase 14).

## Next Phase Readiness

- Phase 13 ist vollständig abgeschlossen: alle zehn Implementierungspläne plus dieser Abschlussplan. Beide Requirements (REQ-30, REQ-31) sind serverseitig durchgesetzt und mit HTTP-Tests belegt, nicht nur in der Oberfläche.
- `.planning/phases/14-absicherung-und-auslieferung/14-UAT-SAMMLUNG.md` trägt jetzt Phase 11 (6 U-Punkte, 3 F-Punkte), Phase 12 (39 durchnummerierte Punkte + 12 Review-Nachträge, macht 51 in Summe) und Phase 13 (13 U-Punkte, 10 F-Punkte) — bereit für die gebündelte Abnahmesitzung in Phase 14.
- Offene, für Phase 14 relevante Punkte aus dieser Phase: der Login-/Live-Rauchtest (13-U12) kann erst durchgeführt werden, wenn Port 3000 frei ist; die Generalprobe gegen eine Produktionskopie (13-U11) ist noch nicht gelaufen; `vitest` ist in `desktop/` weiterhin nicht lauffähig (Umgebungsbefund, seit Phase 12 bekannt).
- Kein Release, kein Produktionslauf in dieser Phase — beides bleibt, wie im Plan-Objective festgehalten, Aufgabe von Phase 14.

---
*Phase: 13-korrigieren-und-r-ckg-ngig-machen*
*Completed: 2026-08-22*

## Self-Check: PASSED

`14-UAT-SAMMLUNG.md` verifiziert vorhanden und enthält `13-U1` (6 Treffer, inkl. 13-U10..13-U13
als Teilstring-Treffer) und `13-F1` — Datei-Existenz sowie Inhalt bestätigt. Commit-Hash `27d5b60`
in `git log --oneline --all` verifiziert (siehe Bash-Ausgabe: `27d5b60 docs(13-11): Phase-13-UAT-Sammlung
in 14-UAT-SAMMLUNG.md ergänzen`). `cd server && npx tsc --noEmit` Exit 0. `cd desktop && npx tsc
--noEmit` Exit 0. `cd server && npx vitest run` — 478 grün / 3 rot (exakt Titel 1-3 aus
`11-AUSGANGSZUSTAND.md`, keine Regression). Alle vier Desktop-`.check.ts`-Skripte Exit 0 (50/50
Einzeltests grün). `server/src/services/workPeriodDeletionService.test.ts` — "Zusicherung A/B/C/D"
einzeln nachgewiesen, 7/7 grün. `git diff --stat` für `14-UAT-SAMMLUNG.md` zeigt ausschließlich
Ergänzungen im Phase-13-Abschnitt (1 Zeile entfernt: Platzhalter; 65 Zeilen hinzugefügt).
