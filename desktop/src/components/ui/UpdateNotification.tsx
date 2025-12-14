/**
 * Update Notification Component
 *
 * Professional update banner (inspired by VS Code, Slack)
 * - Appears at top of app when update available
 * - Non-intrusive, can be dismissed
 * - Clear action buttons
 */

import { useState } from 'react';
import type { Update } from '@tauri-apps/plugin-updater';

interface UpdateNotificationProps {
  update: Update;
  downloading: boolean;
  readyToInstall: boolean;
  onDownload: () => void;
  onRestart: () => void;
}

export function UpdateNotification({
  update,
  downloading,
  readyToInstall,
  onDownload,
  onRestart,
}: UpdateNotificationProps) {
  const [dismissed, setDismissed] = useState(false);

  if (dismissed) return null;

  return (
    <div className="fixed top-0 left-0 right-0 z-50 bg-blue-600 dark:bg-blue-700 text-white shadow-lg">
      <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between gap-4">
        {/* Left: Icon + Message */}
        <div className="flex items-center gap-3">
          <svg
            className="w-5 h-5 flex-shrink-0"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12"
            />
          </svg>

          <div className="flex flex-col gap-1">
            <p className="text-sm font-medium">
              {readyToInstall
                ? 'Update erfolgreich heruntergeladen!'
                : `Neue Version verfügbar: ${update.version}`}
            </p>
            <p className="text-xs opacity-90">
              {readyToInstall
                ? 'Starte die App neu, um die neueste Version zu installieren.'
                : `Aktuelle Version: ${update.currentVersion}`}
            </p>
          </div>
        </div>

        {/* Right: Action Buttons */}
        <div className="flex items-center gap-2">
          {!readyToInstall && !downloading && (
            <button
              onClick={onDownload}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Jetzt herunterladen
            </button>
          )}

          {downloading && (
            <div className="flex items-center gap-2 px-4 py-2">
              <svg
                className="animate-spin h-4 w-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
              <span className="text-sm">Wird heruntergeladen...</span>
            </div>
          )}

          {readyToInstall && (
            <button
              onClick={onRestart}
              className="px-4 py-2 bg-white text-blue-600 rounded-lg text-sm font-medium hover:bg-blue-50 transition-colors"
            >
              Jetzt neu starten
            </button>
          )}

          {!readyToInstall && (
            <button
              onClick={() => setDismissed(true)}
              className="px-3 py-2 text-white/80 hover:text-white hover:bg-white/10 rounded-lg text-sm transition-colors"
            >
              Später
            </button>
          )}

          <button
            onClick={() => setDismissed(true)}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
            aria-label="Schließen"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
