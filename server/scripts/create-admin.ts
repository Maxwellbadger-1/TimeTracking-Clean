/**
 * Admin User Setup Script
 *
 * Creates the first admin user for the system
 * Run with: npx tsx server/scripts/create-admin.ts
 */

import bcrypt from 'bcrypt';
import Database from 'better-sqlite3';
import * as readline from 'readline';

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
});

function question(query: string): Promise<string> {
  return new Promise((resolve) => rl.question(query, resolve));
}

async function createAdmin() {
  console.log('=================================');
  console.log('TimeTracker - Admin User Setup');
  console.log('=================================\n');

  // Get admin details
  const username = await question('Admin Username: ');
  const email = await question('Admin Email: ');
  const password = await question('Admin Password (min. 8 Zeichen): ');
  const firstName = await question('Vorname: ');
  const lastName = await question('Nachname: ');

  // Validate
  if (!username || !email || !password || !firstName || !lastName) {
    console.error('❌ Alle Felder sind erforderlich!');
    rl.close();
    process.exit(1);
  }

  if (password.length < 8) {
    console.error('❌ Passwort muss mindestens 8 Zeichen lang sein!');
    rl.close();
    process.exit(1);
  }

  if (!email.includes('@')) {
    console.error('❌ Ungültige E-Mail-Adresse!');
    rl.close();
    process.exit(1);
  }

  console.log('\n📊 Erstelle Admin-User...');

  // Hash password
  const hashedPassword = await bcrypt.hash(password, 10);

  // Connect to database
  const db = new Database('server/database.db');

  try {
    // Check if admin already exists
    const existingAdmin = db
      .prepare('SELECT id FROM users WHERE role = ? LIMIT 1')
      .get('admin');

    if (existingAdmin) {
      const overwrite = await question(
        '\n⚠️  Es existiert bereits ein Admin-User. Überschreiben? (ja/nein): '
      );
      if (overwrite.toLowerCase() !== 'ja') {
        console.log('❌ Abgebrochen.');
        rl.close();
        db.close();
        process.exit(0);
      }
    }

    // Check if username exists
    const existingUser = db
      .prepare('SELECT id FROM users WHERE username = ?')
      .get(username);

    if (existingUser) {
      console.error(`❌ Username "${username}" existiert bereits!`);
      rl.close();
      db.close();
      process.exit(1);
    }

    // Insert admin user
    const stmt = db.prepare(`
      INSERT INTO users (
        username,
        email,
        password,
        firstName,
        lastName,
        role,
        status,
        weeklyHours,
        vacationDaysPerYear,
        createdAt
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
    `);

    const result = stmt.run(
      username,
      email,
      hashedPassword,
      firstName,
      lastName,
      'admin',
      'active',
      40,
      30
    );

    console.log('\n✅ Admin-User erfolgreich erstellt!');
    console.log('\n📋 Login-Daten:');
    console.log(`   Username: ${username}`);
    console.log(`   Email:    ${email}`);
    console.log(`   Passwort: ${password}`);
    console.log('\n⚠️  Bitte Passwort sicher aufbewahren!\n');

    db.close();
    rl.close();
  } catch (error) {
    console.error('❌ Fehler beim Erstellen des Admin-Users:', error);
    db.close();
    rl.close();
    process.exit(1);
  }
}

createAdmin();
