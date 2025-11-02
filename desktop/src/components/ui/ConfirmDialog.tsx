/**
 * Confirmation Dialog Component
 *
 * Replaces window.confirm() which doesn't work in Tauri
 */

import { AlertTriangle, X } from 'lucide-react';
import { Button } from './Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from './Card';

interface ConfirmDialogProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  variant?: 'danger' | 'warning' | 'info';
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
}: ConfirmDialogProps) {
  if (!isOpen) return null;

  const handleConfirm = () => {
    console.log('✅ ConfirmDialog: User clicked CONFIRM');
    onConfirm();
    onClose();
  };

  const handleCancel = () => {
    console.log('🚫 ConfirmDialog: User clicked CANCEL');
    onClose();
  };

  const iconColors = {
    danger: 'text-red-600 dark:text-red-400',
    warning: 'text-yellow-600 dark:text-yellow-400',
    info: 'text-blue-600 dark:text-blue-400',
  };

  const confirmButtonVariant = variant === 'danger' ? 'danger' : 'primary';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm">
      <Card className="max-w-md w-full mx-4">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div className="flex items-center space-x-3">
              <div className={`p-2 rounded-lg bg-opacity-10 ${iconColors[variant]}`}>
                <AlertTriangle className={`w-6 h-6 ${iconColors[variant]}`} />
              </div>
              <CardTitle>{title}</CardTitle>
            </div>
            <button
              onClick={handleCancel}
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
          <Button variant="ghost" onClick={handleCancel}>
            {cancelText}
          </Button>
          <Button variant={confirmButtonVariant} onClick={handleConfirm}>
            {confirmText}
          </Button>
        </CardFooter>
      </Card>
    </div>
  );
}
