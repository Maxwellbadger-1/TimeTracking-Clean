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
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js';

const app = express();
const PORT = process.env.PORT || 3000;
const SESSION_SECRET = process.env.SESSION_SECRET || 'dev-secret-change-in-production';

// Middleware
app.use(cors({
  origin: ['tauri://localhost', 'http://localhost:5173', 'http://localhost:1420'],
  credentials: true,
}));
app.use(express.json());

// Session middleware
app.use(
  session({
    secret: SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 24 * 60 * 60 * 1000, // 24 hours
    },
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

// 404 handler (must be after all routes)
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Seed database and start server
async function startServer() {
  try {
    await seedDatabase();

    app.listen(PORT, () => {
      console.log('✅ TimeTracking Server started');
      console.log(`📡 Listening on http://localhost:${PORT}`);
      console.log(`🏥 Health check: http://localhost:${PORT}/api/health`);
      console.log(`🔐 Auth endpoints: http://localhost:${PORT}/api/auth`);
    });
  } catch (error) {
    console.error('❌ Failed to start server:', error);
    process.exit(1);
  }
}

startServer();
