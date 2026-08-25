/**
 * F-4 — Bedienweg-Messung der Aktionsspalte (Phase 14.2, Plan 03)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien
 * (edge-cases.spec.ts, user-creation.spec.ts, user-edit.spec.ts) bleiben
 * unveraendert dreiteilig. Dieses Skript misst tatsaechlich, statt aus
 * Klassennamen abzuleiten (14.2-CONTEXT.md, "Messen heisst messen"):
 *
 *   1. Als Admin anmelden, zur Benutzerverwaltung.
 *   2. Einen frischen Testnutzer ueber die Oberflaeche anlegen und ueber
 *      EditUserModal deaktivieren (Haken bei input#isActive entfernen).
 *   3. OHNE den Filter anzufassen die Zeile suchen und die Beschriftungen
 *      aller Schaltflaechen der Zeile erheben.
 *      Erwartung: genau ["Bearbeiten","Reaktivieren"].
 *   4. Auf "Reaktivieren" klicken, den Zustand erneut erheben.
 *      Erwartung: Statusbadge "Aktiv", Schaltflaechen wieder
 *      Bearbeiten + Passwort + Loeschen.
 *
 * Aufruf: node tests/messungen/f4-aktionsspalte.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';
const USERNAME = `f4-messung-${Date.now()}`;

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  try {
    // 1. Anmelden
    await page.goto(BASE_URL + '/');
    await page.waitForSelector('[name="username"]', { timeout: 10000 });
    await page.fill('[name="username"]', 'admin');
    await page.fill('[name="password"]', 'admin123');
    await page.click('button[type="submit"]');
    await page.waitForLoadState('networkidle');
    await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 });

    // Zur Benutzerverwaltung
    await page.click('text=Mitarbeiter');
    await page.waitForSelector('text=Benutzerverwaltung', { timeout: 10000 });

    // 2a. Frischen Testnutzer anlegen
    await page.click('button:has-text("Neuer Benutzer")');
    await page.fill('[name="username"]', USERNAME);
    await page.fill('[name="password"]', 'Test1234!');
    await page.fill('[name="confirmPassword"]', 'Test1234!');
    await page.fill('[name="firstName"]', 'F4Messung');
    await page.fill('[name="lastName"]', 'Testnutzer');
    await page.fill('[name="weeklyHours"]', '40');
    await page.fill('[name="vacationDays"]', '30');
    await page.click('button:has-text("Benutzer erstellen")');
    await page.waitForSelector('text=F4Messung Testnutzer', { timeout: 10000 });

    // 2b. Ueber EditUserModal deaktivieren (input#isActive entfernen)
    let userRow = page.locator('tr:has-text("F4Messung Testnutzer")');
    await userRow.locator('button:has-text("Bearbeiten")').click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });
    await page.locator('input#isActive').uncheck();
    await page.click('button:has-text("Änderungen speichern")');
    await page.waitForTimeout(1500);

    // 3. OHNE Filteraenderung die Zeile suchen und Schaltflaechen erheben
    userRow = page.locator('tr:has-text("F4Messung Testnutzer")');
    await userRow.waitFor({ state: 'visible', timeout: 5000 });
    const statusAfterDeactivate = (await userRow.locator('td').nth(5).innerText()).trim();
    const buttonsAfterDeactivate = await userRow.locator('button').allInnerTexts();
    const labelsAfterDeactivate = buttonsAfterDeactivate.map(t => t.trim()).filter(Boolean);

    console.log('MESSUNG 1 — nach Deaktivieren, ohne Filteraenderung gefunden:');
    console.log('  Statusbadge:', statusAfterDeactivate);
    console.log('  Schaltflaechen:', JSON.stringify(labelsAfterDeactivate));

    // 4. Reaktivieren
    await userRow.locator('button:has-text("Reaktivieren")').click();
    await page.waitForTimeout(1500);

    userRow = page.locator('tr:has-text("F4Messung Testnutzer")');
    await userRow.waitFor({ state: 'visible', timeout: 5000 });
    const statusAfterReactivate = (await userRow.locator('td').nth(5).innerText()).trim();
    const buttonsAfterReactivate = await userRow.locator('button').allInnerTexts();
    const labelsAfterReactivate = buttonsAfterReactivate.map(t => t.trim()).filter(Boolean);

    console.log('MESSUNG 2 — nach Reaktivieren:');
    console.log('  Statusbadge:', statusAfterReactivate);
    console.log('  Schaltflaechen:', JSON.stringify(labelsAfterReactivate));

    const expected1 = JSON.stringify(['Bearbeiten', 'Reaktivieren']);
    const got1 = JSON.stringify(labelsAfterDeactivate);
    const pass1 = got1 === expected1;

    const pass2 = statusAfterReactivate === 'Aktiv' &&
      labelsAfterReactivate.includes('Bearbeiten') &&
      labelsAfterReactivate.includes('Löschen');

    console.log('');
    console.log('ERGEBNIS Messung 1 (erwartet ' + expected1 + '):', pass1 ? 'PASS' : 'FAIL (' + got1 + ')');
    console.log('ERGEBNIS Messung 2 (erwartet Aktiv + Bearbeiten + Löschen):', pass2 ? 'PASS' : 'FAIL');

    if (!pass1 || !pass2) {
      process.exitCode = 1;
    }

    console.log('');
    console.log('Testnutzer fuer diese Messung: ' + USERNAME + ' (bleibt in development.db stehen, wie die uebrigen E2E-Testnutzer)');
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Messung fehlgeschlagen:', err);
  process.exitCode = 1;
});
