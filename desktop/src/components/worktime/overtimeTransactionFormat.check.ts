/**
 * Pruefskript fuer die Storno-Paar-Formatierer aus overtimeTransactionFormat.ts.
 *
 * `vitest` ist im Desktop projektweit nicht lauffaehig (fehlendes @babel/runtime,
 * siehe modalStack.test.ts). Dieses Skript folgt demselben Muster: `npx tsx` +
 * `node:assert`, vollstaendige Zeichenkettenvergleiche statt `includes`.
 *
 * Ausfuehrung: cd desktop && npm run check:rules (typprueft ueber tsconfig.check.json und
 *              fuehrt alle vier *.check.ts-Skripte aus; einzeln:
 *              npx tsx src/components/worktime/overtimeTransactionFormat.check.ts)
 */
import assert from 'node:assert/strict';
import {
  reversalStateLabel,
  reversalPartnerId,
  reversedNoteLine,
  receiptChipLabel,
  receiptChipAriaLabel,
  resolveReceiptJumpOutcome,
} from './overtimeTransactionFormat';

let testCount = 0;

function test(name: string, fn: () => void): void {
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

// Drei Fixture-Zeilen, wie sie GET /overtime/transactions/live fuer ein Storno-Paar liefert
// (server/src/services/overtimeLiveCalculationService.ts, Plan 13-06).
const originalRowWithName = {
  reversalOf: null,
  reversedBy: 99,
  reversedAt: '2026-08-22T12:00:00Z',
  reversedByName: 'Anna Admin',
  referenceId: 501,
  date: '2026-08-01',
};

const originalRowWithoutName = {
  reversalOf: null,
  reversedBy: 99,
  reversedAt: '2026-08-22T12:00:00Z',
  reversedByName: null,
  referenceId: 501,
  date: '2026-08-01',
};

const counterRow = {
  reversalOf: 42,
  reversedBy: null,
  reversedAt: null,
  reversedByName: null,
  referenceId: 501,
  date: '2026-08-01',
};

const normalRow = {
  reversalOf: null,
  reversedBy: null,
  reversedAt: null,
  reversedByName: null,
  referenceId: undefined,
  date: '2026-08-01',
};

// 1. reversalStateLabel — alle drei Lagen
test('reversalStateLabel: Originalzeile mit reversedBy -> storniert', () => {
  assert.strictEqual(reversalStateLabel(originalRowWithName), 'storniert');
});
test('reversalStateLabel: Gegenbuchung mit reversalOf -> Storno', () => {
  assert.strictEqual(reversalStateLabel(counterRow), 'Storno');
});
test('reversalStateLabel: gewoehnliche Zeile -> null', () => {
  assert.strictEqual(reversalStateLabel(normalRow), null);
});

// 2. reversalPartnerId — dieselben drei Lagen
test('reversalPartnerId: Originalzeile liefert reversedBy', () => {
  assert.strictEqual(reversalPartnerId(originalRowWithName), 99);
});
test('reversalPartnerId: Gegenbuchung liefert reversalOf', () => {
  assert.strictEqual(reversalPartnerId(counterRow), 42);
});
test('reversalPartnerId: gewoehnliche Zeile -> null', () => {
  assert.strictEqual(reversalPartnerId(normalRow), null);
});

// 3. reversedNoteLine — beide Varianten, mit und ohne Admin-Name
test('reversedNoteLine: Originalzeile mit Admin-Name', () => {
  assert.strictEqual(
    reversedNoteLine(originalRowWithName),
    'Storniert am 22.8.2026 von Anna Admin · Beleg #501'
  );
});
test('reversedNoteLine: Originalzeile ohne Admin-Name — kein leeres "von "', () => {
  assert.strictEqual(
    reversedNoteLine(originalRowWithoutName),
    'Storniert am 22.8.2026 · Beleg #501'
  );
});
test('reversedNoteLine: Gegenbuchung', () => {
  assert.strictEqual(
    reversedNoteLine(counterRow),
    'Gleicht die Buchung vom 1.8.2026 aus · Beleg #501'
  );
});
test('reversedNoteLine: gewoehnliche Zeile -> null', () => {
  assert.strictEqual(reversedNoteLine(normalRow), null);
});

// 4. receiptChipLabel und beide receiptChipAriaLabel-Varianten
test('receiptChipLabel', () => {
  assert.strictEqual(receiptChipLabel(501), 'Beleg #501');
});
test('receiptChipAriaLabel: Originalzeile', () => {
  assert.strictEqual(receiptChipAriaLabel(true), 'Zugehörige Storno-Buchung anzeigen');
});
test('receiptChipAriaLabel: Gegenbuchung', () => {
  assert.strictEqual(receiptChipAriaLabel(false), 'Zugehörige Ursprungsbuchung anzeigen');
});

// 5. resolveReceiptJumpOutcome — alle vier Eingangslagen
test('resolveReceiptJumpOutcome: Partnerzeile gefunden -> jump', () => {
  const outcome = resolveReceiptJumpOutcome({
    partnerFound: true,
    loadedCount: 10,
    limit: 50,
  });
  assert.deepStrictEqual(outcome, { kind: 'jump' });
});
test('resolveReceiptJumpOutcome: nicht gefunden, Liste voll -> Abschneide-Toast', () => {
  const outcome = resolveReceiptJumpOutcome({
    partnerFound: false,
    loadedCount: 50,
    limit: 50,
  });
  assert.deepStrictEqual(outcome, {
    kind: 'toast',
    message:
      'Die zugehörige Buchung ist in dieser Ansicht nicht geladen — angezeigt werden nur die letzten 50 Buchungen. Wählen Sie einen engeren Zeitraum.',
  });
});
test('resolveReceiptJumpOutcome: nicht gefunden, Monat gewaehlt -> Monats-Toast', () => {
  const outcome = resolveReceiptJumpOutcome({
    partnerFound: false,
    loadedCount: 10,
    limit: 50,
    month: 8,
    year: 2026,
  });
  assert.deepStrictEqual(outcome, {
    kind: 'toast',
    message: 'Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums (August 2026).',
  });
});
test('resolveReceiptJumpOutcome: nicht gefunden, kein Monat -> Jahres-Toast', () => {
  const outcome = resolveReceiptJumpOutcome({
    partnerFound: false,
    loadedCount: 10,
    limit: 50,
    year: 2026,
  });
  assert.deepStrictEqual(outcome, {
    kind: 'toast',
    message: 'Die zugehörige Buchung liegt außerhalb des gewählten Zeitraums (2026).',
  });
});

assert.ok(testCount >= 15, `Erwartet mindestens 15 Testfaelle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
