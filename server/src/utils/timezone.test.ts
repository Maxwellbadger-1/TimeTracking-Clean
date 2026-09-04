import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  getTodayString,
  getCurrentMonth,
  getCurrentISOWeek,
  getCurrentYear,
  formatDate,
  isToday,
} from './timezone.js';

/**
 * Diese Tests sichern eine Eigenschaft, die im Betrieb lange unsichtbar war.
 *
 * `getTodayString()` und Geschwister riefen `formatDate(getCurrentDate(), …)`. Beide
 * Funktionen wenden `toZonedTime` an, das Datum wurde also zweimal nach Europe/Berlin
 * verschoben. Solange `TZ=Europe/Berlin` gesetzt ist, ist die zweite Verschiebung ein
 * No-Op und der Fehler bleibt verborgen. Fehlt `TZ` — etwa nach einem `pm2 restart` ohne
 * `--update-env` —, läuft der Prozess in UTC, und ab 22:00 Ortszeit kam der Folgetag
 * heraus. Bei 58 Aufrufstellen quer durch Überstunden-, Urlaubs- und
 * Arbeitszeitmodell-Dienste ist das ein stiller Datumsfehler.
 *
 * Die Tests fixieren die Uhr auf Zeitpunkte rund um die kritischen Grenzen. Sie prüfen
 * das erwartete Ergebnis in **deutscher Ortszeit** — unabhängig davon, in welcher
 * Zeitzone der Testlauf selbst stattfindet.
 */
describe('timezone: Datumsfunktionen liefern deutsche Ortszeit', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  const beiUtc = (iso: string) => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date(iso));
  };

  describe('getTodayString', () => {
    it.each([
      // [UTC-Zeitpunkt, Berliner Wanduhr, erwartetes Datum]
      ['2026-09-03T09:00:00Z', '11:00 MESZ', '2026-09-03'],
      ['2026-09-03T19:59:00Z', '21:59 MESZ', '2026-09-03'],
      // die Grenze, an der die doppelte Konvertierung kippte:
      ['2026-09-03T20:00:00Z', '22:00 MESZ', '2026-09-03'],
      ['2026-09-03T21:30:00Z', '23:30 MESZ', '2026-09-03'],
      // echter Tageswechsel in Berlin
      ['2026-09-03T22:00:00Z', '00:00 MESZ Folgetag', '2026-09-04'],
      // Winterzeit: Berlin ist UTC+1, die Grenze verschiebt sich um eine Stunde
      ['2026-01-15T22:30:00Z', '23:30 MEZ', '2026-01-15'],
      ['2026-01-15T23:30:00Z', '00:30 MEZ Folgetag', '2026-01-16'],
    ])('%s (%s) → %s', (utc, _wanduhr, erwartet) => {
      beiUtc(utc);
      expect(getTodayString()).toBe(erwartet);
    });
  });

  describe('getCurrentMonth', () => {
    it('bleibt am Monatsletzten um 23:30 Ortszeit im alten Monat', () => {
      beiUtc('2026-08-31T21:30:00Z'); // 23:30 MESZ am 31.08.
      expect(getCurrentMonth()).toBe('2026-08');
    });

    it('wechselt erst mit dem Berliner Monatswechsel', () => {
      beiUtc('2026-08-31T22:00:00Z'); // 00:00 MESZ am 01.09.
      expect(getCurrentMonth()).toBe('2026-09');
    });
  });

  describe('getCurrentISOWeek', () => {
    it('bleibt am Sonntag um 23:30 Ortszeit in der alten Woche', () => {
      // Sonntag, 06.09.2026, 23:30 MESZ — die ISO-Woche endet erst um Mitternacht
      beiUtc('2026-09-06T21:30:00Z');
      const woche = getCurrentISOWeek();
      expect(woche).toBe(formatDate(new Date('2026-09-06T21:30:00Z'), "yyyy-'W'II"));
      expect(woche).toMatch(/^2026-W\d{2}$/);
    });
  });

  describe('getCurrentYear', () => {
    it('bleibt an Silvester um 23:30 Ortszeit im alten Jahr', () => {
      beiUtc('2026-12-31T22:30:00Z'); // 23:30 MEZ am 31.12.
      expect(getCurrentYear()).toBe(2026);
    });

    it('wechselt mit dem Berliner Jahreswechsel', () => {
      beiUtc('2026-12-31T23:00:00Z'); // 00:00 MEZ am 01.01.
      expect(getCurrentYear()).toBe(2027);
    });
  });

  describe('Konsistenz der Funktionen untereinander', () => {
    it('getTodayString, getCurrentMonth und getCurrentYear beschreiben denselben Tag', () => {
      beiUtc('2026-09-03T21:30:00Z'); // 23:30 MESZ — im kritischen Fenster
      const heute = getTodayString();
      expect(heute.slice(0, 7)).toBe(getCurrentMonth());
      expect(Number(heute.slice(0, 4))).toBe(getCurrentYear());
    });

    it('isToday stimmt mit getTodayString überein', () => {
      beiUtc('2026-09-03T21:30:00Z');
      expect(isToday(getTodayString())).toBe(true);
      expect(isToday('2026-09-04')).toBe(false);
    });
  });
});
