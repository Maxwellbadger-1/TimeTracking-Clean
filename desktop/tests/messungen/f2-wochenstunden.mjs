/**
 * F-2 — Messung der angezeigten Wochenstunden vor und nach dem Stichtag
 * (Phase 14.2, Plan 08)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien (edge-cases.spec.ts,
 * user-creation.spec.ts, user-edit.spec.ts) bleiben unveraendert dreiteilig. Dieses Skript
 * misst tatsaechlich, was am Bildschirm steht, gegen den echten laufenden Server
 * (127.0.0.1:3100) und die echte Arbeitsdatenbank (server/database/development.db).
 *
 * Gemessen werden VIER Anzeigestellen je Fall:
 *   (1) Kachel "Arbeitszeitmodell" auf dem Mitarbeiterdashboard  (WorkScheduleDisplay compact)
 *   (2) "Gesamt …h" in der Detailansicht desselben Bausteins      (WorkScheduleDisplay detailed)
 *   (3) Spalte "Stunden/Woche" der Nutzerliste (als Admin)        (UserManagementPage)
 *   (4) Zeile "{…}/Woche" auf der Mitarbeiterkachel des Admin-Dashboards (AdminDashboard)
 *
 * Der Sollwert wird NICHT angenommen, sondern aus GET /api/work-periods?userId=<id> gelesen
 * und mit derselben Regel aufgeloest wie Server und Desktop:
 *   validFrom <= heute AND (validTo IS NULL OR validTo > heute)
 *
 * Fall A — Stichtag in der VERGANGENHEIT: Nutzer 48717 (abnahme.vollstaendig), Periode
 *   id 22956, 30 h ab 17.08.2026, waehrend die Stammdaten 40 h tragen. Ausgangsbefund NB-2:
 *   angezeigt 40, gueltig 30.
 * Fall B — Stichtag in der ZUKUNFT: Fuer Nutzer 48714 wird ueber die Oberflaeche
 *   (Mitarbeiter -> Bearbeiten -> "Stundenwechsel ab Datum …") ein Wechsel mit einem Stichtag
 *   NACH heute angelegt. Erwartung: alle vier Zahlen zeigen weiterhin die HEUTE gueltigen
 *   Stunden; die kuenftige Periode wird nicht vorweggenommen. Zusaetzlich wird die Zeile
 *   "Aktuell gueltiges Modell seit {Datum}" erhoben.
 * Fall C — Ladefehler: Die Route **\/api/work-periods** wird auf HTTP 500 gelegt und die
 *   Kachel erneut erhoben. Erwartung: es steht eine Zahl da (der Stammdatenwert), nicht
 *   "NaN", nicht leer, nicht "undefined".
 *
 * D-01: Dieses Skript schreibt in `user_work_periods` (Fall B) — diese Tabelle steht NICHT
 * unter D-01. Die fuenf geschuetzten Tabellen (time_entries, absence_requests,
 * overtime_corrections, vacation_balance, vacation_transactions) werden weder gelesen noch
 * geschrieben. Die in Fall B angelegte Periode bleibt als dokumentierter Testbestand stehen
 * (siehe SUMMARY und deferred-items.md).
 *
 * Aufruf: node tests/messungen/f2-wochenstunden.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';
const API_URL = 'http://127.0.0.1:3100/api';

const FALL_A = {
  id: 48717,
  username: 'abnahme.vollstaendig',
  password: 'Abnahme12345!',
  anzeigename: 'Abnahme Vollstaendig',
  stammdatenWeeklyHours: 40,
};

const FALL_B = {
  id: 48714,
  username: 't1109-modellwechsel-2026-05-14',
  password: 'ModellwechselTest12345!',
  anzeigename: 'Modellwechsel Testnutzer',
  stammdatenWeeklyHours: 40,
  kuenftigeWeeklyHours: 12,
};

const AUSGANGSBEFUND =
  'NB-2: Mitarbeiterdashboard zeigte "Arbeitszeitmodell 40h/Woche" und "Gesamt 40h", ' +
  'waehrend die seit 17.08.2026 gueltige Periode 30 h trug und die Sollstundenrechnung ' +
  'des Monats ihr folgte (122:00h). Nutzerliste zeigte nach dem Wechsel auf 20 h weiterhin 40h.';

/** @type {{fall: string, stelle: string, angezeigt: string, soll: string, gleich: boolean}[]} */
const messzeilen = [];
/** @type {{name: string, wert: string, pass: boolean}[]} */
const ergebnisse = [];
let alleBestanden = true;

function record(name, wert, pass) {
  ergebnisse.push({ name, wert: String(wert), pass });
  alleBestanden = alleBestanden && pass;
  console.log('');
  console.log(`--- ${name} ---`);
  console.log('  Gemessen: ' + JSON.stringify(wert));
  console.log('  ' + (pass ? 'PASS' : 'FAIL'));
}

function messzeile(fall, stelle, angezeigt, soll, gleich) {
  messzeilen.push({ fall, stelle, angezeigt: String(angezeigt), soll: String(soll), gleich });
}

/** Heutiges Datum als YYYY-MM-DD aus lokalen Kalenderteilen — nie toISOString(). */
function heute() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/** Datum relativ zu heute, YYYY-MM-DD, aus lokalen Kalenderteilen. */
function heutePlus(tage) {
  const d = new Date();
  d.setDate(d.getDate() + tage);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

/**
 * Zeichengleich zu `resolveWorkPeriodIn()` (Server) und `resolveWorkTimePeriodIn()`
 * (Desktop). Bewusst nachgebaut statt angenommen — der Sollwert dieser Messung darf nicht
 * aus derselben Quelle stammen, die gemessen wird.
 */
function resolvePeriod(periods, date) {
  for (const p of periods) {
    if (p.validFrom <= date && (p.validTo === null || p.validTo > date)) return p;
  }
  return null;
}

/** Erste Zahl einer Zeichenkette. "30:00h/Woche" -> 30, "30h" -> 30. */
function ersteZahl(text) {
  const m = /(-?\d+(?:[.,]\d+)?)/.exec(text ?? '');
  if (!m) return null;
  return Number(m[1].replace(',', '.'));
}

function istUnbrauchbar(text) {
  const t = (text ?? '').trim();
  return t === '' || t.includes('NaN') || t.includes('undefined') || t.includes('null');
}

// ---------------------------------------------------------------------------
// Serverseitiger Sollwert — eigener API-Weg mit eigener Sitzung
// ---------------------------------------------------------------------------

let adminCookie = '';

async function apiLoginAdmin() {
  const res = await fetch(`${API_URL}/auth/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: 'admin', password: 'admin123' }),
  });
  if (!res.ok) throw new Error(`API-Anmeldung fehlgeschlagen: HTTP ${res.status}`);
  const raw = res.headers.getSetCookie?.() ?? [];
  adminCookie = raw.map((c) => c.split(';')[0]).join('; ');
  if (!adminCookie) throw new Error('API-Anmeldung lieferte kein Sitzungs-Cookie');
}

async function apiPeriods(userId) {
  const res = await fetch(`${API_URL}/work-periods?userId=${userId}`, {
    headers: { Cookie: adminCookie },
  });
  if (!res.ok) throw new Error(`GET /work-periods?userId=${userId}: HTTP ${res.status}`);
  const body = await res.json();
  return body.data ?? [];
}

// ---------------------------------------------------------------------------
// Oberflaechen-Helfer
// ---------------------------------------------------------------------------

async function login(page, username, password) {
  await page.goto(BASE_URL + '/');
  await page.waitForSelector('[name="username"]', { timeout: 15000 });
  await page.fill('[name="username"]', username);
  await page.fill('[name="password"]', password);
  await page.click('button[type="submit"]');
  await page.waitForLoadState('networkidle');
}

/**
 * Der DSGVO-Zustimmungsdialog (`PrivacyPolicyModal`) legt sich beim ersten Anmelden eines
 * Nutzers ohne `privacyConsentAt` als Vollbild-Overlay ueber das Dashboard und faengt jeden
 * Klick ab. Er wird ueber den Produktweg beantwortet: bis ans Ende scrollen (erst dann ist
 * "Ich stimme zu" bedienbar), dann zustimmen.
 *
 * D-01: Das schreibt `users.privacyConsentAt` — `users` steht ausdruecklich NICHT unter dem
 * Datenschutz von D-01 (14.2-CONTEXT.md, D-01). Die fuenf geschuetzten Tabellen bleiben
 * unberuehrt. Der Vorgang ist im SUMMARY als Nebenwirkung der Messung benannt.
 */
async function akzeptiereDatenschutzWennNoetig(page) {
  const knopf = page.locator('button:has-text("Ich stimme zu")');
  // Der Dialog erscheint erst, nachdem der Anmeldezustand im Client angekommen ist —
  // ein sofortiges `count()` liefe ihm davon.
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

/**
 * Wartet, bis die Oberflaeche zur Ruhe gekommen ist. NOETIG, weil die Kachel waehrend der
 * noch laufenden Periodenabfrage bereits eine Zahl zeigt — die Rueckfallstufe 3
 * (Stammdaten). Das ist gewollt (die Anzeige bleibt nie leer), aber es ist NICHT der
 * Endzustand; gemessen wird, was ein Mensch sieht, nicht der Zwischenstand einer Millisekunde.
 */
async function warteBisRuhig(page) {
  await page.waitForLoadState('networkidle').catch(() => {});
  await page.waitForTimeout(1500);
}

/** (1) Kachel "Arbeitszeitmodell" auf dem Mitarbeiterdashboard. */
async function leseKachel(page) {
  const locator = page.locator('xpath=//p[normalize-space()="Arbeitszeitmodell"]/following-sibling::p[1]');
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  await warteBisRuhig(page);
  return (await locator.textContent())?.trim() ?? '';
}

/** (2) "Gesamt …h" in der Detailansicht (ueber "Details anzeigen →"). */
async function leseDetailGesamt(page) {
  await page.click('button:has-text("Details anzeigen")');
  const locator = page.locator('xpath=//p[normalize-space()="Gesamt"]/following-sibling::p[1]');
  await locator.waitFor({ state: 'visible', timeout: 20000 });
  const text = (await locator.textContent())?.trim() ?? '';
  return text;
}

/** Zeile "Aktuell gueltiges Modell seit {Datum}" in der geoeffneten Detailansicht. */
async function leseModellSeit(page) {
  const locator = page.locator('text=/Aktuell gültiges Modell seit/');
  const count = await locator.count();
  if (count === 0) return '';
  return (await locator.first().textContent())?.trim() ?? '';
}

async function schliesseDetail(page) {
  // Der Detail-Dialog traegt oben rechts einen Schliessen-Knopf (SVG-X).
  await page.keyboard.press('Escape').catch(() => {});
}

/** (3) Spalte "Stunden/Woche" der Nutzerliste (7. Spalte, siehe Tabellenkopf). */
async function leseNutzerliste(page, username) {
  await page.click('text=Mitarbeiter');
  await page.waitForSelector('text=Benutzerverwaltung', { timeout: 15000 });
  const zeile = page.locator(`tr:has-text("@${username}")`).first();
  await zeile.waitFor({ state: 'visible', timeout: 15000 });
  const zelle = zeile.locator('td').nth(6); // 0-basiert: Name,E-Mail,Rolle,Abteilung,seit,Status,Stunden/Woche
  return (await zelle.textContent())?.trim() ?? '';
}

/** (4) Zeile "{…}/Woche" auf der Mitarbeiterkachel des Admin-Dashboards. */
async function leseAdminKachel(page, anzeigename) {
  await page.click('text=Dashboard');
  await page.waitForSelector('text=Admin Dashboard', { timeout: 15000 });
  // `contains(., "/Woche")` statt `contains(text(), …)`: React rendert `{formatHours(x)}`
  // und den Literaltext `/Woche` als ZWEI Textknoten — `text()` liefert nur den ersten
  // ("30:00h") und der Treffer bliebe aus.
  const locator = page.locator(
    `xpath=//p[normalize-space()="${anzeigename}"]/ancestor::div[contains(@class,"justify-between")][1]//p[contains(., "/Woche")]`
  );
  await locator.first().waitFor({ state: 'visible', timeout: 20000 });
  return (await locator.first().textContent())?.trim() ?? '';
}

/**
 * Fall B: legt ueber die Oberflaeche einen Stundenwechsel mit einem Stichtag NACH heute an.
 * Admin -> Mitarbeiter -> Bearbeiten -> "Stundenwechsel ab Datum …".
 */
async function legeKuenftigenWechselAn(page, { username, stichtag, weeklyHours }) {
  await page.click('text=Mitarbeiter');
  await page.waitForSelector('text=Benutzerverwaltung', { timeout: 15000 });

  const zeile = page.locator(`tr:has-text("@${username}")`).first();
  await zeile.waitFor({ state: 'visible', timeout: 15000 });
  await zeile.locator('button:has-text("Bearbeiten")').first().click();

  await page.waitForSelector('button:has-text("Stundenwechsel ab Datum")', { timeout: 15000 });
  await page.click('button:has-text("Stundenwechsel ab Datum")');

  await page.waitForSelector('text=Was diese Umstellung bewirkt', { timeout: 15000 });

  await page.getByLabel('Stichtag').fill(stichtag);
  await page.getByLabel('Neue Wochenstunden').fill(String(weeklyHours));
  await page
    .getByLabel('Begründung')
    .fill('Messung F-2 (Plan 14.2-08): kuenftiger Stichtag darf die Anzeige nicht vorwegnehmen');

  // Vorschau abwarten — der Zustand "future" traegt die Marke "Keine Rückwirkung".
  await page.waitForSelector('text=Keine Rückwirkung', { timeout: 30000 });

  const speichern = page.locator('button:has-text("Stundenwechsel speichern")').first();
  await speichern.waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForFunction(
    () => {
      const btns = Array.from(document.querySelectorAll('button'));
      const b = btns.find((x) => x.textContent?.includes('Stundenwechsel speichern'));
      return !!b && !b.disabled;
    },
    undefined,
    { timeout: 30000 }
  );
  await speichern.click();

  await page.waitForSelector('text=Stundenwechsel gespeichert', { timeout: 30000 });
  await page.keyboard.press('Escape').catch(() => {});
  await page.waitForTimeout(1500);
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

async function main() {
  const HEUTE = heute();
  const STICHTAG_ZUKUNFT = heutePlus(30);

  console.log('=== F-2 — Messung der Wochenstunden vor und nach dem Stichtag ===');
  console.log('Heute (lokal, Europe/Berlin):', HEUTE);
  console.log('Kuenftiger Stichtag fuer Fall B:', STICHTAG_ZUKUNFT);
  console.log('');
  console.log('Ausgangsbefund:');
  console.log('  ' + AUSGANGSBEFUND);

  await apiLoginAdmin();

  const browser = await chromium.launch();
  try {
    // =====================================================================
    // Vorbereitung Fall B: kuenftigen Stichtag ueber die Oberflaeche anlegen
    // =====================================================================
    const adminContext = await browser.newContext();
    const adminPage = await adminContext.newPage();
    await login(adminPage, 'admin', 'admin123');
    await adminPage.waitForSelector('text=Admin Dashboard', { timeout: 20000 });

    const periodsBVorher = await apiPeriods(FALL_B.id);
    const hatSchonZukunft = periodsBVorher.some((p) => p.validFrom > HEUTE);
    if (!hatSchonZukunft) {
      console.log('');
      console.log('=== Fall B, Vorbereitung: kuenftigen Stundenwechsel ueber die Oberflaeche anlegen ===');
      await legeKuenftigenWechselAn(adminPage, {
        username: FALL_B.username,
        stichtag: STICHTAG_ZUKUNFT,
        weeklyHours: FALL_B.kuenftigeWeeklyHours,
      });
    } else {
      console.log('');
      console.log('=== Fall B: es existiert bereits eine kuenftige Periode — kein zweiter Anlagelauf ===');
    }

    // =====================================================================
    // Serverseitige Sollwerte
    // =====================================================================
    const periodsA = await apiPeriods(FALL_A.id);
    const periodsB = await apiPeriods(FALL_B.id);
    const sollA = resolvePeriod(periodsA, HEUTE);
    const sollB = resolvePeriod(periodsB, HEUTE);
    if (!sollA) throw new Error(`Fall A: keine heute gueltige Periode fuer Nutzer ${FALL_A.id}`);
    if (!sollB) throw new Error(`Fall B: keine heute gueltige Periode fuer Nutzer ${FALL_B.id}`);

    const kuenftigB = periodsB.filter((p) => p.validFrom > HEUTE).sort((a, b) => (a.validFrom < b.validFrom ? -1 : 1))[0] ?? null;

    console.log('');
    console.log('=== Serverseitig gueltige Perioden (GET /api/work-periods, zu heute aufgeloest) ===');
    console.log(`  Fall A, Nutzer ${FALL_A.id}: id=${sollA.id} validFrom=${sollA.validFrom} validTo=${sollA.validTo} weeklyHours=${sollA.weeklyHours}`);
    console.log(`  Fall B, Nutzer ${FALL_B.id}: id=${sollB.id} validFrom=${sollB.validFrom} validTo=${sollB.validTo} weeklyHours=${sollB.weeklyHours}`);
    if (kuenftigB) {
      console.log(`  Fall B, kuenftige Periode: id=${kuenftigB.id} validFrom=${kuenftigB.validFrom} weeklyHours=${kuenftigB.weeklyHours}`);
    }

    // =====================================================================
    // (3) und (4) als Admin — beide Faelle
    // =====================================================================
    for (const [fallName, fall, soll] of [
      ['Fall A', FALL_A, sollA],
      ['Fall B', FALL_B, sollB],
    ]) {
      const listeText = await leseNutzerliste(adminPage, fall.username);
      const listeZahl = ersteZahl(listeText);
      const listePass = !istUnbrauchbar(listeText) && listeZahl === soll.weeklyHours;
      record(`${fallName} (3) Nutzerliste, Spalte "Stunden/Woche" — Nutzer ${fall.id}`, listeText, listePass);
      messzeile(fallName, '(3) Nutzerliste "Stunden/Woche"', listeText, `${soll.weeklyHours} h (Periode ${soll.id} ab ${soll.validFrom})`, listePass);

      const kachelText = await leseAdminKachel(adminPage, fall.anzeigename);
      const kachelZahl = ersteZahl(kachelText);
      const kachelPass = !istUnbrauchbar(kachelText) && kachelZahl === soll.weeklyHours;
      record(`${fallName} (4) Admin-Dashboard, Mitarbeiterkachel — Nutzer ${fall.id}`, kachelText, kachelPass);
      messzeile(fallName, '(4) Admin-Dashboard Mitarbeiterkachel', kachelText, `${soll.weeklyHours} h (Periode ${soll.id} ab ${soll.validFrom})`, kachelPass);
    }

    await adminContext.close();

    // =====================================================================
    // (1) und (2) je Mitarbeiter
    // =====================================================================
    for (const [fallName, fall, soll] of [
      ['Fall A', FALL_A, sollA],
      ['Fall B', FALL_B, sollB],
    ]) {
      const ctx = await browser.newContext();
      const page = await ctx.newPage();
      await login(page, fall.username, fall.password);
      const zugestimmt = await akzeptiereDatenschutzWennNoetig(page);
      if (zugestimmt) {
        console.log('');
        console.log(`  Hinweis: DSGVO-Zustimmungsdialog fuer ${fall.username} ueber den Produktweg beantwortet (schreibt users.privacyConsentAt — nicht D-01-geschuetzt).`);
      }
      await page.waitForSelector('text=Arbeitszeitmodell', { timeout: 25000 });

      const kachelText = await leseKachel(page);
      const kachelZahl = ersteZahl(kachelText);
      const kachelPass = !istUnbrauchbar(kachelText) && kachelZahl === soll.weeklyHours;
      record(`${fallName} (1) Kachel "Arbeitszeitmodell" — Nutzer ${fall.id}`, kachelText, kachelPass);
      messzeile(fallName, '(1) Kachel "Arbeitszeitmodell"', kachelText, `${soll.weeklyHours} h (Periode ${soll.id} ab ${soll.validFrom})`, kachelPass);

      const detailText = await leseDetailGesamt(page);
      const detailZahl = ersteZahl(detailText);
      const detailPass = !istUnbrauchbar(detailText) && detailZahl === soll.weeklyHours;
      record(`${fallName} (2) Detailansicht "Gesamt" — Nutzer ${fall.id}`, detailText, detailPass);
      messzeile(fallName, '(2) Detailansicht "Gesamt"', detailText, `${soll.weeklyHours} h (Periode ${soll.id} ab ${soll.validFrom})`, detailPass);

      const modellSeit = await leseModellSeit(page);
      if (fallName === 'Fall B') {
        // Die Zeile muss das Datum der HEUTE gueltigen Periode nennen, nicht das des
        // kuenftigen Stichtags.
        const erwartetesDatum = new Date(soll.validFrom + 'T12:00:00').toLocaleDateString('de-DE');
        const kuenftigesDatum = kuenftigB
          ? new Date(kuenftigB.validFrom + 'T12:00:00').toLocaleDateString('de-DE')
          : '(keine)';
        const seitPass = modellSeit.includes(erwartetesDatum) && !modellSeit.includes(kuenftigesDatum);
        record(
          `${fallName} Zeile "Aktuell gueltiges Modell seit …" (erwartet ${erwartetesDatum}, NICHT ${kuenftigesDatum})`,
          modellSeit,
          seitPass
        );
        messzeile(fallName, 'Zeile "Aktuell gueltiges Modell seit …"', modellSeit, `${erwartetesDatum} (heute gueltige Periode), NICHT ${kuenftigesDatum}`, seitPass);
      } else {
        console.log('');
        console.log(`--- ${fallName} Zeile "Aktuell gueltiges Modell seit …" (nur erhoben) ---`);
        console.log('  Gemessen: ' + JSON.stringify(modellSeit));
      }

      await schliesseDetail(page);

      // ===================================================================
      // Fall C nur einmal, am Nutzer des Falls A (Stammdaten 40 h,
      // Periode 30 h — die beiden Zahlen sind unterscheidbar)
      // ===================================================================
      if (fallName === 'Fall A') {
        console.log('');
        console.log('=== Fall C: Periodenabfrage auf HTTP 500 gelegt — die Anzeige darf nicht leer bleiben ===');
        await page.route('**/api/work-periods**', (route) =>
          route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ success: false, error: 'Failed to load work periods' }),
          })
        );
        await page.reload();
        await page.waitForSelector('text=Arbeitszeitmodell', { timeout: 25000 });
        const cText = await leseKachel(page);
        const cZahl = ersteZahl(cText);
        const cPass = !istUnbrauchbar(cText) && cZahl === fall.stammdatenWeeklyHours;
        record(
          `Fall C (1) Kachel bei Ladefehler — erwartet der Stammdatenwert ${fall.stammdatenWeeklyHours} h, keine leere Zahl`,
          cText,
          cPass
        );
        messzeile('Fall C', '(1) Kachel "Arbeitszeitmodell" bei HTTP 500', cText, `${fall.stammdatenWeeklyHours} h (Stammdaten, Rueckfallstufe 3)`, cPass);
        await page.unroute('**/api/work-periods**');
      }

      await ctx.close();
    }

    // =====================================================================
    // Zusammenfassung
    // =====================================================================
    console.log('');
    console.log('=== Messtabelle (Fall | Anzeigestelle | angezeigt | serverseitig gueltig | gleich?) ===');
    console.log('| Fall | Anzeigestelle | angezeigt | serverseitig gueltig | gleich? |');
    console.log('|---|---|---|---|---|');
    for (const z of messzeilen) {
      console.log(`| ${z.fall} | ${z.stelle} | \`${z.angezeigt}\` | ${z.soll} | ${z.gleich ? 'Ja' : 'Nein'} |`);
    }

    console.log('');
    console.log('=== Einzelergebnisse ===');
    for (const r of ergebnisse) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${JSON.stringify(r.wert)}`);
    }

    console.log('');
    console.log('Messzeilen gesamt:', messzeilen.length);
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
