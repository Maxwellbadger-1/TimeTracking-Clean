#!/usr/bin/env npx tsx

/**
 * Test if backup now uses correct database path
 */

import * as backupService from './src/services/backupService.js';
import fs from 'fs';

console.log('🔧 Testing Backup Fix\n');
console.log('=====================\n');

// Create a test backup
console.log('Creating test backup with fixed path...\n');

try {
  const backupPath = backupService.createBackup();
  console.log(`✅ Backup created: ${backupPath}`);

  // Check file size
  const stats = fs.statSync(backupPath);
  const sizeMB = (stats.size / 1024 / 1024).toFixed(2);

  console.log(`📊 Backup size: ${sizeMB} MB`);

  if (stats.size > 0) {
    console.log('✅ SUCCESS: Backup is not empty!');
  } else {
    console.log('❌ FAIL: Backup is still empty (0 bytes)');
  }

  // List last 3 backups to verify
  console.log('\n📋 Last 3 backups:');
  const backups = backupService.listBackups();
  backups.slice(0, 3).forEach(backup => {
    const backupSizeMB = (backup.size / 1024 / 1024).toFixed(2);
    console.log(`  • ${backup.filename}: ${backupSizeMB} MB`);
  });

} catch (error) {
  console.error('❌ Test failed:', error);
}