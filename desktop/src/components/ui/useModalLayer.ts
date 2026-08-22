import { useEffect, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import * as modalStack from './modalStack';

/**
 * Gemeinsame Modal-Infrastruktur fuer `Modal` und `ConfirmDialog`.
 *
 * WARUM DIESE DATEI EXISTIERT (WR-15, Code-Review Phase 12): `FOCUSABLE_SELECTOR`, die vier
 * Refs, der Stack-Effekt, der ESC-Effekt, der Fokusrueckgabe-Effekt und `handlePanelKeyDown`
 * lagen in beiden Primitiven Zeile fuer Zeile identisch vor (rund 70 Zeilen). Jeder Fix an
 * der Fokusfalle musste zweimal gemacht werden — und genau das ging schief (CR-02). Ab jetzt
 * gibt es EINE Fassung; `Modal` und `ConfirmDialog` behalten nur ihr eigenes Markup.
 *
 * CR-02 (Code-Review Phase 12): Der Tab-Ring haengt an einem `onKeyDown` AUF DEM PANEL. Ein
 * solcher Handler feuert nur, wenn der Fokus bereits INNERHALB des Panels liegt. Keine der
 * beiden Primitiven setzte beim Oeffnen einen Anfangsfokus — die Fokusfalle griff damit nie,
 * und der Tastaturnutzer landete beim ersten Tab in der Oberflaeche HINTER dem Dialog.
 * Deshalb setzt der Oeffnungs-Effekt jetzt einen Anfangsfokus, sofern der Fokus noch
 * ausserhalb des Panels liegt.
 *
 * Aufrufer, die einen abweichenden Anfangsfokus wollen (`WorkTimeChangeModal` → Stichtag),
 * setzen ihn in ihrem EIGENEN Effekt. Die Reihenfolge stimmt: Kind-Effekte (`Modal`) laufen
 * vor Eltern-Effekten (`WorkTimeChangeModal`).
 */

export const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

interface ModalLayer {
  /** Auf das Panel-Element setzen (`role="dialog"`-Traeger). */
  panelRef: React.RefObject<HTMLDivElement | null>;
  /** Als `onKeyDown` auf dasselbe Panel-Element setzen. */
  handlePanelKeyDown: (e: ReactKeyboardEvent<HTMLDivElement>) => void;
}

export function useModalLayer(isOpen: boolean, onClose: () => void, label = 'modal'): ModalLayer {
  const idRef = useRef<symbol>(Symbol(label));
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);

  onCloseRef.current = onClose;

  // Stack-Teilnahme + Scroll-Lock. Abhaengigkeit ausschliesslich [isOpen] —
  // onClose ist bei den Aufrufern eine Inline-Funktion und wuerde bei jedem
  // Render eine neue Registrierung ausloesen.
  useEffect(() => {
    if (!isOpen) return;

    modalStack.pushModal(idRef.current);

    return () => {
      modalStack.popModal(idRef.current);
    };
  }, [isOpen]);

  // ESC schliesst nur die oberste Instanz.
  useEffect(() => {
    if (!isOpen) return;

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && modalStack.isTopModal(idRef.current)) {
        e.stopPropagation();
        onCloseRef.current();
      }
    };

    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('keydown', handleEscape);
    };
  }, [isOpen]);

  // Anfangsfokus (CR-02) + Fokusrueckgabe: merkt sich beim Oeffnen das zuvor fokussierte
  // Element, zieht den Fokus in das Panel und gibt ihn beim Schliessen zurueck, sofern das
  // gemerkte Element noch im Dokument haengt.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;

    const panel = panelRef.current;
    if (panel && !panel.contains(document.activeElement)) {
      const first = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).find(
        (el) => el.offsetParent !== null
      );
      if (first) {
        first.focus();
      } else {
        // Kein fokussierbares Element: das Panel selbst aufnehmen, damit Screenreader den
        // Dialog ankuendigen und der Tab-Ring ueberhaupt greifen kann.
        panel.tabIndex = -1;
        panel.focus();
      }
    }

    return () => {
      const el = previouslyFocusedRef.current;
      if (el instanceof HTMLElement && document.body.contains(el)) {
        el.focus();
      }
    };
  }, [isOpen]);

  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalStack.isTopModal(idRef.current)) return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)).filter(
      (el) => el.offsetParent !== null
    );
    if (focusable.length === 0) return;

    const first = focusable[0];
    const last = focusable[focusable.length - 1];

    if (e.shiftKey) {
      if (document.activeElement === first) {
        e.preventDefault();
        last.focus();
      }
    } else if (document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  };

  return { panelRef, handlePanelKeyDown };
}
