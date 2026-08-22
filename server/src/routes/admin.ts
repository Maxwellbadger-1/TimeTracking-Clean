/**
 * Admin Routes - Bestandsprüfungen für Administratoren
 *
 * Endpoints:
 * - GET /api/admin/period-chains - Bestands-Check der Arbeitszeitperioden (WR-02)
 *
 * WOZU (WR-02, Code-Review Phase 11, Durchlauf 2)
 * ===============================================
 * `checkAllPeriodChains()` war nach Durchlauf 1 implementiert und getestet, hatte außerhalb
 * von `workPeriodService.test.ts` aber keinen einzigen Aufrufer. Damit galt die Zusage aus
 * dem Fix-Bericht — "diese Funktion findet denselben Defekt VORHER" — faktisch nicht: Ein
 * Nutzer ohne Arbeitszeitperiode fiel erst auf, wenn jemand in `pm2 logs` danach suchte.
 *
 * Diese Route ist der Aufrufer, der auch die PRODUKTION abdeckt. Das CLI-Gegenstück
 * (`npm run check:period-chains`, `scripts/checkPeriodChains.ts`) läuft ausdrücklich NICHT
 * gegen die Produktionsdatenbank, weil der `import` von `database/connection.ts` dort
 * `CREATE TABLE IF NOT EXISTS`/`CREATE INDEX IF NOT EXISTS` ausführt — ein Schreibvorgang.
 * Hier entsteht keine zweite Verbindung: Der Check läuft im ohnehin laufenden Serverprozess
 * auf der bereits geöffneten Verbindung und liest nur.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { checkAllPeriodChains, type PeriodChainIssue } from '../services/workPeriodService.js';
import type { ApiResponse } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

interface PeriodChainReport {
  ok: boolean;
  userCount: number;
  findingCount: number;
  issues: PeriodChainIssue[];
}

/**
 * GET /api/admin/period-chains
 * Bestands-Check aller Arbeitszeitperioden (Admin only)
 *
 * Antwort:
 * - `ok`            true, wenn kein Nutzer auffällig ist
 * - `userCount`     Anzahl auffälliger Nutzer
 * - `findingCount`  Anzahl Einzelbefunde über alle Nutzer
 * - `issues`        je Nutzer die Befundtexte aus `checkAllPeriodChains()`
 *
 * Immer HTTP 200 — auch bei Befunden. Ein Defekt IM BESTAND ist kein Fehler DIESER
 * Anfrage; die Antwort ist das Prüfergebnis und muss auswertbar bleiben. Der Aufrufer
 * entscheidet über `ok`.
 */
router.get(
  '/period-chains',
  requireAuth,
  requireAdmin,
  (_req: Request, res: Response<ApiResponse<PeriodChainReport>>) => {
    try {
      const issues = checkAllPeriodChains();
      const findingCount = issues.reduce((sum, issue) => sum + issue.findings.length, 0);

      if (issues.length > 0) {
        // logger.error und nicht .warn: Ein Nutzer ohne lückenlose Periodenkette ist nach
        // D4 ein Datendefekt, kein Grenzfall — jede Sollstunden-Berechnung für ihn wirft.
        logger.error(
          { userIds: issues.map(issue => issue.userId), findingCount },
          '❌ Bestands-Check: Nutzer mit defekter Arbeitszeitperioden-Kette gefunden (D4, WR-02)'
        );
      }

      res.json({
        success: true,
        data: {
          ok: issues.length === 0,
          userCount: issues.length,
          findingCount,
          issues,
        },
      });
    } catch (error) {
      logger.error({ err: error }, '❌ Bestands-Check der Arbeitszeitperioden fehlgeschlagen');
      res.status(500).json({
        success: false,
        error: 'Failed to check work period chains',
      });
    }
  }
);

export default router;
