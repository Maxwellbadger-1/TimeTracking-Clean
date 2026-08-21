/**
 * Reine Vergleichslogik für den Wege-Vergleich (D3, 09-CONTEXT.md).
 *
 * KEIN Datenbankimport hier — bewusst getrennt von compareOvertimePaths.ts (dem CLI), weil das
 * Connection-Modul unter server/src/database (Zeile 50: `initializeConnection()`) die
 * Datenbank beim `import` öffnet, nicht erst bei einem Funktionsaufruf. Ein Import dieser
 * Datei — oder eines Moduls, das sie transitiv importiert — darf niemals eine
 * Datenbankverbindung auslösen, sonst würden die Unit-Tests unbeabsichtigt gegen
 * server/database/development.db laufen.
 */

/** Toleranz in Stunden, unterhalb derer ein Unterschied als Gleitkommarundung gilt, nicht als Defekt. */
export const TOLERANCE_HOURS = 0.01;

/**
 * Kleine Zugabe auf TOLERANCE_HOURS, um IEEE-754-Rundungsfehler bei der Subtraktion
 * abzufangen (z. B. 12.51 - 12.5 = 0.010000000000005329 statt exakt 0.01). Ohne diese Zugabe
 * würde eine Differenz exakt auf der Toleranzgrenze fälschlich als Abweichung gemeldet.
 */
const FLOAT_EPSILON = 1e-9;

export interface PathValue {
  name: string;
  value: number | null;
}

export interface ComparisonResult {
  divergent: boolean;
  maxDelta: number;
  pairs: Array<{ a: string; b: string; delta: number }>;
  missing: string[];
}

/**
 * Vergleicht die Werte mehrerer Berechnungswege für dieselbe Kennzahl (Nutzer + Monat).
 *
 * - Jede Paarung wird genau einmal gebildet (Kombination, keine Permutation).
 * - Ein Weg mit `value === null` (Wert nicht ermittelbar) macht das Ergebnis divergent und
 *   trägt seinen Namen in `missing` ein; er fließt nicht in `pairs`/`maxDelta` ein, da kein
 *   numerischer Vergleich möglich ist.
 * - Divergenz bei numerischen Paaren: |a - b| > TOLERANCE_HOURS (plus Gleitkomma-Toleranz).
 */
export function comparePaths(values: PathValue[]): ComparisonResult {
  const missing = values.filter(v => v.value === null).map(v => v.name);

  const pairs: Array<{ a: string; b: string; delta: number }> = [];
  let maxDelta = 0;
  let divergent = missing.length > 0;

  for (let i = 0; i < values.length; i++) {
    for (let j = i + 1; j < values.length; j++) {
      const a = values[i];
      const b = values[j];
      if (a.value === null || b.value === null) {
        // Bereits über `missing` erfasst — kein numerischer Vergleich möglich.
        continue;
      }

      const delta = Math.abs(a.value - b.value);
      pairs.push({ a: a.name, b: b.name, delta });

      if (delta > maxDelta) {
        maxDelta = delta;
      }
      if (delta > TOLERANCE_HOURS + FLOAT_EPSILON) {
        divergent = true;
      }
    }
  }

  return { divergent, maxDelta, pairs, missing };
}
