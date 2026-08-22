/**
 * Arbeitszeitperioden-Router (Milestone v3.0, Phase 12 + 13, REQ-26 bis REQ-31).
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
 *
 * ERWEITERUNG PLAN 13-05 (DD-19, D1, REQ-30/REQ-31): vier weitere Endpunkte fuer
 * „Stammdaten korrigieren" und „Periode loeschen" — GETRENNTE Pfade statt eines
 * gemeinsamen Endpunkts mit `mode`-Feld, damit die serverseitige Trennung der beiden
 * fachlich unterschiedlichen Schreibwege (D1, 13-CONTEXT.md) auch im Router sichtbar
 * bleibt, nicht nur in der Oberflaeche:
 *   - POST /:id/correct/preview — Korrektur-Vorschau (Trockenlauf ueber `correctWorkPeriod`)
 *   - PUT /:id                  — Korrektur speichern (verlangt ein gueltiges, fuer genau
 *                                  diese Periode/diesen Admin ausgestelltes previewToken)
 *   - POST /:id/delete/preview  — Loesch-Vorschau (Trockenlauf ueber `deleteWorkPeriod`)
 *   - DELETE /:id                — Loeschen und stornieren (verlangt ebenfalls ein gueltiges
 *                                  previewToken)
 * Alle vier tragen requireAuth + requireAdmin.
 *
 * DROSSELUNG (WR-06, Code-Review Phase 13): Jede Vorschau- und jede Schreibroute hat einen
 * EIGENEN Eimer, dessen Schluessel die angemeldete Sitzung ist — deshalb wird er NACH
 * `requireAuth` eingehaengt, nicht davor. Frueher teilten sich alle drei Vorschauen einen
 * IP-basierten Eimer von 30/min, der bereits vor der Anmeldung zaehlte: zwei Admins hinter
 * derselben NAT-Adresse behinderten einander, und ein Durchgang durch den Tagesplan-Editor
 * (sieben Felder, entprellte Vorschau je Aenderung) konnte die Aktion fuer eine Minute
 * komplett sperren. Der schmale `workPeriodUnauthenticatedGuardLimiter` steht weiterhin VOR
 * `requireAuth`, zaehlt aber ausschliesslich unauthentifizierte Anfragen (`skip` fuer
 * angemeldete Sitzungen). Die drei Schreibpfade tragen jetzt ueberhaupt einen Limiter — sie
 * fuehren denselben doppelten Rebuild aus wie die Vorschau, plus die Schreibvorgaenge.
 */

import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import {
  workPeriodUnauthenticatedGuardLimiter,
  createWorkPeriodPreviewLimiter,
  createWorkPeriodWriteLimiter,
} from '../middleware/rateLimits.js';
import {
  getWorkPeriodsWithFlags,
  WorkPeriodConflictError,
} from '../services/workPeriodService.js';
import {
  applyWorkTimeChange,
  WorkTimeChangeValidationError,
} from '../services/workPeriodChangeService.js';
import {
  correctWorkPeriod,
  WorkPeriodCorrectionValidationError,
} from '../services/workPeriodCorrectionService.js';
import {
  deleteWorkPeriod,
  WorkPeriodDeletionValidationError,
} from '../services/workPeriodDeletionService.js';
import * as workTimeChangeTokenModule from '../services/workTimeChangeToken.js';
// CR-04/IN-01: EIN Tagesplan-Typwächter für Route und Service. Vorher lag hier eine
// wortgleiche, ebenso lückenhafte Kopie — eine Verschärfung wäre nur an einer der beiden
// Stellen angekommen.
import { isWorkSchedule } from '../utils/workSchedule.js';
import type {
  ApiResponse,
  UserWorkPeriodListItem,
  WorkSchedule,
  WorkTimeChangeOutcome,
  WorkTimeChangePreviewResponse,
  WorkPeriodCorrectionOutcome,
  WorkPeriodCorrectionPreviewResponse,
  WorkPeriodDeletionOutcome,
  WorkPeriodDeletionPreviewResponse,
} from '../types/index.js';
import logger from '../utils/logger.js';

const router = Router();

// WR-06: Je Route ein eigener Eimer. Die Fabriken legen bei jedem Aufruf eine neue
// Limiter-Instanz mit eigenem Speicher an — eine intensiv bediente Korrekturvorschau sperrt
// damit nicht mehr die Loeschvorschau oder den Stundenwechsel.
const changePreviewLimiter = createWorkPeriodPreviewLimiter();
const correctPreviewLimiter = createWorkPeriodPreviewLimiter();
const deletePreviewLimiter = createWorkPeriodPreviewLimiter();
const changeWriteLimiter = createWorkPeriodWriteLimiter();
const correctWriteLimiter = createWorkPeriodWriteLimiter();
const deleteWriteLimiter = createWorkPeriodWriteLimiter();

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
 * DD-22 (Plan 13-05): Anfragekörper der Korrektur-Routen — drei Rechenfelder, plus
 * (permissiv gelesen) Begründung und Vorschau-Token. `periodId` steht NICHT im Körper,
 * sondern kommt aus der Pfadangabe `:id` (IDOR-Vermeidung, siehe `WorkPeriodCorrectionInput`
 * in `types/index.ts`).
 */
interface WorkPeriodCorrectionRequestBody {
  validFrom: string;
  weeklyHours: number;
  workSchedule: WorkSchedule | null;
  reason: string;
  previewToken: string;
}

/**
 * Liest den Anfragekörper der Korrektur-Routen über einen Typwächter, kein Cast. `reason`
 * und `previewToken` werden wie bei der Stundenwechsel-Route permissiv gelesen (fehlend ⇒
 * leere Zeichenkette) — ein fehlendes Token beantwortet bereits `verifyCorrectionPreviewToken`
 * mit 409/PREVIEW_STALE, eine fehlende Begründung der Service mit 400 (DD-22).
 */
function parseWorkPeriodCorrectionBody(body: unknown): WorkPeriodCorrectionRequestBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;

  if (typeof record.validFrom !== 'string' || record.validFrom.length === 0) {
    return null;
  }
  if (typeof record.weeklyHours !== 'number' || !Number.isFinite(record.weeklyHours)) {
    return null;
  }
  if (record.workSchedule !== null && record.workSchedule !== undefined && !isWorkSchedule(record.workSchedule)) {
    return null;
  }

  const reason = typeof record.reason === 'string' ? record.reason : '';
  const previewToken = typeof record.previewToken === 'string' ? record.previewToken : '';

  return {
    validFrom: record.validFrom,
    weeklyHours: record.weeklyHours,
    workSchedule:
      record.workSchedule === null || record.workSchedule === undefined
        ? null
        : (record.workSchedule as WorkSchedule),
    reason,
    previewToken,
  };
}

/**
 * DD-22: Anfragekörper der Lösch-Routen — es gibt keine Eingabewerte, die zu binden wären
 * (`periodId` kommt aus der Pfadangabe), nur Begründung und Vorschau-Token, beide permissiv
 * gelesen.
 */
interface WorkPeriodDeleteRequestBody {
  reason: string;
  previewToken: string;
}

function parseWorkPeriodDeleteBody(body: unknown): WorkPeriodDeleteRequestBody | null {
  if (typeof body !== 'object' || body === null) {
    return null;
  }
  const record = body as Record<string, unknown>;

  const reason = typeof record.reason === 'string' ? record.reason : '';
  const previewToken = typeof record.previewToken === 'string' ? record.previewToken : '';

  return { reason, previewToken };
}

/**
 * DD-22: liest die Pfadangabe `:id` über `Number.parseInt(req.params.id, 10)`. Liefert `null`
 * bei `Number.isNaN` — die aufrufende Route antwortet dann mit 400.
 */
function parsePeriodIdParam(raw: string): number | null {
  const periodId = Number.parseInt(raw, 10);
  return Number.isNaN(periodId) ? null : periodId;
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
  (req: Request, res: Response<ApiResponse<UserWorkPeriodListItem[]>>) => {
    try {
      const isAdmin = req.session.user!.role === 'admin';

      // WR-10: `req.query.userId` ist bei `?userId=1&userId=2` ein `string[]`. Der frühere
      // Cast `req.query.userId as string` warf dort nicht, sondern lieferte über die
      // implizite Konvertierung `"1,2"` das Ergebnis `1` — die Route verhielt sich bei
      // unerwarteter Eingabe still statt mit 400. Der Kopfkommentar dieser Datei behauptet
      // zudem, an keiner Stelle einen solchen Cast zu enthalten.
      const rawUserId: unknown = req.query.userId;
      if (rawUserId !== undefined && typeof rawUserId !== 'string') {
        res.status(400).json({ success: false, error: 'Invalid userId' });
        return;
      }

      const requestedUserId = rawUserId
        ? Number.parseInt(rawUserId, 10)
        : req.session.user!.id;

      if (Number.isNaN(requestedUserId)) {
        res.status(400).json({ success: false, error: 'Invalid userId' });
        return;
      }

      if (!isAdmin && requestedUserId !== req.session.user!.id) {
        res.status(403).json({ success: false, error: 'Forbidden' });
        return;
      }

      // DD-23: liefert isFirst/isCurrent bereits serverseitig berechnet mit — der Desktop
      // muss diese Flags nicht mehr selbst nachrechnen (Dual-Calculation-Risiko geschlossen).
      res.json({ success: true, data: getWorkPeriodsWithFlags(requestedUserId) });
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
  // WR-03/WR-06: Der Trockenlauf ist ein echter Schreib-Rebuild in einer exklusiven
  // SQLite-Schreibtransaktion, kein billiger Lesezugriff. Vor der Anmeldung zählt nur der
  // schmale Vor-Limiter; der eigentliche, nutzerbezogene Eimer hängt hinter requireAuth.
  workPeriodUnauthenticatedGuardLimiter,
  requireAuth,
  changePreviewLimiter,
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
        // WR-09: Das Token gilt nur für den Admin, der die Vorschau abgerufen hat.
        adminId: req.session.user!.id,
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
  changeWriteLimiter,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkTimeChangeOutcome>>) => {
    const parsed = parseWorkTimeChangeSaveRequestBody(req.body);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Missing or invalid fields' });
      return;
    }

    const verification = workTimeChangeTokenModule.verifyPreviewToken(parsed.previewToken, {
      // WR-09: Ein von einem anderen Admin ausgestelltes Token liefert hier `mismatch` —
      // der Speichernde muss die geprüfte Vorschau selbst gesehen haben.
      adminId: req.session.user!.id,
      userId: parsed.userId,
      validFrom: parsed.validFrom,
      weeklyHours: parsed.weeklyHours,
      workSchedule: parsed.workSchedule,
    });
    if (!verification.valid) {
      // WR-08: Die Antwort bleibt für alle drei Ablehnungsgründe bewusst EINHEITLICH (kein
      // Orakel für einen Angreifer), der Grund wird aber protokolliert. Ein `mismatch`
      // bedeutet: gültige Signatur, aber ANDERE Eingabewerte als in der geprüften Vorschau —
      // also entweder ein Client-Fehler oder ein gezielter Umgehungsversuch der geprüften
      // Berechnung. Bisher war das von einem schlichten Ablauf nicht unterscheidbar und
      // hinterließ keine Spur. Protokolliert werden ausschließlich IDs und der Grund — keine
      // Begründungstexte (T-12-26).
      logger.warn(
        {
          reason: verification.reason,
          userId: parsed.userId,
          adminId: req.session.user!.id,
          validFrom: parsed.validFrom,
        },
        'previewToken abgelehnt — Stundenwechsel nicht gespeichert'
      );
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

/**
 * POST /api/work-periods/:id/correct/preview
 * Berechnet die Vorschau einer Stammdaten-Korrektur — echter Dry-Run über `correctWorkPeriod`
 * (D2/DD-19, keine zweite Rechenbahn). Admin only (D6/T-13-23): die Vorschau legt Sollstunden
 * und Saldo eines fremden Nutzers offen. Die Drosselung ist nutzerbezogen und läuft hinter
 * `requireAuth`, aber VOR der Rollenprüfung (T-13-24, angepasst durch WR-06) — der Trockenlauf
 * ist ein echter Schreib-Rebuild in einer exklusiven Schreibtransaktion.
 *
 * Body: { validFrom, weeklyHours, workSchedule }. Die Begründung wird im Trockenlauf nicht
 * geprüft und ist auch nicht Teil des ausgestellten Tokens.
 */
router.post(
  '/:id/correct/preview',
  workPeriodUnauthenticatedGuardLimiter,
  requireAuth,
  correctPreviewLimiter,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkPeriodCorrectionPreviewResponse>>) => {
    const periodId = parsePeriodIdParam(req.params.id);
    if (periodId === null) {
      res.status(400).json({ success: false, error: 'Invalid periodId' });
      return;
    }

    const parsed = parseWorkPeriodCorrectionBody(req.body);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Missing or invalid fields' });
      return;
    }

    try {
      const outcome = correctWorkPeriod(
        {
          periodId,
          validFrom: parsed.validFrom,
          weeklyHours: parsed.weeklyHours,
          workSchedule: parsed.workSchedule,
          reason: '',
        },
        { dryRun: true, createdBy: req.session.user!.id }
      );

      const previewToken = workTimeChangeTokenModule.issueCorrectionPreviewToken({
        adminId: req.session.user!.id,
        periodId,
        validFrom: parsed.validFrom,
        weeklyHours: parsed.weeklyHours,
        workSchedule: parsed.workSchedule,
      });

      res.json({ success: true, data: { ...outcome.preview, previewToken } });
    } catch (error) {
      if (error instanceof WorkPeriodCorrectionValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WorkPeriodConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      logger.error({ err: error }, 'Failed to preview work period correction');
      res.status(500).json({ success: false, error: 'Failed to preview work period correction' });
    }
  }
);

/**
 * PUT /api/work-periods/:id
 * Speichert eine Stammdaten-Korrektur — verlangt ein zuvor über POST /:id/correct/preview
 * ausgestelltes, noch gültiges `previewToken` (D6/T-13-21). Ein fehlendes, abgelaufenes oder
 * zu anderen Werten ausgestelltes Token führt zu 409 mit demselben Fehlercode-Präfix wie
 * Phase 12 und schreibt NICHTS.
 *
 * Body: { validFrom, weeklyHours, workSchedule, reason, previewToken }.
 */
router.put(
  '/:id',
  requireAuth,
  correctWriteLimiter,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkPeriodCorrectionOutcome>>) => {
    const periodId = parsePeriodIdParam(req.params.id);
    if (periodId === null) {
      res.status(400).json({ success: false, error: 'Invalid periodId' });
      return;
    }

    const parsed = parseWorkPeriodCorrectionBody(req.body);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Missing or invalid fields' });
      return;
    }

    const verification = workTimeChangeTokenModule.verifyCorrectionPreviewToken(parsed.previewToken, {
      adminId: req.session.user!.id,
      periodId,
      validFrom: parsed.validFrom,
      weeklyHours: parsed.weeklyHours,
      workSchedule: parsed.workSchedule,
    });
    if (!verification.valid) {
      // WR-08/T-13-22-Muster: einheitliche Antwort für alle drei Ablehnungsgründe, der Grund
      // wird ausschließlich protokolliert — keine Begründungstexte, keine Namen (T-13-25).
      logger.warn(
        {
          reason: verification.reason,
          periodId,
          adminId: req.session.user!.id,
          validFrom: parsed.validFrom,
        },
        'previewToken abgelehnt — Korrektur nicht gespeichert'
      );
      res.status(409).json({
        success: false,
        error: 'PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell.',
      });
      return;
    }

    try {
      const outcome = correctWorkPeriod(
        {
          periodId,
          validFrom: parsed.validFrom,
          weeklyHours: parsed.weeklyHours,
          workSchedule: parsed.workSchedule,
          reason: parsed.reason,
        },
        { dryRun: false, createdBy: req.session.user!.id }
      );

      // T-13-25: ausschließlich Zahlen und Datumsangaben — keine Namen, keine Begründung.
      logger.info(
        {
          periodId,
          validFrom: parsed.validFrom,
          balanceDelta: outcome.preview.balanceDelta,
          adminId: req.session.user!.id,
        },
        'Stammdaten-Korrektur gespeichert'
      );

      res.json({ success: true, data: outcome });
    } catch (error) {
      if (error instanceof WorkPeriodCorrectionValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WorkPeriodConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      logger.error({ err: error }, 'Failed to save work period correction');
      res.status(500).json({ success: false, error: 'Failed to save work period correction' });
    }
  }
);

/**
 * POST /api/work-periods/:id/delete/preview
 * Berechnet die Vorschau einer Löschung — echter Dry-Run über `deleteWorkPeriod`. Admin only
 * (D6/T-13-23). Die Drosselung ist nutzerbezogen und haengt hinter `requireAuth` (WR-06).
 *
 * Kein Anfragekörper mit Rechenfeldern nötig — die Löschung hat keine Eingabewerte außer der
 * (im Trockenlauf nicht geprüften) Begründung.
 */
router.post(
  '/:id/delete/preview',
  workPeriodUnauthenticatedGuardLimiter,
  requireAuth,
  deletePreviewLimiter,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkPeriodDeletionPreviewResponse>>) => {
    const periodId = parsePeriodIdParam(req.params.id);
    if (periodId === null) {
      res.status(400).json({ success: false, error: 'Invalid periodId' });
      return;
    }

    try {
      const outcome = deleteWorkPeriod(
        { periodId, reason: '' },
        { dryRun: true, createdBy: req.session.user!.id }
      );

      const previewToken = workTimeChangeTokenModule.issueDeletionPreviewToken({
        adminId: req.session.user!.id,
        periodId,
      });

      res.json({ success: true, data: { ...outcome.preview, previewToken } });
    } catch (error) {
      if (error instanceof WorkPeriodDeletionValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WorkPeriodConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      logger.error({ err: error }, 'Failed to preview work period deletion');
      res.status(500).json({ success: false, error: 'Failed to preview work period deletion' });
    }
  }
);

/**
 * DELETE /api/work-periods/:id
 * Löscht (soft) eine Periode und storniert ihre model_change-Buchungen — verlangt ein zuvor
 * über POST /:id/delete/preview ausgestelltes, noch gültiges `previewToken` (D6/T-13-21). Ein
 * fehlendes, abgelaufenes oder zu einer anderen Periode ausgestelltes Token führt zu 409 und
 * schreibt NICHTS.
 *
 * Body: { reason, previewToken }.
 */
router.delete(
  '/:id',
  requireAuth,
  deleteWriteLimiter,
  requireAdmin,
  (req: Request, res: Response<ApiResponse<WorkPeriodDeletionOutcome>>) => {
    const periodId = parsePeriodIdParam(req.params.id);
    if (periodId === null) {
      res.status(400).json({ success: false, error: 'Invalid periodId' });
      return;
    }

    const parsed = parseWorkPeriodDeleteBody(req.body);
    if (!parsed) {
      res.status(400).json({ success: false, error: 'Missing or invalid fields' });
      return;
    }

    const verification = workTimeChangeTokenModule.verifyDeletionPreviewToken(parsed.previewToken, {
      adminId: req.session.user!.id,
      periodId,
    });
    if (!verification.valid) {
      logger.warn(
        {
          reason: verification.reason,
          periodId,
          adminId: req.session.user!.id,
        },
        'previewToken abgelehnt — Löschung nicht gespeichert'
      );
      res.status(409).json({
        success: false,
        error: 'PREVIEW_STALE: Die Vorschau ist nicht mehr aktuell.',
      });
      return;
    }

    try {
      const outcome = deleteWorkPeriod(
        { periodId, reason: parsed.reason },
        { dryRun: false, createdBy: req.session.user!.id }
      );

      logger.info(
        {
          periodId,
          balanceDelta: outcome.preview.balanceDelta,
          reversalCount: outcome.reversalTransactionIds.length,
          adminId: req.session.user!.id,
        },
        'Periode gelöscht'
      );

      res.json({ success: true, data: outcome });
    } catch (error) {
      if (error instanceof WorkPeriodDeletionValidationError) {
        res.status(400).json({ success: false, error: error.message });
        return;
      }
      if (error instanceof WorkPeriodConflictError) {
        res.status(409).json({ success: false, error: error.message });
        return;
      }
      logger.error({ err: error }, 'Failed to delete work period');
      res.status(500).json({ success: false, error: 'Failed to delete work period' });
    }
  }
);

export default router;
