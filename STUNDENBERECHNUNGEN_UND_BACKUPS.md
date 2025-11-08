# Stundenberechnungen & Backup-Strategie

## 🔴 KRITISCHER BUG GEFUNDEN - Monatliche Sollstunden-Berechnung

### Problem
Die aktuelle Berechnung in `overtimeService.ts` (Zeile 151) und `userService.ts` (Zeile 272) ist FALSCH:

```typescript
// ❌ FALSCH - teilt durch 7 Tage (inkl. Wochenende!)
const targetHours = Math.round(((user.weeklyHours / 7) * daysInMonth) * 100) / 100;
```

**Beispiel 40h/Woche:**
- 40h / 7 Tage = 5.71h pro Tag
- 30 Tage × 5.71h = **171.4h** ❌ (ZU WENIG!)

**RICHTIG sollte sein:**
- 40h / 5 Arbeitstage = 8h pro Arbeitstag
- 23 Arbeitstage (typischer Monat) × 8h = **184h** ✅

### Lösung
Neue Helper-Funktionen in `/server/src/utils/workingDays.ts` erstellt:

1. **`getWorkingDaysInMonth(year, month)`** - Zählt Arbeitstage (Mo-Fr) exakt
2. **`calculateMonthlyTargetHours(weeklyHours, year, month)`** - Berechnet Sollstunden präzise

**Formel:** `(weeklyHours / 5) × actualWorkingDays`

### Verwendung in allen Services

#### overtimeService.ts
```typescript
import { calculateMonthlyTargetHours, calculateDailyTargetHours } from '../utils/workingDays.js';

export function updateMonthlyOvertime(userId: number, month: string): void {
  const [year, monthNum] = month.split('-').map(Number);
  const targetHours = calculateMonthlyTargetHours(user.weeklyHours, year, monthNum);
  // Rest...
}
```

#### userService.ts - recalculateOvertimeForUser()
```typescript
import { calculateMonthlyTargetHours } from '../utils/workingDays.js';

function recalculateOvertimeForUser(userId: number): void {
  for (const entry of entries) {
    const [year, monthNum] = entry.month.split('-').map(Number);
    const newTargetHours = calculateMonthlyTargetHours(user.weeklyHours, year, monthNum);
    // Update...
  }
}
```

#### overtimeService.ts - ensureOvertimeBalanceEntries()
```typescript
export function ensureOvertimeBalanceEntries(userId: number, upToMonth: string): void {
  for (const month of months) {
    const [year, monthNum] = month.split('-').map(Number);
    const targetHours = calculateMonthlyTargetHours(user.weeklyHours, year, monthNum);
    // Insert...
  }
}
```

---

## 🔄 Automatische Datenbank-Backups

### Best Practices (von professionellen Programmen)

**1. Strategie: 3-2-1 Backup Rule**
- **3** Kopien der Daten
- **2** verschiedene Medien
- **1** Kopie Off-Site

**2. Backup-Typen:**
- **Full Backup** (täglich um 2:00 Uhr)
- **Incremental Backup** (stündlich während Arbeitszeit 8-18 Uhr)
- **On-Demand Backup** (vor kritischen Operationen)

**3. Retention Policy:**
- Letzte 7 Tage: Alle tägl Backups
- Letzte 4 Wochen: Wöchentliche Backups (Sonntag)
- Letzte 12 Monate: Monatliche Backups (1. des Monats)
- Älter als 12 Monate: Quartal-Backups

### Implementierung

#### Neue Datei: `/server/src/services/backupService.ts`

```typescript
import fs from 'fs';
import path from 'path';
import { promisify } from 'util';
import db from '../database/connection.js';

const copyFile = promisify(fs.copyFile);
const mkdir = promisify(fs.mkdir);
const readdir = promisify(fs.readdir);
const unlink = promisify(fs.unlink);
const stat = promisify(fs.stat);

const BACKUP_DIR = path.join(process.cwd(), 'backups');
const DB_PATH = process.env.DATABASE_PATH || './server/database.db';

interface BackupConfig {
  dailyRetention: number;   // Days
  weeklyRetention: number;  // Weeks
  monthlyRetention: number; // Months
}

const DEFAULT_CONFIG: BackupConfig = {
  dailyRetention: 7,
  weeklyRetention: 4,
  monthlyRetention: 12,
};

/**
 * Create backup directory if it doesn't exist
 */
async function ensureBackupDir(): Promise<void> {
  try {
    await mkdir(BACKUP_DIR, { recursive: true });
  } catch (error) {
    // Directory already exists
  }
}

/**
 * Create database backup
 * Returns backup file path
 */
export async function createBackup(type: 'manual' | 'auto' = 'auto'): Promise<string> {
  await ensureBackupDir();

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const filename = `database_${type}_${timestamp}.db`;
  const backupPath = path.join(BACKUP_DIR, filename);

  console.log(`📦 Creating ${type} backup...`);

  // Close any pending transactions
  db.pragma('wal_checkpoint(TRUNCATE)');

  // Copy database file
  await copyFile(DB_PATH, backupPath);

  // Also copy WAL and SHM files if they exist
  try {
    await copyFile(`${DB_PATH}-wal`, `${backupPath}-wal`);
    await copyFile(`${DB_PATH}-shm`, `${backupPath}-shm`);
  } catch (error) {
    // WAL/SHM files might not exist, that's OK
  }

  const stats = await stat(backupPath);
  console.log(`✅ Backup created: ${filename} (${(stats.size / 1024 / 1024).toFixed(2)} MB)`);

  return backupPath;
}

/**
 * Get all backup files sorted by date (newest first)
 */
async function getBackupFiles(): Promise<Array<{ path: string; stats: fs.Stats }>> {
  await ensureBackupDir();

  const files = await readdir(BACKUP_DIR);
  const dbFiles = files.filter(f => f.endsWith('.db') && !f.endsWith('-wal') && !f.endsWith('-shm'));

  const filesWithStats = await Promise.all(
    dbFiles.map(async (file) => ({
      path: path.join(BACKUP_DIR, file),
      stats: await stat(path.join(BACKUP_DIR, file)),
    }))
  );

  return filesWithStats.sort((a, b) => b.stats.mtime.getTime() - a.stats.mtime.getTime());
}

/**
 * Clean old backups according to retention policy
 */
export async function cleanOldBackups(config: BackupConfig = DEFAULT_CONFIG): Promise<void> {
  console.log('🧹 Cleaning old backups...');

  const backups = await getBackupFiles();
  const now = new Date();
  const toDelete: string[] = [];

  for (const backup of backups) {
    const age = now.getTime() - backup.stats.mtime.getTime();
    const ageInDays = age / (1000 * 60 * 60 * 24);
    const backupDate = new Date(backup.stats.mtime);

    // Keep last 7 days (all backups)
    if (ageInDays <= config.dailyRetention) {
      continue;
    }

    // Keep weekly backups (Sunday) for last 4 weeks
    if (ageInDays <= config.weeklyRetention * 7) {
      if (backupDate.getDay() === 0) { // Sunday
        continue;
      }
    }

    // Keep monthly backups (1st of month) for last 12 months
    if (ageInDays <= config.monthlyRetention * 30) {
      if (backupDate.getDate() === 1) {
        continue;
      }
    }

    // Mark for deletion
    toDelete.push(backup.path);
  }

  // Delete old backups
  for (const filePath of toDelete) {
    try {
      await unlink(filePath);
      await unlink(`${filePath}-wal`).catch(() => {});
      await unlink(`${filePath}-shm`).catch(() => {});
      console.log(`🗑️  Deleted old backup: ${path.basename(filePath)}`);
    } catch (error) {
      console.error(`❌ Failed to delete backup: ${filePath}`, error);
    }
  }

  console.log(`✅ Cleanup complete. Deleted ${toDelete.length} old backups.`);
}

/**
 * Restore database from backup
 * DANGER: This will overwrite the current database!
 */
export async function restoreBackup(backupPath: string): Promise<void> {
  console.log(`🔄 Restoring backup from: ${backupPath}`);

  // Verify backup exists
  await stat(backupPath);

  // Close database connections
  db.pragma('wal_checkpoint(TRUNCATE)');
  db.close();

  // Create safety backup of current database
  const safetyBackup = await createBackup('manual');
  console.log(`💾 Safety backup created: ${safetyBackup}`);

  // Restore backup
  await copyFile(backupPath, DB_PATH);

  // Restore WAL/SHM if they exist
  try {
    await copyFile(`${backupPath}-wal`, `${DB_PATH}-wal`);
    await copyFile(`${backupPath}-shm`, `${DB_PATH}-shm`);
  } catch (error) {
    // WAL/SHM might not exist
  }

  console.log(`✅ Database restored from backup`);
  console.log(`⚠️  Please restart the server to reconnect to the database`);
}

/**
 * List all available backups
 */
export async function listBackups(): Promise<Array<{
  filename: string;
  size: number;
  date: Date;
  age: string;
}>> {
  const backups = await getBackupFiles();

  return backups.map(backup => {
    const now = new Date();
    const age = now.getTime() - backup.stats.mtime.getTime();
    const ageInDays = Math.floor(age / (1000 * 60 * 60 * 24));
    const ageInHours = Math.floor(age / (1000 * 60 * 60));

    return {
      filename: path.basename(backup.path),
      size: backup.stats.size,
      date: new Date(backup.stats.mtime),
      age: ageInDays > 0 ? `${ageInDays} days ago` : `${ageInHours} hours ago`,
    };
  });
}
```

#### Cron Job Setup: `/server/src/services/cronService.ts`

```typescript
import cron from 'node-cron';
import { createBackup, cleanOldBackups } from './backupService.js';

/**
 * Initialize all cron jobs
 */
export function initializeCronJobs(): void {
  console.log('⏰ Initializing cron jobs...');

  // Daily backup at 2:00 AM
  cron.schedule('0 2 * * *', async () => {
    console.log('🕐 Running daily backup...');
    try {
      await createBackup('auto');
      await cleanOldBackups();
    } catch (error) {
      console.error('❌ Daily backup failed:', error);
    }
  });

  // Hourly backup during work hours (8 AM - 6 PM)
  cron.schedule('0 8-18 * * *', async () => {
    console.log('🕐 Running hourly backup...');
    try {
      await createBackup('auto');
    } catch (error) {
      console.error('❌ Hourly backup failed:', error);
    }
  });

  console.log('✅ Cron jobs initialized');
  console.log('  - Daily backup: 2:00 AM');
  console.log('  - Hourly backup: 8:00 AM - 6:00 PM');
}
```

#### API Endpoints: `/server/src/routes/backup.ts`

```typescript
import { Router } from 'express';
import type { Request, Response } from 'express';
import { requireAuth, requireAdmin } from '../middleware/auth.js';
import { createBackup, listBackups, restoreBackup } from '../services/backupService.js';

const router = Router();

// GET /api/backup - List all backups
router.get('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const backups = await listBackups();
    res.json({ success: true, data: backups });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to list backups' });
  }
});

// POST /api/backup - Create manual backup
router.post('/', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const backupPath = await createBackup('manual');
    res.json({
      success: true,
      message: 'Backup created successfully',
      path: backupPath,
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to create backup' });
  }
});

// POST /api/backup/restore - Restore from backup
router.post('/restore', requireAuth, requireAdmin, async (req: Request, res: Response) => {
  try {
    const { filename } = req.body;
    if (!filename) {
      res.status(400).json({ success: false, error: 'Filename is required' });
      return;
    }

    // Security: Validate filename
    if (filename.includes('..') || filename.includes('/')) {
      res.status(400).json({ success: false, error: 'Invalid filename' });
      return;
    }

    const backupPath = path.join(BACKUP_DIR, filename);
    await restoreBackup(backupPath);

    res.json({
      success: true,
      message: 'Backup restored successfully. Please restart the server.',
    });
  } catch (error) {
    res.status(500).json({ success: false, error: 'Failed to restore backup' });
  }
});

export default router;
```

#### Server Integration: `/server/src/server.ts`

```typescript
import { initializeCronJobs } from './services/cronService.js';
import backupRoutes from './routes/backup.js';

// ... existing code ...

// Register backup routes
app.use('/api/backup', backupRoutes);

// Initialize cron jobs
initializeCronJobs();

// Create initial backup on startup
import { createBackup } from './services/backupService.js';
createBackup('auto').catch(console.error);
```

---

## 📊 Performance-Optimierung für große Datenmengen

### Problem: Datenbank wird langsam mit vielen Einträgen

**Typische Szenarien:**
- 50 Mitarbeiter × 250 Arbeitstage/Jahr = **12,500 time_entries/Jahr**
- Nach 5 Jahren: **62,500 Einträge** → Queries werden langsam

### Lösung 1: Datenbank-Indizes (SOFORT umsetzen!)

```sql
-- time_entries Indizes
CREATE INDEX IF NOT EXISTS idx_time_entries_user_date
  ON time_entries(userId, date);

CREATE INDEX IF NOT EXISTS idx_time_entries_date
  ON time_entries(date);

-- absence_requests Indizes
CREATE INDEX IF NOT EXISTS idx_absence_requests_user_dates
  ON absence_requests(userId, startDate, endDate);

CREATE INDEX IF NOT EXISTS idx_absence_requests_status
  ON absence_requests(status);

-- overtime_balance Indizes
CREATE INDEX IF NOT EXISTS idx_overtime_balance_user_month
  ON overtime_balance(userId, month);

-- vacation_balance Indizes
CREATE INDEX IF NOT EXISTS idx_vacation_balance_user_year
  ON vacation_balance(userId, year);

-- notifications Indizes
CREATE INDEX IF NOT EXISTS idx_notifications_user_read
  ON notifications(userId, read);

-- audit_log Indizes
CREATE INDEX IF NOT EXISTS idx_audit_log_user_action
  ON audit_log(userId, action);

CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp
  ON audit_log(timestamp);
```

**Wo einfügen:** `/server/src/database/schema.ts` nach den CREATE TABLE Statements

### Lösung 2: Pagination für große Listen

```typescript
// Beispiel: time_entries mit Pagination
export function getTimeEntriesPaginated(
  userId: number,
  page: number = 1,
  pageSize: number = 50
): { entries: TimeEntry[]; total: number; pages: number } {
  const offset = (page - 1) * pageSize;

  // Get total count
  const total = db
    .prepare('SELECT COUNT(*) as count FROM time_entries WHERE userId = ?')
    .get(userId) as { count: number };

  // Get page of results
  const entries = db
    .prepare(`
      SELECT * FROM time_entries
      WHERE userId = ?
      ORDER BY date DESC, startTime DESC
      LIMIT ? OFFSET ?
    `)
    .all(userId, pageSize, offset) as TimeEntry[];

  return {
    entries,
    total: total.count,
    pages: Math.ceil(total.count / pageSize),
  };
}
```

### Lösung 3: Archivierung alter Daten (nach 2+ Jahren)

```sql
-- Archiv-Tabellen (nur lesend, keine Updates mehr)
CREATE TABLE time_entries_archive (
  -- gleiche Struktur wie time_entries
);

-- Migration Script (jährlich ausführen)
INSERT INTO time_entries_archive
SELECT * FROM time_entries
WHERE date < date('now', '-2 years');

DELETE FROM time_entries
WHERE date < date('now', '-2 years');

VACUUM; -- Speicher freigeben
```

### Lösung 4: Query-Optimierung

**VORHER (langsam):**
```typescript
// Holt ALLE Einträge, dann filtert im JavaScript
const entries = db.prepare('SELECT * FROM time_entries').all();
const filtered = entries.filter(e => e.userId === userId && e.date >= startDate);
```

**NACHHER (schnell):**
```typescript
// Filtert direkt in der Datenbank (nutzt Indizes)
const entries = db
  .prepare('SELECT * FROM time_entries WHERE userId = ? AND date >= ?')
  .all(userId, startDate);
```

---

## 📈 Monitoring & Metriken

### Performance-Monitoring hinzufügen

```typescript
// middleware/performance.ts
export function performanceMonitoring(req: Request, res: Response, next: NextFunction) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;

    if (duration > 1000) { // Länger als 1 Sekunde
      console.warn(`⚠️  Slow request: ${req.method} ${req.path} - ${duration}ms`);
    }
  });

  next();
}
```

### Datenbank-Größe überwachen

```typescript
export function getDatabaseStats() {
  const stats = {
    size: fs.statSync(DB_PATH).size,
    tables: {} as Record<string, number>,
  };

  const tables = ['time_entries', 'absence_requests', 'overtime_balance', 'vacation_balance', 'audit_log'];

  for (const table of tables) {
    const result = db.prepare(`SELECT COUNT(*) as count FROM ${table}`).get() as { count: number };
    stats.tables[table] = result.count;
  }

  return stats;
}
```

---

## ✅ Action Items (Priorität)

1. **SOFORT:** Stundenberechnung fixen
   - [ ] `/server/src/utils/workingDays.ts` erstellen
   - [ ] `overtimeService.ts` anpassen
   - [ ] `userService.ts` anpassen
   - [ ] Server neu bauen & starten
   - [ ] Alle Überstunden neu berechnen (Admin-Script)

2. **HEUTE:** Backup-System implementieren
   - [ ] `backupService.ts` erstellen
   - [ ] `cronService.ts` erstellen
   - [ ] `backup.ts` Routes erstellen
   - [ ] Server integrieren
   - [ ] Manuellen Backup testen

3. **DIESE WOCHE:** Performance optimieren
   - [ ] Indizes zur Datenbank hinzufügen
   - [ ] Pagination für große Listen
   - [ ] Performance-Monitoring aktivieren

4. **SPÄTER:** Archivierung
   - [ ] Archiv-Tabellen erstellen
   - [ ] Migrations-Script schreiben
   - [ ] Jährlichen Cron Job einrichten
