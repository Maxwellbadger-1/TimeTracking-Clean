import rateLimit, { ipKeyGenerator } from 'express-rate-limit';

const isDevelopment = process.env.NODE_ENV !== 'production';

/**
 * General API rate limit: 600 requests per minute (Enterprise Standard)
 * DEVELOPMENT: 10,000/min for testing (no throttling)
 */
export const apiLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 minute
  max: isDevelopment ? 10000 : 600,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for health check
    return req.path === '/api/health';
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests. Please try again later.',
      retryAfter: 60, // 1 minute
      limit: isDevelopment ? 10000 : 600,
      window: '1 minute',
      message: 'Rate limit exceeded. Your request has been throttled for fair usage.'
    });
  },
});

/**
 * Strict rate limit for login endpoint: 20 attempts per hour (Brute-force Protection)
 * DEVELOPMENT: 1000/hour for testing (allows hundreds of test logins)
 */
export const loginLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 1000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts. Please try again later.',
      retryAfter: 3600, // 1 hour
      limit: isDevelopment ? 1000 : 20,
      window: '1 hour',
      message: 'Account temporarily locked due to too many failed login attempts.'
    });
  },
});

/**
 * Drosselung der Perioden-Endpunkte (WR-03 Phase 12, überarbeitet nach WR-06 Phase 13).
 *
 * WARUM EIGENE LIMITER: Weder die Vorschau noch das Speichern einer Periode ist ein
 * gewöhnlicher Lesezugriff. Der Trockenlauf führt einen ECHTEN Schreib-Rebuild aus (D2:
 * dieselbe Codebahn wie das Speichern, am Ende zurückgerollt) — jeder betroffene Monat wird
 * zweimal vollständig neu aufgebaut, mit DELETE und Tages-INSERTs, alles in einer einzigen
 * Schreibtransaktion, die better-sqlite3 als exklusive Sperre hält. Der allgemeine
 * `apiLimiter` (600/min) ist dafür um Größenordnungen zu weit.
 *
 * WAS WR-06 KORRIGIERT HAT — drei Punkte, die zusammen ein Bedienproblem ergaben:
 *
 * 1. EIN Eimer für DREI Vorschau-Routen. Jetzt hat jede Route ihren eigenen Eimer
 *    (`createWorkPeriodPreviewLimiter()` legt je Aufruf eine eigene Instanz mit eigenem
 *    Speicher an) — eine intensiv bediente Korrekturvorschau sperrt nicht mehr die Löschung.
 * 2. SCHLÜSSEL = IP, gezählt VOR `requireAuth`. Zwei Admins hinter derselben NAT-Adresse
 *    (Regelfall in einer Stiftung) teilten sich einen Eimer, und unauthentifizierte
 *    Anfragen zählten mit. Jetzt ist der Schlüssel die Sitzungs-/Admin-Id (Einhängung NACH
 *    `requireAuth`); ein schmaler Vor-Limiter deckt nur noch die unauthentifizierte Last ab.
 * 3. ZU ENGES LIMIT. Der Korrektur-Dialog löst bei jeder Feldänderung eine entprellte
 *    Vorschau aus; ein Durchgang durch die sieben Tagesfelder plus Wochenstunden plus Datum
 *    erreicht ohne Weiteres 10-15 Anfragen. Bei 429 blieb `preview` null und „Korrektur
 *    speichern" war bis zum Ablauf des Fensters gesperrt. Jetzt 120/min je Nutzer und Route.
 *
 * Zusätzlich tragen die drei SCHREIBpfade (`PUT /:id`, `DELETE /:id`, `POST /change`) jetzt
 * überhaupt einen Limiter — sie führen denselben doppelten Rebuild aus wie die Vorschau, plus
 * die Schreibvorgänge, und waren bislang ungedrosselt.
 *
 * DEVELOPMENT: 10.000/min (kein Drosseln beim Testen), wie bei den übrigen Limitern.
 */

/** Schlüssel eines nutzerbezogenen Limiters: die Id der angemeldeten Sitzung. Der
 *  IPv6-sichere `ipKeyGenerator()` ist der Rückfall für den (durch die Einhängung nach
 *  `requireAuth` eigentlich unerreichbaren) Fall ohne Sitzung. */
function sessionUserKey(req: { session?: { user?: { id: number } }; ip?: string }): string {
  const userId = req.session?.user?.id;
  if (typeof userId === 'number') return `u:${userId}`;
  return `ip:${ipKeyGenerator(req.ip ?? '')}`;
}

/**
 * Vor-Limiter gegen unauthentifizierte Last auf den Vorschau-Routen: eng, IP-basiert, und
 * BEWUSST mit `skip` für angemeldete Sitzungen — eine angemeldete Anfrage zählt
 * ausschließlich im nutzerbezogenen Limiter dahinter, nie in beiden.
 */
export const workPeriodUnauthenticatedGuardLimiter = rateLimit({
  windowMs: 1 * 60 * 1000,
  max: isDevelopment ? 10000 : 20,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skip: (req) => Boolean(req.session?.user),
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Zu viele Anfragen. Bitte melden Sie sich an und versuchen Sie es erneut.',
      retryAfter: 60,
      limit: isDevelopment ? 10000 : 20,
      window: '1 minute',
    });
  },
});

/**
 * Legt einen EIGENEN Eimer für genau eine Vorschau-Route an (getrennter Speicher je
 * Instanz). Schlüssel ist die Sitzung, nicht die IP — deshalb NACH `requireAuth` einhängen.
 */
export function createWorkPeriodPreviewLimiter() {
  return rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isDevelopment ? 10000 : 120,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: sessionUserKey,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: 'Zu viele Vorschau-Berechnungen. Bitte warten Sie einen Moment.',
        retryAfter: 60,
        limit: isDevelopment ? 10000 : 120,
        window: '1 minute',
      });
    },
  });
}

/**
 * Legt einen EIGENEN, engeren Eimer für genau einen Schreibpfad an. Ein Speichern ist eine
 * bewusste Einzelhandlung eines Menschen — 30/min je Nutzer ist dafür reichlich und begrenzt
 * zugleich, was eine Admin-Sitzung an exklusiven Schreibtransaktionen auslösen kann.
 */
export function createWorkPeriodWriteLimiter() {
  return rateLimit({
    windowMs: 1 * 60 * 1000,
    max: isDevelopment ? 10000 : 30,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
    keyGenerator: sessionUserKey,
    handler: (_req, res) => {
      res.status(429).json({
        success: false,
        error: 'Zu viele Speichervorgänge. Bitte warten Sie einen Moment.',
        retryAfter: 60,
        limit: isDevelopment ? 10000 : 30,
        window: '1 minute',
      });
    },
  });
}

/**
 * Rate limit for absence creation: 30 per hour (DoS Protection)
 * Prevents database spam from malicious actors while allowing legitimate use
 * DEVELOPMENT: 1000/hour for testing
 */
export const absenceCreationLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: isDevelopment ? 1000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  skipSuccessfulRequests: false, // Count all attempts to prevent abuse
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many absence requests. Please try again later.',
      retryAfter: 3600, // 1 hour
      limit: isDevelopment ? 1000 : 30,
      window: '1 hour',
      message: 'Rate limit exceeded for absence creation. Please wait before creating more requests.'
    });
  },
});
