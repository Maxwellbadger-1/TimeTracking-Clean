/**
 * Database Configuration
 * Environment-based database path selection
 *
 * - Development: Uses local database copy (database/development.db)
 * - Production: Uses production database (database.db in server root)
 */

import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

/**
 * Get the database path based on NODE_ENV
 */
export function getDatabasePath(): string {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    // Production: Use database.db in server root (Oracle Cloud)
    return path.join(__dirname, '../../database.db');
  } else {
    // Development: Use separate development database
    return path.join(__dirname, '../../database/development.db');
  }
}

/**
 * Get the production database path (for sync scripts)
 */
export function getProductionDatabasePath(): string {
  return path.join(__dirname, '../../database.db');
}

/**
 * Get the development database path
 */
export function getDevelopmentDatabasePath(): string {
  return path.join(__dirname, '../../database/development.db');
}

/**
 * Database configuration
 */
export const databaseConfig = {
  path: getDatabasePath(),
  productionPath: getProductionDatabasePath(),
  developmentPath: getDevelopmentDatabasePath(),

  // SQLite options
  options: {
    verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
  },

  // WAL mode for better concurrency
  pragma: [
    'PRAGMA journal_mode = WAL',
    'PRAGMA synchronous = NORMAL',
    'PRAGMA foreign_keys = ON',
    'PRAGMA temp_store = MEMORY',
    'PRAGMA mmap_size = 30000000000',
  ],
};

export default databaseConfig;
