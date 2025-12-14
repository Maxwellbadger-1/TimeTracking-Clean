import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useUpdateUser } from '../../hooks';
import { isValidEmail, getTodayDate } from '../../utils';
import type { User } from '../../types';

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export function EditUserModal({ isOpen, onClose, user }: EditUserModalProps) {
  const updateUser = useUpdateUser();

  // Form state - Initialize with user data
  const [email, setEmail] = useState(user.email);
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [role, setRole] = useState<'admin' | 'employee'>(user.role);
  const [weeklyHours, setWeeklyHours] = useState(String(user.weeklyHours || 40));
  const [vacationDays, setVacationDays] = useState(String(user.vacationDaysPerYear || 30));
  const [department, setDepartment] = useState(user.department || '');
  const [position, setPosition] = useState(user.position || '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [hireDate, setHireDate] = useState(user.hireDate || getTodayDate());
  const [endDate, setEndDate] = useState(user.endDate || '');

  // Error state
  const [emailError, setEmailError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');

  // Update form when user changes
  useEffect(() => {
    setEmail(user.email);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
    setWeeklyHours(String(user.weeklyHours || 40));
    setVacationDays(String(user.vacationDaysPerYear || 30));
    setDepartment(user.department || '');
    setPosition(user.position || '');
    setIsActive(user.isActive);
    setHireDate(user.hireDate || getTodayDate());
    setEndDate(user.endDate || '');
  }, [user]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setEmailError('');
    setFirstNameError('');
    setLastNameError('');

    // Validate email
    if (!email.trim()) {
      setEmailError('E-Mail ist erforderlich');
      isValid = false;
    } else if (!isValidEmail(email)) {
      setEmailError('Ungültige E-Mail-Adresse');
      isValid = false;
    }

    // Validate first name
    if (!firstName.trim()) {
      setFirstNameError('Vorname ist erforderlich');
      isValid = false;
    }

    // Validate last name
    if (!lastName.trim()) {
      setLastNameError('Nachname ist erforderlich');
      isValid = false;
    }

    // No validation for hireDate - future dates are allowed for pre-creating employee accounts
    // This is standard practice in HR systems for onboarding workflows

    // Validate endDate: must be after hireDate
    if (endDate && hireDate) {
      if (endDate < hireDate) {
        alert('Austrittsdatum muss nach dem Eintrittsdatum liegen');
        isValid = false;
      }
    }

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    console.log('🔥🔥🔥 EDIT USER - FRONTEND DEBUG 🔥🔥🔥');
    console.log('User ID:', user.id);
    console.log('hireDate state:', hireDate);
    console.log('endDate state:', endDate);

    const updateData = {
      email: email.trim(),
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      weeklyHours: parseInt(weeklyHours) || 40,
      vacationDaysPerYear: parseInt(vacationDays) || 30,
      department: department.trim() || undefined,
      position: position.trim() || undefined,
      isActive,
      hireDate,
      endDate: endDate || undefined,
    };

    console.log('📦 Update Data being sent:', updateData);

    try {
      await updateUser.mutateAsync({
        id: user.id,
        data: updateData,
      });

      // Close modal
      onClose();
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleClose = () => {
    // Reset to original values
    setEmail(user.email);
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
    setWeeklyHours(String(user.weeklyHours || 40));
    setVacationDays(String(user.vacationDaysPerYear || 30));
    setDepartment(user.department || '');
    setPosition(user.position || '');
    setHireDate(user.hireDate || getTodayDate());
    setEndDate(user.endDate || '');
    setIsActive(user.isActive);

    // Reset errors
    setEmailError('');
    setFirstNameError('');
    setLastNameError('');

    onClose();
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={`Benutzer bearbeiten: ${user.firstName} ${user.lastName}`}
      size="lg"
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Info */}
        <div className="space-y-4">
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-3">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              <strong>Benutzername:</strong> @{user.username}
            </p>
            <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
              Der Benutzername kann nicht geändert werden
            </p>
          </div>

          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            required
          />
        </div>

        {/* Personal Info */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Persönliche Informationen
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Vorname"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={firstNameError}
              required
            />
            <Input
              label="Nachname"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              error={lastNameError}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Abteilung (optional)"
              value={department}
              onChange={(e) => setDepartment(e.target.value)}
              placeholder="z.B. Verwaltung, IT, etc."
            />
            <Input
              label="Position (optional)"
              value={position}
              onChange={(e) => setPosition(e.target.value)}
              placeholder="z.B. Sachbearbeiter, etc."
            />
          </div>
        </div>

        {/* Work Settings */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Arbeitszeit & Berechtigungen
          </h3>

          <div className="grid grid-cols-3 gap-4">
            <Select
              label="Rolle"
              value={role}
              onChange={(e) => setRole(e.target.value as typeof role)}
              options={[
                { value: 'employee', label: 'Mitarbeiter' },
                { value: 'admin', label: 'Administrator' },
              ]}
              required
            />
            <Input
              label="Wochenstunden"
              type="number"
              min="1"
              max="60"
              step="0.5"
              value={weeklyHours}
              onChange={(e) => setWeeklyHours(e.target.value)}
              required
            />
            <Input
              label="Urlaubstage/Jahr"
              type="number"
              min="0"
              max="50"
              value={vacationDays}
              onChange={(e) => setVacationDays(e.target.value)}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Eintrittsdatum"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              required
              helperText="Ab diesem Datum werden Arbeitsstunden erfasst (zukünftige Daten erlaubt)"
            />
            <Input
              label="Austrittsdatum (optional)"
              type="date"
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
              helperText="Leer lassen, wenn Mitarbeiter aktiv ist"
            />
          </div>

          <div className="flex items-center space-x-3 p-4 bg-gray-50 dark:bg-gray-800 rounded-lg">
            <input
              type="checkbox"
              id="isActive"
              checked={isActive}
              onChange={(e) => setIsActive(e.target.checked)}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label
              htmlFor="isActive"
              className="text-sm font-medium text-gray-900 dark:text-gray-100"
            >
              Benutzer ist aktiv
            </label>
            <p className="text-xs text-gray-600 dark:text-gray-400 ml-auto">
              Inaktive Benutzer können sich nicht einloggen
            </p>
          </div>
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={updateUser.isPending}>
            {updateUser.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Speichern...
              </>
            ) : (
              'Änderungen speichern'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
