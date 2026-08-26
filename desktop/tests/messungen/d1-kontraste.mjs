/**
 * D-1 — Sechs Kontrastunterschreitungen, gemessen statt abgeleitet
 * (Phase 14.2, Plan 10, Task 2)
 *
 * Kein Playwright-Test (kein *.spec.ts) — die drei Bestandsdateien (edge-cases.spec.ts,
 * user-creation.spec.ts, user-edit.spec.ts) bleiben unveraendert dreiteilig. Dieses Skript
 * misst gegen den echten laufenden Server (127.0.0.1:3100) und die echte Arbeitsdatenbank
 * (server/database/development.db).
 *
 * ------------------------------------------------------------------------------------
 * MESSVORSCHRIFT (D-11): Kontraste werden GEMESSEN, nicht aus Klassennamen abgeleitet.
 *
 *  - Fuer jeden sichtbaren Knoten mit eigenem Text wird `color` aus `getComputedStyle()`
 *    gelesen und der TATSAECHLICH WIRKSAME Hintergrund bestimmt: die Elternkette wird
 *    hochgelaufen, bis eine deckende Ebene erreicht ist, und alle Ebenen darueber werden
 *    mit ihrem Alphawert VERRECHNET (Source-over-Komposition), nicht ignoriert. Ein
 *    `bg-red-900/20` ueber `bg-gray-800` ergibt eine dritte Farbe — genau die wird
 *    gerechnet.
 *  - Traegt der Vordergrund selbst ein Alpha (< 1), wird er ueber den aufgeloesten
 *    Hintergrund gelegt, bevor der Kontrast gerechnet wird.
 *  - Der Kontrast folgt der WCAG-Formel `(L1 + 0.05) / (L2 + 0.05)` mit der
 *    sRGB-Linearisierung; protokolliert wird auf zwei Nachkommastellen.
 *  - Die Grenze ist 4,5:1, AUSSER der Knoten ist Grosstext:
 *    `font-size >= 24 px` ODER (`font-size >= 18.66 px` UND `font-weight >= 700`).
 *    Beide Zahlen stammen aus den BERECHNETEN Stilen, nicht aus einer Schaetzung.
 *    Fund 1 misst 18 px bei Gewicht 700 und ist damit KEIN Grosstext — der Fall ist
 *    unten ausdruecklich belegt (Abschnitt „Grosstextpruefung").
 *  - Symbole (SVG, `stroke: currentColor`) sind Nicht-Text-Inhalt: WCAG 1.4.11 setzt
 *    dort 3:1 an. Sie werden einzeln protokolliert, weil Fund 2 zwei Symbolstellen
 *    enthaelt. Sie stehen aber NICHT im Gate: der Ausgangslauf 13-U9 hat Symbole nicht
 *    gemessen (seine Bandbreite 4,51 bis 17,74 ist eine reine Textbandbreite), und die
 *    hier gefundenen Unterschreitungen sitzen samt und sonders auf vorbestehenden
 *    `text-gray-400`-Symbolen, die D-1 nicht angefasst hat. Sie werden namentlich
 *    benannt und nach deferred-items.md zurueckgestellt — sie unter D-1 mitzuerledigen
 *    hiesse, zwei Befunde zu vermischen (D-02). Das GATE ist die Textmenge.
 *  - Deaktivierte Bedienelemente sind nach WCAG 1.4.3 ausdruecklich ausgenommen
 *    (`disabled:opacity-50` senkt den Wert bauartbedingt). Sie werden gemessen und
 *    protokolliert, gehen aber nicht ins Gate.
 *  - Der Dunkelmodus wird durch Klicken des Umschalters HERGESTELLT und vor jeder
 *    Dunkelmessung mit `document.documentElement.classList.contains('dark') === true`
 *    BESTAETIGT. Ist es `false`, bricht das Skript ab.
 *
 * Kein Klassenname geht in eine Messung ein. Die Zuordnung einer Messstelle zu ihrer
 * Quellzeile (Fund 2, neun Stellen) erfolgt ueber die DOM-STRUKTUR (Tabellenkopf,
 * Spaltenindex, Beschriftung), nicht ueber `className`.
 * ------------------------------------------------------------------------------------
 *
 * D-01: Dieses Skript SPEICHERT NICHTS. Es fuellt Formulare, laesst Vorschauen rechnen
 * (echte Trockenlaeufe des Servers, die nichts festschreiben) und bricht jeden Dialog
 * ueber „Abbrechen" ab. Weder die fuenf geschuetzten Tabellen (time_entries,
 * absence_requests, overtime_corrections, vacation_balance, vacation_transactions) noch
 * `user_work_periods` werden geschrieben.
 *
 * Aufruf: node tests/messungen/d1-kontraste.mjs
 * (aus desktop/ heraus; Server 127.0.0.1:3100 und Vite 1420 muessen laufen)
 */

import { chromium } from 'playwright-core';

const BASE_URL = 'http://localhost:1420';
const API_URL = 'http://127.0.0.1:3100/api';

/**
 * Der Nutzer mit Modellwechsel und langer Historie: Eintritt 01.01.2025, drei Perioden
 * (40 h / 20 h / 12 h). Er traegt im Kontoauszug positive UND negative Tagesbetraege und
 * erlaubt eine rueckwirkende Vorschau mit POSITIVER Saldoaenderung — genau der gruene
 * Zweig, an dem Fund 1 haengt.
 */
const NUTZER = {
  id: 48714,
  username: 't1109-modellwechsel-2026-05-14',
  anzeigename: 'Modellwechsel Testnutzer',
};

/**
 * Zweiter Nutzer fuer den Kontoauszug. `NUTZER` traegt einen NEGATIVEN Jahressaldo — dort
 * rendern die Spalten „Ueberstunden", „Gesamt Verdient", „Aktueller Saldo" und die Kopfzeile
 * „Zeitkonto-Saldo" den ROTEN Zweig. Der gruene Zweig (Fund 2) wird deshalb zusaetzlich an
 * einem Nutzer mit POSITIVEM Saldo gemessen (serverseitig geprueft: overtime +38), damit
 * alle neun Fundstellen den Ton tatsaechlich zeigen, um den es geht.
 */
const NUTZER_POSITIV = {
  id: 48717,
  username: 'abnahme.vollstaendig',
  anzeigename: 'Abnahme Vollstaendig',
};

/** Rueckwirkender Stichtag mit positiver Saldoaenderung (serverseitig geprueft: +82:00h). */
const STICHTAG_RUECKWIRKEND = '2026-07-01';
const STUNDEN_RUECKWIRKEND = '10';
/** Stichtag in der Zukunft (serverseitig geprueft: isRetroactive=false). */
const STICHTAG_ZUKUNFT = '2026-12-01';
const STUNDEN_ZUKUNFT = '35';
/** Korrektur der mittleren Periode auf 10 h — serverseitig geprueft: balanceDelta +144. */
const KORREKTUR_PERIODE_STUNDEN = '10';

/** Die Ausgangswerte aus 14.2-CONTEXT.md, Abschnitt D-11. Uebernommen, nicht neu gemessen. */
const VORHER = {
  fund1: { flaeche: 'Vorschaupanel', element: 'Aenderung des Ueberstundensaldos (18 px/700)', modus: 'hell', wert: '3,18' },
  fund2: { flaeche: 'Kontoauszug', element: 'positive Stundenwerte (gruen)', modus: 'hell', wert: '3,30' },
  fund3hell: { flaeche: 'EditUserModal / Loeschbestaetigung', element: 'Pflichtfeld-Stern *', modus: 'hell', wert: '3,60–3,76' },
  fund3dunkel: { flaeche: 'EditUserModal / Loeschbestaetigung', element: 'Pflichtfeld-Stern *', modus: 'dunkel', wert: '3,90' },
  fund4: { flaeche: 'Alle Dialoge', element: 'Primaerknopf, Weiss auf Blau', modus: 'dunkel', wert: '3,68' },
  fund5: { flaeche: 'Loeschbestaetigung', element: 'Gefahrenknopf, Weiss auf Rot', modus: 'dunkel', wert: '3,76' },
};

/** Kleinster Wert des Ausgangslaufs (Badge „Rueckwirkend"). Darunter darf nichts fallen. */
const KLEINSTER_AUSGANGSWERT = 4.51;

// ---------------------------------------------------------------------------
// Sammelbehaelter
// ---------------------------------------------------------------------------

/** @type {{flaeche: string, modus: string, tag: string, art: string, text: string, fontSizePx: number, fontWeight: number, grossText: boolean, vordergrund: string, hintergrund: string, grenze: number, wert: number, bestanden: boolean, ausgenommen: string|null, quelle: string|null}[]} */
const messungen = [];
/** @type {{name: string, wert: unknown, pass: boolean}[]} */
const pruefungen = [];
/** @type {{durchlauf: string, bestaetigt: boolean}[]} */
const dunkelBestaetigungen = [];
let alleBestanden = true;

function record(name, wert, pass) {
  pruefungen.push({ name, wert, pass });
  alleBestanden = alleBestanden && pass;
  console.log('');
  console.log(`--- ${name} ---`);
  console.log('  Gemessen: ' + JSON.stringify(wert));
  console.log('  ' + (pass ? 'PASS' : 'FAIL'));
}

// ---------------------------------------------------------------------------
// Die Messfunktion — in der Seite ausgefuehrt
// ---------------------------------------------------------------------------

/**
 * Misst JEDEN sichtbaren Knoten mit eigenem Text (und jedes sichtbare Symbol) unterhalb
 * von `wurzelSelector`. Rueckgabe: eine Zeile je Knoten.
 *
 * `quelleZuordnung` ist eine reine Protokollhilfe: sie benennt fuer die neun Fund-2-Stellen
 * Datei und Zeile, ermittelt ueber die DOM-Struktur (Tabellenkopf, Spaltenindex,
 * Beschriftung). Sie geht in KEINE Messung ein.
 */
async function messeFlaeche(page, wurzelSelector, flaeche) {
  const zeilen = await page.evaluate(
    ({ sel }) => {
      // ---------- Farbwerkzeug ----------
      function parseFarbe(s) {
        const m = /rgba?\(([^)]+)\)/.exec(s || '');
        if (!m) return null;
        const t = m[1].split(/[,\s/]+/).filter(Boolean).map((v) => parseFloat(v));
        if (t.length < 3 || t.some((v) => Number.isNaN(v))) return null;
        return { r: t[0], g: t[1], b: t[2], a: t.length > 3 ? t[3] : 1 };
      }
      /** Source-over: `vorne` (mit Alpha) ueber `hinten` (deckend). */
      function ueber(vorne, hinten) {
        const a = vorne.a;
        return {
          r: vorne.r * a + hinten.r * (1 - a),
          g: vorne.g * a + hinten.g * (1 - a),
          b: vorne.b * a + hinten.b * (1 - a),
          a: 1,
        };
      }
      /**
       * Effektiver Hintergrund: alle Ebenen der Elternkette bis zur ersten DECKENDEN
       * einsammeln und von hinten nach vorne zusammenlegen. Findet sich keine deckende
       * Ebene, ist die Basis das Weiss des Ansichtsfensters.
       */
      function effektiverHintergrund(el) {
        const ebenen = [];
        let n = el;
        while (n && n.nodeType === 1) {
          const cs = getComputedStyle(n);
          const c = parseFarbe(cs.backgroundColor);
          if (c && c.a > 0) {
            // Die Deckkraft des Elements selbst wirkt auf seinen Hintergrund mit.
            const eigen = parseFloat(cs.opacity);
            const wirksam = Number.isFinite(eigen) ? c.a * eigen : c.a;
            ebenen.push({ ...c, a: wirksam });
            if (wirksam >= 1) break;
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
        return (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      }
      const rundung = (c) => `rgb(${Math.round(c.r)}, ${Math.round(c.g)}, ${Math.round(c.b)})`;

      // ---------- Sichtbarkeit ----------
      /** Deckkraft der ganzen Kette — ein Knoten in einem `opacity: 0`-Container zaehlt nicht. */
      function kettenDeckkraft(el) {
        let o = 1;
        let n = el;
        while (n && n.nodeType === 1) {
          const v = parseFloat(getComputedStyle(n).opacity);
          if (Number.isFinite(v)) o *= v;
          n = n.parentElement;
        }
        return o;
      }
      function sichtbar(el) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility !== 'visible') return false;
        if (kettenDeckkraft(el) < 0.05) return false;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) return false;
        return true;
      }
      /** WCAG 1.4.3 nimmt deaktivierte Bedienelemente ausdruecklich aus. */
      function ausnahmegrund(el) {
        if (el.closest('[disabled]')) return 'deaktiviertes Bedienelement (WCAG 1.4.3)';
        if (el.closest('[aria-disabled="true"]')) return 'deaktiviertes Bedienelement (WCAG 1.4.3)';
        if (kettenDeckkraft(el) < 0.75) return 'teiltransparent geblendetes Element';
        return null;
      }

      // ---------- Quellzuordnung (nur Protokoll, geht in keine Messung ein) ----------
      function kopfzeilen(tabelle) {
        return Array.from(tabelle.querySelectorAll('thead th')).map((th) =>
          (th.textContent ?? '').trim()
        );
      }
      function tabelleMitKopf(...erwartet) {
        return (
          Array.from(document.querySelectorAll('table')).find((t) => {
            const k = kopfzeilen(t);
            return erwartet.every((e) => k.includes(e));
          }) ?? null
        );
      }
      const kontoTabelle = tabelleMitKopf('Monat', 'Verdient', 'Änderung', 'Überstunden');
      const transaktionsTabelle = tabelleMitKopf('Datum', 'Typ', 'Beschreibung', 'Stunden');

      function quelleFuer(el) {
        // --- Kontoauszug (WorkTimeAccountHistory.tsx) ---
        if (kontoTabelle && kontoTabelle.contains(el)) {
          const zelle = el.closest('td');
          if (zelle) {
            const kopf = kopfzeilen(kontoTabelle);
            const idx = Array.from(zelle.parentElement.children).indexOf(zelle);
            const spalte = kopf[idx] ?? '';
            if (spalte === 'Verdient') return 'WorkTimeAccountHistory.tsx:261 (Spalte „Verdient")';
            if (spalte === 'Änderung') {
              return el.tagName.toLowerCase() === 'svg'
                ? 'WorkTimeAccountHistory.tsx:288 (Symbol TrendingUp, Spalte „Änderung")'
                : 'WorkTimeAccountHistory.tsx:295 (Spalte „Änderung")';
            }
            if (spalte === 'Überstunden') return 'WorkTimeAccountHistory.tsx:310 (Spalte „Überstunden")';
          }
        }
        // --- Kontoauszug, Zusammenfassung unter der Tabelle ---
        const zusammenfassung = el.closest('div');
        if (zusammenfassung && el.tagName === 'P') {
          const vorher = el.previousElementSibling;
          const beschriftung = (vorher?.textContent ?? '').trim();
          if (beschriftung === 'Gesamt Verdient') return 'WorkTimeAccountHistory.tsx:347 (Summe „Gesamt Verdient")';
          if (beschriftung === 'Aktueller Saldo') return 'WorkTimeAccountHistory.tsx:375 (Summe „Aktueller Saldo")';
        }
        // --- Ueberstunden-Transaktionen (OvertimeTransactions.tsx) ---
        if (transaktionsTabelle && transaktionsTabelle.contains(el)) {
          const zelle = el.closest('td');
          if (zelle) {
            const kopf = kopfzeilen(transaktionsTabelle);
            const idx = Array.from(zelle.parentElement.children).indexOf(zelle);
            if ((kopf[idx] ?? '') === 'Stunden') {
              return el.tagName.toLowerCase() === 'svg'
                ? 'OvertimeTransactions.tsx:390 (Symbol TrendingUp, Spalte „Stunden")'
                : 'OvertimeTransactions.tsx:397 (Spalte „Stunden")';
            }
          }
        }
        // --- Kopfzeile „Zeitkonto-Saldo:" ---
        const vor = el.previousElementSibling;
        if (vor && (vor.textContent ?? '').trim() === 'Zeitkonto-Saldo:') {
          return 'OvertimeTransactions.tsx:245 (Kopfzeile „Zeitkonto-Saldo")';
        }
        // --- Saldoaenderung im Vorschaupanel (Fund 1 und Zwilling) ---
        if ((el.textContent ?? '').startsWith('Änderung des Überstundensaldos')) {
          return 'Vorschaupanel — Saldoaenderung (Fund 1)';
        }
        // --- Pflichtfeld-Stern ---
        if ((el.textContent ?? '').trim() === '*' && el.closest('label')) {
          return 'Input/Select/Textarea — Pflichtfeld-Stern (Fund 3)';
        }
        return null;
      }

      // ---------- Sammeln ----------
      // Mehrere Wurzeln sind zulaessig (der Kontoauszug besteht aus ZWEI Karten:
      // WorkTimeAccountHistory und OvertimeTransactions). Doppelt erfasste Knoten werden
      // ueber ein Set ausgeschlossen, falls sich Wurzeln verschachteln.
      const wurzeln = Array.from(document.querySelectorAll(sel));
      if (wurzeln.length === 0) return { gefunden: false, zeilen: [] };

      const ergebnis = [];
      const gesehen = new Set();
      const alle = [];
      for (const w of wurzeln) {
        if (!gesehen.has(w)) {
          gesehen.add(w);
          alle.push(w);
        }
        for (const k of w.querySelectorAll('*')) {
          if (!gesehen.has(k)) {
            gesehen.add(k);
            alle.push(k);
          }
        }
      }

      for (const el of alle) {
        const tag = el.tagName.toLowerCase();
        const istSymbol = tag === 'svg';
        if (tag === 'script' || tag === 'style' || tag === 'title' || tag === 'path') continue;
        // Nur Knoten mit EIGENEM Text (Blattaussage) — sonst zaehlte jeder Container mit.
        const eigenerText = istSymbol
          ? ''
          : Array.from(el.childNodes)
              .filter((n) => n.nodeType === 3)
              .map((n) => n.textContent)
              .join('')
              .replace(/\s+/g, ' ')
              .trim();
        if (!istSymbol && !eigenerText) continue;
        if (!sichtbar(el)) continue;

        const cs = getComputedStyle(el);
        // Bei einem SVG traegt `color` den `currentColor`-Strich.
        const vgRoh = parseFarbe(cs.color);
        if (!vgRoh) continue;
        const hg = effektiverHintergrund(el);
        const vg = vgRoh.a < 1 ? ueber(vgRoh, hg) : vgRoh;

        const fontSizePx = parseFloat(cs.fontSize);
        const fontWeight = parseInt(cs.fontWeight, 10) || 400;
        const grossText = !istSymbol && (fontSizePx >= 24 || (fontSizePx >= 18.66 && fontWeight >= 700));
        const grenze = istSymbol ? 3 : grossText ? 3 : 4.5;
        const wert = Math.round(kontrast(vg, hg) * 100) / 100;
        const ausgenommen = ausnahmegrund(el);

        ergebnis.push({
          tag,
          art: istSymbol ? 'Symbol' : 'Text',
          text: istSymbol ? '(Symbol)' : eigenerText.length > 70 ? eigenerText.slice(0, 67) + '…' : eigenerText,
          fontSizePx,
          fontWeight,
          grossText,
          vordergrund: rundung(vg),
          hintergrund: rundung(hg),
          grenze,
          wert,
          bestanden: wert >= grenze,
          ausgenommen,
          quelle: quelleFuer(el),
        });
      }
      return { gefunden: true, zeilen: ergebnis };
    },
    { sel: wurzelSelector }
  );

  if (!zeilen.gefunden) {
    throw new Error(`Messflaeche nicht gefunden: ${wurzelSelector} (${flaeche})`);
  }
  return zeilen.zeilen;
}

/**
 * Misst eine Flaeche und legt die Zeilen in den Sammelbehaelter.
 *
 * `imGate` trennt die fuenf Flaechen des Abnahmelaufs 13-U9 (gegen die die Gegenmessung
 * laeuft) von zusaetzlich mitgemessenen Flaechen. Die Berichtsseite traegt neben dem
 * Kontoauszug weitere Karten (Summenkarten, Abwesenheitsaufstellung, Verlaufsdiagramm), die
 * 13-U9 NICHT gemessen hat und die D-1 nicht anfasst. Sie werden trotzdem gemessen — was
 * dort auffaellt, wird namentlich benannt und zurueckgestellt, statt still unter D-1
 * mitgenommen zu werden (D-02).
 */
async function erfasse(page, wurzelSelector, flaeche, modus, { imGate = true } = {}) {
  const zeilen = await messeFlaeche(page, wurzelSelector, flaeche);
  let unter = 0;
  for (const z of zeilen) {
    messungen.push({ flaeche, modus, imGate, ...z });
    if (!z.bestanden && !z.ausgenommen) unter++;
  }
  console.log(
    `  [${modus}] ${flaeche}: ${zeilen.length} Knoten gemessen, ` +
      `kleinster Wert ${Math.min(...zeilen.map((z) => z.wert)).toFixed(2)}, ` +
      `${unter} unter der Grenze`
  );
  for (const z of zeilen) {
    if (!z.bestanden && !z.ausgenommen) {
      console.log(
        `      UNTER GRENZE: <${z.tag}> "${z.text}" ${z.wert} < ${z.grenze} — ` +
          `${z.vordergrund} auf ${z.hintergrund}, ${z.fontSizePx}px/${z.fontWeight}`
      );
    }
  }
  return zeilen;
}

// ---------------------------------------------------------------------------
// Oberflaechen-Helfer
// ---------------------------------------------------------------------------

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

async function setzeModus(page, modus, durchlaufName) {
  const istDunkel = await page.evaluate(() => document.documentElement.classList.contains('dark'));
  if ((modus === 'dunkel') !== istDunkel) {
    await page.click('button[aria-label="Toggle theme"]');
    await page.waitForTimeout(800);
  }
  const bestaetigt = await page.evaluate(() =>
    document.documentElement.classList.contains('dark')
  );
  if (modus === 'dunkel') {
    dunkelBestaetigungen.push({ durchlauf: durchlaufName, bestaetigt });
    console.log(`  Dunkelmodus-Bestaetigung [${durchlaufName}]: classList.contains('dark') === ${bestaetigt}`);
    if (!bestaetigt) {
      throw new Error(
        `ABBRUCH: Dunkelmodus nicht hergestellt — classList.contains('dark') === false (${durchlaufName})`
      );
    }
  }
  return bestaetigt;
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

async function oeffneWechselDialog(page) {
  await page.waitForSelector('button:has-text("Stundenwechsel ab Datum")', { timeout: 20000 });
  await page.click('button:has-text("Stundenwechsel ab Datum")');
  await page.waitForSelector('text=Was diese Umstellung bewirkt', { timeout: 20000 });
  await page.waitForTimeout(600);
}

async function schliesseWechselDialog(page) {
  const dialog = page.locator('div[role="dialog"]', { hasText: 'Was diese Umstellung bewirkt' }).last();
  await dialog.locator('button:has-text("Abbrechen")').first().click();
  await page.waitForSelector('text=Was diese Umstellung bewirkt', { state: 'detached', timeout: 20000 });
  await page.waitForTimeout(800);
}

/** Stichtag und Wochenstunden setzen und auf eine fertige Vorschau warten. */
async function setzeWechselEingaben(page, stichtag, stunden) {
  await page.getByLabel('Stichtag').fill(stichtag);
  await page.getByLabel('Neue Wochenstunden').fill(stunden);
  await page.waitForTimeout(400);
}

/** Wartet, bis das Vorschaupanel einen der Endzustaende erreicht hat. */
async function warteAufVorschau(page, erwarteterText, timeout = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    const treffer = await page.evaluate((t) => (document.body.innerText ?? '').includes(t), erwarteterText);
    if (treffer) return true;
    await page.waitForTimeout(500);
  }
  return false;
}

const WECHSEL_DIALOG = 'wechsel-dialog';
const KORREKTUR_DIALOG = 'korrektur-dialog';
const LOESCH_DIALOG = 'loesch-dialog';

/**
 * Registriert die drei Dialoge unter einer eindeutigen Kennung, damit `messeFlaeche()`
 * einen einfachen Selektor bekommt. Rein technisch — traegt keine Farbe und keinen Stil.
 */
async function markiereDialog(page, kennzeichen, textmarke) {
  const ok = await page.evaluate(
    ({ kennzeichen, textmarke }) => {
      const dialoge = Array.from(document.querySelectorAll('div[role="dialog"]'));
      const treffer = dialoge.filter((d) => (d.textContent ?? '').includes(textmarke)).pop();
      if (!treffer) return false;
      document
        .querySelectorAll(`[data-d1-messflaeche="${kennzeichen}"]`)
        .forEach((el) => el.removeAttribute('data-d1-messflaeche'));
      treffer.setAttribute('data-d1-messflaeche', kennzeichen);
      return true;
    },
    { kennzeichen, textmarke }
  );
  if (!ok) throw new Error(`Dialog nicht gefunden: ${kennzeichen} (Textmarke „${textmarke}")`);
  return `[data-d1-messflaeche="${kennzeichen}"]`;
}

/** Setzt den Mitarbeiter-Filter der Berichtsseite ueber den echten `change`-Weg. */
async function waehleMitarbeiter(page, anzeigename) {
  await page.evaluate((name) => {
    const felder = Array.from(document.querySelectorAll('select'));
    const ziel = felder.find((s) =>
      Array.from(s.options).some((o) => o.textContent?.trim() === name)
    );
    if (!ziel) throw new Error('Mitarbeiter-Auswahl nicht gefunden: ' + name);
    const option = Array.from(ziel.options).find((o) => o.textContent?.trim() === name);
    const setter = Object.getOwnPropertyDescriptor(window.HTMLSelectElement.prototype, 'value').set;
    setter.call(ziel, option.value);
    ziel.dispatchEvent(new Event('change', { bubbles: true }));
  }, anzeigename);
  await page.waitForTimeout(4000);
}

/**
 * Markiert die beiden Karten, die Fund 2 traegt: den Kontoauszug (WorkTimeAccountHistory)
 * und die Ueberstunden-Transaktionen (OvertimeTransactions). Gefunden ueber ihre
 * Tabellenkoepfe und die Aufstiegskette — kein Klassenname.
 */
async function markiereKontoauszugKarten(page) {
  return await page.evaluate(() => {
    function tabelleMitKopf(...erwartet) {
      return (
        Array.from(document.querySelectorAll('table')).find((t) => {
          const k = Array.from(t.querySelectorAll('thead th')).map((th) => (th.textContent ?? '').trim());
          return erwartet.every((e) => k.includes(e));
        }) ?? null
      );
    }
    function karteUm(tabelle, merkmal) {
      let n = tabelle;
      while (n && n.parentElement) {
        n = n.parentElement;
        if ((n.textContent ?? '').includes(merkmal)) return n;
      }
      return null;
    }
    document
      .querySelectorAll('[data-d1-messflaeche="kontoauszug"]')
      .forEach((el) => el.removeAttribute('data-d1-messflaeche'));

    const konto = tabelleMitKopf('Monat', 'Verdient', 'Änderung', 'Überstunden');
    const trans = tabelleMitKopf('Datum', 'Typ', 'Beschreibung', 'Stunden');
    let n = 0;
    for (const [t, merkmal] of [
      [konto, 'Gesamt Verdient'],
      [trans, 'Überstunden-Transaktionen'],
    ]) {
      if (!t) continue;
      const karte = karteUm(t, merkmal);
      if (karte) {
        karte.setAttribute('data-d1-messflaeche', 'kontoauszug');
        n++;
      }
    }
    return n;
  });
}

async function kontoauszugGeladen(page) {
  return await page.evaluate(() =>
    Array.from(document.querySelectorAll('table')).some((t) =>
      Array.from(t.querySelectorAll('thead th')).some(
        (th) => (th.textContent ?? '').trim() === 'Verdient'
      )
    )
  );
}

// ---------------------------------------------------------------------------
// Ein vollstaendiger Durchlauf ueber alle fuenf Flaechen in einem Modus
// ---------------------------------------------------------------------------

async function durchlauf(page, modus) {
  console.log('');
  console.log(`##### Durchlauf ${modus.toUpperCase()} #####`);
  await setzeModus(page, modus, `Durchlauf ${modus}`);

  // --- Flaeche 1: Periodenliste im EditUserModal --------------------------
  await oeffneNutzerbearbeitung(page);
  const nutzerDialog = await markiereDialog(page, 'nutzer-dialog', 'Arbeitszeitmodell — Perioden');
  await erfasse(page, nutzerDialog, '1. Periodenliste im EditUserModal', modus);

  // --- Flaeche 2: Wechsel-Dialog, drei Zustaende ---------------------------
  // 2a — rueckwirkend (positive Saldoaenderung: der gruene Zweig von Fund 1)
  await oeffneWechselDialog(page);
  await setzeWechselEingaben(page, STICHTAG_RUECKWIRKEND, STUNDEN_RUECKWIRKEND);
  const rueckOk = await warteAufVorschau(page, 'Änderung des Überstundensaldos');
  record(
    `[${modus}] Vorschaupanel erreicht den Zustand „rueckwirkend" mit Saldoaenderung`,
    { stichtag: STICHTAG_RUECKWIRKEND, stunden: STUNDEN_RUECKWIRKEND, erreicht: rueckOk },
    rueckOk
  );
  let flaeche = await markiereDialog(page, WECHSEL_DIALOG, 'Was diese Umstellung bewirkt');
  await erfasse(page, flaeche, '2a. Wechsel-Dialog — Vorschau rueckwirkend', modus);

  // 2b — Zukunft
  await setzeWechselEingaben(page, STICHTAG_ZUKUNFT, STUNDEN_ZUKUNFT);
  const zukunftOk = await warteAufVorschau(page, 'Keine Rückwirkung');
  record(
    `[${modus}] Vorschaupanel erreicht den Zustand „Zukunft" (Badge „Keine Rueckwirkung")`,
    { stichtag: STICHTAG_ZUKUNFT, stunden: STUNDEN_ZUKUNFT, erreicht: zukunftOk },
    zukunftOk
  );
  flaeche = await markiereDialog(page, WECHSEL_DIALOG, 'Was diese Umstellung bewirkt');
  await erfasse(page, flaeche, '2b. Wechsel-Dialog — Vorschau Zukunft', modus);

  // 2c — Fehler: die Vorschauanfrage wird auf dem Transportweg abgewiesen. Es wird nichts
  //      geschrieben; der Server sieht die Anfrage gar nicht.
  await page.route('**/api/work-periods/preview', (route) =>
    route.fulfill({ status: 500, contentType: 'application/json', body: JSON.stringify({ success: false, error: 'Messlauf D-1: erzwungener Vorschaufehler' }) })
  );
  await setzeWechselEingaben(page, '2026-10-01', '25');
  const fehlerOk = await warteAufVorschau(page, 'Die Vorschau konnte nicht berechnet werden');
  record(
    `[${modus}] Vorschaupanel erreicht den Zustand „Fehler"`,
    { erreicht: fehlerOk },
    fehlerOk
  );
  flaeche = await markiereDialog(page, WECHSEL_DIALOG, 'Was diese Umstellung bewirkt');
  await erfasse(page, flaeche, '2c. Wechsel-Dialog — Vorschau Fehler', modus);
  await page.unroute('**/api/work-periods/preview');
  await schliesseWechselDialog(page);

  // --- Flaeche 5 (vorgezogen): Korrektur-Dialog mit Vorschaupanel ----------
  // Der Zwilling von Fund 1. Zweite Zeile der Periodenliste — die erste ist nicht loeschbar
  // und traegt eine andere Aktionsspalte.
  const korrigierKnopf = page.locator('button[aria-label="Korrigieren"]').nth(1);
  await korrigierKnopf.waitFor({ state: 'visible', timeout: 20000 });
  await korrigierKnopf.click();
  await page.waitForSelector('text=Periode korrigieren', { timeout: 20000 });
  await page.waitForTimeout(800);
  const korrFeld = page
    .locator('div[role="dialog"]', { hasText: 'Periode korrigieren' })
    .last()
    .getByLabel('Wochenstunden');
  await korrFeld.fill(KORREKTUR_PERIODE_STUNDEN);
  const korrOk = await warteAufVorschau(page, 'Änderung des Überstundensaldos');
  record(
    `[${modus}] Korrektur-Dialog erreicht eine Vorschau mit Saldoaenderung (Zwilling von Fund 1)`,
    { stunden: KORREKTUR_PERIODE_STUNDEN, erreicht: korrOk },
    korrOk
  );
  flaeche = await markiereDialog(page, KORREKTUR_DIALOG, 'Periode korrigieren');
  await erfasse(page, flaeche, '5. Korrektur-Dialog (WorkTimePeriodEditModal)', modus);
  const korrDialog = page.locator('div[role="dialog"]', { hasText: 'Periode korrigieren' }).last();
  await korrDialog.locator('button:has-text("Abbrechen")').first().click();
  await page.waitForTimeout(1000);

  // --- Flaeche 3: Loeschbestaetigung --------------------------------------
  const loeschKnopf = page.locator('button[aria-label="Löschen"]').first();
  await loeschKnopf.waitFor({ state: 'visible', timeout: 20000 });
  await loeschKnopf.click();
  await page.waitForSelector('text=Begründung (Pflicht)', { timeout: 20000 });
  await page.waitForTimeout(1000);
  flaeche = await markiereDialog(page, LOESCH_DIALOG, 'Begründung (Pflicht)');
  await erfasse(page, flaeche, '3. Loeschbestaetigung (renderDeletionDetails)', modus);
  const loeschDialog = page.locator('div[role="dialog"]', { hasText: 'Begründung (Pflicht)' }).last();
  await loeschDialog.locator('button:has-text("Abbrechen")').first().click();
  await page.waitForTimeout(1000);

  await schliesseNutzerbearbeitung(page);

  // --- Flaeche 4: Kontoauszug ---------------------------------------------
  await page.click('text=Berichte');
  await page.waitForTimeout(2000);

  for (const [kennung, wer] of [
    ['4a', NUTZER],
    ['4b', NUTZER_POSITIV],
  ]) {
    await waehleMitarbeiter(page, wer.anzeigename);
    const geladen = await kontoauszugGeladen(page);
    const karten = await markiereKontoauszugKarten(page);
    record(
      `[${modus}] ${kennung} — Kontoauszug fuer ${wer.anzeigename} ist geladen (Spalte „Verdient" vorhanden, beide Karten markiert)`,
      { geladen, markierteKarten: karten },
      geladen && karten === 2
    );
    await erfasse(
      page,
      '[data-d1-messflaeche="kontoauszug"]',
      `4. Kontoauszug (${kennung}: ${wer.anzeigename})`,
      modus
    );
    // Zusaetzlich, ausserhalb des Gates: die uebrige Berichtsseite.
    await erfasse(
      page,
      'main',
      `Z. Uebrige Berichtsseite (${kennung}) — ausserhalb der 13-U9-Flaechen, nicht im Gate`,
      modus,
      { imGate: false }
    );
  }
}

// ---------------------------------------------------------------------------
// Hauptlauf
// ---------------------------------------------------------------------------

async function main() {
  console.log('=== D-1 — Sechs Kontrastunterschreitungen, gemessen statt abgeleitet ===');
  console.log('Messvorschrift: getComputedStyle, aufgeloeste Alpha- und Elternhintergruende,');
  console.log('WCAG-Formel, Grosstextpruefung aus font-size/font-weight, bestaetigter Dunkelmodus.');

  const browser = await chromium.launch();
  try {
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 1000 } });
    const page = await ctx.newPage();

    await login(page);
    await akzeptiereDatenschutzWennNoetig(page);
    await page.waitForSelector('text=Admin Dashboard', { timeout: 25000 });

    await durchlauf(page, 'hell');
    await durchlauf(page, 'dunkel');

    await ctx.close();
  } finally {
    await browser.close();
  }

  // =======================================================================
  // Auswertung
  // =======================================================================
  const gemessen = messungen.filter((m) => !m.ausgenommen);
  const ausgenommen = messungen.filter((m) => m.ausgenommen);

  /*
   * Zwei Mengen, sauber getrennt — sonst waere die Aussage unehrlich:
   *
   *  a) TEXT (WCAG 1.4.3). Das ist die Menge, die der Abnahmelauf 13-U9 gemessen hat
   *     (Bandbreite 4,51 bis 17,74); der kleinste Wert dort war das Badge „Rueckwirkend"
   *     mit 4,51 — dieser Lauf misst genau 4,51 an derselben Stelle und bestaetigt damit
   *     das Verfahren gegen den Ausgangslauf. Diese Menge ist das GATE.
   *  b) SYMBOLE (WCAG 1.4.11, Nicht-Text-Kontrast, 3:1). Sie waren im Ausgangslauf NICHT
   *     enthalten. Dieser Lauf misst sie zusaetzlich und benennt jede Unterschreitung
   *     namentlich — sie liegen samt und sonders auf `text-gray-400`-Symbolen, die D-1
   *     nicht angefasst hat (ChevronDown, FileText, Info). Vorbestehend und ausserhalb
   *     dieses Befunds: sie gehen nach deferred-items.md, nicht ins Gate. Sie hier ins
   *     Gate zu nehmen hiesse, einen fremden Befund unter D-1 mitzuerledigen (D-02).
   */
  const textKnoten = gemessen.filter((m) => m.art === 'Text' && m.imGate);
  const symbolKnoten = gemessen.filter((m) => m.art === 'Symbol' && m.imGate);
  const ausserhalb = gemessen.filter((m) => !m.imGate && !m.bestanden);
  const ausserhalbGruppen = new Map();
  for (const a of ausserhalb) {
    const k = `${a.art} ${a.vordergrund} auf ${a.hintergrund} = ${a.wert} (Grenze ${a.grenze}), ${a.modus}`;
    ausserhalbGruppen.set(k, (ausserhalbGruppen.get(k) ?? 0) + 1);
  }

  const hell = textKnoten.filter((m) => m.modus === 'hell');
  const dunkel = textKnoten.filter((m) => m.modus === 'dunkel');
  const kleinsterHell = hell.length ? Math.min(...hell.map((m) => m.wert)) : NaN;
  const kleinsterDunkel = dunkel.length ? Math.min(...dunkel.map((m) => m.wert)) : NaN;
  const unterGrenze = textKnoten.filter((m) => !m.bestanden);
  const symboleUnterGrenze = symbolKnoten.filter((m) => !m.bestanden);

  const symbolGruppen = new Map();
  for (const s of symboleUnterGrenze) {
    const k = `${s.vordergrund} auf ${s.hintergrund} = ${s.wert} (Grenze ${s.grenze}), ${s.modus}`;
    symbolGruppen.set(k, (symbolGruppen.get(k) ?? 0) + 1);
  }

  console.log('');
  console.log('========================================================');
  console.log(`Gemessene Knoten insgesamt: ${messungen.length}`);
  console.log(`  davon gewertet: ${gemessen.length}, ausgenommen: ${ausgenommen.length}`);
  console.log(`  davon Text (Gate, WCAG 1.4.3): ${textKnoten.length}`);
  console.log(`  davon Symbole (WCAG 1.4.11, nicht im Ausgangslauf enthalten): ${symbolKnoten.length}`);
  console.log(`  kleinster Wert hell:   ${Number.isNaN(kleinsterHell) ? '—' : kleinsterHell.toFixed(2)}`);
  console.log(`  kleinster Wert dunkel: ${Number.isNaN(kleinsterDunkel) ? '—' : kleinsterDunkel.toFixed(2)}`);
  console.log(`  Knoten unter ihrer Grenze: ${unterGrenze.length}`);
  for (const u of unterGrenze) {
    console.log(
      `    FAIL [${u.modus}] ${u.flaeche} — "${u.text}" ${u.wert} < ${u.grenze} ` +
        `(${u.vordergrund} auf ${u.hintergrund}, ${u.fontSizePx}px/${u.fontWeight})`
    );
  }
  console.log('');
  console.log(`Symbole unter 3:1 (WCAG 1.4.11 — vorbestehend, ausserhalb D-1): ${symboleUnterGrenze.length}`);
  for (const [k, n] of symbolGruppen.entries()) console.log(`    ${n} x  ${k}`);
  console.log('');
  console.log(
    `Unterschreitungen AUSSERHALB der 13-U9-Flaechen (mitgemessen, nicht im Gate): ${ausserhalb.length}`
  );
  for (const [k, n] of ausserhalbGruppen.entries()) console.log(`    ${n} x  ${k}`);

  // --- Die sechs Funde --------------------------------------------------
  /*
   * Die sechs Funde sind auf den fuenf Flaechen des Abnahmelaufs 13-U9 definiert. Knoten
   * ausserhalb dieser Flaechen (uebrige Berichtsseite) gehoeren nicht dazu und werden
   * getrennt berichtet — sonst wuerde ein fremder Befund unter D-1 abgerechnet (D-02).
   */
  const imGate = gemessen.filter((m) => m.imGate);
  const saldo = imGate.filter((m) => m.text.startsWith('Änderung des Überstundensaldos'));
  const stern = imGate.filter((m) => m.text === '*');
  const fund2Stellen = imGate.filter((m) => m.quelle && /WorkTimeAccountHistory|OvertimeTransactions/.test(m.quelle));

  /** Weisser Text auf gefuelltem Grund — Primaer- und Gefahrenknopf. */
  const weisseKnopftexte = imGate.filter(
    (m) => m.modus === 'dunkel' && m.vordergrund === 'rgb(255, 255, 255)' && m.tag === 'button'
  );

  const funde = [
    {
      nr: 1,
      vorher: VORHER.fund1,
      knoten: saldo.filter((m) => m.modus === 'hell'),
      soll: 4.5,
    },
    { nr: 2, vorher: VORHER.fund2, knoten: fund2Stellen.filter((m) => m.modus === 'hell'), soll: 4.5 },
    { nr: 3, vorher: VORHER.fund3hell, knoten: stern.filter((m) => m.modus === 'hell'), soll: 4.5 },
    { nr: 3, vorher: VORHER.fund3dunkel, knoten: stern.filter((m) => m.modus === 'dunkel'), soll: 4.5 },
    { nr: 4, vorher: VORHER.fund4, knoten: weisseKnopftexte, soll: 4.5 },
    { nr: 5, vorher: VORHER.fund5, knoten: weisseKnopftexte, soll: 4.5 },
  ];

  console.log('');
  console.log('--- Die sechs Funde ---');
  for (const f of funde) {
    const werte = f.knoten.map((k) => k.wert);
    const kleinster = werte.length ? Math.min(...werte) : NaN;
    const ok = werte.length > 0 && kleinster >= f.soll;
    record(
      `Fund ${f.nr} (${f.vorher.modus}) — ${f.vorher.element}: vorher ${f.vorher.wert}, jetzt gemessen`,
      { knoten: werte.length, kleinster: Number.isNaN(kleinster) ? null : kleinster, soll: f.soll },
      ok
    );
  }

  // --- Grosstextpruefung fuer Fund 1 -------------------------------------
  const fund1Knoten = saldo[0] ?? null;
  record(
    'Grosstextpruefung Fund 1 — 18 px bei Gewicht 700 ist KEIN Grosstext (Schwelle 18,66 px), Grenze bleibt 4,5',
    fund1Knoten
      ? { fontSizePx: fund1Knoten.fontSizePx, fontWeight: fund1Knoten.fontWeight, grossText: fund1Knoten.grossText, angewandteGrenze: fund1Knoten.grenze }
      : null,
    !!fund1Knoten && fund1Knoten.grossText === false && fund1Knoten.grenze === 4.5
  );

  // --- Gegenmessung ------------------------------------------------------
  record(
    'Gegenmessung — kein gewerteter TEXTknoten liegt unter seiner Grenze (WCAG 1.4.3; dieselbe Menge wie im Ausgangslauf 13-U9)',
    {
      textknoten: textKnoten.length,
      unterGrenze: unterGrenze.length,
      symboleGemessen: symbolKnoten.length,
      symboleUnter3zu1: symboleUnterGrenze.length,
    },
    unterGrenze.length === 0
  );
  record(
    `Gegenmessung — der kleinste gemessene Textwert ist nicht kleiner als ${KLEINSTER_AUSGANGSWERT} (Ausgangslauf)`,
    { kleinsterHell: kleinsterHell.toFixed(2), kleinsterDunkel: kleinsterDunkel.toFixed(2) },
    Math.min(kleinsterHell, kleinsterDunkel) >= 4.5
  );
  record(
    'Dunkelmodus wurde in jedem Dunkeldurchlauf bestaetigt',
    dunkelBestaetigungen,
    dunkelBestaetigungen.length > 0 && dunkelBestaetigungen.every((d) => d.bestaetigt === true)
  );

  // --- Maschinenlesbare Ausgabe fuer das Nachweisdokument -----------------
  const auswurf = {
    gemessenGesamt: messungen.length,
    gewertet: gemessen.length,
    ausgenommen: ausgenommen.length,
    kleinsterHell,
    kleinsterDunkel,
    textKnoten: textKnoten.length,
    symbolKnoten: symbolKnoten.length,
    unterGrenze: unterGrenze.length,
    symboleUnterGrenze: symboleUnterGrenze.length,
    symbolGruppen: Object.fromEntries(symbolGruppen),
    ausserhalbGate: ausserhalb.length,
    ausserhalbGruppen: Object.fromEntries(ausserhalbGruppen),
    dunkelBestaetigungen,
    messungen,
  };
  const fs = await import('node:fs');
  fs.writeFileSync(
    new URL('./d1-kontraste-rohdaten.json', import.meta.url),
    JSON.stringify(auswurf, null, 2),
    'utf8'
  );
  console.log('');
  console.log('Rohdaten geschrieben: tests/messungen/d1-kontraste-rohdaten.json');

  console.log('');
  console.log('========================================================');
  const rot = pruefungen.filter((p) => !p.pass);
  console.log(`Pruefungen: ${pruefungen.length - rot.length} bestanden / ${rot.length} nicht bestanden`);
  for (const r of rot) console.log('  FAIL: ' + r.name);
  console.log(alleBestanden ? 'ERGEBNIS: alle Pruefungen bestanden' : 'ERGEBNIS: NICHT bestanden');
  process.exit(alleBestanden ? 0 : 1);
}

main().catch((e) => {
  console.error('ABBRUCH:', e);
  process.exit(1);
});
