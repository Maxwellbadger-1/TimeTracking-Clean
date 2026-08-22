/**
 * Confirmation Dialog Component
 *
 * Replaces window.confirm() which doesn't work in Tauri
 */

import { useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';
import * as modalStack from './modalStack';

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

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

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
  const idRef = useRef(Symbol('confirm'));
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const titleId = useId();

  onCloseRef.current = onClose;

  // Stack-Teilnahme + Scroll-Lock. Abhaengigkeit ausschliesslich [isOpen].
  useEffect(() => {
    if (!isOpen) return;

    modalStack.pushModal(idRef.current);

    return () => {
      modalStack.popModal(idRef.current);
    };
  }, [isOpen]);

  // ESC = Abbrechen, aber nur fuer die oberste Instanz.
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

  // Fokusrueckgabe an das zuvor fokussierte Element.
  useEffect(() => {
    if (!isOpen) return;

    previouslyFocusedRef.current = document.activeElement;

    return () => {
      const el = previouslyFocusedRef.current;
      if (el instanceof HTMLElement && document.body.contains(el)) {
        el.focus();
      }
    };
  }, [isOpen]);

  if (!isOpen) return null;

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    onClose();
  };

  const handlePanelKeyDown = (e: ReactKeyboardEvent<HTMLDivElement>) => {
    if (e.key !== 'Tab' || !modalStack.isTopModal(idRef.current)) return;

    const panel = panelRef.current;
    if (!panel) return;

    const focusable = Array.from(
      panel.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR)
    ).filter((el) => el.offsetParent !== null);
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

  const iconColors = {
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary';

  return createPortal(
    <div
      className={`fixed inset-0 ${zIndexClass} flex items-center justify-center bg-black/50 backdrop-blur-sm`}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        onKeyDown={handlePanelKeyDown}
        className="max-w-md w-full mx-4"
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
    </div>,
    document.body
  );
}
