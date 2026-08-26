/**
 * F-8 — Erreicht die Kollisionsinformation den Anwender?
 * (Phase 14.2, Plan 09)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien (edge-cases.spec.ts,
 * user-creation.spec.ts, user-edit.spec.ts) bleiben unveraendert dreiteilig. Dieses Skript
 * misst gegen den echten laufenden Server (127.0.0.1:3100) und die echte Arbeitsdatenbank
 * (server/database/development.db).
 *
 * ------------------------------------------------------------------------------------
 * MESSVORSCHRIFT (D-10): ausschliesslich `document.elementFromPoint()`.
 *
 * `getBoundingClientRect()` kann NICHT feststellen, ob ein Element ueberdeckt oder vom
 * Container beschnitten ist — ein vollstaendig verdecktes Element hat trotzdem eine
 * Bounding-Box. Diese Falle ist in diesem Projekt dreimal zugeschnappt (zuletzt V-2,
 * `WorkTimePeriodList.tsx:186-199`). `getBoundingClientRect()` wird hier deshalb
 * AUSSCHLIESSLICH zur Bestimmung des Mittelpunkts benutzt, nie als Beleg fuer
 * Sichtbarkeit. Der Beleg ist immer: welches Element liefert `document.elementFromPoint(x, y)`?
 * ------------------------------------------------------------------------------------
 *
 * Vier Zustaende:
 *   Zustand 1 — Wechsel-Dialog offen, kollidierender Stichtag 17.08.2026 eingetragen.
 *               Gemessen: das neue Kollisionspanel (F-8 Teil a), der unveraenderte
 *               Feldfehler und die Sperre des Speichern-Knopfes (D-10). Zusaetzlich als
 *               Kontrollmessung die markierte Zeile in der Liste — sie liegt weiterhin
 *               unter dem Dialog, denn die z-Index-Stapelung bleibt unangetastet
 *               (P12-31/P12-5). Genau deshalb muss die Information IM Dialog stehen.
 *   Zustand 2 — Wechsel-Dialog ueber "Abbrechen" geschlossen. Gemessen: die markierte
 *               Zeile in der Periodenliste (F-8 Teil b).
 *               Ausgangsbefund zum Vergleich: `bg rgba(0, 0, 0, 0)`, `borderLeft 0px`.
 *   Zustand 3 — kollisionsfreier Stichtag eingegeben, Vorschau abgewartet, Dialog
 *               geschlossen. Erwartung: keine Zeile traegt mehr eine Markierung.
 *   Zustand 4 — Zustand 2 im Dunkelmodus, nachdem
 *               `document.documentElement.classList.contains('dark') === true` bestaetigt
 *               ist.
 *
 * Zusaetzlich: Kontrast JEDES Textknotens des neuen Kollisionspanels, hell und dunkel, mit
 * aufgeloesten Alpha- und Elternhintergruenden. Soll >= 4,5:1 (D-11/Plan 14.2-10 darf durch
 * dieses neue Element nicht verschlechtert werden).
 *
 * D-01: Dieses Skript SPEICHERT NICHTS. Es traegt einen Stichtag ein und bricht ab; der
 * Speichern-Knopf ist bei einer Kollision ohnehin gesperrt. Weder die fuenf geschuetzten
 * Tabellen (time_entries, absence_requests, overtime_corrections, vacation_balance,
 * vacation_transactions) noch `user_work_periods` werden geschrieben.
 *
 * Aufruf: node tests/messungen/f8-kollisionsmarkierung.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';
const API_URL = 'http://127.0.0.1:3100/api';

const NUTZER = {
  id: 48717,
  username: 'abnahme.vollstaendig',
  anzeigename: 'Abnahme Vollstaendig',
};

/** Der kollidierende Stichtag aus dem Abnahmeprotokoll (14-U6 Punkt 3). */
const STICHTAG_KOLLISION = '2026-08-17';
/** Erwartete kollidierende Periode laut GET /api/work-periods (wird zur Laufzeit geprueft). */
const ERWARTETE_PERIODE_ID = 22956;
/** Ein Stichtag, den keine Periode belegt (Zustand 3). */
const STICHTAG_FREI = '2026-09-15';

const FELDFEHLER_SOLL =
  'Zum 17.08.2026 existiert bereits eine Periode. Wählen Sie ein anderes Datum.';

const AUSGANGSBEFUND = [
  '14-ABNAHME-SICHT.md, 14-U6 Punkt 3 (woertlich):',
  '  "Die betroffene Zeile erhält Zellhintergrund rgb(254,242,242) und 4 px linken Rand',
  '   rgb(239,68,68) — also die Flächenmarkierung statt des beschnittenen ring. Die Umsetzung',
  '   des V-2-Fixes ist damit belegt. ABER: document.elementFromPoint() auf der markierten',
  '   Zelle trifft DIV.rounded-lg border p-4 space-y-3 … — das Vorschaupanel des',
  '   Wechsel-Dialogs; die Zeile liegt vollständig darunter. Nach dem Schließen des',
  '   Wechsel-Dialogs ist die Markierung wieder weg (bg rgba(0,0,0,0), borderLeft 0px), weil',
  '   handleClose → resetForm → onConflict(null) sie zurücknimmt."',
].join('\n');

/** @type {{name: string, wert: unknown, pass: boolean}[]} */
const ergebnisse = [];
/** @type {{zustand: string, was: string, treffer: string, stile: string, ja: boolean}[]} */
const messzeilen = [];
/** @type {{element: string, text: string, hell: number|null, dunkel: number|null}[]} */
const kontraste = [];
let alleBestanden = true;

function record(name, wert, pass) {
  ergebnisse.push({ name, wert, pass });
  alleBestanden = alleBestanden && pass;
  console.log('');
  console.log(`--- ${name} ---`);
  console.log('  Gemessen: ' + JSON.stringify(wert));
  console.log('  ' + (pass ? 'PASS' : 'FAIL'));
}

function messzeile(zustand, was, treffer, stile, ja) {
  messzeilen.push({ zustand, was, treffer, stile, ja });
}

// ---------------------------------------------------------------------------
// Serverseitiger Abgleich (eigener Weg, damit der Sollwert nicht aus der
// gemessenen Quelle stammt)
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
// Die Messfunktion — in der Seite ausgefuehrt
// ---------------------------------------------------------------------------

/**
 * Bestimmt fuer `selector` den Mittelpunkt (NUR dafuer `getBoundingClientRect()`), ruft
 * `document.elementFromPoint(x, y)` und meldet das getroffene Element als tagName +
 * className zurueck — dazu die berechneten Stile des gemessenen Elements.
 *
 * `istSelbstOderNachfahre` ist die eigentliche Aussage: trifft der Punkt das Element (oder
 * einen seiner Nachfahren), oder liegt etwas darueber?
 */
async function elementFromPointMessung(page, selector, { scrollen = true } = {}) {
  return await page.evaluate(
    ({ sel, scrollen }) => {
      /** @param {Element} el */
      function beschreibe(el) {
        if (!el) return 'null';
        const cls = typeof el.className === 'string' ? el.className : String(el.className ?? '');
        const kurz = cls.trim().replace(/\s+/g, ' ');
        return `${el.tagName}${kurz ? '.' + kurz.split(' ').join('.') : ''}`;
      }

      /**
       * Die Periodenliste im `EditUserModal` traegt keine eigene Kennung (die Datei liegt
       * ausserhalb dieses Plans und wird nicht angefasst). Sie wird deshalb ueber ihre
       * Kopfzeile gefunden — hinter dem Modal steht die Nutzertabelle mit demselben
       * `table`-Selektor, und die duerfte hier nie mitgemessen werden.
       */
      function periodenTabelle() {
        return (
          Array.from(document.querySelectorAll('table')).find(
            (t) => (t.querySelector('thead th')?.textContent ?? '').trim() === 'Gültig ab'
          ) ?? null
        );
      }
      function findeElement(kennung) {
        if (kennung === 'markierte-periodenzelle') {
          const t = periodenTabelle();
          return t ? t.querySelector('tbody tr td.border-l-4') : null;
        }
        if (kennung === 'erste-periodenzelle') {
          const t = periodenTabelle();
          return t ? t.querySelector('tbody tr td:first-child') : null;
        }
        return document.querySelector(kennung);
      }

      const el = findeElement(sel);
      if (!el) return { gefunden: false, selector: sel };

      if (scrollen) el.scrollIntoView({ block: 'center', inline: 'center' });

      // getBoundingClientRect() AUSSCHLIESSLICH zur Mittelpunktbestimmung (D-10).
      const r = el.getBoundingClientRect();
      const x = Math.round(r.left + r.width / 2);
      const y = Math.round(r.top + r.height / 2);

      const treffer = document.elementFromPoint(x, y);
      const cs = getComputedStyle(el);

      return {
        gefunden: true,
        selector: sel,
        punkt: { x, y },
        imFenster: x >= 0 && y >= 0 && x < window.innerWidth && y < window.innerHeight,
        gemessenesElement: beschreibe(el),
        treffer: beschreibe(treffer),
        istSelbstOderNachfahre: !!treffer && (el === treffer || el.contains(treffer)),
        stile: {
          backgroundColor: cs.backgroundColor,
          borderLeftWidth: cs.borderLeftWidth,
          borderLeftColor: cs.borderLeftColor,
        },
      };
    },
    { sel: selector, scrollen }
  );
}

/**
 * Kontrast jedes Textknotens unterhalb von `wurzelSelector`. Elternhintergruende und
 * Alphawerte werden aufgeloest (uebereinandergelegt), nicht aus Klassennamen abgeleitet.
 */
async function kontrastMessung(page, wurzelSelector) {
  return await page.evaluate((sel) => {
    function parseFarbe(s) {
      const m = /rgba?\(([^)]+)\)/.exec(s || '');
      if (!m) return null;
      const t = m[1].split(',').map((v) => parseFloat(v.trim()));
      return { r: t[0], g: t[1], b: t[2], a: t.length > 3 ? t[3] : 1 };
    }
    function ueber(vorne, hinten) {
      const a = vorne.a;
      return {
        r: vorne.r * a + hinten.r * (1 - a),
        g: vorne.g * a + hinten.g * (1 - a),
        b: vorne.b * a + hinten.b * (1 - a),
        a: 1,
      };
    }
    /** Effektiver Hintergrund: alle Ebenen bis zur ersten deckenden, dann zusammengelegt. */
    function effektiverHintergrund(el) {
      const ebenen = [];
      let n = el;
      while (n && n.nodeType === 1) {
        const c = parseFarbe(getComputedStyle(n).backgroundColor);
        if (c && c.a > 0) {
          ebenen.push(c);
          if (c.a >= 1) break;
        }
        n = n.parentElement;
      }
      let basis = { r: 255, g: 255, b: 255, a: 1 };
      for (let i = ebenen.length - 1; i >= 0; i--) basis = ueber(ebenen[i], basis);
      return basis;
    }
    function luminanz(c) {
      const f = (v) => {
        const s = v / 255;
        return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * f(c.r) + 0.7152 * f(c.g) + 0.0722 * f(c.b);
    }
    function kontrast(vg, hg) {
      const l1 = luminanz(vg);
      const l2 = luminanz(hg);
      const hell = Math.max(l1, l2);
      const dunkel = Math.min(l1, l2);
      return (hell + 0.05) / (dunkel + 0.05);
    }

    const wurzel = document.querySelector(sel);
    if (!wurzel) return { gefunden: false };

    const knoten = Array.from(wurzel.querySelectorAll('h1,h2,h3,h4,p,span,li,strong,em'));
    const treffer = [];
    for (const el of knoten) {
      const eigenerText = Array.from(el.childNodes)
        .filter((n) => n.nodeType === 3)
        .map((n) => n.textContent)
        .join('')
        .trim();
      if (!eigenerText) continue;
      const cs = getComputedStyle(el);
      const vgRoh = parseFarbe(cs.color);
      if (!vgRoh) continue;
      const hg = effektiverHintergrund(el);
      const vg = vgRoh.a < 1 ? ueber(vgRoh, hg) : vgRoh;
      const rundHg = `rgb(${Math.round(hg.r)}, ${Math.round(hg.g)}, ${Math.round(hg.b)})`;
      const rundVg = `rgb(${Math.round(vg.r)}, ${Math.round(vg.g)}, ${Math.round(vg.b)})`;
      treffer.push({
        tag: el.tagName,
        text: eigenerText.length > 70 ? eigenerText.slice(0, 67) + '…' : eigenerText,
        fontSizePx: parseFloat(cs.fontSize),
        fontWeight: cs.fontWeight,
        vordergrund: rundVg,
        hintergrund: rundHg,
        verhaeltnis: Math.round(kontrast(vg, hg) * 100) / 100,
      });
    }
    return { gefunden: true, treffer };
  }, wurzelSelector);
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

async function oeffneNutzerbearbeitung(page, username) {
  await page.click('text=Mitarbeiter');
  await page.waitForSelector('text=Benutzerverwaltung', { timeout: 15000 });
  const zeile = page.locator(`tr:has-text("@${username}")`).first();
  await zeile.waitFor({ state: 'visible', timeout: 15000 });
  await zeile.locator('button:has-text("Bearbeiten")').first().click();
  await page.waitForSelector('text=Arbeitszeitmodell — Perioden', { timeout: 15000 });
  await page.waitForTimeout(1200);
}

async function oeffneWechselDialog(page) {
  await page.waitForSelector('button:has-text("Stundenwechsel ab Datum")', { timeout: 15000 });
  await page.click('button:has-text("Stundenwechsel ab Datum")');
  await page.waitForSelector('text=Was diese Umstellung bewirkt', { timeout: 15000 });
  await page.waitForTimeout(500);
}

async function schliesseWechselDialogUeberAbbrechen(page) {
  // Auf den Wechsel-Dialog eingegrenzt — das EditUserModal darunter traegt ebenfalls einen
  // Knopf "Abbrechen".
  const dialog = page.locator('div[role="dialog"]', { hasText: 'Was diese Umstellung bewirkt' }).last();
  await dialog.locator('button:has-text("Abbrechen")').first().click();
  await page.waitForSelector('text=Was diese Umstellung bewirkt', { state: 'detached', timeout: 15000 });
  await page.waitForTimeout(800);
}

/** Zustand des Speichern-Knopfes im Wechsel-Dialog. */
async function speichernKnopfZustand(page) {
  return await page.evaluate(() => {
    const b = Array.from(document.querySelectorAll('button')).find(
      (x) =>
        x.textContent?.includes('Stundenwechsel speichern') ||
        x.textContent?.includes('Rückwirkend speichern')
    );
    if (!b) return { gefunden: false };
    return { gefunden: true, beschriftung: b.textContent?.trim() ?? '', gesperrt: b.disabled };
  });
}

/** Der Feldfehlertext am Stichtag, so wie er am Bildschirm steht. */
async function feldfehlerText(page) {
  return await page.evaluate(() => {
    const p = Array.from(document.querySelectorAll('p')).find((x) =>
      x.textContent?.includes('existiert bereits eine Periode')
    );
    return p ? (p.textContent ?? '').trim() : '';
  });
}

/** Alle Zeilen der Periodenliste mit ihren Markierungsstilen (nur Beschreibung, kein Beleg). */
async function alleZeilenMarkierungen(page) {
  return await page.evaluate(() => {
    const tabelle = Array.from(document.querySelectorAll('table')).find(
      (t) => (t.querySelector('thead th')?.textContent ?? '').trim() === 'Gültig ab'
    );
    if (!tabelle) return [];
    const zellen = Array.from(tabelle.querySelectorAll('tbody tr td:first-child'));
    return zellen.map((td) => {
      const cs = getComputedStyle(td);
      return {
        text: (td.textContent ?? '').trim().slice(0, 30),
        backgroundColor: cs.backgroundColor,
        borderLeftWidth: cs.borderLeftWidth,
        borderLeftColor: cs.borderLeftColor,
      };
    });
  });
}

async function setzeStichtag(page, datum) {
  await page.getByLabel('Stichtag').fill(datum);
  await page.waitForTimeout(300);
}

async function dunkelmodusUmschalten(page) {
  await page.click('button[aria-label="Toggle theme"]');
  await page.waitForTimeout(600);
  return await page.evaluate(() => document.documentElement.classList.contains('dark'));
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

const PANEL = '[data-testid="worktime-change-collision-panel"]';
const MARKIERTE_ZELLE = 'markierte-periodenzelle';
const ERSTE_ZELLE = 'erste-periodenzelle';

async function main() {
  console.log('=== F-8 — Erreicht die Kollisionsinformation den Anwender? ===');
  console.log('Messvorschrift: ausschliesslich document.elementFromPoint() (D-10).');
  console.log('');
  console.log('Ausgangsbefund:');
  console.log(AUSGANGSBEFUND);

  await apiLoginAdmin();
  const perioden = await apiPeriods(NUTZER.id);
  const kollidierend = perioden.find((p) => p.validFrom === STICHTAG_KOLLISION);
  record(
    `Vorbedingung: Periode mit validFrom ${STICHTAG_KOLLISION} existiert serverseitig (erwartet id ${ERWARTETE_PERIODE_ID})`,
    kollidierend
      ? { id: kollidierend.id, validFrom: kollidierend.validFrom, validTo: kollidierend.validTo, weeklyHours: kollidierend.weeklyHours }
      : null,
    !!kollidierend && kollidierend.id === ERWARTETE_PERIODE_ID
  );
  const frei = perioden.find((p) => p.validFrom === STICHTAG_FREI);
  record(
    `Vorbedingung: Stichtag ${STICHTAG_FREI} ist serverseitig NICHT belegt`,
    frei ? frei.id : 'keine Periode',
    !frei
  );

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1400, height: 950 } });
    const page = await ctx.newPage();

    await login(page, 'admin', 'admin123');
    await akzeptiereDatenschutzWennNoetig(page);
    await page.waitForSelector('text=Admin Dashboard', { timeout: 20000 });

    // =====================================================================
    // Zustand 1 — Dialog offen, Kollision eingetragen
    // =====================================================================
    console.log('');
    console.log('##### Zustand 1 — Wechsel-Dialog offen, kollidierender Stichtag eingetragen');

    await oeffneNutzerbearbeitung(page, NUTZER.username);
    await oeffneWechselDialog(page);
    await setzeStichtag(page, STICHTAG_KOLLISION);

    // Auf das Kollisionspanel warten (es entsteht aus der Eingabe, ohne Serverantwort).
    await page.waitForSelector(PANEL, { timeout: 15000 });

    // Auf den Feldfehler warten — er kommt aus der Serverantwort der Vorschau. Bleibt er
    // aus, wird die Formularpruefung ueber Enter im Stichtagsfeld ausgeloest; gespeichert
    // wird dabei nichts (der Speichern-Knopf ist gesperrt, und ohne Vorschau bricht
    // handleSubmit vor performSave ab).
    let fehlertext = '';
    for (let i = 0; i < 40; i++) {
      fehlertext = await feldfehlerText(page);
      if (fehlertext) break;
      if (i === 25) {
        await page.getByLabel('Stichtag').press('Enter');
      }
      await page.waitForTimeout(500);
    }

    const z1Panel = await elementFromPointMessung(page, PANEL);
    record(
      'Zustand 1 — elementFromPoint auf dem Kollisionspanel trifft das Panel selbst oder einen Nachfahren',
      z1Panel,
      z1Panel.gefunden === true && z1Panel.imFenster === true && z1Panel.istSelbstOderNachfahre === true
    );
    messzeile(
      'Zustand 1',
      'Kollisionspanel im Dialog',
      z1Panel.treffer ?? 'null',
      `bg ${z1Panel.stile?.backgroundColor ?? '—'}`,
      z1Panel.istSelbstOderNachfahre === true
    );

    const z1PanelText = await page.locator(PANEL).innerText();
    record(
      'Zustand 1 — das Panel nennt die belegende Periode in Zahlen (Geltungszeitraum und Wochenstunden)',
      z1PanelText.replace(/\s+/g, ' ').trim(),
      z1PanelText.includes('17.8.2026') &&
        z1PanelText.includes('11.11.2026') &&
        z1PanelText.includes('30') &&
        z1PanelText.includes('h/Woche')
    );

    const z1Rolle = await page.getAttribute(PANEL, 'role');
    record(
      'Zustand 1 — das Panel traegt role="status" (kein zweites alert neben dem Feldfehler)',
      z1Rolle,
      z1Rolle === 'status'
    );

    record(
      'Zustand 1 (D-10) — der Feldfehler am Stichtag steht unveraendert da',
      fehlertext,
      fehlertext === FELDFEHLER_SOLL
    );

    const z1Knopf = await speichernKnopfZustand(page);
    record('Zustand 1 (D-10) — der Speichern-Knopf ist gesperrt', z1Knopf, z1Knopf.gefunden === true && z1Knopf.gesperrt === true);

    // Kontrollmessung: die markierte Zeile liegt weiterhin unter dem Dialog. Das ist KEIN
    // Fehler, sondern die abgenommene Stapelung (z-[60] ueber z-50, P12-31/P12-5) — und
    // genau der Grund, warum die Information im Dialog stehen muss.
    const z1Zeile = await elementFromPointMessung(page, MARKIERTE_ZELLE, { scrollen: false });
    record(
      'Zustand 1 (Kontrolle) — die markierte Zeile liegt bei offenem Dialog weiterhin darunter (z-Stapelung unveraendert)',
      z1Zeile,
      z1Zeile.gefunden === true && z1Zeile.istSelbstOderNachfahre === false
    );
    messzeile(
      'Zustand 1 (Kontrolle)',
      'markierte Zelle in der Periodenliste',
      z1Zeile.treffer ?? 'null',
      `bg ${z1Zeile.stile?.backgroundColor ?? '—'}, borderLeft ${z1Zeile.stile?.borderLeftWidth ?? '—'}`,
      z1Zeile.istSelbstOderNachfahre === false
    );

    // Kontraste des neuen Panels, hell
    const kHell = await kontrastMessung(page, PANEL);
    record('Zustand 1 — Kontrastmessung des Kollisionspanels (hell) gefunden', kHell.gefunden, kHell.gefunden === true);
    for (const t of kHell.treffer ?? []) {
      kontraste.push({ element: t.tag, text: t.text, hell: t.verhaeltnis, dunkel: null });
      record(
        `Kontrast hell — ${t.tag} "${t.text}" (${t.vordergrund} auf ${t.hintergrund})`,
        t.verhaeltnis,
        t.verhaeltnis >= 4.5
      );
    }

    // =====================================================================
    // Zustand 2 — Dialog geschlossen, die Markierung bleibt stehen
    // =====================================================================
    console.log('');
    console.log('##### Zustand 2 — Wechsel-Dialog ueber "Abbrechen" geschlossen');

    await schliesseWechselDialogUeberAbbrechen(page);

    const z2 = await elementFromPointMessung(page, MARKIERTE_ZELLE);
    record(
      'Zustand 2 — elementFromPoint auf der markierten Zelle trifft die Zelle selbst oder einen Nachfahren',
      z2,
      z2.gefunden === true && z2.imFenster === true && z2.istSelbstOderNachfahre === true
    );
    record(
      'Zustand 2 — Zellhintergrund rgb(254, 242, 242) und 4 px linker Rand rgb(239, 68, 68) (Ausgangsbefund: rgba(0, 0, 0, 0) / 0px)',
      z2.stile,
      z2.stile?.backgroundColor === 'rgb(254, 242, 242)' &&
        z2.stile?.borderLeftWidth === '4px' &&
        z2.stile?.borderLeftColor === 'rgb(239, 68, 68)'
    );
    messzeile(
      'Zustand 2',
      'markierte Zelle in der Periodenliste',
      z2.treffer ?? 'null',
      `bg ${z2.stile?.backgroundColor ?? '—'}, borderLeft ${z2.stile?.borderLeftWidth ?? '—'} ${z2.stile?.borderLeftColor ?? ''}`,
      z2.istSelbstOderNachfahre === true
    );

    const z2Zeilen = await alleZeilenMarkierungen(page);
    record(
      'Zustand 2 — genau EINE Zeile traegt die Markierung',
      z2Zeilen,
      z2Zeilen.filter((z) => z.borderLeftWidth === '4px').length === 1
    );

    // =====================================================================
    // Zustand 3 — kollisionsfreier Stichtag
    // =====================================================================
    console.log('');
    console.log('##### Zustand 3 — kollisionsfreier Stichtag eingetragen, Vorschau abgewartet');

    await oeffneWechselDialog(page);
    await setzeStichtag(page, STICHTAG_FREI);
    // Nachgemessen am laufenden Server: mit den vorbelegten Werten (30 h + Tagesplan der
    // aktuell gueltigen Periode) liefert POST /api/work-periods/preview `isNoOp: true` —
    // der Dialog zeigt dann "Es gibt nichts umzustellen" und NICHT die Marke
    // "Keine Rückwirkung". Damit die Vorschau als echter Zustand "future" zurueckkommt,
    // werden die Wochenstunden mitgeaendert. Gespeichert wird weiterhin nichts.
    await page.getByLabel('Neue Wochenstunden').fill('25');
    // Vorschau abwarten: der Zustand "future" traegt die Marke "Keine Rückwirkung".
    await page.waitForSelector('text=Keine Rückwirkung', { timeout: 30000 });
    const z3PanelWeg = (await page.locator(PANEL).count()) === 0;
    record(
      'Zustand 3 — das Kollisionspanel ist bei einem freien Stichtag verschwunden',
      z3PanelWeg,
      z3PanelWeg === true
    );
    await schliesseWechselDialogUeberAbbrechen(page);

    const z3Zeilen = await alleZeilenMarkierungen(page);
    const z3Markiert = z3Zeilen.filter((z) => z.borderLeftWidth !== '0px');
    record(
      'Zustand 3 — KEINE Zeile traegt mehr eine Markierung (borderLeft auf allen Zeilen 0px)',
      z3Zeilen,
      z3Markiert.length === 0
    );
    const z3Punkt = await elementFromPointMessung(page, ERSTE_ZELLE);
    record(
      'Zustand 3 — elementFromPoint auf der zuvor markierten Zeile trifft weiterhin die Zeile (sie ist da, nur ohne Markierung)',
      z3Punkt,
      z3Punkt.gefunden === true && z3Punkt.istSelbstOderNachfahre === true
    );
    messzeile(
      'Zustand 3',
      'erste Zelle der Periodenliste (keine Markierung mehr)',
      z3Punkt.treffer ?? 'null',
      `bg ${z3Punkt.stile?.backgroundColor ?? '—'}, borderLeft ${z3Punkt.stile?.borderLeftWidth ?? '—'}`,
      z3Markiert.length === 0
    );

    // =====================================================================
    // Zustand 4 — Dunkelmodus
    // =====================================================================
    console.log('');
    console.log('##### Zustand 4 — Zustand 2 im Dunkelmodus');

    // Der Umschalter liegt in der Kopfzeile hinter dem geoeffneten EditUserModal — erst
    // schliessen, umschalten, dann wieder oeffnen.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(800);
    const istDunkel = await dunkelmodusUmschalten(page);
    record(
      'Zustand 4 — vor der Messung bestaetigt: document.documentElement.classList.contains("dark") === true',
      istDunkel,
      istDunkel === true
    );

    await oeffneNutzerbearbeitung(page, NUTZER.username);
    await oeffneWechselDialog(page);
    await setzeStichtag(page, STICHTAG_KOLLISION);
    await page.waitForSelector(PANEL, { timeout: 15000 });

    // Kontraste des neuen Panels, dunkel
    const kDunkel = await kontrastMessung(page, PANEL);
    record('Zustand 4 — Kontrastmessung des Kollisionspanels (dunkel) gefunden', kDunkel.gefunden, kDunkel.gefunden === true);
    for (const t of kDunkel.treffer ?? []) {
      const vorhandene = kontraste.find((k) => k.element === t.tag && k.text === t.text);
      if (vorhandene) vorhandene.dunkel = t.verhaeltnis;
      else kontraste.push({ element: t.tag, text: t.text, hell: null, dunkel: t.verhaeltnis });
      record(
        `Kontrast dunkel — ${t.tag} "${t.text}" (${t.vordergrund} auf ${t.hintergrund})`,
        t.verhaeltnis,
        t.verhaeltnis >= 4.5
      );
    }

    const z4Panel = await elementFromPointMessung(page, PANEL);
    record(
      'Zustand 4 — elementFromPoint auf dem Kollisionspanel trifft es auch im Dunkelmodus',
      z4Panel,
      z4Panel.gefunden === true && z4Panel.istSelbstOderNachfahre === true
    );

    // Wieder auf den Feldfehler warten, damit die Markierung gesetzt ist.
    let fehlertext4 = '';
    for (let i = 0; i < 40; i++) {
      fehlertext4 = await feldfehlerText(page);
      if (fehlertext4) break;
      if (i === 25) await page.getByLabel('Stichtag').press('Enter');
      await page.waitForTimeout(500);
    }
    record('Zustand 4 — Feldfehler auch im Dunkelmodus unveraendert', fehlertext4, fehlertext4 === FELDFEHLER_SOLL);

    await schliesseWechselDialogUeberAbbrechen(page);

    const z4 = await elementFromPointMessung(page, MARKIERTE_ZELLE);
    record(
      'Zustand 4 — elementFromPoint auf der markierten Zelle trifft sie auch im Dunkelmodus',
      z4,
      z4.gefunden === true && z4.imFenster === true && z4.istSelbstOderNachfahre === true
    );
    // dark:bg-red-900/20 auf gray-800 und dark:border-red-400
    record(
      'Zustand 4 — Markierung traegt dark:bg-red-900/20 und dark:border-red-400 (4 px)',
      z4.stile,
      z4.stile?.borderLeftWidth === '4px' &&
        z4.stile?.borderLeftColor === 'rgb(248, 113, 113)' &&
        /^rgba?\(/.test(z4.stile?.backgroundColor ?? '')
    );
    messzeile(
      'Zustand 4',
      'markierte Zelle im Dunkelmodus',
      z4.treffer ?? 'null',
      `bg ${z4.stile?.backgroundColor ?? '—'}, borderLeft ${z4.stile?.borderLeftWidth ?? '—'} ${z4.stile?.borderLeftColor ?? ''}`,
      z4.istSelbstOderNachfahre === true
    );

    // Dunkelmodus zuruecknehmen, damit die Sitzung so bleibt, wie sie war.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
    const zurueck = await dunkelmodusUmschalten(page);
    console.log('');
    console.log('Dunkelmodus zurueckgenommen — classList enthaelt "dark":', zurueck);

    await ctx.close();

    // =====================================================================
    // Zusammenfassung
    // =====================================================================
    console.log('');
    console.log('=== elementFromPoint-Messtabelle ===');
    console.log('| Zustand | Gemessenes Element | elementFromPoint trifft | Berechnete Stile | Ja/Nein |');
    console.log('|---|---|---|---|---|');
    for (const z of messzeilen) {
      console.log(`| ${z.zustand} | ${z.was} | \`${z.treffer}\` | \`${z.stile}\` | ${z.ja ? 'Ja' : 'Nein'} |`);
    }

    console.log('');
    console.log('=== Kontrasttabelle des neuen Kollisionspanels ===');
    console.log('| Element | Text | hell | dunkel | Soll | Ja/Nein |');
    console.log('|---|---|---:|---:|---:|---|');
    for (const k of kontraste) {
      const ok = (k.hell ?? 0) >= 4.5 && (k.dunkel ?? 0) >= 4.5;
      console.log(`| ${k.element} | ${k.text} | ${k.hell ?? '—'} | ${k.dunkel ?? '—'} | 4,5 | ${ok ? 'Ja' : 'Nein'} |`);
      if (!ok) alleBestanden = false;
    }

    console.log('');
    console.log('=== Einzelergebnisse ===');
    for (const r of ergebnisse) {
      console.log(`${r.pass ? 'PASS' : 'FAIL'}  ${r.name}: ${JSON.stringify(r.wert)}`);
    }

    console.log('');
    console.log('Messungen gesamt:', ergebnisse.length);
    console.log('GESAMTERGEBNIS:', alleBestanden ? 'PASS' : 'FAIL');
    if (!alleBestanden) process.exitCode = 1;
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error('Messung fehlgeschlagen:', err);
  process.exitCode = 1;
});
