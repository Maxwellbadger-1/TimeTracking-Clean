// TimeTracking Server
import express from 'express';
import cors from 'cors';
import session from 'express-session';
import helmet from 'helmet';
import logger from './utils/logger.js';
import { apiLimiter, loginLimiter } from './middleware/rateLimits.js';
import './database/connection.js'; // Initialize database
import { seedDatabase } from './database/seed.js';
import { runMigrations } from './database/migrationRunner.js';
import { resetStaleChainGuardSuspension } from './services/workPeriodService.js';
import { db, shutdownDatabase } from './database/connection.js';
import authRoutes from './routes/auth.js';
import usersRoutes from './routes/users.js';
import departmentsRoutes from './routes/departments.js';
import projectsRoutes from './routes/projects.js';
import timeEntriesRoutes from './routes/timeEntries.js';
import absencesRoutes from './routes/absences.js';
import notificationsRoutes from './routes/notifications.js';
import holidaysRoutes from './routes/holidays.js';
import overtimeRoutes from './routes/overtime.js';
import vacationBalanceRoutes from './routes/vacationBalance.js';
import vacationTransactionRoutes from './routes/vacationTransactions.js';
import workTimeAccountsRoutes from './routes/workTimeAccounts.js';
import workPeriodsRoutes from './routes/workPeriods.js';
import reportsRoutes from './routes/reports.js';
import backupRoutes from './routes/backup.js';
import settingsRoutes from './routes/settings.js';
import exportsRoutes from './routes/exports.js';
import performanceRoutes from './routes/performance.js';
import yearEndRolloverRoutes from './routes/yearEndRollover.js';
// WR-02 (Code-Review Phase 11, Durchlauf 2): Aufrufer fuer checkAllPeriodChains().
import adminRoutes from './routes/admin.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { performanceMonitor } from './middleware/performanceMonitor.js';
import { startBackupScheduler, startYearEndRolloverScheduler, startOvertimeRecalcScheduler } from './services/cronService.js';
import { runOvertimeRecalcForAllUsers } from './services/overtimeRecalcRunner.js';
import { initializeHolidays, autoUpdateHolidays } from './services/holidayService.js';
import { initializeWebSocket } from './websocket/server.js';
import cron from 'node-cron';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

// CI/CD Pipeline Active - GitHub Actions enabled
// SSH Key uploaded via GitHub CLI

// Security: Helmet - HTTP Security Headers
// Protects against: XSS, clickjacking, MIME sniffing, etc.
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles for Tailwind
      scriptSrc: ["'self'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"],
    },
  },
  crossOriginEmbedderPolicy: false, // Allow Tauri app to embed
  crossOriginResourcePolicy: { policy: "cross-origin" }, // Allow cross-origin requests from Tauri
}));

// Security: Enforce SESSION_SECRET in production
const SESSION_SECRET = process.env.SESSION_SECRET;
if (!SESSION_SECRET && process.env.NODE_ENV === 'production') {
  logger.error('❌ SESSION_SECRET environment variable must be set in production');
  process.exit(1);
}
const sessionSecret = SESSION_SECRET || 'dev-secret-only-for-development';

// Middleware
// CRITICAL: CORS configuration for Tauri app + Vite dev server + Remote connections
// Different ports = cross-origin = cookies need explicit configuration
const isDevelopment = process.env.NODE_ENV !== 'production';
const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',').map(o => o.trim()) || [
  'tauri://localhost',
  'https://tauri.localhost',
  'http://tauri.localhost',  // Tauri HTTP origin (Windows/Linux)
];

app.use(cors({
  origin: isDevelopment
    ? [
        // Development: Strict origin list
        'tauri://localhost',
        'https://tauri.localhost',
        'http://tauri.localhost',   // Tauri HTTP origin (Windows uses this!)
        'http://localhost:5173',  // Vite default
        'http://localhost:1420',  // Vite dev server (actual)
        'http://127.0.0.1:1420',  // Alternative IP
      ]
    : [
        // Production: Desktop App origins + any from .env
        'tauri://localhost',
        'https://tauri.localhost',
        'http://localhost:1420',
        'http://127.0.0.1:1420',
        ...allowedOrigins, // Additional origins from ALLOWED_ORIGINS env var
      ],
  credentials: true, // MUST be true for cookies to work
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'Cookie'],
  exposedHeaders: ['Set-Cookie'],
}));
app.use(express.json());

// Session middleware
// CRITICAL: Cookie configuration for cross-origin (localhost:3000 <-> localhost:1420)
// IMPORTANT: Different ports on localhost are SAME-SITE but still CROSS-ORIGIN
// SameSite=Lax BLOCKS cookies on POST cross-origin requests!
// Solution: SameSite=None (but requires Secure=true which needs HTTPS)
// Workaround for dev: Set sameSite=none + secure=false (works in some browsers for localhost)
app.use(
  session({
    secret: sessionSecret,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      // Security: secure cookies in production (HTTPS required)
      secure: !isDevelopment,
      // Security: strict sameSite in production (CSRF protection)
      sameSite: isDevelopment ? 'none' : 'strict',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Available on all paths
    },
    name: 'connect.sid', // Default name (explicit for clarity)
  })
);

// ========================================
// RATE LIMITING - Enterprise Best Practices
// ========================================
// Based on industry standards (GitHub, Stripe, Zendesk):
// - GitHub: 60 requests/minute (unauthenticated), 5000/hour (authenticated)
// - Stripe: 25 requests/second = 1500/minute
// - Zendesk: 100 requests/minute per user
// - Okta: 600 requests/minute for auth
//
// Our limits (for ~10-50 users):
// - General API: 600 requests/minute (enterprise standard)
// - Login: 20 attempts/hour (security)
// - Uses Sliding Window for fairness
// ========================================

// Rate limiters imported from middleware/rateLimits.ts

// Apply rate limiters
app.use('/api/', apiLimiter); // General API rate limit
app.use('/api/auth/login', loginLimiter); // Strict login rate limit

// Performance monitoring middleware (after rate limiting, before routes)
app.use(performanceMonitor);

// Health check endpoint
app.get('/api/health', (_req, res) => {
  res.json({
    status: 'ok',
    message: 'TimeTracking Server is running',
    version: '0.1.0',
    timestamp: new Date().toISOString(),
  });
});

// Test endpoint for desktop app
app.get('/api/test', (_req, res) => {
  res.json({
    success: true,
    message: 'Server connection successful!',
    data: {
      serverTime: new Date().toISOString(),
      nodeVersion: process.version,
    },
  });
});

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/users', usersRoutes);
app.use('/api/departments', departmentsRoutes);
app.use('/api/projects', projectsRoutes);
app.use('/api/time-entries', timeEntriesRoutes);
app.use('/api/absences', absencesRoutes);
app.use('/api/notifications', notificationsRoutes);
app.use('/api/holidays', holidaysRoutes);
app.use('/api/overtime', overtimeRoutes);
app.use('/api/vacation-balances', vacationBalanceRoutes);
app.use('/api/vacation-balance', vacationBalanceRoutes); // Singular alias for compatibility
app.use('/api/vacation-transactions', vacationTransactionRoutes);
app.use('/api/work-time-accounts', workTimeAccountsRoutes);
app.use('/api/work-periods', workPeriodsRoutes);
app.use('/api/reports', reportsRoutes);
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/exports', exportsRoutes);
app.use('/api/performance', performanceRoutes);
app.use('/api/year-end-rollover', yearEndRolloverRoutes);
app.use('/api/admin', adminRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Seed database and start server
async function startServer() {
  try {
    await seedDatabase();

    // Run database migrations (auto-backfill transaction history)
    await runMigrations(db);

    // B-2 (Sicherheitspruefung Phase 13): Haengengebliebenen Kettenriegel zuruecksetzen.
    //
    // NACH runMigrations(), nicht davor: Die Steuertabelle work_period_chain_guard entsteht
    // erst in Migration 013. Auf einer Bestandsdatenbank, die noch nicht dort ist, gaebe ein
    // Zugriff davor einen "no such table"-Fehler und der Server startete gar nicht mehr.
    // Nach dem Migrationslauf ist die Tabelle in jedem Fall da (Migration 013 legt sie an,
    // initializeDatabase() haelt die Paritaet fuer Neuinstallationen).
    //
    // VOR app.listen(): Solange suspended auf 1 steht, pruefen die vier aussetzbaren
    // Trigger-Klauseln aus Migration 013 nichts. Kein HTTP-Request darf in dieses Fenster
    // fallen.
    resetStaleChainGuardSuspension();

    // Initialize holidays (fetch from API)
    await initializeHolidays();

    // Start automated backup scheduler
    startBackupScheduler();

    // Start year-end rollover scheduler (January 1st at 00:05 AM Europe/Berlin)
    startYearEndRolloverScheduler();

    // Start overtime recalculation scheduler (WR-05, D-01, D-02) - daily at 03:15 AM
    // Europe/Berlin, im Serverprozess ueber die geteilte Verbindung statt als eigener
    // Prozess (Begruendung im Kopfkommentar der Startfunktion in cronService.ts).
    startOvertimeRecalcScheduler();
    logger.info('🔄 Overtime recalc scheduler scheduled (daily at 03:15 AM Europe/Berlin)');

    // Schedule daily holiday auto-update (03:00 AM Europe/Berlin)
    // Ensures we always have coverage for future years and historical data
    cron.schedule('0 3 * * *', async () => {
      logger.info('⏰ Running scheduled holiday auto-update');
      await autoUpdateHolidays();
    }, {
      timezone: 'Europe/Berlin'
    });

    logger.info('📅 Holiday auto-update scheduled (daily at 03:00 AM Europe/Berlin)');

    const httpServer = app.listen(PORT, '0.0.0.0', () => {
      logger.info('✅ TimeTracking Server started');
      logger.info(`📡 Listening on http://0.0.0.0:${PORT}`);
      logger.info(`🏥 Health check: http://0.0.0.0:${PORT}/api/health`);
      logger.info(`🔐 Auth endpoints: http://0.0.0.0:${PORT}/api/auth`);
      logger.info(`💾 Backup endpoints: http://0.0.0.0:${PORT}/api/backup`);
    });

    // Initialize WebSocket server
    initializeWebSocket(httpServer);
    logger.info(`🔌 WebSocket endpoint: ws://0.0.0.0:${PORT}/ws`);

    // ========================================
    // Einmaliger Überstunden-Neuberechnungslauf nach Serverstart (WR-05, D-04)
    // ========================================
    // MUSS nach runMigrations(db) liegen: Die TypeScript-Migrationen 008-015 laufen NICHT in
    // `npm run migrate:prod` (das filtert auf `.sql`), sondern erst hier im Serverprozess;
    // `user_work_periods` entsteht erst durch Migration 008/009, und
    // `ensureOvertimeBalanceEntries()` löst darüber auf (übernommen aus
    // `.github/workflows/deploy-server.yml`, Begründungsblock vor dem alten Post-Deploy-Aufruf).
    //
    // Läuft NICHT blockierend vor `app.listen()`, sondern nachgelagert wie
    // `initializeHolidays()` - kein `await` hier, damit der Health-Check des Deployments nicht
    // auf ihn wartet. `.catch()` fängt eine unbehandelte Ablehnung ab, die sonst den
    // Serverprozess beenden würde (T-09.1-18).
    //
    // Ersetzt die beiden Workflow-Aufrufe `deploy-server.yml:206` und
    // `deploy-staging.yml:111`, die in Plan 09.1-05 entfallen. Läuft bei JEDEM Serverstart,
    // nicht nur bei einem Deployment - unschädlich, weil `ensureOvertimeBalanceEntries()`
    // idempotent ist (zugesichert in `overtimeService.test.ts`, Plan 09.1-02).
    runOvertimeRecalcForAllUsers({ anlass: 'serverstart' }).catch((err) => {
      logger.error({ err }, '❌ Überstunden-Neuberechnungslauf nach Serverstart fehlgeschlagen');
    });

    // ========================================
    // Kontrolliertes Herunterfahren
    // ========================================
    // Bis 27.08.2026 gab es hier keinen Signalbehandler: PM2 schickte SIGINT, der Prozess
    // starb ohne db.close(). Im Regelfall harmlos - die WAL bleibt liegen und wird beim
    // naechsten Start eingelesen. War die WAL aber vom Dateisystem abgehaengt, ging der
    // Stand mit dem Prozess verloren. Vorfall: .planning/debug/wal-abgehaengt-20260827.md
    //
    // Reihenfolge ist bewusst gewaehlt: Der Pruefpunkt laeuft SOFORT, nicht erst im
    // close()-Rueckruf. PM2 raeumt nach `kill_timeout` (Standard 1600 ms) mit SIGKILL auf,
    // und offene WebSocket-Verbindungen koennen httpServer.close() beliebig lange
    // hinhalten. Das Wichtigste - der Pruefpunkt - darf davon nicht abhaengen.
    let shutdownInProgress = false;

    const shutdown = (signal: NodeJS.Signals) => {
      if (shutdownInProgress) {
        return;
      }
      shutdownInProgress = true;
      logger.info({ signal }, '🛑 Herunterfahren eingeleitet');

      // 1. Keine neuen Verbindungen mehr annehmen (blockiert nicht).
      httpServer.close(() => {
        logger.info('🔌 HTTP-Server geschlossen');
      });

      // 2. Pruefpunkt setzen und Datenbank schliessen - sofort, wenige Millisekunden.
      shutdownDatabase();

      // 3. Beenden. Der Timer ist ent-referenziert: haelt nichts mehr den Ereignisring
      //    offen, endet der Prozess von selbst. Halten offene WebSocket-Verbindungen ihn
      //    fest, greift nach 500 ms der harte Ausstieg - immer noch weit unter PM2s
      //    kill_timeout von 1600 ms. Die Datenbank ist zu diesem Zeitpunkt bereits sicher.
      logger.info('👋 Server beendet');
      setTimeout(() => process.exit(0), 500).unref();
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));
    logger.info('🛡️  Signalbehandlung aktiv (SIGTERM/SIGINT) - WAL-Pruefpunkt beim Beenden');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

startServer();
// Deployment attempt #3
// Deployment attempt #4
// Deployment attempt #5
