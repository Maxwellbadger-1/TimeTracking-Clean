import { ReactNode, useId } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button } from './Button';
import { useModalLayer } from './useModalLayer';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl';
  zIndexClass?: string;
}

export function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = 'md',
  zIndexClass = 'z-50',
}: ModalProps) {
  // WR-15/CR-02: Stack-Teilnahme, ESC, Anfangsfokus, Fokusrueckgabe und Tab-Ring liegen in
  // `useModalLayer` — eine Fassung fuer `Modal` und `ConfirmDialog`.
  const { panelRef, handlePanelKeyDown } = useModalLayer(isOpen, onClose, 'modal');
  const titleId = useId();

  if (!isOpen) return null;

  const sizeClasses = {
    sm: 'max-w-md',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
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
