/**
 * Pruefskript fuer die fuenf additiven `ConfirmDialog`-Props (Phase 13, 13-07-PLAN.md Task 3).
 *
 * Der im Projekt konfigurierte Unit-Testlaeufer (vitest, `desktop/package.json` Skript `test`)
 * ist in diesem Environment nicht lauffaehig: `@testing-library/react` (geladen ueber
 * `src/test/setup.ts`) bricht mit "Cannot find module
 * '@babel/runtime/helpers/interopRequireDefault'" ab — geprueft an einem bestehenden,
 * unveraenderten Test, der mit demselben Fehler scheitert (siehe `modalStack.test.ts`,
 * `timeUtils.periods.test.ts`). Vorbestehendes, projektweites Problem, ausserhalb des
 * Aenderungsumfangs. Deshalb dieselbe Ausweichroute: ein `npx tsx`-Pruefskript mit
 * `node:assert`, ohne Renderer.
 *
 * Ausfuehrung: cd desktop && npx tsx src/components/ui/confirmDialogProps.check.ts
 */
import assert from 'node:assert/strict';
import type { ComponentProps } from 'react';
import { ConfirmDialog, isConfirmButtonDisabled, shouldCloseAfterConfirm } from './ConfirmDialog';

let testCount = 0;

function test(name: string, fn: () => void): void {
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

// --- 1. Rueckwaertskompatibilitaet ---------------------------------------------------------
//
// Ein Objektliteral, das nur die bisherigen Pflichtfelder von ConfirmDialogProps traegt, ist
// ein gueltiger Wert dieses Typs. Diese Zusicherung traegt AUSSCHLIESSLICH `tsc --noEmit` — das
// Objekt wird nie konstruiert/gerendert, nur typgeprueft. Waeren `details`, `confirmDisabled`,
// `confirmLoading`, `cancelDisabled` oder `closeOnConfirm` NICHT optional, wuerde diese
// Zuweisung nicht kompilieren und `npx tsc --noEmit` mit einem Typfehler abbrechen.
test('Rueckwaertskompatibilitaet: bisherige Pflichtfelder allein ergeben gueltige ConfirmDialogProps (Compiler-Beweis)', () => {
  const legacyProps: ComponentProps<typeof ConfirmDialog> = {
    isOpen: true,
    onClose: () => {},
    onConfirm: () => {},
    title: 'Titel',
    message: 'Nachricht',
  };
  // node:assert traegt hier nichts inhaltlich Neues — der Compiler hat die Aussage bereits
  // beim Kompilieren dieser Datei geprueft. assert.ok haelt lediglich fest, dass die
  // Konstruktion zur Laufzeit nicht wirft.
  assert.ok(legacyProps.isOpen === true);
});

// --- 2. Ableitungsregeln ohne Renderer ------------------------------------------------------

test('isConfirmButtonDisabled: vier Wertekombinationen', () => {
  assert.equal(isConfirmButtonDisabled(undefined, undefined), false);
  assert.equal(isConfirmButtonDisabled(true, undefined), true);
  assert.equal(isConfirmButtonDisabled(undefined, true), true);
  assert.equal(isConfirmButtonDisabled(true, true), true);
});

test('shouldCloseAfterConfirm: zwei Wertekombinationen plus Default', () => {
  assert.equal(shouldCloseAfterConfirm(undefined), true, 'Default true — Rueckwaertskompatibilitaet');
  assert.equal(shouldCloseAfterConfirm(true), true);
  assert.equal(shouldCloseAfterConfirm(false), false);
});

assert.ok(testCount >= 3, `Erwartet mindestens 3 Testfaelle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
