import express from 'express';
import cors from 'cors';
import session from 'express-session';
import rateLimit from 'express-rate-limit';
import helmet from 'helmet';
import logger from './utils/logger.js';
import './database/connection.js'; // Initialize database
import { seedDatabase } from './database/seed.js';
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
import backupRoutes from './routes/backup.js';
import settingsRoutes from './routes/settings.js';
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';
import { startBackupScheduler } from './services/cronService.js';
import { initializeHolidays } from './services/holidayService.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3000', 10);

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
];

app.use(cors({
  origin: isDevelopment
    ? [
        // Development: Strict origin list
        'tauri://localhost',
        'https://tauri.localhost',
        'http://localhost:5173',  // Vite default
        'http://localhost:1420',  // Vite dev server (actual)
        'http://127.0.0.1:1420',  // Alternative IP
      ]
    : allowedOrigins, // Production: Only explicitly allowed origins
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

// Rate Limiting (CRITICAL: DoS & Brute-force Protection)
// General API rate limit: 1000 requests per 15 minutes (increased for multi-user production)
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Max 1000 requests per windowMs (10 users x 100 requests each)
  message: JSON.stringify({
    success: false,
    error: 'Too many requests from this IP, please try again later.',
    retryAfter: 900 // seconds
  }),
  standardHeaders: true, // Return rate limit info in `RateLimit-*` headers
  legacyHeaders: false, // Disable `X-RateLimit-*` headers
  skip: (req) => {
    // Skip rate limiting for health check endpoint
    return req.path === '/api/health';
  },
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many requests from this IP, please try again later.',
      retryAfter: 900 // 15 minutes in seconds
    });
  },
});

// Strict rate limit for login endpoint: 10 attempts per 15 minutes (increased for testing)
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 10, // Max 10 login attempts per windowMs
  message: JSON.stringify({
    success: false,
    error: 'Too many login attempts from this IP, please try again after 15 minutes.',
    retryAfter: 900
  }),
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful logins
  handler: (_req, res) => {
    res.status(429).json({
      success: false,
      error: 'Too many login attempts from this IP, please try again later.',
      retryAfter: 900 // 15 minutes in seconds
    });
  },
});

// Apply rate limiters
app.use('/api/', apiLimiter); // General API rate limit
app.use('/api/auth/login', loginLimiter); // Strict login rate limit

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
app.use('/api/backup', backupRoutes);
app.use('/api/settings', settingsRoutes);

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Seed database and start server
async function startServer() {
  try {
    await seedDatabase();

    // Initialize holidays (fetch from API)
    await initializeHolidays();

    // Start automated backup scheduler
    startBackupScheduler();

    app.listen(PORT, '0.0.0.0', () => {
      logger.info('✅ TimeTracking Server started');
      logger.info(`📡 Listening on http://0.0.0.0:${PORT}`);
      logger.info(`🏥 Health check: http://0.0.0.0:${PORT}/api/health`);
      logger.info(`🔐 Auth endpoints: http://0.0.0.0:${PORT}/api/auth`);
      logger.info(`💾 Backup endpoints: http://0.0.0.0:${PORT}/api/backup`);
    });
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to start server');
    process.exit(1);
  }
}

startServer();
