import { useState, useEffect } from 'react';

interface ServerResponse {
  success: boolean;
  message: string;
  data?: {
    serverTime: string;
    nodeVersion: string;
  };
}

export default function App() {
  const [serverStatus, setServerStatus] = useState<'checking' | 'connected' | 'error'>('checking');
  const [serverData, setServerData] = useState<ServerResponse | null>(null);

  useEffect(() => {
    checkServerConnection();
  }, []);

  const checkServerConnection = async () => {
    try {
      const response = await fetch('http://localhost:3000/api/test');
      const data: ServerResponse = await response.json();

      setServerData(data);
      setServerStatus('connected');
    } catch (error) {
      console.error('Server connection failed:', error);
      setServerStatus('error');
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-8">
      <div className="max-w-2xl w-full">
        <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-xl p-8">
          <div className="text-center mb-8">
            <h1 className="text-5xl font-bold text-gray-900 dark:text-white mb-4">
              TimeTracking System
            </h1>
            <p className="text-xl text-gray-600 dark:text-gray-400">
              Phase 0: Setup Complete ✅
            </p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-2">
              Desktop App powered by Tauri + React
            </p>
          </div>

          <div className="space-y-4">
            <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-6">
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Server Connection Status
              </h2>

              <div className="flex items-center space-x-3">
                {serverStatus === 'checking' && (
                  <>
                    <div className="w-3 h-3 bg-yellow-500 rounded-full animate-pulse"></div>
                    <span className="text-gray-700 dark:text-gray-300">Checking server...</span>
                  </>
                )}

                {serverStatus === 'connected' && (
                  <>
                    <div className="w-3 h-3 bg-green-500 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-300">Connected to server ✓</span>
                  </>
                )}

                {serverStatus === 'error' && (
                  <>
                    <div className="w-3 h-3 bg-red-500 rounded-full"></div>
                    <span className="text-gray-700 dark:text-gray-300">Server not reachable</span>
                  </>
                )}
              </div>

              {serverData && serverStatus === 'connected' && (
                <div className="mt-4 text-sm text-gray-600 dark:text-gray-400">
                  <p>Server Time: {new Date(serverData.data?.serverTime || '').toLocaleString()}</p>
                  <p>Node Version: {serverData.data?.nodeVersion}</p>
                </div>
              )}

              {serverStatus === 'error' && (
                <div className="mt-4">
                  <p className="text-sm text-red-600 dark:text-red-400 mb-2">
                    Make sure the backend server is running:
                  </p>
                  <code className="block bg-gray-900 text-gray-100 p-3 rounded text-xs">
                    npm run dev:server
                  </code>
                  <button
                    onClick={checkServerConnection}
                    className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                  >
                    Retry Connection
                  </button>
                </div>
              )}
            </div>

            <div className="bg-blue-50 dark:bg-blue-900/20 rounded-lg p-4">
              <p className="text-sm text-blue-900 dark:text-blue-200">
                <strong>Next Steps:</strong> Backend Foundation (Phase 1)
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
