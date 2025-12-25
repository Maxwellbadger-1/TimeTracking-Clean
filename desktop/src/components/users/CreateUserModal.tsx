import { useState, FormEvent } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateUser } from '../../hooks';
import { isValidEmail, getTodayDate } from '../../utils';

interface CreateUserModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export function CreateUserModal({ isOpen, onClose }: CreateUserModalProps) {
  const createUser = useCreateUser();

  // Form state
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [email, setEmail] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [role, setRole] = useState<'admin' | 'employee'>('employee');
  const [weeklyHours, setWeeklyHours] = useState('40');
  const [vacationDays, setVacationDays] = useState('30');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [hireDate, setHireDate] = useState(getTodayDate());

  // Error state
  const [usernameError, setUsernameError] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [confirmPasswordError, setConfirmPasswordError] = useState('');
  const [emailError, setEmailError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setUsernameError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setEmailError('');
    setFirstNameError('');
    setLastNameError('');

    // Validate username
    if (!username.trim()) {
      setUsernameError('Benutzername ist erforderlich');
      isValid = false;
    } else if (username.length < 3) {
      setUsernameError('Benutzername muss mind. 3 Zeichen lang sein');
      isValid = false;
    }

    // Validate password
    if (!password) {
      setPasswordError('Passwort ist erforderlich');
      isValid = false;
    } else if (password.length < 8) {
      setPasswordError('Passwort muss mind. 8 Zeichen lang sein');
      isValid = false;
    }

    // Validate confirm password
    if (password !== confirmPassword) {
      setConfirmPasswordError('Passwörter stimmen nicht überein');
      isValid = false;
    }

    // Validate email (OPTIONAL - only validate if provided)
    if (email.trim() && !isValidEmail(email)) {
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

    return isValid;
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    try {
      await createUser.mutateAsync({
        username: username.trim(),
        password,
        email: email.trim(),
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        role,
        weeklyHours: parseInt(weeklyHours) || 40,
        vacationDaysPerYear: parseInt(vacationDays) || 30,
        department: department.trim() || undefined,
        position: position.trim() || undefined,
        hireDate,
      });

      // Reset form and close
      handleClose();
    } catch (error) {
      console.error('Failed to create user:', error);
    }
  };

  const handleClose = () => {
    // Reset form
    setUsername('');
    setPassword('');
    setConfirmPassword('');
    setEmail('');
    setFirstName('');
    setLastName('');
    setRole('employee');
    setWeeklyHours('40');
    setVacationDays('30');
    setDepartment('');
    setPosition('');
    setHireDate(getTodayDate());

    // Reset errors
    setUsernameError('');
    setPasswordError('');
    setConfirmPasswordError('');
    setEmailError('');
    setFirstNameError('');
    setLastNameError('');

    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={handleClose} title="Neuen Benutzer anlegen" size="lg">
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Account Info */}
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Account-Informationen
          </h3>

          <Input
            label="Benutzername"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            error={usernameError}
            required
            autoComplete="off"
          />

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Passwort"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={passwordError}
              helperText="Mindestens 8 Zeichen"
              required
              autoComplete="new-password"
            />
            <Input
              label="Passwort bestätigen"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              error={confirmPasswordError}
              required
              autoComplete="new-password"
            />
          </div>

          <Input
            label="E-Mail"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
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
            Arbeitszeit & Urlaubskontingent
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

          <Input
            label="Eintrittsdatum"
            type="date"
            value={hireDate}
            onChange={(e) => setHireDate(e.target.value)}
            required
            helperText="Ab diesem Datum werden Arbeitsstunden erfasst (zukünftige Daten erlaubt)"
          />
        </div>

        {/* Actions */}
        <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200 dark:border-gray-700">
          <Button type="button" variant="ghost" onClick={handleClose}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={createUser.isPending}>
            {createUser.isPending ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Erstellen...
              </>
            ) : (
              'Benutzer erstellen'
            )}
          </Button>
        </div>
      </form>
    </Modal>
  );
}
