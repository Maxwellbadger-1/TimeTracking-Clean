import { describe, it, expect, afterEach, vi } from 'vitest';
import { parseArgs, assertExpectationsMatch } from './applyModelChange.js';

/**
 * Tests der Argumentauswertung (`parseArgs()`) und der Erwartungsprüfung
 * (`assertExpectationsMatch()`) als reine Funktionen — Muster aus `productionGuard.test.ts`
 * (`vi.spyOn(process, 'exit')` wirft statt wirklich zu beenden).
 *
 * Der Schreibpfad (`applyWorkTimeChange()`) wird hier NICHT getestet — er ist über
 * `workPeriodChangeService.test.ts` bereits abgedeckt (14-05-PLAN.md, Task 1, <action>).
 * Dieses Modul öffnet keine Datenbank: `parseArgs()`/`assertExpectationsMatch()` berühren
 * ausschließlich `process.argv`-artige Eingaben und `console`/`process.exit`.
 */

const REQUIRED_ARGS = [
  '--userId=5',
  '--validFrom=2026-01-01',
  '--weeklyHours=20',
  '--reason=Testgrund fuer die Erwartungspruefung',
  '--createdBy=1',
  '--expectUser=Mustermann',
  '--expectCurrentWeeklyHours=40',
];

function mockExit(): { exitSpy: ReturnType<typeof vi.spyOn>; errorSpy: ReturnType<typeof vi.spyOn> } {
  const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
    throw new Error('process.exit called');
  }) as never);
  const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
  return { exitSpy, errorSpy };
}

describe('parseArgs (14-05-PLAN.md, Task 1)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('parst einen vollständigen Trockenlauf-Aufruf korrekt (apply=false, allowProduction=false, workSchedule=null)', () => {
    const args = parseArgs(REQUIRED_ARGS);

    expect(args).toEqual({
      userId: 5,
      validFrom: '2026-01-01',
      weeklyHours: 20,
      reason: 'Testgrund fuer die Erwartungspruefung',
      createdBy: 1,
      expectUser: 'Mustermann',
      expectCurrentWeeklyHours: 40,
      workSchedule: null,
      apply: false,
      allowProduction: false,
    });
  });

  it('setzt apply=true und allowProduction=true bei den entsprechenden Flags', () => {
    const args = parseArgs([...REQUIRED_ARGS, '--apply', '--allow-production']);

    expect(args.apply).toBe(true);
    expect(args.allowProduction).toBe(true);
  });

  it('parst --workSchedule als gültiges JSON in ein WorkSchedule-Objekt', () => {
    const schedule = {
      monday: 8,
      tuesday: 8,
      wednesday: 8,
      thursday: 8,
      friday: 8,
      saturday: 0,
      sunday: 0,
    };
    const args = parseArgs([...REQUIRED_ARGS, `--workSchedule=${JSON.stringify(schedule)}`]);

    expect(args.workSchedule).toEqual(schedule);
  });

  it('fehlt eines der Pflichtargumente (--userId), endet der Aufruf mit Exit 2', () => {
    const { exitSpy } = mockExit();
    const argsWithoutUserId = REQUIRED_ARGS.filter((a) => !a.startsWith('--userId='));

    expect(() => parseArgs(argsWithoutUserId)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('fehlt --expectUser, endet der Aufruf mit Exit 2', () => {
    const { exitSpy } = mockExit();
    const argsWithoutExpectUser = REQUIRED_ARGS.filter((a) => !a.startsWith('--expectUser='));

    expect(() => parseArgs(argsWithoutExpectUser)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('fehlt --expectCurrentWeeklyHours, endet der Aufruf mit Exit 2', () => {
    const { exitSpy } = mockExit();
    const argsWithout = REQUIRED_ARGS.filter(
      (a) => !a.startsWith('--expectCurrentWeeklyHours=')
    );

    expect(() => parseArgs(argsWithout)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('--validFrom ohne YYYY-MM-DD-Muster endet mit Exit 2', () => {
    const { exitSpy } = mockExit();
    const badArgs = REQUIRED_ARGS.map((a) =>
      a.startsWith('--validFrom=') ? '--validFrom=01.01.2026' : a
    );

    expect(() => parseArgs(badArgs)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('nicht-numerisches --weeklyHours endet mit Exit 2', () => {
    const { exitSpy } = mockExit();
    const badArgs = REQUIRED_ARGS.map((a) =>
      a.startsWith('--weeklyHours=') ? '--weeklyHours=abc' : a
    );

    expect(() => parseArgs(badArgs)).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('ungültiges JSON in --workSchedule endet mit Exit 2', () => {
    const { exitSpy } = mockExit();

    expect(() =>
      parseArgs([...REQUIRED_ARGS, '--workSchedule={nicht valides json'])
    ).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });

  it('--workSchedule mit fehlendem Wochentag endet mit Exit 2', () => {
    const { exitSpy } = mockExit();
    const incompleteSchedule = { monday: 8 };

    expect(() =>
      parseArgs([...REQUIRED_ARGS, `--workSchedule=${JSON.stringify(incompleteSchedule)}`])
    ).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);
  });
});

describe('assertExpectationsMatch (14-05-PLAN.md, Task 1, T-14-22)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('läuft ohne process.exit durch, wenn Name und Wochenstunden übereinstimmen', () => {
    const { exitSpy } = mockExit();

    expect(() =>
      assertExpectationsMatch({
        actualLastName: 'Mustermann',
        expectUser: 'Mustermann',
        actualWeeklyHours: 40,
        expectCurrentWeeklyHours: 40,
      })
    ).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('vergleicht --expectUser ohne Groß-/Kleinschreibung und getrimmt', () => {
    const { exitSpy } = mockExit();

    expect(() =>
      assertExpectationsMatch({
        actualLastName: 'Mustermann',
        expectUser: '  mustermann  ',
        actualWeeklyHours: 40,
        expectCurrentWeeklyHours: 40,
      })
    ).not.toThrow();
    expect(exitSpy).not.toHaveBeenCalled();
  });

  it('bricht mit Exit 2 ab, wenn --expectUser NICHT zum lastName passt (gibt erwarteten und vorgefundenen Wert aus)', () => {
    const { exitSpy, errorSpy } = mockExit();

    expect(() =>
      assertExpectationsMatch({
        actualLastName: 'Musterfrau',
        expectUser: 'Mustermann',
        actualWeeklyHours: 40,
        expectCurrentWeeklyHours: 40,
      })
    ).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);

    const loggedText = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(loggedText).toContain('Mustermann');
    expect(loggedText).toContain('Musterfrau');
  });

  it('bricht mit Exit 2 ab, wenn --expectCurrentWeeklyHours NICHT zu den aktuellen Wochenstunden passt (gibt erwarteten und vorgefundenen Wert aus), ohne applyWorkTimeChange zu erreichen', () => {
    const { exitSpy, errorSpy } = mockExit();

    expect(() =>
      assertExpectationsMatch({
        actualLastName: 'Mustermann',
        expectUser: 'Mustermann',
        actualWeeklyHours: 20,
        expectCurrentWeeklyHours: 40,
      })
    ).toThrow('process.exit called');
    expect(exitSpy).toHaveBeenCalledWith(2);

    const loggedText = errorSpy.mock.calls.map((c: unknown[]) => String(c[0])).join('\n');
    expect(loggedText).toContain('40');
    expect(loggedText).toContain('20');
  });
});
