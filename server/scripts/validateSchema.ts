#!/usr/bin/env npx tsx
/**
 * Database Schema Validation Script
 *
 * Validates that all required columns exist in the database tables.
 * Used in deployment to ensure database schema is up-to-date.
 *
 * Usage:
 *   npm run validate:schema
 *   npx tsx scripts/validateSchema.ts
 */

import Database from 'better-sqlite3';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Database path (production or development)
const dbPath = process.env.NODE_ENV === 'production'
  ? path.join(__dirname, '../database.db')
  : path.join(__dirname, '../database.db');

console.log('🔍 Database Schema Validation');
console.log('📁 Database:', dbPath);
console.log('');

// Define expected schema
const EXPECTED_SCHEMA = {
  users: {
    required: [
      'id', 'username', 'email', 'password', 'firstName', 'lastName',
      'role', 'department', 'position', 'weeklyHours', 'vacationDaysPerYear',
      'hireDate', 'endDate', 'status', 'privacyConsentAt', 'forcePasswordChange',
      'workSchedule', 'createdAt', 'deletedAt'
    ],
    optional: []
  },
  time_entries: {
    required: [
      'id', 'userId', 'projectId', 'activityId', 'date', 'hours',
      'description', 'isHomeOffice', 'createdAt'
    ],
    optional: ['deletedAt']
  },
  absence_requests: {
    required: [
      'id', 'userId', 'type', 'startDate', 'endDate', 'days',
      'reason', 'status', 'approverId', 'approvedAt', 'createdAt'
    ],
    optional: ['deletedAt', 'files']
  },
  overtime_balance: {
    required: [
      'id', 'userId', 'month', 'targetHours', 'actualHours',
      'overtime', 'carryover', 'balance', 'createdAt', 'updatedAt'
    ],
    optional: []
  },
  overtime_transactions: {
    required: [
      'id', 'userId', 'date', 'type', 'hours', 'balance',
      'description', 'referenceId', 'createdAt'
    ],
    optional: []
  },
  vacation_balance: {
    required: [
      'id', 'userId', 'year', 'totalDays', 'usedDays',
      'pendingDays', 'remainingDays', 'carryoverDays',
      'carryoverExpiry', 'createdAt', 'updatedAt'
    ],
    optional: []
  },
  departments: {
    required: ['id', 'name', 'description', 'createdAt'],
    optional: ['deletedAt']
  },
  projects: {
    required: ['id', 'name', 'description', 'active', 'createdAt'],
    optional: ['deletedAt']
  },
  activities: {
    required: ['id', 'name', 'description', 'projectId', 'createdAt'],
    optional: ['deletedAt']
  },
  holidays: {
    required: ['id', 'date', 'name', 'state', 'federal', 'createdAt'],
    optional: []
  },
  notifications: {
    required: [
      'id', 'recipientId', 'type', 'title', 'message',
      'read', 'priority', 'link', 'metadata', 'createdAt'
    ],
    optional: ['readAt', 'deletedAt']
  }
};

interface ValidationResult {
  table: string;
  status: 'ok' | 'error' | 'warning';
  missingColumns: string[];
  extraColumns: string[];
}

function validateTable(db: Database.Database, tableName: string): ValidationResult {
  const result: ValidationResult = {
    table: tableName,
    status: 'ok',
    missingColumns: [],
    extraColumns: []
  };

  try {
    // Get actual columns from database
    const tableInfo = db.pragma(`table_info(${tableName})`) as Array<{ name: string }>;
    const actualColumns = tableInfo.map(col => col.name);

    // Get expected columns
    const expectedSchema = EXPECTED_SCHEMA[tableName as keyof typeof EXPECTED_SCHEMA];
    if (!expectedSchema) {
      console.warn(`⚠️  No schema definition for table: ${tableName}`);
      result.status = 'warning';
      return result;
    }

    const expectedColumns = [...expectedSchema.required, ...expectedSchema.optional];

    // Check for missing required columns
    for (const col of expectedSchema.required) {
      if (!actualColumns.includes(col)) {
        result.missingColumns.push(col);
        result.status = 'error';
      }
    }

    // Check for extra columns (not necessarily an error)
    for (const col of actualColumns) {
      if (!expectedColumns.includes(col)) {
        result.extraColumns.push(col);
        if (result.status === 'ok') {
          result.status = 'warning';
        }
      }
    }

    return result;
  } catch (error) {
    console.error(`❌ Error validating table ${tableName}:`, error);
    result.status = 'error';
    return result;
  }
}

function validateSchema(): boolean {
  const db = new Database(dbPath, { readonly: true });
  let hasErrors = false;

  try {
    console.log('📋 Validating database schema...\n');

    // Get all tables
    const tables = db.prepare(`
      SELECT name FROM sqlite_master
      WHERE type='table' AND name NOT LIKE 'sqlite_%'
      ORDER BY name
    `).all() as Array<{ name: string }>;

    const results: ValidationResult[] = [];

    // Validate each table
    for (const table of tables) {
      const result = validateTable(db, table.name);
      results.push(result);
    }

    // Display results
    console.log('📊 Validation Results:\n');
    console.log('Table'.padEnd(25) + 'Status'.padEnd(10) + 'Issues');
    console.log('-'.repeat(60));

    for (const result of results) {
      const statusIcon = result.status === 'ok' ? '✅' :
                         result.status === 'warning' ? '⚠️ ' : '❌';

      let issues = '';
      if (result.missingColumns.length > 0) {
        issues += `Missing: ${result.missingColumns.join(', ')}`;
      }
      if (result.extraColumns.length > 0) {
        if (issues) issues += ' | ';
        issues += `Extra: ${result.extraColumns.join(', ')}`;
      }

      console.log(
        result.table.padEnd(25) +
        statusIcon.padEnd(10) +
        issues
      );

      if (result.status === 'error') {
        hasErrors = true;
      }
    }

    console.log('\n' + '='.repeat(60));

    if (hasErrors) {
      console.error('\n❌ VALIDATION FAILED: Database schema has missing required columns!');
      console.error('   Run migrations to fix: npm run migrate:prod\n');
      return false;
    } else {
      console.log('\n✅ VALIDATION PASSED: Database schema is up to date!\n');
      return true;
    }

  } catch (error) {
    console.error('❌ Schema validation error:', error);
    return false;
  } finally {
    db.close();
  }
}

// Run validation
const isValid = validateSchema();
process.exit(isValid ? 0 : 1);