import { describe, it, expect, afterEach, vi } from 'vitest';
import {
  parseArgs,
  findIncompleteMonths,
  type UserForBackfill,
  type MonthCandidate,
} from './backfillOvertimeJournal.js';

/**
 * Tests der Findelogik (`findIncompleteMonths()`) und der Argumentauswertung (`parseArgs()`)
 * als reine Funktionen — Muster aus `applyModelChange.test.ts` / `productionGuard.test.ts`
 * (`vi.spyOn(process, 'exit')` wirft statt wirklich zu beenden).
 *
 * KEIN DATENBANKZUGRIFF (14-07-PLAN.md, Task 2, <action>): `findIncompleteMonths()` bekommt
 * die gelesenen Daten als Parameter. Der DB-berührende Teil (Sollstunden je Tag über
 * `getDailyTargetHours`, Höchstdatum der Journalzeilen je Monat) läuft in `main()` und wird
 * hier nicht angefasst — der Import dieses Moduls startet `main()` nicht (Wächter
 * `isMainModule` am Dateiende).
 *
 * Der Schreibpfad wird hier ebenfalls nicht getestet: Das Werkzeug hat keine eigene
 * Schreiblogik, jeder Monat läuft über `rebuildOvertimeTransactionsForMonth()`, das
 * `overtimeTransactionRebuildService.test.ts` abdeckt.
 */

/** Referenzdatum aller Fälle unten: 15.08.2026. „Heute" liegt damit im Monat 2026-08. */
const HEUTE = '2026-08-15';

function nutzer(overrides: Partial<UserForBackfill> = {}): UserForBackfill {
  return {
    id: 42,
    firstName: 'Erika',
    lastName: 'Mustermann',
    hireDate: '2026-01-01',
    endDate: null,
    deletedAt: null,
    ...overrides,
  };
}

/**
 * `lastRelevantDay`: letzter Tag des Monats, an dem der Nutzer Sollstunden, einen Zeiteintrag
 * ODER eine genehmigte Abwesenheit hatte — nicht nur Sollstunden. Zur Begründung dieser
 * Erweiterung gegenüber `<behavior>` in 14-07-PLAN.md siehe `MonthCandidate.lastRelevantDay`
 * und den Probelauf in `14-URTEIL-PHASE-9.1.md`.
 */
function monat(
  month: string,
  lastRelevantDay: string | null,
  maxJournalDate: string | null
): MonthCandidate {
  return { month, lastRelevantDay, maxJournalDate };
}

describe('findIncompleteMonths (14-07-PLAN.md, Task 2)', () => {
  it('meldet einen vollständigen Monat NICHT — Journal reicht bis zum letzten relevanten Tag', () => {
    // 2026-03: letzter relevanter Tag ist Dienstag, der 31.; das Journal endet ebenfalls am 31.
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-03', '2026-03-31', '2026-03-31'),
    ]);

    expect(result.skipped).toBe(false);
    expect(result.incompleteMonths).toEqual([]);
  });

  it('meldet einen Monat, dessen Journal einen Tag zu früh endet — der Off-by-one aus Phase 9.1', () => {
    // Genau der Defekt aus dem ROADMAP-Eintrag der Phase 9.1: „jeder vollständig durchlaufene
    // Monat endet dort am vorletzten Kalendertag".
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-07', '2026-07-31', '2026-07-30'),
    ]);

    expect(result.incompleteMonths).toEqual(['2026-07']);
  });

  it('meldet einen Monat ohne jede earned-Zeile (maxJournalDate = null)', () => {
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-05', '2026-05-29', null),
    ]);

    expect(result.incompleteMonths).toEqual(['2026-05']);
  });

  it('meldet einen Monat vor dem hireDate NICHT', () => {
    // Eintritt am 01.06.2026 — der Mai liegt vollständig davor.
    const result = findIncompleteMonths(nutzer({ hireDate: '2026-06-01' }), HEUTE, [
      monat('2026-05', '2026-05-29', null),
    ]);

    expect(result.incompleteMonths).toEqual([]);
  });

  it('meldet einen Monat nach dem endDate NICHT', () => {
    // Austritt am 31.03.2026 — der April liegt vollständig danach.
    const result = findIncompleteMonths(nutzer({ endDate: '2026-03-31' }), HEUTE, [
      monat('2026-04', '2026-04-30', null),
    ]);

    expect(result.incompleteMonths).toEqual([]);
  });

  it('meldet den Austrittsmonat selbst weiterhin, wenn er unvollständig ist', () => {
    // Abgrenzung zum Fall darüber: endDate liegt IM Monat, nicht davor. Der letzte relevante
    // Tag ist der 31.03.; das Journal endet am 30.03. → unvollständig.
    const result = findIncompleteMonths(nutzer({ endDate: '2026-03-31' }), HEUTE, [
      monat('2026-03', '2026-03-31', '2026-03-30'),
    ]);

    expect(result.incompleteMonths).toEqual(['2026-03']);
  });

  it('meldet den laufenden Monat NICHT, auch wenn das Journal weit vor dem Monatsende endet', () => {
    // 2026-08 ist der Monat von HEUTE. Sein letzter Kalendertag (31.) liegt nicht in der
    // Vergangenheit — der Monat ist noch nicht durchlaufen und darf nicht gemeldet werden.
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-08', '2026-08-31', '2026-08-14'),
    ]);

    expect(result.incompleteMonths).toEqual([]);
  });

  it('meldet einen zukünftigen Monat NICHT', () => {
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-09', '2026-09-30', null),
    ]);

    expect(result.incompleteMonths).toEqual([]);
  });

  it('meldet einen Monat ganz ohne relevanten Tag NICHT (lastRelevantDay = null)', () => {
    // Ein Monat, der beim Nutzer weder Sollstunden noch Zeiteinträge noch Abwesenheiten
    // enthält: es gibt nichts zu vervollständigen.
    const result = findIncompleteMonths(nutzer(), HEUTE, [monat('2026-04', null, null)]);

    expect(result.incompleteMonths).toEqual([]);
  });

  it('meldet eine Aushilfe (weeklyHours=0) mit Zeiteintrag am Monatsletzten SEHR WOHL', () => {
    // Regressionsschutz für den im Probelauf auf der Produktionskopie gefundenen Fehlschluss
    // (14-URTEIL-PHASE-9.1.md): Nutzer 22 und 29 haben an keinem Tag Sollstunden, aber am
    // 31.07.2026 je einen echten Zeiteintrag (3 bzw. 2 Stunden) ohne Journalzeile. Die
    // ursprünglich vorgesehene Regel „letzter Tag MIT SOLLSTUNDEN" lieferte hier
    // lastRelevantDay = null und übersah beide — obwohl der ROADMAP-Eintrag der Phase 9.1
    // genau sie als Beispiele nennt.
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-07', '2026-07-31', '2026-07-30'),
    ]);

    expect(result.incompleteMonths).toEqual(['2026-07']);
  });

  it('überspringt einen soft-gelöschten Nutzer und meldet das ausdrücklich (skipped = true)', () => {
    const result = findIncompleteMonths(
      nutzer({ deletedAt: '2026-04-02 10:00:00' }),
      HEUTE,
      [monat('2026-07', '2026-07-31', '2026-07-30')]
    );

    expect(result.skipped).toBe(true);
    expect(result.incompleteMonths).toEqual([]);
  });

  it('prüft jeden übergebenen Monat einzeln und liefert sie in Eingabereihenfolge', () => {
    const result = findIncompleteMonths(nutzer(), HEUTE, [
      monat('2026-02', '2026-02-27', '2026-02-27'), // vollständig
      monat('2026-03', '2026-03-31', '2026-03-30'), // unvollständig
      monat('2026-04', '2026-04-30', null), // unvollständig
      monat('2026-05', '2026-05-29', '2026-05-29'), // vollständig
      monat('2026-08', '2026-08-31', '2026-08-03'), // laufender Monat
    ]);

    expect(result.incompleteMonths).toEqual(['2026-03', '2026-04']);
  });

  it('meldet nichts, wenn gar keine Kandidaten übergeben werden', () => {
    const result = findIncompleteMonths(nutzer(), HEUTE, []);

    expect(result).toEqual({ skipped: false, incompleteMonths: [] });
  });
});

describe('parseArgs (14-07-PLAN.md, Task 2)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  function mockExit(): {
    exitSpy: ReturnType<typeof vi.spyOn>;
    errorSpy: ReturnType<typeof vi.spyOn>;
  } {
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    return { exitSpy, errorSpy };
  }

  it('ohne Argumente ist der Lauf ein Trockenlauf über alle Nutzer', () => {
    expect(parseArgs([])).toEqual({
      apply: false,
      allowProduction: false,
      userId: null,
      maxMonths: null,
      allMonths: false,
    });
  });

  it('setzt apply und allowProduction bei den entsprechenden Flags', () => {
    const args = parseArgs(['--apply', '--allow-production']);

    expect(args.apply).toBe(true);
    expect(args.allowProduction).toBe(true);
  });

  it('parst --userId und --maxMonths als Zahlen', () => {
    const args = parseArgs(['--userId=17', '--maxMonths=5']);

    expect(args.userId).toBe(17);
    expect(args.maxMonths).toBe(5);
  });

  it('setzt allMonths nur bei gesetztem --all-months', () => {
    expect(parseArgs([]).allMonths).toBe(false);
    expect(parseArgs(['--all-months']).allMonths).toBe(true);
    expect(parseArgs(['--all-months', '--apply']).allMonths).toBe(true);
  });

  it('weist ein nicht-ganzzahliges --maxMonths mit Exit 2 zurück', () => {
    const { exitSpy } = mockExit();

    expect(() => parseArgs(['--maxMonths=2.5'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('weist --userId=0 mit Exit 2 zurück (nur positive Ganzzahlen)', () => {
    const { exitSpy } = mockExit();

    expect(() => parseArgs(['--userId=0'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('weist ein unbekanntes Argument mit Exit 2 zurück statt es stillschweigend zu ignorieren', () => {
    const { exitSpy } = mockExit();

    expect(() => parseArgs(['--dry-run'])).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});
