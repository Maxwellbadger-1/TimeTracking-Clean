/**
 * Delete Confirm Modal
 * Simple confirmation dialog for deleting pending absence requests
 */

import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertCircle } from 'lucide-react';

interface DeleteConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
  absenceInfo: {
    type: string;
    startDate: string;
    endDate: string;
  };
  isLoading?: boolean;
}

export function DeleteConfirmModal({
  isOpen,
  onClose,
  onConfirm,
  absenceInfo,
  isLoading = false,
}: DeleteConfirmModalProps) {
  const handleConfirm = () => {
    onConfirm();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Antrag löschen" size="md">
      {/* Warning Banner */}
      <div className="mb-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
        <div className="flex items-start">
          <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 mr-2 mt-0.5 flex-shrink-0" />
          <div className="text-sm text-red-800 dark:text-red-200">
            <p className="font-semibold mb-1">Antrag wirklich löschen?</p>
            <p>
              Diese Aktion kann nicht rückgängig gemacht werden.
            </p>
          </div>
        </div>
      </div>

      {/* Absence Details */}
      <div className="mb-6 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
          <strong>Art:</strong> {absenceInfo.type}
        </p>
        <p className="text-sm text-gray-600 dark:text-gray-400">
          <strong>Zeitraum:</strong> {absenceInfo.startDate} bis {absenceInfo.endDate}
        </p>
      </div>

      {/* Actions */}
      <div className="flex justify-end space-x-3">
        <Button
          type="button"
          variant="ghost"
          onClick={onClose}
          disabled={isLoading}
        >
          Abbrechen
        </Button>
        <Button
          type="button"
          variant="danger"
          onClick={handleConfirm}
          disabled={isLoading}
        >
          {isLoading ? 'Lösche...' : 'Antrag löschen'}
        </Button>
      </div>
    </Modal>
  );
}
