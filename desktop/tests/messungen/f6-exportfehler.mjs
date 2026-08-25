/**
 * F-6 — Messung der drei Antwortformen an beiden Exportwegen (Phase 14.2, Plan 06)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien (edge-cases.spec.ts,
 * user-creation.spec.ts, user-edit.spec.ts) bleiben unveraendert dreiteilig. Dieses Skript
 * misst tatsaechlich den im Hinweisfenster angezeigten Text, statt aus dem Quelltext
 * abzuleiten ("Messen heisst messen", 14.2-CONTEXT.md):
 *
 *   1. Als Admin anmelden, zu "Berichte" navigieren.
 *   2. Die Route der jeweiligen Exportfunktion abfangen (page.route) und drei praeparierte
 *      Antworten liefern: echter 409-Koerper, kaputter (Nicht-JSON) Koerper, interner Text
 *      mit Stacktrace/SQL-Praefix/Dateipfad.
 *   3. Den Knopf "DATEV Export" bzw. "CSV Export" klicken, den Sonner-Toast abwarten
 *      ([data-sonner-toast] [data-title]) und dessen Text auslesen.
 *   4. Zusaetzlich, OHNE Abfangen, gegen den laufenden Server einen echten DATEV-Export fuer
 *      den Nutzer abnahme.kettenluecke anstossen und den tatsaechlichen Text messen.
 *
 * Aufruf: node tests/messungen/f6-exportfehler.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';

const AUSGANGSBEFUND =
  'DATEV Export fehlgeschlagen: {"success":false,"code":"PERIOD_CHAIN_GAP",...}';

/** @type {{name: string, pass: boolean, text: string}[]} */
const ergebnisse = [];

function record(name, text, pass) {
  ergebnisse.push({ name, text, pass });
  console.log('');
  console.log(`--- ${name} ---`);
  console.log('Gemessener Hinweistext:');
  console.log('  ' + JSON.stringify(text));
  console.log(pass ? 'PASS' : 'FAIL');
}

async function login(page) {
  await page.goto(BASE_URL + '/');
  await page.waitForSelector('[name="username"]', { timeout: 10000 });
  await page.fill('[name="username"]', 'admin');
  await page.fill('[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
  await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 });
}

async function goToReports(page) {
  await page.click('text=Berichte');
  await page.waitForSelector('text=Berichte & Auswertungen', { timeout: 10000 });
}

/**
 * Faengt die uebergebene Route ab und liefert genau EINE praeparierte Antwort, klickt danach
 * den Exportknopf und liest den Sonner-Toast-Text aus.
 */
async function measureIntercepted(page, { routeGlob, buttonText, status, contentType, body }) {
  await page.route(routeGlob, async (route) => {
    await route.fulfill({ status, contentType, body });
  });

  // Etwaige vorherige Toasts (z. B. "wird erstellt...") nicht fehlinterpretieren: der Export
  // nutzt eine feste id (datev-export / csv-export), sonner ersetzt den Toast an derselben
  // Stelle statt einen zweiten anzulegen. force:true, weil ein noch sichtbarer Toast vom
  // vorherigen Fall (top-right, 4s Anzeigedauer) den Knopf ueberlagern kann, ohne den Klick
  // funktional zu behindern (Playwright verweigert sonst per "subtree intercepts pointer
  // events", obwohl der Knopf tatsaechlich klickbar ist).
  await page.click(`button:has-text("${buttonText}")`, { force: true });

  const toastLocator = page.locator('[data-sonner-toast] [data-title]').last();
  await toastLocator.waitFor({ state: 'visible', timeout: 10000 });
  // Kurze Wartezeit, bis der finale Fehlertoast (nicht mehr der "wird erstellt..."-Ladetoast)
  // steht — sonner ersetzt den Inhalt derselben Toast-id synchron mit dem catch-Block.
  await page.waitForTimeout(300);

  const text = await toastLocator.evaluate((el) => el.textContent?.trim() ?? '');

  await page.unroute(routeGlob);

  // Auf das Verschwinden des Toasts warten, bevor der naechste Fall den Knopf erneut klickt —
  // vermeidet, dass ein Alt-Toast mit derselben id (datev-export/csv-export) den naechsten
  // Messwert fuer einen Sekundenbruchteil ueberschreibt, waehrend sonner noch animiert.
  await toastLocator.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

  return text;
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let alleBestanden = true;

  try {
    await login(page);
    await goToReports(page);

    // ============================================================
    // Fall 1 — echter 409, DATEV
    // ============================================================
    const datevRealBody = JSON.stringify({
      success: false,
      error:
        'DATEV-Export abgebrochen: 1 Nutzer haben keine lückenlose Arbeitszeitperiode ' +
        '(Datendefekt D4) — Nutzer-IDs: 48715. Eine Datei ohne deren Zeiteinträge und ' +
        'Abwesenheiten würde vollständig aussehen, wäre es aber nicht. Perioden prüfen mit ' +
        '`npm run check:period-chains`, danach den Export wiederholen.',
      skippedUserIds: [48715],
    });
    const fall1Text = await measureIntercepted(page, {
      routeGlob: '**/api/exports/datev**',
      buttonText: 'DATEV Export',
      status: 409,
      contentType: 'application/json',
      body: datevRealBody,
    });
    const fall1Pass =
      fall1Text.includes('DATEV-Export abgebrochen:') &&
      !fall1Text.includes('{') &&
      !fall1Text.includes('"success"') &&
      !fall1Text.includes('skippedUserIds');
    record('Fall 1 (DATEV, echter 409)', fall1Text, fall1Pass);
    alleBestanden = alleBestanden && fall1Pass;

    // ============================================================
    // Fall 2 — kaputter (Nicht-JSON) Koerper, DATEV
    // ============================================================
    const fall2DatevText = await measureIntercepted(page, {
      routeGlob: '**/api/exports/datev**',
      buttonText: 'DATEV Export',
      status: 500,
      contentType: 'text/html',
      body: '<html><body>502</body></html>',
    });
    const fall2DatevPass = !fall2DatevText.includes('<html') && fall2DatevText.includes('500');
    record('Fall 2 (DATEV, kaputter Koerper)', fall2DatevText, fall2DatevPass);
    alleBestanden = alleBestanden && fall2DatevPass;

    // ============================================================
    // Fall 3 — interner Text (Stacktrace/SQL/Pfad), DATEV
    // ============================================================
    const internerTextBody = JSON.stringify({
      success: false,
      error: 'SQLITE_ERROR: no such column: foo\n    at Database.prepare (/home/ubuntu/app/db.js:1:1)',
    });
    const fall3Text = await measureIntercepted(page, {
      routeGlob: '**/api/exports/datev**',
      buttonText: 'DATEV Export',
      status: 500,
      contentType: 'application/json',
      body: internerTextBody,
    });
    const fall3Pass =
      !fall3Text.includes('SQLITE_') && !fall3Text.includes('at ') && !fall3Text.includes('/home/');
    record('Fall 3 (DATEV, interner Text)', fall3Text, fall3Pass);
    alleBestanden = alleBestanden && fall3Pass;

    // ============================================================
    // Fall 1 (CSV) — derselbe echte 409-foermige Koerper, damit exportHistoricalCSV
    // denselben Fix traegt (der reale Server liefert fuer diese Route meist einen
    // generischen 500 statt eines 409 mit IncompleteExportError — dieser Fall prueft
    // trotzdem, dass exportHistoricalCSV das Feld "error" ausdruecklich auspackt).
    // ============================================================
    const csvRealBody = JSON.stringify({
      success: false,
      error:
        'DATEV-Export abgebrochen: 1 Nutzer haben keine lückenlose Arbeitszeitperiode ' +
        '(Datendefekt D4) — Nutzer-IDs: 48715. Eine Datei ohne deren Zeiteinträge und ' +
        'Abwesenheiten würde vollständig aussehen, wäre es aber nicht. Perioden prüfen mit ' +
        '`npm run check:period-chains`, danach den Export wiederholen.',
      skippedUserIds: [48715],
    });
    const fall1CsvText = await measureIntercepted(page, {
      routeGlob: '**/api/exports/historical/csv**',
      buttonText: 'CSV Export',
      status: 409,
      contentType: 'application/json',
      body: csvRealBody,
    });
    const fall1CsvPass =
      fall1CsvText.includes('DATEV-Export abgebrochen:') &&
      !fall1CsvText.includes('{') &&
      !fall1CsvText.includes('"success"') &&
      !fall1CsvText.includes('skippedUserIds');
    record('Fall 1 (CSV, echter 409-foermiger Koerper)', fall1CsvText, fall1CsvPass);
    alleBestanden = alleBestanden && fall1CsvPass;

    // ============================================================
    // Fall 2 (CSV) — kaputter (Nicht-JSON) Koerper
    // ============================================================
    const fall2CsvText = await measureIntercepted(page, {
      routeGlob: '**/api/exports/historical/csv**',
      buttonText: 'CSV Export',
      status: 500,
      contentType: 'text/html',
      body: '<html><body>502</body></html>',
    });
    const fall2CsvPass = !fall2CsvText.includes('<html') && fall2CsvText.includes('500');
    record('Fall 2 (CSV, kaputter Koerper)', fall2CsvText, fall2CsvPass);
    alleBestanden = alleBestanden && fall2CsvPass;

    // ============================================================
    // Realfall — ohne Abfangen, gegen den laufenden Server. abnahme.kettenluecke ist der
    // lebende Testfall der lueckenhaften Periodenkette (14.2-CONTEXT.md/PLAN.md), aber
    // KEIN Admin — der Export-Knopf ist admin-only (ReportsPage.tsx: isAdmin && ...). Der
    // Export laeuft deshalb als Admin, ueber den Default-Zeitraum "gesamtes aktuelles
    // Jahr" (getDateRangeFromFilters ohne Monat), der Nutzer 48715 einschliesst, falls
    // dessen Periodenkette in diesem Jahr eine Luecke traegt. Kein Login-Wechsel noetig,
    // die Session ist noch die aus den vorigen Faellen (admin, Reports-Seite).
    // ============================================================
    console.log('');
    console.log('--- Realfall: ungefangener DATEV-Export ueber das aktuelle Jahr ---');

    let realfallText;
    try {
      await page.click('button:has-text("DATEV Export")', { force: true });
      const toastLocator = page.locator('[data-sonner-toast] [data-title]').last();
      await toastLocator.waitFor({ state: 'visible', timeout: 15000 });
      await page.waitForTimeout(500);
      realfallText = await toastLocator.evaluate((el) => el.textContent?.trim() ?? '');
    } catch (e) {
      realfallText = `(kein Fehlertoast gemessen — vermutlich Erfolg oder Timeout: ${e instanceof Error ? e.message : String(e)})`;
    }

    console.log('Gemessener Realfall-Text:');
    console.log('  ' + JSON.stringify(realfallText));
    const realfall409 = realfallText.includes('DATEV-Export abgebrochen:');
    console.log(
      realfall409
        ? 'Der Server liefert im Realfall den echten 409 — deckungsgleich mit Fall 1.'
        : 'Der Server liefert im Realfall KEINEN 409 (z. B. weil die Periodenkette inzwischen ' +
            'geschlossen ist, oder der DATEV-Export deckt den vollen aktuellen Jahresbereich ab ' +
            'und der Nutzer faellt heraus). Der Nachweis stuetzt sich auf Fall 1 — es wird NICHT ' +
            'behauptet, dass der Realfall live geprueft wurde.'
    );

    // ============================================================
    // Zusammenfassung
    // ============================================================
    console.log('');
    console.log('=== Zusammenfassung ===');
    console.log('Ausgangsbefund (vor F-6):');
    console.log('  ' + AUSGANGSBEFUND);
    console.log('');
    for (const r of ergebnisse) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${JSON.stringify(r.text)}`);
    }

    console.log('');
    console.log('GESAMTERGEBNIS:', alleBestanden ? 'PASS' : 'FAIL');

    if (!alleBestanden) {
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
