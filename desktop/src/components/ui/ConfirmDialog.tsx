/**
 * Confirmation Dialog Component
 *
 * Replaces window.confirm() which doesn't work in Tauri
 */

import { useId } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
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
}: ConfirmDialogProps) {
  // Alle Hooks stehen oberhalb der fruehen Rueckgabe (`if (!isOpen) return null;`
  // weiter unten) — sonst verletzt die Komponente die Rules of Hooks.
  // WR-15/CR-02: Stack-Teilnahme, ESC = Abbrechen, Anfangsfokus, Fokusrueckgabe und
  // Tab-Ring liegen in `useModalLayer` — dieselbe Fassung wie in `Modal`.
  const { panelRef, handlePanelKeyDown } = useModalLayer(isOpen, onClose, 'confirm');
  const titleId = useId();

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const iconColors = {
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary';

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
                  aria-label="Abbrechen"
                  className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </CardHeader>

            <CardContent>
              <p className="text-gray-700 dark:text-gray-300">{message}</p>
            </CardContent>

            <CardFooter className="flex justify-end space-x-3">
              <Button type="button" variant="ghost" onClick={handleCancel}>
                {cancelText}
              </Button>
              <Button type="button" variant={confirmButtonVariant} onClick={handleConfirm}>
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
