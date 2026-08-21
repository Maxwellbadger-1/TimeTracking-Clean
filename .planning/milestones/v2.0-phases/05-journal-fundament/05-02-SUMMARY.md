---
phase: 05-journal-fundament
plan: 02
status: complete
completed: 2026-08-19
files_modified:
  - server/src/services/vacationTransactionService.ts
  - server/src/services/vacationTransactionService.test.ts
---

# 05-02 — Service-Schicht für das Urlaubs-Journal

Ein einziger Zugriffspunkt auf das Journal: Buchen, Lesen, Saldo. Alle späteren Schreibpfade
(Phase 6) und Ansichten (Phase 8) gehen ausschließlich hierüber. Die Streuung von
Buchungslogik über mehrere Services war eine der Bedingungen, unter denen der ursprüngliche
Fehler überhaupt entstehen konnte.

**Kein Verhalten geändert** — der Service wird noch von niemandem aufgerufen.

## Funktionen

| Funktion | Zweck |
|---|---|
| `recordVacationTransaction(input)` | Buchung schreiben, gibt die neue id zurück |
| `getVacationBalanceFromTransactions(userId, year)` | Saldo = `SUM(days)` des Nutzerjahres |
| `getVacationTransactions(userId, {year, limit})` | Journal chronologisch (`date ASC, id ASC`) |
| `getVacationTransactionsForAbsence(absenceId)` | alle Buchungen zu einem Antrag |

**Synchron gehalten** — keine `async`, kein `await`, keine dynamischen Imports. Nur so lässt
sich eine Buchung in Phase 6 gemeinsam mit dem Statuswechsel in eine `db.transaction()`
klammern. Ein Test sichert diese Eigenschaft ab.

`balanceBefore`/`balanceAfter` werden mitgeschrieben: Jede Zeile trägt ihren eigenen Nachweis,
der Kontoauszug kommt ohne Nachrechnen aus, und eine gebrochene Kette fällt sofort auf.

**Abgewiesen werden** Buchungen ohne Begründung, mit `days = 0`, mit unbekanntem Typ oder
unplausiblem Jahr — eine unbrauchbare Buchung soll gar nicht erst entstehen.

## Tests — 16, alle grün

**Der auslösende Fall (3 Tests):**
- Carmens Storno in Buchungsform: `+20 / −6 / +6` ergibt **20**. Vor dem Fix blieb ihr Konto
  bei 14 und die sechs Tage waren dauerhaft weg.
- Buchungen zu einem stornierten Antrag heben sich zu 0 auf — darauf baut der
  Konsistenzprüfer in Phase 7 auf
- Wieder-Genehmigung bucht nicht doppelt (`pending → approved → rejected → approved` ergab
  früher `taken = 2 × Tage`)

**Buchen und Lesen (5):** alle Felder gespeichert · Saldo-Kette über drei Buchungen
(`[0,20] [20,15] [15,12]`) · leeres Konto = 0 · halbe Tage · Jahrestrennung

**Ungültige Buchungen (5):** leere Begründung · nur Leerzeichen · `days = 0` ·
unbekannter Typ · Jahr 1899

**Reihenfolge und Transaktionsklammer (3):** stabile Sortierung bei gleichem Datum ·
Rollback bei Fehler innerhalb `db.transaction()` · mehrere Buchungen gemeinsam geschrieben

## Qualitätsgates

- `npx tsc --noEmit` fehlerfrei
- Gesamtsuite: **108 grün** (vorher 92), 2 rot — dieselben zwei vorbestehenden Fehlschläge
  in `unifiedOvertimeService.test.ts`. Keine neuen.
