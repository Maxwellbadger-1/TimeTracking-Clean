/**
 * Confirmation Dialog Component
 *
 * Replaces window.confirm() which doesn't work in Tauri
 */

import { useId, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
import { LoadingSpinner } from './LoadingSpinner';
import { useModalLayer } from './useModalLayer';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
  zIndexClass?: string;
  /** Phase 13 (13-UI-SPEC.md, „Änderungen an Bestandskomponenten"): zusaetzlicher Inhalt
   *  unter `message`, gerendert in einem grauen Panel. Ungesetzt = kein Panel, bestehende
   *  Aufrufer sehen keinen Unterschied. */
  details?: ReactNode;
  /** Sperrt ausschliesslich den Bestaetigungsknopf. */
  confirmDisabled?: boolean;
  /** Sperrt den Bestaetigungsknopf zusaetzlich und zeigt einen Spinner davor (Zustand 21 der
   *  13-UI-SPEC — "Loeschen laeuft"). */
  confirmLoading?: boolean;
  /** Sperrt "Abbrechen", den X-Knopf UND (ueber `useModalLayer`) ESC. Es wird KEIN
   *  Backdrop-Handler ergaenzt (DD-29 — das Overlay hat heute keinen Klick-Handler). */
  cancelDisabled?: boolean;
  /** Default `true`: `handleConfirm` ruft `onConfirm()` und danach `onClose()`. Bei `false`
   *  bleibt der Dialog offen (Zustaende 21/22 — der Aufrufer schliesst selbst, sobald der
   *  Vorgang abgeschlossen ist). */
  closeOnConfirm?: boolean;
  /** Phase 13 (13-UI-SPEC.md, Abschnitt "Barrierefreiheit"): ueberschreibt den `aria-label` des
   *  Bestaetigungsknopfes, z. B. "Periode vom 01.03.2026 löschen und stornieren" — konkreter als
   *  der sichtbare `confirmText`. Ungesetzt = keine Ueberschreibung, der Knopf traegt seinen
   *  bisherigen zugaenglichen Namen aus `confirmText` (Rueckwaertskompatibilitaet). */
  confirmAriaLabel?: string;
}

/**
 * Reine Ableitungsregel, ob der Bestaetigungsknopf gesperrt ist — kein Renderer noetig,
 * deshalb exportiert und maschinell geprueft (confirmDialogProps.check.ts, Plan 13-07 Task 3).
 */
export function isConfirmButtonDisabled(
  confirmDisabled: boolean | undefined,
  confirmLoading: boolean | undefined
): boolean {
  return Boolean(confirmDisabled) || Boolean(confirmLoading);
}

/**
 * Reine Ableitungsregel, ob `handleConfirm` nach `onConfirm()` auch `onClose()` ruft.
 * Default `true` (Rueckwaertskompatibilitaet: bestehende Aufrufer setzen `closeOnConfirm`
 * nicht und schliessen wie bisher).
 */
export function shouldCloseAfterConfirm(closeOnConfirm: boolean | undefined): boolean {
  return closeOnConfirm ?? true;
}

export function ConfirmDialog({
  isOpen,
  onClose,
  onConfirm,
  title,
  message,
  confirmText = 'Bestätigen',
  cancelText = 'Abbrechen',
  variant = 'danger',
  zIndexClass = 'z-50',
  details,
  confirmDisabled,
  confirmLoading,
  cancelDisabled,
  closeOnConfirm,
  confirmAriaLabel,
}: ConfirmDialogProps) {
  // Alle Hooks stehen oberhalb der fruehen Rueckgabe (`if (!isOpen) return null;`
  // weiter unten) — sonst verletzt die Komponente die Rules of Hooks.
  // WR-15/CR-02: Stack-Teilnahme, ESC = Abbrechen, Anfangsfokus, Fokusrueckgabe und
  // Tab-Ring liegen in `useModalLayer` — dieselbe Fassung wie in `Modal`.
  // DD-28/DD-29 (Phase 13): `cancelDisabled` sperrt zusaetzlich den ESC-Pfad der gemeinsamen
  // Modal-Infrastruktur. Kein Backdrop-Handler ergaenzt — das Overlay hatte nie einen.
  const { panelRef, handlePanelKeyDown } = useModalLayer(isOpen, onClose, 'confirm', {
    escDisabled: cancelDisabled,
  });
  const titleId = useId();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    if (shouldCloseAfterConfirm(closeOnConfirm)) {
      onClose();
    }
  };

  const handleCancel = () => {
    if (cancelDisabled) return;
    onClose();
  };

  const iconColors = {
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-amber-600 dark:text-amber-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary';
  const confirmDisabledResolved = isConfirmButtonDisabled(confirmDisabled, confirmLoading);

  // UI-Review Phase 12 (BLOCKER E-1): Das Overlay war `fixed inset-0 flex items-center
  // justify-center` OHNE `overflow-y-auto`. Ist das Tauri-Fenster niedriger als die Karte,
  // ragte der `CardFooter` — und damit "Ja, rückwirkend umstellen" — aus dem Ansichtsbereich,
  // ohne jede Scrollmoeglichkeit; der rueckwirkende Speicherpfad (REQ-26) endete in einer
  // Sackgasse. Geloest wie in `Modal.tsx`: das aeussere `fixed inset-0` scrollt, die
  // Zentrierung uebernimmt ein inneres `flex min-h-full items-center justify-center p-4`.
  // Das `p-4` ersetzt das bisherige `mx-4` am Panel (sonst 32 px Seitenabstand).
  return createPortal(
    <div className={`fixed inset-0 ${zIndexClass} overflow-y-auto bg-black/50 backdrop-blur-sm`}>
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={handlePanelKeyDown}
          className="max-w-md w-full"
        >
          <Card>
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-3">
                  <div className={`p-2 rounded-lg bg-opacity-10 ${iconColors[variant]}`}>
                    <AlertTriangle className={`w-6 h-6 ${iconColors[variant]}`} />
                  </div>
                  <CardTitle id={titleId}>{title}</CardTitle>
                </div>
                <button
                  type="button"
                  onClick={handleCancel}
                  disabled={cancelDisabled}
                  aria-label="Abbrechen"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-gray-700 dark:text-gray-300">{message}</p>
              {details !== undefined && (
                <div className="mt-4 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                  {details}
                </div>
              )}
            </CardContent>

            <CardFooter className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={handleCancel} disabled={cancelDisabled}>
                {cancelText}
              </Button>
              <Button
                type="button"
                variant={confirmButtonVariant}
                onClick={handleConfirm}
                disabled={confirmDisabledResolved}
                aria-label={confirmAriaLabel}
              >
                {confirmLoading && <LoadingSpinner size="sm" className="mr-2" />}
                {confirmText}
              </Button>
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>,
    document.body
  );
}
