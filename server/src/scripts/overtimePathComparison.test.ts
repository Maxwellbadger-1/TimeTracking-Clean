import { describe, it, expect } from 'vitest';
import { comparePaths, TOLERANCE_HOURS, type PathValue } from './overtimePathComparison.js';

/**
 * Tests für die reine Vergleichslogik von compareOvertimePaths.ts (D3, 09-CONTEXT.md).
 *
 * KEIN Datenbankimport in dieser Datei oder in overtimePathComparison.ts — siehe Begründung
 * im Dateikopf von overtimePathComparison.ts: server/src/database/connection.ts öffnet die
 * Datenbank beim Import (Modulebene), das würde diese Unit-Tests unbeabsichtigt gegen
 * server/database/development.db laufen lassen.
 */
describe('comparePaths', () => {
  it('meldet keine Abweichung, wenn alle Wege identisch sind', () => {
    const values: PathValue[] = [
      { name: 'unified', value: 12.5 },
      { name: 'dashboard', value: 12.5 },
      { name: 'report_summary', value: 12.5 },
    ];

    const result = comparePaths(values);

    expect(result.divergent).toBe(false);
    expect(result.maxDelta).toBe(0);
    expect(result.missing).toEqual([]);
  });

  it('behandelt einen Unterschied genau auf der Toleranzgrenze nicht als Abweichung (Gleitkommarundung)', () => {
    // 12.51 - 12.5 ergibt in IEEE-754-Arithmetik ca. 0.010000000000005, minimal über
    // TOLERANCE_HOURS = 0.01 — das darf NICHT als Defekt gelten.
    const values: PathValue[] = [
      { name: 'unified', value: 12.5 },
      { name: 'dashboard', value: 12.51 },
    ];

    const result = comparePaths(values);

    expect(TOLERANCE_HOURS).toBe(0.01);
    expect(result.divergent).toBe(false);
  });

  it('meldet eine Abweichung, wenn der Unterschied über der Toleranz liegt', () => {
    const values: PathValue[] = [
      { name: 'unified', value: 12.5 },
      { name: 'dashboard', value: 12.6 },
    ];

    const result = comparePaths(values);

    expect(result.divergent).toBe(true);
    expect(result.maxDelta).toBeCloseTo(0.1, 9);
  });

  it('meldet eine Abweichung und trägt den Wegnamen in missing ein, wenn ein Weg null liefert', () => {
    const values: PathValue[] = [
      { name: 'unified', value: 12.5 },
      { name: 'balance_row', value: null },
    ];

    const result = comparePaths(values);

    expect(result.divergent).toBe(true);
    expect(result.missing).toContain('balance_row');
  });

  it('vergleicht negative Salden korrekt — identisch bleibt unauffällig, gespiegelt weicht ab', () => {
    const identical: PathValue[] = [
      { name: 'unified', value: -3.25 },
      { name: 'dashboard', value: -3.25 },
    ];
    const mirrored: PathValue[] = [
      { name: 'unified', value: -3.25 },
      { name: 'dashboard', value: 3.25 },
    ];

    const identicalResult = comparePaths(identical);
    const mirroredResult = comparePaths(mirrored);

    expect(identicalResult.divergent).toBe(false);
    expect(mirroredResult.divergent).toBe(true);
    expect(mirroredResult.maxDelta).toBeCloseTo(6.5, 9);
  });

  it('führt bei fünf Wegen jede Paarung genau einmal auf (10 Paarungen, nicht doppelt)', () => {
    const values: PathValue[] = [
      { name: 'unified', value: 10 },
      { name: 'dashboard', value: 10 },
      { name: 'report_summary', value: 10 },
      { name: 'report_daily', value: 10 },
      { name: 'balance_row', value: 10 },
    ];

    const result = comparePaths(values);

    expect(result.pairs).toHaveLength(10);
    const uniqueKeys = new Set(result.pairs.map(p => `${p.a}|${p.b}`));
    expect(uniqueKeys.size).toBe(10);
  });
});
