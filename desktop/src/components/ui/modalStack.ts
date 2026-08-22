/**
 * Modal-Stack — modulweiter Stapel offener Modale (Phase 12).
 *
 * Ohne einen zentralen Stapel feuert bei zwei uebereinanderliegenden Modalen
 * (z. B. WorkTimeChangeModal ueber EditUserModal) jede ESC-Registrierung auf
 * `document` unabhaengig und schliesst beide Ebenen gleichzeitig. Dieser
 * Stack macht "ist das die oberste Instanz?" pruefbar (isTopModal) und
 * buendelt den Scroll-Lock auf `document.body.style.overflow`.
 *
 * Index-Guard in popModal ist Pflicht: `stack.lastIndexOf(id)` liefert `-1`
 * fuer eine unbekannte id. Ohne die Pruefung wuerde `splice(-1, 1)` den
 * LETZTEN (also einen fremden) Eintrag entfernen — der Stack bliebe dann
 * dauerhaft nicht leer und der Scroll-Lock haengt bis zum Neustart auf
 * 'hidden' fest (siehe Threat T-12-06).
 *
 * `desktop/src/components/privacy/PrivacyPolicyModal.tsx` schreibt ebenfalls
 * unabhaengig auf `document.body.style.overflow`, nimmt aber ABSICHTLICH
 * NICHT an diesem Stack teil — das Datenschutz-Gate laeuft vor jeder
 * Bedienung der Anwendung, eine Ueberlappung mit einem Stack-Modal ist
 * ausgeschlossen (12-UI-SPEC.md, Abschnitt "Modal-Stack: ESC, Scroll-Lock,
 * Fokus").
 */

const stack: symbol[] = [];

export function pushModal(id: symbol): void {
  stack.push(id);
  document.body.style.overflow = 'hidden';
}

export function popModal(id: symbol): void {
  const i = stack.lastIndexOf(id);
  if (i === -1) return;

  stack.splice(i, 1);

  if (stack.length === 0) {
    document.body.style.overflow = 'unset';
  }
}

export function isTopModal(id: symbol): boolean {
  return stack.length > 0 && stack[stack.length - 1] === id;
}
