/**
 * CHECK IF DEV DB IS IN SYNC WITH PRODUCTION
 * Run this every morning before starting work!
 *
 * Usage: npm run db:check-sync
 */

import Database from 'better-sqlite3';
import { execSync } from 'child_process';
import { existsSync } from 'fs';
import { join } from 'path';

const DEV_DB_PATH = join(__dirname, '../database/development.db');
const SSH_KEY = '/Users/maximilianfegg/Desktop/ssh-key-2025-11-02 (2).key';
const SSH_CMD = `ssh -i "${SSH_KEY}" -o StrictHostKeyChecking=no ubuntu@129.159.8.19`;

console.log('\n🔍 DB SYNC STATUS CHECK\n');
console.log('='.repeat(60));

// Check if dev DB exists
if (!existsSync(DEV_DB_PATH)) {
  console.log('\n❌ ERROR: Dev database not found!');
  console.log(`   Expected: ${DEV_DB_PATH}`);
  console.log('\n💡 Action: Run `npm run db:sync` to create it');
  process.exit(1);
}

// Get dev stats
console.log('\n📁 LOCAL DEV DATABASE:');
try {
  const devDb = new Database(DEV_DB_PATH);
  const devUsers = devDb.prepare('SELECT COUNT(*) as count FROM users WHERE deletedAt IS NULL').get() as { count: number };
  const devEntries = devDb.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number };
  const devLastEntry = devDb.prepare('SELECT MAX(date) as date FROM time_entries').get() as { date: string | null };
  const devLastModified = devDb.prepare("SELECT datetime(MAX(createdAt), 'localtime') as date FROM time_entries").get() as { date: string | null };

  console.log(`   Active Users: ${devUsers.count}`);
  console.log(`   Time Entries: ${devEntries.count}`);
  console.log(`   Last Entry Date: ${devLastEntry.date || 'None'}`);
  console.log(`   Last Modified: ${devLastModified.date || 'Unknown'}`);

  devDb.close();
} catch (error: any) {
  console.error('\n❌ ERROR: Could not read dev database!');
  console.error(`   ${error.message}`);
  process.exit(1);
}

// Get production stats via SSH
console.log('\n☁️  PRODUCTION DATABASE (Oracle Cloud):');
try {
  const prodCmd = `${SSH_CMD} "cd /home/ubuntu/TimeTracking-Clean/server && sqlite3 database.db \\"SELECT COUNT(*) FROM users WHERE deletedAt IS NULL; SELECT COUNT(*) FROM time_entries; SELECT MAX(date) FROM time_entries; SELECT datetime(MAX(createdAt), 'localtime') FROM time_entries;\\"" 2>&1`;

  const prodOutput = execSync(prodCmd, { encoding: 'utf-8', timeout: 10000 }).trim();

  if (prodOutput.includes('Error') || prodOutput.includes('Permission denied')) {
    throw new Error(prodOutput);
  }

  const prodStats = prodOutput.split('\n');

  const prodUsers = parseInt(prodStats[0] || '0');
  const prodEntries = parseInt(prodStats[1] || '0');
  const prodLastEntry = prodStats[2] || 'None';
  const prodLastModified = prodStats[3] || 'Unknown';

  console.log(`   Active Users: ${prodUsers}`);
  console.log(`   Time Entries: ${prodEntries}`);
  console.log(`   Last Entry Date: ${prodLastEntry}`);
  console.log(`   Last Modified: ${prodLastModified}`);

  // Compare
  console.log('\n' + '='.repeat(60));
  console.log('📊 COMPARISON:');
  console.log('='.repeat(60));

  // Re-open dev DB for comparison
  const devDb = new Database(DEV_DB_PATH);
  const devUsers = devDb.prepare('SELECT COUNT(*) as count FROM users WHERE deletedAt IS NULL').get() as { count: number };
  const devEntries = devDb.prepare('SELECT COUNT(*) as count FROM time_entries').get() as { count: number };
  const devLastEntry = devDb.prepare('SELECT MAX(date) as date FROM time_entries').get() as { date: string | null };
  devDb.close();

  const usersMatch = devUsers.count === prodUsers;
  const entriesMatch = devEntries.count === prodEntries;
  const lastEntryMatch = devLastEntry.date === prodLastEntry;

  console.log(`   Users: ${usersMatch ? '✅' : '❌'} ${usersMatch ? 'MATCH' : `MISMATCH (Dev: ${devUsers.count}, Prod: ${prodUsers})`}`);
  console.log(`   Entries: ${entriesMatch ? '✅' : '❌'} ${entriesMatch ? 'MATCH' : `MISMATCH (Dev: ${devEntries.count}, Prod: ${prodEntries})`}`);
  console.log(`   Last Entry: ${lastEntryMatch ? '✅' : '❌'} ${lastEntryMatch ? 'MATCH' : `MISMATCH (Dev: ${devLastEntry.date}, Prod: ${prodLastEntry})`}`);

  console.log('\n' + '='.repeat(60));

  const inSync = usersMatch && entriesMatch && lastEntryMatch;

  if (inSync) {
    console.log('✅ SYNC STATUS: IN SYNC\n');
    console.log('   Your dev database matches production.');
    console.log('   You can start working safely!');
  } else {
    console.log('❌ SYNC STATUS: OUT OF SYNC!\n');
    console.log('   ⚠️  ACTION REQUIRED:');
    console.log('   1. Run: npm run db:sync');
    console.log('   2. Restart dev server (CTRL+C, then npm run dev)');
    console.log('   3. Test your application');
    console.log('\n   🚨 IMPORTANT: Do NOT start development until synced!');
  }

  console.log('\n' + '='.repeat(60));

  process.exit(inSync ? 0 : 1);

} catch (error: any) {
  console.error('\n❌ ERROR: Could not connect to production!');
  console.error(`   ${error.message}`);
  console.log('\n💡 Troubleshooting:');
  console.log('   1. Check SSH key exists: ls -la "' + SSH_KEY + '"');
  console.log('   2. Check SSH key permissions: chmod 400 "' + SSH_KEY + '"');
  console.log('   3. Test SSH connection: ' + SSH_CMD + ' "echo Connected"');
  console.log('   4. Check VPN/network connection to Oracle Cloud');
  console.log('\n⚠️  WARNING: Cannot verify sync status!');
  console.log('   Assuming dev DB might be outdated.');
  process.exit(1);
}
