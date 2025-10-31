import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateTimeEntry } from '../../hooks';
import { useAuthStore } from '../../store/authStore';
import {
  getTodayDate,
  isValidTime,
  isValidTimeRange,
  getTimeRangeError,
  calculateHours,
} from '../../utils';

interface TimeEntryFormProps {
  isOpen: boolean;
  onClose: () => void;
}

export function TimeEntryForm({ isOpen, onClose }: TimeEntryFormProps) {
  const { user } = useAuthStore();
  const createEntry = useCreateTimeEntry();

  // Form state
  const [date, setDate] = useState(getTodayDate());
  const [startTime, setStartTime] = useState('08:00');
  const [endTime, setEndTime] = useState('17:00');
  const [breakMinutes, setBreakMinutes] = useState('30');
  const [location, setLocation] = useState<'office' | 'homeoffice' | 'field'>('office');
  const [description, setDescription] = useState('');

  // Error state
  const [dateError, setDateError] = useState('');
  const [startTimeError, setStartTimeError] = useState('');
  const [endTimeError, setEndTimeError] = useState('');
  const [breakMinutesError, setBreakMinutesError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setDateError('');
    setStartTimeError('');
    setEndTimeError('');
    setBreakMinutesError('');

    // Validate date
    if (!date) {
      setDateError('Datum ist erforderlich');
      isValid = false;
    }

    // Validate times
    if (!isValidTime(startTime)) {
      setStartTimeError('Ungültige Zeit (Format: HH:MM)');
      isValid = false;
    }

    if (!isValidTime(endTime)) {
      setEndTimeError('Ungültige Zeit (Format: HH:MM)');
      isValid = false;
    }

    if (isValidTime(startTime) && isValidTime(endTime)) {
      const timeRangeError = getTimeRangeError(startTime, endTime);
      if (timeRangeError) {
        setEndTimeError(timeRangeError);
        isValid = false;
      }
    }

    // Validate break minutes
    const breakMins = parseInt(breakMinutes) || 0;
    if (breakMins < 0 || breakMins > 480) {
      setBreakMinutesError('Pause muss zwischen 0 und 480 Minuten liegen');
      isValid = false;
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
      await createEntry.mutateAsync({
        userId: user.id,
        date,
        startTime,
        endTime,
        breakMinutes: parseInt(breakMinutes) || 0,
        location,
        description: description.trim() || undefined,
      });

      // Reset form and close
      handleClose();
    } catch (error) {
      // Error is handled by the hook (toast)
      console.error('Failed to create time entry:', error);
    }
  };

  const handleClose = () => {
    // Reset form
    setDate(getTodayDate());
    setStartTime('08:00');
    setEndTime('17:00');
    setBreakMinutes('30');
    setLocation('office');
    setDescription('');
    setDateError('');
    setStartTimeError('');
    setEndTimeError('');
    setBreakMinutesError('');
    onClose();
  };

  // Calculate preview hours
  const previewHours = isValidTime(startTime) && isValidTime(endTime) && isValidTimeRange(startTime, endTime)
    ? calculateHours(startTime, endTime, parseInt(breakMinutes) || 0)
    : 0;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Zeit erfassen" size="md">
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Date */}
        <Input
          type="date"
          label="Datum"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={dateError}
          required
        />

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            type="time"
            label="Startzeit"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            error={startTimeError}
            required
          />
          <Input
            type="time"
            label="Endzeit"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            error={endTimeError}
            required
          />
        </div>

        {/* Break Minutes */}
        <Input
          type="number"
          label="Pause (Minuten)"
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(e.target.value)}
          error={breakMinutesError}
          min="0"
          max="480"
          step="15"
          helperText="Standard: 30 Minuten"
        />

        {/* Location */}
        <Select
          label="Arbeitsort"
          value={location}
          onChange={(e) => setLocation(e.target.value as 'office' | 'homeoffice' | 'field')}
          options={[
            { value: 'office', label: 'Büro' },
            { value: 'homeoffice', label: 'Home Office' },
            { value: 'field', label: 'Außendienst' },
          ]}
          required
        />

        {/* Description */}
        <Textarea
          label="Beschreibung"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="Optional: Was hast du heute gemacht?"
        />

        {/* Preview */}
        {previewHours > 0 && (
          <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
            <p className="text-sm text-blue-900 dark:text-blue-200">
              <strong>Arbeitszeit:</strong> {previewHours.toFixed(2)} Stunden
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={createEntry.isPending}
          >
            Abbrechen
          </Button>
          <Button
            type="submit"
            variant="primary"
            disabled={createEntry.isPending}
          >
            {createEntry.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Speichern...
              </>
            ) : (
              'Speichern'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
