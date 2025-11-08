import { useState, FormEvent, useEffect } from 'react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import {
  useUpsertVacationBalance,
  type VacationBalanceSummary,
} from '../../hooks';

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

  // Form state
  const [entitlement, setEntitlement] = useState(String(balance.entitlement || 30));
  const [carryover, setCarryover] = useState(String(balance.carryover || 0));

  // Error state
  const [entitlementError, setEntitlementError] = useState('');
  const [carryoverError, setCarryoverError] = useState('');

  // Update form when balance changes
  useEffect(() => {
    setEntitlement(String(balance.entitlement || 30));
    setCarryover(String(balance.carryover || 0));
  }, [balance]);

  const validateForm = (): boolean => {
    let isValid = true;

    // Reset errors
    setEntitlementError('');
    setCarryoverError('');

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
      });

      handleClose();
    } catch (error) {
      console.error('Failed to save vacation balance:', error);
    }
  };

  const handleClose = () => {
    // Reset form
    setEntitlement(String(balance.entitlement || 30));
    setCarryover(String(balance.carryover || 0));
    setEntitlementError('');
    setCarryoverError('');
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
