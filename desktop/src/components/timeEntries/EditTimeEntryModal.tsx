import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useUpdateTimeEntry } from '../../hooks';
import {
  isValidTime,
  isValidTimeRange,
  getTimeRangeError,
  calculateHours,
} from '../../utils';
import type { TimeEntry } from '../../types';

interface EditTimeEntryModalProps {
  isOpen: boolean;
  onClose: () => void;
  entry: TimeEntry;
}

export function EditTimeEntryModal({ isOpen, onClose, entry }: EditTimeEntryModalProps) {
  const updateEntry = useUpdateTimeEntry();

  // Form state - Initialize with entry data
  const [date, setDate] = useState(entry.date);
  const [startTime, setStartTime] = useState(entry.startTime);
  const [endTime, setEndTime] = useState(entry.endTime);
  const [breakMinutes, setBreakMinutes] = useState(String(entry.breakMinutes || 0));
  const [location, setLocation] = useState<'office' | 'homeoffice' | 'field'>(entry.location);
  const [description, setDescription] = useState(entry.notes || '');

  // Error state
  const [dateError, setDateError] = useState('');
  const [startTimeError, setStartTimeError] = useState('');
  const [endTimeError, setEndTimeError] = useState('');
  const [breakMinutesError, setBreakMinutesError] = useState('');

  // Update form when entry changes
  useEffect(() => {
    setDate(entry.date);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setBreakMinutes(String(entry.breakMinutes || 0));
    setLocation(entry.location);
    setDescription(entry.notes || '');
  }, [entry]);

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

    if (!validateForm()) {
      return;
    }

    try {
      await updateEntry.mutateAsync({
        id: entry.id,
        data: {
          date,
          startTime,
          endTime,
          breakMinutes: parseInt(breakMinutes) || 0,
          location,
          notes: description || null,
        },
      });

      // Close modal and reset form
      onClose();
    } catch (error) {
      console.error('Failed to update time entry:', error);
    }
  };

  const handleClose = () => {
    // Reset to original values
    setDate(entry.date);
    setStartTime(entry.startTime);
    setEndTime(entry.endTime);
    setBreakMinutes(String(entry.breakMinutes || 0));
    setLocation(entry.location);
    setDescription(entry.notes || '');

    // Reset errors
    setDateError('');
    setStartTimeError('');
    setEndTimeError('');
    setBreakMinutesError('');

    onClose();
  };

  // Calculate hours preview
  const hoursPreview = isValidTime(startTime) && isValidTime(endTime) && isValidTimeRange(startTime, endTime)
    ? calculateHours(startTime, endTime, parseInt(breakMinutes) || 0)
    : null;

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Zeiteintrag bearbeiten" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Date */}
        <Input
          label="Datum"
          type="date"
          value={date}
          onChange={(e) => setDate(e.target.value)}
          error={dateError}
          required
        />

        {/* Time Range */}
        <div className="grid grid-cols-2 gap-4">
          <Input
            label="Start"
            type="time"
            value={startTime}
            onChange={(e) => setStartTime(e.target.value)}
            error={startTimeError}
            required
          />
          <Input
            label="Ende"
            type="time"
            value={endTime}
            onChange={(e) => setEndTime(e.target.value)}
            error={endTimeError}
            required
          />
        </div>

        {/* Break */}
        <Input
          label="Pause (Minuten)"
          type="number"
          min="0"
          max="480"
          step="5"
          value={breakMinutes}
          onChange={(e) => setBreakMinutes(e.target.value)}
          error={breakMinutesError}
          helperText="Pflichtpause: > 6h = min. 30 Min, > 9h = min. 45 Min"
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
          label="Notiz (optional)"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={3}
          placeholder="z.B. Projektname, Aufgabenbeschreibung..."
        />

        {/* Hours Preview */}
        {hoursPreview !== null && (
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-900 dark:text-blue-100">
                Arbeitsstunden:
              </span>
              <span className="text-xl font-bold text-blue-600 dark:text-blue-400">
                {hoursPreview.toFixed(2)}h
              </span>
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={updateEntry.isPending}>
            {updateEntry.isPending ? (
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
