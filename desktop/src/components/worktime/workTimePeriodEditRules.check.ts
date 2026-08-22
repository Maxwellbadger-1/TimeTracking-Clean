/**
 * Prüfskript für workTimePeriodEditRules.ts.
 *
 * `vitest` ist im Desktop projektweit nicht lauffähig (@babel/runtime fehlt — siehe
 * `modalStack.test.ts`). Muster übernommen: ein `npx tsx`-Prüfskript mit `node:assert`.
 *
 * Ausführung: cd desktop && npm run check:rules (typprüft über tsconfig.check.json und
 *              führt alle vier *.check.ts-Skripte aus; einzeln:
 *              npx tsx src/components/worktime/workTimePeriodEditRules.check.ts)
 */
import assert from 'node:assert/strict';
import {
  isRetroactivePeriod,
  resolveIsRetroactive,
  primaryButtonLabel,
  isPrimaryDisabled,
  validateCorrectionForm,
  workScheduleEquals,
  sumWorkScheduleHours,
  MAX_WEEKLY_HOURS,
  type ValidateCorrectionFormArgs,
} from './workTimePeriodEditRules';
import type { WorkSchedule } from '../../types';

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

// 3. isPrimaryDisabled für alle vier Kombinationen der zwei verbliebenen Eingaben.
test('isPrimaryDisabled deckt alle vier Kombinationen korrekt ab', () => {
  const boolValues = [true, false];
  let combinationCount = 0;
  for (const hasPreviewToken of boolValues) {
    for (const isSaving of boolValues) {
      combinationCount++;
      const expected = !hasPreviewToken || isSaving;
      assert.equal(
        isPrimaryDisabled({ hasPreviewToken, isSaving }),
        expected,
        `hasPreviewToken=${hasPreviewToken} isSaving=${isSaving}`
      );
    }
  }
  assert.equal(combinationCount, 4);
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


// 6. WR-09 (Code-Review Phase 13) — der Tagesplan-Vergleich ist feldweise, nicht über
//    JSON.stringify, und die Wochensumme wird clientseitig geprüft.
test('workScheduleEquals: gleiche Werte, andere Schlüsselreihenfolge gelten als gleich', () => {
  const a: WorkSchedule = {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  };
  // Dasselbe Objekt, in umgekehrter Schlüsselreihenfolge aufgebaut — genau das, was ein
  // neu zusammengesetzter WorkScheduleEditor-Zustand liefern kann.
  const b: WorkSchedule = {
    sunday: 0,
    saturday: 0,
    friday: 8,
    thursday: 8,
    wednesday: 8,
    tuesday: 8,
    monday: 8,
  };
  assert.notEqual(JSON.stringify(a), JSON.stringify(b));
  assert.equal(workScheduleEquals(a, b), true);
  assert.equal(workScheduleEquals(null, null), true);
  assert.equal(workScheduleEquals(a, null), false);
  assert.equal(workScheduleEquals(a, { ...a, friday: 7 }), false);
});

test('validateCorrectionForm: andere Schlüsselreihenfolge ist KEINE Änderung (WR-09)', () => {
  const original: WorkSchedule = {
    monday: 8,
    tuesday: 8,
    wednesday: 8,
    thursday: 8,
    friday: 8,
    saturday: 0,
    sunday: 0,
  };
  const reordered: WorkSchedule = {
    sunday: 0,
    saturday: 0,
    friday: 8,
    thursday: 8,
    wednesday: 8,
    tuesday: 8,
    monday: 8,
  };
  const errors = validateCorrectionForm({
    ...baseArgs,
    validFrom: '2026-03-01',
    weeklyHoursRaw: '40',
    workSchedule: reordered,
    original: { validFrom: '2026-03-01', weeklyHours: 40, workSchedule: original },
  });
  // Vor dem Fix: kein formError, das Formular liess das Speichern zu — und der Server
  // antwortete mit 400 "Es wurde nichts geändert."
  assert.equal(
    errors.formError,
    'Es wurde nichts geändert. Ändern Sie einen Wert oder brechen Sie ab.'
  );
});

test('validateCorrectionForm: Tagesplansumme über 60 h wird clientseitig abgewiesen (WR-09)', () => {
  const tooMuch: WorkSchedule = {
    monday: 13,
    tuesday: 13,
    wednesday: 13,
    thursday: 13,
    friday: 13,
    saturday: 0,
    sunday: 0,
  };
  assert.equal(sumWorkScheduleHours(tooMuch), 65);
  const errors = validateCorrectionForm({ ...baseArgs, workSchedule: tooMuch });
  assert.equal(
    errors.weeklyHours,
    `Die Summe des Tagesplans (65,0 h) darf ${MAX_WEEKLY_HOURS} Stunden pro Woche nicht überschreiten.`
  );
});

// 7. M-3 (UI-Review Phase 13): Die Begründung sperrt den Primärknopf NICHT mehr — sonst feuert
//    `handleSubmit()` nie, und Zustand 11 („Feldfehler an der Textarea; Fokus springt auf das
//    Feld") bliebe unerreichbar. Der Riegel steht stattdessen im Absendepfad, mit denselben
//    zwei Sätzen aus dem Textbuch, und er zählt getrimmt — genau wie der Zeichenzähler unter
//    dem Feld seit diesem Fix.
test('M-3: eine zu kurze Begründung sperrt den Primärknopf nicht mehr stumm', () => {
  assert.equal(isPrimaryDisabled({ hasPreviewToken: true, isSaving: false }), false);
  // Der Absendepfad hält sie trotzdem auf — mit einem Satz, den der Anwender lesen kann.
  assert.equal(
    validateCorrectionForm({ ...baseArgs, reason: '          ' }).reason,
    'Begründung ist erforderlich'
  );
  assert.equal(
    validateCorrectionForm({ ...baseArgs, reason: '  zu kurz  ' }).reason,
    'Begründung muss mindestens 10 Zeichen lang sein'
  );
  // Zehn Leerzeichen sind keine Begründung — der Zähler zeigt dafür seit M-3 "0/10".
  assert.equal('          '.trim().length, 0);
});

// 8. M-1 (UI-Review Phase 13, BLOCKER, REQ-30) — die Serverantwort schlägt die Clientrechnung.
//
//    Der Fall aus dem Review, nicht konstruiert: Periode ab 01.01.2026, offenes Ende, heute ist
//    der 23.08.2026. Der Admin stellt fest, dass die Umstellung erst im Oktober galt, und setzt
//    „Gültig ab" auf den 01.10.2026 — laut Hilfstext des Feldes ausdrücklich vorgesehen.
//
//    Der Server nimmt das MINIMUM aus altem und neuem Beginn
//    (`workPeriodCorrectionService.ts`: `rangeStart = input.validFrom < period.validFrom ? …`)
//    und rechnet damit acht Monate Vergangenheit neu: `isRetroactive === true`.
//    Die frühere Clientrechnung sah nur den neuen Beginn und sagte `false` — blaues Panel,
//    Badge „Keine Rückwirkung", Knopf „Korrektur speichern" und KEIN Bestätigungsschritt.
const PAST_PERIOD_START = '2026-01-01';
const MOVED_INTO_FUTURE = '2026-10-01';
const TODAY = '2026-08-23';

test('M-1: die frühere Clientrechnung allein hält den Zukunftsfall für harmlos', () => {
  // Beleg, dass der Fall wirklich auseinanderläuft — nicht dass der Fix ihn erfindet.
  assert.equal(isRetroactivePeriod(MOVED_INTO_FUTURE, TODAY), false);
  assert.equal(isRetroactivePeriod(PAST_PERIOD_START, TODAY), true);
});

test('M-1: Beginn einer vergangenen Periode in die Zukunft verschoben → rückwirkend (Vorschau)', () => {
  assert.equal(
    resolveIsRetroactive({
      // Der Server hat gerechnet: min(01.01.2026, 01.10.2026) = 01.01.2026 < heute.
      previewIsRetroactive: true,
      validFrom: MOVED_INTO_FUTURE,
      originalValidFrom: PAST_PERIOD_START,
      today: TODAY,
    }),
    true,
    'Liegt eine Vorschau vor, ist ihr isRetroactive die einzige Wahrheit — der Bestätigungsschritt hängt daran.'
  );
});

test('M-1: derselbe Fall vor der ersten Vorschau — die Vorab-Weiche bildet dasselbe Minimum', () => {
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: null,
      validFrom: MOVED_INTO_FUTURE,
      originalValidFrom: PAST_PERIOD_START,
      today: TODAY,
    }),
    true,
    'Auch im Wartezustand zwischen Eingabe und entprellter Antwort darf nicht „keine Rückwirkung" stehen.'
  );
});

test('M-1: eine Vorschau mit isRetroactive=false wird nicht clientseitig überstimmt', () => {
  // Periode liegt vollständig in der Zukunft (alt wie neu) — blaues Panel ist hier richtig.
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: false,
      validFrom: '2026-11-01',
      originalValidFrom: '2026-10-01',
      today: TODAY,
    }),
    false
  );
  // Und der umgekehrte Fall: der Client hielte es für rückwirkend, der Server sagt nein.
  assert.equal(isRetroactivePeriod('2026-08-01', TODAY), true);
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: false,
      validFrom: '2026-08-01',
      originalValidFrom: '2026-08-01',
      today: TODAY,
    }),
    false
  );
});

test('M-1: Vorab-Weiche ohne Vorschau — Beginn vorgezogen, Gleichstand, leeres Feld', () => {
  // Beginn nach vorn gezogen: das Minimum ist der NEUE Beginn.
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: null,
      validFrom: '2026-07-01',
      originalValidFrom: '2026-09-01',
      today: TODAY,
    }),
    true
  );
  // Beide in der Zukunft: nichts wird rückwirkend berührt.
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: null,
      validFrom: '2026-11-01',
      originalValidFrom: '2026-10-01',
      today: TODAY,
    }),
    false
  );
  // Gleichstand mit heute gilt nicht als rückwirkend (Regel aus isRetroactivePeriod).
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: null,
      validFrom: TODAY,
      originalValidFrom: TODAY,
      today: TODAY,
    }),
    false
  );
  // Geleertes Datumsfeld: '' ist kein Datum und darf nicht als „kleinster Wert" gewinnen —
  // maßgeblich bleibt der alte Beginn.
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: null,
      validFrom: '',
      originalValidFrom: '2026-10-01',
      today: TODAY,
    }),
    false
  );
  assert.equal(
    resolveIsRetroactive({
      previewIsRetroactive: null,
      validFrom: '',
      originalValidFrom: PAST_PERIOD_START,
      today: TODAY,
    }),
    true
  );
});

assert.ok(testCount >= 22, `Erwartet mindestens 22 Testfälle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
