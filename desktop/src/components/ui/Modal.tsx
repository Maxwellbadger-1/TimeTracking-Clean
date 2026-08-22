import { ReactNode, useEffect, useId, useRef } from 'react';
import type { KeyboardEvent as ReactKeyboardEvent } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import * as modalStack from './modalStack';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  zIndexClass?: string;
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  zIndexClass = 'z-50',
}: ModalProps) {
  const idRef = useRef(Symbol('modal'));
  const onCloseRef = useRef(onClose);
  const panelRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<Element | null>(null);
  const titleId = useId();

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

  // Fokusrueckgabe: merkt sich beim Oeffnen das zuvor fokussierte Element und
  // gibt den Fokus beim Schliessen dorthin zurueck, sofern es noch im
  // Dokument haengt.
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

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
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

  return createPortal(
    <div className={`fixed inset-0 ${zIndexClass} overflow-y-auto`}>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 transition-opacity"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal */}
      <div className="flex min-h-full items-center justify-center p-4">
        <div
          ref={panelRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onKeyDown={handlePanelKeyDown}
          className={`
            relative w-full ${sizeClasses[size]}
            bg-white dark:bg-gray-800
            rounded-lg shadow-xl
            transition-all
          `}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-gray-200 dark:border-gray-700">
            <h2 id={titleId} className="text-xl font-semibold text-gray-900 dark:text-gray-100">
              {title}
            </h2>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="!p-1"
              aria-label="Dialog schließen"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* Content */}
          <div className="p-6">
            {children}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
