import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';

// DebugPanel zieht React-Komponenten nach - fuer diesen Test irrelevant.
vi.mock('../components/DebugPanel', () => ({
  debugLog: vi.fn(),
}));

import { universalFetch } from './tauriHttpClient';

/**
 * Regressionstest zum Vorfall vom 27.08.2026.
 *
 * universalFetch las den Antwortkoerper frueher mit `response.text()` und baute die
 * Antwort mit `new Response(text)` wieder auf. Bei Binaerdaten ersetzt die UTF-8-
 * Dekodierung jedes ungueltige Byte durch U+FFFD (EF BF BD) - die Datei wird groesser
 * und ist zerstoert. Heruntergeladene Datenbanksicherungen kamen dadurch unbrauchbar
 * beim Anwender an. Siehe .planning/debug/wal-abgehaengt-20260827.md
 */
describe('universalFetch', () => {
  beforeEach(() => {
    localStorage.clear();
    vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  /** Kopf einer echten SQLite-Datei plus Bytes, die kein gueltiges UTF-8 bilden. */
  function sqliteAehnlicheBytes(): Uint8Array {
    const kopf = new TextEncoder().encode('SQLite format 3\0');
    // 0xFF/0xFE sind in UTF-8 nirgends gueltig; 0xC0 0x80 ist eine verbotene
    // Ueberlang-Kodierung; 0xED 0xA0 0x80 waere ein Surrogat. Alle wuerden durch
    // TextDecoder zu U+FFFD - genau der Datenverlust, den wir ausschliessen wollen.
    const nutzlast = new Uint8Array([
      0xff, 0xfe, 0x00, 0x01, 0xc0, 0x80, 0xed, 0xa0, 0x80, 0xf5, 0x90, 0x80,
      0x00, 0x42, 0x7f, 0x80, 0x81, 0xbf, 0xfd, 0xfc,
    ]);
    const ganz = new Uint8Array(kopf.length + nutzlast.length);
    ganz.set(kopf, 0);
    ganz.set(nutzlast, kopf.length);
    return ganz;
  }

  it('reicht Binaerdaten Byte fuer Byte unveraendert durch', async () => {
    const original = sqliteAehnlicheBytes();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(original, {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        })
      )
    );

    const antwort = await universalFetch('http://localhost:3000/api/backup/download/x.db');
    const durchgereicht = new Uint8Array(await antwort.arrayBuffer());

    expect(durchgereicht.length).toBe(original.length);
    expect(Array.from(durchgereicht)).toEqual(Array.from(original));
  });

  it('blaeht Binaerdaten nicht auf (der konkrete Defekt)', async () => {
    const original = sqliteAehnlicheBytes();

    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(original, {
          status: 200,
          headers: { 'content-type': 'application/octet-stream' },
        })
      )
    );

    const antwort = await universalFetch('http://localhost:3000/api/backup/download/x.db');
    const blob = await antwort.blob();

    // Der alte Weg (text() -> new Response(text)) lieferte hier mehr Bytes als das
    // Original, weil jedes ungueltige Byte zu drei Bytes U+FFFD wurde.
    expect(blob.size).toBe(original.length);
  });

  it('liefert JSON weiterhin auswertbar zurueck', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(JSON.stringify({ success: true, data: { saldo: -32 } }), {
          status: 200,
          headers: { 'content-type': 'application/json' },
        })
      )
    );

    const antwort = await universalFetch('http://localhost:3000/api/overtime');
    await expect(antwort.json()).resolves.toEqual({ success: true, data: { saldo: -32 } });
  });

  it('erhaelt Umlaute in CSV-Antworten', async () => {
    const csv = 'Name;Stunden\nBenedikt Jochem;40\nMüller, Groß & Söhne;38,5\n';
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(
        new Response(new TextEncoder().encode(csv), {
          status: 200,
          headers: { 'content-type': 'text/csv; charset=utf-8' },
        })
      )
    );

    const antwort = await universalFetch('http://localhost:3000/api/exports/datev');
    await expect(antwort.text()).resolves.toBe(csv);
  });

  it('kommt mit koerperlosen Antworten (204) zurecht', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(null, { status: 204 }))
    );

    const antwort = await universalFetch('http://localhost:3000/api/notifications/1', {
      method: 'DELETE',
    });

    expect(antwort.status).toBe(204);
  });

  it('setzt das JWT aus dem localStorage als Authorization-Kopfzeile', async () => {
    localStorage.setItem('timetracking_jwt_token', 'abc.def.ghi');
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    );
    vi.stubGlobal('fetch', fetchMock);

    await universalFetch('http://localhost:3000/api/users');

    const uebergebeneOptionen = fetchMock.mock.calls[0][1];
    expect(new Headers(uebergebeneOptionen.headers).get('Authorization')).toBe('Bearer abc.def.ghi');
  });
});
