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

// Gesetzt, sobald shutdownDatabase() gelaufen ist. Unterbindet den automatischen
// Reconnect im Proxy weiter unten - sonst wuerde ein noch feuernder Cron-Job die
// gerade geschlossene Datenbank waehrend des Herunterfahrens wieder oeffnen.
let isShuttingDown = false;

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
 * Faehrt die Datenbank kontrolliert herunter: erst WAL-Pruefpunkt, dann schliessen.
 *
 * Warum der Pruefpunkt: Ohne ihn bleibt alles seit dem letzten automatischen Pruefpunkt
 * in der WAL stehen. Im Regelfall ist das unkritisch - SQLite liest die WAL beim naechsten
 * Start ein. Ist die WAL aber vom Dateisystem abgehaengt (geloescht, waehrend der Prozess
 * sie ueber einen offenen Dateizeiger haelt), verschwindet sie mit dem Prozess und der
 * Stand ist verloren. Vorfall: .planning/debug/wal-abgehaengt-20260827.md
 *
 * Mehrfachaufrufe sind unschaedlich (idempotent).
 */
export function shutdownDatabase(): void {
  if (isShuttingDown) {
    return;
  }
  isShuttingDown = true;

  const database = dbWrapper.instance;
  if (!database) {
    return;
  }

  try {
    // better-sqlite3 wirft hier NICHT, wenn der Pruefpunkt blockiert ist - es liefert
    // busy=1 zurueck. Deshalb das Ergebnis auswerten statt es zu verwerfen.
    //
    // Zur Deutung der Zahlen: Bei TRUNCATE meldet SQLite log und checkpointed NACH dem
    // Zuruecksetzen, also regulaer 0/0. Massgeblich fuer Erfolg ist allein busy === 0 -
    // `checkpointed: 0` bedeutet hier NICHT "nichts getan".
    const result = database.pragma('wal_checkpoint(TRUNCATE)') as Array<{
      busy: number;
      log: number;
      checkpointed: number;
    }>;
    const outcome = Array.isArray(result) ? result[0] : undefined;

    if (outcome && outcome.busy !== 0) {
      logger.warn({ result: outcome }, '⚠️ WAL-Pruefpunkt blockiert (busy) - WAL bleibt bestehen');
    } else {
      logger.info({ result: outcome }, '💾 WAL-Pruefpunkt vor dem Beenden gesetzt');
    }
  } catch (error) {
    logger.error({ err: error }, '⚠️ WAL-Pruefpunkt fehlgeschlagen');
  }

  try {
    database.close();
    dbWrapper.instance = null;
    logger.info('✅ Datenbankverbindung geschlossen');
  } catch (error) {
    logger.error({ err: error }, '⚠️ Schliessen der Datenbankverbindung fehlgeschlagen');
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
    // CRITICAL: Auto-reconnect if database connection lost!
    if (!dbWrapper.instance) {
      // Waehrend des Herunterfahrens NICHT wieder oeffnen - das wuerde eine frische
      // WAL/SHM anlegen, unmittelbar bevor der Prozess endet.
      if (isShuttingDown) {
        throw new Error('Database is shutting down - no new connections');
      }

      logger.error('❌ Database not initialized - attempting automatic reconnect...');
      try {
        dbWrapper.instance = initializeConnection();
        logger.info('✅ Database reconnected successfully');
      } catch (error) {
        logger.fatal({ err: error }, '❌ FATAL: Cannot reconnect to database');
        throw new Error('Database connection lost and reconnect failed. Server cannot continue.');
      }
    }

    type DbMethod = keyof Database.Database;
    const value = dbWrapper.instance[prop as DbMethod];

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
