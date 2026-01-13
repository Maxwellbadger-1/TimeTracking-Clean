import { test, expect } from '@playwright/test';
import { loginAsAdmin, navigateToUsers } from './fixtures/auth';

/**
 * Edge Case Tests
 *
 * Tests edge cases and boundary conditions:
 * - Maximum values (60h, 50 vacation days)
 * - Future hire dates
 * - Very long names
 * - Special characters in names
 * - Concurrent edits (if applicable)
 */

test.describe('Edge Cases', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page);
    await navigateToUsers(page);
  });

  test('Create employee with maximum allowed values (60h, 50 vacation)', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'max-values-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'MaxValues');
    await page.fill('[name="lastName"]', 'User');
    await page.fill('[name="email"]', 'maxvalues@test.com');
    await page.fill('[name="weeklyHours"]', '60'); // Maximum
    await page.fill('[name="vacationDays"]', '50'); // Maximum

    await page.click('button:has-text("Benutzer erstellen")');

    await page.waitForSelector('text=MaxValues User', { timeout: 10000 });
    const userRow = page.locator('tr:has-text("MaxValues User")');
    await expect(userRow).toBeVisible();
  });

  test('Create employee with future hire date', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'future-hire');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Future');
    await page.fill('[name="lastName"]', 'Hire');
    await page.fill('[name="email"]', 'futurehire@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    // Set hire date to 1 month in future
    const futureDate = new Date();
    futureDate.setMonth(futureDate.getMonth() + 1);
    const futureDateString = futureDate.toISOString().split('T')[0];
    await page.fill('[name="hireDate"]', futureDateString);

    await page.click('button:has-text("Benutzer erstellen")');

    // Should succeed (future dates allowed for pre-creating accounts)
    await page.waitForSelector('text=Future Hire', { timeout: 10000 });
    await expect(page.locator('tr:has-text("Future Hire")')).toBeVisible();
  });

  test('Create employee with very long names', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'longname-user');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');

    // Very long names (realistic edge case - some people have long names!)
    const longFirstName = 'Alexander-Maximilian-Sebastian';
    const longLastName = 'von-der-Schulenburg-Wolfsburg';

    await page.fill('[name="firstName"]', longFirstName);
    await page.fill('[name="lastName"]', longLastName);
    await page.fill('[name="email"]', 'longname@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    await page.click('button:has-text("Benutzer erstellen")');

    // Should handle long names gracefully
    await page.waitForSelector(`text=${longFirstName}`, { timeout: 10000 });
    await expect(page.locator(`text=${longFirstName}`)).toBeVisible();
  });

  test('Create employee with special characters in names', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'special-chars');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');

    // German umlauts and special characters
    await page.fill('[name="firstName"]', 'Müller');
    await page.fill('[name="lastName"]', "O'Brien-Özdemir");
    await page.fill('[name="email"]', 'special@test.com');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');

    await page.click('button:has-text("Benutzer erstellen")');

    // Should handle special characters
    await page.waitForSelector('text=Müller', { timeout: 10000 });
    await expect(page.locator('text=Müller')).toBeVisible();
  });

  test('Create employee with decimal hours (part-time)', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'decimal-hours');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Decimal');
    await page.fill('[name="lastName"]', 'Hours');
    await page.fill('[name="email"]', 'decimal@test.com');

    // Decimal hours (e.g., 19.25h per week)
    await page.fill('[name="weeklyHours"]', '19.5');
    await page.fill('[name="vacationDays"]', '15');

    await page.click('button:has-text("Benutzer erstellen")');

    await page.waitForSelector('text=Decimal Hours', { timeout: 10000 });
    const userRow = page.locator('tr:has-text("Decimal Hours")');
    await expect(userRow).toBeVisible();
    // Note: May display as "19.5" or "19,5" depending on locale
  });

  test('Validation: Password too short should fail', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'short-pw');
    await page.fill('[name="password"]', 'Test1!'); // Only 6 chars, min is 8
    await page.fill('[name="confirmPassword"]', 'Test1!');
    await page.fill('[name="firstName"]', 'Short');
    await page.fill('[name="lastName"]', 'Password');

    await page.click('button:has-text("Benutzer erstellen")');

    // Should show validation error
    await expect(page.locator('text=Passwort muss mind. 8 Zeichen lang sein')).toBeVisible({ timeout: 5000 });
  });

  test('Validation: Username too short should fail', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'ab'); // Only 2 chars, min is 3
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'Short');
    await page.fill('[name="lastName"]', 'Username');

    await page.click('button:has-text("Benutzer erstellen")');

    // Should show validation error
    await expect(page.locator('text=Benutzername muss mind. 3 Zeichen lang sein')).toBeVisible({ timeout: 5000 });
  });

  test('Validation: Password mismatch should fail', async ({ page }) => {
    await page.click('button:has-text("Neuer Benutzer")');

    await page.fill('[name="username"]', 'pw-mismatch');
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Different1234!'); // Different password
    await page.fill('[name="firstName"]', 'Password');
    await page.fill('[name="lastName"]', 'Mismatch');

    await page.click('button:has-text("Benutzer erstellen")');

    // Should show validation error
    await expect(page.locator('text=Passwörter stimmen nicht überein')).toBeVisible({ timeout: 5000 });
  });
});
