import { type RefObject } from 'react';
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
  /**
   * DD-39: eigenes Ref je Zeilenaktion — der Aufrufer gibt den Fokus nach dem Schliessen des
   * jeweiligen Dialogs an genau den Knopf zurueck, der ihn geoeffnet hat.
   *
   * VERTRAG AN DEN AUFRUFER (WR-13, Code-Review Phase 13): Jede ZEILE muss ihre EIGENEN
   * Ref-Objekte uebergeben. Gibt der Aufrufer allen Zeilen dieselben mit, weist React sie
   * beim Mounten der Reihe nach zu und `current` zeigt am Ende auf die Schaltflaeche der
   * ZULETZT gerenderten Zeile — die Zusicherung oben ist dann nicht eingeloest, der Fokus
   * landet immer auf der letzten Zeile. `EditUserModal` haelt dafuer eine
   * `Map<periodId, RefObject>`.
   */
  correctButtonRef?: RefObject<HTMLButtonElement | null>;
  deleteButtonRef?: RefObject<HTMLButtonElement | null>;
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
  const ariaLabelFirst = `Dies ist die erste Periode seit dem Eintritt am ${formatGermanDate(
    hireDate
  )}. Sie kann nicht gelöscht werden, weil sonst eine Lücke ab dem Eintrittsdatum entstünde. Wenn die Werte von jeher falsch waren, korrigieren Sie sie.`;

  return (
    <div className="flex items-center justify-end gap-2">
      {/*
       * D-2 (Phase 14.2, Plan 11): Gemessene Ausgangswerte 40 x 28 px, Soll 32 x 32 px
       * (13-UI-SPEC.md, Abschnitte "Responsive" und "Barrierefreiheit"). Ursache war NICHT ein
       * fehlendes `p-2` — die vorige Polsterung ('p-2' unterhalb, 'px-3 py-1.5' ab `sm`) stand
       * hier bereits, wirkte aber nie: Tailwind ordnet Utility-Regeln im erzeugten Stylesheet
       * nach Entdeckungsreihenfolge
       * beim Build, nicht nach Reihenfolge im `class`-Attribut. `Button.tsx`s `sizeStyles.sm`
       * ('px-3 py-1.5 text-sm') wird VOR dieser lokalen Klasse entdeckt und gewinnt die
       * Spezifitaetskollision — die lokale Polsterung war tote Klasse. Ohne `!`-Praefix haette
       * ein zweites `p-2` dasselbe Schicksal erlitten.
       * Das Projekt fuehrt kein `tailwind-merge` und kein `clsx`/`classnames`
       * (desktop/package.json, geprueft) — die etablierte Loesung fuer genau diesen Konflikt ist
       * Tailwinds `!`-Modifier, bereits im Bestand vorgezeichnet in
       * desktop/src/components/users/EditUserModal.tsx (Zeile 908, Stand 26.08.2026 — der Plan
       * zitiert Zeile 882; die Datei ist seither gewachsen, das Muster ist dasselbe):
       * `hover:!border-gray-300 dark:hover:!border-gray-600 hover:!shadow-sm`.
       * `Button.tsx` selbst bleibt unangetastet — der Konflikt wird hier, am Aufrufer, geloest.
       */}
      <Button
        type="button"
        variant="ghost"
        size="sm"
        ref={correctButtonRef}
        onClick={() => onCorrect(period)}
        disabled={isDeleting}
        aria-label="Korrigieren"
        title="Korrigieren"
        className="!p-2 sm:!px-3 sm:!py-2"
      >
        <Pencil className="w-4 h-4" />
        <span className="hidden sm:inline sm:ml-1.5">Korrigieren</span>
      </Button>

      {period.isFirst ? (
        /**
         * M-2 (UI-Review Phase 13): Hier stand ein selbstgebautes Tooltip
         * (`absolute right-0 top-6 w-72`). Es wurde vom umgebenden
         * `overflow-x-auto`-Container in `WorkTimePeriodList.tsx` beschnitten — dieselbe
         * Falle, die dieselbe Datei fuer den Phase-12-Befund V-2 bereits dokumentiert
         * (`WorkTimePeriodList.tsx`, Kommentar bei `highlightCellClass`).
         *
         * Am 23.08.2026 in headless Edge (dieselbe Blink/WebView2-Engine wie Tauri unter
         * Windows) mit nachgestelltem Markup gemessen, Sichtbarkeit ueber
         * `document.elementFromPoint()` (beschnittene Flaechen sind nicht treffbar):
         *
         *   - `overflow-x: auto` laesst `overflow-y` rechnerisch zu `auto` werden
         *     (gemessen: computed overflow-y === 'auto'). Der Container beschneidet also
         *     auch senkrecht.
         *   - `top-6`, eine Zeile:  Tooltip ragt 54 px unter den Container, untere Haelfte
         *     nicht treffbar. Drei Zeilen: identisch 54 px.
         *   - `bottom-full mb-1` (Variante 1 des Reviews) traegt NUR ab drei Zeilen. Bei
         *     EINER Zeile ragt es 56 px ueber den Container hinaus und die obere Haelfte ist
         *     nicht treffbar — und genau dieser Fall ist der haeufigste: die erste Periode
         *     ist wegen der DESC-Sortierung immer die letzte Zeile, und ein Nutzer mit nur
         *     einer Periode hat genau eine Zeile, die zugleich `isFirst` ist.
         *
         * Gewaehlt ist deshalb Variante 2 des Reviews: kein eigenes Tooltip mehr. Traeger der
         * Aussage sind, wie im Designvertrag festgelegt, das `aria-label` des Chips und die
         * dauerhaft sichtbare Fussnote unter der Liste ("Faellt das Tooltip aus, fehlt keine
         * Aussage"). Fuer den sehenden Mausnutzer tritt `title` an seine Stelle: Das
         * Browser-Tooltip wird vom User Agent gezeichnet und kann von keinem
         * overflow-Container beschnitten werden. Dasselbe Paar aus `aria-label` und `title`
         * tragen die beiden Schaltflaechen dieser Datei bereits.
         *
         * WCAG 2.2, 1.4.13 ("Content on Hover or Focus") greift damit nicht mehr: Das
         * Kriterium gilt ausdruecklich nicht fuer Einblendungen des User Agents. Der
         * ESC-Ausblendpfad samt `stopPropagation()` entfaellt deshalb ersatzlos.
         */
        <span
          tabIndex={0}
          role="note"
          aria-label={ariaLabelFirst}
          title={ariaLabelFirst}
          className="inline-flex items-center gap-1 px-2 py-2 text-xs text-gray-500 dark:text-gray-400 cursor-help rounded focus:outline-none focus:ring-2 focus:ring-blue-500"
        >
          <Info className="w-4 h-4 flex-shrink-0" />
          <span className="hidden sm:inline">Nicht löschbar</span>
        </span>
      ) : isDeleting ? (
        <LoadingSpinner size="sm" />
      ) : (
        /*
         * D-2 (Nachtrag, Task 2): Dieselbe Spezifitaetskollision wie beim "Korrigieren"-Knopf
         * (derselbe `size="sm"` der Button-Primitive) — gemessen 40 x 28 px bei Viewport
         * 600 x 900. Gehoert zu demselben Befund (dieselbe Zelle, dasselbe Kriterium) und wird
         * mit demselben `!`-Muster mitbehoben.
         */
        <Button
          type="button"
          variant="ghost"
          size="sm"
          ref={deleteButtonRef}
          onClick={() => onDelete(period)}
          aria-label="Löschen"
          title="Löschen"
          className="!p-2 sm:!px-3 sm:!py-2 text-red-600 hover:text-red-700 hover:bg-red-50 dark:text-red-400 dark:hover:text-red-300 dark:hover:bg-red-900/20"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline sm:ml-1.5">Löschen</span>
        </Button>
      )}
    </div>
  );
}
