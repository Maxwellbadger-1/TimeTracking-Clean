/**
 * Auto-Updater Hook
 *
 * Professional auto-update pattern (like Slack, VS Code, Discord):
 * 1. Silent check on app start
 * 2. Background download
 * 3. Gentle notification
 * 4. User controls installation timing
 */

import { useState, useEffect } from 'react';
import { check as checkUpdate, Update } from '@tauri-apps/plugin-updater';
import { relaunch } from '@tauri-apps/plugin-process';
import { toast } from 'sonner';

export interface UpdateState {
  available: boolean;
  downloading: boolean;
  readyToInstall: boolean;
  update: Update | null;
  error: string | null;
}

export function useAutoUpdater() {
  const [state, setState] = useState<UpdateState>({
    available: false,
    downloading: false,
    readyToInstall: false,
    update: null,
    error: null,
  });

  // Check for updates on mount (app start)
  useEffect(() => {
    checkForUpdates();
  }, []);

  const checkForUpdates = async () => {
    try {
      console.log('🔍 Checking for updates...');
      const update = await checkUpdate();

      if (update) {
        console.log(`✨ Update available: ${update.version} (current: ${update.currentVersion})`);
        setState({
          available: true,
          downloading: false,
          readyToInstall: false,
          update,
          error: null,
        });

        // Show toast notification
        toast.info(`Update verfügbar: Version ${update.version}`, {
          duration: 10000,
          action: {
            label: 'Herunterladen',
            onClick: () => downloadAndInstall(update),
          },
        });
      } else {
        console.log('✅ App is up-to-date');
      }
    } catch (error) {
      console.error('❌ Error checking for updates:', error);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Failed to check for updates',
      }));
    }
  };

  const downloadAndInstall = async (update: Update) => {
    setState(prev => ({ ...prev, downloading: true }));

    try {
      console.log('📥 Downloading update...');
      toast.loading('Update wird heruntergeladen...', { id: 'update-download' });

      // Download update (blocks until complete)
      await update.downloadAndInstall();

      console.log('✅ Update downloaded and ready to install');
      toast.success('Update erfolgreich heruntergeladen', { id: 'update-download' });

      setState(prev => ({
        ...prev,
        downloading: false,
        readyToInstall: true,
      }));

      // Ask user to restart
      toast.success('Update installiert! App neu starten?', {
        duration: Infinity,
        action: {
          label: 'Jetzt neu starten',
          onClick: restartApp,
        },
      });
    } catch (error) {
      console.error('❌ Error downloading update:', error);
      toast.error('Fehler beim Herunterladen des Updates', { id: 'update-download' });
      setState(prev => ({
        ...prev,
        downloading: false,
        error: error instanceof Error ? error.message : 'Failed to download update',
      }));
    }
  };

  const restartApp = async () => {
    console.log('🔄 Restarting app to apply update...');
    await relaunch();
  };

  return {
    ...state,
    checkForUpdates,
    downloadAndInstall,
    restartApp,
  };
}
