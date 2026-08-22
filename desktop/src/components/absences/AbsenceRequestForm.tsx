import { useState, FormEvent, useEffect, useMemo } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useCreateAbsenceRequest, useRemainingVacationDays, useCurrentOvertimeStats, useUsers, useMultiYearHolidays, isYearInHolidayWindow } from '../../hooks';
import { useWorkPeriods } from '../../hooks/useWorkTimeChange';
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
  const { data: vacationBalance, remaining: vacationDays, isLoading: loadingVacation } = useRemainingVacationDays(selectedUserId);
  const { data: overtimeStats, isLoading: loadingOvertime } = useCurrentOvertimeStats(selectedUserId);

  // Get total yearly overtime hours
  const overtimeHours = overtimeStats?.totalYear || 0;

  // Error state
  const [startDateError, setStartDateError] = useState('');
  const [endDateError, setEndDateError] = useState('');
  // WR-20 (Code-Review Phase 12): `reasonError` ist entfallen. Der Zustand wurde deklariert,
  // zweimal zurueckgesetzt und an das Textarea durchgereicht — aber an keiner Stelle jemals
  // auf einen Text gesetzt. Siehe Kommentar an der Textarea unten.

  // Perioden und Feiertage fuer die periodengetreue Vorschau (WR-12-Nachzug, Plan 12-08).
  // `null` heisst: noch keine Zahl behauptet (laedt oder fehlgeschlagen) — eine falsche Zahl
  // waere schlechter als keine.
  const [requiredDays, setRequiredDays] = useState<number | null>(null);
  const [requiredHours, setRequiredHours] = useState<number | null>(null);

  // Get selected user's data for work schedule
  // Employee: Use current user from auth store (users query is disabled)
  // Admin: Find selected user in users list
  const selectedUser = isAdmin
    ? users?.find(u => u.id === selectedUserId)
    : user;

  const {
    data: periods,
    isLoading: loadingPeriods,
    isError: periodsError,
  } = useWorkPeriods(selectedUserId > 0 ? selectedUserId : null);
  const {
    data: holidays,
    isLoading: loadingHolidays,
    isError: holidaysError,
  } = useMultiYearHolidays();
  const holidayDateSet = useMemo(
    () => new Set((holidays || []).map((holiday) => holiday.date)),
    [holidays]
  );
  /**
   * WR-21 (Code-Review Phase 12): `useMultiYearHolidays()` laedt nur +/- 2 Jahre um "heute".
   * Ein Antrag ausserhalb dieses Fensters — Langzeitplanung oder Nacherfassung — fand keinen
   * einzigen Feiertag, und die Vorschau zaehlte sie als Arbeitstage. Ein Fehlerzustand
   * entstand nicht: die zu hohe Zahl wurde ohne Vorbehalt angezeigt und ueber die Pruefung
   * unten auch zur Blockade herangezogen. Liegt der gewaehlte Zeitraum ausserhalb, wird die
   * Vorschau jetzt ausdruecklich verweigert — eine ehrliche Enthaltung statt einer falschen
   * Zahl. Der Antrag bleibt moeglich; der Server rechnet ohnehin verbindlich.
   *
   * `slice(0, 4)` ist hier unbedenklich: `startDate`/`endDate` sind bereits lokale
   * YYYY-MM-DD-Formularwerte, kein UTC-Zeitstempel — es ist ein Zeichenkettenpraefix, nicht
   * das von `.claude/CLAUDE.md` verbotene UTC-Abschneiden eines Moments.
   */
  const rangeOutsideHolidayWindow = useMemo(() => {
    if (!isValidDate(startDate) || !isValidDate(endDate)) return false;
    return (
      !isYearInHolidayWindow(Number(startDate.slice(0, 4))) ||
      !isYearInHolidayWindow(Number(endDate.slice(0, 4)))
    );
  }, [startDate, endDate]);

  const previewUnavailable = periodsError || holidaysError || rangeOutsideHolidayWindow;
  const previewLoading = loadingPeriods || loadingHolidays;

  useEffect(() => {
    if (
      isValidDate(startDate) &&
      isValidDate(endDate) &&
      isValidDateRange(startDate, endDate) &&
      selectedUser &&
      periods &&
      !previewLoading &&
      !previewUnavailable
    ) {
      // Calculate hours based on the periods valid across the selected range (periodengetreu)
      const hours = calculateAbsenceHoursWithWorkSchedule(startDate, endDate, periods, holidayDateSet);
      setRequiredHours(hours);

      // Calculate days - BEST PRACTICE (Personio, DATEV, SAP):
      // Days with 0 hours do NOT count as working days!
      const days = countWorkingDaysForUser(startDate, endDate, periods, holidayDateSet);
      setRequiredDays(days);
    } else {
      // Keine Zahl behaupten, solange Perioden/Feiertage nicht sicher geladen sind.
      setRequiredDays(null);
      setRequiredHours(null);
    }
  }, [startDate, endDate, selectedUser, periods, holidayDateSet, previewLoading, previewUnavailable]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setStartDateError('');
    setEndDateError('');

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
    // requiredDays === null: Vorschau noch nicht verfuegbar — keine Zahl, also keine Pruefung
    // hier (der Server berechnet und prueft ohnehin verbindlich, D2-Muster).
    if (type === 'vacation' && requiredDays !== null && requiredDays > vacationDays) {
      setEndDateError(`Du hast nur noch ${vacationDays} Urlaubstage verfügbar`);
      isValid = false;
    }

    // Validate overtime compensation
    if (type === 'overtime_comp' && requiredHours !== null) {
      if (requiredHours > overtimeHours) {
        setEndDateError(`Du hast nur ${formatOvertimeHours(overtimeHours)} Überstunden verfügbar`);
        isValid = false;
      }
    }

    // Validate reason for sick leave (optional but recommended) — just a hint, not blocking,
    // deshalb keine Debugausgabe (CLAUDE.md verbietet Debug-Logs in Production).

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
    } catch {
      // Error is handled by the hook (toast) — keine zusaetzliche Debugausgabe
      // (CLAUDE.md verbietet Debug-Logs in Production).
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
      const pending = vacationBalance?.pending || 0;
      const taken = vacationBalance?.taken || 0;

      return (
        <div className="p-3 bg-purple-50 dark:bg-purple-900/20 rounded-lg">
          <p className="text-sm text-purple-900 dark:text-purple-200">
            <strong>Verfügbar:</strong> {loadingVacation ? '...' : `${vacationDays} Urlaubstage`}
          </p>
          {!loadingVacation && (pending > 0 || taken > 0) && (
            <p className="text-xs text-purple-700 dark:text-purple-300 mt-1">
              {pending > 0 && `${pending} beantragt`}
              {pending > 0 && taken > 0 && ', '}
              {taken > 0 && `${taken} genehmigt`}
            </p>
          )}
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
          {previewUnavailable ? (
            <p className="text-sm text-blue-900 dark:text-blue-200">
              Vorschau kann gerade nicht berechnet werden. Der Antrag kann trotzdem gestellt werden.
            </p>
          ) : previewLoading || requiredDays === null || requiredHours === null ? (
            <p className="text-sm text-blue-900 dark:text-blue-200">Vorschau wird berechnet …</p>
          ) : (
            <>
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Erforderlich:</strong> {requiredDays} {requiredDays === 1 ? 'Tag' : 'Tage'}
                {type === 'overtime_comp' && ` (${requiredHours}h)`}
              </p>
              {selectedUser?.workSchedule && (
                <p className="text-xs text-blue-700 dark:text-blue-300 mt-1">
                  ⚠️ Tage mit 0h zählen nicht als Arbeitstage (Best Practice: Personio, DATEV, SAP)
                </p>
              )}
            </>
          )}
        </div>

        {/* Balance Info */}
        {getBalanceInfo()}

        {/* Reason */}
        {/*
          WR-20 (Code-Review Phase 12): Das Feld markierte sich bei einer Krankmeldung als
          `required`, waehrend `validateForm()` den Grund ueberhaupt nicht prueft und der
          Kommentar im Code ihn ausdruecklich "optional but recommended … just a hint, not
          blocking" nennt. Die Durchsetzung haette allein an der Browser-Standardvalidierung
          gehangen, deren Meldung weder lokalisiert noch an das Fehlerdesign der App
          angeglichen ist.

          Aufgeloest zugunsten von "optional": Das Label sagt selbst "Grund (empfohlen)", der
          Platzhalter der uebrigen Arten sagt "Optional", und der Server nimmt `reason` als
          optionales Feld entgegen (`absenceService`: `reason?: string`, gespeichert wird
          `data.reason || null`). `required` war damit die einzige Stelle, die etwas anderes
          behauptete. Mit dem Attribut entfaellt auch der tote `reasonError`-Zustand.
        */}
        <Textarea
          label={type === 'sick' ? 'Grund (empfohlen)' : 'Grund'}
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          rows={3}
          placeholder={
            type === 'sick'
              ? 'z.B. Erkältung, Grippe, ...'
              : 'Optional: Begründung für den Antrag'
          }
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
