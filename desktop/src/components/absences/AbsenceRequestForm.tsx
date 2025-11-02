import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateAbsenceRequest, useRemainingVacationDays, useTotalOvertime } from '../../hooks';
import { useAuthStore } from '../../store/authStore';
import {
  getTodayDate,
  isValidDate,
  isValidDateRange,
  getDateRangeError,
  calculateExpectedHours,
} from '../../utils';

interface AbsenceRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AbsenceRequestForm({ isOpen, onClose }: AbsenceRequestFormProps) {
  const { user } = useAuthStore();
  const createRequest = useCreateAbsenceRequest();
  const { remaining: vacationDays, isLoading: loadingVacation } = useRemainingVacationDays(user?.id || 0);
  const { totalHours: overtimeHours, isLoading: loadingOvertime } = useTotalOvertime(user?.id || 0);

  console.log('🔥🔥🔥 AbsenceRequestForm RENDERED! 🔥🔥🔥');
  console.log('📌 User ID:', user?.id);
  console.log('📊 Vacation Days:', vacationDays, 'Loading:', loadingVacation);
  console.log('📊 Overtime Hours:', overtimeHours, 'Loading:', loadingOvertime);

  // Form state
  const [type, setType] = useState<'vacation' | 'sick' | 'unpaid' | 'overtime_comp'>('vacation');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [reason, setReason] = useState('');

  // Error state
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Calculate required days (simple business days calculation without holidays)
  const [requiredDays, setRequiredDays] = useState(1);

  useEffect(() => {
    if (isValidDate(startDate) && isValidDate(endDate) && isValidDateRange(startDate, endDate)) {
      // Simple calculation: divide expected hours by 8
      const expectedHours = calculateExpectedHours(startDate, endDate, 8);
      const days = Math.ceil(expectedHours / 8);
      setRequiredDays(days);
    } else {
      setRequiredDays(1);
    }
  }, [startDate, endDate]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setStartDateError('');
    setEndDateError('');
    setReasonError('');

    // Validate dates
    if (!isValidDate(startDate)) {
      setStartDateError('Ungültiges Datum');
      isValid = false;
    }

    if (!isValidDate(endDate)) {
      setEndDateError('Ungültiges Datum');
      isValid = false;
    }

    if (isValidDate(startDate) && isValidDate(endDate)) {
      const dateRangeError = getDateRangeError(startDate, endDate);
      if (dateRangeError) {
        setEndDateError(dateRangeError);
        isValid = false;
      }
    }

    // Validate vacation balance
    if (type === 'vacation' && requiredDays > vacationDays) {
      setEndDateError(`Du hast nur noch ${vacationDays} Urlaubstage verfügbar`);
      isValid = false;
    }

    // Validate overtime compensation
    if (type === 'overtime_comp') {
      const requiredHours = requiredDays * 8;
      if (requiredHours > overtimeHours) {
        setEndDateError(`Du hast nur ${overtimeHours.toFixed(2)}h Überstunden verfügbar`);
        isValid = false;
      }
    }

    // Validate reason for sick leave (optional but recommended)
    if (type === 'sick' && !reason.trim()) {
      // Just a warning, not blocking
      console.log('Note: Reason for sick leave is recommended');
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!user) return;

    if (!validateForm()) {
      return;
    }

    try {
      await createRequest.mutateAsync({
        userId: user.id,
        type,
        startDate,
        endDate,
        reason: reason.trim() || undefined,
      });

      // Reset form and close
      handleClose();
    } catch (error) {
      // Error is handled by the hook (toast)
      console.error('Failed to create absence request:', error);
    }
  };

  const handleClose = () => {
    // Reset form
    setType('vacation');
    setStartDate(getTodayDate());
    setEndDate(getTodayDate());
    setReason('');
    setStartDateError('');
    setEndDateError('');
    setReasonError('');
    onClose();
  };

  const getTypeLabel = () => {
    switch (type) {
      case 'vacation':
        return 'Urlaub';
      case 'sick':
        return 'Krankmeldung';
      case 'unpaid':
        return 'Unbezahlter Urlaub';
      case 'overtime_comp':
        return 'Überstundenausgleich';
    }
  };

  const getBalanceInfo = () => {
    if (type === 'vacation') {
      return (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <p className="text-sm text-purple-900 dark:text-purple-200">
            <strong>Verfügbar:</strong> {loadingVacation ? '...' : `${vacationDays} Urlaubstage`}
          </p>
        </div>
      );
    }

    if (type === 'overtime_comp') {
      return (
        <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
          <p className="text-sm text-orange-900 dark:text-orange-200">
            <strong>Verfügbar:</strong> {loadingOvertime ? '...' : `${overtimeHours.toFixed(2)}h Überstunden`}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Abwesenheit beantragen" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Type */}
        <Select
          label="Art der Abwesenheit"
          value={type}
          onChange={(e) => setType(e.target.value as typeof type)}
          options={[
            { value: 'vacation', label: 'Urlaub' },
            { value: 'sick', label: 'Krankmeldung' },
            { value: 'overtime_comp', label: 'Überstundenausgleich' },
            { value: 'unpaid', label: 'Unbezahlter Urlaub' },
          ]}
          required
        />

        {/* Date Range */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="date"
            label="Von"
            value={startDate}
            onChange={(e) => setStartDate(e.target.value)}
            error={startDateError}
            required
          />
          <Input
            type="date"
            label="Bis"
            value={endDate}
            onChange={(e) => setEndDate(e.target.value)}
            error={endDateError}
            required
          />
        </div>

        {/* Required Days Preview */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Erforderlich:</strong> {requiredDays} {requiredDays === 1 ? 'Tag' : 'Tage'}
            {type === 'overtime_comp' && ` (${requiredDays * 8}h)`}
          </p>
        </div>

        {/* Balance Info */}
        {getBalanceInfo()}

        {/* Reason */}
        <Textarea
          label={type === 'sick' ? 'Grund (empfohlen)' : 'Grund'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          error={reasonError}
          rows={3}
          placeholder={
            type === 'sick'
              ? 'z.B. Erkältung, Grippe, ...'
              : 'Optional: Begründung für den Antrag'
          }
          required={type === 'sick'}
        />

        {/* Auto-Approval Note for Sick Leave */}
        {type === 'sick' && (
          <div className="p-3 bg-green-50 dark:bg-green-900/20 rounded-lg">
            <p className="text-sm text-green-900 dark:text-green-200">
              ℹ️ Krankmeldungen werden automatisch genehmigt
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createRequest.isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createRequest.isPending}
          >
            {createRequest.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Beantragen...
              </>
            ) : (
              `${getTypeLabel()} beantragen`
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
