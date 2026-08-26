import {
  useState,
  useMemo,
  FormEvent,
  useEffect,
  useRef,
  type ReactNode,
  type RefObject,
} from 'react';
import { toast } from 'sonner';
import { AlertTriangle, TrendingDown, TrendingUp } from 'lucide-react';
import { Modal } from '../ui/Modal';
import { Input } from '../ui/Input';
import { Select } from '../ui/Select';
import { Textarea } from '../ui/Textarea';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { WorkScheduleEditor } from './WorkScheduleEditor';
import { WorkTimeChangeModal } from '../worktime/WorkTimeChangeModal';
import { WorkTimePeriodList } from '../worktime/WorkTimePeriodList';
import { WorkTimePeriodEditModal } from '../worktime/WorkTimePeriodEditModal';
import { WorkTimePeriodActions } from '../worktime/workTimePeriodActions';
import {
  deleteConfirmTitle,
  deleteConfirmMessage,
  deleteDetailGapClosure,
  deleteDetailReversal,
  deleteDetailRebuildParts,
  deleteConfirmText,
  deleteCancelText,
  deleteConfirmAriaLabel,
  isDeleteConfirmDisabled,
} from '../worktime/workTimePeriodDeleteRules';
import { useUpdateUser } from '../../hooks';
import { useAuthStore } from '../../store/authStore';
import { useWorkPeriods, useDeleteWorkPeriodPreview, useDeleteWorkPeriod } from '../../hooks/useWorkTimeChange';
import { isValidEmail, getTodayDate } from '../../utils';
import { formatOvertimeHours } from '../../utils/timeUtils';
import type {
  User,
  WorkSchedule,
  WorkTimeChangeResult,
  WorkTimePeriod,
  WorkPeriodCorrectionOutcome,
  WorkPeriodDeletionPreviewResponse,
} from '../../types';

/** Wertvergleich zweier Tagesplaene — keine Objektidentitaet. Stabile Serialisierung ueber
 *  sortierte Schluessel, damit der Sync-Effekt (unten) nicht an der Objektidentitaet haengt,
 *  die bei jedem Refetch von `user` wechselt (12-UI-SPEC.md, Aenderungstabelle B). */
function serializeWorkSchedule(schedule: WorkSchedule | null): string {
  if (!schedule) return 'null';
  const sortedKeys = Object.keys(schedule).sort() as Array<keyof WorkSchedule>;
  return JSON.stringify(sortedKeys.map((key) => [key, schedule[key]]));
}

/**
 * Phase 13 (D1/REQ-30/REQ-31): Textbausteine des Korrektur-/Löschblocks. Zeitzonen-sichere
 * Anzeige eines ISO-Datums — niemals über die UTC-Split-Methode aus `.claude/CLAUDE.md`
 * ("Timezone bugs!").
 */
function formatPeriodDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE');
}

function formatPeriodWeeklyHours(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

/** `null` steht für eine offen bleibende (unbefristete) Periode — Textbuch behandelt diesen
 *  Randfall nicht ausdrücklich (siehe workTimePeriodDeleteRules.ts, deleteDetailGapClosure). */
function formatPeriodBoundary(iso: string | null): string {
  return iso ? formatPeriodDate(iso) : 'offen';
}

/** Server: `requireAdmin` antwortet mit 'Forbidden - Admin access required' (403). Der globale
 *  Fehler-Toast ist für `/work-periods*` unterdrückt — die Dialoge müssen die Aussage selbst
 *  tragen (Muster aus `WorkTimePeriodEditModal.tsx`). */
function isForbiddenPeriodMessage(message: string): boolean {
  return message.startsWith('Forbidden');
}

/** Server (`workPeriodDeletionService.ts`, `validateDeletionInput`): wortgleicher Satz bei
 *  umgangener Oberfläche (Zustand 23 — die erste Periode kann serverseitig nicht gelöscht
 *  werden, auch wenn die Zeile clientseitig gar keinen Löschknopf zeigt). */
function isFirstPeriodDeletionMessage(message: string): boolean {
  return message === 'Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen.';
}

/** WR-01-Muster aus Phase 12 („ein interner Code in der Oberfläche einer Personalverwaltung
 *  steht in keinem Textbuch"): Das Lösch-Token gilt 15 Minuten, die Vorschau wird beim Öffnen
 *  des Dialogs genau einmal geholt — und der Dialog verlangt danach noch eine Begründung mit
 *  mindestens 10 Zeichen. Bleibt er lange offen, antwortet `DELETE /api/work-periods/:id` mit
 *  409 und `'PREVIEW_STALE: …'`. Ohne eigenen Zweig landete dieser interne Code im Fließtext
 *  für den Anwender (WR-02, Code-Review Phase 13). Gegenstück zu
 *  `WorkTimePeriodEditModal.isPreviewStaleMessage()`. */
const PREVIEW_STALE_PREFIX = 'PREVIEW_STALE';

function isPreviewStalePeriodMessage(message: string): boolean {
  return message.startsWith(PREVIEW_STALE_PREFIX);
}

interface EditUserModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: User;
}

export function EditUserModal({ isOpen, onClose, user }: EditUserModalProps) {
  const updateUser = useUpdateUser();

  // Phase 13 (T-13-41): `renderActions` wird WorkTimePeriodList nur bei isAdmin uebergeben —
  // die eigentliche Durchsetzung liegt serverseitig (Plan 13-05, requireAdmin auf allen
  // Perioden-Endpunkten); dieser Client-Check ist Bequemlichkeit, kein Schutz. In der Praxis
  // ist EditUserModal ohnehin nur ueber UserManagementPage erreichbar, die selbst schon
  // `user.role === 'admin'` verlangt (App.tsx) — dieser zweite Check ist defensiv.
  const { user: currentUser } = useAuthStore();
  const isAdmin = currentUser?.role === 'admin';

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
  /** WR-08: ersetzt das wirkungslose `alert()` — Browserdialoge funktionieren in Tauri
   *  nicht (`ConfirmDialog.tsx` haelt genau das fest). */
  const [endDateError, setEndDateError] = useState('');

  // Phase 12 (D1): Einstieg in den Stundenwechsel-Dialog
  const [isChangeModalOpen, setIsChangeModalOpen] = useState(false);
  const changeButtonRef = useRef<HTMLButtonElement>(null);
  /** WR-11: Zustand 10 — Id der Periode, deren Stichtag mit der Eingabe im Wechsel-Dialog
   *  kollidiert. Wird von dort ueber `onConflict` gemeldet und an die Periodenliste
   *  weitergereicht.
   *
   *  F-8 (Phase 14.2, Plan 09) — Lebensdauer der Markierung, an EINER Stelle nachlesbar.
   *  Gesetzt wird sie von:
   *    - `WorkTimeChangeModal` (`onConflict`), sobald der Server oder die Formularpruefung
   *      einen bereits belegten Stichtag meldet;
   *    - `WorkTimePeriodEditModal` (`onConflict`), im Korrektur-Dialog.
   *  Zurueckgenommen wird sie von:
   *    - dem kollisionsfreien Vorschauerfolg im Wechsel-Dialog (`requestPreview.onSuccess`);
   *    - dem Erfolgspfad nach dem Speichern (`onSaved` unten und `performSave` im Dialog) —
   *      die Kollision ist dann aufgeloest;
   *    - `handleClose` dieses Dialogs, als Endstelle, damit die Markierung nicht ueber die
   *      ganze Sitzung haengen bleibt.
   *  NICHT mehr zurueckgenommen wird sie beim blossen Schliessen des Wechsel-Dialogs. Genau
   *  das war der Befund: Die Liste liegt strukturell unter dem Wechsel-Dialog (`z-[60]`
   *  ueber `z-50`), also ist der geschlossene Dialog der erste Moment, in dem die Markierung
   *  ueberhaupt sichtbar werden kann. Gemessener Ausgangsbefund (14-U6 Punkt 3): nach dem
   *  Schliessen `bg rgba(0,0,0,0)`, `borderLeft 0px`. */
  const [conflictPeriodId, setConflictPeriodId] = useState<number | null>(null);
  const [successBanner, setSuccessBanner] = useState<{ validFrom: string; weeklyHours: number } | null>(null);

  /**
   * WR-17 (Code-Review Phase 12): Der 8-Sekunden-Timer des Erfolgsbanners wurde nirgends
   * festgehalten und nirgends abgeraeumt. Speicherte der Admin binnen 8 Sekunden einen
   * zweiten Stundenwechsel, loeschte der Timer des ERSTEN das Banner des ZWEITEN nach der
   * Restlaufzeit — im Extremfall nach 200 ms, obwohl Zustand 15 des UI-Vertrags 8 s
   * zusichert. Und beim Schliessen des Modals innerhalb der 8 Sekunden feuerte der Timer
   * auf eine abgemeldete Komponente. Der Timer liegt jetzt in einer Ref, wird vor jedem
   * Neusetzen geloescht und beim Abmelden aufgeraeumt.
   */
  const bannerTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (bannerTimerRef.current !== null) {
        window.clearTimeout(bannerTimerRef.current);
        bannerTimerRef.current = null;
      }
    },
    []
  );

  // Phase 13 (D1/REQ-30/REQ-31): Perioden fuer die Korrektur-/Loeschsteuerung. Derselbe
  // Query-Key wie in WorkTimePeriodList (['work-periods', userId]) — TanStack Query
  // dedupliziert, kein zusaetzlicher Serveraufruf. `enabled: false` fuer Nicht-Admins
  // (useWorkPeriods(null)).
  const { data: periods, error: periodsLoadError } = useWorkPeriods(isAdmin ? user.id : null);
  const periodsAscending = useMemo(() => {
    if (!periods) return [];
    return [...periods].sort((a, b) => (a.validFrom < b.validFrom ? -1 : a.validFrom > b.validFrom ? 1 : 0));
  }, [periods]);
  /** DD-37: der Block-Knopf oeffnet die heute gueltige Periode, ersatzweise die erste —
   *  existiert keine Periode, ist der Block ausgeblendet (Zustand 4). */
  const blockTargetPeriod =
    periodsAscending.find((p) => p.isCurrent) ?? periodsAscending.find((p) => p.isFirst) ?? null;

  /**
   * M-4 (UI-Review Phase 13): Zustand 2 des Designvertrags — „Periodenliste Ladefehler →
   * Korrekturblock bleibt sichtbar, aber sein Button ist `disabled`".
   *
   * Gebaut war das Gegenteil: Der Block hing allein an `blockTargetPeriod`, und das ist bei
   * jedem Ladefehler `null` (`periods` bleibt `undefined`). Mit dem Block verschwanden
   * Überschrift, Erklärsatz UND der Abgrenzungssatz, der „Stundenwechsel" von „Korrektur"
   * trennt — ausgerechnet in dem Moment, in dem die Liste daneben einen roten Fehler zeigt.
   * Das dafür vorgesehene `disabled={!!periodsLoadError}` am Knopf war damit toter Code: Es
   * konnte nie zugleich einen Fehler und ein Ziel geben.
   *
   * ZUSTAND 3 IST KEIN LADEFEHLER: Bei einem 403 meldet `useWorkPeriods()` `FORBIDDEN`
   * (DD-31), die Liste zeigt das Panel „Kein Zugriff", und dort verlangt der Vertrag
   * ausdrücklich „kein Korrekturblock". Dieser Fall bleibt deshalb ausgenommen.
   */
  const periodsAccessDenied = periodsLoadError?.message === 'FORBIDDEN';
  const periodsLoadFailed = !!periodsLoadError && !periodsAccessDenied;

  function neighborsOfPeriod(period: WorkTimePeriod): {
    previousPeriod: WorkTimePeriod | null;
    nextPeriod: WorkTimePeriod | null;
  } {
    const idx = periodsAscending.findIndex((p) => p.id === period.id);
    if (idx === -1) return { previousPeriod: null, nextPeriod: null };
    return {
      previousPeriod: idx > 0 ? periodsAscending[idx - 1] : null,
      nextPeriod: idx < periodsAscending.length - 1 ? periodsAscending[idx + 1] : null,
    };
  }

  // Korrektur-Dialog (DD-32/DD-37): Zeilenaktion "Korrigieren" und der Block-Knopf teilen sich
  // denselben WorkTimePeriodEditModal — nur die Periodenauswahl unterscheidet sich.
  const [correctionPeriod, setCorrectionPeriod] = useState<WorkTimePeriod | null>(null);
  /** DD-39: welcher der drei Ausloeser den jeweiligen Dialog geoeffnet hat — bestimmt, wohin
   *  der Fokus nach dem Schliessen zurueckkehrt. */
  const [correctionTrigger, setCorrectionTrigger] = useState<'block' | 'row' | null>(null);
  const blockCorrectButtonRef = useRef<HTMLButtonElement>(null);

  /**
   * WR-13 (Code-Review Phase 13): EIN Ref-Objekt JE ZEILE, nicht eines für alle.
   *
   * Vorher bekam jede Zeile über `renderActions` DIESELBEN beiden Ref-Objekte mit. React weist
   * Ref-Objekte beim Mounten der Reihe nach zu — nach dem Rendern zeigte `current` auf die
   * Schaltfläche der ZULETZT gerenderten Zeile. Die Zusicherung DD-39 („der Aufrufer gibt den
   * Fokus an genau den Knopf zurück, der ihn geöffnet hat") war damit nicht eingelöst: der
   * Fokus landete immer auf der letzten Zeile.
   *
   * Die Map hält je Perioden-Id ein stabiles Ref-Objekt. Sie wird während des Renderns
   * befüllt; das ist unbedenklich, weil `getRowRef()` für dieselbe Id immer dasselbe Objekt
   * zurückgibt (kein neues Objekt je Render, sonst verlöre React die Zuordnung). Die Map ist
   * durch die Anzahl der Perioden EINES Nutzers begrenzt und lebt nur so lange wie dieser
   * Dialog.
   */
  const rowCorrectButtonRefs = useRef(new Map<number, RefObject<HTMLButtonElement | null>>());
  const rowDeleteButtonRefs = useRef(new Map<number, RefObject<HTMLButtonElement | null>>());

  function getRowRef(
    store: Map<number, RefObject<HTMLButtonElement | null>>,
    periodId: number
  ): RefObject<HTMLButtonElement | null> {
    const existing = store.get(periodId);
    if (existing) return existing;
    const created: RefObject<HTMLButtonElement | null> = { current: null };
    store.set(periodId, created);
    return created;
  }

  /** Fokussiert einen Knopf nur, wenn er noch im Dokument hängt. Nach dem Löschen ist die
   *  Zeile weg — dann bleibt die Fokusrückgabe von `useModalLayer` die einzige Zuständige,
   *  statt ins Leere zu greifen. */
  function focusIfPresent(ref: RefObject<HTMLButtonElement | null> | undefined): void {
    const node = ref?.current;
    if (node && document.body.contains(node)) {
      node.focus();
    }
  }

  // Löschbestätigung (DD-38): laedt ihre Vorschau beim Oeffnen, der Bestaetigungsknopf bleibt
  // gesperrt, bis sie vorliegt.
  const [deletionPeriod, setDeletionPeriod] = useState<WorkTimePeriod | null>(null);
  const [deletionPreview, setDeletionPreview] = useState<WorkPeriodDeletionPreviewResponse | null>(null);
  const [deletionPreviewFailed, setDeletionPreviewFailed] = useState(false);
  /** D7: Pflichtbegründung auch für das Löschen — der Server weist eine leere/zu kurze
   *  Begründung im Speicherpfad ab (`workPeriodDeletionService.ts`, `validateDeletionInput`,
   *  `dryRun === false`). 13-UI-SPEC.md zeigt dafür keinen eigenen Formularschritt; dieses Feld
   *  steht deshalb im `details`-Panel der Löschbestätigung — sonst wäre "Löschen" bei jedem
   *  echten Versuch ein serverseitiger 400 ("Begründung ist erforderlich"). */
  const [deletionReason, setDeletionReason] = useState('');
  /**
   * M-3 (UI-Review Phase 13): Feldfehler der Pflichtbegründung. Vorher sperrte eine zu kurze
   * Begründung den Bestätigungsknopf STUMM (`… || deletionReason.trim().length < 10`) — der
   * Admin sah einen grauen Knopf, der zugleich auch dann grau ist, wenn die Vorschau lädt oder
   * gescheitert ist: drei Ursachen, ein wortloser Knopf. Die Begründung wird deshalb jetzt im
   * Absendepfad geprüft, mit den beiden Sätzen aus dem Textbuch — dasselbe Muster wie im
   * Korrektur-Dialog (Zustand 11 des Designvertrags).
   */
  const [deletionReasonError, setDeletionReasonError] = useState('');
  const deletionReasonRef = useRef<HTMLTextAreaElement>(null);
  const [deletionError, setDeletionError] = useState('');
  /** WR-02 (Code-Review Phase 13): Zähler für aufeinanderfolgende PREVIEW_STALE-Antworten,
   *  wortgleiches Muster wie `staleFailureCount` im Korrektur-Dialog. Beim ersten Mal wird die
   *  Vorschau still neu berechnet; ab dem zweiten Mal endet die Schleife mit einer Aufforderung
   *  an den Anwender, statt endlos weiterzurechnen. */
  const [deletionStaleFailureCount, setDeletionStaleFailureCount] = useState(0);
  const deletePreviewM = useDeleteWorkPeriodPreview();
  const deleteM = useDeleteWorkPeriod();

  /** Punkt 2 (Storno) und Punkt 3 (Saldoänderung) der `details`-Liste kommen beide aus
   *  derselben Server-Vorschau — anders als DD-38 nahelegt ("Punkt 1 und Punkt 2 stehen schon
   *  vorher"), ist der stornierte Betrag (`reversedTransactions`) dem Client vor der Vorschau
   *  nicht bekannt (keine Transaktions-Referenz auf `WorkTimePeriod`). Punkt 1 (Lückenschluss)
   *  IST vorher bekannt, weil `newValidTo` der Vorperiode nach D3 exakt `deletionPeriod.validTo`
   *  ist — hier abweichend von DD-38 umgesetzt und in der SUMMARY vermerkt. */
  const deletionPreviewState: 'loading' | 'error' | 'ready' = deletionPreviewFailed
    ? 'error'
    : deletionPreview
      ? 'ready'
      : 'loading';

  // Gemeinsames gruenes Erfolgsbanner fuer Korrektur/Loeschen — eigener Zustand und Timer,
  // getrennt vom Stundenwechsel-Banner oben (WR-17-Muster, Zeile 66-83).
  const [periodBanner, setPeriodBanner] = useState<string | null>(null);
  const periodBannerTimerRef = useRef<number | null>(null);
  useEffect(
    () => () => {
      if (periodBannerTimerRef.current !== null) {
        window.clearTimeout(periodBannerTimerRef.current);
        periodBannerTimerRef.current = null;
      }
    },
    []
  );

  function showPeriodBanner(text: string) {
    setPeriodBanner(text);
    if (periodBannerTimerRef.current !== null) {
      window.clearTimeout(periodBannerTimerRef.current);
    }
    periodBannerTimerRef.current = window.setTimeout(() => {
      periodBannerTimerRef.current = null;
      setPeriodBanner(null);
    }, 8000);
  }

  /** WR-13: `periodId` bestimmt, WELCHE Zeile den Fokus zurückbekommt — nicht mehr „die
   *  zuletzt gerenderte". */
  function focusCorrectionTrigger(trigger: 'block' | 'row' | null, periodId: number | null) {
    if (trigger === 'block') {
      focusIfPresent(blockCorrectButtonRef);
      return;
    }
    if (periodId !== null) {
      focusIfPresent(rowCorrectButtonRefs.current.get(periodId));
    }
  }

  function openCorrectionFromBlock() {
    if (!blockTargetPeriod) return;
    setCorrectionTrigger('block');
    setCorrectionPeriod(blockTargetPeriod);
  }

  function openCorrectionFromRow(period: WorkTimePeriod) {
    setCorrectionTrigger('row');
    setCorrectionPeriod(period);
  }

  function closeCorrectionDialog() {
    const trigger = correctionTrigger;
    const periodId = correctionPeriod?.id ?? null;
    setCorrectionPeriod(null);
    setCorrectionTrigger(null);
    focusCorrectionTrigger(trigger, periodId);
  }

  function handleCorrectionSaved(outcome: WorkPeriodCorrectionOutcome) {
    const trigger = correctionTrigger;
    const periodId = correctionPeriod?.id ?? null;
    setCorrectionPeriod(null);
    setCorrectionTrigger(null);
    if (outcome.period) {
      showPeriodBanner(
        `Periode ab ${formatPeriodDate(outcome.period.validFrom)} korrigiert: jetzt ${formatPeriodWeeklyHours(
          outcome.period.weeklyHours
        )} h/Woche.`
      );
    }
    toast.success(
      outcome.preview.balanceDelta !== 0
        ? `Korrektur gespeichert — Saldoänderung ${formatOvertimeHours(outcome.preview.balanceDelta)} steht im Kontoauszug`
        : 'Korrektur gespeichert'
    );
    focusCorrectionTrigger(trigger, periodId);
  }

  function runDeletionPreview(periodId: number) {
    setDeletionPreviewFailed(false);
    deletePreviewM.mutate(
      { periodId },
      {
        onSuccess: (data) => {
          if (data) setDeletionPreview(data);
        },
        onError: () => {
          setDeletionPreviewFailed(true);
        },
      }
    );
  }

  function openDeletion(period: WorkTimePeriod) {
    setDeletionPeriod(period);
    setDeletionPreview(null);
    setDeletionPreviewFailed(false);
    setDeletionReason('');
    setDeletionReasonError('');
    setDeletionError('');
    setDeletionStaleFailureCount(0);
    runDeletionPreview(period.id);
  }

  function closeDeletionDialog() {
    if (deleteM.isPending) return;
    const closedPeriodId = deletionPeriod?.id ?? null;
    setDeletionPeriod(null);
    setDeletionPreview(null);
    setDeletionPreviewFailed(false);
    setDeletionReason('');
    setDeletionReasonError('');
    setDeletionError('');
    setDeletionStaleFailureCount(0);
    // WR-13: der Loeschknopf GENAU DIESER Zeile, nicht der der zuletzt gerenderten.
    focusIfPresent(closedPeriodId === null ? undefined : rowDeleteButtonRefs.current.get(closedPeriodId));
  }

  async function handleConfirmDeletion() {
    if (!deletionPeriod || !deletionPreview) return;

    // M-3: Pflichtbegründung im ABSENDEPFAD statt als stumme Sperre. Beide Sätze wörtlich aus
    // dem Textbuch (13-UI-SPEC.md, "Fehlermeldungen (Validierung)"), getrimmt geprüft — dieselbe
    // Zählweise wie der Zeichenzähler unter dem Feld und wie der Server
    // (`workPeriodDeletionService.validateDeletionInput()`). Kein Serveraufruf in diesem Fall.
    const trimmedDeletionReason = deletionReason.trim();
    if (trimmedDeletionReason.length < 10) {
      setDeletionReasonError(
        trimmedDeletionReason.length === 0
          ? 'Begründung ist erforderlich'
          : 'Begründung muss mindestens 10 Zeichen lang sein'
      );
      deletionReasonRef.current?.focus();
      return;
    }

    setDeletionError('');
    const deletedValidFrom = deletionPeriod.validFrom;
    try {
      const outcome = await deleteM.mutateAsync({
        periodId: deletionPeriod.id,
        userId: deletionPeriod.userId,
        input: {
          periodId: deletionPeriod.id,
          reason: trimmedDeletionReason,
          previewToken: deletionPreview.previewToken,
        },
      });
      setDeletionPeriod(null);
      setDeletionPreview(null);
      setDeletionPreviewFailed(false);
      setDeletionReason('');
      setDeletionReasonError('');
      setDeletionStaleFailureCount(0);
      if (outcome) {
        showPeriodBanner(
          `Periode vom ${formatPeriodDate(deletedValidFrom)} gelöscht. Die Periode ab ${formatPeriodDate(
            outcome.preview.previousPeriod.validFrom
          )} gilt jetzt bis zum ${formatPeriodBoundary(outcome.preview.previousPeriod.newValidTo)}.`
        );
      }
      toast.success('Periode gelöscht — Storno steht im Kontoauszug');
      // WR-13: KEIN manueller focus() nach erfolgreichem Loeschen. Die Zeile verschwindet
      // mit dem naechsten Refetch — das Ref zeigte danach auf einen Knopf, den es nicht
      // mehr gibt. Die Fokusrueckgabe uebernimmt useModalLayer (es merkt sich beim Oeffnen
      // das zuvor fokussierte Element und stellt es nur wieder her, wenn es noch im
      // Dokument haengt).
    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unbekannter Fehler';
      if (isForbiddenPeriodMessage(message)) {
        setDeletionError('Ihnen fehlt die Berechtigung für diese Änderung. Es wurde nichts verändert.');
      } else if (isFirstPeriodDeletionMessage(message)) {
        setDeletionError('Die erste Periode kann nicht gelöscht werden. Korrigieren Sie sie stattdessen.');
      } else if (isPreviewStalePeriodMessage(message)) {
        // WR-02: derselbe Zweig wie im Korrektur-Dialog — der interne Code PREVIEW_STALE
        // darf nie im Fließtext für den Anwender landen. Es wurde nichts verändert.
        const nextFailureCount = deletionStaleFailureCount + 1;
        setDeletionStaleFailureCount(nextFailureCount);
        setDeletionPreview(null);
        if (nextFailureCount >= 2) {
          setDeletionPreviewFailed(true);
          setDeletionError(
            'Die Auswirkung konnte nicht in einen speicherbaren Zustand gebracht werden. Es wurde ' +
              'nichts verändert — weder die Periode noch der Kontoauszug. Bitte schließen Sie den ' +
              'Dialog und versuchen Sie es erneut.'
          );
        } else {
          setDeletionError(
            'Die Auswirkung ist nicht mehr aktuell. Sie wurde neu berechnet — bitte prüfen und ' +
              'erneut bestätigen. Es wurde nichts verändert — weder die Periode noch der Kontoauszug.'
          );
          runDeletionPreview(deletionPeriod.id);
        }
      } else {
        setDeletionError(
          `Die Periode wurde nicht gelöscht. Es wurde nichts verändert — weder die Periode noch der Kontoauszug. ${message}`
        );
      }
    }
  }

  /** `details`-Panel der Löschbestätigung: Lückenschluss (immer bekannt), dann Storno und
   *  Saldoänderung (beide aus der Server-Vorschau, siehe Kommentar bei `deletionPreviewState`),
   *  dann die Pflichtbegründung, dann ein etwaiges Fehlerbanner (Zustand 22/23) — `ConfirmDialog`
   *  bietet keinen zweiten Inhaltsslot außerhalb dieses Panels. */
  function renderDeletionDetails(): ReactNode {
    if (!deletionPeriod) return null;
    const { previousPeriod } = neighborsOfPeriod(deletionPeriod);

    return (
      <>
        {previousPeriod && (
          <p className="text-sm text-gray-700 dark:text-gray-300">
            {deleteDetailGapClosure({
              previousValidFrom: previousPeriod.validFrom,
              previousWeeklyHours: previousPeriod.weeklyHours,
              newValidTo: deletionPeriod.validTo,
            })}
          </p>
        )}

        {deletionPreviewState === 'loading' && (
          <div className="flex items-center gap-2">
            <LoadingSpinner size="sm" />
            <span className="text-sm text-gray-600 dark:text-gray-400">Auswirkung wird berechnet …</span>
          </div>
        )}

        {deletionPreviewState === 'error' && (
          <div className="space-y-2">
            <p className="text-sm text-red-700 dark:text-red-400">
              Die Auswirkung konnte nicht berechnet werden. Ohne diese Angabe wird nicht gelöscht.
            </p>
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => runDeletionPreview(deletionPeriod.id)}
            >
              Erneut berechnen
            </Button>
          </div>
        )}

        {deletionPreviewState === 'ready' && deletionPreview && (
          <>
            <p className="text-sm text-gray-700 dark:text-gray-300">
              {deleteDetailReversal({ reversedTransactions: deletionPreview.reversedTransactions })}
            </p>
            {/* M-5 (UI-Review Phase 13): Punkt 3 stand als ganzer 150-Zeichen-Absatz in
                `text-lg font-bold` plus Signalfarbe. Der Vertrag reserviert Gewicht 700
                „ausschließlich für vorzeichenbehaftete Stundenwerte", und ein fünfzeiliger
                Anker ist keiner mehr. Der Wortlaut ist unverändert, nur aufgeteilt: der
                Kontextsatz neutral, hervorgehoben allein der Stundenwert — wie im
                Nachbardialog aus Phase 12. Bei einer Differenz von 0 gibt es keinen
                Stundenwert und folglich auch keine Hervorhebung. */}
            {(() => {
              const rebuild = deleteDetailRebuildParts({
                rebuildFrom: deletionPreview.rebuildFrom,
                balanceBefore: deletionPreview.balanceBefore,
                balanceAfter: deletionPreview.balanceAfter,
                balanceDelta: deletionPreview.balanceDelta,
              });
              return (
                <>
                  <p className="text-sm text-gray-700 dark:text-gray-300">{rebuild.context}</p>
                  <div className="flex items-center gap-2">
                    {deletionPreview.balanceDelta > 0 ? (
                      <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400 flex-shrink-0" />
                    ) : deletionPreview.balanceDelta < 0 ? (
                      <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400 flex-shrink-0" />
                    ) : null}
                    <p className="text-sm text-gray-700 dark:text-gray-300">
                      {rebuild.balancePrefix}
                      {rebuild.balanceValue !== null && (
                        <span
                          className={`text-lg font-bold ${
                            deletionPreview.balanceDelta > 0
                              ? 'text-green-600 dark:text-green-400'
                              : 'text-red-600 dark:text-red-400'
                          }`}
                        >
                          {rebuild.balanceValue}
                        </span>
                      )}
                      {rebuild.balanceSuffix}
                    </p>
                  </div>
                </>
              );
            })()}
          </>
        )}

        <div className="pt-2 mt-2 border-t border-gray-200 dark:border-gray-700">
          <Textarea
            ref={deletionReasonRef}
            label="Begründung (Pflicht)"
            value={deletionReason}
            onChange={(e) => {
              setDeletionReason(e.target.value);
              setDeletionReasonError('');
            }}
            rows={3}
            error={deletionReasonError || undefined}
            // M-3: getrimmt gezählt — dieselbe Zählweise, die über das Löschen entscheidet.
            // Vorher zeigten zehn Leerzeichen "10/10 Zeichen (Minimum)" bei gesperrtem Knopf.
            helperText={`${deletionReason.trim().length}/10 Zeichen (Minimum)`}
            required
          />
        </div>

        {deletionError && (
          <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg p-3">
            <p className="text-sm text-red-900 dark:text-red-100">{deletionError}</p>
          </div>
        )}
      </>
    );
  }

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
    setEndDateError('');

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
    // WR-08 (Code-Review Phase 12): Hier stand `alert()`. Browserdialoge funktionieren in
    // Tauri nicht — `ConfirmDialog.tsx` haelt das im Dateikopf ausdruecklich fest ("Replaces
    // window.confirm() which doesn't work in Tauri"), und fuer `window.alert()` gilt
    // dasselbe. `isValid = false` brach das Absenden ab, der Anwender sah aber keinerlei
    // Rueckmeldung: der Klick auf "Aenderungen speichern" tat scheinbar nichts. Die Meldung
    // laeuft jetzt ueber die vorhandene Fehlerzustandsfuehrung (error-Prop von `Input`,
    // die role="alert" mitbringt).
    if (endDate && hireDate && endDate < hireDate) {
      setEndDateError('Austrittsdatum muss nach dem Eintrittsdatum liegen');
      isValid = false;
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
    setEndDateError('');

    // F-8 (Phase 14.2, Plan 09): Endstelle der Kollisionsmarkierung. Seit der Wechsel-Dialog
    // sie beim Schliessen NICHT mehr zuruecknimmt (das war der Befund — sie war weg, bevor
    // sie sichtbar werden konnte), braucht sie hier ihr Ende: Wer die Nutzerbearbeitung
    // verlaesst, hat die Periodenliste gesehen; beim naechsten Oeffnen waere eine stehende
    // Markierung eine Aussage ueber eine Eingabe, die es nicht mehr gibt.
    setConflictPeriodId(null);

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

          {/* Zustaende 17/25 (Korrektur/Loeschen gespeichert): dasselbe 8-Sekunden-Bannermuster,
              eigener Zustand (periodBanner), damit es unabhaengig vom Stundenwechsel-Banner
              oben lebt. */}
          {periodBanner && (
            <div className="bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg p-3">
              <p className="text-sm text-green-800 dark:text-green-200">{periodBanner}</p>
            </div>
          )}

          <div className="grid grid-cols-3 gap-4">
            <Select
              name="role"
              id="role"
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
            {/* WR-11: Zustand 10 — die vom Wechsel-Dialog gemeldete Kollisionsperiode wird
                hier hervorgehoben (`ring-2 ring-red-400`). Ohne diese Verdrahtung war der
                Hervorhebungspfad in `WorkTimePeriodList` toter Code.
                Phase 13 (T-13-41): `renderActions` nur fuer Admins — die Spalte samt <th>
                entfaellt sonst vollstaendig (Phase-12-Verhalten). Zustand 24/Fussnote (D3):
                dauerhaft sichtbar, traegt die Erklaerung "nicht loeschbar" fuer Screenreader
                und ohne jede Interaktion. */}
            <WorkTimePeriodList
              userId={user.id}
              highlightPeriodId={conflictPeriodId}
              renderActions={
                isAdmin
                  ? (period) => (
                      <WorkTimePeriodActions
                        period={period}
                        hireDate={hireDate}
                        onCorrect={openCorrectionFromRow}
                        onDelete={openDeletion}
                        isDeleting={deleteM.isPending && deletionPeriod?.id === period.id}
                        correctButtonRef={getRowRef(rowCorrectButtonRefs.current, period.id)}
                        deleteButtonRef={getRowRef(rowDeleteButtonRefs.current, period.id)}
                      />
                    )
                  : undefined
              }
              footnote={
                isAdmin
                  ? 'Die erste Periode (ab dem Eintrittsdatum) lässt sich korrigieren, aber nicht löschen — sie hat keine Vorgängerin, die die entstehende Lücke schließen könnte.'
                  : undefined
              }
            />
          </div>

          {/* Korrekturblock (13-UI-SPEC.md Abschnitt "Die zwei Aktionen — sichtbare Trennung",
              REQ-30/D1): optisch leiser als der Phase-12-Block oben (Ghost-Knopf statt
              gefuelltem Button), aber mit eigener Ueberschrift, Warnsymbol und eindeutiger
              Wortwahl — sechs unabhaengige Unterscheidungsmerkmale gegenueber "Stundenwechsel
              ab Datum …". Ausgeblendet ohne Periode (Zustand 4), im Zustand 3 („Kein Zugriff")
              und fuer Nicht-Admins. Bei einem Ladefehler bleibt er sichtbar, sein Knopf ist
              gesperrt (Zustand 2, M-4). */}
          {isAdmin && (blockTargetPeriod || periodsLoadFailed) && (
            <div className="pt-6 border-t border-gray-200 dark:border-gray-700">
              <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4 space-y-2">
                <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
                  Sonderfall: Die Werte waren von jeher falsch
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Wenn die hinterlegten Stunden nie gestimmt haben, ist das kein Stundenwechsel,
                  sondern eine Korrektur. Sie ändert die bereits gerechnete Vergangenheit und
                  braucht eine Begründung.
                </p>
                <p className="text-sm text-gray-600 dark:text-gray-400">
                  Hat sich die Arbeitszeit ab einem <strong>Datum</strong> geändert, nehmen Sie
                  oben „Stundenwechsel ab Datum …" — dann bleibt die Vergangenheit unberührt.
                </p>
                <div className="flex justify-end pt-2">
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    fullWidth
                    className="sm:w-auto text-amber-600 dark:text-amber-400"
                    ref={blockCorrectButtonRef}
                    onClick={openCorrectionFromBlock}
                    disabled={periodsLoadFailed || !blockTargetPeriod}
                  >
                    <AlertTriangle className="w-4 h-4 mr-1.5" />
                    Stammdaten rückwirkend korrigieren …
                  </Button>
                </div>
              </div>
            </div>
          )}

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
              onChange={(e) => {
                setEndDate(e.target.value);
                setEndDateError('');
              }}
              error={endDateError}
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
          // F-8 (Phase 14.2, Plan 09): Hier stand die Ruecknahme der Kollisionsmarkierung.
          // Sie war die zweite neben `resetForm()` im Dialog — beide zusammen loeschten die
          // Zeilenmarkierung in genau dem Augenblick, in dem sie zum ersten Mal sichtbar
          // werden konnte. Die Markierung bleibt jetzt stehen; zurueckgenommen wird sie am
          // kollisionsfreien Vorschauerfolg, nach erfolgreichem Speichern (`onSaved`) und
          // spaetestens beim Schliessen dieses Dialogs (`handleClose`).
          setIsChangeModalOpen(false);
          changeButtonRef.current?.focus();
        }}
        user={user}
        onConflict={setConflictPeriodId}
        onSaved={(result: WorkTimeChangeResult) => {
          setIsChangeModalOpen(false);
          setConflictPeriodId(null);
          setSuccessBanner({
            validFrom: result.period.validFrom,
            weeklyHours: result.period.weeklyHours,
          });
          if (bannerTimerRef.current !== null) {
            window.clearTimeout(bannerTimerRef.current);
          }
          bannerTimerRef.current = window.setTimeout(() => {
            bannerTimerRef.current = null;
            setSuccessBanner(null);
          }, 8000);
          toast.success(
            result.preview.balanceDelta !== 0
              ? `Stundenwechsel gespeichert — Saldoänderung ${formatOvertimeHours(result.preview.balanceDelta)} steht im Kontoauszug`
              : 'Stundenwechsel gespeichert'
          );
          changeButtonRef.current?.focus();
        }}
      />

      {/* Korrektur-Dialog (DD-32/DD-37/DD-39/DD-40): Geschwister nach </form>, geoeffnet aus
          dem Block-Knopf ODER der Zeilenaktion "Korrigieren" — die Komponente selbst kennt
          diesen Unterschied nicht, nur `correctionPeriod`. Bedingtes Rendern statt eines
          dauerhaft gemounteten Dialogs mit `isOpen`-Toggle: `WorkTimePeriodEditModal` verlangt
          eine echte `period`, ohne eine Platzhalterperiode fuer den geschlossenen Zustand zu
          erfinden — `useModalLayer` fuehrt Anfangsfokus/Fokusrueckgabe beim Mounten/Unmounten
          exakt so aus wie beim isOpen-Wechsel (siehe useModalLayer.ts, alle drei Effekte
          reagieren bereits auf den ersten Render). */}
      {correctionPeriod && (
        <WorkTimePeriodEditModal
          isOpen
          onClose={closeCorrectionDialog}
          user={user}
          period={correctionPeriod}
          previousPeriod={neighborsOfPeriod(correctionPeriod).previousPeriod}
          nextPeriod={neighborsOfPeriod(correctionPeriod).nextPeriod}
          onConflict={setConflictPeriodId}
          onSaved={handleCorrectionSaved}
        />
      )}

      {/* Löschbestätigung (DD-38/DD-40, T-13-42/T-13-43): dauerhaft gemountet, `isOpen` steuert
          Sichtbarkeit — anders als der Korrektur-Dialog, weil der Dialog waehrend des
          Loeschens (Zustand 21) und im Fehlerfall (Zustand 22/23) offen bleiben muss (siehe
          `closeOnConfirm`-Prop unten), ohne dass `deletionPeriod` zwischenzeitlich null wird. */}
      <ConfirmDialog
        isOpen={deletionPeriod !== null}
        onClose={closeDeletionDialog}
        onConfirm={() => void handleConfirmDeletion()}
        title={deleteConfirmTitle()}
        message={
          deletionPeriod
            ? deleteConfirmMessage({
                validFrom: deletionPeriod.validFrom,
                validTo: deletionPeriod.validTo,
                weeklyHours: deletionPeriod.weeklyHours,
                firstName: user.firstName,
                lastName: user.lastName,
              })
            : ''
        }
        details={renderDeletionDetails()}
        confirmText={deleteConfirmText()}
        cancelText={deleteCancelText()}
        confirmAriaLabel={deletionPeriod ? deleteConfirmAriaLabel(deletionPeriod.validFrom) : undefined}
        variant="danger"
        zIndexClass="z-[60]"
        // M-3: Die Pflichtbegründung sperrt den Knopf NICHT mehr — sie wird in
        // `handleConfirmDeletion()` geprüft und meldet sich als Feldfehler an der Textarea.
        // Die drei verbliebenen Sperrgründe erklären sich im `details`-Panel selbst
        // („Auswirkung wird berechnet …", der Fehlertext mit „Erneut berechnen", der Spinner
        // im Knopf).
        confirmDisabled={isDeleteConfirmDisabled({
          previewReady: deletionPreviewState === 'ready',
          previewFailed: deletionPreviewState === 'error',
          isDeleting: deleteM.isPending,
        })}
        confirmLoading={deleteM.isPending}
        cancelDisabled={deleteM.isPending}
        closeOnConfirm={false}
      />
    </Modal>
  );
}
