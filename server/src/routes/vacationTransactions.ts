import { Router, Request, Response } from 'express';
import { requireAuth } from '../middleware/auth.js';
import { getVacationAccountStatement } from '../services/vacationTransactionService.js';
import logger from '../utils/logger.js';

const router = Router();

const DEFAULT_LIMIT = 200;
const MAX_LIMIT = 500;

/**
 * GET /api/vacation-transactions
 * Kontoauszug (Journal + Saldo) für den eigenen oder — nur als Admin — einen fremden
 * Nutzer. Die Rollenprüfung sitzt hier in der Route, nicht in der Oberfläche (REQ-14):
 * Ein Mitarbeiter, der mit einer fremden userId anfragt, bekommt 403 — kein stiller
 * Rückfall auf das eigene Konto, denn das würde einen Fehler des Clients verschleiern.
 *
 * Query params:
 *   - userId: nur für Admins wirksam; Mitarbeiter erhalten immer ihr eigenes Konto
 *   - year: Standard ist das laufende Jahr
 *   - limit: Standard 200, Obergrenze 500
 */
router.get('/', requireAuth, (req: Request, res: Response) => {
  try {
    const sessionUser = req.session.user!;
    const isAdmin = sessionUser.role === 'admin';

    if (req.query.userId !== undefined && isNaN(Number(req.query.userId))) {
      res.status(400).json({ success: false, error: 'Invalid user ID' });
      return;
    }

    if (req.query.year !== undefined && isNaN(Number(req.query.year))) {
      res.status(400).json({ success: false, error: 'Invalid year' });
      return;
    }

    if (
      req.query.userId !== undefined &&
      !isAdmin &&
      Number(req.query.userId) !== sessionUser.id
    ) {
      res.status(403).json({
        success: false,
        error: 'Sie dürfen ausschließlich Ihr eigenes Urlaubskonto einsehen',
      });
      return;
    }

    const targetUserId = isAdmin && req.query.userId
      ? Number(req.query.userId)
      : sessionUser.id;

    const year = req.query.year ? Number(req.query.year) : new Date().getFullYear();

    const requestedLimit = Number(req.query.limit);
    const limit = Number.isFinite(requestedLimit) && requestedLimit > 0
      ? Math.min(requestedLimit, MAX_LIMIT)
      : DEFAULT_LIMIT;

    const statement = getVacationAccountStatement(targetUserId, year, { limit });

    res.json({ success: true, data: statement });
  } catch (error: unknown) {
    logger.error({ err: error }, '❌ Error fetching vacation transactions');
    res.status(500).json({
      success: false,
      error: 'Failed to load vacation transactions',
    });
  }
});

export default router;
