import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateOvertimeCorrection } from '../../hooks/useOvertimeCorrections';
import { AlertCircle } from 'lucide-react';

interface OvertimeCorrectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId?: number;
  userName?: string;
}

export function OvertimeCorrectionModal({
  isOpen,
  onClose,
  userId,
  userName,
}: OvertimeCorrectionModalProps) {
  const createCorrection = useCreateOvertimeCorrection();

  // Form state
  const [hours, setHours] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [reason, setReason] = useState('');
  const [correctionType, setCorrectionType] = useState<'system_error' | 'absence_credit' | 'migration' | 'manual'>('manual');

  // Error state
  const [hoursError, setHoursError] = useState('');
  const [dateError, setDateError] = useState('');
  const [reasonError, setReasonError] = useState('');
  const [formError, setFormError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setHoursError('');
    setDateError('');
    setReasonError('');
    setFormError('');

    // Validate hours
    const hoursNum = parseFloat(hours);
    if (!hours || isNaN(hoursNum)) {
      setHoursError('Stunden sind erforderlich');
      isValid = false;
    } else if (hoursNum === 0) {
      setHoursError('Korrektur kann nicht 0 Stunden sein');
      isValid = false;
    } else if (Math.abs(hoursNum) > 200) {
      setHoursError('Korrektur muss zwischen -200 und +200 Stunden liegen');
      isValid = false;
    }

    // Validate date
    if (!date) {
      setDateError('Datum ist erforderlich');
      isValid = false;
    }

    // Validate reason (min 10 characters)
    if (!reason.trim()) {
      setReasonError('Begründung ist erforderlich');
      isValid = false;
    } else if (reason.trim().length < 10) {
      setReasonError('Begründung muss mindestens 10 Zeichen lang sein');
      isValid = false;
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    if (!userId) {
      setFormError('Kein Benutzer ausgewählt');
      return;
    }

    try {
      await createCorrection.mutateAsync({
        userId,
        hours: parseFloat(hours),
        date,
        reason: reason.trim(),
        correctionType,
      });

      // Reset form and close
      setHours('');
      setDate(new Date().toISOString().split('T')[0]);
      setReason('');
      setCorrectionType('manual');
      onClose();
    } catch (error) {
      console.error('Failed to create overtime correction:', error);
      setFormError(error instanceof Error ? error.message : 'Fehler beim Erstellen der Korrektur');
    }
  };

  const handleClose = () => {
    // Reset form
    setHours('');
    setDate(new Date().toISOString().split('T')[0]);
    setReason('');
    setCorrectionType('manual');

    // Reset errors
    setHoursError('');
    setDateError('');
    setReasonError('');
    setFormError('');

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Überstunden-Korrektur" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* User Info */}
        {userName && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <p className="text-sm text-blue-900 dark:text-blue-100">
              <span className="font-semibold">Mitarbeiter:</span> {userName}
            </p>
          </div>
        )}

        {/* Form Error */}
        {formError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 dark:text-red-100">{formError}</p>
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Hours */}
          <div>
            <Input
              label="Stunden"
              type="number"
              step="0.5"
              value={hours}
              onChange={(e) => setHours(e.target.value)}
              error={hoursError}
              placeholder="z.B. 8 oder -4"
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Positiv (+) für Gutschrift, Negativ (-) für Abzug
            </p>
          </div>

          {/* Date */}
          <div>
            <Input
              label="Datum"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              error={dateError}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Datum der Korrektur
            </p>
          </div>
        </div>

        {/* Correction Type */}
        <div>
          <Select
            label="Korrekturtyp"
            value={correctionType}
            onChange={(e) => setCorrectionType(e.target.value as typeof correctionType)}
            options={[
              { value: 'manual', label: 'Manuelle Korrektur' },
              { value: 'system_error', label: 'Systemfehler' },
              { value: 'absence_credit', label: 'Abwesenheits-Gutschrift' },
              { value: 'migration', label: 'Daten-Migration' },
            ]}
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            Wählen Sie den Grund für die Korrektur
          </p>
        </div>

        {/* Reason */}
        <div>
          <Textarea
            label="Begründung"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            error={reasonError}
            placeholder="Detaillierte Begründung für die Korrektur (mindestens 10 Zeichen)..."
            rows={4}
            required
          />
          <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
            {reason.length}/10 Zeichen (Minimum)
          </p>
        </div>

        {/* Warning Box */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-yellow-600 dark:text-yellow-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-yellow-900 dark:text-yellow-100">
              <p className="font-semibold mb-1">Wichtig:</p>
              <ul className="list-disc list-inside space-y-1">
                <li>Diese Korrektur wird sofort wirksam</li>
                <li>Der Mitarbeiter erhält eine Benachrichtigung</li>
                <li>Die Änderung wird im Audit-Log protokolliert</li>
                <li>Korrekturen können nur von Admins gelöscht werden</li>
              </ul>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button
            type="submit"
            disabled={createCorrection.isPending}
            className="min-w-[120px]"
          >
            {createCorrection.isPending ? (
              <LoadingSpinner size="sm" />
            ) : (
              'Korrektur erstellen'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
