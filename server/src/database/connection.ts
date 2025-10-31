import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { existsSync, mkdirSync } from 'fs';
import { initializeDatabase } from './schema.js';

// Database path: server/database.db
// Use process.cwd() which points to server/ directory when running from server/
const DB_PATH = join(process.cwd(), 'database.db');

// Ensure database directory exists
const dbDir = dirname(DB_PATH);
if (!existsSync(dbDir)) {
  mkdirSync(dbDir, { recursive: true });
}

console.log('📁 Database path:', DB_PATH);

// Initialize database connection
const db = new Database(DB_PATH, {
  verbose: process.env.NODE_ENV === 'development' ? console.log : undefined,
});

// Initialize schema
initializeDatabase(db);

// Export database instance
export { db };
export default db;
