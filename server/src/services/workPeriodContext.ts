/**
 * Work Period Context — der Perioden-Cache eines einzelnen Berechnungslaufs
 *
 * (1) D1 — VORLADEN STATT JE AUFRUF NACHSCHLAGEN. Der kritische Fall sind Tagesschleifen
 * über ein ganzes Jahr: 365 zusätzliche Datenbankzugriffe je Nutzer je Rebuild. Ein Nutzer
 * hat typischerweise ein bis drei Perioden — die Liste ist winzig, das Nachladen wäre reine
 * Verschwendung. `createWorkPeriodContext()` lädt deshalb `getWorkPeriods(userId)` beim
 * ersten `resolve()`-Aufruf für diesen Nutzer genau einmal und löst danach ausschließlich
 * im Speicher auf.
 *
 * (2) D2 — KEIN PROZESSWEITER CACHE. Kein modul-globales `Map`, kein Singleton, kein
 * `static` — sonst liefert eine Berechnung nach einem Perioden-Update stille Altwerte, und
 * genau das wäre in einem Zeiterfassungssystem ein Fehler, den niemand bemerkt, bis eine
 * Lohnabrechnung falsch ist. Der Cache lebt ausschließlich in der Closure des jeweiligen
 * `createWorkPeriodContext()`-Aufrufs und damit nur für den einen Berechnungslauf, der ihn
 * hält. Aufrufer ohne eigenen Berechnungslauf — Einzelabfragen, keine Tagesschleifen —
 * verwenden stattdessen `directWorkPeriodLookup`: gleiche Semantik, nur ohne Vorladen und
 * damit langsamer bei wiederholten Aufrufen.
 *
 * (3) Die Auflösung selbst steht nicht hier. Sowohl der Cache als auch der Fallback rufen
 * `resolveWorkPeriodIn()`/`resolveWorkPeriodAt()` aus `workPeriodService.ts` auf — die eine
 * Auflösungsstelle des Projekts (Lehre aus Phase 9: zwölf Kopien derselben Regel). Dieser
 * Plan ändert kein Verhalten: nach ihm ruft weiterhin niemand diesen Kontext auf.
 *
 * WICHTIG — DIESER SERVICE BLEIBT SYNCHRON.
 * better-sqlite3 ist synchron; kein async/await, keine dynamischen Importe in diesem Modul
 * (Muster aus `vacationTransactionService.ts:1-29`).
 *
 * Kontext: .planning/phases/11-datumsabh-ngige-berechnung/11-CONTEXT.md (D1, D2),
 * .planning/phases/11-datumsabh-ngige-berechnung/11-02-PLAN.md
 */

import { getWorkPeriods, resolveWorkPeriodAt, resolveWorkPeriodIn } from './workPeriodService.js';
import type { UserWorkPeriod } from '../types/index.js';

export interface WorkPeriodContext {
  /** Löst die am Datum gültige Periode auf. `date` MUSS YYYY-MM-DD sein. */
  resolve(userId: number, date: string): UserWorkPeriod | null;
}

/**
 * Baut einen neuen, ausschließlich für den aufrufenden Berechnungslauf lebenden
 * Perioden-Cache (D1, D2). Die `Map` lebt in der Closure dieses Aufrufs — kein
 * modul-globaler Zustand, kein Singleton. Ein leeres Ergebnis (Nutzer ohne Periode) wird
 * ebenfalls gemerkt, damit ein Nutzer ohne Periode nicht bei jedem `resolve()` erneut
 * abgefragt wird.
 */
export function createWorkPeriodContext(): WorkPeriodContext {
  const cache = new Map<number, UserWorkPeriod[]>();

  return {
    resolve(userId: number, date: string): UserWorkPeriod | null {
      let periods = cache.get(userId);
      if (periods === undefined) {
        periods = getWorkPeriods(userId);
        cache.set(userId, periods);
      }
      return resolveWorkPeriodIn(periods, date);
    },
  };
}

/**
 * Fallback für Aufrufer OHNE eigenen Berechnungslauf (D2): schlägt bei jedem Aufruf direkt
 * über `resolveWorkPeriodAt()` nach — gleiche Semantik wie ein `WorkPeriodContext`, nur ohne
 * Vorladen und damit bei wiederholten Aufrufen langsamer. Darf NUR für Einzelabfragen
 * verwendet werden, NICHT in Tagesschleifen — dort gehört ein per `createWorkPeriodContext()`
 * gebauter Kontext hin (D1).
 */
export const directWorkPeriodLookup: WorkPeriodContext = {
  resolve(userId: number, date: string): UserWorkPeriod | null {
    return resolveWorkPeriodAt(userId, date);
  },
};
