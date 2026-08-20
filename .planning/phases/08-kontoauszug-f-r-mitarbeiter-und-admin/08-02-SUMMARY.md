---
phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
plan: 02
subsystem: ui
tags: [react, typescript, tanstack-query, tailwind]

# Dependency graph
requires:
  - phase: 08-kontoauszug-f-r-mitarbeiter-und-admin
    provides: "GET /api/vacation-transactions mit serverseitiger Rollenprüfung (Plan 08-01)"
provides:
  - "useVacationTransactions — typisierter Query-Hook auf GET /api/vacation-transactions"
  - "VacationTransactions.tsx — Kontoauszug-Komponente mit Jahreswahl und Antragsverlinkung"
  - "Einbindung auf AbsencesPage (eigenes Konto) und VacationBalanceManagementPage (Admin, je Mitarbeiter)"
affects: [08-04]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Kontoauszug-Komponente ohne any-Typen, im Gegensatz zum Vorbild OvertimeTransactions.tsx (transaction: any)"
    - "Antragsdaten werden aus der bereits autorisierten Journal-Antwort gerendert, kein zweiter API-Aufruf beim Öffnen des Antragsmodals"

key-files:
  created:
    - desktop/src/hooks/useVacationTransactions.ts
    - desktop/src/components/vacation/VacationTransactions.tsx
  modified:
    - desktop/src/hooks/index.ts
    - desktop/src/pages/AbsencesPage.tsx
    - desktop/src/pages/VacationBalanceManagementPage.tsx

key-decisions:
  - "Auf VacationBalanceManagementPage bekommt VacationTransactions kein showYearSelector — das Jahr kommt bewusst aus der bestehenden Jahreswahl der Seite (REQ-12), damit Auszug und Tabelle nie auseinanderlaufen"
  - "Auf AbsencesPage wird kein userId-Prop gesetzt — der Server bestimmt den Nutzer aus der Session; auch Admins sehen dort nur ihr eigenes Konto, fremde Auszüge liegen ausschließlich in der Urlaubskonto-Verwaltung"

patterns-established: []

requirements-completed: [REQ-11, REQ-12, REQ-13]

# Metrics
duration: ~20min
completed: 2026-08-20
---

# Phase 08 Plan 02: Kontoauszug-Oberfläche für Mitarbeiter und Admin Summary

**`VacationTransactions.tsx` zeigt Datum, Vorgang, Tage und laufenden Saldo je Buchung, verlinkt Antragsbuchungen zu ihrem Abwesenheitsantrag und ist typsicher (kein `any`) an `GET /api/vacation-transactions` angebunden — eingebunden auf der Abwesenheiten-Seite (eigenes Konto) und in der Urlaubskonto-Verwaltung (je Mitarbeiterzeile).**

## Performance

- **Duration:** ~20 min
- **Completed:** 2026-08-20
- **Tasks:** 3/3
- **Files modified:** 5 (2 neu, 3 geändert)

## Accomplishments
- `useVacationTransactions` lädt den Kontoauszug typisiert (`VacationJournalEntry`, `VacationAccountStatement`), `staleTime: 0` sorgt für sofortige Aktualisierung nach Genehmigung/Storno/Korrektur
- `VacationTransactions.tsx` rendert Datum, Vorgang (Badge, deutsch beschriftet für alle sechs Buchungstypen), Beschreibung, Tage (mit Vorzeichen und Trend-Icon) und laufenden Saldo je Buchung; Kopfbereich zeigt den verfügbaren Saldo identisch zur Spalte „Verbleibend" der Urlaubsliste
- Jede Buchung mit `referenceType: 'absence'` verlinkt per Klick zu einem Modal mit Zeitraum, Typ, Status und Tagen des auslösenden Antrags — ohne zusätzlichen API-Aufruf, da die Daten bereits in der autorisierten Journal-Antwort enthalten sind
- Auf `AbsencesPage` erscheint der eigene Auszug mit Jahreswahl vor den Filtern; auf `VacationBalanceManagementPage` öffnet ein neuer Button „Auszug" je Mitarbeiterzeile ein Modal mit dem Auszug für das dort gewählte Jahr

## Task Commits

Each task was committed atomically:

1. **Task 1: Query-Hook für den Kontoauszug** - `8e08ebf` (feat)
2. **Task 2: Kontoauszug-Komponente mit Jahreswahl und Antragsverlinkung** - `ff660ce` (feat)
3. **Task 3: Einbindung für Mitarbeiter und Admin** - `616321e` (feat)

_Kein separater Plan-Metadaten-Commit — dieser Plan lief als Worktree-Agent; der Orchestrator committet SUMMARY.md nach dem Merge zentral._

## Files Created/Modified
- `desktop/src/hooks/useVacationTransactions.ts` - Typen `VacationTransactionType`, `VacationJournalAbsence`, `VacationJournalEntry`, `VacationAccountStatement` exakt nach dem Server-Vertrag aus 08-01; `useVacationTransactions(userId?, year?, limit?)` auf `useQuery`-Basis
- `desktop/src/hooks/index.ts` - Neuer Exportblock `// Vacation Transactions (Kontoauszug)` nach `// Vacation Balance Admin`
- `desktop/src/components/vacation/VacationTransactions.tsx` - Neue Komponente `VacationTransactions` mit Lade-/Fehler-/Leerzustand, Fünf-Spalten-Tabelle, Antragsmodal
- `desktop/src/pages/AbsencesPage.tsx` - `<VacationTransactions showYearSelector />` vor dem Filter-Block eingefügt
- `desktop/src/pages/VacationBalanceManagementPage.tsx` - `statementUser`-Zustand, Button „Auszug" je Zeile, `Modal` mit `<VacationTransactions userId={...} year={selectedYear} />`

## Decisions Made
- `available` wird direkt aus der Server-Antwort übernommen, nicht neu berechnet — der Server garantiert per Invariante (Plan 08-01), dass dieser Wert mit der Urlaubsliste übereinstimmt
- Badge-Farben: Gutschriften (`entitlement`, `carryover`, `vacation_reverted`) grün, `vacation_taken` rot, `expiry` orange, `correction` violett — wie im Plan spezifiziert, angelehnt an das Vorbild `OvertimeTransactions.tsx`
- Jahresoptionen der Jahreswahl basieren auf dem echten aktuellen Kalenderjahr (`new Date().getFullYear()`), nicht auf dem gerade ausgewählten Jahr — identisch mit dem bestehenden Muster in `VacationBalanceManagementPage.tsx`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Kommentar enthielt den verbotenen Begriff „toISOString"**
- **Found during:** Task 2 (Selbstprüfung der Acceptance Criteria)
- **Issue:** Ein Kommentar in `formatDateDe` erklärte die Zeitzonen-Absicherung mit dem Wortlaut „toISOString() ist laut .claude/CLAUDE.md verboten" — das Acceptance Criterion verlangt `grep -c "toISOString"` = 0, traf aber auf den Kommentartext zu (obwohl `toISOString()` selbst nirgends aufgerufen wird)
- **Fix:** Kommentar umformuliert, ohne den Begriff wörtlich zu nennen; Funktionalität unverändert
- **Files modified:** desktop/src/components/vacation/VacationTransactions.tsx
- **Verification:** `grep -c "toISOString"` liefert 0, `npx tsc --noEmit` weiterhin fehlerfrei
- **Committed in:** ff660ce (Task 2 commit)

---

**Total deviations:** 1 auto-fixed (1 Bug/Selbstprüfung)
**Impact on plan:** Reine Kommentarkorrektur, keine Verhaltensänderung. Kein Scope Creep.

**Hinweis (keine Korrektur nötig):** Das Acceptance Criterion `grep -c "year={selectedYear}" desktop/src/pages/VacationBalanceManagementPage.tsx` gibt `1` an — tatsächlich sind es 2 Treffer, weil das bereits bestehende `VacationBalanceEditModal` denselben Prop-Namen verwendet (Zeile 238, unverändert von diesem Plan). Die neue Verwendung in `VacationTransactions` (Zeile 258) ist funktional korrekt und erfüllt REQ-12; der Plan-Grep hatte die vorbestehende Verwendung nicht antizipiert.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness
- Oberfläche und Hook sind bereit; `cd desktop && npx tsc --noEmit && npm run build` läuft fehlerfrei durch
- Die inhaltliche Prüfung (Carmens Storno-Geschichte, Saldo-Abgleich mit der Urlaubsliste, visuelle Kontrolle) ist laut Plan-Verifikation Teil des Human-Verify-Checkpoints von Plan 08-04
- Keine Blocker

---
*Phase: 08-kontoauszug-f-r-mitarbeiter-und-admin*
*Completed: 2026-08-20*

## Self-Check: PASSED

- Alle 5 Code-Dateien plus SUMMARY.md auf der Festplatte gefunden
- Alle 4 Commits (`8e08ebf`, `ff660ce`, `616321e`, `a6a1207`) in `git log --oneline` gefunden
