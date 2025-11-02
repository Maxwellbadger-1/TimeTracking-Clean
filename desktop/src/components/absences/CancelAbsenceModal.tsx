/**
 * Cancel Absence Modal
 * Professional modal dialog for cancelling approved absences
 */

import { useState } from 'react';
import { Modal } from '../ui/Modal';
import { Button } from '../ui/Button';
import { AlertCircle } from 'lucide-react';

interface CancelAbsenceModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  absenceInfo: {
    userName: string;
    type: string;
    startDate: string;
    endDate: string;
  };
  isLoading?: boolean;
}

export function CancelAbsenceModal({
  isOpen,
  onClose,
  onConfirm,
  absenceInfo,
  isLoading = false,
}: CancelAbsenceModalProps) {
  const [reason, setReason] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!reason.trim()) {
      return;
    }

    onConfirm(reason);
    setReason(''); // Reset form
  };

  const handleClose = () => {
    setReason(''); // Reset form on close
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Urlaub stornieren" size="md">
      <form onSubmit={handleSubmit}>
        {/* Warning Banner */}
        <div className="mb-4 p-3 bg-orange-50 dark:bg-orange-900/20 border border-orange-200 dark:border-orange-800 rounded-lg">
          <div className="flex items-start">
            <AlertCircle className="w-5 h-5 text-orange-600 dark:text-orange-400 mr-2 mt-0.5 flex-shrink-0" />
            <div className="text-sm text-orange-800 dark:text-orange-200">
              <p className="font-semibold mb-1">Achtung: Genehmigten Urlaub stornieren</p>
              <p>
                Der Mitarbeiter <strong>{absenceInfo.userName}</strong> wird über die
                Stornierung benachrichtigt.
              </p>
            </div>
          </div>
        </div>

        {/* Absence Details */}
        <div className="mb-4 p-3 bg-gray-50 dark:bg-gray-900/50 rounded-lg">
          <p className="text-sm text-gray-600 dark:text-gray-400 mb-1">
            <strong>Art:</strong> {absenceInfo.type}
          </p>
          <p className="text-sm text-gray-600 dark:text-gray-400">
            <strong>Zeitraum:</strong> {absenceInfo.startDate} bis {absenceInfo.endDate}
          </p>
        </div>

        {/* Reason Input */}
        <div className="mb-6">
          <label
            htmlFor="cancelReason"
            className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-2"
          >
            Grund für Stornierung <span className="text-red-500">*</span>
          </label>
          <textarea
            id="cancelReason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 dark:border-gray-600 rounded-lg
                     bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100
                     focus:ring-2 focus:ring-blue-500 focus:border-transparent
                     disabled:opacity-50 disabled:cursor-not-allowed"
            rows={4}
            placeholder="Bitte geben Sie den Grund für die Stornierung ein..."
            required
            disabled={isLoading}
            autoFocus
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Dieser Grund wird dem Mitarbeiter in der Benachrichtigung angezeigt.
          </p>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3">
          <Button
            type="button"
            variant="ghost"
            onClick={handleClose}
            disabled={isLoading}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="danger"
            disabled={!reason.trim() || isLoading}
          >
            {isLoading ? 'Storniere...' : 'Urlaub stornieren'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
