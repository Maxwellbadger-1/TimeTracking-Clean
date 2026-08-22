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
import { useCorrectWorkPeriodPreview, useCorrectWorkPeriod } from '../../hooks/useWorkTimeChange';
import { formatHours } from '../../utils/timeUtils';
import { getTodayDate } from '../../utils';
import {
  isRetroactivePeriod,
  primaryButtonLabel,
  isPrimaryDisabled,
  validateCorrectionForm,
} from './workTimePeriodEditRules';
import type {
  User,
  WorkSchedule,
  WorkTimePeriod,
  WorkPeriodCorrectionPreviewResponse,
  WorkPeriodCorrectionOutcome,
} from '../../types';

/**
 * Der Korrektur-Dialog (Phase 13, D1/REQ-30/REQ-31). `13-UI-SPEC.md` Abschnitt 2 ist der
 * bindende Designvertrag: Textbuch "Korrektur-Dialog"/"Vorschaupanel"/"Korrekturbestätigung",
 * Zustände 5-17.
 *
 * DD-32 (13-08-PLAN.md): Diese Komponente wird sowohl von der Zeilenaktion "Korrigieren" als
 * auch vom Block-Button "Stammdaten rückwirkend korrigieren …" geöffnet (Plan 13-09 wählt die
 * vorbelegte Periode) — sie kennt diesen Unterschied nicht, sie bekommt nur `period`.
 *
 * DD-33: Vorbelegung aus einer BESTEHENDEN Periode (`period`-Prop), nicht aus `user` wie
 * `WorkTimeChangeModal` — Muster: `useEffect`, der bei Prop-Wechsel synchronisiert
 * (`VacationBalanceEditModal.tsx:60-67`).
 *
 * DD-34: Arbeitstage, Sollstunden und Saldodifferenz werden NIE hier bestimmt — sie kommen
 * ausschließlich aus der Server-Vorschau (`useCorrectWorkPeriodPreview`/`useCorrectWorkPeriod`,
 * Plan 13-07). Solange keine Vorschau vorliegt, wird der Zeitraum aus `period.validFrom`/
 * `period.validTo` benannt, die Arbeitstageangabe bleibt weg.
 */

const PREVIEW_DEBOUNCE_MS = 400;

/** Gegenstück zur Servermeldung aus `translateWorkPeriodError()` (Plan 13-05) — Präfix mit
 *  Vertragscharakter, wortgleiches Muster wie in `WorkTimeChangeModal.tsx`. */
const PREVIEW_STALE_PREFIX = 'PREVIEW_STALE';

function isPreviewStaleMessage(message: string): boolean {
  return message.startsWith(PREVIEW_STALE_PREFIX);
}

/** Server: `requireAdmin` antwortet mit `'Forbidden - Admin access required'` (403). Der
 *  globale Fehler-Toast ist für `/work-periods*` unterdrückt — dieser Dialog muss die
 *  Aussage deshalb selbst tragen. */
function isForbiddenMessage(message: string): boolean {
  return message.startsWith('Forbidden');
}

interface WorkTimePeriodEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
  /** Die zu korrigierende Periode — Träger der Vorbelegung (DD-33). */
  period: WorkTimePeriod;
  /** Vorperiode in der Kette, oder `null` bei der ersten Periode — Nachbarschaftsgrenze. */
  previousPeriod: WorkTimePeriod | null;
  /** Folgeperiode in der Kette, oder `null` bei der letzten Periode — Nachbarschaftsgrenze. */
  nextPeriod: WorkTimePeriod | null;
  /** Zustand 10-Äquivalent: hebt die kollidierende Nachbarzeile in der Liste hervor. */
  onConflict?: (periodId: number | null) => void;
  onSaved: (outcome: WorkPeriodCorrectionOutcome) => void;
}

interface FieldErrors {
  validFrom?: string;
  weeklyHours?: string;
  reason?: string;
}

/** Gegenstück zu `MAX_DAILY_HOURS` in `server/src/utils/workSchedule.ts`. */
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

/** CR-03-Muster aus Phase 12: Tagesplansumme blockierend prüfen (0-24 je Tag). */
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

/** E-3-Muster aus Phase 12: `stale` ist der Wartezustand zwischen dem synchronen Verwerfen der
 *  Vorschau und der entprellten Antwort — derselbe Anzeigetext wie `loading`, aber kein
 *  Rückfall auf den Platzhaltersatz, solange die Eingaben vollständig sind. */
type PreviewPanelState = 'placeholder' | 'stale' | 'loading' | 'error' | 'future' | 'past';

/** Anzeige eines ISO-Datums im deutschen Format — niemals über die UTC-Split-Methode aus
 *  `.claude/CLAUDE.md` ("Timezone bugs!"). */
function formatGermanDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

function formatWeeklyHoursDe(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** `null` bei leerem/ungültigem/außerhalb-0-60-Wert, sonst die geparste Zahl. */
function parseWeeklyHoursValue(value: string): number | null {
  if (value === '') return null;
  const num = Number(value);
  if (!Number.isFinite(num)) return null;
  if (num < 0 || num > 60) return null;
  return num;
}

/** Vorzeichenbehaftete Stundenanzeige. Randfall Differenz = 0: "± 0:00h" (Muster aus
 *  `WorkTimeChangeModal.tsx`/`overtimeTransactionFormat.ts`). */
function formatSignedHours(value: number): string {
  if (value === 0) return '± 0:00h';
  return `${value > 0 ? '+' : ''}${formatHours(value)}`;
}

/** Gray-Styling für schreibgeschützte Felder — wortgleiche Klassen wie das schreibgeschützte
 *  Stundenfeld aus Phase 12 (`EditUserModal.tsx`). */
const READONLY_INPUT_CLASS =
  'bg-gray-100 dark:bg-gray-900 text-gray-600 dark:text-gray-400 cursor-not-allowed hover:!border-gray-300 dark:hover:!border-gray-600 hover:!shadow-sm';

export function WorkTimePeriodEditModal({
  isOpen,
  onClose,
  user,
  period,
  previousPeriod,
  nextPeriod,
  onConflict,
  onSaved,
}: WorkTimePeriodEditModalProps) {
  const previewM = useCorrectWorkPeriodPreview();
  const saveM = useCorrectWorkPeriod();
  const isSaving = saveM.isPending;

  const [validFrom, setValidFrom] = useState('');
  const [weeklyHours, setWeeklyHours] = useState('');
  const [workSchedule, setWorkSchedule] = useState<WorkSchedule | null>(null);
  const [reason, setReason] = useState('');
  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});
  const [formError, setFormError] = useState('');
  const [preview, setPreview] = useState<WorkPeriodCorrectionPreviewResponse | null>(null);
  const [previewErrorMessage, setPreviewErrorMessage] = useState<string | null>(null);
  const [staleFailureCount, setStaleFailureCount] = useState(0);
  const [showConfirm, setShowConfirm] = useState(false);

  /** WR-03-Muster aus Phase 12: laufende Nummer der Vorschauanfragen, verhindert dass eine
   *  langsamere, ältere Antwort eine frischere überschreibt. */
  const previewSeqRef = useRef(0);

  const validFromRef = useRef<HTMLInputElement>(null);
  const weeklyHoursRef = useRef<HTMLInputElement>(null);
  const reasonRef = useRef<HTMLTextAreaElement>(null);

  /** WR-19-Muster aus Phase 12: bei jedem Render neu bestimmt, nicht `useMemo(..., [])` —
   *  die Tauri-Anwendung bleibt üblicherweise über Nacht offen. */
  const todayStr = getTodayDate();

  const hireDate = user.hireDate || null;

  // DD-33: Vorbelegung aus der PERIODE (nicht aus `user`) bei jedem Öffnen bzw. Prop-Wechsel —
  // Muster `VacationBalanceEditModal.tsx:60-67`. Anfangsfokus auf "Gültig ab", oder auf
  // "Wochenstunden", wenn "Gültig ab" gesperrt ist (erste Periode) — der Fokus darf nie auf
  // einem readOnly-Feld landen.
  useEffect(() => {
    if (!isOpen) return;
    setValidFrom(period.validFrom);
    setWeeklyHours(String(period.weeklyHours));
    setWorkSchedule(period.workSchedule);
    setReason('');
    setFieldErrors({});
    setFormError('');
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setShowConfirm(false);
    if (period.isFirst) {
      weeklyHoursRef.current?.focus();
    } else {
      validFromRef.current?.focus();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, period.id]);

  const weeklyHoursNum = parseWeeklyHoursValue(weeklyHours);
  const workScheduleKey = useMemo(() => JSON.stringify(workSchedule), [workSchedule]);

  /**
   * "rückwirkend ja/nein" für Panel-/Knopfsteuerung: reiner Zeichenkettenvergleich auf den
   * aktuell eingegebenen Beginn (`isRetroactivePeriod()`, `workTimePeriodEditRules.ts`) — die
   * BUSINESS-Zahlen (Arbeitstage, Sollstunden, Saldo) kommen unverändert aus der Vorschau
   * (DD-34); diese boolesche Weiche ist reine Formularsteuerung.
   */
  const isRetroactive = isRetroactivePeriod(validFrom, todayStr);

  /** Ruft die Vorschau serverseitig ab — die Antwort wird unverändert in `preview` abgelegt. */
  function requestPreview(vFrom: string, wHours: number, schedule: WorkSchedule | null) {
    const seq = ++previewSeqRef.current;
    setPreviewErrorMessage(null);
    previewM.mutate(
      { periodId: period.id, input: { validFrom: vFrom, weeklyHours: wHours, workSchedule: schedule } },
      {
        onSuccess: (data) => {
          if (seq !== previewSeqRef.current || !data) return;
          setPreview(data);
          setFormError('');
        },
        onError: () => {
          if (seq !== previewSeqRef.current) return;
          setPreviewErrorMessage(
            'Die Vorschau konnte nicht berechnet werden. Ohne Vorschau lässt sich die Korrektur nicht speichern.'
          );
        },
      }
    );
  }

  // Automatische, entprellte Vorschau (PREVIEW_DEBOUNCE_MS). Die Begründung ist nicht Teil
  // dieser Abhängigkeit — sie löst keine Neuberechnung aus.
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
    // Verwerfen von Vorschau und Token im selben State-Update wie die Feldänderung (T-12-28),
    // nicht erst im entprellten Callback.
    previewSeqRef.current += 1;
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setFormError('');
    setFieldErrors((prev) => ({ ...prev, validFrom: undefined }));
    onConflict?.(null);
  }

  function handleWeeklyHoursChange(e: ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value;
    setWeeklyHours(raw);
    previewSeqRef.current += 1;
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setFormError('');
    const outOfRange =
      raw !== '' && (!Number.isFinite(Number(raw)) || Number(raw) < 0 || Number(raw) > 60);
    setFieldErrors((prev) => ({
      ...prev,
      weeklyHours: outOfRange ? 'Wochenstunden müssen zwischen 0 und 60 liegen' : undefined,
    }));
  }

  function handleWorkScheduleChange(schedule: WorkSchedule | null) {
    setWorkSchedule(schedule);
    previewSeqRef.current += 1;
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setFormError('');
  }

  function handleReasonChange(e: ChangeEvent<HTMLTextAreaElement>) {
    setReason(e.target.value);
    setFieldErrors((prev) => ({ ...prev, reason: undefined }));
  }

  /**
   * Zustand 9-Äquivalent: Meldungen wörtlich aus `13-UI-SPEC.md` → "Fehlermeldungen
   * (Validierung)". Die vier Feld-/Formularregeln kommen aus `validateCorrectionForm()`
   * (`workTimePeriodEditRules.ts`, Plan 13-08 Task 3) — diese Funktion führt sie nicht mehr
   * inline. Bei einer Überlappung mit der Nachbarperiode liefert `conflictPeriodId` die Id der
   * Nachbarzeile; `onConflict` hebt sie in der Liste hervor (Muster aus Phase 12).
   */
  function validateForm(): boolean {
    const result = validateCorrectionForm({
      validFrom,
      weeklyHoursRaw: weeklyHours,
      reason,
      workSchedule,
      isFirst: period.isFirst,
      hireDate,
      endDate: user.endDate || null,
      previousPeriod: previousPeriod
        ? { id: previousPeriod.id, validFrom: previousPeriod.validFrom }
        : null,
      nextPeriod: nextPeriod ? { id: nextPeriod.id, validFrom: nextPeriod.validFrom } : null,
      original: {
        validFrom: period.validFrom,
        weeklyHours: period.weeklyHours,
        workSchedule: period.workSchedule,
      },
    });

    const errors: FieldErrors = {
      validFrom: result.validFrom,
      weeklyHours: result.weeklyHours,
      reason: result.reason,
    };

    // CR-03-Muster aus Phase 12: Tagesplansumme blockierend prüfen (0-24 je Tag) — kein Teil
    // der vier reinen Entscheidungen aus workTimePeriodEditRules.ts, weil sie den
    // Tagesplan-Editor betrifft, nicht die Korrektur-Feldregeln selbst.
    if (!errors.weeklyHours) {
      const invalidDay = findInvalidScheduleDay(workSchedule);
      if (invalidDay) {
        errors.weeklyHours = `Die Tagesstunden müssen zwischen 0 und ${MAX_DAILY_HOURS} liegen (${DAY_LABELS_DE[invalidDay]}).`;
      }
    }

    setFieldErrors(errors);
    setFormError(result.formError ?? '');
    onConflict?.(result.conflictPeriodId ?? null);

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
    if (result.formError) {
      return false;
    }

    return true;
  }

  function resetForm() {
    setValidFrom(period.validFrom);
    setWeeklyHours(String(period.weeklyHours));
    setWorkSchedule(period.workSchedule);
    setReason('');
    setFieldErrors({});
    setFormError('');
    setPreview(null);
    setPreviewErrorMessage(null);
    setStaleFailureCount(0);
    setShowConfirm(false);
    onConflict?.(null);
  }

  function handleClose() {
    if (isSaving) return;
    resetForm();
    onClose();
  }

  /** Speichert unter Bezug auf das gebundene `previewToken` (T-13-34). */
  async function performSave() {
    if (!preview) return;
    const savedWeeklyHours = Number(weeklyHours);
    try {
      setFormError('');
      const outcome = await saveM.mutateAsync({
        periodId: period.id,
        userId: period.userId,
        input: {
          periodId: period.id,
          validFrom,
          weeklyHours: savedWeeklyHours,
          workSchedule,
          reason: reason.trim(),
          previewToken: preview.previewToken,
        },
      });
      setStaleFailureCount(0);
      resetForm();
      if (outcome) {
        onSaved(outcome);
      }
      onClose();
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      if (isPreviewStaleMessage(message)) {
        const nextFailureCount = staleFailureCount + 1;
        setStaleFailureCount(nextFailureCount);
        if (nextFailureCount >= 2) {
          setPreview(null);
          setPreviewErrorMessage(
            'Die Vorschau konnte nicht in einen speicherbaren Zustand gebracht werden. Bitte berechnen Sie sie erneut.'
          );
        } else {
          setFormError(
            'Die Vorschau ist nicht mehr aktuell. Sie wurde neu berechnet — bitte prüfen Sie die Werte und speichern Sie erneut.'
          );
          setPreview(null);
          requestPreview(validFrom, savedWeeklyHours, workSchedule);
        }
      } else if (isForbiddenMessage(message)) {
        setFormError('Ihnen fehlt die Berechtigung für diese Änderung. Es wurde nichts verändert.');
      } else {
        setFormError(`Die Korrektur wurde nicht gespeichert. Es wurde nichts verändert. ${message}`);
      }
    }
  }

  function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    e.stopPropagation();
    if (isSaving) return;
    if (!validateForm()) return;
    if (!preview) return;
    if (isRetroactive) {
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
    const fromDate = formatGermanDate(preview.rangeFrom);
    const toDate = formatGermanDate(preview.rangeTo);
    if (preview.balanceDelta === 0) {
      return `Für ${name} wird der Zeitraum vom ${fromDate} bis ${toDate} neu gerechnet. Der Überstundensaldo bleibt dabei unverändert. Die Korrektur wird trotzdem als eigener Eintrag festgehalten.`;
    }
    return `Für ${name} wird der Zeitraum vom ${fromDate} bis ${toDate} neu gerechnet. Der Überstundensaldo ändert sich dabei um ${formatSignedHours(preview.balanceDelta)} — von ${formatSignedHours(preview.balanceBefore)} auf ${formatSignedHours(preview.balanceAfter)}.`;
  }

  function getPreviewPanelState(): PreviewPanelState {
    if (previewM.isPending) return 'loading';
    if (previewErrorMessage) return 'error';
    if (!validFrom || weeklyHoursNum === null) return 'placeholder';
    if (!preview) return 'stale';
    return isRetroactive ? 'past' : 'future';
  }

  const previewPanelState = getPreviewPanelState();
  const previewPanelIsWaiting = previewPanelState === 'stale' || previewPanelState === 'loading';

  const previewPanelVariantClasses: Record<PreviewPanelState, string> = {
    placeholder: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    stale: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    loading: 'bg-gray-50 dark:bg-gray-800 border-gray-200 dark:border-gray-700',
    error: 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800',
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
    return null;
  }

  /** Zeitraumsatz im Warnbanner, Satz 1: aus der Vorschau, sonst aus der PERIODE selbst benannt
   *  (DD-34 — die Arbeitstageangabe bleibt dann weg, nicht geschätzt). */
  function buildWarningSentence1(): string {
    const name = `${user.firstName} ${user.lastName}`;
    if (preview) {
      return `Für ${name} wird der Zeitraum vom ${formatGermanDate(preview.rangeFrom)} bis ${formatGermanDate(preview.rangeTo)} neu gerechnet — das sind ${preview.workingDays} Arbeitstage.`;
    }
    const toText = period.validTo ? formatGermanDate(period.validTo) : 'offen';
    return `Für ${name} wird der Zeitraum vom ${formatGermanDate(period.validFrom)} bis ${toText} neu gerechnet.`;
  }

  function buildWarningSentence2(): string {
    const boundary = preview ? preview.rangeFrom : period.validFrom;
    return `Die für diesen Zeitraum bereits gebuchten Überstunden werden ersetzt. Alles vor dem ${formatGermanDate(boundary)} bleibt unverändert.`;
  }

  const primaryButtonLabelText = primaryButtonLabel(isRetroactive);
  const primaryButtonDisabled = isPrimaryDisabled({
    hasPreviewToken: !!preview,
    isSaving,
    trimmedReasonLength: reason.trim().length,
  });

  return (
    <Modal
      isOpen={isOpen}
      onClose={isSaving ? () => {} : handleClose}
      size="lg"
      zIndexClass="z-[60]"
      title={`Periode korrigieren: ${user.firstName} ${user.lastName}`}
    >
      <form onSubmit={handleSubmit} className="space-y-6">
        {/* 1. Periodenkennung */}
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Periode vom {formatGermanDate(period.validFrom)} bis{' '}
          {period.validTo ? formatGermanDate(period.validTo) : 'offen'} · derzeit{' '}
          {formatWeeklyHoursDe(period.weeklyHours)} h/Woche
        </p>

        {/* 2. Warnbanner — immer sichtbar (T-13-35) */}
        <div
          role="status"
          aria-live="polite"
          className={`rounded-lg border p-4 space-y-2 ${
            isRetroactive
              ? 'bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800'
              : 'bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-800'
          }`}
        >
          {isRetroactive ? (
            <>
              <div className="flex items-center gap-2">
                <AlertTriangle className="w-5 h-5 text-amber-600 dark:text-amber-400 flex-shrink-0" />
                <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
                  Das ändert die Vergangenheit
                </h3>
              </div>
              <p className="text-sm text-gray-700 dark:text-gray-300">{buildWarningSentence1()}</p>
              <p className="text-sm text-gray-700 dark:text-gray-300">{buildWarningSentence2()}</p>
            </>
          ) : (
            <div className="flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600 dark:text-blue-400 flex-shrink-0" />
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Diese Periode beginnt erst am {formatGermanDate(validFrom || period.validFrom)}. Es
                wird nichts rückwirkend geändert.
              </p>
            </div>
          )}
          <p className="text-sm text-gray-700 dark:text-gray-300">
            Hat sich die Arbeitszeit erst ab einem Datum geändert, ist das kein Korrekturfall:
            Brechen Sie ab und nutzen Sie „Stundenwechsel ab Datum …" — dann bleibt die
            Vergangenheit unberührt.
          </p>
        </div>

        {/* 3. Formularfehler-Banner */}
        {formError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-4 flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-red-900 dark:text-red-100">{formError}</p>
          </div>
        )}

        {/* 4. Gültig ab / Gültig bis */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <Input
            ref={validFromRef}
            label="Gültig ab"
            type="date"
            value={validFrom}
            onChange={handleValidFromChange}
            error={fieldErrors.validFrom}
            readOnly={period.isFirst}
            aria-readonly={period.isFirst ? 'true' : undefined}
            className={period.isFirst ? READONLY_INPUT_CLASS : undefined}
            helperText={
              period.isFirst
                ? `Die erste Periode beginnt immer am Eintrittsdatum (${formatGermanDate(period.validFrom)}) und kann nicht verschoben werden.`
                : 'Verschieben Sie den Beginn, verlängert oder verkürzt sich die Periode davor entsprechend — es entsteht keine Lücke.'
            }
            required
          />
          <Input
            label="Gültig bis"
            type="date"
            value={period.validTo ?? ''}
            readOnly
            aria-readonly="true"
            className={READONLY_INPUT_CLASS}
            helperText='Ergibt sich aus dem Beginn der nächsten Periode. Für die letzte Periode bleibt das Ende offen.'
          />
        </div>

        {/* 5. Wochenstunden */}
        <Input
          ref={weeklyHoursRef}
          label="Wochenstunden"
          type="number"
          min="0"
          max="60"
          step="0.5"
          value={weeklyHours}
          onChange={handleWeeklyHoursChange}
          error={fieldErrors.weeklyHours}
          helperText="0 h = Aushilfe (alle erfassten Stunden zählen als Überstunden)"
          required
        />

        {/* 6. Tagesplan */}
        <div className="space-y-3">
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Tagesplan dieser Periode
          </h3>
          <WorkScheduleEditor
            value={workSchedule}
            weeklyHours={weeklyHoursNum ?? 0}
            onChange={handleWorkScheduleChange}
            readOnly={false}
          />
        </div>

        {/* 7. Begründung */}
        <Textarea
          ref={reasonRef}
          label="Begründung (Pflicht)"
          value={reason}
          onChange={handleReasonChange}
          error={fieldErrors.reason}
          helperText={`${reason.length}/10 Zeichen (Minimum)`}
          rows={4}
          required
          placeholder="Warum war der bisherige Wert falsch? Zum Beispiel: Vertrag von Anfang an mit 30 h geschlossen, bei der Anlage 40 h eingetragen (mindestens 10 Zeichen)"
        />

        {/* 8. Vorschaupanel */}
        <div
          role="status"
          aria-live="polite"
          aria-busy={previewPanelIsWaiting}
          className={`rounded-lg border p-4 space-y-3 ${previewPanelIsWaiting ? 'min-h-56' : ''} ${previewPanelVariantClasses[previewPanelState]}`}
        >
          <div className="flex items-center gap-2">
            {renderPreviewIcon(previewPanelState)}
            <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
              Was diese Korrektur bewirkt
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
              Die Vorschau erscheint, sobald Wochenstunden und Beginn gesetzt sind.
            </p>
          )}

          {previewPanelIsWaiting && (
            <div className="flex items-center gap-2">
              <LoadingSpinner size="sm" />
              <span className="text-sm text-gray-600 dark:text-gray-400">
                Vorschau wird berechnet …
              </span>
            </div>
          )}

          {previewPanelState === 'error' && (
            <div className="space-y-3">
              <p className="text-sm text-red-900 dark:text-red-100">
                Die Vorschau konnte nicht berechnet werden. Ohne Vorschau lässt sich die
                Korrektur nicht speichern.
              </p>
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

          {(previewPanelState === 'future' || previewPanelState === 'past') && preview && (
            <div className="space-y-3">
              <p className="text-sm text-gray-700 dark:text-gray-300">
                Neu gerechnet wird vom {formatGermanDate(preview.rangeFrom)} bis{' '}
                {formatGermanDate(preview.rangeTo)} — {preview.workingDays} Arbeitstage.
              </p>

              {preview.previousPeriod && (
                <p className="text-sm text-gray-700 dark:text-gray-300">
                  Die Periode davor (ab {formatGermanDate(preview.previousPeriod.validFrom)},{' '}
                  {formatWeeklyHoursDe(preview.previousPeriod.weeklyHours)} h/Woche) endet dadurch am{' '}
                  {formatGermanDate(preview.previousPeriod.newValidTo)}.
                </p>
              )}

              <div>
                <p className="text-xs text-gray-500 dark:text-gray-400 mb-1">
                  Sollstunden im Zeitraum
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-sm">
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">bisher</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(preview.targetHoursBefore)}
                    </p>
                  </div>
                  <div>
                    <p className="text-gray-600 dark:text-gray-400">neu</p>
                    <p className="font-medium text-gray-900 dark:text-gray-100">
                      {formatHours(preview.targetHoursAfter)}
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

              <div className="flex items-center gap-2">
                {preview.balanceDelta > 0 ? (
                  <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
                ) : preview.balanceDelta < 0 ? (
                  <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
                ) : null}
                <span
                  className={`text-lg font-bold ${
                    preview.balanceDelta > 0
                      ? 'text-green-600 dark:text-green-400'
                      : preview.balanceDelta < 0
                      ? 'text-red-600 dark:text-red-400'
                      : 'text-gray-600 dark:text-gray-400'
                  }`}
                >
                  Änderung des Überstundensaldos: {formatSignedHours(preview.balanceDelta)}
                </span>
              </div>
            </div>
          )}

          <p className="text-xs text-gray-500 dark:text-gray-400">
            Der bereits angesparte Saldo wird nicht umgerechnet — Stunden bleiben Stunden. Die
            Änderung entsteht allein daraus, dass im neu gerechneten Zeitraum ein anderes
            Tagessoll gilt.
          </p>
        </div>

        {/* 9. Aktionszeile */}
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
              primaryButtonLabelText
            )}
          </Button>
        </div>
      </form>

      <ConfirmDialog
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        onConfirm={handleConfirmRetroactive}
        title="Rückwirkende Korrektur bestätigen"
        message={buildConfirmMessage()}
        details="Korrektur und Begründung bleiben im Kontoauszug dauerhaft sichtbar."
        confirmText="Ja, rückwirkend korrigieren"
        cancelText="Zurück zum Formular"
        variant="warning"
        zIndexClass="z-[70]"
      />
    </Modal>
  );
}
