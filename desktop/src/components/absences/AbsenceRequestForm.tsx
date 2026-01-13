import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateAbsenceRequest, useRemainingVacationDays, useCurrentOvertimeStats, useUsers } from '../../hooks';
import { useAuthStore } from '../../store/authStore';
import {
  getTodayDate,
  isValidDate,
  isValidDateRange,
  getDateRangeError,
  calculateAbsenceHoursWithWorkSchedule,
  countWorkingDaysForUser,
  formatOvertimeHours,
} from '../../utils';

interface AbsenceRequestFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function AbsenceRequestForm({ isOpen, onClose }: AbsenceRequestFormProps) {
  const { user } = useAuthStore();
  const isAdmin = user?.role === 'admin';
  const { data: users } = useUsers(isAdmin);
  const createRequest = useCreateAbsenceRequest();

  // Form state
  const [selectedUserId, setSelectedUserId] = useState<number>(user?.id || 0);
  const [type, setType] = useState<'vacation' | 'sick' | 'unpaid' | 'overtime_comp'>('vacation');
  const [startDate, setStartDate] = useState(getTodayDate());
  const [endDate, setEndDate] = useState(getTodayDate());
  const [reason, setReason] = useState('');

  // Fetch balances for selected user (not current user if admin)
  const { remaining: vacationDays, isLoading: loadingVacation } = useRemainingVacationDays(selectedUserId);
  const { data: overtimeStats, isLoading: loadingOvertime } = useCurrentOvertimeStats(selectedUserId);

  // Get total yearly overtime hours
  const overtimeHours = overtimeStats?.totalYear || 0;

  // Error state
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Calculate required days & hours based on user's work schedule
  const [requiredDays, setRequiredDays] = useState(1);
  const [requiredHours, setRequiredHours] = useState(8);

  // Get selected user's data for work schedule
  const selectedUser = users?.find(u => u.id === selectedUserId);

  useEffect(() => {
    if (isValidDate(startDate) && isValidDate(endDate) && isValidDateRange(startDate, endDate) && selectedUser) {
      // Calculate hours based on individual work schedule
      const hours = calculateAbsenceHoursWithWorkSchedule(
        startDate,
        endDate,
        selectedUser.workSchedule,
        selectedUser.weeklyHours
      );
      setRequiredHours(hours);

      // Calculate days - BEST PRACTICE (Personio, DATEV, SAP):
      // Days with 0 hours do NOT count as working days!
      const days = countWorkingDaysForUser(
        startDate,
        endDate,
        selectedUser.workSchedule,
        selectedUser.weeklyHours
      );
      setRequiredDays(days);
    } else {
      setRequiredDays(1);
      setRequiredHours(8);
    }
  }, [startDate, endDate, selectedUser]);

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
      if (requiredHours > overtimeHours) {
        setEndDateError(`Du hast nur ${formatOvertimeHours(overtimeHours)} Überstunden verfügbar`);
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
        userId: selectedUserId, // Use selected user (admin can create for others)
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
    setSelectedUserId(user?.id || 0);
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
            <strong>Verfügbar:</strong> {loadingOvertime ? '...' : `${formatOvertimeHours(overtimeHours)} Überstunden`}
          </p>
        </div>
      );
    }

    return null;
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Abwesenheit beantragen" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* User Picker (Admin only) - Only ACTIVE users */}
        {user?.role === 'admin' && (
          <Select
            label="Mitarbeiter"
            value={String(selectedUserId)}
            onChange={(e) => setSelectedUserId(Number(e.target.value))}
            options={
              users
                ?.filter((u) => u.isActive !== false && !u.deletedAt) // Only active, not archived
                ?.map((u) => ({
                  value: String(u.id),
                  label: `${u.firstName} ${u.lastName}`,
                })) || []
            }
            required
          />
        )}

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

        {/* Required Days & Hours Preview */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Erforderlich:</strong> {requiredDays} {requiredDays === 1 ? 'Tag' : 'Tage'}
            {type === 'overtime_comp' && ` (${requiredHours}h)`}
          </p>
          {selectedUser?.workSchedule && (
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              ⚠️ Tage mit 0h zählen nicht als Arbeitstage (Best Practice: Personio, DATEV, SAP)
            </p>
          )}
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
