/**
 * Pruefskript fuer modalStack.ts.
 *
 * Der im Projekt konfigurierte Unit-Testlaeufer (vitest, `desktop/package.json`
 * Skript `test`) ist in diesem Environment nicht lauffaehig: `@testing-library/react`
 * (geladen ueber `src/test/setup.ts`) bricht mit
 * "Cannot find module '@babel/runtime/helpers/interopRequireDefault'" ab — geprueft
 * an einem bestehenden, unveraenderten Test (`timeUtils.test.ts`), der mit demselben
 * Fehler scheitert. Das ist ein vorbestehendes, projektweites Problem, nicht durch
 * diesen Plan verursacht, und ausserhalb des Aenderungsumfangs (`CLAUDE.md`
 * SCOPE BOUNDARY). Deshalb greift die im Task beschriebene Ausweichroute: ein
 * `npx tsx`-Pruefskript mit `node:assert`, das denselben Dateinamen traegt.
 *
 * Ausfuehrung: npx tsx src/components/ui/modalStack.test.ts
 */
import assert from 'node:assert/strict';
import { pushModal, popModal, isTopModal } from './modalStack';

type DocumentStub = { body: { style: { overflow: string } } };

// Minimaler document-Stub: modalStack.ts liest/schreibt ausschliesslich
// document.body.style.overflow. Unter reinem Node (ohne jsdom) existiert
// document nicht; der Stub genuegt fuer dieses Modul vollstaendig.
(globalThis as unknown as { document: DocumentStub }).document = {
  body: { style: { overflow: '' } },
};

function getOverflow(): string {
  return (globalThis as unknown as { document: DocumentStub }).document.body.style.overflow;
}

function setOverflow(value: string): void {
  (globalThis as unknown as { document: DocumentStub }).document.body.style.overflow = value;
}

let testCount = 0;

function test(name: string, fn: () => void): void {
  setOverflow('');
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

test('pushModal haengt die id oben an und setzt document.body.style.overflow auf hidden', () => {
  const id = Symbol('modal');
  pushModal(id);
  assert.equal(isTopModal(id), true);
  assert.equal(getOverflow(), 'hidden');
  popModal(id);
});

test('isTopModal liefert true nur fuer den obersten Eintrag, false fuer darunterliegende und unbekannte ids', () => {
  const id1 = Symbol('modal-1');
  const id2 = Symbol('modal-2');
  const unknown = Symbol('unknown');
  pushModal(id1);
  pushModal(id2);
  assert.equal(isTopModal(id2), true);
  assert.equal(isTopModal(id1), false);
  assert.equal(isTopModal(unknown), false);
  popModal(id2);
  popModal(id1);
});

test('popModal entfernt bei zwei gestapelten Modalen genau die uebergebene Instanz und laesst overflow auf hidden', () => {
  const id1 = Symbol('modal-1');
  const id2 = Symbol('modal-2');
  pushModal(id1);
  pushModal(id2);
  popModal(id1);
  assert.equal(isTopModal(id2), true);
  assert.equal(isTopModal(id1), false);
  assert.equal(getOverflow(), 'hidden');
  popModal(id2);
});

test('popModal des letzten Eintrags setzt document.body.style.overflow auf unset', () => {
  const id = Symbol('modal');
  pushModal(id);
  popModal(id);
  assert.equal(getOverflow(), 'unset');
});

test('popModal einer unbekannten id veraendert den Stack nicht und laesst overflow unangetastet', () => {
  const id = Symbol('modal');
  const unknown = Symbol('unknown');
  pushModal(id);
  setOverflow('hidden');
  popModal(unknown);
  assert.equal(isTopModal(id), true);
  assert.equal(getOverflow(), 'hidden');
  popModal(id);
});

test('zweimaliges popModal derselben id entfernt nicht zusaetzlich einen fremden Eintrag', () => {
  const id1 = Symbol('modal-1');
  const id2 = Symbol('modal-2');
  pushModal(id1);
  pushModal(id2);
  popModal(id2);
  popModal(id2);
  assert.equal(isTopModal(id1), true);
  assert.equal(getOverflow(), 'hidden');
  popModal(id1);
});

assert.ok(testCount >= 6, `Erwartet mindestens 6 Testfaelle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
