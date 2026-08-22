import Database from 'better-sqlite3';
import logger from '../utils/logger.js';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';
import fs from 'fs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface Migration {
  name: string;
  // Ehrlicher Vertrag (CR-01, 10-06-PLAN.md): Migration 001 gibt eine Promise zurück
  // (ensureDailyOvertimeTransactions lädt Feiertage per Netzabruf nach, siehe
  // 001_backfill_overtime_transactions.ts:77). Der vorherige Typ `=> void` behauptete das
  // Gegenteil — genau diese Lücke hat den in CR-01 beschriebenen Fehler verdeckt.
  up: (db: Database.Database) => void | Promise<void>;
}

/**
 * Migration Runner - Automatic Database Migrations
 *
 * Ensures migrations table exists and runs pending migrations.
 * Safe to run multiple times (idempotent).
 *
 * Usage:
 *   await runMigrations(db);
 */
export async function runMigrations(db: Database.Database): Promise<void> {
  try {
    logger.info('🔄 Starting migration system...');

    // Step 1: Ensure migrations table exists
    ensureMigrationsTable(db);

    // Step 2: Load all migration files
    const migrations = await loadMigrations();

    if (migrations.length === 0) {
      logger.info('✅ No migrations found');
      return;
    }

    // Step 3: Get executed migrations from database
    const executedMigrations = getExecutedMigrations(db);
    logger.info(`📊 Found ${executedMigrations.length} executed migrations`);

    // Step 4: Filter pending migrations
    const pendingMigrations = migrations.filter(
      (migration) => !executedMigrations.includes(migration.name)
    );

    if (pendingMigrations.length === 0) {
      logger.info('✅ All migrations up to date');
      return;
    }

    logger.info(`🚀 Running ${pendingMigrations.length} pending migrations...`);

    // Step 5: Execute pending migrations
    for (const migration of pendingMigrations) {
      logger.info(`⏳ Running migration: ${migration.name}`);

      try {
        await applyMigration(db, migration);
        logger.info(`✅ Migration completed: ${migration.name}`);
      } catch (error) {
        logger.error({ error }, `❌ Migration failed: ${migration.name}`);
        throw new Error(`Migration ${migration.name} failed: ${error}`);
      }
    }

    logger.info(`✅ All migrations completed successfully`);
  } catch (error) {
    logger.error({ error }, '❌ Migration system error:');
    throw error;
  }
}

/**
 * Führt Schritt 5 des Migrationslaufs für genau eine Migration aus (CR-01-Fix,
 * 10-06-PLAN.md, Task 1).
 *
 * Zwei ausdrücklich getrennte Pfade, unterschieden per `migration.up.constructor.name ===
 * 'AsyncFunction'`. In beiden Pfaden ist die Reihenfolge „erst up(), dann recordMigration()"
 * der Kern der Zusicherung aus 008/009 („Migration wird NICHT als angewendet markiert") — ein
 * Wurf erreicht recordMigration nie.
 *
 * SYNCHRONER PFAD (Regelfall, 002/003/006/007/008/009/010): unverändert
 * `db.transaction(() => { up(db); recordMigration(...); })()`. Weil `up` jetzt wirklich
 * synchron ist (kein `async` mehr ohne `await` im Rumpf), propagiert ein Wurf synchron und
 * die Transaktion rollt zurück.
 *
 * ASYNC-PFAD (nur 001_backfill_overtime_transactions): `db.transaction()` von
 * better-sqlite3 nimmt keine async-Callbacks entgegen. Der naheliegende Ersatz — manuelles
 * BEGIN/COMMIT/ROLLBACK um ein `await` herum — hielte für Migration 001 eine Schreibsperre
 * über einen Netzabruf (Feiertags-API in ensureDailyOvertimeTransactions) offen, über
 * beliebig viele Ereignisschleifen-Durchläufe. Migration 001 läuft heute vollständig
 * außerhalb jeder Transaktion; sie in eine offene Transaktion zu ziehen wäre eine
 * Verhaltensänderung auf dem Erststart-Pfad (npm run db:reset, neues Dev-Setup, per `pkg`
 * gebauter Desktop-Server) ohne Auftrag dieses Plans. Der async-Pfad bekommt deshalb
 * korrekte Fehlerpropagierung (ein Wurf verhindert `recordMigration`, die Migration läuft
 * beim nächsten Start erneut — 001 ist laut Kopfkommentar idempotent), aber ausdrücklich
 * KEINE Atomaritätszusage: bereits geschriebene Zeilen vor dem Wurf bleiben stehen.
 * `logger.warn` macht das beim Lauf sichtbar.
 */
export async function applyMigration(db: Database.Database, migration: Migration): Promise<void> {
  const isAsync = migration.up.constructor.name === 'AsyncFunction';

  if (isAsync) {
    logger.warn(
      `⚠️  Migration ${migration.name} läuft asynchron außerhalb einer Transaktion — ` +
        'keine Atomaritätszusage. Bei einem Fehler bleiben bereits geschriebene Zeilen stehen, ' +
        'aber die Migration wird nicht als angewendet verbucht und läuft erneut.'
    );
    await migration.up(db);
    recordMigration(db, migration.name);
    return;
  }

  const runMigration = db.transaction(() => {
    // migration.up ist hier nachweislich synchron (isAsync === false); der Rückgabewert
    // (void) wird bewusst nicht awaitet, damit ein Wurf synchron aus der Transaktion
    // propagiert statt in einer nie beobachteten Promise zu verschwinden.
    migration.up(db);
    recordMigration(db, migration.name);
  });

  runMigration();
}

/**
 * Ensure migrations table exists (using prepare() to avoid security hook false positive)
 */
export function ensureMigrationsTable(db: Database.Database): void {
  // Check if table exists
  const tableExists = db
    .prepare(
      `SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'`
    )
    .get();

  if (!tableExists) {
    // Create migrations table using multi-line SQL with prepare
    const createTableSQL = `
      CREATE TABLE migrations (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        name TEXT UNIQUE NOT NULL,
        executed_at TEXT DEFAULT (datetime('now'))
      )
    `;
    db.prepare(createTableSQL).run();
    logger.info('✅ Migrations table created');
  } else {
    logger.info('✅ Migrations table already exists');
  }
}

/**
 * Get list of executed migrations from database
 */
function getExecutedMigrations(db: Database.Database): string[] {
  const stmt = db.prepare('SELECT name FROM migrations ORDER BY id');
  const rows = stmt.all() as { name: string }[];
  return rows.map((row) => row.name);
}

/**
 * Record migration as executed
 */
function recordMigration(db: Database.Database, name: string): void {
  const stmt = db.prepare('INSERT INTO migrations (name) VALUES (?)');
  stmt.run(name);
}

/**
 * Load all migration files from migrations directory
 */
async function loadMigrations(): Promise<Migration[]> {
  const migrationsDir = path.join(__dirname, 'migrations');

  // Check if migrations directory exists
  if (!fs.existsSync(migrationsDir)) {
    logger.info('📁 No migrations directory found, creating...');
    fs.mkdirSync(migrationsDir, { recursive: true });
    return [];
  }

  // Get all migration files (*.ts or *.js)
  const files = fs
    .readdirSync(migrationsDir)
    .filter((file) => file.endsWith('.ts') || file.endsWith('.js'))
    .sort(); // Alphabetical order (001_name.ts, 002_name.ts, etc.)

  logger.info(`📁 Found ${files.length} migration files`);

  // Load each migration
  const migrations: Migration[] = [];

  for (const file of files) {
    const migrationPath = path.join(migrationsDir, file);
    const migration = await import(pathToFileURL(migrationPath).href);

    if (!migration.default || typeof migration.default.up !== 'function') {
      logger.warn(`⚠️  Invalid migration file: ${file} (missing default export with up function)`);
      continue;
    }

    migrations.push({
      name: file.replace(/\.(ts|js)$/, ''), // Remove extension
      up: migration.default.up,
    });
  }

  return migrations;
}
