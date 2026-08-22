import rateLimit from 'express-rate-limit';

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
 * Rate limit für die Stundenwechsel-Vorschau: 30 Anfragen pro Minute (WR-03, Phase 12).
 *
 * WARUM EIGEN: `POST /api/work-periods/preview` ist kein gewöhnlicher Lese-Endpunkt. Der
 * Trockenlauf führt einen ECHTEN Schreib-Rebuild aus (D2: dieselbe Codebahn wie das
 * Speichern, am Ende zurückgerollt) — jeder betroffene Monat wird zweimal vollständig neu
 * aufgebaut, mit DELETE und Tages-INSERTs, und das alles innerhalb einer einzigen
 * Schreibtransaktion, die better-sqlite3 als exklusive Sperre hält. Für die Dauer blockiert
 * jeder andere Schreibvorgang des Servers. Der allgemeine `apiLimiter` (600/min) ist dafür
 * um Größenordnungen zu weit.
 *
 * DEVELOPMENT: 10.000/min (kein Drosseln beim Testen), wie bei den übrigen Limitern.
 */
export const workTimeChangePreviewLimiter = rateLimit({
  windowMs: 1 * 60 * 1000, // 1 Minute
  max: isDevelopment ? 10000 : 30,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Zu viele Vorschau-Berechnungen. Bitte warten Sie einen Moment.',
      retryAfter: 60,
      limit: isDevelopment ? 10000 : 30,
      window: '1 minute',
    });
  },
});

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
