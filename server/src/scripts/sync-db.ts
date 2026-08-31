#!/usr/bin/env node
/**
 * Database Sync Script
 *
 * Syncs Production database to Development database
 * This ensures Development DB is always a recent copy of Production
 *
 * Usage:
 *   npm run db:sync              # Sync from a local production DB copy (SYNC_SOURCE_DB)
 *
 * WR-02 (09.1-REVIEW.md, Restbefunde-Quick-Task 260831-t5j): Der frühere Fernabruf per SSH
 * (`db:sync:remote` / `syncRemote()`) ist ersatzlos entfernt worden, nicht nur der
 * Schlüsselname korrigiert. Begründung (siehe SUMMARY der Quick-Task für Details):
 * `syncRemote()` war seit dem Verschieben nach `src/` funktionsloser Code (der referenzierte
 * SSH-Schlüsselpfad zeigte auf eine Datei, die im Projekt nie existierte - der tatsächliche
 * Schlüssel liegt unter einem anderen Namen), transportierte die Datenbank per rohem `scp`
 * (WAL-Risiko, siehe Kommentar in `scripts/sync-dev-db.sh`) und duplizierte damit einen Weg,
 * den `.claude/CLAUDE.md` bereits kanonisch benennt: `npm run sync-dev-db`
 * (`scripts/sync-dev-db.sh`) - mit dem korrekten Schlüsselnamen aus `ENV.md`,
 * `VACUUM INTO`-Snapshot statt rohem `scp` und `integrity_check`-Prüfung vor der
 * Installation. Für den Fernabruf gilt ausschließlich dieser Weg; `db:sync`
 * (`syncLocal()`) bleibt für eine bereits lokal vorhandene Produktionskopie erhalten.
 */

import { copyFileSync, existsSync } from 'fs';
import { databaseConfig } from '../config/database.js';
import { formatDate } from '../utils/timezone.js';

/**
 * Sync database from local production to development
 */
async function syncLocal(): Promise<void> {
  console.log('🔄 Syncing Production → Development (Local)...\n');

  // CR-04 (09.1-REVIEW.md): databaseConfig.productionPath zeigt fest auf
  // server/database.db - den unmigrierten Altbestand vom April 2026 (kein Symlink mehr
  // seit 20.08.2026, siehe .claude/CLAUDE.md: "server/database.db ist NICHT die
  // Arbeitsdatenbank"). Quelle deshalb ausschliesslich ueber eine explizit gesetzte
  // Umgebungsvariable - kein stiller Rueckfall auf den Altbestand.
  const productionPath = process.env.SYNC_SOURCE_DB;
  if (!productionPath) {
    console.error('❌ SYNC_SOURCE_DB nicht gesetzt (z. B. /home/ubuntu/databases/production.db).');
    process.exit(2);
  }
  const developmentPath = databaseConfig.developmentPath;

  if (!existsSync(productionPath!)) {
    console.error(`❌ Production database not found: ${productionPath}`);
    process.exit(1);
  }

  console.log(`📁 Source:      ${productionPath}`);
  console.log(`📁 Destination: ${developmentPath}\n`);

  try {
    // Create backup of current development database
    if (existsSync(developmentPath)) {
      // CR-04: Sicherungsname jetzt mit Uhrzeit statt nur Datum - das zuvor verwendete Muster
      // (UTC-ISO-String, davon nur den Datumsteil vor dem "T") verwarf den Zeitanteil
      // komplett, wodurch ein zweiter Lauf am selben Tag die einzige gute Sicherung
      // ueberschrieb (Lauf 1 sichert die gute development.db, Lauf 2 sichert bereits den
      // Altbestand unter demselben Namen). formatDate() vermeidet zusaetzlich die in
      // .claude/CLAUDE.md ausdruecklich verbotene UTC-Verschiebung (WR-03).
      const timestamp = formatDate(new Date(), 'yyyy-MM-dd_HH-mm-ss');
      const backupPath = developmentPath.replace(/\.db$/, `.backup.${timestamp}.db`);
      if (existsSync(backupPath)) {
        console.error(`❌ Sicherung existiert bereits: ${backupPath}`);
        process.exit(1);
      }
      copyFileSync(developmentPath, backupPath);
      console.log(`💾 Backed up existing development DB to: ${backupPath}`);
    }

    // Copy production to development
    copyFileSync(productionPath!, developmentPath);
    console.log('✅ Database synced successfully!\n');

    // Show database info
    const Database = (await import('better-sqlite3')).default;
    const db = new Database(developmentPath, { readonly: true });

    const userCount = db.prepare('SELECT COUNT(*) as count FROM users').get() as { count: number };
    const entryCount = db.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number };
    const absenceCount = db.prepare('SELECT COUNT(*) as count FROM absence_requests').get() as { count: number };

    db.close();

    console.log('📊 Database Statistics:');
    console.log(`   Users:            ${userCount.count}`);
    console.log(`   Time Entries:     ${entryCount.count}`);
    console.log(`   Absence Requests: ${absenceCount.count}\n`);

    console.log('✅ Development database is now up-to-date with Production!');
  } catch (error) {
    console.error('❌ Sync failed:', error);
    process.exit(1);
  }
}

// Main
syncLocal();
