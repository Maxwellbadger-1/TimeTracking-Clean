import { useState, FormEvent, useEffect, useRef } from 'react';
import { toast } from 'sonner';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WorkScheduleEditor } from './WorkScheduleEditor';
import { WorkTimeChangeModal } from '../worktime/WorkTimeChangeModal';
import { WorkTimePeriodList } from '../worktime/WorkTimePeriodList';
import { useUpdateUser } from '../../hooks';
import { isValidEmail, getTodayDate } from '../../utils';
import { formatOvertimeHours } from '../../utils/timeUtils';
import type { User, WorkSchedule, WorkTimeChangeResult } from '../../types';

/** Wertvergleich zweier Tagesplaene — keine Objektidentitaet. Stabile Serialisierung ueber
 *  sortierte Schluessel, damit der Sync-Effekt (unten) nicht an der Objektidentitaet haengt,
 *  die bei jedem Refetch von `user` wechselt (12-UI-SPEC.md, Aenderungstabelle B). */
function serializeWorkSchedule(schedule: WorkSchedule | null): string {
  if (!schedule) return 'null';
  const sortedKeys = Object.keys(schedule).sort() as Array<keyof WorkSchedule>;
  return JSON.stringify(sortedKeys.map((key) => [key, schedule[key]]));
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export function EditUserModal({ isOpen, onClose, user }: EditUserModalProps) {
  const updateUser = useUpdateUser();

  // Form state - Initialize with user data
  const [email, setEmail] = useState(user.email || ''); // Handle NULL email
  const [firstName, setFirstName] = useState(user.firstName);
  const [lastName, setLastName] = useState(user.lastName);
  const [role, setRole] = useState<'admin' | 'employee'>(user.role);
  const [weeklyHours, setWeeklyHours] = useState(String(user.weeklyHours ?? 40));
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(user.workSchedule || null);
  const [vacationDays, setVacationDays] = useState(String(user.vacationDaysPerYear ?? 30));
  const [department, setDepartment] = useState(user.department || '');
  const [position, setPosition] = useState(user.position || '');
  const [isActive, setIsActive] = useState(user.isActive);
  const [hireDate, setHireDate] = useState(user.hireDate || getTodayDate());
  const [endDate, setEndDate] = useState(user.endDate || '');

  // Error state
  const [emailError, setEmailError] = useState('');
  const [firstNameError, setFirstNameError] = useState('');
  const [lastNameError, setLastNameError] = useState('');

  // Phase 12 (D1): Einstieg in den Stundenwechsel-Dialog
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  const [successBanner, setSuccessBanner] = useState<{ validFrom: string; weeklyHours: number } | null>(null);

  // Update form when user changes (B4-Fix: nur beim Nutzerwechsel zuruecksetzen, nicht bei
  // jedem Refetch — `user` ist nach der Umstellung von UserManagementPage auf die
  // abgeleitete Query bei jedem Refetch ein neues Objekt; ein Reset auf `[user]` wuerde
  // sonst auch gerade getippte Felder wie Name/E-Mail verwerfen).
  useEffect(() => {
    setEmail(user.email || ''); // Handle NULL email
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
    setWeeklyHours(String(user.weeklyHours ?? 40));
    setWorkSchedule(user.workSchedule || null);
    setVacationDays(String(user.vacationDaysPerYear ?? 30));
    setDepartment(user.department || '');
    setPosition(user.position || '');
    setIsActive(user.isActive);
    setHireDate(user.hireDate || getTodayDate());
    setEndDate(user.endDate || '');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.id]);

  // Schmaler Sync-Effekt: haelt ausschliesslich die beiden schreibgeschuetzten Felder
  // (Wochenstunden, Tagesplan) mit dem Server synchron, z. B. direkt nach dem Speichern
  // eines Stundenwechsels (Zustand 15). Wertvergleich statt Objektidentitaet — `user`
  // wechselt bei jedem Refetch die Identitaet, auch ohne inhaltliche Aenderung.
  const workScheduleSerialized = serializeWorkSchedule(user.workSchedule || null);
  useEffect(() => {
    setWeeklyHours(String(user.weeklyHours ?? 40));
    setWorkSchedule(user.workSchedule || null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user.weeklyHours, workScheduleSerialized]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setEmailError('');
    setFirstNameError('');
    setLastNameError('');

    // Validate email (OPTIONAL - only validate if provided)
    if (email && email.trim() && !isValidEmail(email)) {
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

    // Phase 12 (D1/T-12-34): weeklyHours/workSchedule kommen unveraendert aus `user`, nicht
    // aus dem Formularzustand — "Aenderungen speichern" kann das Arbeitszeitmodell damit
    // nicht mehr still ueberschreiben. Der Stundenwechsel laeuft ausschliesslich ueber den
    // eigenen Dialog (WorkTimeChangeModal).
    const updateData = {
      email: email && email.trim() !== '' ? email.trim() : undefined, // Convert empty string to undefined
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      role,
      weeklyHours: user.weeklyHours ?? 40,
      workSchedule: user.workSchedule || null,
      vacationDaysPerYear: vacationDays === '' ? 30 : parseInt(vacationDays) || 0, // Explicit: empty = 30, else parse (0 is valid!)
      department: department.trim() || undefined,
      position: position.trim() || undefined,
      isActive,
      hireDate,
      endDate: endDate || undefined,
    };

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
    setEmail(user.email || ''); // Handle NULL email
    setFirstName(user.firstName);
    setLastName(user.lastName);
    setRole(user.role);
    setWeeklyHours(String(user.weeklyHours ?? 40));
    setWorkSchedule(user.workSchedule || null);
    setVacationDays(String(user.vacationDaysPerYear ?? 30));
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
            name="email"
            label="E-Mail (Optional)"
            type="text"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            error={emailError}
            placeholder="beispiel@firma.de"
          />
        </div>

        {/* Personal Info */}
        <div className="space-y-4 pt-4 border-t border-gray-200 dark:border-gray-700">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Persönliche Informationen
          </h3>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="firstName"
              label="Vorname"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              error={firstNameError}
              required
            />
            <Input
              name="lastName"
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

          {/* Zustand 15 (Stundenwechsel gespeichert): 8 Sekunden sichtbares gruenes Banner */}
          {successBanner && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-800 dark:text-green-200">
                Stundenwechsel gespeichert: ab{' '}
                {new Date(successBanner.validFrom + 'T12:00:00').toLocaleDateString('de-DE')} gelten{' '}
                {successBanner.weeklyHours.toLocaleString('de-DE', { maximumFractionDigits: 2 })} h/Woche.
              </p>
            </div>
          )}

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
              name="weeklyHours"
              label="Wochenstunden"
              type="number"
              min="0"
              max="60"
              step="0.5"
              value={weeklyHours}
              readOnly
              aria-readonly="true"
              className="bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 cursor-not-allowed hover:!border-gray-300 dark:hover:!border-gray-600 hover:!shadow-sm"
              required
              helperText='Wird über „Stundenwechsel ab Datum …" geändert, damit vergangene Monate unberührt bleiben.'
            />
            <Input
              name="vacationDays"
              label="Urlaubstage/Jahr"
              type="number"
              min="0"
              max="50"
              value={vacationDays}
              onChange={(e) => setVacationDays(e.target.value)}
              required
            />
          </div>

          {/* Individual Work Schedule — schreibgeschuetzt (D1), Wechsel nur ueber den Dialog */}
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Der Tagesplan gehört zum Arbeitszeitmodell und wird zusammen mit dem Stichtag geändert.
          </p>
          <WorkScheduleEditor
            value={workSchedule}
            weeklyHours={weeklyHours === '' ? 40 : (parseFloat(weeklyHours) || 0)}
            onChange={setWorkSchedule}
            readOnly
          />

          {/* Einstiegs-Button in den Stundenwechsel-Dialog (D1) */}
          <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 flex items-center justify-between gap-4">
            <p className="text-sm text-blue-800 dark:text-blue-200">
              Eine rückwirkende oder künftige Umstellung des Arbeitszeitmodells läuft über eine
              eigene Aktion mit Vorschau.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              ref={changeButtonRef}
              onClick={() => setIsChangeModalOpen(true)}
            >
              Stundenwechsel ab Datum …
            </Button>
          </div>

          {/* Periodenblock (Abschnitt 4 UI-SPEC) */}
          <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">
              Arbeitszeitmodell — Perioden
            </h3>
            <WorkTimePeriodList userId={user.id} />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              name="hireDate"
              label="Eintrittsdatum"
              type="date"
              value={hireDate}
              onChange={(e) => setHireDate(e.target.value)}
              required
              helperText="Ab diesem Datum werden Arbeitsstunden erfasst (zukünftige Daten erlaubt)"
            />
            <Input
              name="endDate"
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

      {/* Formulargrenzen im verschachtelten Baum (12-UI-SPEC.md, Abschnitt 1, T-12-38):
          außerhalb des <form> gerendert, damit ein Submit/Enter im Wechsel-Dialog niemals
          handleSubmit dieses Formulars erreicht — createPortal allein würde das nicht lösen,
          weil Ereignisse entlang des React-Baums propagieren, nicht des DOM-Baums. */}
      <WorkTimeChangeModal
        isOpen={isChangeModalOpen}
        onClose={() => {
          setIsChangeModalOpen(false);
          changeButtonRef.current?.focus();
        }}
        user={user}
        onSaved={(result: WorkTimeChangeResult) => {
          setIsChangeModalOpen(false);
          setSuccessBanner({
            validFrom: result.period.validFrom,
            weeklyHours: result.period.weeklyHours,
          });
          window.setTimeout(() => setSuccessBanner(null), 8000);
          toast.success(
            result.preview.balanceDelta !== 0
              ? `Stundenwechsel gespeichert — Saldoänderung ${formatOvertimeHours(result.preview.balanceDelta)} steht im Kontoauszug`
              : 'Stundenwechsel gespeichert'
          );
          changeButtonRef.current?.focus();
        }}
      />
    </Modal>
  );
}
