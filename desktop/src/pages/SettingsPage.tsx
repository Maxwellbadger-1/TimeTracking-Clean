import { useState } from 'react';
import { User, Lock, Settings as SettingsIcon, Download, Shield, RefreshCw } from 'lucide-react';
import { useCurrentUser } from '../hooks';
import PasswordChangeForm from '../components/settings/PasswordChangeForm';
import EmailChangeForm from '../components/settings/EmailChangeForm';
import UpdateChecker from '../components/settings/UpdateChecker';
import { apiClient } from '../api/client';
import { toast } from 'sonner';

type Tab = 'profile' | 'security' | 'updates' | 'admin';

interface RecalculateResponse {
  usersProcessed: number;
  entriesCreated: number;
  message: string;
}

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { data: currentUser } = useCurrentUser();
  const [recalculating, setRecalculating] = useState(false);

  const isAdmin = currentUser?.role === 'admin';

  const tabs = [
    { id: 'profile' as Tab, label: 'Profil', icon: User },
    { id: 'security' as Tab, label: 'Sicherheit', icon: Lock },
    { id: 'updates' as Tab, label: 'Updates', icon: Download },
    ...(isAdmin ? [{ id: 'admin' as Tab, label: 'Admin', icon: Shield }] : []),
  ];

  const handleRecalculateOvertime = async () => {
    if (!confirm('Überstunden für alle Mitarbeiter neu berechnen?\n\nDies erstellt fehlende Monatseinträge und korrigiert die Überstundenwerte.')) {
      return;
    }

    setRecalculating(true);
    toast.info('Überstunden werden neu berechnet...');

    try {
      const response = await apiClient.post('/overtime/recalculate-all');

      if (response.success && response.data) {
        const data = response.data as RecalculateResponse;
        toast.success(
          `✅ Erfolgreich abgeschlossen!\n\n` +
          `Benutzer verarbeitet: ${data.usersProcessed}\n` +
          `Einträge erstellt: ${data.entriesCreated}`
        );
      } else {
        throw new Error(response.error || 'Unbekannter Fehler');
      }
    } catch (error) {
      console.error('Recalculate error:', error);
      toast.error('Fehler beim Neuberechnen der Überstunden');
    } finally {
      setRecalculating(false);
    }
  };

  return (
    <div className="max-w-5xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <SettingsIcon className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Einstellungen</h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Verwalte dein Konto und deine Präferenzen
        </p>
      </div>

      {/* Current User Info */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm p-6 mb-6 border border-gray-200 dark:border-gray-700">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
            <User className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {currentUser?.firstName} {currentUser?.lastName}
            </h2>
            <p className="text-gray-600 dark:text-gray-400">{currentUser?.email}</p>
            <p className="text-sm text-gray-500 dark:text-gray-500">
              {currentUser?.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-sm border border-gray-200 dark:border-gray-700">
        <div className="border-b border-gray-200 dark:border-gray-700">
          <nav className="flex -mb-px">
            {tabs.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  onClick={() => setActiveTab(tab.id)}
                  className={`
                    flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors
                    ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 dark:text-blue-400'
                        : 'border-transparent text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:border-gray-300 dark:hover:border-gray-600'
                    }
                  `}
                >
                  <Icon className="w-5 h-5" />
                  {tab.label}
                </button>
              );
            })}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'profile' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Profilinformationen
                </h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Vorname
                    </label>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {currentUser?.firstName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Nachname
                    </label>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {currentUser?.lastName}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Benutzername
                    </label>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {currentUser?.username}
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Wochenarbeitsstunden
                    </label>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {currentUser?.weeklyHours} Stunden
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Urlaubstage pro Jahr
                    </label>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {currentUser?.vacationDaysPerYear} Tage
                    </div>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                      Eintrittsdatum
                    </label>
                    <div className="px-4 py-2 bg-gray-50 dark:bg-gray-700 rounded-lg text-gray-900 dark:text-white">
                      {currentUser?.hireDate
                        ? new Date(currentUser.hireDate).toLocaleDateString('de-DE')
                        : '-'}
                    </div>
                  </div>
                </div>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-4">
                  ℹ️ Diese Werte können nur von einem Administrator geändert werden
                </p>
              </div>

              <EmailChangeForm />
            </div>
          )}

          {activeTab === 'security' && (
            <div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                Passwort ändern
              </h3>
              <PasswordChangeForm />
            </div>
          )}

          {activeTab === 'updates' && (
            <div>
              <UpdateChecker />
            </div>
          )}

          {activeTab === 'admin' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  Systemwartung
                </h3>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4 mb-4">
                  <p className="text-sm text-yellow-800 dark:text-yellow-200">
                    <strong>Achtung:</strong> Diese Funktionen sollten nur verwendet werden, wenn Überstundenwerte nicht korrekt sind.
                  </p>
                </div>
                <button
                  onClick={handleRecalculateOvertime}
                  disabled={recalculating}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  <RefreshCw className={`w-5 h-5 ${recalculating ? 'animate-spin' : ''}`} />
                  {recalculating ? 'Berechne neu...' : 'Überstunden neu berechnen'}
                </button>
                <p className="text-sm text-gray-600 dark:text-gray-400 mt-2">
                  Erstellt fehlende Monatseinträge für alle Mitarbeiter und korrigiert die Überstundenwerte.
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
