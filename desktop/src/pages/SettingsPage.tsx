import { useState } from 'react';
import { User, Lock, Settings as SettingsIcon, Download, TestTube } from 'lucide-react';
import { useCurrentUser } from '../hooks';
import PasswordChangeForm from '../components/settings/PasswordChangeForm';
import EmailChangeForm from '../components/settings/EmailChangeForm';
import UpdateChecker from '../components/settings/UpdateChecker';
import { useDevToolStore } from '../store/devToolStore';

type Tab = 'profile' | 'security' | 'updates' | 'devtools';

export default function SettingsPage() {
  const [activeTab, setActiveTab] = useState<Tab>('profile');
  const { data: currentUser } = useCurrentUser();
  const { settings, updateSettings, setVisible } = useDevToolStore();

  const tabs = [
    { id: 'profile' as Tab, label: 'Profil', icon: User },
    { id: 'security' as Tab, label: 'Sicherheit', icon: Lock },
    ...(currentUser?.role === 'admin'
      ? [
          { id: 'updates' as Tab, label: 'Updates', icon: Download },
          { id: 'devtools' as Tab, label: 'Dev Tools', icon: TestTube },
        ]
      : []),
  ];

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

          {activeTab === 'updates' && currentUser?.role === 'admin' && (
            <div>
              <UpdateChecker />
            </div>
          )}

          {activeTab === 'devtools' && currentUser?.role === 'admin' && (
            <div className="space-y-6">
              <div>
                <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                  QA Dev Tools
                </h3>
                <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
                  Umfassendes Test-Tool für Quality Assurance. Testet alle API-Endpoints,
                  Business Logic, Database Integrity, Security und mehr.
                </p>
              </div>

              {/* Enable/Disable Toggle */}
              <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                <div>
                  <h4 className="font-medium text-gray-900 dark:text-white">
                    Dev Tools aktivieren
                  </h4>
                  <p className="text-sm text-gray-600 dark:text-gray-400">
                    Aktiviert das umfassende Test-Dashboard (400+ Tests)
                  </p>
                </div>
                <label className="relative inline-flex items-center cursor-pointer">
                  <input
                    type="checkbox"
                    checked={settings.enabled}
                    onChange={(e) => updateSettings({ enabled: e.target.checked })}
                    className="sr-only peer"
                  />
                  <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                </label>
              </div>

              {/* Settings (when enabled) */}
              {settings.enabled && (
                <>
                  {/* Auto-run on start */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Auto-Run beim Start
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tests automatisch beim Öffnen der App ausführen
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.autoRunOnStart}
                        onChange={(e) => updateSettings({ autoRunOnStart: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Parallel Execution */}
                  <div className="flex items-center justify-between p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <div>
                      <h4 className="font-medium text-gray-900 dark:text-white">
                        Parallele Ausführung
                      </h4>
                      <p className="text-sm text-gray-600 dark:text-gray-400">
                        Tests gleichzeitig ausführen (schneller, aber mehr Last)
                      </p>
                    </div>
                    <label className="relative inline-flex items-center cursor-pointer">
                      <input
                        type="checkbox"
                        checked={settings.parallelExecution}
                        onChange={(e) => updateSettings({ parallelExecution: e.target.checked })}
                        className="sr-only peer"
                      />
                      <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 dark:peer-focus:ring-blue-800 rounded-full peer dark:bg-gray-700 peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all dark:border-gray-600 peer-checked:bg-blue-600"></div>
                    </label>
                  </div>

                  {/* Max Concurrent */}
                  {settings.parallelExecution && (
                    <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                      <label className="block">
                        <span className="font-medium text-gray-900 dark:text-white">
                          Max. gleichzeitige Tests
                        </span>
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          Anzahl der Tests, die parallel laufen dürfen
                        </p>
                        <input
                          type="number"
                          min="1"
                          max="10"
                          value={settings.maxConcurrent}
                          onChange={(e) => updateSettings({ maxConcurrent: parseInt(e.target.value) })}
                          className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                        />
                      </label>
                    </div>
                  )}

                  {/* Test Timeout */}
                  <div className="p-4 bg-gray-50 dark:bg-gray-900 rounded-lg border border-gray-200 dark:border-gray-700">
                    <label className="block">
                      <span className="font-medium text-gray-900 dark:text-white">
                        Test Timeout (ms)
                      </span>
                      <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                        Maximale Zeit pro Test in Millisekunden
                      </p>
                      <input
                        type="number"
                        min="5000"
                        max="120000"
                        step="1000"
                        value={settings.testTimeout}
                        onChange={(e) => updateSettings({ testTimeout: parseInt(e.target.value) })}
                        className="w-full px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-white focus:ring-2 focus:ring-blue-500"
                      />
                    </label>
                  </div>

                  {/* Open Dashboard Button */}
                  <button
                    onClick={() => setVisible(true)}
                    className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium flex items-center justify-center gap-2"
                  >
                    <TestTube className="w-5 h-5" />
                    Test-Dashboard öffnen
                  </button>
                </>
              )}

              {/* Info Box */}
              <div className="p-4 bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg">
                <h4 className="font-medium text-blue-900 dark:text-blue-300 mb-2">
                  ℹ️ Test-Kategorien
                </h4>
                <ul className="text-sm text-blue-800 dark:text-blue-400 space-y-1">
                  <li>• Authentication & Session (15 Tests)</li>
                  <li>• User Management (25 Tests)</li>
                  <li>• Time Entries (30 Tests)</li>
                  <li>• Absences & Vacation (35 Tests)</li>
                  <li>• Overtime & Work Time (40 Tests)</li>
                  <li>• Notifications (20 Tests)</li>
                  <li>• Exports & Reports (15 Tests)</li>
                  <li>• Database & Integrity (25 Tests)</li>
                  <li>• Business Logic (30 Tests)</li>
                  <li>• Security (20 Tests)</li>
                  <li>• Performance (15 Tests)</li>
                  <li>• Frontend & UI (30 Tests)</li>
                  <li>• Integration & E2E (25 Tests)</li>
                  <li>• Edge Cases & Stress (25 Tests)</li>
                </ul>
                <p className="text-sm text-blue-800 dark:text-blue-400 mt-2 font-medium">
                  Gesamt: 400+ Tests
                </p>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
