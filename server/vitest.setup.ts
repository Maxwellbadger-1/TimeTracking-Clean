/**
 * Vitest-Setup — WR-14 (Code-Review Phase 11)
 *
 * WARUM DIESE DATEI EXISTIERT:
 * Die Testdateien dieses Projekts legen echte Nutzer per `INSERT INTO users` an und räumen
 * per `DELETE FROM users` / `DELETE FROM overtime_transactions` wieder auf — in derselben
 * Datenbank, die `getDatabasePath()` liefert (`vitest.config.ts` dokumentiert das als
 * bekannt). Keine einzige Testdatei rief bisher `assertNotProduction()`. Ein `npm test` mit
 * gesetztem `DATABASE_PATH` — genau die Aufrufform, die `.claude/CLAUDE.md` für JEDES Skript
 * vorschreibt — löschte damit Zeilen in der angegebenen Datenbank. Der Riegel existierte
 * bereits (`src/scripts/productionGuard.ts`), er wurde hier nur nicht benutzt.
 *
 * `setupFiles` läuft EINMAL PRO TESTDATEI, bevor deren Importe ausgeführt werden — also
 * bevor irgendein Modul `database/connection.ts` zieht und die Datei öffnet. Das ist die
 * einzige Stelle, an der der Guard noch etwas verhindern kann; ein Aufruf innerhalb einer
 * Testdatei nach deren Import-Zeilen wäre wirkungslos (dieselbe Begründung wie im
 * Kopfkommentar von `productionGuard.ts`).
 *
 * Schlägt der Guard an, beendet er den Prozess mit Exitcode 2 — der gesamte Testlauf bricht
 * ab, statt in eine Produktionsdatenbank zu schreiben. Das ist beabsichtigt.
 */

import { assertNotProduction } from './src/scripts/productionGuard.js';

assertNotProduction();
