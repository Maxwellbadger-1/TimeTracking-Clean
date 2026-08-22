import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateToUsers } from './fixtures/auth';

/**
 * User Edit Tests
 *
 * Tests all scenarios for editing existing employees including:
 * - Editing employees without email
 * - Removing email from employee
 * - Switching from workSchedule to normal hours
 * - Changing to 0 hours
 * - Setting vacation days to 0
 * - Activating/deactivating employees
 * - Setting end date
 */

test.describe('User Edit', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToUsers(page);
  });

  test('Edit employee without email (critical bug fix test)', async ({ page }) => {
    // First create employee WITHOUT email
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'edit-no-email');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Edit');
    await page.fill('[name="lastName"]', 'NoEmail');
    // Leave email empty!
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=Edit NoEmail', { timeout: 10000 });

    // Now try to EDIT this user (this was crashing before!)
    const userRow = page.locator('tr:has-text("Edit NoEmail")');
    await userRow.locator('button:has-text("Bearbeiten")').click();

    // Wait for modal to open
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Change first name
    await page.fill('[name="firstName"]', 'EditedFirstName');

    // Save changes
    await page.click('button:has-text("Änderungen speichern")');

    // Wait for modal to close and verify change
    await page.waitForSelector('text=EditedFirstName NoEmail', { timeout: 10000 });
    await expect(page.locator('tr:has-text("EditedFirstName NoEmail")')).toBeVisible();
  });

  test('Edit employee with email → remove email', async ({ page }) => {
    // Create employee WITH email
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'remove-email-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'RemoveEmail');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'remove@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=RemoveEmail User', { timeout: 10000 });

    // Edit and remove email
    const userRow = page.locator('tr:has-text("RemoveEmail User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Clear email field
    await page.fill('[name="email"]', '');

    // Save
    await page.click('button:has-text("Änderungen speichern")');

    // Should succeed (email is optional)
    await page.waitForTimeout(2000);
    await expect(page.locator('tr:has-text("RemoveEmail User")')).toBeVisible();
  });

  test('Change employee to 0 hours (critical bug fix test)', async ({ page }) => {
    // Create normal employee
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'change-to-zero');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'ChangeToZero');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'changezero@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=ChangeToZero User', { timeout: 10000 });

    // Bearbeiten-Dialog oeffnen. WR-12 (Code-Review Phase 12): Alle acht Vorkommen dieser
    // Datei suchten urspruenglich `button[aria-label="Bearbeiten"]` — ein Attribut, das der
    // Zeilenbutton nie trug. Sie liefen damit in den Locator-Timeout; die Datei war zum
    // ueberwiegenden Teil rot und gab keine Regressionssicherheit fuer den in Phase 12
    // geaenderten Bearbeiten-Dialog. Jetzt einheitlich ueber den sichtbaren Text.
    const userRow = page.locator('tr:has-text("ChangeToZero User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Seit Plan 12-07 ist das Wochenstundenfeld im Stammdatenformular schreibgeschuetzt (D1) —
    // die Umstellung auf 0 h laeuft ueber den eigenen Wechsel-Dialog.
    await page.click('button:has-text("Stundenwechsel ab Datum")');
    await page.waitForSelector('text=Stundenwechsel:', { timeout: 5000 });

    // Stichtag in der Zukunft waehlen, damit keine Rueckwirkungs-Bestaetigung noetig ist und
    // der Test deterministisch bleibt. Zeitzonensicher aufgebaut, kein toISOString()-Split.
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const futureDateString = `${futureDate.getFullYear()}-${String(futureDate.getMonth() + 1).padStart(2, '0')}-${String(futureDate.getDate()).padStart(2, '0')}`;

    await page.fill('label:has-text("Stichtag") + input', futureDateString);
    await page.fill('label:has-text("Neue Wochenstunden") + input', '0');
    await page.fill(
      'label:has-text("Begründung") + textarea',
      'E2E-Test: Umstellung auf 0 Stunden (mindestens 10 Zeichen)'
    );

    // Der Primaerbutton wird erst freigeschaltet, sobald die Server-Vorschau eingetroffen ist
    // (previewToken) — der Test wartet auf diesen Zustand, nicht auf eine feste Zeitspanne.
    const saveButton = page.locator('button:has-text("Stundenwechsel speichern")');
    await expect(saveButton).toBeEnabled({ timeout: 10000 });
    await saveButton.click();

    // Der Wechsel-Dialog schliesst sich nach dem Speichern; die Periodenliste im
    // EditUserModal zeigt danach eine Zeile mit 0 h.
    //
    // WR-14 (Code-Review Phase 12): Hier stand `table tr:has-text("0 h")`. `has-text` prueft
    // auf TEILzeichenketten — die Zeile der Ausgangsperiode zeigt "40 h" und enthaelt damit
    // ebenfalls "0 h". Der Locator traf nach dem Speichern mindestens zwei Zeilen (Strict
    // Mode: "resolved to 2 elements"), oder er war, falls die alte Periode zuerst gerendert
    // wird, schon VOR dem Stundenwechsel gruen. In beiden Faellen prueften er nicht, was er
    // zu pruefen behauptet. Jetzt auf die Zelle abgestellt und exakt verglichen.
    await expect(page.locator('table td', { hasText: /^0 h$/ })).toBeVisible({ timeout: 10000 });
  });

  test('Switch from individual workSchedule to normal hours (critical bug fix test)', async ({ page }) => {
    // Create employee with workSchedule (if WorkScheduleEditor is available)
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'switch-schedule');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'SwitchSchedule');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'switch@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    // Try to enable individual work schedule if available
    const scheduleToggle = page.locator('text=Individueller Wochenplan');
    if (await scheduleToggle.count() > 0) {
      // If WorkScheduleEditor is present, try to enable it
      const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: /Individueller/ });
      if (await checkbox.count() > 0) {
        await checkbox.check();
      }
    }

    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=SwitchSchedule User', { timeout: 10000 });

    // Now edit and switch back to normal hours
    const userRow = page.locator('tr:has-text("SwitchSchedule User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // If workSchedule toggle exists, disable it
    const editScheduleToggle = page.locator('text=Individueller Wochenplan');
    if (await editScheduleToggle.count() > 0) {
      const checkbox = page.locator('input[type="checkbox"]').filter({ hasText: /Individueller/ });
      if (await checkbox.count() > 0) {
        await checkbox.uncheck();
      }
    }

    // Save
    await page.click('button:has-text("Änderungen speichern")');

    // Should succeed
    await page.waitForTimeout(2000);
    await expect(page.locator('tr:has-text("SwitchSchedule User")')).toBeVisible();
  });

  test('Deactivate and reactivate employee', async ({ page }) => {
    // Create active employee
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'deactivate-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Deactivate');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'deactivate@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=Deactivate User', { timeout: 10000 });

    // Deactivate
    let userRow = page.locator('tr:has-text("Deactivate User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Uncheck "Benutzer ist aktiv"
    const activeCheckbox = page.locator('input#isActive');
    await activeCheckbox.uncheck();

    await page.click('button:has-text("Änderungen speichern")');
    await page.waitForTimeout(2000);

    // Reactivate
    userRow = page.locator('tr:has-text("Deactivate User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    await activeCheckbox.check();
    await page.click('button:has-text("Änderungen speichern")');

    // Should succeed
    await page.waitForTimeout(2000);
    await expect(page.locator('tr:has-text("Deactivate User")')).toBeVisible();
  });

  test('Set end date for employee', async ({ page }) => {
    // Create employee
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'enddate-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'EndDate');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'enddate@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=EndDate User', { timeout: 10000 });

    // Edit and set end date
    const userRow = page.locator('tr:has-text("EndDate User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Set end date to 1 month in future
    // WR-13 (Code-Review Phase 12): Hier stand `futureDate.toISOString().split('T')[0]` —
    // das von `.claude/CLAUDE.md` ausdruecklich verbotene Muster, 130 Zeilen unter der
    // gegenteiligen Zusicherung im selben Test ("Zeitzonensicher aufgebaut, kein
    // toISOString()-Split"). In der Sommerzeit (UTC+2) liefert es zwischen 00:00 und 02:00
    // Ortszeit den Vortag. Zusaetzlich lief `setMonth(getMonth() + 1)` an Monatsenden ueber
    // (am 31. Januar ergab es den 2./3. Maerz) und machte den Test vom Ausfuehrungsdatum
    // abhaengig — deshalb der 1. des Folgemonats, zeitzonensicher aus lokalen Feldern.
    const now = new Date();
    const future = new Date(now.getFullYear(), now.getMonth() + 1, 1);
    const endDateString = `${future.getFullYear()}-${String(future.getMonth() + 1).padStart(2, '0')}-01`;
    await page.fill('[name="endDate"]', endDateString);

    await page.click('button:has-text("Änderungen speichern")');

    // Should succeed
    await page.waitForTimeout(2000);
    await expect(page.locator('tr:has-text("EndDate User")')).toBeVisible();
  });

  test('Change employee role from employee to admin', async ({ page }) => {
    // Create regular employee
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'role-change-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'RoleChange');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'rolechange@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    // Role should default to employee
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=RoleChange User', { timeout: 10000 });

    // Edit and change role to admin
    const userRow = page.locator('tr:has-text("RoleChange User")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    await page.selectOption('select[name="role"]', 'admin');

    await page.click('button:has-text("Änderungen speichern")');

    // Should succeed
    await page.waitForTimeout(2000);
    await expect(page.locator('tr:has-text("RoleChange User")')).toBeVisible();
  });
});
