import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateToUsers, deleteUserByUsername } from './fixtures/auth';

/**
 * User Creation Tests
 *
 * Tests all scenarios for creating new employees including:
 * - Normal values
 * - Edge cases (0 hours, 0 vacation)
 * - Without email
 * - With individual work schedule
 * - Validation errors
 */

test.describe('User Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToUsers(page);
  });

  test('Create employee with normal values (40h, 30 days)', async ({ page }) => {
    // Open create modal
    await page.click('button:has-text("Neuer Benutzer")');

    // Fill form
    await page.fill('[name="username"]', 'normal-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Normal');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'normal@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    // Submit
    await page.click('button:has-text("Benutzer erstellen")');

    // Wait for modal to close
    await page.waitForSelector('text=Normal User', { timeout: 10000 });

    // Verify user appears in list
    const userRow = page.locator('tr:has-text("Normal User")');
    await expect(userRow).toBeVisible();
  });

  test('Create employee with 0 hours and 0 vacation days', async ({ page }) => {
    // Open create modal
    await page.click('button:has-text("Neuer Benutzer")');

    // Fill form with 0 values
    await page.fill('[name="username"]', 'zero-hours-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Zero');
    await page.fill('[name="lastName"]', 'Hours');
    await page.fill('[name="email"]', 'zero@test.com');
    await page.fill('[name="weeklyHours"]', '0');
    await page.fill('[name="vacationDays"]', '0');

    // Submit
    await page.click('button:has-text("Benutzer erstellen")');

    // Wait for modal to close
    await page.waitForSelector('text=Zero Hours', { timeout: 10000 });

    // Verify user with 0 hours and 0 vacation
    const userRow = page.locator('tr:has-text("Zero Hours")');
    await expect(userRow).toBeVisible();
  });

  test('Create employee without email', async ({ page }) => {
    // Open create modal
    await page.click('button:has-text("Neuer Benutzer")');

    // Fill form WITHOUT email
    await page.fill('[name="username"]', 'no-email-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'NoEmail');
    await page.fill('[name="lastName"]', 'User');
    // Leave email empty!
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    // Submit
    await page.click('button:has-text("Benutzer erstellen")');

    // Should succeed
    await page.waitForSelector('text=NoEmail User', { timeout: 10000 });

    // Verify user appears in list
    const userRow = page.locator('tr:has-text("NoEmail User")');
    await expect(userRow).toBeVisible();
  });

  test('Create multiple employees without email (UNIQUE constraint test)', async ({ page }) => {
    // Create first employee without email
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'no-email-1');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'NoEmail1');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=NoEmail1 User', { timeout: 10000 });

    // Create second employee without email - should also succeed
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'no-email-2');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'NoEmail2');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');

    // Both should exist
    await page.waitForSelector('text=NoEmail2 User', { timeout: 10000 });
    await expect(page.locator('tr:has-text("NoEmail1 User")')).toBeVisible();
    await expect(page.locator('tr:has-text("NoEmail2 User")')).toBeVisible();
  });

  test('Create employee with part-time hours (20h)', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'parttime-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'PartTime');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'parttime@test.com');
    await page.fill('[name="weeklyHours"]', '20');
    await page.fill('[name="vacationDays"]', '15');

    await page.click('button:has-text("Benutzer erstellen")');

    await page.waitForSelector('text=PartTime User', { timeout: 10000 });
    const userRow = page.locator('tr:has-text("PartTime User")');
    await expect(userRow).toBeVisible();
  });

  test.skip('Validation: Create without username should fail', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    // Fill everything EXCEPT username
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');

    await page.click('button:has-text("Benutzer erstellen")');

    // Should show validation error
    await expect(page.locator('text=Benutzername ist erforderlich')).toBeVisible({ timeout: 5000 });
  });

  test.skip('Validation: Invalid email should fail', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'test-invalid-email');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Test');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'invalid-email'); // Invalid format

    await page.click('button:has-text("Benutzer erstellen")');

    // Should show validation error
    await expect(page.locator('text=Ungültige E-Mail-Adresse')).toBeVisible({ timeout: 5000 });
  });

  test('Validation: Duplicate username should fail', async ({ page }) => {
    // Create first user
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'duplicate-test');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'First');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'first@test.com');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=First User', { timeout: 10000 });

    // Try to create second user with same username
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', 'duplicate-test'); // Same username!
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Second');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'second@test.com');
    await page.click('button:has-text("Benutzer erstellen")');

    // Should show error
    await expect(page.locator('text=Username already exists')).toBeVisible({ timeout: 5000 });
  });
});
