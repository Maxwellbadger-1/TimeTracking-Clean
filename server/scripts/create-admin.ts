/**
 * Admin User Setup Script
 *
 * Creates the first admin user for the system
 * Run with: npx tsx server/scripts/create-admin.ts
 */

import bcrypt from 'bcrypt';
import * as readline from 'readline';
// Rule 3 (Plan 11-11): Vorher `new Database('server/database.db')` fest verdrahtet -
// ignorierte DATABASE_PATH vollständig. Blockierend für den geforderten Probelauf gegen
// eine Wegwerfkopie (11-werkzeugprobe.db) und schrieb bei jedem Lauf in die tote Altlast
// `server/database.db` statt in die konfigurierte Datenbank. Vorbild für den Weg über die
// geteilte Verbindung aus der kompilierten Ausgabe: fix-overtime.ts. `db` respektiert
// DATABASE_PATH über databaseConfig.path (server/src/config/database.ts:22).
import { db } from '../dist/database/connection.js';
// D4 (Phase 11): ohne Startperiode bricht die erste Überstundenberechnung des ersten
// Nutzers des Systems mit einem harten Fehler ab. Einziger Schreibweg: ensureInitialWorkPeriod()
// (aus der kompilierten userService.js, Plan 11-03) - kein zweiter, selbst gebauter Weg.
import { ensureInitialWorkPeriod, getUserById } from '../dist/services/userService.js';

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

  try {
    // Check if admin already exists
    const existingAdmin = db
      .prepare('SELECT id FROM users WHERE role = ? LIMIT 1')
      .get('admin');

    if (existingAdmin) {
      // WR-05: Die Frage lautete früher "Überschreiben? (ja/nein)" — überschrieben wurde
      // aber NICHTS. Bei "ja" fiel der Code einfach zur Username-Prüfung durch und legte
      // einen ZUSÄTZLICHEN Admin an. Wer die Frage wörtlich nahm, ging davon aus, das alte
      // Konto sei entwertet; es blieb aktiv, inklusive altem Passwort. Die Frage sagt jetzt,
      // was tatsächlich passiert. (Ein echtes Überschreiben wäre eine Verhaltensänderung
      // dieses Skripts und gehört nicht in eine Review-Korrektur.)
      const createAnother = await question(
        '\n⚠️  Es existiert bereits ein Admin-User. Er bleibt unverändert bestehen. ' +
          'Trotzdem einen WEITEREN Admin anlegen? (ja/nein): '
      );
      if (createAnother.toLowerCase() !== 'ja') {
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

    // WR-04: Nutzeranlage UND Startperiode in EINER Transaktion.
    //
    // Vorher waren `INSERT INTO users` und `ensureInitialWorkPeriod()` zwei getrennte
    // Schreibvorgänge. Scheiterte der zweite — Trigger aus Migration 008, gesperrte Datei,
    // `getUserById()` liefert undefined — blieb ein Admin OHNE Periode zurück: genau der
    // Zustand, den der Kommentar darüber verhindern will, und beim allerersten Nutzer eines
    // Systems fällt er sofort auf die Füße (D4: jede Sollstundenberechnung wirft dann).
    // `createUser()` in userService.ts macht es bereits richtig; hier dieselbe Klammer.
    const createAdminAndPeriod = db.transaction((): number => {
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

      const adminId = result.lastInsertRowid as number;

      // D4 (Phase 11): ohne Startperiode bricht die erste Überstundenberechnung dieses
      // ersten Nutzers mit einem harten Fehler ab (MissingWorkPeriodError).
      const createdAdmin = getUserById(adminId);
      if (!createdAdmin) {
        throw new Error(`create-admin: Nutzer ${adminId} nach Anlage nicht gefunden`);
      }
      ensureInitialWorkPeriod(createdAdmin, null);

      return adminId;
    });

    createAdminAndPeriod();

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
