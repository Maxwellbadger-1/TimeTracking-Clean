import { useMemo, type ReactNode } from 'react';
import { AlertCircle, Lock } from 'lucide-react';
import { Button } from '../ui/Button';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useWorkPeriods } from '../../hooks/useWorkTimeChange';
import { getTodayDate } from '../../utils';
import type { WorkTimePeriod, DayName } from '../../types';

/**
 * Die Oberflaeche stellt die Zugriffsregel fuer Arbeitszeit-Perioden nicht selbst her, sie
 * zeigt sie nur (Muster aus `VacationTransactions.tsx`). Die Durchsetzung liegt serverseitig
 * (`13-CONTEXT.md` D5, Plan 13-05: `requireAuth`/`requireAdmin` auf `GET /api/work-periods`).
 * Ein 403 wird von `useWorkPeriods()` als `Error('FORBIDDEN')` gemeldet (Plan 13-07, DD-31);
 * diese Komponente uebersetzt genau diesen Fall in Zustand 3 ("Kein Zugriff"), nicht mehr.
 */

interface WorkTimePeriodListProps {
  userId: number;
  /** Zustand 10: hebt die betroffene Zeile hervor (z. B. Ueberlappung). */
  highlightPeriodId?: number | null;
  /** Ist die Prop nicht gesetzt, wird die Aktionsspalte gar nicht gerendert (Schnitt Phase 13). */
  renderActions?: (period: WorkTimePeriod) => ReactNode;
  /** Uebersteuerung des serverseitig erkannten 403-Zustands (Zustand 3, "Kein Zugriff"). Die
   *  Komponente erkennt FORBIDDEN bereits selbst aus dem Ladefehler; diese Prop ist fuer
   *  Aufrufer gedacht, die den Zustand unabhaengig vom eigenen Ladevorgang erzwingen wollen. */
  accessDenied?: boolean;
  /** Dauerhaft sichtbare Fussnote unter der Tabelle (13-UI-SPEC: "Die Fussnote ist der
   *  Traeger — sie ist ohne jede Interaktion lesbar"). Erscheint auch bei nur einer Zeile,
   *  aber NICHT im Zustand "Kein Zugriff". */
  footnote?: ReactNode;
}

const DAY_SHORT_LABELS: Record<DayName, string> = {
  monday: 'Mo',
  tuesday: 'Di',
  wednesday: 'Mi',
  thursday: 'Do',
  friday: 'Fr',
  saturday: 'Sa',
  sunday: 'So',
};

const DAY_ORDER: DayName[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

function formatIsoDate(iso: string): string {
  return new Date(iso + 'T12:00:00').toLocaleDateString('de-DE');
}

function formatWeeklyHours(hours: number): string {
  return hours.toLocaleString('de-DE', { maximumFractionDigits: 2 });
}

function formatWorkSchedule(period: WorkTimePeriod): string {
  if (period.workSchedule === null) {
    return 'Standard (5 Tage)';
  }
  const schedule = period.workSchedule;
  return DAY_ORDER
    .filter((day) => schedule[day] > 0)
    .map((day) => `${DAY_SHORT_LABELS[day]} ${formatWeeklyHours(schedule[day])}`)
    .join(' · ');
}

export function WorkTimePeriodList({
  userId,
  highlightPeriodId,
  renderActions,
  accessDenied,
  footnote,
}: WorkTimePeriodListProps) {
  const { data, isLoading, error, refetch } = useWorkPeriods(userId);

  const sortedPeriods = useMemo(() => {
    if (!data) return [];
    return [...data].sort((a, b) => (a.validFrom < b.validFrom ? 1 : a.validFrom > b.validFrom ? -1 : 0));
  }, [data]);

  /**
   * WR-19 (Code-Review Phase 12): Frueher `useMemo(..., [])`. Die leere Abhaengigkeitsliste
   * fror das Tagesdatum fuer die Lebensdauer der Komponente ein; die Tauri-Anwendung bleibt
   * ueblicherweise ueber Nacht offen, und nach Mitternacht wurden die Badges "Aktuell" und
   * "Geplant" gegen den Vortag bestimmt. `getTodayDate()` ist billig.
   */
  const today = getTodayDate();

  // DD-35 (Plan 13-08): Die "aktuell gueltige Periode" wurde hier frueher ein zweites Mal
  // selbst bestimmt (WR-19/WR-06 warnten bereits genau vor diesem Dual-Calculation-Risiko).
  // Seit Plan 13-05 liefert der Server `isCurrent` ueber `getWorkPeriodsWithFlags()`
  // (`resolveWorkPeriodIn()`, dieselbe Aufloesungsstelle wie zuvor im Client). Die lokale
  // Berechnung ist deshalb entfernt, nicht ergaenzt — sonst gaebe es zwei Quellen fuer
  // dieselbe Aussage in derselben Komponente.

  // DD-31 (Plan 13-07): `useWorkPeriods()` meldet einen 403 als `Error('FORBIDDEN')`. Die
  // Prop `accessDenied` bleibt als Uebersteuerung fuer den Aufrufer bestehen.
  const isAccessDenied = accessDenied || error?.message === 'FORBIDDEN';

  if (isLoading) {
    return (
      <div className="flex justify-center py-8">
        <LoadingSpinner />
      </div>
    );
  }

  if (isAccessDenied) {
    return (
      <div className="bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg p-4">
        <div className="flex items-center gap-2">
          <Lock className="w-5 h-5 text-gray-500 dark:text-gray-400 flex-shrink-0" />
          <h4 className="text-sm font-semibold text-gray-900 dark:text-gray-100">
            Kein Zugriff auf die Arbeitszeit-Perioden
          </h4>
        </div>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Diese Angaben dürfen nur Administratoren einsehen. Wenn Sie glauben, dass Sie sie
          brauchen, wenden Sie sich an eine Administratorin oder einen Administrator.
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-4">
        <div className="flex items-center gap-2 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5 flex-shrink-0" />
          <p className="text-sm">Perioden konnten nicht geladen werden: {error.message}</p>
        </div>
        <div className="mt-3">
          <Button type="button" variant="secondary" size="sm" onClick={() => refetch()}>
            Perioden erneut laden
          </Button>
        </div>
      </div>
    );
  }

  if (sortedPeriods.length === 0) {
    return (
      <div className="py-4">
        <h4 className="text-sm font-medium text-gray-900 dark:text-gray-100">
          Noch kein Stichtag hinterlegt
        </h4>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          Für diesen Mitarbeiter gibt es bisher keine Periode mit Stichtag. Es gelten die
          Stammdatenwerte seit dem Eintrittsdatum. Über „Stundenwechsel ab Datum …" tragen Sie die
          erste Umstellung ein.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-gray-200 dark:border-gray-700">
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
              Gültig ab
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
              Gültig bis
            </th>
            <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
              Wochenstunden
            </th>
            <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
              Tagesplan
            </th>
            {renderActions && (
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Aktionen
              </th>
            )}
          </tr>
        </thead>
        <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
          {sortedPeriods.map((period) => {
            // DD-35: `isCurrent` kommt seit Plan 13-05 vom Server (getWorkPeriodsWithFlags(),
            // resolveWorkPeriodIn()) statt aus einer zweiten Berechnung hier.
            const isCurrent = period.isCurrent;
            const isPlanned = period.validFrom > today;
            const isHighlighted = highlightPeriodId != null && period.id === highlightPeriodId;

            /**
             * UI-Review Phase 12 (V-2): Frueher `ring-2 ring-red-400` auf dem `<tr>`.
             * Tailwind bildet `ring-*` als `box-shadow` ab; der Schatten liegt also
             * ausserhalb der Zeilenbox. Am 22.08.2026 in headless Edge (dieselbe
             * Blink/WebView2-Engine wie Tauri unter Windows) mit dem echten Markup
             * nachgestellt: Der Schatten wird zwar gemalt — die Annahme, `border-collapse:
             * collapse` unterdruecke ihn, trifft in aktuellem Blink nicht zu —, aber der
             * umgebende `overflow-x-auto`-Container beschneidet ihn. `overflow-x: auto`
             * macht die y-Achse rechnerisch ebenfalls zum Scrollbereich, und die Tabelle
             * ist exakt so breit wie er (`w-full`): Es bleiben zwei rote Querstriche ueber
             * und unter der Zeile, bei der ersten oder letzten Zeile sogar nur einer. Das
             * liest sich als Trennlinie, nicht als Markierung — Zustand 10 kam nicht an.
             * Ersatz: Flaechen- und Randmarkierung auf den Zellen. Zellhintergruende liegen
             * innerhalb der Zeile und koennen nicht beschnitten werden.
             */
            const highlightCellClass = isHighlighted ? 'bg-red-50 dark:bg-red-900/20' : '';
            const highlightFirstCellClass = isHighlighted
              ? 'border-l-4 border-red-500 dark:border-red-400'
              : '';

            return (
              <tr
                key={period.id}
                className="hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors"
              >
                <td
                  className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${highlightCellClass} ${highlightFirstCellClass}`}
                >
                  <div className="flex items-center gap-2">
                    {formatIsoDate(period.validFrom)}
                    {(isCurrent || isPlanned) && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {isCurrent ? 'Aktuell' : 'Geplant'}
                      </span>
                    )}
                  </div>
                </td>
                <td className={`px-4 py-3 text-sm text-gray-900 dark:text-gray-100 ${highlightCellClass}`}>
                  {period.validTo ? formatIsoDate(period.validTo) : '—'}
                </td>
                <td className={`px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100 ${highlightCellClass}`}>
                  {formatWeeklyHours(period.weeklyHours)} h
                </td>
                <td className={`px-4 py-3 text-sm text-gray-700 dark:text-gray-300 ${highlightCellClass}`}>
                  {formatWorkSchedule(period)}
                </td>
                {renderActions && (
                  <td className={`px-4 py-3 text-sm text-right ${highlightCellClass}`}>
                    {renderActions(period)}
                  </td>
                )}
              </tr>
            );
          })}
        </tbody>
      </table>
      {footnote && <p className="text-xs text-gray-500 dark:text-gray-400 mt-3">{footnote}</p>}
    </div>
  );
}
