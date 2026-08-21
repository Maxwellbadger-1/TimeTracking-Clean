import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import {
  useUpsertVacationBalance,
  type VacationBalanceSummary,
} from '../../hooks';

/**
 * Obergrenze für die Begründung.
 *
 * Der Server prüft nur auf „nicht leer", nicht auf Länge. Der Text landet aber unverändert
 * als Buchungstext im Kontoauszug des Mitarbeiters — eine versehentlich eingefügte Textwand
 * würde die Tabelle dort auseinanderziehen. 500 Zeichen reichen für jede echte Begründung.
 */
const REASON_MAX_LENGTH = 500;

interface VacationBalanceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  balance: VacationBalanceSummary;
  year: number;
}

export function VacationBalanceEditModal({
  isOpen,
  onClose,
  balance,
  year,
}: VacationBalanceEditModalProps) {
  const upsert = useUpsertVacationBalance();

  /**
   * Pre-fill value for the entitlement field.
   *
   * Was `balance.entitlement || 30`, which had two defects:
   *  1. `0 || 30` is 30 in JavaScript — opening an account that legitimately has 0 days
   *     and saving it silently wrote 30 back.
   *  2. When no balance existed yet, it proposed a hardcoded 30 rather than the value
   *     actually configured for that employee.
   *
   * Now: an existing balance keeps its value (0 included); a new one is seeded from the
   * employee's own annual entitlement. See .planning/debug/urlaubstage-bei-ablehnung-verloren.md
   */
  const initialEntitlement = () =>
    String(balance.hasBalance ? balance.entitlement : (balance.defaultEntitlement ?? 30));

  // Form state
  const [entitlement, setEntitlement] = useState(initialEntitlement);
  const [carryover, setCarryover] = useState(String(balance.carryover || 0));
  const [reason, setReason] = useState('');

  // Error state
  const [entitlementError, setEntitlementError] = useState('');
  const [carryoverError, setCarryoverError] = useState('');
  const [reasonError, setReasonError] = useState('');

  // Update form when balance changes
  useEffect(() => {
    setEntitlement(initialEntitlement());
    setCarryover(String(balance.carryover || 0));
    setReason('');
    setReasonError('');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [balance]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setEntitlementError('');
    setCarryoverError('');
    setReasonError('');

    // Validate entitlement
    const entitlementNum = parseInt(entitlement);
    if (isNaN(entitlementNum) || entitlementNum < 0 || entitlementNum > 50) {
      setEntitlementError('Anspruch muss zwischen 0 und 50 Tagen liegen');
      isValid = false;
    }

    // Validate carryover
    const carryoverNum = parseInt(carryover);
    if (isNaN(carryoverNum) || carryoverNum < 0 || carryoverNum > 10) {
      setCarryoverError('Übertrag muss zwischen 0 und 10 Tagen liegen');
      isValid = false;
    }

    // Validate reason
    if (reason.trim().length < 5) {
      setReasonError('Bitte begründen Sie die Änderung (mindestens 5 Zeichen)');
      isValid = false;
    } else if (reason.trim().length > REASON_MAX_LENGTH) {
      setReasonError(`Begründung darf höchstens ${REASON_MAX_LENGTH} Zeichen lang sein`);
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
      await upsert.mutateAsync({
        userId: balance.userId,
        year,
        entitlement: parseInt(entitlement),
        carryover: parseInt(carryover),
        reason: reason.trim(),
      });

      handleClose();
    } catch (error) {
      console.error('Failed to save vacation balance:', error);
    }
  };

  const handleClose = () => {
    // Reset form
    setEntitlement(initialEntitlement());
    setCarryover(String(balance.carryover || 0));
    setReason('');
    setEntitlementError('');
    setCarryoverError('');
    setReasonError('');
    onClose();
  };

  // Calculate preview
  const total = (parseInt(entitlement) || 0) + (parseInt(carryover) || 0);
  const remaining = total - balance.taken;

  return (
    <Modal
      isOpen={isOpen}
      onClose={handleClose}
      title={
        balance.hasBalance
          ? `Urlaubskonto bearbeiten - ${balance.firstName} ${balance.lastName}`
          : `Urlaubskonto initialisieren - ${balance.firstName} ${balance.lastName}`
      }
      size="md"
    >
      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Year Display */}
        <div className="p-3 bg-blue-50 dark:bg-blue-900/20 rounded-lg">
          <p className="text-sm text-blue-900 dark:text-blue-200">
            <strong>Jahr:</strong> {year}
          </p>
        </div>

        {/* Entitlement */}
        <Input
          type="number"
          label="Urlaubsanspruch (Tage)"
          value={entitlement}
          onChange={(e) => setEntitlement(e.target.value)}
          error={entitlementError}
          min="0"
          max="50"
          step="1"
          helperText="Jährlicher Urlaubsanspruch"
          required
        />

        {/* Carryover */}
        <Input
          type="number"
          label="Übertrag (Tage)"
          value={carryover}
          onChange={(e) => setCarryover(e.target.value)}
          error={carryoverError}
          min="0"
          max="10"
          step="1"
          helperText="Übertrag aus Vorjahr (max. 5 Tage automatisch)"
        />

        {/* Reason */}
        <div className="w-full">
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Begründung *
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            required
            maxLength={REASON_MAX_LENGTH}
            className={`
              block w-full px-4 py-2.5 rounded-lg
              bg-white dark:bg-gray-800
              text-gray-900 dark:text-gray-100
              text-sm font-medium
              placeholder-gray-400 dark:placeholder-gray-500
              border-2
              shadow-sm
              focus:outline-none focus:ring-2 focus:ring-offset-0
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-200
              hover:border-gray-400 dark:hover:border-gray-500
              hover:shadow-md
              ${reasonError
                ? 'border-red-500 focus:ring-red-500 focus:border-red-500'
                : 'border-gray-300 focus:ring-blue-500 focus:border-blue-500 dark:border-gray-600'}
            `}
          />
          {reasonError && (
            <p className="mt-1 text-sm text-red-600 dark:text-red-400" role="alert">
              {reasonError}
            </p>
          )}
          {!reasonError && (
            <p className="mt-1 flex justify-between gap-2 text-sm text-gray-500 dark:text-gray-400">
              <span>Wird als Buchungstext im Kontoauszug des Mitarbeiters angezeigt.</span>
              <span className="shrink-0 tabular-nums">
                {reason.length}/{REASON_MAX_LENGTH}
              </span>
            </p>
          )}
        </div>

        {/* Preview */}
        <div className="p-4 bg-gray-50 dark:bg-gray-700 rounded-lg space-y-2">
          <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Vorschau
          </h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-600 dark:text-gray-400">Anspruch</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {entitlement || 0} Tage
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Übertrag</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {carryover || 0} Tage
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Genommen</p>
              <p className="font-semibold text-gray-900 dark:text-gray-100">
                {balance.taken} Tage
              </p>
            </div>
            <div>
              <p className="text-gray-600 dark:text-gray-400">Verbleibend</p>
              <p
                className={`font-semibold ${
                  remaining > 0
                    ? 'text-green-600 dark:text-green-400'
                    : remaining < 0
                    ? 'text-red-600 dark:text-red-400'
                    : 'text-gray-900 dark:text-gray-100'
                }`}
              >
                {remaining} Tage
              </p>
            </div>
          </div>
        </div>

        {/* Hint: correction booking */}
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Diese Änderung erscheint als Korrekturbuchung im Kontoauszug des Mitarbeiters
          und bleibt dort mit der eingegebenen Begründung nachvollziehbar.
        </p>

        {/* Warning if taken > total */}
        {remaining < 0 && (
          <div className="p-3 bg-orange-50 dark:bg-orange-900/20 rounded-lg">
            <p className="text-sm text-orange-900 dark:text-orange-200">
              ⚠️ Achtung: Der Mitarbeiter hat mehr Urlaubstage genommen als
              verfügbar. Bitte prüfen Sie die Werte.
            </p>
          </div>
        )}

        {/* Buttons */}
        <div className="flex justify-end space-x-3 pt-4">
          <Button
            type="button"
            variant="secondary"
            onClick={handleClose}
            disabled={upsert.isPending}
          >
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={upsert.isPending}>
            {upsert.isPending ? (
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
