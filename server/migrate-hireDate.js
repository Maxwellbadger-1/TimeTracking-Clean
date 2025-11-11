/**
 * Migration Script: Add hireDate column to users table
 *
 * This script adds the missing hireDate column to the users table in production.
 * Run this on the production server to fix the deployment issue.
 *
 * Usage: node migrate-hireDate.js
 */

import Database from 'better-sqlite3';
import { join } from 'path';

const DB_PATH = join(process.cwd(), 'database.db');

console.log('🔧 Starting migration: Add hireDate column to users table');
console.log('📁 Database path:', DB_PATH);

try {
  const db = new Database(DB_PATH);

  // Check if column already exists
  const tableInfo = db.prepare("PRAGMA table_info(users)").all();
  const hasHireDate = tableInfo.some(col => col.name === 'hireDate');
  const hasEndDate = tableInfo.some(col => col.name === 'endDate');
  const hasStatus = tableInfo.some(col => col.name === 'status');

  console.log('\n📊 Current users table columns:');
  tableInfo.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
  });

  // Add hireDate if missing
  if (!hasHireDate) {
    console.log('\n⚙️  Adding hireDate column...');
    db.exec(`
      ALTER TABLE users ADD COLUMN hireDate TEXT NOT NULL DEFAULT (date('now'));
    `);
    console.log('✅ hireDate column added successfully');
  } else {
    console.log('\n✅ hireDate column already exists');
  }

  // Add endDate if missing
  if (!hasEndDate) {
    console.log('\n⚙️  Adding endDate column...');
    db.exec(`
      ALTER TABLE users ADD COLUMN endDate TEXT;
    `);
    console.log('✅ endDate column added successfully');
  } else {
    console.log('✅ endDate column already exists');
  }

  // Add status if missing
  if (!hasStatus) {
    console.log('\n⚙️  Adding status column...');
    db.exec(`
      ALTER TABLE users ADD COLUMN status TEXT DEFAULT 'active' CHECK(status IN ('active', 'inactive'));
    `);
    console.log('✅ status column added successfully');
  } else {
    console.log('✅ status column already exists');
  }

  // Verify final schema
  const finalTableInfo = db.prepare("PRAGMA table_info(users)").all();
  console.log('\n📊 Final users table columns:');
  finalTableInfo.forEach(col => {
    console.log(`  - ${col.name}: ${col.type}`);
  });

  db.close();

  console.log('\n✅ Migration completed successfully!');
  console.log('🚀 You can now restart the server with: pm2 restart timetracking-server');

} catch (error) {
  console.error('\n❌ Migration failed:', error);
  process.exit(1);
}
