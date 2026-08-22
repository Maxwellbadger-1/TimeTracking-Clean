/**
 * Prüfskript für workTimePeriodDeleteRules.ts.
 *
 * `vitest` ist im Desktop projektweit nicht lauffähig (@babel/runtime fehlt — siehe
 * `modalStack.test.ts`). Muster übernommen: ein `npx tsx`-Prüfskript mit `node:assert`
 * (identisch zu `workTimePeriodEditRules.check.ts`, Plan 13-08).
 *
 * Ausführung: npx tsx src/components/worktime/workTimePeriodDeleteRules.check.ts
 */
import assert from 'node:assert/strict';
import {
  deleteConfirmTitle,
  deleteConfirmMessage,
  deleteDetailGapClosure,
  deleteDetailReversal,
  deleteDetailRebuild,
  deleteConfirmText,
  deleteCancelText,
  deleteConfirmAriaLabel,
  isDeleteConfirmDisabled,
} from './workTimePeriodDeleteRules';

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

// 1. deleteConfirmTitle — wörtlich.
test('deleteConfirmTitle liefert "Periode löschen"', () => {
  assert.equal(deleteConfirmTitle(), 'Periode löschen');
});

// 2. deleteConfirmMessage — vollständige Zeichenkette, inkl. Randfall "offen".
test('deleteConfirmMessage: vollständige Zeichenkette mit Enddatum', () => {
  const message = deleteConfirmMessage({
    validFrom: '2026-03-01',
    validTo: '2026-09-01',
    weeklyHours: 32.5,
    firstName: 'Anna',
    lastName: 'Berger',
  });
  assert.equal(
    message,
    `Die Periode vom ${formatGermanDate('2026-03-01')} bis ${formatGermanDate('2026-09-01')} (32,5 h/Woche) für Anna Berger wird gelöscht.`
  );
});

test('deleteConfirmMessage: offene Periode (validTo null) zeigt "offen" statt eines Datums', () => {
  const message = deleteConfirmMessage({
    validFrom: '2026-03-01',
    validTo: null,
    weeklyHours: 40,
    firstName: 'Anna',
    lastName: 'Berger',
  });
  assert.equal(
    message,
    `Die Periode vom ${formatGermanDate('2026-03-01')} bis offen (40 h/Woche) für Anna Berger wird gelöscht.`
  );
});

// 3. deleteDetailGapClosure — beide Varianten (mit und ohne neues Enddatum).
test('deleteDetailGapClosure: Vorperiode bekommt ein neues Enddatum', () => {
  const text = deleteDetailGapClosure({
    previousValidFrom: '2026-01-01',
    previousWeeklyHours: 20,
    newValidTo: '2026-09-01',
  });
  assert.equal(
    text,
    `Die Periode davor (ab ${formatGermanDate('2026-01-01')}, 20 h/Woche) gilt danach bis zum ${formatGermanDate('2026-09-01')} — es entsteht keine Lücke.`
  );
});

test('deleteDetailGapClosure: Vorperiode wird selbst offen (newValidTo null)', () => {
  const text = deleteDetailGapClosure({
    previousValidFrom: '2026-01-01',
    previousWeeklyHours: 20,
    newValidTo: null,
  });
  assert.equal(
    text,
    `Die Periode davor (ab ${formatGermanDate('2026-01-01')}, 20 h/Woche) gilt danach unbefristet weiter — es entsteht keine Lücke.`
  );
});

// 4. deleteDetailReversal — Einzahl und Mehrzahl, vollständige Zeichenkette.
test('deleteDetailReversal: Einzahl (eine Buchung)', () => {
  const text = deleteDetailReversal({ reversedTransactions: [{ hours: 4.5 }] });
  assert.equal(
    text,
    'Die zugehörige Buchung über +4:30h wird nicht entfernt. Sie wird durch eine Gegenbuchung ausgeglichen. Beide Zeilen bleiben im Kontoauszug sichtbar.'
  );
});

test('deleteDetailReversal: Mehrzahl (mehr als eine Buchung)', () => {
  const text = deleteDetailReversal({
    reversedTransactions: [{ hours: -2 }, { hours: -1.5 }],
  });
  assert.equal(
    text,
    'Die zugehörigen Buchungen über -3:30h werden nicht entfernt. Sie werden durch Gegenbuchungen ausgeglichen. Beide Seiten bleiben im Kontoauszug sichtbar.'
  );
});

test('deleteDetailReversal: Nulldifferenz zeigt "± 0:00h"', () => {
  const text = deleteDetailReversal({ reversedTransactions: [{ hours: 0 }] });
  assert.equal(
    text,
    'Die zugehörige Buchung über ± 0:00h wird nicht entfernt. Sie wird durch eine Gegenbuchung ausgeglichen. Beide Zeilen bleiben im Kontoauszug sichtbar.'
  );
});

// 5. deleteDetailRebuild — beide Varianten (Differenz != 0 und Differenz == 0).
test('deleteDetailRebuild: Saldoänderung ungleich null', () => {
  const text = deleteDetailRebuild({
    rebuildFrom: '2026-03-01',
    balanceBefore: 10,
    balanceAfter: 6.5,
    balanceDelta: -3.5,
  });
  assert.equal(
    text,
    `Neu gerechnet wird vom ${formatGermanDate('2026-03-01')} bis heute. Der Überstundensaldo ändert sich dabei um -3:30h — von +10:00h auf +6:30h.`
  );
});

test('deleteDetailRebuild: Saldoänderung gleich null', () => {
  const text = deleteDetailRebuild({
    rebuildFrom: '2026-03-01',
    balanceBefore: 5,
    balanceAfter: 5,
    balanceDelta: 0,
  });
  assert.equal(
    text,
    `Neu gerechnet wird vom ${formatGermanDate('2026-03-01')} bis heute. Der Überstundensaldo bleibt dabei unverändert.`
  );
});

// 6. deleteConfirmText / deleteCancelText / deleteConfirmAriaLabel — wörtlich.
test('deleteConfirmText liefert "Ja, Periode löschen und stornieren"', () => {
  assert.equal(deleteConfirmText(), 'Ja, Periode löschen und stornieren');
});

test('deleteCancelText liefert "Abbrechen"', () => {
  assert.equal(deleteCancelText(), 'Abbrechen');
});

test('deleteConfirmAriaLabel liefert den vollständigen Satz mit Datum', () => {
  assert.equal(
    deleteConfirmAriaLabel('2026-03-01'),
    `Periode vom ${formatGermanDate('2026-03-01')} löschen und stornieren`
  );
});

// 7. isDeleteConfirmDisabled — alle acht Kombinationen der drei Eingaben.
test('isDeleteConfirmDisabled deckt alle acht Kombinationen korrekt ab', () => {
  const boolValues = [true, false];
  let combinationCount = 0;
  for (const previewReady of boolValues) {
    for (const previewFailed of boolValues) {
      for (const isDeleting of boolValues) {
        combinationCount++;
        const expected = !previewReady || previewFailed || isDeleting;
        assert.equal(
          isDeleteConfirmDisabled({ previewReady, previewFailed, isDeleting }),
          expected,
          `previewReady=${previewReady} previewFailed=${previewFailed} isDeleting=${isDeleting}`
        );
      }
    }
  }
  assert.equal(combinationCount, 8);
});

assert.ok(testCount >= 14, `Erwartet mindestens 14 Testfälle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
