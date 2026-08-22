import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { AlertCircle, Info } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WorkScheduleEditor } from '../users/WorkScheduleEditor';
import { useWorkPeriods } from '../../hooks/useWorkTimeChange';
import type { User, WorkSchedule } from '../../types';

/**
 * Der Wechsel-Dialog (Phase 12, D1/REQ-26/REQ-27). `12-UI-SPEC.md` Abschnitt 2 ist der
 * bindende Designvertrag: Textbuch, Panelvarianten, Zustandsliste 1-15.
 *
 * Task 1 liefert Geruest, Formular, Vorbelegung und Validierung (Zustaende 1-3, 8, 9). Der
 * Vorschauteil aus Zustand 8 vergleicht hier ausschliesslich die eigenen Eingaben gegen die
 * bereits geladene, aktuell gueltige Periode (`currentPeriod`) — das ist eine reine
 * Gleichheitspruefung, keine Berechnung einer Zahl (Sollstunden/Saldo bleiben D2-pflichtig
 * dem Server vorbehalten und kommen in Task 2 über `usePreviewWorkTimeChange` hinzu).
 */

interface WorkTimeChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

interface FieldErrors {
  validFrom?: string;
  weeklyHours?: string;
  reason?: string;
}

/** Zeitzonensicheres YYYY-MM-DD von "heute" — kein UTC-Split-Verfahren auf einem
 *  ISO-String (`.claude/CLAUDE.md`), Muster aus `WorkTimePeriodList.tsx`. */
function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Anzeige eines ISO-Datums im deutschen Format — niemals über ein UTC-Split-Verfahren. */
function formatGermanDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

function formatWeeklyHoursDe(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** `null` bei leerem/ungueltigem/ausserhalb-0-60-Wert, sonst die geparste Zahl. */
function parseWeeklyHoursValue(value: string): number | null {
  if (value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > 60) return null;
  return num;
}

function workScheduleEquals(a: WorkSchedule | null, b: WorkSchedule | null): boolean {
  if (a === null && b === null) return true;
  if (a === null || b === null) return false;
  return (
    a.monday === b.monday &&
    a.tuesday === b.tuesday &&
    a.wednesday === b.wednesday &&
    a.thursday === b.thursday &&
    a.friday === b.friday &&
    a.saturday === b.saturday &&
    a.sunday === b.sunday
  );
}

export function WorkTimeChangeModal({ isOpen, onClose, user }: WorkTimeChangeModalProps) {
  const periodsQuery = useWorkPeriods(isOpen ? user.id : null);

  const [validFrom, setValidFrom] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');

  const validFromRef = useRef<HTMLInputElement>(null);
  const weeklyHoursRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const prefillAppliedRef = useRef(false);

  const isSaving = false; // Task 2 ersetzt dies durch useSaveWorkTimeChange().isPending.

  const todayStr = useMemo(() => formatDateLocal(new Date()), []);

  const currentPeriod = useMemo(() => {
    const periods = periodsQuery.data;
    if (!periods) return null;
    return (
      periods.find(
        (p) => p.validFrom <= todayStr && (p.validTo === null || p.validTo > todayStr)
      ) ?? null
    );
  }, [periodsQuery.data, todayStr]);

  // Reset + Vorbelegung mit den Stammdatenwerten beim Oeffnen. `user.id` statt `user` als
  // Abhaengigkeit (Musterentscheidung dieser Phase, siehe EditUserModal-Aenderung in
  // `12-UI-SPEC.md`) — ein neues `user`-Objekt durch einen Refetch soll das Formular nicht
  // zuruecksetzen, solange derselbe Nutzer bearbeitet wird.
  useEffect(() => {
    if (!isOpen) {
      prefillAppliedRef.current = false;
      return;
    }
    setValidFrom('');
    setWeeklyHours(String(user.weeklyHours));
    setWorkSchedule(user.workSchedule ?? null);
    setReason('');
    setFieldErrors({});
    setFormError('');
    prefillAppliedRef.current = false;
    validFromRef.current?.focus();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, user.id]);

  // Sobald die Perioden geladen sind (Erfolg oder Fehler), die Vorbelegung auf die aktuell
  // gueltige Periode verfeinern — genau einmal je Oeffnen, damit spaetere Neuladungen
  // laufende Eingaben nicht ueberschreiben.
  useEffect(() => {
    if (!isOpen || prefillAppliedRef.current) return;
    if (periodsQuery.isLoading) return;
    if (currentPeriod) {
      setWeeklyHours(String(currentPeriod.weeklyHours));
      setWorkSchedule(currentPeriod.workSchedule);
    }
    prefillAppliedRef.current = true;
  }, [isOpen, periodsQuery.isLoading, currentPeriod]);

  const weeklyHoursNum = parseWeeklyHoursValue(weeklyHours);
  const isReadyForPreview = validFrom !== '' && weeklyHoursNum !== null;
  const isNoOpClient =
    isReadyForPreview &&
    currentPeriod !== null &&
    currentPeriod.weeklyHours === weeklyHoursNum &&
    workScheduleEquals(currentPeriod.workSchedule, workSchedule);

  function handleValidFromChange(e: ChangeEvent<HTMLInputElement>) {
    setValidFrom(e.target.value);
    setFieldErrors((prev) => ({ ...prev, validFrom: undefined }));
  }

  function handleWeeklyHoursChange(e: ChangeEvent<HTMLInputElement>) {
    setWeeklyHours(e.target.value);
    setFieldErrors((prev) => ({ ...prev, weeklyHours: undefined }));
  }

  function handleWorkScheduleChange(schedule: WorkSchedule | null) {
    setWorkSchedule(schedule);
  }

  function handleReasonChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setReason(e.target.value);
    setFieldErrors((prev) => ({ ...prev, reason: undefined }));
  }

  /** Zustand 9: Meldungen woertlich aus `12-UI-SPEC.md` → "Fehlermeldungen (Validierung)". */
  function validateForm(): boolean {
    const errors: FieldErrors = {};

    if (!validFrom) {
      errors.validFrom = 'Stichtag ist erforderlich';
    } else if (validFrom < user.hireDate) {
      errors.validFrom = `Der Stichtag darf nicht vor dem Eintrittsdatum (${formatGermanDate(user.hireDate)}) liegen.`;
    } else if (user.endDate && validFrom > user.endDate) {
      errors.validFrom = `Der Stichtag liegt nach dem Austrittsdatum (${formatGermanDate(user.endDate)}).`;
    } else if (periodsQuery.data?.some((p) => p.validFrom === validFrom)) {
      errors.validFrom = `Zum ${formatGermanDate(validFrom)} existiert bereits eine Periode. Wählen Sie ein anderes Datum.`;
    }

    if (weeklyHours === '' || Number.isNaN(Number(weeklyHours))) {
      errors.weeklyHours = 'Wochenstunden sind erforderlich';
    } else if (Number(weeklyHours) < 0 || Number(weeklyHours) > 60) {
      errors.weeklyHours = 'Wochenstunden müssen zwischen 0 und 60 liegen';
    }

    if (!reason.trim()) {
      errors.reason = 'Begründung ist erforderlich';
    } else if (reason.trim().length < 10) {
      errors.reason = 'Begründung muss mindestens 10 Zeichen lang sein';
    }

    setFieldErrors(errors);

    if (errors.validFrom) {
      validFromRef.current?.focus();
      return false;
    }
    if (errors.weeklyHours) {
      weeklyHoursRef.current?.focus();
      return false;
    }
    if (errors.reason) {
      reasonRef.current?.focus();
      return false;
    }

    return true;
  }

  function resetForm() {
    setValidFrom('');
    setWeeklyHours(String(user.weeklyHours));
    setWorkSchedule(user.workSchedule ?? null);
    setReason('');
    setFieldErrors({});
    setFormError('');
  }

  function handleClose() {
    if (isSaving) return;
    resetForm();
    onClose();
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;
    if (!validateForm()) return;
    // Task 2 ergaenzt hier den Vorschau-/Speicherpfad (previewToken-Kopplung, Bestaetigung).
  }

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : handleClose}
      size="lg"
      zIndexClass="z-[60]"
      title={`Stundenwechsel: ${user.firstName} ${user.lastName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Mitarbeiter-Infopanel */}
        <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4 space-y-1">
          <p className="text-sm font-semibold text-blue-900 dark:text-blue-100">
            {user.firstName} {user.lastName}
          </p>
          <p className="text-sm text-blue-900 dark:text-blue-100">
            Eintrittsdatum: {formatGermanDate(user.hireDate)}
          </p>
          {periodsQuery.isLoading ? (
            <div className="flex justify-center py-8">
              <LoadingSpinner />
            </div>
          ) : periodsQuery.isError ? (
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Das aktuell gültige Modell konnte nicht geladen werden. Die Felder sind mit den
              Stammdatenwerten vorbelegt — bitte prüfen.
            </p>
          ) : (
            <p className="text-sm text-blue-900 dark:text-blue-100">
              Aktuell gültig seit {formatGermanDate(currentPeriod?.validFrom ?? user.hireDate)}:{' '}
              {formatWeeklyHoursDe(currentPeriod?.weeklyHours ?? user.weeklyHours)} h/Woche
            </p>
          )}
        </div>

        {/* 2. Formularfehler-Banner */}
        {formError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 dark:text-red-100">{formError}</p>
          </div>
        )}

        {/* 3. Stichtag + Neue Wochenstunden */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <Input
              ref={validFromRef}
              label="Stichtag"
              type="date"
              value={validFrom}
              onChange={handleValidFromChange}
              error={fieldErrors.validFrom}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Ab diesem Tag gilt das neue Modell. Ein Datum in der Vergangenheit ist erlaubt —
              dann wird ab dort neu gerechnet.
            </p>
          </div>
          <div>
            <Input
              ref={weeklyHoursRef}
              label="Neue Wochenstunden"
              type="number"
              min="0"
              max="60"
              step="0.5"
              value={weeklyHours}
              onChange={handleWeeklyHoursChange}
              error={fieldErrors.weeklyHours}
              required
            />
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              0 h = Aushilfe (alle erfassten Stunden zählen als Überstunden)
            </p>
          </div>
        </div>

        {/* 4. Neuer Tagesplan */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Neuer Tagesplan
          </h3>
          <WorkScheduleEditor
            value={workSchedule}
            weeklyHours={weeklyHoursNum ?? 0}
            onChange={handleWorkScheduleChange}
          />
        </div>

        {/* 5. Begründung */}
        <div>
          <Textarea
            ref={reasonRef}
            label="Begründung"
            value={reason}
            onChange={handleReasonChange}
            error={fieldErrors.reason}
            rows={4}
            required
            placeholder="Warum wird umgestellt? Zum Beispiel: Neuer Arbeitsvertrag vom 12.06.2026, Reduzierung auf Teilzeit (mindestens 10 Zeichen)"
          />
          {reason.length < 10 && (
            <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">
              Noch {10 - reason.length} Zeichen
            </p>
          )}
        </div>

        {/* 6. Vorschaupanel — Zustand 3 (Platzhalter) und Zustand 8 (nichts zu tun) aus Task 1;
            Task 2 baut diesen Bereich zum vollstaendigen, serverseitig gespeisten Panel aus. */}
        <div className="rounded-lg border p-4 bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700">
          {isNoOpClient && currentPeriod ? (
            <div className="flex items-start gap-2">
              <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
              <p className="text-sm text-gray-600 dark:text-gray-400">
                Die eingegebenen Werte entsprechen der aktuell gültigen Periode ab{' '}
                {formatGermanDate(currentPeriod.validFrom)}. Es gibt nichts umzustellen — ändern
                Sie die Wochenstunden oder den Tagesplan.
              </p>
            </div>
          ) : (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt sind.
            </p>
          )}
        </div>

        {/* 7. Aktionszeile */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={!isReadyForPreview || isNoOpClient}>
            Stundenwechsel speichern
          </Button>
        </div>
      </form>
    </Modal>
  );
}
