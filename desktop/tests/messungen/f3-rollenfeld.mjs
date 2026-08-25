/**
 * F-3 — Messung des Rollenfelds und der Label-Anbindung (Phase 14.2, Plan 04)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien
 * (edge-cases.spec.ts, user-creation.spec.ts, user-edit.spec.ts) bleiben
 * unveraendert dreiteilig. Dieses Skript misst tatsaechlich, statt aus
 * Klassennamen abzuleiten (14.2-CONTEXT.md, "Messen heisst messen"):
 *
 *   1. Als Admin anmelden, zur Benutzerverwaltung.
 *   2. Den Dialog "Benutzer bearbeiten" fuer einen bestehenden Nutzer oeffnen.
 *   3. document.querySelectorAll('[role="dialog"] select') erheben, je Treffer
 *      name, id und den htmlFor-Wert des zugehoerigen <label> (per for-Attribut
 *      im selben Formularblock gesucht).
 *   4. Gegen den Ausgangsbefund [{"name":null,"id":"","val":"employee"}] pruefen.
 *      Erwartung fuer das Rollenfeld: name === "role", id === "role", und ein
 *      <label for="role"> mit dem Text "Rolle" existiert.
 *
 * Aufruf: node tests/messungen/f3-rollenfeld.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';

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

    // 2. Dialog "Benutzer bearbeiten" fuer einen bestehenden Nutzer oeffnen
    //    (admin selbst: erste Zeile der Tabelle, "Bearbeiten"-Schaltflaeche)
    const firstEditButton = page.locator('table button:has-text("Bearbeiten")').first();
    await firstEditButton.click();
    await page.waitForSelector('text=Benutzer bearbeiten:', { timeout: 5000 });

    // 3. Alle <select> im Dialog erheben, je Treffer name/id/htmlFor+Labeltext
    const measurement = await page.evaluate(() => {
      const selects = Array.from(document.querySelectorAll('[role="dialog"] select'));
      return selects.map((sel) => {
        const id = sel.getAttribute('id') || '';
        const name = sel.getAttribute('name');
        const val = sel.value;
        let labelFor = null;
        let labelText = null;
        if (id) {
          const label = document.querySelector(`[role="dialog"] label[for="${id}"]`);
          if (label) {
            labelFor = label.getAttribute('for');
            labelText = label.textContent?.trim() ?? null;
          }
        }
        return { name, id, val, labelFor, labelText };
      });
    });

    console.log('MESSUNG — alle <select> im Dialog "Benutzer bearbeiten":');
    console.log(JSON.stringify(measurement, null, 2));

    const roleField = measurement.find((m) => m.name === 'role');

    console.log('');
    console.log('Ausgangswert (vor F-3, aus 14-ABNAHME-SICHT.md):');
    console.log('  [{"name":null,"id":"","val":"employee"}]');
    console.log('');
    console.log('Rollenfeld jetzt:');
    console.log('  ' + JSON.stringify(roleField));

    const pass =
      !!roleField &&
      roleField.name === 'role' &&
      roleField.id === 'role' &&
      roleField.labelFor === 'role' &&
      typeof roleField.labelText === 'string' &&
      roleField.labelText.startsWith('Rolle');

    console.log('');
    console.log(
      'ERGEBNIS (erwartet name="role", id="role", <label for="role"> mit Text "Rolle"):',
      pass ? 'PASS' : 'FAIL'
    );

    if (!pass) {
      process.exitCode = 1;
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Messung fehlgeschlagen:', err);
  process.exitCode = 1;
});
