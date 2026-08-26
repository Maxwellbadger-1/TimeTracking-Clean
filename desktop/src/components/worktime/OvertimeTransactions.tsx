import { useEffect, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { Receipt, TrendingUp, TrendingDown, AlertCircle, FileText, Info, Link2 } from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';
import { useOvertimeTransactions, type OvertimeTransactionRow } from '../../hooks/useWorkTimeAccounts';
import {
  documentedDeltaToneClass,
  formatCreatedAtDe,
  formatDocumentedDelta,
  receiptChipAriaLabel,
  receiptChipLabel,
  resolveReceiptJumpOutcome,
  reversalPartnerId,
  reversalStateLabel,
  reversedNoteLine,
} from './overtimeTransactionFormat';

interface OvertimeTransactionsProps {
  userId?: number;
  year?: number;
  month?: number;  // Filter by specific month (1-12)
  limit?: number;
}


/**
 * Overtime Transactions Component
 *
 * PROFESSIONAL TRANSACTION-BASED OVERTIME TRACKING
 * (Like SAP SuccessFactors, Personio, DATEV)
 *
 * Shows immutable audit trail of all overtime changes:
 * - 'earned': Daily overtime from time entries (Soll/Ist difference)
 * - 'compensation': Overtime deduction when taking time off
 * - 'correction': Manual adjustments by admin
 * - 'carryover': Year-end transfer markers
 */
export function OvertimeTransactions({ userId, year, month, limit = 50 }: OvertimeTransactionsProps) {
  const { data, isLoading, error } = useOvertimeTransactions(userId, year, month, limit);

  // DD-43/Barrierefreiheit: Sprungmarke des Storno-Paar-Beleg-Chips. Die Map wird ausschliesslich
  // ueber Zeilen mit gesetzter `id` befuellt (nur `model_change`-Zeilen tragen eine) — Hooks
  // muessen laut Rules of Hooks vor jedem fruehen Return dieser Komponente stehen.
  const rowRefs = useRef<Map<number, HTMLTableRowElement>>(new Map());
  const [highlightedId, setHighlightedId] = useState<number | null>(null);
  const highlightTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const handleReceiptChipClick = (transaction: OvertimeTransactionRow) => {
    const partnerId = reversalPartnerId(transaction);
    if (partnerId === null || !data) return; // Chip wird nur gerendert, wenn partnerId != null
    const partnerRow = rowRefs.current.get(partnerId);
    const outcome = resolveReceiptJumpOutcome({
      partnerFound: !!partnerRow,
      loadedCount: data.transactions.length,
      limit,
      month,
      year,
    });

    if (outcome.kind === 'jump') {
      if (!partnerRow) return; // kann laut resolveReceiptJumpOutcome nicht eintreten
      partnerRow.scrollIntoView({ block: 'center' });
      if (highlightTimeoutRef.current !== null) {
        window.clearTimeout(highlightTimeoutRef.current);
      }
      setHighlightedId(partnerId);
      highlightTimeoutRef.current = window.setTimeout(() => {
        setHighlightedId(null);
        highlightTimeoutRef.current = null;
      }, 2000);
      partnerRow.focus();
    } else {
      // DD-43: kein stiller Klick ins Leere — einer der drei Textbuch-Toasts erklaert den Fall.
      toast.info(outcome.message);
    }
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
        </div>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
        </div>
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
        <div className="flex items-center gap-3 mb-4">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
        </div>
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Keine Transaktionen verfügbar
        </p>
      </Card>
    );
  }

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'earned': return 'Überstunden';
      case 'feiertag': return 'Feiertag';
      case 'compensation': return 'Ausgleich';
      case 'correction': return 'Korrektur';
      case 'carryover': return 'Übertrag';
      case 'vacation_credit': return 'Urlaub';
      case 'sick_credit': return 'Krankheit';
      case 'overtime_comp_credit': return 'Überstundenausgleich';
      case 'special_credit': return 'Sonderurlaub';
      case 'unpaid_adjustment': return 'Unbezahlter Urlaub';
      case 'model_change': return 'Modellwechsel';
      default: return type;
    }
  };

  const getTypeDescription = (type: string) => {
    switch (type) {
      case 'earned':
        return 'Tägliche Soll/Ist-Differenz (inkl. Urlaub/Krankheit als Gutschrift)';
      case 'feiertag':
        return 'Gesetzlicher Feiertag (Soll: 0h, kein Arbeitstag)';
      case 'compensation':
        return 'Überstunden-Ausgleich genommen (freier Tag)';
      case 'correction':
        return 'Manuelle Korrektur durch Administrator';
      case 'carryover':
        return 'Jahreswechsel-Übertrag (Audit-Marker)';
      case 'vacation_credit':
        return 'Urlaub (gleicht Tagessoll aus, keine Überstunden)';
      case 'sick_credit':
        return 'Krankheit (gleicht Tagessoll aus, keine Überstunden)';
      case 'overtime_comp_credit':
        return 'Überstundenausgleich (gleicht Tagessoll aus, keine Überstunden)';
      case 'special_credit':
        return 'Sonderurlaub (gleicht Tagessoll aus, keine Überstunden)';
      case 'unpaid_adjustment':
        return 'Unbezahlter Urlaub (reduziert Tagessoll, keine Gutschrift)';
      case 'model_change':
        return 'Saldodifferenz aus einer rückwirkenden Umstellung des Arbeitszeitmodells';
      default:
        return '';
    }
  };

  const getTypeBadgeColor = (type: string) => {
    switch (type) {
      case 'earned':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'feiertag':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'compensation':
        return 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300';
      case 'correction':
        return 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300';
      case 'carryover':
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
      case 'vacation_credit':
      case 'sick_credit':
      case 'overtime_comp_credit':
      case 'special_credit':
      case 'unpaid_adjustment':
        return 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400';
      case 'model_change':
        return 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300';
    }
  };

  const isAbsenceType = (type: string) => {
    return ['feiertag', 'vacation_credit', 'sick_credit', 'overtime_comp_credit', 'special_credit', 'unpaid_adjustment'].includes(type);
  };

  // Die Fussnote zur nicht summierenden Modellwechsel-Zeile erscheint nur, wenn eine solche
  // Zeile im angezeigten Zeitraum ueberhaupt vorkommt.
  const hasModelChange = data.transactions.some((t) => t.type === 'model_change');

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <Receipt className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Überstunden-Transaktionen
          </h3>
          <div className="group relative">
            <Info className="w-4 h-4 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 cursor-help" />
            <div className="absolute left-0 top-6 w-80 p-3 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
              <p className="font-semibold mb-1">Was wird angezeigt?</p>
              <ul className="space-y-1 list-disc list-inside">
                <li>Tägliche Überstunden (Soll/Ist-Differenz)</li>
                <li>Überstunden-Ausgleich (genommene freie Tage)</li>
                <li>Admin-Korrekturen</li>
              </ul>
              <p className="mt-2 text-gray-300">
                <strong>Hinweis:</strong> Tage mit 0 Differenz (Soll = Ist) werden nicht angezeigt, da sie das Konto nicht ändern.
              </p>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-gray-500 dark:text-gray-400" title="Kumulierter Saldo aller Transaktionen">Zeitkonto-Saldo:</span>
          <span
            className={`font-bold ${
              data.currentBalance > 0
                ? 'text-green-700 dark:text-green-400'
                : data.currentBalance < 0
                ? 'text-red-600 dark:text-red-400'
                : 'text-gray-600 dark:text-gray-400'
            }`}
          >
            {data.currentBalance > 0 ? '+' : ''}
            {formatHours(data.currentBalance)}
          </span>
        </div>
      </div>

      {/* Transactions Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-200 dark:border-gray-700">
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Datum
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Typ
              </th>
              <th className="px-4 py-3 text-left text-sm font-semibold text-gray-900 dark:text-gray-100">
                Beschreibung
              </th>
              <th className="px-4 py-3 text-right text-sm font-semibold text-gray-900 dark:text-gray-100">
                Stunden
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-200 dark:divide-gray-700">
            {data.transactions.map((transaction, index) => {
              const stateLabel = reversalStateLabel(transaction);
              const noteLine = reversedNoteLine(transaction);
              const partnerId = reversalPartnerId(transaction);
              return (
              <tr
                key={`${transaction.date}-${transaction.type}-${index}`}
                ref={(el) => {
                  // Sprungmarke (DD-43): nur `model_change`-Zeilen tragen eine `id`.
                  if (transaction.id === undefined) return;
                  if (el) rowRefs.current.set(transaction.id, el);
                  else rowRefs.current.delete(transaction.id);
                }}
                tabIndex={-1}
                className={`hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors ${
                  transaction.id !== undefined && highlightedId === transaction.id
                    ? 'ring-2 ring-inset ring-gray-400 dark:ring-gray-500'
                    : ''
                }`}
              >
                <td className="px-4 py-3 text-sm text-gray-900 dark:text-gray-100">
                  {new Date(transaction.date + 'T12:00:00').toLocaleDateString('de-DE')}
                </td>
                <td className="px-4 py-3 text-sm">
                  <div className="flex items-center gap-2">
                    <div className="group relative inline-block">
                      <span
                        className={`inline-flex items-center px-2 py-1 rounded-full text-xs font-medium cursor-help ${getTypeBadgeColor(
                          transaction.type
                        )}`}
                      >
                        {getTypeLabel(transaction.type)}
                      </span>
                      {getTypeDescription(transaction.type) && (
                        <div className="absolute left-0 top-8 w-64 p-2 bg-gray-900 dark:bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10">
                          {getTypeDescription(transaction.type)}
                        </div>
                      )}
                    </div>
                    {/* DD-41: Zustands-Badge des Storno-Paars — kein neuer case in getTypeBadgeColor,
                        Farbe ist nie alleiniger Traeger (Badge-Text traegt die Aussage). */}
                    {stateLabel && (
                      <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-300">
                        {stateLabel}
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-gray-700 dark:text-gray-300">
                  <div className="flex items-center gap-2">
                    <FileText className="w-4 h-4 text-gray-400" />
                    {transaction.description || '-'}
                  </div>
                  {transaction.type === 'model_change' && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                      Periode ab {new Date(transaction.date + 'T12:00:00').toLocaleDateString('de-DE')}
                      {transaction.createdAt && formatCreatedAtDe(transaction.createdAt) &&
                        ` · eingetragen am ${formatCreatedAtDe(transaction.createdAt)}`}
                      {transaction.adminName ? ` von ${transaction.adminName}` : ''}
                    </p>
                  )}
                  {/* Phase 13 (REQ-31, DD-43): zweite Beschreibungszeile des Storno-Paars,
                      zusaetzlich zur bestehenden model_change-Zeile darueber. */}
                  {noteLine && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">{noteLine}</p>
                  )}
                  {partnerId !== null && (
                    <button
                      type="button"
                      onClick={() => handleReceiptChipClick(transaction)}
                      aria-label={receiptChipAriaLabel(!!transaction.reversedBy)}
                      className="mt-1 inline-flex items-center gap-1 text-xs text-gray-500 dark:text-gray-400 underline decoration-dotted hover:text-gray-700 dark:hover:text-gray-200 focus:ring-2 focus:ring-blue-500 rounded"
                    >
                      <Link2 className="w-3 h-3" />
                      {receiptChipLabel(transaction.referenceId)}
                    </button>
                  )}
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <div className="flex items-center justify-end gap-1">
                    {transaction.type === 'model_change' ? (
                      /*
                       * Server-CR-01: Die Journalzeile ist eine reine Dokumentationszeile.
                       * Ihr `hours` ist bewusst 0, weil die Wirkung der Umstellung bereits
                       * in den neu gerechneten Tageszeilen steckt — wuerde sie zusaetzlich
                       * summieren, laege die Summe der angezeigten Zeilen um genau diesen
                       * Betrag ueber dem daneben angezeigten Saldo.
                       *
                       * "0,0 h" waere fuer den Leser aber falsch: die Umstellung HAT einen
                       * Betrag bewirkt, er steht nur nicht in dieser Zeile. Deshalb zeigt
                       * die Spalte den dokumentierten Betrag aus `documentedDelta` unter
                       * einer ausdruecklichen Beschriftung, und die Fussnote unter der
                       * Tabelle sagt, dass er nicht mitsummiert. Kein Trendpfeil — der ist
                       * den summierenden Zeilen vorbehalten; Vorzeichen und Farbe tragen
                       * die Richtung (Farbe ist nie alleiniger Traeger).
                       */
                      <div className="flex flex-col items-end">
                        <span className="text-xs text-gray-500 dark:text-gray-400">
                          dokumentierte Differenz
                        </span>
                        <span className={`font-bold ${documentedDeltaToneClass(transaction.documentedDelta)}`}>
                          {formatDocumentedDelta(transaction.documentedDelta)}
                        </span>
                      </div>
                    ) : isAbsenceType(transaction.type) ? (
                      // Absence types: neutral display (no icon, no hours shown)
                      <span className="text-gray-500 dark:text-gray-400 italic">
                        —
                      </span>
                    ) : (
                      // Regular types: show hours with +/- icons
                      <>
                        {transaction.hours > 0 ? (
                          <TrendingUp className="w-4 h-4 text-green-700 dark:text-green-400" />
                        ) : transaction.hours < 0 ? (
                          <TrendingDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                        ) : null}
                        <span
                          className={`font-bold ${
                            transaction.hours > 0
                              ? 'text-green-700 dark:text-green-400'
                              : transaction.hours < 0
                              ? 'text-red-600 dark:text-red-400'
                              : 'text-gray-600 dark:text-gray-400'
                          }`}
                        >
                          {transaction.hours > 0 ? '+' : ''}
                          {formatHours(transaction.hours)}
                        </span>
                      </>
                    )}
                  </div>
                </td>
              </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          {data.transactions.length} {data.transactions.length === 1 ? 'Transaktion' : 'Transaktionen'}
          {year && month && ` (${new Date(year, month - 1).toLocaleDateString('de-DE', { month: 'long', year: 'numeric' })})`}
          {year && !month && ` (${year})`}
          {limit && data.transactions.length >= limit && ` • Maximal ${limit} angezeigt`}
        </p>
        {hasModelChange && (
          <p className="mt-2 text-xs text-gray-500 dark:text-gray-400">
            Zeilen vom Typ „Modellwechsel" dokumentieren die Differenz, die eine Umstellung des
            Arbeitszeitmodells bewirkt hat. Der Betrag zählt <strong>nicht</strong> zusätzlich zum
            Saldo — er steckt bereits in den neu gerechneten Tageszeilen ab dem Stichtag.
          </p>
        )}
      </div>
    </Card>
  );
}
