import { useState, useEffect } from 'react';
import { universalFetch } from '../lib/tauriHttpClient';

export type ConnectionStatus = 'online' | 'offline' | 'server-offline';

export interface ConnectionState {
  status: ConnectionStatus;
  isOnline: boolean;
  isServerReachable: boolean;
  lastChecked: Date | null;
  apiUrl: string;
}

/**
 * Hook to monitor connection status
 * - Monitors browser online/offline state (navigator.onLine)
 * - Performs health checks every 30 seconds to verify server reachability
 * - Returns connection status and detailed state
 */
export function useConnectionStatus(): ConnectionState {
  const [browserOnline, setBrowserOnline] = useState(navigator.onLine);
  const [serverReachable, setServerReachable] = useState(true);
  const [lastChecked, setLastChecked] = useState<Date | null>(null);

  // Get the API URL being used (for debugging)
  const apiUrl = import.meta.env.VITE_API_URL || 'http://localhost:3000';

  // Monitor browser online/offline events
  useEffect(() => {
    const handleOnline = () => {
      setBrowserOnline(true);
    };

    const handleOffline = () => {
      setBrowserOnline(false);
      setServerReachable(false); // If browser is offline, server is also unreachable
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Health check polling (every 30 seconds)
  useEffect(() => {
    // Only run health checks if browser is online
    if (!browserOnline) {
      return;
    }

    const checkServerHealth = async () => {
      const healthUrl = `${apiUrl}/health`;

      try {
        const response = await universalFetch(healthUrl, {
          method: 'GET',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
        });

        // Parse JSON from Response object
        const data = await response.json();
        const isHealthy = response.ok && data.status === 'ok';
        setServerReachable(isHealthy);
        setLastChecked(new Date());

        // Only log failures (console.error survives production build)
        if (!isHealthy) {
          console.error(`Server health check failed at ${healthUrl}:`, { status: response.status, data });
        }
      } catch (error) {
        console.error(`Server health check error at ${healthUrl}:`, error);
        setServerReachable(false);
        setLastChecked(new Date());
      }
    };

    // Initial check
    checkServerHealth();

    // Poll every 30 seconds
    const interval = setInterval(checkServerHealth, 30000);

    return () => clearInterval(interval);
  }, [browserOnline]);

  // Determine overall connection status
  const getConnectionStatus = (): ConnectionStatus => {
    if (!browserOnline) {
      return 'offline';
    }

    if (!serverReachable) {
      return 'server-offline';
    }

    return 'online';
  };

  return {
    status: getConnectionStatus(),
    isOnline: browserOnline,
    isServerReachable: serverReachable,
    lastChecked,
    apiUrl,
  };
}
