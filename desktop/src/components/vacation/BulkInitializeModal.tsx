import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';

interface BulkInitializeModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (year: number) => Promise<void>;
  currentYear: number;
}

export function BulkInitializeModal({
  isOpen,
  onClose,
  onConfirm,
  currentYear,
}: BulkInitializeModalProps) {
  const [year, setYear] = useState(String(currentYear));
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [yearError, setYearError] = useState('');

  const validateForm = (): boolean => {
    setYearError('');

    const yearNum = parseInt(year);
    if (isNaN(yearNum) || yearNum < 2000 || yearNum > 2100) {
      setYearError('Ungültiges Jahr (2000-2100)');
      return false;
    }

    return true;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      setIsSubmitting(true);
      await onConfirm(parseInt(year));
      handleClose();
    } catch (error) {
      console.error('Bulk initialize failed:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    if (!isSubmitting) {
      setYear(String(currentYear));
      setYearError('');
      onClose();
    }
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title="Urlaubskonten massenhaft initialisieren"
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Info */}
        <div className="p-4 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-200 mb-2">
            ℹ️ Was macht diese Funktion?
          </h3>
          <ul className="text-sm text-blue-800 dark:text-blue-300 space-y-1">
            <li>
              • Initialisiert Urlaubskonten für <strong>alle Mitarbeiter</strong>
            </li>
            <li>
              • Verwendet <strong>vacationDaysPerYear</strong> aus Mitarbeiterprofil
            </li>
            <li>
              • Berechnet automatischen <strong>Übertrag</strong> aus Vorjahr (max. 5 Tage)
            </li>
            <li>
              • Überspringt bereits existierende Konten
            </li>
          </ul>
        </div>

        {/* Year Input */}
        <Input
          type="number"
          label="Jahr"
          value={year}
          onChange={(e) => setYear(e.target.value)}
          error={yearError}
          min="2000"
          max="2100"
          step="1"
          helperText="Für welches Jahr sollen die Konten initialisiert werden?"
          required
        />

        {/* Warning */}
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <p className="text-sm text-orange-900 dark:text-orange-200">
            ⚠️ Dieser Vorgang kann nicht rückgängig gemacht werden. Bitte
            prüfen Sie das Jahr sorgfältig.
          </p>
        </div>

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={isSubmitting}>
            {isSubmitting ? 'Initialisiere...' : 'Initialisieren'}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
