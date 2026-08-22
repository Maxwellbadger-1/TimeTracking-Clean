import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
  type FormEvent,
} from 'react';
import { AlertCircle, AlertTriangle, Info, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { Input } from '../ui/Input';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { WorkScheduleEditor } from '../users/WorkScheduleEditor';
import {
  useWorkPeriods,
  usePreviewWorkTimeChange,
  useSaveWorkTimeChange,
} from '../../hooks/useWorkTimeChange';
import { formatHours } from '../../utils/timeUtils';
import type { User, WorkSchedule, WorkTimeChangePreviewResponse, WorkTimeChangeResult } from '../../types';

/**
 * Der Wechsel-Dialog (Phase 12, D1/D2/REQ-26/REQ-27/REQ-28). `12-UI-SPEC.md` Abschnitt 2 und
 * 3 sind der bindende Designvertrag: Textbuch, Panelvarianten, Zustandsliste 1-15.
 *
 * Task 1 lieferte Geruest, Formular, Vorbelegung und Validierung (Zustaende 1-3, 8, 9). Task 2
 * baut das Vorschaupanel zum vollstaendigen, serverseitig gespeisten Baustein aus (Zustaende
 * 4-7, 10-15): automatische, entprellte Vorschau (siehe PREVIEW_DEBOUNCE_MS) ueber
 * `usePreviewWorkTimeChange`, ein
 * synchron mit jeder Feldaenderung verworfenes `previewToken`, die Bestaetigung bei
 * rueckwirkendem Stichtag und der Speicherpfad ueber `useSaveWorkTimeChange`. Zustand 8
 * ("nichts umzustellen") wird ab hier ausschliesslich aus `preview.isNoOp` gelesen — die
 * client-seitige Naeherung aus Task 1 entfaellt, damit im Dialog nichts mehr selbst
 * verglichen oder gerechnet wird (D2).
 */

const PREVIEW_DEBOUNCE_MS = 400;

interface WorkTimeChangeModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  onSaved?: (result: WorkTimeChangeResult) => void;
}

interface FieldErrors {
  validFrom?: string;
  weeklyHours?: string;
  reason?: string;
  /** CR-03: blockierender Fehler am Tagesplan (Tagesstunden ausserhalb 0-24). */
  workSchedule?: string;
}

/** Gegenstueck zu `MAX_DAILY_HOURS` in `server/src/utils/workSchedule.ts`. */
const MAX_DAILY_HOURS = 24;

const DAY_LABELS_DE: Record<keyof WorkSchedule, string> = {
  monday: 'Montag',
  tuesday: 'Dienstag',
  wednesday: 'Mittwoch',
  thursday: 'Donnerstag',
  friday: 'Freitag',
  saturday: 'Samstag',
  sunday: 'Sonntag',
};

/**
 * CR-03 (Code-Review Phase 12): Der Tagesplan wurde bisher in `validateForm()` ueberhaupt
 * nicht geprueft — die Summenwarnung im `WorkScheduleEditor` blockiert ausdruecklich nicht.
 * Ein Tagesplan mit einem Wert ausserhalb 0-24 (eingefuegt, per Skript gesetzt oder aus
 * einer Bestandsperiode vorbelegt) waere damit gespeichert worden und direkt in die
 * Sollstundenberechnung eingegangen. Liefert den fehlerhaften Tag oder `null`.
 */
function findInvalidScheduleDay(schedule: WorkSchedule | null): keyof WorkSchedule | null {
  if (!schedule) return null;
  const keys = Object.keys(schedule) as Array<keyof WorkSchedule>;
  return (
    keys.find((day) => {
      const value = schedule[day];
      return !Number.isFinite(value) || value < 0 || value > MAX_DAILY_HOURS;
    }) ?? null
  );
}

type PreviewPanelState = 'placeholder' | 'loading' | 'error' | 'noop' | 'future' | 'past';

/** Zeitzonensicheres YYYY-MM-DD von "heute" — kein UTC-Split-Verfahren auf einem
 *  ISO-String (`.claude/CLAUDE.md`), Muster aus `WorkTimePeriodList.tsx`. */
function formatDateLocal(date: Date): string {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** Anzeige eines ISO-Datums im deutschen Format — niemals über ein UTC-Split-Verfahren. */
function formatGermanDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

function formatGermanDayMonth(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });
}

function formatGermanMonthYear(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE', { month: 'long', year: 'numeric' });
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

/** Vorzeichenbehaftete Stundenanzeige. Randfall Differenz = 0: "± 0:00h" statt "+0:00h" —
 *  eine unveraenderte Groesse ist weder Gutschrift noch Belastung. */
function formatSignedHours(value: number): string {
  if (value === 0) return '± 0:00h';
  return `${value > 0 ? '+' : ''}${formatHours(value)}`;
}

export function WorkTimeChangeModal({ isOpen, onClose, user, onSaved }: WorkTimeChangeModalProps) {
  const periodsQuery = useWorkPeriods(isOpen ? user.id : null);
  const previewM = usePreviewWorkTimeChange();
  const saveM = useSaveWorkTimeChange();
  const isSaving = saveM.isPending;

  const [validFrom, setValidFrom] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState<WorkTimeChangePreviewResponse | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [staleFailureCount, setStaleFailureCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  const validFromRef = useRef<HTMLInputElement>(null);
  const weeklyHoursRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);
  const prefillAppliedRef = useRef(false);

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
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setShowConfirm(false);
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
  const workScheduleKey = useMemo(() => JSON.stringify(workSchedule), [workSchedule]);

  /** Ruft die Vorschau serverseitig ab (D2) — die Antwort wird unveraendert in `preview`
   *  abgelegt, es wird nichts im Client nachgerechnet. */
  function requestPreview(vFrom: string, wHours: number, schedule: WorkSchedule | null) {
    setPreviewErrorMessage(null);
    previewM.mutate(
      { userId: user.id, validFrom: vFrom, weeklyHours: wHours, workSchedule: schedule },
      {
        onSuccess: (data) => {
          if (!data) return;
          setPreview(data);
          setFormError('');
        },
        onError: (error) => {
          const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
          if (message.includes('existiert bereits eine Periode')) {
            setFieldErrors((prev) => ({ ...prev, validFrom: message }));
          } else {
            setPreviewErrorMessage(
              'Die Vorschau konnte nicht berechnet werden. Ohne Vorschau lässt sich der Wechsel nicht speichern.'
            );
          }
        },
      }
    );
  }

  // Automatische, entprellte Vorschau (PREVIEW_DEBOUNCE_MS), sobald Stichtag und Wochenstunden gueltig sind.
  // Die Begruendung loest keine Neuberechnung aus (sie ist nicht Teil dieser Abhaengigkeit).
  useEffect(() => {
    if (!isOpen) return;
    if (!validFrom || weeklyHoursNum === null) return;

    const timer = setTimeout(() => {
      requestPreview(validFrom, weeklyHoursNum, workSchedule);
    }, PREVIEW_DEBOUNCE_MS);

    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, validFrom, weeklyHours, workScheduleKey]);

  function handleValidFromChange(e: ChangeEvent<HTMLInputElement>) {
    setValidFrom(e.target.value);
    // Verwerfen von Vorschau und Token im selben State-Update wie die Feldaenderung (nicht im
    // entprellten Callback) — sonst bliebe ein Zeitfenster mit veraltetem Token offen.
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, validFrom: undefined }));
  }

  function handleWeeklyHoursChange(e: ChangeEvent<HTMLInputElement>) {
    setWeeklyHours(e.target.value);
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, weeklyHours: undefined }));
  }

  function handleWorkScheduleChange(schedule: WorkSchedule | null) {
    setWorkSchedule(schedule);
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, workSchedule: undefined }));
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

    // CR-03: Tagesplan blockierend pruefen — dieselbe Grenze wie serverseitig (0-24).
    const invalidDay = findInvalidScheduleDay(workSchedule);
    if (invalidDay) {
      errors.workSchedule = `Die Tagesstunden müssen zwischen 0 und ${MAX_DAILY_HOURS} liegen (${DAY_LABELS_DE[invalidDay]}).`;
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
    if (errors.workSchedule) {
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
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setShowConfirm(false);
  }

  function handleClose() {
    if (isSaving) return;
    resetForm();
    onClose();
  }

  /** Speichert unter Bezug auf das gebundene `previewToken` (T-12-24). Zustand 13/14. */
  async function performSave() {
    if (!preview) return;
    const savedWeeklyHours = Number(weeklyHours);
    try {
      setFormError('');
      const result = await saveM.mutateAsync({
        userId: user.id,
        validFrom,
        weeklyHours: savedWeeklyHours,
        workSchedule,
        reason: reason.trim(),
        previewToken: preview.previewToken,
      });
      setStaleFailureCount(0);
      resetForm();
      if (result) {
        onSaved?.(result);
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      if (message.startsWith('PREVIEW_STALE')) {
        const nextFailureCount = staleFailureCount + 1;
        setStaleFailureCount(nextFailureCount);
        if (nextFailureCount >= 2) {
          // Zustand 14, zweiter Fehlschlag in Folge: keine weitere automatische
          // Neuberechnung, Rueckfall in Zustand 5.
          setPreview(null);
          setPreviewErrorMessage(
            'Die Vorschau konnte nicht in einen speicherbaren Zustand gebracht werden. Bitte berechnen Sie sie erneut.'
          );
        } else {
          // Zustand 14, erster Fehlschlag: Banner + automatische Neuberechnung.
          setFormError(
            'Die Vorschau ist nicht mehr aktuell. Sie wird gerade neu berechnet — bitte prüfen Sie danach die Werte und speichern Sie erneut.'
          );
          setPreview(null);
          requestPreview(validFrom, savedWeeklyHours, workSchedule);
        }
      } else {
        // Zustand 13.
        setFormError(`Der Stundenwechsel wurde nicht gespeichert. Es wurde nichts verändert. ${message}`);
      }
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;
    if (!validateForm()) return;
    if (!preview || preview.isNoOp) return;
    if (preview.isRetroactive) {
      setShowConfirm(true);
      return;
    }
    void performSave();
  }

  function handleConfirmRetroactive() {
    setShowConfirm(false);
    void performSave();
  }

  function buildConfirmMessage(): string {
    if (!preview) return '';
    const name = `${user.firstName} ${user.lastName}`;
    const fromDate = formatGermanDate(preview.rangeStart);
    if (preview.balanceDelta === 0) {
      return `Für ${name} wird der Zeitraum vom ${fromDate} bis heute neu gerechnet. Der Überstundensaldo bleibt dabei unverändert. Die Periode wird trotzdem als eigener Eintrag festgehalten.`;
    }
    return `Für ${name} wird der Zeitraum vom ${fromDate} bis heute neu gerechnet. Der Überstundensaldo ändert sich dabei um ${formatSignedHours(preview.balanceDelta)} — von ${formatSignedHours(preview.balanceBefore)} auf ${formatSignedHours(preview.balanceAfter)}. Buchung und Begründung bleiben im Kontoauszug dauerhaft sichtbar.`;
  }

  function getPreviewPanelState(): PreviewPanelState {
    if (previewM.isPending) return 'loading';
    if (previewErrorMessage) return 'error';
    if (!validFrom || weeklyHoursNum === null || !preview) return 'placeholder';
    if (preview.isNoOp) return 'noop';
    return preview.isRetroactive ? 'past' : 'future';
  }

  const previewPanelState = getPreviewPanelState();

  const previewPanelVariantClasses: Record<PreviewPanelState, string> = {
    placeholder: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    loading: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
    noop: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    future: 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800',
    past: 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800',
  };

  function renderPreviewIcon(state: PreviewPanelState) {
    if (state === 'future') {
      return <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />;
    }
    if (state === 'past') {
      return <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />;
    }
    if (state === 'error') {
      return <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />;
    }
    if (state === 'noop') {
      return <Info className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />;
    }
    return null;
  }

  const primaryButtonDisabled = !preview || preview.isNoOp || isSaving;
  const primaryButtonLabel = preview?.isRetroactive ? 'Rückwirkend speichern' : 'Stundenwechsel speichern';

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
          {fieldErrors.workSchedule && (
            <p className="text-sm text-red-600 dark:text-red-400" role="alert">
              {fieldErrors.workSchedule}
            </p>
          )}
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

        {/* 6. Vorschaupanel (REQ-27) — Zustaende 3-8, 10 */}
        <div
          role="status"
          aria-live="polite"
          aria-busy={previewM.isPending}
          className={`rounded-lg border p-4 space-y-3 ${previewPanelVariantClasses[previewPanelState]}`}
        >
          <div className="flex items-center gap-2">
            {renderPreviewIcon(previewPanelState)}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Was diese Umstellung bewirkt
            </h3>
            {previewPanelState === 'future' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                Keine Rückwirkung
              </span>
            )}
            {previewPanelState === 'past' && (
              <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300">
                Rückwirkend
              </span>
            )}
          </div>

          {previewPanelState === 'placeholder' && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Die Vorschau erscheint, sobald Stichtag und neue Wochenstunden gesetzt sind.
            </p>
          )}

          {previewPanelState === 'loading' && (
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Vorschau wird berechnet …
              </span>
            </div>
          )}

          {previewPanelState === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-900 dark:text-red-100">{previewErrorMessage}</p>
              <Button
                type="button"
                variant="secondary"
                onClick={() =>
                  weeklyHoursNum !== null && requestPreview(validFrom, weeklyHoursNum, workSchedule)
                }
              >
                Vorschau erneut berechnen
              </Button>
            </div>
          )}

          {previewPanelState === 'noop' && preview && (
            <p className="text-sm text-gray-600 dark:text-gray-400">
              Die eingegebenen Werte entsprechen der aktuell gültigen Periode ab{' '}
              {formatGermanDate(preview.currentPeriod?.validFrom ?? preview.validFrom)}. Es gibt nichts umzustellen — ändern Sie die Wochenstunden oder den Tagesplan.
            </p>
          )}

          {(previewPanelState === 'future' || previewPanelState === 'past') && preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                {previewPanelState === 'future'
                  ? `Wirksam ab ${formatGermanDate(preview.validFrom)}. Bis dahin ändert sich keine Minute.`
                  : `Neu gerechnet wird vom ${formatGermanDate(preview.rangeStart)} bis heute (${formatGermanDate(preview.rangeEnd)}) — ${preview.workingDaysInRange} Arbeitstage. Alles vor dem ${formatGermanDate(preview.rangeStart)} bleibt unverändert.`}
              </p>

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Sollstunden im Zeitraum
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">bisher</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatSignedHours(preview.targetHoursBefore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">neu</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatSignedHours(preview.targetHoursAfter)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">Differenz</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatSignedHours(preview.targetHoursDelta)}
                    </p>
                  </div>
                </div>
              </div>

              <p className="text-sm text-gray-700 dark:text-gray-300">
                Überstundensaldo heute {formatSignedHours(preview.balanceBefore)} → nach der
                Umstellung {formatSignedHours(preview.balanceAfter)}
              </p>

              <div className="flex items-center gap-2">
                {preview.balanceDelta >= 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : (
                  <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                )}
                <span
                  className={`text-lg font-bold ${
                    preview.balanceDelta >= 0
                      ? 'text-green-600 dark:text-green-400'
                      : 'text-red-600 dark:text-red-400'
                  }`}
                >
                  Änderung des Überstundensaldos: {formatSignedHours(preview.balanceDelta)}
                </span>
              </div>

              {preview.midMonthEffective && (
                <p className="text-xs text-gray-500 dark:text-gray-400">
                  Der Stichtag liegt innerhalb des Monats {formatGermanMonthYear(preview.validFrom)}.
                  Für {formatGermanDayMonth(preview.validFrom)} bis Monatsende gilt bereits das neue
                  Modell, davor das alte.
                </p>
              )}
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Der bereits angesparte Saldo wird nicht umgerechnet — Stunden bleiben Stunden. Die
            Änderung entsteht allein daraus, dass im neu gerechneten Zeitraum ein anderes
            Tagessoll gilt.
          </p>
        </div>

        {/* 7. Aktionszeile */}
        <div className="flex justify-end gap-3">
          <Button type="button" variant="secondary" onClick={handleClose} disabled={isSaving}>
            Abbrechen
          </Button>
          <Button type="submit" variant="primary" disabled={primaryButtonDisabled}>
            {isSaving ? (
              <>
                <LoadingSpinner size="sm" className="mr-2" />
                Wird gespeichert …
              </>
            ) : (
              primaryButtonLabel
            )}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmRetroactive}
        title="Rückwirkende Umstellung bestätigen"
        message={buildConfirmMessage()}
        confirmText="Ja, rückwirkend umstellen"
        cancelText="Zurück zur Vorschau"
        variant="warning"
        zIndexClass="z-[70]"
      />
    </Modal>
  );
}
