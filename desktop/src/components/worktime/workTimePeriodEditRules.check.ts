/**
 * Prüfskript für workTimePeriodEditRules.ts.
 *
 * `vitest` ist im Desktop projektweit nicht lauffähig (@babel/runtime fehlt — siehe
 * `modalStack.test.ts`). Muster übernommen: ein `npx tsx`-Prüfskript mit `node:assert`.
 *
 * Ausführung: npx tsx src/components/worktime/workTimePeriodEditRules.check.ts
 */
import assert from 'node:assert/strict';
import {
  isRetroactivePeriod,
  primaryButtonLabel,
  isPrimaryDisabled,
  validateCorrectionForm,
  type ValidateCorrectionFormArgs,
} from './workTimePeriodEditRules';

let testCount = 0;

function test(name: string, fn: () => void): void {
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

/** Anzeige eines ISO-Datums im deutschen Format — dieselbe Formel wie in der geprüften Datei. */
function formatGermanDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

// 1. isRetroactivePeriod: vor, gleich, nach "heute" — Gleichstand ist NICHT rückwirkend.
test('isRetroactivePeriod: ein Datum vor heute ist rückwirkend', () => {
  assert.equal(isRetroactivePeriod('2026-08-01', '2026-08-22'), true);
});
test('isRetroactivePeriod: heute selbst ist NICHT rückwirkend', () => {
  assert.equal(isRetroactivePeriod('2026-08-22', '2026-08-22'), false);
});
test('isRetroactivePeriod: ein Datum nach heute ist nicht rückwirkend', () => {
  assert.equal(isRetroactivePeriod('2026-09-01', '2026-08-22'), false);
});

// 2. Beide Beschriftungen des Primärknopfes wörtlich.
test('primaryButtonLabel(true) liefert den rückwirkenden Text', () => {
  assert.equal(primaryButtonLabel(true), 'Korrektur rückwirkend speichern');
});
test('primaryButtonLabel(false) liefert den nicht-rückwirkenden Text', () => {
  assert.equal(primaryButtonLabel(false), 'Korrektur speichern');
});

// 3. isPrimaryDisabled für alle acht Kombinationen der drei Eingaben.
test('isPrimaryDisabled deckt alle acht Kombinationen korrekt ab', () => {
  const boolValues = [true, false];
  const reasonLengths = [5, 10];
  let combinationCount = 0;
  for (const hasPreviewToken of boolValues) {
    for (const isSaving of boolValues) {
      for (const trimmedReasonLength of reasonLengths) {
        combinationCount++;
        const expected = !hasPreviewToken || isSaving || trimmedReasonLength < 10;
        assert.equal(
          isPrimaryDisabled({ hasPreviewToken, isSaving, trimmedReasonLength }),
          expected,
          `hasPreviewToken=${hasPreviewToken} isSaving=${isSaving} trimmedReasonLength=${trimmedReasonLength}`
        );
      }
    }
  }
  assert.equal(combinationCount, 8);
});

// 4. validateCorrectionForm — neun Fehlerlagen, jeweils die VOLLSTÄNDIGE Zeichenkette (kein
//    `includes` auf Teilstücke).
const baseArgs: ValidateCorrectionFormArgs = {
  validFrom: '2026-06-01',
  weeklyHoursRaw: '35',
  reason: 'Vertrag von Anfang an mit 30 h vereinbart, falsch eingetragen',
  workSchedule: null,
  isFirst: false,
  hireDate: '2025-01-01',
  endDate: null,
  previousPeriod: { id: 10, validFrom: '2026-01-01' },
  nextPeriod: { id: 12, validFrom: '2026-12-01' },
  original: { validFrom: '2026-03-01', weeklyHours: 40, workSchedule: null },
};

test('validateCorrectionForm: leere Begründung', () => {
  const errors = validateCorrectionForm({ ...baseArgs, reason: '' });
  assert.equal(errors.reason, 'Begründung ist erforderlich');
});

test('validateCorrectionForm: Begründung kürzer als 10 Zeichen', () => {
  const errors = validateCorrectionForm({ ...baseArgs, reason: 'zu kurz' });
  assert.equal(errors.reason, 'Begründung muss mindestens 10 Zeichen lang sein');
});

test('validateCorrectionForm: Wochenstunden leer', () => {
  const errors = validateCorrectionForm({ ...baseArgs, weeklyHoursRaw: '' });
  assert.equal(errors.weeklyHours, 'Wochenstunden sind erforderlich');
});

test('validateCorrectionForm: Wochenstunden außerhalb 0–60', () => {
  const errors = validateCorrectionForm({ ...baseArgs, weeklyHoursRaw: '61' });
  assert.equal(errors.weeklyHours, 'Wochenstunden müssen zwischen 0 und 60 liegen');
});

test('validateCorrectionForm: Beginn vor dem Eintrittsdatum', () => {
  const errors = validateCorrectionForm({
    ...baseArgs,
    validFrom: '2024-12-31',
    previousPeriod: null,
    nextPeriod: null,
  });
  assert.equal(
    errors.validFrom,
    `Der Beginn darf nicht vor dem Eintrittsdatum (${formatGermanDate('2025-01-01')}) liegen.`
  );
});

test('validateCorrectionForm: Beginn überlappt die Periode davor', () => {
  const errors = validateCorrectionForm({ ...baseArgs, validFrom: '2026-01-01' });
  assert.equal(
    errors.validFrom,
    `Der Beginn muss nach dem ${formatGermanDate('2026-01-01')} liegen — dem Beginn der vorherigen Periode.`
  );
  assert.equal(errors.conflictPeriodId, 10);
});

test('validateCorrectionForm: Beginn liegt am oder nach dem Ende der nächsten Periode', () => {
  const errors = validateCorrectionForm({ ...baseArgs, validFrom: '2026-12-01' });
  assert.equal(
    errors.validFrom,
    `Der Beginn muss vor dem ${formatGermanDate('2026-12-01')} liegen — dem Beginn der nächsten Periode.`
  );
  assert.equal(errors.conflictPeriodId, 12);
});

test('validateCorrectionForm: Beginn nach dem Austrittsdatum', () => {
  const errors = validateCorrectionForm({
    ...baseArgs,
    validFrom: '2026-11-01',
    endDate: '2026-10-31',
  });
  assert.equal(
    errors.validFrom,
    `Der Beginn liegt nach dem Austrittsdatum (${formatGermanDate('2026-10-31')}).`
  );
});

test('validateCorrectionForm: keine Änderung vorgenommen', () => {
  const errors = validateCorrectionForm({
    ...baseArgs,
    validFrom: baseArgs.original.validFrom,
    weeklyHoursRaw: String(baseArgs.original.weeklyHours),
    workSchedule: baseArgs.original.workSchedule,
  });
  assert.equal(
    errors.formError,
    'Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab.'
  );
});

// 5. Eine gültige Eingabe liefert eine leere Fehlerzuordnung.
test('validateCorrectionForm: gültige, geänderte Eingabe liefert keine Fehler', () => {
  const errors = validateCorrectionForm(baseArgs);
  assert.deepEqual(errors, {});
});

assert.ok(testCount >= 13, `Erwartet mindestens 13 Testfälle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
