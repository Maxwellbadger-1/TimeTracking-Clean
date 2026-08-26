/**
 * Prüfskript gegen die Rückkehr der Spezifitätskollision (D-2, Phase 14.2, Plan 11).
 *
 * Ursache des Befunds: `className="p-2 sm:px-3 sm:py-1.5"` am Aufrufer wurde von
 * `Button.tsx`s sizeStyles.sm ('px-3 py-1.5 text-sm') überschrieben — Tailwind
 * ordnet Utility-Regeln im erzeugten Stylesheet nach ENTDECKUNGSREIHENFOLGE beim
 * Build, nicht nach Reihenfolge im `class`-Attribut. Ohne das `!`-Präfix ist die
 * lokale Polsterung am Aufrufer wirkungslos, egal wie oft man `p-2` hinschreibt
 * (14.2-CONTEXT.md, D-12). Dieses Skript prüft den QUELLTEXT auf das `!`-Präfix
 * und auf die Abwesenheit der Kollisionsform — nicht die gerenderte Größe (dafür
 * ist `tests/messungen/d2-trefferflaechen.mjs` zuständig, gegen den laufenden
 * Server).
 *
 * `vitest` ist im Desktop projektweit nicht lauffähig (@babel/runtime fehlt —
 * siehe `modalStack.test.ts`). Muster übernommen: ein `npx tsx`-Prüfskript mit
 * `node:assert` (identisch zu `workTimePeriodDeleteRules.check.ts`, Plan 13-08).
 *
 * Ausführung: cd desktop && npm run check:rules (typprüft über tsconfig.check.json
 *              und führt alle fünf *.check.ts-Skripte aus; einzeln:
 *              npx tsx src/components/worktime/workTimePeriodActionsSize.check.ts)
 */
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

let testCount = 0;

function test(name: string, fn: () => void): void {
  fn();
  testCount++;
  console.log(`PASS: ${name}`);
}

const dieseDatei = fileURLToPath(import.meta.url);
const quellPfad = join(dirname(dieseDatei), 'workTimePeriodActions.tsx');
const quelltext = readFileSync(quellPfad, 'utf-8');

/**
 * Entfernt Block- und Zeilenkommentare (`// …`), BEVOR gezählt wird.
 * Ohne diesen Schritt würde der Begründungskommentar im Kopf der Datei — der die
 * frühere Kollisionsform ('p-2' ohne '!') wörtlich zitiert, um sie zu erklären —
 * die Prüfung selbst ungültig machen (T-14.2-11-06).
 */
function ohneKommentare(text: string): string {
  return text.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
}

const codeOhneKommentare = ohneKommentare(quelltext);

// 1. Der "Korrigieren"-Knopf trägt !p-2 im tatsächlichen Code (nicht im Kommentar).
test('"Korrigieren"-Knopf trägt !p-2 im className (außerhalb von Kommentaren)', () => {
  const bereich = codeOhneKommentare.match(/aria-label="Korrigieren"[\s\S]{0,300}/)?.[0] ?? '';
  assert.match(bereich, /className="[^"]*!p-2[^"]*"/, bereich);
});

// 2. Der "Löschen"-Knopf trägt ebenfalls !p-2 (Nachtrag aus Task 2 — derselbe Befund,
//    dieselbe Zelle, dieselbe Kollision, siehe SUMMARY dieses Plans).
test('"Löschen"-Knopf trägt !p-2 im className (außerhalb von Kommentaren)', () => {
  const bereich = codeOhneKommentare.match(/aria-label="Löschen"[\s\S]{0,300}/)?.[0] ?? '';
  assert.match(bereich, /className="[^"]*!p-2[^"]*"/, bereich);
});

// 3. Die Kollisionsform darf NIRGENDS im Code (außerhalb von Kommentaren) zurückkehren:
//    "p-2" ohne führendes "!" ist wieder eine tote Klasse.
test('Kein "p-2" ohne führendes "!" außerhalb von Kommentaren (Kollisionsform darf nicht zurückkehren)', () => {
  const treffer = codeOhneKommentare.match(/(?<!!)\bp-2\b/g) ?? [];
  assert.equal(treffer.length, 0, `Gefunden ohne "!"-Präfix: ${JSON.stringify(treffer)}`);
});

// 4. Der Chip "Nicht löschbar" trägt py-2 (32 px Höhe) statt py-1 (24 px, Ausgangsbefund).
test('Chip "Nicht löschbar" trägt py-2 statt py-1', () => {
  const bereich = codeOhneKommentare.match(/role="note"[\s\S]{0,600}/)?.[0] ?? '';
  assert.match(bereich, /className="[^"]*\bpy-2\b[^"]*"/, bereich);
  assert.doesNotMatch(bereich, /className="[^"]*\bpy-1\b[^"]*"/, bereich);
});

// 5. Der Begründungskommentar im Kopf nennt D-2 und die tatsächliche Ursache
//    (Entdeckungsreihenfolge), nicht nur "fehlendes p-2" — sonst kehrt derselbe
//    Fehlschluss beim nächsten Refactoring zurück.
test('Kopfkommentar nennt D-2 und die Ursache (Tailwind-Entdeckungsreihenfolge)', () => {
  assert.match(quelltext, /D-2/);
  assert.match(quelltext, /Entdeckungsreihenfolge/);
});

assert.ok(testCount >= 4, `Erwartet mindestens 4 Testfälle, gefunden ${testCount}`);
console.log(`\n${testCount} Tests bestanden.`);
