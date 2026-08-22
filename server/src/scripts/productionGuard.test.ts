import { describe, it, expect, afterEach, vi } from 'vitest';
import { assertNotProduction } from './productionGuard.js';
import { getProductionDatabasePath } from '../config/database.js';

/**
 * Automatisierte Abdeckung der drei Auslöser von `assertNotProduction()` (WR-03,
 * 10-REVIEW.md; 10-06-PLAN.md, Task 3).
 *
 * `assertNotProduction()` ist die einzige Funktion, die einen versehentlichen
 * Schreibzugriff auf die Produktionsdatenbank verhindert (Kopfkommentar von
 * `applyMigrationsToCopy.ts:14-19`, Vorfall vom 18.08.2026). Bislang stützte sich ihre
 * Verifikation auf einen manuellen grep-Nachweis und einen einmaligen Lauf gegen eine Kopie
 * (10-02-SUMMARY.md:353) — eine künftige Änderung an `getDatabasePath()` oder
 * `getProductionDatabasePath()` würde davon nicht rot.
 *
 * Öffnet KEINE Datenbank — importiert ausschließlich `productionGuard.js` und
 * `../config/database.js`, beide lösen nur Strings auf (siehe Kopfkommentar von
 * `productionGuard.ts:6-15`).
 */
describe('assertNotProduction (WR-03, 10-REVIEW.md)', () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it('Auslöser 1 (Pfadgleichheit): bricht ab, wenn der geprüfte Pfad dem Produktionspfad entspricht — NODE_ENV ausdrücklich nicht production', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => assertNotProduction(getProductionDatabasePath())).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(2);
    errorSpy.mockRestore();
  });

  it('Auslöser 2 (NODE_ENV=production): bricht ab, obwohl ein harmloser lokaler Pfad übergeben wird', () => {
    vi.stubEnv('NODE_ENV', 'production');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => assertNotProduction('./database/development.db')).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(2);
    errorSpy.mockRestore();
  });

  it('Auslöser 3 (Substring-Rückfall): bricht bei einem Pfad ab, der "production" enthält — auch wenn er unter Windows zu einem anderen absoluten Pfad als der Produktionspfad auflöst', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => assertNotProduction('/home/ubuntu/databases/production.db')).toThrow(
      'process.exit called'
    );

    expect(exitSpy).toHaveBeenCalledWith(2);
    errorSpy.mockRestore();
  });

  it('Auslöser 3, Großschreibung: "PRODUCTION.DB" bricht ebenfalls ab (Implementierung nutzt toLowerCase())', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => assertNotProduction('/tmp/PRODUCTION.DB')).toThrow('process.exit called');

    expect(exitSpy).toHaveBeenCalledWith(2);
    errorSpy.mockRestore();
  });

  it('Gegenprobe: ein harmloser lokaler Pfad läuft bei harmlosem NODE_ENV durch, process.exit wird NICHT gerufen', () => {
    vi.stubEnv('NODE_ENV', 'test');
    const exitSpy = vi.spyOn(process, 'exit').mockImplementation(((): never => {
      throw new Error('process.exit called');
    }) as never);

    expect(() => assertNotProduction('./database/development.db')).not.toThrow();

    expect(exitSpy).not.toHaveBeenCalled();
  });
});
