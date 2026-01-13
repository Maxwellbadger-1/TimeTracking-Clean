import { Wifi, WifiOff, CloudOff } from 'lucide-react';
import { useConnectionStatus } from '../../hooks';

export function ConnectionStatusIndicator() {
  const { status, isOnline, isServerReachable, lastChecked, apiUrl } = useConnectionStatus();

  // Icon and color based on status
  const getStatusConfig = () => {
    switch (status) {
      case 'online':
        return {
          Icon: Wifi,
          color: 'text-green-600 dark:text-green-400',
          bgColor: 'bg-green-100 dark:bg-green-900/20',
          label: 'Online',
          description: 'Verbindung zum Server aktiv',
        };
      case 'offline':
        return {
          Icon: WifiOff,
          color: 'text-red-600 dark:text-red-400',
          bgColor: 'bg-red-100 dark:bg-red-900/20',
          label: 'Offline',
          description: 'Keine Internetverbindung',
        };
      case 'server-offline':
        return {
          Icon: CloudOff,
          color: 'text-yellow-600 dark:text-yellow-400',
          bgColor: 'bg-yellow-100 dark:bg-yellow-900/20',
          label: 'Server nicht erreichbar',
          description: 'Internetverbindung vorhanden, aber Server antwortet nicht',
        };
    }
  };

  const config = getStatusConfig();
  const Icon = config.Icon;

  // Format last checked time
  const formatLastChecked = () => {
    if (!lastChecked) return 'Noch nicht geprüft';
    const now = new Date();
    const diff = Math.floor((now.getTime() - lastChecked.getTime()) / 1000);

    if (diff < 60) return `Vor ${diff} Sekunden`;
    if (diff < 3600) return `Vor ${Math.floor(diff / 60)} Minuten`;
    return lastChecked.toLocaleTimeString('de-DE', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <div className="relative group">
      {/* Status Icon */}
      <div className={`p-2 rounded-lg transition-all ${config.bgColor} ${config.color} cursor-help`}>
        <Icon className="w-5 h-5" />
      </div>

      {/* Tooltip */}
      <div className="absolute right-0 top-full mt-2 w-64 p-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-50">
        <div className="space-y-2">
          {/* Status Header */}
          <div className="flex items-center space-x-2">
            <Icon className={`w-4 h-4 ${config.color}`} />
            <span className="font-semibold text-sm text-gray-900 dark:text-gray-100">
              {config.label}
            </span>
          </div>

          {/* Description */}
          <p className="text-xs text-gray-600 dark:text-gray-400">
            {config.description}
          </p>

          {/* Details */}
          <div className="pt-2 border-t border-gray-200 dark:border-gray-700 space-y-1">
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Browser:</span>
              <span className={isOnline ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {isOnline ? 'Online' : 'Offline'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Server:</span>
              <span className={isServerReachable ? 'text-green-600 dark:text-green-400' : 'text-red-600 dark:text-red-400'}>
                {isServerReachable ? 'Erreichbar' : 'Nicht erreichbar'}
              </span>
            </div>
            <div className="flex justify-between text-xs">
              <span className="text-gray-500 dark:text-gray-400">Geprüft:</span>
              <span className="text-gray-700 dark:text-gray-300">
                {formatLastChecked()}
              </span>
            </div>
            <div className="pt-2 border-t border-gray-200 dark:border-gray-700">
              <span className="text-gray-500 dark:text-gray-400 text-xs block mb-1">API URL:</span>
              <span className="text-gray-700 dark:text-gray-300 text-xs font-mono break-all">
                {apiUrl}
              </span>
            </div>
          </div>
        </div>

        {/* Tooltip Arrow */}
        <div className="absolute right-4 -top-1 w-2 h-2 bg-white dark:bg-gray-800 border-l border-t border-gray-200 dark:border-gray-700 transform rotate-45"></div>
      </div>
    </div>
  );
}
