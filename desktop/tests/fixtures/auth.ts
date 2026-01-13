import { Page } from '@playwright/test';

/**
 * Auth Fixture - Helper Functions for Authentication
 */

/**
 * Login as Admin User
 * Navigates to login page, fills credentials, and waits for dashboard
 */
export async function loginAsAdmin(page: Page): Promise<void> {
  await page.goto('/');

  // Wait for login page to load
  await page.waitForSelector('[name="username"]', { timeout: 10000 });

  // Fill credentials
  await page.fill('[name="username"]', 'admin');
  await page.fill('[name="password"]', 'admin123');

  // Submit
  await page.click('button[type="submit"]');

  // Wait for navigation to dashboard (appears at root / after login)
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 });
}

/**
 * Navigate to Users Page
 */
export async function navigateToUsers(page: Page): Promise<void> {
  // Click on "Mitarbeiter" in sidebar
  await page.click('text=Mitarbeiter');
  await page.waitForSelector('text=Benutzerverwaltung', { timeout: 10000 });
}

/**
 * Logout
 */
export async function logout(page: Page): Promise<void> {
  // Click user menu (top right)
  await page.click('[aria-label="User menu"]');

  // Click logout
  await page.click('text=Abmelden');

  // Wait for redirect to login
  await page.waitForURL('**/');
}

/**
 * Delete Test User by Username
 * Navigates to users page and deletes user with given username
 */
export async function deleteUserByUsername(page: Page, username: string): Promise<void> {
  await navigateToUsers(page);

  // Find user row
  const userRow = page.locator(`tr:has-text("${username}")`);

  if (await userRow.count() > 0) {
    // Click delete button
    await userRow.locator('button[aria-label="Löschen"]').click();

    // Confirm deletion
    await page.click('button:has-text("Löschen")');

    // Wait for success message or row to disappear
    await page.waitForTimeout(1000);
  }
}
