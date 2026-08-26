/**
 * D-2 — Trefferflaechen der Aktionszelle, gemessen statt abgeleitet
 * (Phase 14.2, Plan 11, Task 2)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien
 * (edge-cases.spec.ts, user-creation.spec.ts, user-edit.spec.ts) bleiben
 * unveraendert dreiteilig.
 *
 * MESSVORSCHRIFT (D-12): Mit `getBoundingClientRect()` gemessen, nicht aus
 * Klassennamen abgeleitet — hier ist das das richtige Werkzeug, weil es um die
 * TATSAECHLICHE GROESSE geht, nicht um Ueberdeckung (letzteres waere ein Fall
 * fuer `document.elementFromPoint()`, siehe D-10/F-8).
 *
 * Gemessen werden alle drei Bedienelemente der Aktionszelle der Periodenliste
 * (`workTimePeriodActions.tsx`) bei ZWEI Viewportbreiten — 600 x 900 (unterhalb
 * der `sm`-Grenze 640 px, der im Befund gemessene Fall) und 1280 x 900 (oberhalb,
 * wo die `sm:`-Klassen greifen):
 *
 *   - "Korrigieren"            button[aria-label="Korrigieren"]
 *   - Chip "Nicht loeschbar"   span[role="note"]
 *   - "Loeschen"               button[aria-label="Loeschen"]
 *
 * Je Element und Viewport wird zusaetzlich `getComputedStyle().padding`
 * protokolliert — das ist der Beleg dafuer, WELCHE Polsterung tatsaechlich
 * gewonnen hat (T-14.2-11-05).
 *
 * D-01: Dieses Skript SPEICHERT NICHTS. Es oeffnet nur `EditUserModal` im
 * Lesemodus (Periodenliste) und schliesst es wieder ueber "Abbrechen". Keine
 * der fuenf geschuetzten Tabellen und kein `user_work_periods` wird
 * geschrieben.
 *
 * Aufruf: node tests/messungen/d2-trefferflaechen.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';

/** Testnutzer mit fuenf Perioden — hat garantiert eine "Nicht loeschbar"-Zeile
 *  UND mehrere "Loeschen"-Zeilen (14.2-CONTEXT.md, Pruefumgebung). */
const NUTZER = {
  username: 'abnahme.vollstaendig',
  anzeigename: 'Abnahme Vollstaendig',
};

/** Ausgangswerte aus 14-ABNAHME-SICHT.md § 5, 13-U10 (woertlich uebernommen). */
const AUSGANGSWERTE = {
  korrigieren: { breite: 40, hoehe: 28 },
  chip: { breite: 32, hoehe: 24 },
};

const SOLL_MIN = 32;

const VIEWPORTS = [
  { name: '600 x 900 (unter sm)', width: 600, height: 900 },
  { name: '1280 x 900 (ueber sm)', width: 1280, height: 900 },
];

/** @type {{element: string, viewport: string, breite: number, hoehe: number, padding: string, soll: number, bestanden: boolean}[]} */
const messungen = [];
let alleBestanden = true;

async function login(page) {
  await page.goto(BASE_URL + '/');
  await page.waitForSelector('[name="username"]', { timeout: 20000 });
  await page.fill('[name="username"]', 'admin');
  await page.fill('[name="password"]', 'admin123');
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

/** DSGVO-Zustimmung ueber den Produktweg beantworten, falls sie erscheint. */
async function akzeptiereDatenschutzWennNoetig(page) {
  const knopf = page.locator('button:has-text("Ich stimme zu")');
  try {
    await knopf.first().waitFor({ state: 'visible', timeout: 8000 });
  } catch {
    return false;
  }
  const inhalt = page.locator('div.overflow-y-auto.max-h-\\[60vh\\]').first();
  for (let i = 0; i < 20; i++) {
    if (await knopf.first().isEnabled()) break;
    await inhalt.evaluate((el) => {
      el.scrollTop = el.scrollHeight;
    });
    await page.waitForTimeout(200);
  }
  await knopf.first().click();
  await knopf.first().waitFor({ state: 'detached', timeout: 20000 });
  await page.waitForTimeout(1000);
  return true;
}

async function oeffneNutzerbearbeitung(page) {
  await page.click('text=Mitarbeiter');
  await page.waitForSelector('text=Benutzerverwaltung', { timeout: 20000 });
  const zeile = page.locator(`tr:has-text("@${NUTZER.username}")`).first();
  await zeile.waitFor({ state: 'visible', timeout: 20000 });
  await zeile.locator('button:has-text("Bearbeiten")').first().click();
  await page.waitForSelector('text=Arbeitszeitmodell — Perioden', { timeout: 20000 });
  await page.waitForTimeout(1500);
}

async function schliesseNutzerbearbeitung(page) {
  const dialog = page.locator('div[role="dialog"]', { hasText: 'Benutzer bearbeiten' }).last();
  await dialog.locator('button:has-text("Abbrechen")').last().click();
  await page.waitForTimeout(1000);
}

/** Misst ein Element per `getBoundingClientRect()` + `getComputedStyle().padding`. */
async function misseElement(locator) {
  const handle = await locator.elementHandle();
  if (!handle) return null;
  return await handle.evaluate((el) => {
    const rect = el.getBoundingClientRect();
    const style = getComputedStyle(el);
    return {
      breite: Math.round(rect.width * 100) / 100,
      hoehe: Math.round(rect.height * 100) / 100,
      padding: style.padding,
    };
  });
}

function record(element, viewportName, ergebnis) {
  if (!ergebnis) {
    alleBestanden = false;
    messungen.push({
      element,
      viewport: viewportName,
      breite: NaN,
      hoehe: NaN,
      padding: '(Element nicht gefunden)',
      soll: SOLL_MIN,
      bestanden: false,
    });
    console.log(`--- ${element} @ ${viewportName} --- FAIL (Element nicht gefunden)`);
    return;
  }
  const bestanden = ergebnis.breite >= SOLL_MIN && ergebnis.hoehe >= SOLL_MIN;
  alleBestanden = alleBestanden && bestanden;
  messungen.push({
    element,
    viewport: viewportName,
    breite: ergebnis.breite,
    hoehe: ergebnis.hoehe,
    padding: ergebnis.padding,
    soll: SOLL_MIN,
    bestanden,
  });
  console.log(
    `--- ${element} @ ${viewportName} --- ${ergebnis.breite} x ${ergebnis.hoehe} px, padding: ${ergebnis.padding} — ${bestanden ? 'PASS' : 'FAIL'}`
  );
}

async function main() {
  console.log('=== D-2 — Trefferflaechen der Aktionszelle, gemessen bei zwei Viewportbreiten ===');
  console.log('Ausgangswerte (13-U10): Korrigieren ' + AUSGANGSWERTE.korrigieren.breite + ' x ' + AUSGANGSWERTE.korrigieren.hoehe + ' px, Chip ' + AUSGANGSWERTE.chip.breite + ' x ' + AUSGANGSWERTE.chip.hoehe + ' px. Soll: >= ' + SOLL_MIN + ' x ' + SOLL_MIN + ' px.');

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: VIEWPORTS[0] });
    const page = await ctx.newPage();

    await login(page);
    await akzeptiereDatenschutzWennNoetig(page);
    await page.waitForSelector('text=Admin Dashboard', { timeout: 25000 });

    await oeffneNutzerbearbeitung(page);

    for (const viewport of VIEWPORTS) {
      console.log('');
      console.log(`##### Viewport ${viewport.name} #####`);
      await page.setViewportSize({ width: viewport.width, height: viewport.height });
      await page.waitForTimeout(500);

      const korrigierKnopf = page.locator('button[aria-label="Korrigieren"]').first();
      await korrigierKnopf.waitFor({ state: 'visible', timeout: 10000 });
      record('Korrigieren', viewport.name, await misseElement(korrigierKnopf));

      const chip = page.locator('span[role="note"]').first();
      await chip.waitFor({ state: 'visible', timeout: 10000 });
      record('Chip "Nicht löschbar"', viewport.name, await misseElement(chip));

      const loeschKnopf = page.locator('button[aria-label="Löschen"]').first();
      await loeschKnopf.waitFor({ state: 'visible', timeout: 10000 });
      record('Löschen', viewport.name, await misseElement(loeschKnopf));
    }

    await schliesseNutzerbearbeitung(page);
    await ctx.close();
  } finally {
    await browser.close();
  }

  console.log('');
  console.log('=== Zusammenfassung ===');
  console.table(messungen.map((m) => ({
    Element: m.element,
    Viewport: m.viewport,
    Breite: m.breite,
    Hoehe: m.hoehe,
    Padding: m.padding,
    Soll: m.soll,
    'Ja/Nein': m.bestanden ? 'Ja' : 'Nein',
  })));

  console.log('');
  console.log(`Gesamtergebnis: ${alleBestanden ? 'ALLE BESTANDEN' : 'MINDESTENS EINE UNTERSCHREITUNG'}`);
  console.log(JSON.stringify(messungen));

  if (!alleBestanden) {
    process.exitCode = 1;
  }
}

main().catch((err) => {
  console.error('Messung fehlgeschlagen:', err);
  process.exitCode = 1;
});
