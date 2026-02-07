import { useState } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, ReferenceLine } from 'recharts';
import { TrendingUp, BarChart3, Calendar } from 'lucide-react';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useOvertimeReport } from '../../hooks/useOvertimeReports';
import type { OvertimeHistoryEntry } from '../../hooks/useOvertimeReports';

interface OvertimeChartProps {
  data: OvertimeHistoryEntry[]; // Monthly data (for year/multi-month view)
  userId?: number;               // User ID (for daily drill-down)
  year?: number;                 // Selected year filter
  month?: number;                // Selected month filter (1-12)
}

type ChartMode = 'balance' | 'changes';
type Granularity = 'monthly' | 'daily';

/**
 * Overtime Chart Component (Dual-Mode + Adaptive Granularity)
 *
 * GRANULARITY (Adaptive like Personio/SAP):
 * - No filter / Year filter → Monthly view (12 data points)
 * - Month filter → Daily view (28-31 data points)
 *
 * MODE 1: Balance View (Saldo-Ansicht)
 * - Shows cumulative overtime balance over time
 * - Single line chart with reference line at 0
 * - Focus: Overall trend (am I accumulating or using overtime?)
 *
 * MODE 2: Changes View (Änderungs-Ansicht)
 * - Shows monthly/daily changes that affect balance
 * - Stacked bars (earned, compensation, correction) + line (net change)
 * - Focus: What happened each period? (breakdown of changes)
 */
export function OvertimeChart({ data, userId, year, month }: OvertimeChartProps) {
  const [chartMode, setChartMode] = useState<ChartMode>('balance');

  // Determine granularity: If month is selected → daily, otherwise → monthly
  const granularity: Granularity = month && userId && year ? 'daily' : 'monthly';

  // Fetch daily data ONLY if month is selected and we have valid userId
  // CRITICAL: Don't pass userId=0 (would trigger query), pass undefined instead
  const { data: dailyReport, isLoading: isDailyLoading } = useOvertimeReport(
    userId ?? 0, // Use nullish coalescing to handle undefined properly
    year || new Date().getFullYear(),
    month,
    granularity === 'daily' // Pass enabled flag
  );

  // Use daily data if available, otherwise fallback to monthly data
  const useDaily = granularity === 'daily' && dailyReport?.breakdown?.daily;

  // Format month label for X-axis (monthly view)
  const formatMonth = (monthStr: string) => {
    const [year, month] = monthStr.split('-');
    const date = new Date(parseInt(year), parseInt(month) - 1);
    return date.toLocaleDateString('de-DE', { month: 'short', year: '2-digit' });
  };

  // Format date label for X-axis (daily view)
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr + 'T12:00:00');
    return date.toLocaleDateString('de-DE', { day: '2-digit', month: 'short' });
  };

  // Transform data based on granularity
  const chartData = useDaily
    ? // DAILY VIEW: Transform daily breakdown data
      (() => {
        let runningBalance = 0;
        return (dailyReport?.breakdown?.daily || []).map(day => {
          runningBalance += day.overtime;
          return {
            label: formatDate(day.date),
            fullDate: day.date,
            'Saldo': parseFloat(runningBalance.toFixed(2)),
            'Verdient': parseFloat(day.overtime.toFixed(2)),
            'Ausgleich': 0, // Daily breakdown doesn't separate these
            'Korrektur': 0,
            'Änderung': parseFloat(day.overtime.toFixed(2)),
          };
        });
      })()
    : // MONTHLY VIEW: Transform monthly history data
      [...data].reverse().map(entry => ({
        label: formatMonth(entry.month),
        fullDate: entry.month,
        'Saldo': parseFloat((entry.balance).toFixed(2)),
        'Verdient': parseFloat((entry.earned).toFixed(2)),
        'Ausgleich': parseFloat((Math.abs(entry.compensation)).toFixed(2)),
        'Korrektur': parseFloat((entry.correction).toFixed(2)),
        'Änderung': parseFloat((entry.balanceChange).toFixed(2)),
      }));

  // Custom tooltip for Balance mode
  const BalanceTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
          <p className="text-sm text-purple-600 dark:text-purple-400">
            Saldo: {payload[0].value > 0 ? '+' : ''}{payload[0].value.toFixed(1)}h
          </p>
        </div>
      );
    }
    return null;
  };

  // Custom tooltip for Changes mode
  const ChangesTooltip = ({ active, payload, label }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg p-3">
          <p className="font-semibold text-gray-900 dark:text-gray-100 mb-2">{label}</p>
          {payload.map((entry: any) => (
            <p
              key={entry.name}
              className="text-sm"
              style={{ color: entry.color }}
            >
              {entry.name}: {entry.name === 'Ausgleich' ? '-' : (entry.value > 0 ? '+' : '')}{entry.value.toFixed(1)}h
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  // Show loading state if fetching daily data
  if (granularity === 'daily' && isDailyLoading) {
    return (
      <div className="w-full h-80 flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Show granularity indicator
  const granularityBadge = granularity === 'daily' ? (
    <div className="inline-flex items-center gap-1.5 px-3 py-1 bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 rounded-full text-sm">
      <Calendar className="w-3.5 h-3.5" />
      Tagesansicht
    </div>
  ) : null;

  return (
    <div className="w-full">
      {/* Mode Toggle + Granularity Badge */}
      <div className="flex flex-col items-center gap-3 mb-4">
        {/* Granularity Badge */}
        {granularityBadge}

        {/* Mode Toggle */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setChartMode('balance')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              chartMode === 'balance'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <TrendingUp className="w-4 h-4" />
            Saldo-Ansicht
          </button>
          <button
            onClick={() => setChartMode('changes')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              chartMode === 'changes'
                ? 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300'
                : 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-700'
            }`}
          >
            <BarChart3 className="w-4 h-4" />
            Änderungs-Ansicht
          </button>
        </div>
      </div>

      {/* Chart Container */}
      <div className="w-full h-80">
        <ResponsiveContainer width="100%" height="100%">
          {chartMode === 'balance' ? (
            // MODE 1: Balance View (Saldo-Ansicht)
            <LineChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="label"
                className="text-xs text-gray-600 dark:text-gray-400"
                stroke="currentColor"
              />
              <YAxis
                className="text-xs text-gray-600 dark:text-gray-400"
                stroke="currentColor"
                label={{ value: 'Stunden', angle: -90, position: 'insideLeft', className: 'text-gray-600 dark:text-gray-400' }}
              />
              <Tooltip content={<BalanceTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                iconType="line"
                className="text-sm"
              />
              <ReferenceLine
                y={0}
                stroke="#9CA3AF"
                strokeDasharray="3 3"
                label={{ value: 'Ausgeglichen', position: 'insideTopRight', fill: '#9CA3AF', fontSize: 12 }}
              />

              {/* Saldo line (cumulative balance) */}
              <Line
                type="monotone"
                dataKey="Saldo"
                name="Überstunden-Saldo"
                stroke="#8B5CF6"
                strokeWidth={3}
                dot={{ fill: '#8B5CF6', r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          ) : (
            // MODE 2: Changes View (Änderungs-Ansicht)
            <BarChart
              data={chartData}
              margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200 dark:stroke-gray-700" />
              <XAxis
                dataKey="label"
                className="text-xs text-gray-600 dark:text-gray-400"
                stroke="currentColor"
              />
              <YAxis
                className="text-xs text-gray-600 dark:text-gray-400"
                stroke="currentColor"
                label={{ value: 'Stunden', angle: -90, position: 'insideLeft', className: 'text-gray-600 dark:text-gray-400' }}
              />
              <Tooltip content={<ChangesTooltip />} />
              <Legend
                wrapperStyle={{ paddingTop: '20px' }}
                className="text-sm"
              />
              <ReferenceLine y={0} stroke="#9CA3AF" strokeDasharray="3 3" />

              {/* Stacked bars for monthly changes */}
              <Bar
                dataKey="Verdient"
                name="Verdient"
                fill="#10B981"
                stackId="changes"
              />
              <Bar
                dataKey="Ausgleich"
                name="Ausgleich"
                fill="#F59E0B"
                stackId="changes"
              />
              <Bar
                dataKey="Korrektur"
                name="Korrektur"
                fill="#8B5CF6"
                stackId="changes"
              />

              {/* Line showing net change */}
              <Line
                type="monotone"
                dataKey="Änderung"
                name="Netto-Änderung"
                stroke="#6B7280"
                strokeWidth={2}
                dot={{ fill: '#6B7280', r: 3 }}
                activeDot={{ r: 5 }}
              />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>

      {/* Legend Explanation */}
      <div className="mt-4 text-xs text-gray-500 dark:text-gray-400 text-center">
        {chartMode === 'balance' ? (
          <p>Zeigt den kumulierten Überstunden-Saldo über die Zeit. Werte über 0 = positive Überstunden, unter 0 = Minusstunden.</p>
        ) : (
          <p>Zeigt {granularity === 'daily' ? 'tägliche' : 'monatliche'} Änderungen: Verdient (gearbeitet), {granularity === 'monthly' ? 'Ausgleich (genommen), Korrektur (Admin), ' : ''}Netto-Änderung (Summe).</p>
        )}
      </div>
    </div>
  );
}
