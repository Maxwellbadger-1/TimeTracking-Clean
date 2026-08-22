import { useState, type KeyboardEvent, type RefObject } from 'react';
import { Info, Pencil, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import type { WorkTimePeriod } from '../../types';

/**
 * Die Aktionszelle je Periodenzeile (Phase 13, DD-36). Ausgelagert aus `EditUserModal.tsx`,
 * damit die Modal-Datei nicht noch groesser wird (sie traegt nach dieser Phase drei Dialoge).
 * `EditUserModal` reicht sie ueber `renderActions={(period) => <WorkTimePeriodActions … />}`
 * durch (13-UI-SPEC.md Abschnitt 3 „Aktionen in WorkTimePeriodList.tsx", Textbuch „Erste
 * Periode — nicht loeschbar").
 *
 * T-13-41 (Elevation of Privilege): Diese Komponente entscheidet NICHT, ob ein Nutzer Aktionen
 * sehen darf — `EditUserModal` uebergibt `renderActions` fuer Nicht-Admins gar nicht erst, die
 * Spalte samt `<th>` entfaellt dann in `WorkTimePeriodList`. Die eigentliche Durchsetzung liegt
 * serverseitig (Plan 13-05, `requireAdmin`).
 */

/** Zeitzonen-sichere Anzeige eines ISO-Datums — niemals ueber `toISOString().split('T')[0]`
 *  (`.claude/CLAUDE.md`, "Timezone bugs!"). */
function formatGermanDate(iso: string): string {
  return new Date(`${iso}T12:00:00`).toLocaleDateString('de-DE');
}

interface WorkTimePeriodActionsProps {
  period: WorkTimePeriod;
  /** Eintrittsdatum des Nutzers — Traeger des `aria-label`-Satzes der ersten Periode. */
  hireDate: string;
  onCorrect: (period: WorkTimePeriod) => void;
  onDelete: (period: WorkTimePeriod) => void;
  /** Laeuft das Loeschen fuer DIESE Zeile (Zustand 21 der 13-UI-SPEC.md). */
  isDeleting: boolean;
  /** DD-39: eigenes Ref je Zeilenaktion — der Aufrufer gibt den Fokus nach dem Schliessen des
   *  jeweiligen Dialogs an genau den Knopf zurueck, der ihn geoeffnet hat. */
  correctButtonRef?: RefObject<HTMLButtonElement>;
  deleteButtonRef?: RefObject<HTMLButtonElement>;
}

export function WorkTimePeriodActions({
  period,
  hireDate,
  onCorrect,
  onDelete,
  isDeleting,
  correctButtonRef,
  deleteButtonRef,
}: WorkTimePeriodActionsProps) {
  // Keine ausgegraute Loeschschaltflaeche (13-UI-SPEC.md, "Der Grund steht deshalb zweifach in
  // der Oberflaeche: als fokussierbarer Chip in der Zeile und als dauerhaft sichtbare Fussnote
  // unter der Liste"). Das Bestandsmuster aus OvertimeTransactions.tsx ist hover-only (WCAG 2.2,
  // 1.4.13 verlangt zusaetzlich focus-within UND eine ESC-Ausblendbarkeit ohne Fokusverlust) —
  // dieser lokale Zustand traegt genau die ESC-Ausblendbarkeit, `group-focus-within` uebernimmt
  // den Tastaturfokus-Fall.
  const [tooltipDismissed, setTooltipDismissed] = useState(false);

  function handleChipKeyDown(e: KeyboardEvent<HTMLSpanElement>) {
    if (e.key === 'Escape') {
      // Modal-Stack (Phase 12) regelt nur die Rangfolge zwischen Modalen, nicht zwischen
      // Tooltip und Modal — ohne stopPropagation() wuerde ESC zusaetzlich EditUserModal
      // schliessen (13-UI-SPEC.md Abschnitt 3).
      setTooltipDismissed(true);
      e.stopPropagation();
    }
  }

  function resetTooltipDismissed() {
    setTooltipDismissed(false);
  }

  const ariaLabelFirst = `Dies ist die erste Periode seit dem Eintritt am ${formatGermanDate(
    hireDate
  )}. Sie kann nicht gelöscht werden, weil sonst eine Lücke ab dem Eintrittsdatum entstünde. Wenn die Werte von jeher falsch waren, korrigieren Sie sie.`;

  return (
    <div className="flex items-center justify-end gap-2">
      <Button
        type="button"
        variant="ghost"
        size="sm"
        ref={correctButtonRef}
        onClick={() => onCorrect(period)}
        disabled={isDeleting}
        aria-label="Korrigieren"
        title="Korrigieren"
        className="p-2 sm:px-3 sm:py-1.5"
      >
        <Pencil className="w-4 h-4" />
        <span className="hidden sm:inline sm:ml-1.5">Korrigieren</span>
      </Button>

      {period.isFirst ? (
        <span
          tabIndex={0}
          role="note"
          aria-label={ariaLabelFirst}
          onKeyDown={handleChipKeyDown}
          onBlur={resetTooltipDismissed}
          onMouseLeave={resetTooltipDismissed}
          className="group relative inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 dark:text-gray-400 cursor-help rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Nicht löschbar</span>
          {!tooltipDismissed && (
            <div
              role="tooltip"
              className="absolute right-0 top-6 w-72 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible group-focus-within:opacity-100 group-focus-within:visible transition-all z-10"
            >
              {ariaLabelFirst}
            </div>
          )}
        </span>
      ) : isDeleting ? (
        <LoadingSpinner size="sm" />
      ) : (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          ref={deleteButtonRef}
          onClick={() => onDelete(period)}
          aria-label="Löschen"
          title="Löschen"
          className="p-2 sm:px-3 sm:py-1.5 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline sm:ml-1.5">Löschen</span>
        </Button>
      )}
    </div>
  );
}
