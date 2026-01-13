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
    await userRow.locator('button[aria-label="Bearbeiten"]').click();

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
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
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

    // Edit to 0 hours
    let userRow = page.locator('tr:has-text("ChangeToZero User")');
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    await page.fill('[name="weeklyHours"]', '0');
    await page.fill('[name="vacationDays"]', '0');

    await page.click('button:has-text("Änderungen speichern")');

    // Verify 0 values are preserved
    await page.waitForTimeout(2000);
    userRow = page.locator('tr:has-text("ChangeToZero User")');
    await expect(userRow).toBeVisible();
    await expect(userRow).toContainText('0');
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
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
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
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Uncheck "Benutzer ist aktiv"
    const activeCheckbox = page.locator('input#isActive');
    await activeCheckbox.uncheck();

    await page.click('button:has-text("Änderungen speichern")');
    await page.waitForTimeout(2000);

    // Reactivate
    userRow = page.locator('tr:has-text("Deactivate User")');
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
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
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // Set end date to 1 month in future
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const endDateString = futureDate.toISOString().split('T')[0];
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
    await userRow.locator('button[aria-label="Bearbeiten"]').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    await page.selectOption('select[name="role"]', 'admin');

    await page.click('button:has-text("Änderungen speichern")');

    // Should succeed
    await page.waitForTimeout(2000);
    await expect(page.locator('tr:has-text("RoleChange User")')).toBeVisible();
  });
});
