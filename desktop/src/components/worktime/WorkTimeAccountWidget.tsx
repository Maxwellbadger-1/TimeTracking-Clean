import { Card } from '../ui/Card';
import { LoadingSpinner } from '../ui/LoadingSpinner';
import { useWorkTimeAccount, useBalanceStatus } from '../../hooks/useWorkTimeAccounts';
import {
  Clock,
  TrendingUp,
  TrendingDown,
  AlertCircle,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';
import { formatHours } from '../../utils/timeUtils';

interface WorkTimeAccountWidgetProps {
  userId?: number;
  isAdmin?: boolean;
}

export function WorkTimeAccountWidget({ userId }: WorkTimeAccountWidgetProps) {
  const { data: account, isLoading: accountLoading } = useWorkTimeAccount(userId);
  const { data: status, isLoading: statusLoading } = useBalanceStatus(userId);

  const isLoading = accountLoading || statusLoading;

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Arbeitszeitkonto
          </h3>
        </div>
        <div className="flex justify-center py-8">
          <LoadingSpinner />
        </div>
      </Card>
    );
  }

  if (!account || !status) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-3 mb-4">
          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Arbeitszeitkonto
          </h3>
        </div>
        <p className="text-center text-gray-500 dark:text-gray-400 py-4">
          Kein Zeitkonto verfügbar
        </p>
      </Card>
    );
  }

  const getStatusIcon = () => {
    switch (status.status) {
      case 'critical_high':
        return <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />;
      case 'warning_high':
        return <AlertTriangle className="w-6 h-6 text-yellow-600 dark:text-yellow-400" />;
      case 'normal':
        return <CheckCircle className="w-6 h-6 text-green-600 dark:text-green-400" />;
      case 'warning_low':
        return <AlertTriangle className="w-6 h-6 text-orange-600 dark:text-orange-400" />;
      case 'critical_low':
        return <AlertCircle className="w-6 h-6 text-red-600 dark:text-red-400" />;
    }
  };

  const getStatusColor = () => {
    switch (status.status) {
      case 'critical_high':
      case 'critical_low':
        return 'text-red-600 dark:text-red-400';
      case 'warning_high':
      case 'warning_low':
        return 'text-yellow-600 dark:text-yellow-400';
      case 'normal':
        return 'text-green-600 dark:text-green-400';
    }
  };

  const getStatusBgColor = () => {
    switch (status.status) {
      case 'critical_high':
      case 'critical_low':
        return 'bg-red-50 dark:bg-red-900/20 border-red-200 dark:border-red-800';
      case 'warning_high':
      case 'warning_low':
        return 'bg-yellow-50 dark:bg-yellow-900/20 border-yellow-200 dark:border-yellow-800';
      case 'normal':
        return 'bg-green-50 dark:bg-green-900/20 border-green-200 dark:border-green-800';
    }
  };

  const getStatusText = () => {
    if (status.status === 'critical_high') {
      return 'Maximum erreicht! Bitte Überstunden abbauen.';
    }
    if (status.status === 'warning_high') {
      return 'Warnung: Nähert sich dem Maximum';
    }
    if (status.status === 'critical_low') {
      return 'Minimum erreicht! Bitte Minusstunden ausgleichen.';
    }
    if (status.status === 'warning_low') {
      return 'Warnung: Nähert sich dem Minimum';
    }
    return 'Zeitkonto im normalen Bereich';
  };

  const percentage = Math.abs(status.percentage);
  const isPositive = account.currentBalance >= 0;

  return (
    <Card className="p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Clock className="w-5 h-5 text-purple-600 dark:text-purple-400" />
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Arbeitszeitkonto
          </h3>
        </div>
        {getStatusIcon()}
      </div>

      {/* Current Balance */}
      <div className="mb-6">
        <div className="flex items-baseline gap-2 mb-2">
          {isPositive ? (
            <TrendingUp className="w-5 h-5 text-green-600 dark:text-green-400" />
          ) : (
            <TrendingDown className="w-5 h-5 text-red-600 dark:text-red-400" />
          )}
          <span className={`text-3xl font-bold ${getStatusColor()}`}>
            {isPositive ? '+' : ''}
            {formatHours(account.currentBalance)}
          </span>
        </div>
        <p className="text-sm text-gray-500 dark:text-gray-400">
          Aktueller Saldo
        </p>
      </div>

      {/* Progress Bar */}
      <div className="mb-6">
        <div className="flex justify-between text-xs text-gray-600 dark:text-gray-400 mb-2">
          <span>{formatHours(account.maxMinusHours)}</span>
          <span>0h</span>
          <span>+{formatHours(account.maxPlusHours)}</span>
        </div>
        <div className="h-3 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
          <div
            className={`h-full transition-all duration-500 ${
              isPositive
                ? status.status === 'critical_high'
                  ? 'bg-red-500'
                  : status.status === 'warning_high'
                  ? 'bg-yellow-500'
                  : 'bg-green-500'
                : status.status === 'critical_low'
                ? 'bg-red-500'
                : status.status === 'warning_low'
                ? 'bg-orange-500'
                : 'bg-blue-500'
            }`}
            style={{
              width: `${percentage}%`,
              marginLeft: isPositive ? '50%' : `${50 - percentage}%`,
            }}
          />
        </div>
        <div className="flex justify-center mt-2">
          <span className="text-xs font-medium text-gray-600 dark:text-gray-400">
            {percentage.toFixed(1)}% {isPositive ? 'vom Maximum' : 'vom Minimum'}
          </span>
        </div>
      </div>

      {/* Status Message */}
      {status.status !== 'normal' && (
        <div className={`border rounded-lg p-3 ${getStatusBgColor()}`}>
          <p className={`text-sm font-medium ${getStatusColor()}`}>
            {getStatusText()}
          </p>
        </div>
      )}

      {/* Recommendations */}
      {(status.canTakeTimeOff || status.shouldReduceOvertime) && status.status === 'normal' && (
        <div className="mt-4 space-y-2">
          {status.canTakeTimeOff && (
            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <CheckCircle className="w-4 h-4 text-green-600 dark:text-green-400 mt-0.5 flex-shrink-0" />
              <p>Sie können Überstundenausgleich nehmen (≥8h verfügbar)</p>
            </div>
          )}
          {status.shouldReduceOvertime && (
            <div className="flex items-start gap-2 text-sm text-gray-700 dark:text-gray-300">
              <AlertTriangle className="w-4 h-4 text-yellow-600 dark:text-yellow-400 mt-0.5 flex-shrink-0" />
              <p>Empfehlung: Überstunden reduzieren</p>
            </div>
          )}
        </div>
      )}

      {/* Last Updated */}
      <div className="mt-4 pt-4 border-t border-gray-200 dark:border-gray-700">
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Zuletzt aktualisiert: {new Date(account.lastUpdated).toLocaleString('de-DE')}
        </p>
      </div>
    </Card>
  );
}
