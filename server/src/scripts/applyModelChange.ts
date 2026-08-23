/**
 * Zwei-Stufen-Skript für EINEN Arbeitszeitmodellwechsel gegen eine ausdrücklich benannte
 * Datenbank (D3, 14-05-PLAN.md).
 *
 *   DATABASE_PATH=<pfad> npx tsx src/scripts/applyModelChange.ts \
 *     --userId=<id> --validFrom=<YYYY-MM-DD> --weeklyHours=<zahl> --reason=<text> \
 *     --createdBy=<id> --expectUser=<nachname> --expectCurrentWeeklyHours=<zahl> \
 *     [--workSchedule=<json>]                              → Trockenlauf
 *
 *   ... [dieselben Argumente] --apply                       → schreibt
 *
 * Vorgeschriebene Aufrufform gegen die Produktionsdatenbank (D4, .claude/CLAUDE.md,
 * „Database Rules" — ohne DATABASE_PATH legt getDatabasePath() beim production-Fallback eine
 * NEUE, LEERE Datei an statt die echte Produktionsdatenbank zu öffnen):
 *
 *   DATABASE_PATH=/home/ubuntu/databases/production.db NODE_ENV=production \
 *     npx tsx src/scripts/applyModelChange.ts [...Argumente] [--apply] --allow-production
 *
 * D6-PLATZHALTER (14-05-PLAN.md, <d6_platzhalter>): Die vier Werte des realen
 * Umstellungsfalls (welcher Nutzer, ab wann, von wie viel auf wie viel) sind NICHT bekannt
 * und werden hier NICHT erfunden. Deshalb sind --userId/--validFrom/--weeklyHours/--reason
 * Pflichtargumente auf der Kommandozeile, keine hartkodierte Kandidatenliste — anders als das
 * Vorbild `correctPreHireVacationBalances2025.ts`, dessen Kandidatenliste vom Anwender bereits
 * geprüft und festgelegt war.
 *
 * ERWARTUNGSPRÜFUNG GEGEN VERTIPPTE --userId (T-14-22): --expectUser (Abgleich mit dem
 * lastName des geladenen Nutzers) und --expectCurrentWeeklyHours (Abgleich mit den
 * Wochenstunden der am --validFrom gültigen Periode) sind zusätzliche Pflichtargumente. Bei
 * Abweichung endet das Skript mit Exit 2, BEVOR `applyWorkTimeChange()` gerufen wird — eine
 * vertippte userId kann damit höchstens einen falschen Menschen ANZEIGEN, nie einen falschen
 * Menschen SCHREIBEN.
 *
 * PRODUKTIONSSCHUTZ UND REIHENFOLGE (T-14-23, T-14-24, zwingend wie in snapshotBalances.ts
 * und productionGuard.ts begründet):
 *   1. Ausschließlich importsichere Module am Kopf: `path`, `url`, `./productionGuard.js`,
 *      `../config/database.js`, `../utils/workSchedule.js` (reine Typwächter/Stringauflösung,
 *      öffnet keine Datenbank).
 *   2. Argumentauswertung (`parseArgs()` — reine Funktion, öffnet nichts).
 *   3. `DATABASE_PATH`-Pflichtprüfung — kein stiller Rückfall auf `database/development.db`.
 *   4. Nur wenn `--allow-production` NICHT gesetzt ist: `assertNotProduction(resolvedPath)`,
 *      synchron, bevor irgendetwas geöffnet wird.
 *   5. Erst danach `await import('../services/userService.js')`,
 *      `await import('../services/workPeriodService.js')`,
 *      `await import('../services/overtimeTransactionService.js')`,
 *      `await import('../services/workPeriodChangeService.js')` und
 *      `await import('../database/connection.js')` — alle innerhalb von `main()`.
 *
 * `--allow-production` IST DIE EINZIGE STELLE, AN DER DER GUARD UMGANGEN WERDEN KANN. Er
 * existiert, weil derselbe Code in Plan 14-09 bewusst gegen die echte Produktion laufen muss;
 * ohne ihn wäre ein zweites, ungetestetes Skript nötig. Setzt der Aufrufer ihn, druckt das
 * Skript vor jeder weiteren Zeile eine unmissverständliche Warnzeile mit dem aufgelösten Pfad.
 * Ohne `--apply` bleibt auch mit `--allow-production` der Trockenlauf — der Schalter umgeht
 * ausschließlich den Pfad-Schutz, nie die Schreibsperre.
 *
 * KEINE EIGENE SCHREIBLOGIK: Der Modellwechsel läuft ausschließlich über
 * `applyWorkTimeChange()` (`workPeriodChangeService.ts`) — Transaktionsklammer,
 * Kettenprüfung, begrenzter Rebuild, `model_change`-Journalzeile und `audit_log`-Eintrag
 * greifen damit genauso wie über die Admin-Oberfläche.
 */

import path from 'path';
import { pathToFileURL } from 'url';
import { assertNotProduction } from './productionGuard.js';
import { getDatabasePath } from '../config/database.js';
import { isWorkSchedule } from '../utils/workSchedule.js';
import type { WorkSchedule } from '../types/index.js';

// ---------------------------------------------------------------------------------------
// Argumentauswertung — reine Funktion, öffnet keine Datenbank, keine Seiteneffekte außer
// process.exit(2) bei einem Aufruffehler (Muster: snapshotBalances.ts printUsageAndExit()).
// ---------------------------------------------------------------------------------------

export interface ParsedApplyModelChangeArgs {
  userId: number;
  validFrom: string;
  weeklyHours: number;
  reason: string;
  createdBy: number;
  expectUser: string;
  expectCurrentWeeklyHours: number;
  workSchedule: WorkSchedule | null;
  apply: boolean;
  allowProduction: boolean;
}

const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function printUsageAndExit(message?: string): never {
  if (message) {
    console.error(`FEHLER: ${message}`);
  }
  console.error('Nutzung:');
  console.error(
    '  DATABASE_PATH=<pfad> npx tsx src/scripts/applyModelChange.ts \\'
  );
  console.error(
    '    --userId=<id> --validFrom=<YYYY-MM-DD> --weeklyHours=<zahl> --reason=<text> \\'
  );
  console.error(
    '    --createdBy=<id> --expectUser=<nachname> --expectCurrentWeeklyHours=<zahl> \\'
  );
  console.error(
    '    [--workSchedule=<json>] [--apply] [--allow-production]'
  );
  console.error('');
  console.error(
    '  --userId, --validFrom, --weeklyHours, --reason, --createdBy, --expectUser und'
  );
  console.error('  --expectCurrentWeeklyHours sind Pflichtargumente.');
  console.error('  --validFrom muss dem Format YYYY-MM-DD entsprechen.');
  process.exit(2);
}

function parseRequiredNumber(
  raw: string | undefined,
  flagName: string
): number {
  if (raw === undefined) {
    printUsageAndExit(`--${flagName} fehlt.`);
  }
  const value = Number(raw);
  if (!Number.isFinite(value)) {
    printUsageAndExit(`--${flagName} muss eine Zahl sein, erhalten: "${raw}".`);
  }
  return value;
}

export function parseArgs(argv: string[]): ParsedApplyModelChangeArgs {
  const raw = new Map<string, string>();
  let apply = false;
  let allowProduction = false;

  for (const arg of argv) {
    if (arg === '--apply') {
      apply = true;
    } else if (arg === '--allow-production') {
      allowProduction = true;
    } else if (arg.startsWith('--')) {
      const eq = arg.indexOf('=');
      if (eq === -1) {
        printUsageAndExit(`Unbekanntes oder fehlerhaftes Argument: "${arg}".`);
      }
      raw.set(arg.slice(2, eq), arg.slice(eq + 1));
    }
  }

  for (const flagName of [
    'userId',
    'validFrom',
    'weeklyHours',
    'reason',
    'createdBy',
    'expectUser',
    'expectCurrentWeeklyHours',
  ]) {
    if (!raw.has(flagName)) {
      printUsageAndExit(`--${flagName} fehlt.`);
    }
  }

  const userId = parseRequiredNumber(raw.get('userId'), 'userId');
  const weeklyHours = parseRequiredNumber(raw.get('weeklyHours'), 'weeklyHours');
  const createdBy = parseRequiredNumber(raw.get('createdBy'), 'createdBy');
  const expectCurrentWeeklyHours = parseRequiredNumber(
    raw.get('expectCurrentWeeklyHours'),
    'expectCurrentWeeklyHours'
  );

  const validFrom = raw.get('validFrom') as string;
  if (!DATE_PATTERN.test(validFrom)) {
    printUsageAndExit(
      `--validFrom muss dem Format YYYY-MM-DD entsprechen, erhalten: "${validFrom}".`
    );
  }

  const reason = raw.get('reason') as string;
  const expectUser = raw.get('expectUser') as string;

  let workSchedule: WorkSchedule | null = null;
  const workScheduleRaw = raw.get('workSchedule');
  if (workScheduleRaw !== undefined) {
    let parsed: unknown;
    try {
      parsed = JSON.parse(workScheduleRaw);
    } catch {
      printUsageAndExit(
        `--workSchedule ist kein gültiges JSON: "${workScheduleRaw}".`
      );
    }
    if (!isWorkSchedule(parsed)) {
      printUsageAndExit(
        '--workSchedule muss für alle sieben Wochentage eine Zahl zwischen 0 und 24 enthalten.'
      );
    }
    workSchedule = parsed;
  }

  return {
    userId,
    validFrom,
    weeklyHours,
    reason,
    createdBy,
    expectUser,
    expectCurrentWeeklyHours,
    workSchedule,
    apply,
    allowProduction,
  };
}

// ---------------------------------------------------------------------------------------
// Erwartungsprüfung (T-14-22) — reine Funktion, öffnet keine Datenbank. Schützt gegen eine
// vertippte --userId: bricht ab, BEVOR applyWorkTimeChange() gerufen wird.
// ---------------------------------------------------------------------------------------

export function assertExpectationsMatch(params: {
  actualLastName: string;
  expectUser: string;
  actualWeeklyHours: number;
  expectCurrentWeeklyHours: number;
}): void {
  const nameMatches =
    params.actualLastName.trim().toLowerCase() ===
    params.expectUser.trim().toLowerCase();

  if (!nameMatches) {
    console.error(
      'FEHLER: --expectUser passt nicht zum Nachnamen des geladenen Nutzers.'
    );
    console.error(`  Erwartet (--expectUser):  "${params.expectUser}"`);
    console.error(`  Vorgefunden (lastName):   "${params.actualLastName}"`);
    console.error(
      '  Schutz gegen eine vertippte --userId (T-14-22) — applyWorkTimeChange() wird NICHT gerufen.'
    );
    process.exit(2);
  }

  if (params.actualWeeklyHours !== params.expectCurrentWeeklyHours) {
    console.error(
      'FEHLER: --expectCurrentWeeklyHours passt nicht zu den aktuell gültigen Wochenstunden.'
    );
    console.error(
      `  Erwartet (--expectCurrentWeeklyHours): ${params.expectCurrentWeeklyHours}`
    );
    console.error(
      `  Vorgefunden (aktuelle Periode am --validFrom): ${params.actualWeeklyHours}`
    );
    console.error(
      '  Schutz gegen eine vertippte --userId (T-14-22) — applyWorkTimeChange() wird NICHT gerufen.'
    );
    process.exit(2);
  }
}

// ---------------------------------------------------------------------------------------
// main()
// ---------------------------------------------------------------------------------------

async function main(): Promise<void> {
  // DATABASE_PATH ist Pflicht — kein stiller Rückfall auf database/development.db (D4).
  if (!process.env.DATABASE_PATH || process.env.DATABASE_PATH.trim() === '') {
    console.error('FEHLER: DATABASE_PATH ist nicht gesetzt.');
    console.error(
      '  Ohne DATABASE_PATH fällt dieses Werkzeug NICHT still auf database/development.db zurück.'
    );
    console.error('  Setze DATABASE_PATH=<pfad-zu-einer-datenbank> explizit.');
    process.exit(2);
  }

  const args = parseArgs(process.argv.slice(2));

  const resolvedPath = path.resolve(getDatabasePath());

  // Schritt 1 (Ablauf, 14-05-PLAN.md): aufgelöster Pfad als allererste Ausgabezeile — Lehre
  // aus zwei gescheiterten Phase-8-Deployments.
  console.log('Aufgelöster Datenbankpfad:', resolvedPath);

  if (args.allowProduction) {
    console.log(
      '### WARNUNG: --allow-production gesetzt — Produktionsschutz UMGANGEN. ###'
    );
    console.log(`  Zieldatenbank: ${resolvedPath}`);
  } else {
    // Guard synchron, bevor irgendein schreibendes Modul geladen wird.
    assertNotProduction(resolvedPath);
  }

  // Schritt 2: Modus.
  console.log(
    args.apply
      ? '### MODUS: SCHREIBEN ###'
      : '### TROCKENLAUF — es wird nichts geschrieben ###'
  );
  console.log('');

  // Erst JETZT, nach dem Guard, werden DB-berührende Module geladen.
  const { getUserById } = await import('../services/userService.js');
  const { getWorkPeriods, resolveWorkPeriodIn } = await import(
    '../services/workPeriodService.js'
  );
  const { getOvertimeBalance } = await import(
    '../services/overtimeTransactionService.js'
  );
  const { applyWorkTimeChange, WorkTimeChangeValidationError } = await import(
    '../services/workPeriodChangeService.js'
  );
  const { db } = await import('../database/connection.js');

  // Schritt 3: Nutzer laden. Existiert er nicht oder trägt er deletedAt, endet
  // getUserById() bereits mit undefined (Query filtert deletedAt IS NULL) — Exit 2.
  const user = getUserById(args.userId);
  if (!user) {
    console.error(
      `FEHLER: Nutzer ${args.userId} existiert nicht oder ist gelöscht (deletedAt gesetzt).`
    );
    process.exit(2);
  }

  // Schritt 4: Erwartungsprüfung — BEVOR applyWorkTimeChange() gerufen wird.
  const periods = getWorkPeriods(args.userId);
  const currentPeriod = resolveWorkPeriodIn(periods, args.validFrom);
  const actualWeeklyHours = currentPeriod ? currentPeriod.weeklyHours : user.weeklyHours;

  assertExpectationsMatch({
    actualLastName: user.lastName,
    expectUser: args.expectUser,
    actualWeeklyHours,
    expectCurrentWeeklyHours: args.expectCurrentWeeklyHours,
  });

  // Schritt 5: Ist-Zustand drucken.
  const balanceBefore = getOvertimeBalance(args.userId);
  console.log(
    `Nutzer: ${user.firstName} ${user.lastName} (userId ${user.id}), Eintrittsdatum: ${user.hireDate}`
  );
  console.log('Vorhandene Perioden:');
  for (const period of periods) {
    console.log(
      `  validFrom=${period.validFrom} validTo=${period.validTo ?? '(laufend)'} weeklyHours=${period.weeklyHours}`
    );
  }
  console.log(`Saldo vor dem Lauf: ${balanceBefore} h`);
  console.log('');

  // Schritt 6: applyWorkTimeChange() — keine eigene Schreiblogik.
  let outcome;
  try {
    outcome = applyWorkTimeChange(
      {
        userId: args.userId,
        validFrom: args.validFrom,
        weeklyHours: args.weeklyHours,
        workSchedule: args.workSchedule,
        reason: args.reason,
      },
      { dryRun: !args.apply, createdBy: args.createdBy }
    );
  } catch (err) {
    if (err instanceof WorkTimeChangeValidationError) {
      console.error(`FEHLER: ${err.message}`);
      process.exit(1);
    }
    throw err;
  }

  // Schritt 7: Vorschau vollständig drucken.
  console.log('=== Vorschau ===');
  console.log(`balanceDelta:      ${outcome.preview.balanceDelta} h`);
  console.log(`targetHoursDelta:  ${outcome.preview.targetHoursDelta} h`);
  console.log(`midMonthEffective: ${outcome.preview.midMonthEffective}`);
  console.log(`affectedMonths:    ${outcome.preview.affectedMonths.join(', ')}`);
  console.log('');

  if (!args.apply) {
    console.log('Trockenlauf beendet. Mit --apply ausführen.');
    process.exit(0);
  }

  // Schritt 9: Mit --apply — Saldo nach dem Lauf und integrity_check.
  const balanceAfter = getOvertimeBalance(args.userId);
  console.log(`Saldo nach dem Lauf: ${balanceAfter} h`);
  console.log('integrity_check:', JSON.stringify(db.pragma('integrity_check')));
  console.log('');
  console.log('### FERTIG ###');
  process.exit(0);
}

// Läuft nur, wenn diese Datei direkt als CLI ausgeführt wird — ein `import` (z. B. aus
// applyModelChange.test.ts, um parseArgs()/assertExpectationsMatch() zu testen) führt
// main() NICHT aus.
const isMainModule =
  process.argv[1] !== undefined &&
  pathToFileURL(process.argv[1]).href === import.meta.url;

if (isMainModule) {
  main().catch((err) => {
    console.error('FATAL:', err);
    process.exit(1);
  });
}
