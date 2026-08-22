/**
 * Arbeitszeitperioden-Router (Milestone v3.0, Phase 12, REQ-26 bis REQ-29).
 *
 * Neben dem Lese-Endpunkt (GET /, Plan 12-01) traegt dieser Router seit Plan 12-05 die
 * beiden Schreibendpunkte fuer den Stundenwechsel: POST /preview (Trockenlauf ueber
 * `applyWorkTimeChange`) und POST /change (Speichern ueber dieselbe Funktion, verlangt
 * ein gueltiges previewToken aus der vorherigen Vorschau). Beide POST-Pfade tragen
 * zusaetzlich zu requireAuth auch die Admin-Rollenpruefung aus der Middleware (D6) —
 * requireAuth allein genuegt fuer Schreiboperationen nicht, und schon die Vorschau legt
 * Sollstunden und Saldo eines fremden Nutzers offen (T-12-23).
 *
 * D2/REQ-27: Beide Routen rufen exakt dieselbe Funktion (`applyWorkTimeChange`) auf — es
 * gibt keine im Frontend nachgebaute Vorschau-Rechnung.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { workTimeChangePreviewLimiter } from '../middleware/rateLimits.js';
import { getWorkPeriods, WorkPeriodConflictError } from '../services/workPeriodService.js';
import {
  applyWorkTimeChange,
  WorkTimeChangeValidationError,
} from '../services/workPeriodChangeService.js';
import * as workTimeChangeTokenModule from '../services/workTimeChangeToken.js';
// CR-04/IN-01: EIN Tagesplan-Typwächter für Route und Service. Vorher lag hier eine
// wortgleiche, ebenso lückenhafte Kopie — eine Verschärfung wäre nur an einer der beiden
// Stellen angekommen.
import { isWorkSchedule } from '../utils/workSchedule.js';
import type {
  ApiResponse,
  UserWorkPeriod,
  WorkSchedule,
  WorkTimeChangeOutcome,
  WorkTimeChangePreviewResponse,
} from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

/** Die vier Felder, die jede der beiden Schreib-Routen mindestens braucht. */
interface WorkTimeChangeRequestBody {
  userId: number;
  validFrom: string;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
}

/**
 * Liest den Anfragekörper über einen Typwächter statt eines Casts auf den Anfragekörper —
 * diese Datei enthält an keiner Stelle einen solchen Cast. Liefert `null`, wenn ein Feld
 * fehlt oder den falschen Typ trägt — die Route antwortet dann mit 400, bevor irgendetwas
 * den Service erreicht.
 */
function parseWorkTimeChangeRequestBody(body: unknown): WorkTimeChangeRequestBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;

  if (typeof record.userId !== 'number' || !Number.isFinite(record.userId)) {
    return null;
  }
  if (typeof record.validFrom !== 'string' || record.validFrom.length === 0) {
    return null;
  }
  if (typeof record.weeklyHours !== 'number' || !Number.isFinite(record.weeklyHours)) {
    return null;
  }
  if (record.workSchedule !== null && !isWorkSchedule(record.workSchedule)) {
    return null;
  }

  return {
    userId: record.userId,
    validFrom: record.validFrom,
    weeklyHours: record.weeklyHours,
    workSchedule: record.workSchedule === null ? null : record.workSchedule,
  };
}

/** Zusätzlich zu den vier Basisfeldern: Begründung und das in /preview ausgestellte Token. */
interface WorkTimeChangeSaveRequestBody extends WorkTimeChangeRequestBody {
  reason: string;
  previewToken: string;
}

/**
 * `reason` und `previewToken` werden bewusst NICHT wie die Basisfelder mit 400 abgelehnt,
 * wenn sie fehlen oder den falschen Typ tragen: Ein fehlendes `previewToken` ist kein
 * kaputt geformter Anfragekörper, sondern schlicht "keine gültige Vorschau vorhanden" — das
 * ist der Fall, den `verifyPreviewToken()` unten bereits mit 409/PREVIEW_STALE beantwortet
 * (T-12-24). Eine leere Zeichenkette lässt das Format dort zuverlässig scheitern.
 */
function parseWorkTimeChangeSaveRequestBody(body: unknown): WorkTimeChangeSaveRequestBody | null {
  const base = parseWorkTimeChangeRequestBody(body);
  if (!base) {
    return null;
  }
  const record = body as Record<string, unknown>;

  const reason = typeof record.reason === 'string' ? record.reason : '';
  const previewToken = typeof record.previewToken === 'string' ? record.previewToken : '';

  return { ...base, reason, previewToken };
}

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

/**
 * POST /api/work-periods/preview
 * Berechnet die Vorschau eines Stundenwechsels — echter Dry-Run über dieselbe Funktion, die
 * auch das Speichern ausführt (D2/REQ-27, keine zweite Rechenbahn). Admin only (D6/T-12-23):
 * die Vorschau legt Sollstunden und Saldo eines fremden Nutzers offen.
 *
 * Body: { userId, validFrom, weeklyHours, workSchedule }. Die Begründung wird im Trockenlauf
 * nicht geprüft und ist auch nicht Teil des ausgestellten Tokens (workTimeChangeToken.ts).
 */
router.post(
  '/preview',
  // WR-03: eigener, enger Limiter VOR der Rollenprüfung — der Trockenlauf ist ein echter
  // Schreib-Rebuild in einer exklusiven SQLite-Schreibtransaktion, nicht ein billiger Lesezugriff.
  workTimeChangePreviewLimiter,
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkTimeChangePreviewResponse>>) => {
    const parsed = parseWorkTimeChangeRequestBody(req.body);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Missing or invalid fields' });
      return;
    }

    try {
      const outcome = applyWorkTimeChange(
        { ...parsed, reason: '' },
        { dryRun: true, createdBy: req.session.user!.id }
      );

      const previewToken = workTimeChangeTokenModule.issuePreviewToken({
        userId: parsed.userId,
        validFrom: parsed.validFrom,
        weeklyHours: parsed.weeklyHours,
        workSchedule: parsed.workSchedule,
      });

      res.json({ success: true, data: { ...outcome.preview, previewToken } });
    } catch (error) {
      if (error instanceof WorkTimeChangeValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WorkPeriodConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      logger.error({ err: error }, 'Failed to preview work time change');
      res.status(500).json({ success: false, error: 'Failed to preview work time change' });
    }
  }
);

/**
 * POST /api/work-periods/change
 * Speichert einen Stundenwechsel — verlangt ein zuvor über POST /preview ausgestelltes,
 * noch gültiges `previewToken` (T-12-24). Ein fehlendes, abgelaufenes oder zu anderen
 * Werten ausgestelltes Token führt zu 409 mit dem Fehlercode-Präfix, den die untenstehende
 * Antwort trägt (Vertrag mit dem Desktop, Plan 12-04, `useSaveWorkTimeChange`) — und
 * schreibt NICHTS.
 *
 * Body: { userId, validFrom, weeklyHours, workSchedule, reason, previewToken }.
 */
router.post(
  '/change',
  requireAuth,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkTimeChangeOutcome>>) => {
    const parsed = parseWorkTimeChangeSaveRequestBody(req.body);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Missing or invalid fields' });
      return;
    }

    const verification = workTimeChangeTokenModule.verifyPreviewToken(parsed.previewToken, {
      userId: parsed.userId,
      validFrom: parsed.validFrom,
      weeklyHours: parsed.weeklyHours,
      workSchedule: parsed.workSchedule,
    });
    if (!verification.valid) {
      res.status(409).json({
        success: false,
        error: 'PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell.',
      });
      return;
    }

    try {
      const outcome = applyWorkTimeChange(
        {
          userId: parsed.userId,
          validFrom: parsed.validFrom,
          weeklyHours: parsed.weeklyHours,
          workSchedule: parsed.workSchedule,
          reason: parsed.reason,
        },
        { dryRun: false, createdBy: req.session.user!.id }
      );

      // T-12-26: ausschließlich Zahlen und Datumsangaben — keine Namen, keine Begründung.
      logger.info(
        {
          userId: parsed.userId,
          validFrom: parsed.validFrom,
          balanceDelta: outcome.preview.balanceDelta,
          adminId: req.session.user!.id,
        },
        'Stundenwechsel gespeichert'
      );

      res.json({ success: true, data: outcome });
    } catch (error) {
      if (error instanceof WorkTimeChangeValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WorkPeriodConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      logger.error({ err: error }, 'Failed to save work time change');
      res.status(500).json({ success: false, error: 'Failed to save work time change' });
    }
  }
);

export default router;
