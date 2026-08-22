/**
 * Test-Fixtures für Arbeitszeitperioden — Plan 11-04
 *
 * Zwei Bausteine für die Tests der Pläne 11-04 bis 11-09:
 *
 * `stubWorkPeriodContext()` baut einen `WorkPeriodContext` ausschließlich im Speicher, ohne
 * Datenbankzugriff und ohne eigene Intervall-Logik — die Auflösung läuft über
 * `resolveWorkPeriodIn()` aus `workPeriodService.ts` (die eine Auflösungsstelle des Projekts,
 * s. `workPeriodContext.ts`). Für Tests, die eine Rechenfunktion isoliert prüfen.
 *
 * `insertTestWorkPeriod()` legt über `createWorkPeriod()` eine echte Periode in der
 * (Test-)Datenbank an — für Tests, die einen ganzen Berechnungsweg inklusive Datenbank
 * durchlaufen.
 *
 * Kontext: .planning/phases/11-datumsabh-ngige-berechnung/11-04-PLAN.md
 */

import { createWorkPeriod, resolveWorkPeriodIn } from '../services/workPeriodService.js';
import type { WorkPeriodContext } from '../services/workPeriodContext.js';
import type { UserWorkPeriod, WorkSchedule } from '../types/index.js';

export interface StubWorkPeriodEntry {
  userId: number;
  /** Inklusiv, YYYY-MM-DD. */
  validFrom: string;
  /** Exklusiv, YYYY-MM-DD, oder weggelassen/`null` für eine laufende Periode. */
  validTo?: string | null;
  weeklyHours: number;
  workSchedule?: WorkSchedule | null;
}

/**
 * Baut einen `WorkPeriodContext`, dessen `resolve()` ausschließlich gegen die übergebenen
 * `entries` auflöst — kein Datenbankzugriff, kein Cache-Vorladen (das ist bei einer bereits
 * vollständig im Speicher liegenden Liste ohnehin nichts zu tun). Nutzt `resolveWorkPeriodIn()`
 * für die eigentliche Intervall-Auswahl, damit hier keine zweite Kopie der `[validFrom,
 * validTo)`-Regel entsteht.
 */
export function stubWorkPeriodContext(entries: StubWorkPeriodEntry[]): WorkPeriodContext {
  const byUser = new Map<number, UserWorkPeriod[]>();

  entries.forEach((entry, index) => {
    const period: UserWorkPeriod = {
      id: index + 1,
      userId: entry.userId,
      validFrom: entry.validFrom,
      validTo: entry.validTo ?? null,
      weeklyHours: entry.weeklyHours,
      workSchedule: entry.workSchedule ?? null,
      note: 'stubWorkPeriodContext-fixture',
      createdAt: '2020-01-01T00:00:00.000Z',
      createdBy: null,
    };

    const list = byUser.get(entry.userId);
    if (list) {
      list.push(period);
    } else {
      byUser.set(entry.userId, [period]);
    }
  });

  return {
    resolve(userId: number, date: string): UserWorkPeriod | null {
      const periods = byUser.get(userId) ?? [];
      return resolveWorkPeriodIn(periods, date);
    },
  };
}

export interface InsertTestWorkPeriodOptions {
  /** Inklusiv, YYYY-MM-DD. */
  validFrom: string;
  /** Exklusiv, YYYY-MM-DD, oder weggelassen/`null` für eine laufende Periode. */
  validTo?: string | null;
  weeklyHours: number;
  workSchedule?: WorkSchedule | null;
  /** Testmarker, landet in `user_work_periods.note`. */
  note?: string;
}

/**
 * Legt über `createWorkPeriod()` eine echte Periode in der (Test-)Datenbank an. `note` trägt
 * standardmäßig einen Testmarker, damit Fixture-Zeilen in der Datenbank erkennbar bleiben.
 */
export function insertTestWorkPeriod(
  userId: number,
  options: InsertTestWorkPeriodOptions
): UserWorkPeriod {
  return createWorkPeriod({
    userId,
    validFrom: options.validFrom,
    validTo: options.validTo ?? null,
    weeklyHours: options.weeklyHours,
    workSchedule: options.workSchedule ?? null,
    note: options.note ?? 'insertTestWorkPeriod-fixture',
  });
}
