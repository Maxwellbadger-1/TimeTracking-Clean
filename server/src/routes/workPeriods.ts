/**
 * Arbeitszeitperioden-Router (Milestone v3.0, Phase 12, REQ-26 bis REQ-29).
 *
 * Dieser Router traegt heute genau einen Lese-Endpunkt (GET /). Plan 12-05 ergaenzt hier
 * zwei weitere Endpunkte (POST /preview, POST /change) fuer den eigentlichen
 * Stundenwechsel — der Ablageort ist bewusst ein gemeinsamer Router, damit
 * /api/work-periods eine Adresse fuer alle drei Operationen hat. WICHTIG fuer die
 * kommenden Schreibendpunkte: sie muessen zusaetzlich zu requireAuth auch requireAdmin
 * tragen (D6) — requireAuth allein genuegt fuer Schreiboperationen nicht.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getWorkPeriods } from '../services/workPeriodService.js';
import type { ApiResponse, UserWorkPeriod } from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/**
 * GET /api/work-periods
 * Liefert die Arbeitszeitperioden eines Nutzers, aufsteigend nach validFrom.
 *
 * Query params:
 *   - userId: Nutzer-ID (optional; Standard ist der angemeldete Nutzer selbst)
 *
 * D6: Ein Mitarbeiter darf ausschliesslich seine eigenen Perioden lesen. Eine fremde
 * userId beantwortet der Server mit 403 — kein stiller Ruecksfall auf das eigene Konto.
 */
router.get(
  '/',
  requireAuth,
  (req: Request, res: Response<ApiResponse<UserWorkPeriod[]>>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';
      const requestedUserId = req.query.userId
        ? parseInt(req.query.userId as string, 10)
        : req.session.user!.id;

      if (Number.isNaN(requestedUserId)) {
        res.status(400).json({ success: false, error: 'Invalid userId' });
        return;
      }

      if (!isAdmin && requestedUserId !== req.session.user!.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      res.json({ success: true, data: getWorkPeriods(requestedUserId) });
    } catch (error) {
      logger.error({ err: error }, 'Failed to load work periods');
      res.status(500).json({ success: false, error: 'Failed to load work periods' });
    }
  }
);

export default router;
