import { WifiOff, CloudOff, RefreshCw } from 'lucide-react';
import { useConnectionStatus } from '../../hooks';
import { Button } from './Button';

export function OfflineBanner() {
  const { status, isOnline, isServerReachable, apiUrl } = useConnectionStatus();

  // Only show banner when offline or server unreachable
  if (status === 'online') {
    return null;
  }

  const handleRefresh = () => {
    window.location.reload();
  };

  return (
    <div
      className={`fixed top-0 left-0 right-0 z-50 ${
        status === 'offline'
          ? 'bg-red-600 dark:bg-red-700'
          : 'bg-yellow-600 dark:bg-yellow-700'
      }`}
    >
      <div className="max-w-7xl mx-auto px-4 py-3">
        <div className="flex items-center justify-between">
          {/* Left: Icon + Message */}
          <div className="flex items-center space-x-3">
            {status === 'offline' ? (
              <WifiOff className="w-5 h-5 text-white" />
            ) : (
              <CloudOff className="w-5 h-5 text-white" />
            )}

            <div className="flex flex-col">
              <span className="text-white font-semibold text-sm">
                {status === 'offline' ? 'Keine Internetverbindung' : 'Server nicht erreichbar'}
              </span>
              <span className="text-white/80 text-xs">
                {status === 'offline'
                  ? 'Bitte überprüfen Sie Ihre Internetverbindung'
                  : `Die Verbindung zum Server ist unterbrochen. Ihre Daten werden möglicherweise nicht gespeichert. (${apiUrl})`}
              </span>
            </div>
          </div>

          {/* Right: Status Details + Refresh Button */}
          <div className="flex items-center space-x-4">
            {/* Status Details */}
            <div className="hidden md:flex items-center space-x-4 text-xs text-white/90">
              <div className="flex items-center space-x-1">
                <span>Browser:</span>
                <span className="font-semibold">{isOnline ? 'Online' : 'Offline'}</span>
              </div>
              <div className="w-px h-4 bg-white/30"></div>
              <div className="flex items-center space-x-1">
                <span>Server:</span>
                <span className="font-semibold">
                  {isServerReachable ? 'Erreichbar' : 'Nicht erreichbar'}
                </span>
              </div>
            </div>

            {/* Refresh Button */}
            <Button
              variant="ghost"
              size="sm"
              onClick={handleRefresh}
              className="text-white hover:bg-white/10 border-white/30"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Neu laden
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}
