import { useState, useEffect } from 'react';
import { X, ChevronDown, ChevronUp } from 'lucide-react';

interface LogEntry {
  timestamp: string;
  type: 'request' | 'response' | 'error' | 'info';
  method?: string;
  url?: string;
  status?: number;
  data?: any;
  message?: string;
}

export default function DebugPanel() {
  const [isOpen, setIsOpen] = useState(true);
  const [isMinimized, setIsMinimized] = useState(false);
  const [logs, setLogs] = useState<LogEntry[]>([]);

  useEffect(() => {
    // Listen for custom debug events
    const handleDebugLog = (event: CustomEvent) => {
      const logEntry = { ...event.detail, timestamp: new Date().toISOString() };
      setLogs((prev) => [...prev, logEntry]);

      // Write to console for automated reading
      console.log('[DEBUG-LOG]', JSON.stringify(logEntry));
    };

    window.addEventListener('debug-log' as any, handleDebugLog);

    // Add info log on mount
    addLog({
      type: 'info',
      message: '🔍 Debug Panel initialized - All API calls will be logged here',
    });

    return () => {
      window.removeEventListener('debug-log' as any, handleDebugLog);
    };
  }, []);

  const addLog = (entry: Omit<LogEntry, 'timestamp'>) => {
    const logEntry: LogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
    };
    setLogs((prev) => [...prev, logEntry]);
  };

  const clearLogs = () => {
    setLogs([]);
    addLog({
      type: 'info',
      message: '🧹 Logs cleared',
    });
  };

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg shadow-lg z-50 font-mono text-sm"
      >
        🔍 Debug
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-0 right-0 bg-gray-900 text-gray-100 shadow-2xl border-l border-t border-gray-700 z-50 font-mono text-xs ${
        isMinimized ? 'h-12' : 'h-96'
      } w-full md:w-2/3 lg:w-1/2 transition-all duration-200`}
    >
      {/* Header */}
      <div className="flex items-center justify-between bg-gray-800 px-4 py-2 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <span className="text-blue-400 font-bold">🔍 Debug Panel</span>
          <span className="text-gray-500">({logs.length} logs)</span>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={clearLogs}
            className="text-gray-400 hover:text-white px-2 py-1 rounded hover:bg-gray-700"
          >
            Clear
          </button>
          <button
            onClick={() => setIsMinimized(!isMinimized)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
          >
            {isMinimized ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          </button>
          <button
            onClick={() => setIsOpen(false)}
            className="text-gray-400 hover:text-white p-1 rounded hover:bg-gray-700"
          >
            <X size={16} />
          </button>
        </div>
      </div>

      {/* Logs */}
      {!isMinimized && (
        <div className="overflow-y-auto h-full p-4 space-y-2">
          {logs.length === 0 && (
            <div className="text-gray-500 text-center py-8">
              No logs yet. Waiting for API calls...
            </div>
          )}

          {logs.map((log, index) => (
            <div
              key={index}
              className={`p-3 rounded border ${
                log.type === 'request'
                  ? 'bg-blue-900/20 border-blue-700'
                  : log.type === 'response'
                  ? 'bg-green-900/20 border-green-700'
                  : log.type === 'error'
                  ? 'bg-red-900/20 border-red-700'
                  : 'bg-gray-800 border-gray-700'
              }`}
            >
              {/* Timestamp */}
              <div className="text-gray-500 text-[10px] mb-1">
                {new Date(log.timestamp).toLocaleTimeString()}.
                {new Date(log.timestamp).getMilliseconds()}
              </div>

              {/* Type Badge */}
              <div className="flex items-center gap-2 mb-2">
                <span
                  className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                    log.type === 'request'
                      ? 'bg-blue-600 text-white'
                      : log.type === 'response'
                      ? 'bg-green-600 text-white'
                      : log.type === 'error'
                      ? 'bg-red-600 text-white'
                      : 'bg-gray-600 text-white'
                  }`}
                >
                  {log.type.toUpperCase()}
                </span>

                {log.method && (
                  <span className="px-2 py-0.5 bg-purple-600 text-white rounded text-[10px] font-bold">
                    {log.method}
                  </span>
                )}

                {log.status && (
                  <span
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      log.status >= 200 && log.status < 300
                        ? 'bg-green-600 text-white'
                        : log.status >= 400
                        ? 'bg-red-600 text-white'
                        : 'bg-yellow-600 text-white'
                    }`}
                  >
                    {log.status}
                  </span>
                )}
              </div>

              {/* URL */}
              {log.url && (
                <div className="text-blue-300 break-all mb-2">{log.url}</div>
              )}

              {/* Message */}
              {log.message && (
                <div className="text-gray-300 whitespace-pre-wrap">
                  {log.message}
                </div>
              )}

              {/* Data */}
              {log.data && (
                <details className="mt-2">
                  <summary className="cursor-pointer text-gray-400 hover:text-white">
                    View Data
                  </summary>
                  <pre className="mt-2 p-2 bg-black/50 rounded text-[10px] overflow-x-auto">
                    {JSON.stringify(log.data, null, 2)}
                  </pre>
                </details>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// Helper function to dispatch debug logs
export function debugLog(entry: Omit<LogEntry, 'timestamp'>) {
  const event = new CustomEvent('debug-log', {
    detail: {
      ...entry,
      timestamp: new Date().toISOString(),
    },
  });
  window.dispatchEvent(event);
}
