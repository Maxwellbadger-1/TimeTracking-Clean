import { useState } from 'react';
import { check, Update } from '@tauri-apps/plugin-updater';
import { ask } from '@tauri-apps/plugin-dialog';
import { relaunch } from '@tauri-apps/plugin-process';
import { AlertCircle, CheckCircle, Download, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';

interface UpdateCheckerProps {
  autoCheckOnMount?: boolean;
}

export default function UpdateChecker({ autoCheckOnMount = false }: UpdateCheckerProps) {
  const [checking, setChecking] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [updateAvailable, setUpdateAvailable] = useState(false);
  const [updateInfo, setUpdateInfo] = useState<Update | null>(null);
  const [downloadProgress, setDownloadProgress] = useState(0);
  const [currentVersion] = useState('1.0.0'); // Aus package.json/tauri.conf.json

  // Auto-check on mount (optional, z.B. für automatische Prüfung beim App-Start)
  useState(() => {
    if (autoCheckOnMount) {
      checkForUpdates();
    }
  });

  async function checkForUpdates() {
    if (checking || downloading) return;

    setChecking(true);
    setUpdateAvailable(false);
    setUpdateInfo(null);

    try {
      console.log('🔍 Checking for updates...');
      const update = await check();

      if (update === null) {
        // Kein Release gefunden - normal wenn noch kein veröffentlichtes Release existiert
        toast.info('Keine Updates verfügbar', {
          description: 'Aktuell ist kein Update-Release veröffentlicht.'
        });
        return;
      }

      if (update.available) {
        console.log('✅ Update available:', update.version);
        setUpdateAvailable(true);
        setUpdateInfo(update);
        toast.success('Update verfügbar!', {
          description: `Version ${update.version} ist verfügbar.`
        });
      } else {
        console.log('✅ No updates available');
        toast.success('Keine Updates verfügbar', {
          description: 'Sie verwenden bereits die neueste Version.'
        });
      }
    } catch (error) {
      console.error('❌ Update check failed:', error);

      // Bessere Fehlermeldungen
      const errorMessage = error instanceof Error ? error.message : 'Unbekannter Fehler';

      if (errorMessage.includes('Could not fetch') || errorMessage.includes('release JSON')) {
        toast.warning('Update-Prüfung nicht möglich', {
          description: 'Es wurde noch kein Release veröffentlicht. Sobald ein Update verfügbar ist, erscheint es hier.'
        });
      } else if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
        toast.error('Netzwerkfehler', {
          description: 'Keine Verbindung zum Update-Server. Bitte Internetverbindung prüfen.'
        });
      } else {
        toast.error('Update-Prüfung fehlgeschlagen', {
          description: errorMessage
        });
      }
    } finally {
      setChecking(false);
    }
  }

  async function installUpdate() {
    if (!updateInfo || downloading) return;

    // User bestätigung
    const confirmed = await ask(
      `Update auf Version ${updateInfo.version} installieren?\n\nDie Anwendung wird nach dem Download neu gestartet.\n\n${updateInfo.body || 'Siehe Release Notes für Details.'}`,
      {
        title: 'Update installieren?',
        kind: 'info',
        okLabel: 'Jetzt updaten',
        cancelLabel: 'Abbrechen'
      }
    );

    if (!confirmed) return;

    setDownloading(true);
    setDownloadProgress(0);

    try {
      console.log('📥 Downloading update...');

      // Download und Install mit Progress-Tracking
      await updateInfo.downloadAndInstall((event) => {
        switch (event.event) {
          case 'Started':
            console.log('📦 Download started');
            setDownloadProgress(0);
            break;
          case 'Progress':
            const progress = Math.round((event.data.downloaded / event.data.contentLength) * 100);
            console.log(`📊 Download progress: ${progress}%`);
            setDownloadProgress(progress);
            break;
          case 'Finished':
            console.log('✅ Download finished');
            setDownloadProgress(100);
            break;
        }
      });

      console.log('🔄 Restarting application...');
      toast.success('Update installiert!', {
        description: 'Die Anwendung wird jetzt neu gestartet...'
      });

      // Kurze Verzögerung damit User den Toast sieht
      await new Promise(resolve => setTimeout(resolve, 1500));

      // App neu starten
      await relaunch();
    } catch (error) {
      console.error('❌ Update installation failed:', error);
      toast.error('Update-Installation fehlgeschlagen', {
        description: error instanceof Error ? error.message : 'Unbekannter Fehler'
      });
      setDownloading(false);
    }
  }

  return (
    <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700 p-6">
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100">
            Software-Updates
          </h3>
          <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
            Aktuelle Version: <span className="font-mono font-medium">{currentVersion}</span>
          </p>
        </div>
        <button
          onClick={checkForUpdates}
          disabled={checking || downloading}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
        >
          <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
          {checking ? 'Prüfe...' : 'Auf Updates prüfen'}
        </button>
      </div>

      {/* Update Available Card */}
      {updateAvailable && updateInfo && !downloading && (
        <div className="mt-4 p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5" />
            <div className="flex-1">
              <h4 className="font-semibold text-blue-900 dark:text-blue-100">
                Update verfügbar: Version {updateInfo.version}
              </h4>
              {updateInfo.body && (
                <div className="mt-2 text-sm text-blue-800 dark:text-blue-200 whitespace-pre-wrap">
                  {updateInfo.body}
                </div>
              )}
              <button
                onClick={installUpdate}
                className="mt-3 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center gap-2"
              >
                <Download className="w-4 h-4" />
                Jetzt installieren
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Downloading Progress */}
      {downloading && (
        <div className="mt-4 p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-lg">
          <div className="flex items-start gap-3">
            <Download className="w-5 h-5 text-green-600 dark:text-green-400 mt-0.5 animate-pulse" />
            <div className="flex-1">
              <h4 className="font-semibold text-green-900 dark:text-green-100">
                Update wird heruntergeladen...
              </h4>
              <div className="mt-3">
                <div className="flex justify-between text-sm text-green-800 dark:text-green-200 mb-1">
                  <span>Fortschritt</span>
                  <span className="font-mono">{downloadProgress}%</span>
                </div>
                <div className="w-full bg-green-200 dark:bg-green-900 rounded-full h-2.5 overflow-hidden">
                  <div
                    className="bg-green-600 dark:bg-green-500 h-2.5 rounded-full transition-all duration-300"
                    style={{ width: `${downloadProgress}%` }}
                  />
                </div>
              </div>
              <p className="mt-2 text-sm text-green-700 dark:text-green-300">
                Die Anwendung wird nach dem Download automatisch neu gestartet.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-gray-50 dark:bg-gray-700/50 rounded-lg border border-gray-200 dark:border-gray-600">
        <div className="flex items-start gap-3">
          <AlertCircle className="w-5 h-5 text-gray-600 dark:text-gray-400 mt-0.5" />
          <div className="flex-1 text-sm text-gray-700 dark:text-gray-300">
            <p className="font-medium mb-1">Automatische Updates</p>
            <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400">
              <li>Updates werden über GitHub Releases verteilt</li>
              <li>Alle Updates sind kryptografisch signiert</li>
              <li>Die Anwendung startet nach dem Update automatisch neu</li>
              <li>Nur Administratoren können Updates installieren</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
