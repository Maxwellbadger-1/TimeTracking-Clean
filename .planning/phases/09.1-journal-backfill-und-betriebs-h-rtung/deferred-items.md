# Deferred Items — Phase 9.1

Funde außerhalb des Scopes der jeweiligen Pläne. Nicht behoben, nur dokumentiert.

## Plan 09.1-03

1. **`server/database/development.db` dieses Worktrees enthält 0 Zeilen in `holidays`**
   (gemessen per `SELECT COUNT(*) FROM holidays` — Ergebnis `0`). Dadurch schlagen 9
   zusätzliche, feiertagsabhängige Tests fehl, die über die vier bekannten Baseline-Fehler
   hinausgehen: `src/utils/workingDays.test.ts` (7 Fälle, u.a. „Heilige Drei Könige",
   „Neujahr überschreibt die Periode"), `src/services/overtimeLiveCalculationService.test.ts`
   („schließt einen Feiertag aus…") und ein Fall in
   `src/services/unifiedOvertimeService.test.ts` („ein Feiertag überschreibt das Soll
   weiterhin auf 0h"). `workingDays.test.ts:611` vermerkt selbst: „Note: These tests assume
   holidays are in database."
   **Ursache nicht dieser Plan:** Task 1 dieses Plans löscht ausschließlich 13 unreferenzierte
   Legacy-Skripte (`server/scripts/*.js`/`*.ts`), keines davon berührt die `holidays`-Tabelle
   oder deren Befüllung. `initializeHolidays()` läuft nur beim echten Serverstart
   (`server/src/server.ts`), nicht in Tests. Jede der drei parallel angelegten Worktree-Kopien
   von `development.db` hat eine eigene Dateigröße/Inode (gemessen: 512.000 / 2.035.712 /
   401.408 Bytes, drei verschiedene Inodes) — die Kopie dieses Worktrees wurde offenbar ohne
   je gepflegte Feiertagsdaten erstellt oder hat sie durch einen vorherigen Testlauf verloren,
   bevor dieser Plan zu laufen begann.
   **Nicht behoben:** Ein Nachfüllen der `holidays`-Tabelle wäre eine Datenmutation außerhalb
   des Aufgabenbereichs dieses Plans (`server/scripts/**` verschieben/löschen,
   `server/package.json` anpassen) und ist laut Vorgabe nicht Sache dieses Ausführers.
   **Empfehlung:** Vor der nächsten Phase, die sich auf `vitest run` als Regressionsnetz
   verlässt, `npm run <ein-holiday-seed-werkzeug>` oder einen echten Serverstart gegen jede
   Worktree-Kopie von `development.db` laufen lassen, um die Feiertagsdaten wiederherzustellen.
