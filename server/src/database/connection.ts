import Database from 'better-sqlite3';
import { dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initializeDatabase } from './schema.js';
import { createIndexes, verifyIndexes } from './indexes.js';
import logger from '../utils/logger.js';
import { databaseConfig } from '../config/database.js';

// Get database path based on NODE_ENV (development or production)
const DB_PATH = databaseConfig.path;
const env = process.env.NODE_ENV || 'development';

// Ensure database directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

logger.info({ path: DB_PATH, environment: env }, '📁 Database path');

// Store database instance in a wrapper object
// This allows hot-swapping while preserving the reference
const dbWrapper: { instance: Database.Database | null } = {
  instance: null,
};

/**
 * Initialize database connection
 */
function initializeConnection(): Database.Database {
  const database = new Database(DB_PATH, {
    verbose: process.env.NODE_ENV === 'development'
      ? (message?: unknown, ...additionalArgs: unknown[]) => logger.debug({ message, additionalArgs }, 'Database query')
      : undefined,
  });

  // Initialize schema
  initializeDatabase(database);

  // Create performance indexes
  createIndexes(database);

  // Verify indexes were created successfully
  verifyIndexes(database);

  return database;
}

// Initialize database connection
dbWrapper.instance = initializeConnection();

/**
 * Hot-swap database (close old connection, open new one)
 * Used for backup restore without server restart
 */
export function reconnectDatabase(): void {
  try {
    logger.info('🔄 Reconnecting to database...');

    // Close old connection
    if (dbWrapper.instance) {
      dbWrapper.instance.close();
      logger.info('✅ Old database connection closed');
    }

    // Open new connection and update the wrapper
    dbWrapper.instance = initializeConnection();
    logger.info('✅ New database connection established');
  } catch (error) {
    logger.error({ err: error }, '❌ Failed to reconnect database');
    throw error;
  }
}

/**
 * Get current database instance
 * ALWAYS use this function instead of importing db directly!
 * This ensures you get the current connection after hot-swap
 */
export function getDatabase(): Database.Database {
  if (!dbWrapper.instance) {
    throw new Error('Database not initialized');
  }
  return dbWrapper.instance;
}

// Create a Proxy that always returns the current database instance
// This allows existing code that uses "db.prepare()" to work after hot-swap
const dbProxy = new Proxy({} as Database.Database, {
  get(_target, prop) {
    if (!dbWrapper.instance) {
      throw new Error('Database not initialized');
    }
    const value = (dbWrapper.instance as any)[prop];
    // Bind methods to the current instance
    if (typeof value === 'function') {
      return value.bind(dbWrapper.instance);
    }
    return value;
  },
  set(_target, prop, value) {
    if (!dbWrapper.instance) {
      throw new Error('Database not initialized');
    }
    (dbWrapper.instance as any)[prop] = value;
    return true;
  },
});

// Export the proxy as db - this will work even after hot-swap!
export { dbProxy as db };
export default dbProxy;
