import { useState } from 'react';
import { Card } from '../ui/Card';
import { Modal } from '../ui/Modal';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Receipt, TrendingUp, TrendingDown, AlertCircle, FileText } from 'lucide-react';
import {
  useVacationTransactions,
  type VacationJournalAbsence,
  type VacationTransactionType,
} from '../../hooks/useVacationTransactions';

interface VacationTransactionsProps {
  /** Nur für Admins wirksam; ohne Angabe liefert der Server das eigene Konto */
  userId?: number;
  /** Startwert; bei showYearSelector nur der Initialwert des internen Zustands */
  year?: number;
  limit?: number;
  /** Zeigt eine eigene Jahreswahl an (Mitarbeiter-Ansicht). Ohne Selector gilt `year` unverändert. */
  showYearSelector?: boolean;
}

const TYPE_LABELS: Record<VacationTransactionType, string> = {
  entitlement: 'Jahresanspruch',
  carryover: 'Übertrag',
  vacation_taken: 'Urlaub genehmigt',
  vacation_reverted: 'Storno',
  correction: 'Korrektur',
  expiry: 'Verfall',
};

/** Gutschriften grün, Verbrauch rot/orange, Korrektur violett — analog zu OvertimeTransactions. */
function getTypeBadgeColor(type: VacationTransactionType): string {
  switch (type) {
    case 'entitlement':
    case 'carryover':
    case 'vacation_reverted':
      return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'vacation_taken':
      return 'bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300';
    case 'expiry':
      return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
    case 'correction':
      return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
    default:
      return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
  }
}

const ABSENCE_TYPE_LABELS: Record<string, string> = {
  vacation: 'Urlaub',
  sick: 'Krankheit',
  unpaid: 'Unbezahlter Urlaub',
  overtime_comp: 'Überstundenausgleich',
};

const ABSENCE_STATUS_LABELS: Record<string, string> = {
  pending: 'Ausstehend',
  approved: 'Genehmigt',
  rejected: 'Abgelehnt',
};

function formatDateDe(dateStr: string): string {
  // 12:00 als Uhrzeit schützt vor Zeitzonenverschiebung beim reinen Datumsparsing
  // (dieselbe Absicherung wie im Vorbild OvertimeTransactions.tsx).
  return new Date(dateStr + 'T12:00:00').toLocaleDateString('de-DE');
}

/**
 * Buchungszeitpunkt als `TT.MM.JJJJ, HH:MM` — oder `null`, wenn er nichts erklärt.
 *
 * Die Liste ist nach Buchungszeitpunkt sortiert, nicht nach dem fachlichen Datum. Zwei
 * Fälle machen die Angabe überflüssig, und in beiden wäre sie nur Lärm:
 *
 * 1. Buchungstag == fachliches Datum — dann ist die Reihenfolge ohnehin einleuchtend.
 * 2. Gleicher Zeitstempel wie die Zeile darüber. Der Phase-7-Backfill hat Carmens elf
 *    Buchungen in derselben Sekunde geschrieben; elfmal „gebucht 19.08.2026, 21:41"
 *    untereinander sagt nichts. Einmal am Kopf der Gruppe genügt.
 */
function formatBookedAt(
  createdAt: string | null,
  businessDate: string,
  previousCreatedAt?: string | null,
): string | null {
  if (!createdAt) return null;
  if (createdAt.slice(0, 10) === businessDate) return null;
  if (previousCreatedAt === createdAt) return null;
  // SQLite liefert `YYYY-MM-DD HH:MM:SS` in lokaler Serverzeit — ohne Zonen-Suffix, damit
  // nicht als UTC interpretieren (sonst verschiebt sich die Uhrzeit).
  const parsed = new Date(createdAt.replace(' ', 'T'));
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleString('de-DE', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

/**
 * Räumt die vom Server erzeugte Beschreibung für die Anzeige auf.
 *
 * Die Texte entstehen beim Buchen und stehen so in der Datenbank — sie werden hier nur
 * anders dargestellt, nicht geändert. Zwei Dinge stören den Anwender:
 *
 * - `(rückwirkend erzeugt)` ist ein Vermerk des Phase-7-Backfills. Für Carmen ist es
 *   bedeutungslos und steht in jeder ihrer Zeilen.
 * - ISO-Daten wie `2026-08-27` in einer sonst deutschen Oberfläche, direkt neben der
 *   Datumsspalte, die dasselbe Datum bereits als `27.8.2026` zeigt.
 */
function formatDescription(description: string | null): string {
  if (!description) return '—';
  return description
    .replace(/\s*\(rückwirkend erzeugt\)/g, '')
    .replace(/\b(\d{4})-(\d{2})-(\d{2})\b/g, '$3.$2.$1')
    .trim();
}

/**
 * Urlaubs-Kontoauszug — Journal + laufender Saldo, nach dem Vorbild von
 * `OvertimeTransactions.tsx`. Der Server (Plan 08-01) entscheidet, welches Konto sichtbar
 * ist; diese Komponente stellt die Zugriffsregel nicht her, sie zeigt nur, was freigegeben ist.
 */
export function VacationTransactions({ userId, year, limit, showYearSelector }: VacationTransactionsProps) {
  const currentYear = new Date().getFullYear();
  const [selectedYear, setSelectedYear] = useState(year ?? currentYear);
  const [selectedAbsence, setSelectedAbsence] = useState<VacationJournalAbsence | null>(null);
  /** Antrag, dessen Zeilen gerade zusammen hervorgehoben werden (Genehmigung + Storno). */
  const [hoveredAbsenceId, setHoveredAbsenceId] = useState<number | null>(null);

  const effectiveYear = showYearSelector ? selectedYear : year;
  const { data, isLoading, error } = useVacationTransactions(userId, effectiveYear, limit);

  const yearOptions = Array.from({ length: 5 }, (_, i) => currentYear - 2 + i);

  const header = (
    <div className="flex items-center justify-between mb-4">
      <div className="flex items-center gap-3">
        <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
        <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
          Urlaubs-Kontoauszug
        </h3>
      </div>
      {showYearSelector && (
        <select
          value={selectedYear}
          onChange={(e) => setSelectedYear(Number(e.target.value))}
          className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
        >
          {yearOptions.map((y) => (
            <option key={y} value={y}>
              {y}
            </option>
          ))}
        </select>
      )}
    </div>
  );

  if (isLoading) {
    return (
      <Card className="p-6">
        {header}
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        {header}
        <div className="flex items-center gap-3 text-red-600 dark:text-red-400">
          <AlertCircle className="w-5 h-5" />
          <p>Fehler beim Laden: {error.message}</p>
        </div>
      </Card>
    );
  }

  if (!data || data.transactions.length === 0) {
    return (
      <Card className="p-6">
        {header}
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Für dieses Jahr wurden noch keine Buchungen erfasst.
        </p>
      </Card>
    );
  }

  return (
    <Card className="p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Urlaubs-Kontoauszug
          </h3>
        </div>
        <div className="flex items-center gap-3">
          {showYearSelector && (
            <select
              value={selectedYear}
              onChange={(e) => setSelectedYear(Number(e.target.value))}
              className="px-3 py-1.5 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 text-sm"
            >
              {yearOptions.map((y) => (
                <option key={y} value={y}>
                  {y}
                </option>
              ))}
            </select>
          )}
          <div className="text-right">
            <div className="text-lg font-bold text-gray-900 dark:text-gray-100">
              {data.available} <span className="text-sm font-normal text-gray-500 dark:text-gray-400">Tage</span>
            </div>
            <div className="text-xs text-gray-500 dark:text-gray-400">
              Anspruch {data.entitlement} + Übertrag {data.carryover} − Genommen {data.taken}
            </div>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Vorgang
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Beschreibung
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Tage
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Saldo
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.transactions.map((entry, index) => {
              const bookedAt = formatBookedAt(
                entry.createdAt,
                entry.date,
                data.transactions[index - 1]?.createdAt,
              );
              // Genehmigung und Storno desselben Antrags können weit auseinanderliegen —
              // bei Carmen acht Zeilen. Das Paar ist aber genau der Vorgang, den dieser
              // Auszug erklären soll, also beide Zeilen zusammen hervorheben.
              const isPaired =
                hoveredAbsenceId !== null && entry.absence?.id === hoveredAbsenceId;

              return (
              <tr
                key={entry.id}
                className={`transition-colors ${
                  isPaired
                    ? 'bg-blue-50 dark:bg-blue-900/20'
                    : 'hover:bg-gray-50 dark:hover:bg-gray-800/50'
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  <div>{formatDateDe(entry.date)}</div>
                  {bookedAt && (
                    <div className="text-xs text-gray-500 dark:text-gray-400">
                      gebucht {bookedAt}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-sm">
                  <span
                    className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium ${getTypeBadgeColor(entry.type)}`}
                  >
                    {TYPE_LABELS[entry.type]}
                  </span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span>{formatDescription(entry.description)}</span>
                    {entry.absence && (
                      <button
                        type="button"
                        onClick={() => setSelectedAbsence(entry.absence)}
                        onMouseEnter={() => setHoveredAbsenceId(entry.absence?.id ?? null)}
                        onMouseLeave={() => setHoveredAbsenceId(null)}
                        onFocus={() => setHoveredAbsenceId(entry.absence?.id ?? null)}
                        onBlur={() => setHoveredAbsenceId(null)}
                        className="inline-flex items-center gap-1 text-xs text-blue-600 dark:text-blue-400 hover:underline"
                      >
                        <FileText className="w-3.5 h-3.5" />
                        Antrag #{entry.absence.id}
                      </button>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1">
                    {entry.days > 0 ? (
                      <TrendingUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                    ) : (
                      <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                    )}
                    <span
                      className={`font-bold ${
                        entry.days > 0
                          ? 'text-green-600 dark:text-green-400'
                          : 'text-red-600 dark:text-red-400'
                      }`}
                    >
                      {entry.days > 0 ? '+' : ''}
                      {entry.days}
                    </span>
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right text-gray-900 dark:text-gray-100">
                  {entry.balanceAfter === null ? '—' : entry.balanceAfter}
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {data.transactions.length} {data.transactions.length === 1 ? 'Buchung' : 'Buchungen'} —
          neueste zuerst; der Saldo entspricht dem Stand nach der jeweiligen Buchung.
        </p>
      </div>

      {selectedAbsence && (
        <Modal
          isOpen={!!selectedAbsence}
          onClose={() => setSelectedAbsence(null)}
          title={`Abwesenheitsantrag #${selectedAbsence.id}`}
          size="sm"
        >
          <dl className="space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Typ</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {ABSENCE_TYPE_LABELS[selectedAbsence.type] ?? selectedAbsence.type}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Zeitraum</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {formatDateDe(selectedAbsence.startDate)} – {formatDateDe(selectedAbsence.endDate)}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Status</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">
                {ABSENCE_STATUS_LABELS[selectedAbsence.status] ?? selectedAbsence.status}
              </dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-gray-500 dark:text-gray-400">Tage</dt>
              <dd className="font-medium text-gray-900 dark:text-gray-100">{selectedAbsence.days}</dd>
            </div>
          </dl>
        </Modal>
      )}
    </Card>
  );
}
