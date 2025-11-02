import express from 'express';
import cors from 'cors';
import session from 'express-session';
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
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// Middleware
// CRITICAL: CORS configuration for Tauri app + Vite dev server + Remote connections
// Different ports = cross-origin = cookies need explicit configuration
app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? true  // Production: Allow all origins (Desktop apps can come from anywhere)
    : [
        // Development: Strict origin list
        'tauri://localhost',
        'https://tauri.localhost',
        'http://localhost:5173',  // Vite default
        'http://localhost:1420',  // Vite dev server (actual)
        'http://127.0.0.1:1420',  // Alternative IP
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
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: false, // MUST be false for http://localhost (dev mode)
      sameSite: 'none', // CRITICAL: 'none' allows cookies on POST cross-origin
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
      path: '/', // Available on all paths
    },
    name: 'connect.sid', // Default name (explicit for clarity)
  })
);

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

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Seed database and start server
async function startServer() {
  try {
    await seedDatabase();

    app.listen(PORT, '0.0.0.0', () => {
      console.log('✅ TimeTracking Server started');
      console.log(`📡 Listening on http://0.0.0.0:${PORT}`);
      console.log(`🏥 Health check: http://0.0.0.0:${PORT}/api/health`);
      console.log(`🔐 Auth endpoints: http://0.0.0.0:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
