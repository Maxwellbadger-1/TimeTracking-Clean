/**
 * F-7 — Messung beider Bedienwege (Stornieren vs. Ablehnen) und des verbliebenen
 * Datenbankzustands (Phase 14.2, Plan 07)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien (edge-cases.spec.ts,
 * user-creation.spec.ts, user-edit.spec.ts) bleiben unveraendert dreiteilig. Dieses Skript
 * misst tatsaechlich, was am Bildschirm erscheint, gegen den echten, laufenden Server
 * (127.0.0.1:3100) und die echte Arbeitsdatenbank (server/database/development.db):
 *
 *   1. Stornieren: Fuer den Testnutzer "Max Vollzeit" (test.vollzeit, id 15015) eine
 *      Krankmeldung anlegen (wird automatisch genehmigt, status='approved' — kein separater
 *      Genehmigungsschritt noetig), dann "Stornieren" klicken, den Bestaetigungsdialog mit
 *      einer Begruendung bestaetigen, den Sonner-Toast-Text woertlich erheben.
 *      Erwartung: "Abwesenheitsantrag storniert".
 *   2. Ablehnen: Fuer denselben Testnutzer einen zweiten Antrag anlegen, der 'pending'
 *      bleibt (Urlaub), "Ablehnen" klicken (natives window.prompt, per page.on('dialog')
 *      beantwortet), den Toast-Text woertlich erheben.
 *      Erwartung: "Abwesenheitsantrag abgelehnt" (unveraendert).
 *   3. Die verbleibende Abweichung messen, nicht behaupten: den Datenbankzustand des
 *      stornierten Antrags lesen (better-sqlite3, {readonly:true} + PRAGMA query_only = ON).
 *      Erwartung: status = 'rejected' — das ist der gemessene Beleg fuer den UAT-Punkt
 *      "Weg B" (D-09). NUR LESEN — absence_requests steht unter D-01.
 *   4. Beschriftungen: Text der Schaltflaeche "Stornieren" und Ueberschrift des
 *      Bestaetigungsdialogs woertlich erheben. Erwartung: beide sprechen von "Stornieren".
 *
 * D-01: Die beiden in diesem Lauf angelegten Antraege koennen ueber die Oberflaeche NICHT
 * wieder entfernt werden — die Aktionsspalte der Admin-Ansicht zeigt fuer status='approved'
 * ausschliesslich "Stornieren" und fuer status='rejected' gar keine Aktion mehr (kein
 * "Loeschen"-Knopf fuer Admin ausserhalb von status==='pending' bei einem eigenen Antrag
 * eines Mitarbeiters — verifiziert in AbsencesPage.tsx). Sie bleiben deshalb als
 * dokumentierter Testbestand stehen (siehe SUMMARY) statt per DELETE geglaettet zu werden.
 *
 * Aufruf: node tests/messungen/f7-storno-meldung.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';
import Database from 'better-sqlite3';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BASE_URL = 'http://localhost:1420';
const DB_PATH = path.resolve(__dirname, '../../../server/database/development.db');

const TEST_USER_LABEL = 'Max Vollzeit'; // test.vollzeit, id 15015 (14.2-CONTEXT.md, Pruefumgebung)
const STORNO_DATE = '2026-11-16';
const ABLEHN_START = '2026-11-18';
const ABLEHN_END = '2026-11-19';

const AUSGANGSBEFUND =
  'Der einzige Weg heisst Stornieren, die Erfolgsmeldung lautet Abwesenheitsantrag abgelehnt';

/** @type {{name: string, pass: boolean, wert: string}[]} */
const ergebnisse = [];

function record(name, wert, pass) {
  ergebnisse.push({ name, wert, pass });
  console.log('');
  console.log(`--- ${name} ---`);
  console.log('Gemessen:');
  console.log('  ' + JSON.stringify(wert));
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

async function goToAbsences(page) {
  await page.click('text=Abwesenheiten');
  await page.waitForSelector('text=Abwesenheiten (Alle Mitarbeiter)', { timeout: 10000 });
}

/**
 * Legt ueber "+ Neuer Antrag" einen Antrag fuer den Testnutzer an. type='sick' wird
 * automatisch genehmigt (kein separater Genehmigungsschritt), alle anderen Typen bleiben
 * 'pending'.
 */
async function createAbsence(page, { type, typeLabel, startDate, endDate }) {
  await page.click('button:has-text("+ Neuer Antrag")');
  await page.waitForSelector('text=Abwesenheit beantragen', { timeout: 10000 });

  await page.getByLabel('Mitarbeiter').selectOption({ label: TEST_USER_LABEL });
  await page.getByLabel('Art der Abwesenheit').selectOption({ label: typeLabel });
  await page.getByLabel('Von').fill(startDate);
  await page.getByLabel('Bis').fill(endDate);

  await page.click('form button[type="submit"]');

  // Modal schliesst sich nach erfolgreichem Anlegen selbststaendig (handleClose in
  // AbsenceRequestForm.tsx nach createRequest.mutateAsync).
  await page.waitForSelector('text=Abwesenheit beantragen', { state: 'hidden', timeout: 10000 });

  // Der Erfolgstoast der Anlage ("... wurde automatisch genehmigt" / "... wurde eingereicht")
  // muss verschwunden sein, BEVOR die naechste Aktion einen neuen Toast erzeugt — sonst faengt
  // ein nachfolgendes `.last()`-Warten faelschlich den noch sichtbaren Alt-Toast ab (Sonner
  // stapelt mehrere gleichzeitig sichtbare Toasts, "last" ist dann nicht zwingend "neuester").
  await page
    .waitForFunction(() => document.querySelectorAll('[data-sonner-toast]').length === 0, {
      timeout: 8000,
    })
    .catch(() => {});
}

/** Filtert die Antragsliste auf den Testnutzer, damit die neu angelegte Zeile eindeutig ist. */
async function filterByTestUser(page) {
  const userFilterSelect = page.locator('select', {
    has: page.locator('option', { hasText: 'Alle Mitarbeiter' }),
  });
  await userFilterSelect.selectOption({ label: TEST_USER_LABEL });
}

async function resetFilters(page) {
  const resetButton = page.locator('button:has-text("Filter zurücksetzen")');
  if (await resetButton.isVisible().catch(() => false)) {
    await resetButton.click();
  }
}

function readAbsenceRequestReadonly(id) {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  try {
    const row = db
      .prepare('SELECT id, status, adminNote FROM absence_requests WHERE id = ?')
      .get(id);
    return row;
  } finally {
    db.close();
  }
}

function findLatestRequestIdForUser(userId, startDate) {
  const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
  db.pragma('query_only = ON');
  try {
    const row = db
      .prepare(
        'SELECT id, status FROM absence_requests WHERE userId = ? AND startDate = ? ORDER BY id DESC LIMIT 1'
      )
      .get(userId, startDate);
    return row;
  } finally {
    db.close();
  }
}

async function main() {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  let alleBestanden = true;

  const TEST_USER_ID = 15015; // test.vollzeit — read-only bestaetigt gegen development.db

  try {
    await login(page);
    await goToAbsences(page);

    // ============================================================
    // Beschriftungen VOR dem Vorgang — Schaltflaeche & Dialogueberschrift
    // ============================================================
    console.log('');
    console.log('=== Fall 1: Stornieren (genehmigter Antrag) ===');

    await createAbsence(page, {
      type: 'sick',
      typeLabel: 'Krankmeldung',
      startDate: STORNO_DATE,
      endDate: STORNO_DATE,
    });

    const stornoRow = findLatestRequestIdForUser(TEST_USER_ID, STORNO_DATE);
    if (!stornoRow) {
      throw new Error('Angelegter Storno-Testantrag wurde in der Datenbank nicht gefunden.');
    }
    console.log(`Angelegter Testantrag (Storno-Fall): id=${stornoRow.id}, status=${stornoRow.status}`);
    const stornoStatusVorher = stornoRow.status;
    const stornoStatusVorherPass = stornoStatusVorher === 'approved';
    record(
      'Vorbedingung: Krankmeldung ist automatisch genehmigt (status vor dem Storno)',
      stornoStatusVorher,
      stornoStatusVorherPass
    );
    alleBestanden = alleBestanden && stornoStatusVorherPass;

    await filterByTestUser(page);

    const stornoBadgeRow = page.locator('div.p-4', { hasText: 'Krankmeldung' }).first();
    await stornoBadgeRow.waitFor({ state: 'visible', timeout: 10000 });

    // Beschriftung der Schaltflaeche woertlich erheben, BEVOR geklickt wird.
    const stornoButton = stornoBadgeRow.locator('button:has-text("Stornieren")');
    await stornoButton.waitFor({ state: 'visible', timeout: 10000 });
    const stornoButtonText = (await stornoButton.textContent())?.trim() ?? '';
    const stornoButtonPass = stornoButtonText.includes('Stornieren');
    record('Beschriftung der Schaltflaeche (vor dem Klick)', stornoButtonText, stornoButtonPass);
    alleBestanden = alleBestanden && stornoButtonPass;

    await stornoButton.click();

    // Ueberschrift des Bestaetigungsdialogs woertlich erheben.
    await page.waitForSelector('.fixed', { timeout: 10000 }); // Modal-Overlay
    const dialogTitle = page.locator('h2, h3').filter({ hasText: /storniere/i }).first();
    let dialogTitleText = '';
    if (await dialogTitle.isVisible().catch(() => false)) {
      dialogTitleText = (await dialogTitle.textContent())?.trim() ?? '';
    } else {
      // Fallback: Modal-Titelzone durchsuchen, falls Selektor oben nichts trifft.
      dialogTitleText = (await page.locator('text=/storniere/i').first().textContent().catch(() => '')) ?? '';
    }
    const dialogTitlePass = /storniere/i.test(dialogTitleText) && !/ablehn/i.test(dialogTitleText);
    record('Ueberschrift des Bestaetigungsdialogs', dialogTitleText, dialogTitlePass);
    alleBestanden = alleBestanden && dialogTitlePass;

    await page.fill('#cancelReason', 'F-7-Messung: Stornierung eines genehmigten Testantrags (Plan 14.2-07)');
    await page.click('button:has-text("Urlaub stornieren")');

    const stornoToastLocator = page.locator('[data-sonner-toast] [data-title]').last();
    await stornoToastLocator.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(300);
    const stornoToastText = (await stornoToastLocator.evaluate((el) => el.textContent?.trim() ?? '')) ?? '';
    const stornoToastPass = stornoToastText === 'Abwesenheitsantrag storniert';
    record('Gemessener Hinweistext nach dem Stornieren', stornoToastText, stornoToastPass);
    alleBestanden = alleBestanden && stornoToastPass;

    await stornoToastLocator.waitFor({ state: 'hidden', timeout: 8000 }).catch(() => {});

    // ============================================================
    // Fall 2: Ablehnen (offener Antrag)
    // ============================================================
    console.log('');
    console.log('=== Fall 2: Ablehnen (offener Antrag) ===');

    await resetFilters(page);

    await createAbsence(page, {
      type: 'vacation',
      typeLabel: 'Urlaub',
      startDate: ABLEHN_START,
      endDate: ABLEHN_END,
    });

    const ablehnRow = findLatestRequestIdForUser(TEST_USER_ID, ABLEHN_START);
    if (!ablehnRow) {
      throw new Error('Angelegter Ablehn-Testantrag wurde in der Datenbank nicht gefunden.');
    }
    console.log(`Angelegter Testantrag (Ablehn-Fall): id=${ablehnRow.id}, status=${ablehnRow.status}`);
    const ablehnStatusVorher = ablehnRow.status;
    const ablehnStatusVorherPass = ablehnStatusVorher === 'pending';
    record(
      'Vorbedingung: Urlaubsantrag bleibt offen (status vor dem Ablehnen)',
      ablehnStatusVorher,
      ablehnStatusVorherPass
    );
    alleBestanden = alleBestanden && ablehnStatusVorherPass;

    await filterByTestUser(page);

    const ablehnRowLocator = page.locator('div.p-4', { hasText: 'Urlaub' }).first();
    await ablehnRowLocator.waitFor({ state: 'visible', timeout: 10000 });

    // handleReject nutzt window.prompt() — natives Dialogfenster, per page.on('dialog')
    // beantwortet (Playwright faengt es ab, es erscheint nie am Bildschirm).
    page.once('dialog', async (dialog) => {
      console.log(`  (natives prompt() abgefangen: "${dialog.message()}")`);
      await dialog.accept('F-7-Messung: Ablehnung eines offenen Testantrags (Plan 14.2-07)');
    });
    await ablehnRowLocator.locator('button:has-text("Ablehnen")').click();

    const ablehnToastLocator = page.locator('[data-sonner-toast] [data-title]').last();
    await ablehnToastLocator.waitFor({ state: 'visible', timeout: 10000 });
    await page.waitForTimeout(300);
    const ablehnToastText = (await ablehnToastLocator.evaluate((el) => el.textContent?.trim() ?? '')) ?? '';
    const ablehnToastPass = ablehnToastText === 'Abwesenheitsantrag abgelehnt';
    record('Gemessener Hinweistext nach dem Ablehnen', ablehnToastText, ablehnToastPass);
    alleBestanden = alleBestanden && ablehnToastPass;

    // ============================================================
    // Fall 3: der verbleibende Datenbankzustand — NUR LESEN (D-01)
    // ============================================================
    console.log('');
    console.log('=== Fall 3: verbleibender Datenbankzustand (nur lesen, D-01) ===');

    const stornoRowAfter = readAbsenceRequestReadonly(stornoRow.id);
    console.log(
      `SELECT id, status, adminNote FROM absence_requests WHERE id = ${stornoRow.id};`
    );
    console.log('  ' + JSON.stringify(stornoRowAfter));
    const dbStatusPass = stornoRowAfter?.status === 'rejected';
    record(
      'Datenbankzustand des stornierten Antrags (status)',
      String(stornoRowAfter?.status),
      dbStatusPass
    );
    alleBestanden = alleBestanden && dbStatusPass;

    // ============================================================
    // Zusammenfassung
    // ============================================================
    console.log('');
    console.log('=== Zusammenfassung ===');
    console.log('Ausgangsbefund (vor F-7):');
    console.log('  ' + AUSGANGSBEFUND);
    console.log('');
    for (const r of ergebnisse) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${JSON.stringify(r.wert)}`);
    }

    console.log('');
    console.log('Verbliebener Testbestand (D-01 — ueber die Oberflaeche nicht entfernbar, siehe');
    console.log('Kopfkommentar dieses Skripts und SUMMARY):');
    console.log(`  absence_requests.id = ${stornoRow.id} (Storno-Fall, status='rejected')`);
    console.log(`  absence_requests.id = ${ablehnRow.id} (Ablehn-Fall, status='rejected')`);

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
