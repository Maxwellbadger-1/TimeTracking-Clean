import { useEffect, useState } from 'react';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { Login } from './components/auth/Login';
import { EmployeeDashboard } from './components/dashboard/EmployeeDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { CalendarPage } from './pages/CalendarPage';
import { TimeEntriesPage } from './pages/TimeEntriesPage';
import { UserManagementPage } from './pages/UserManagementPage';
import { AbsencesPage } from './pages/AbsencesPage';
import { ReportsPage } from './pages/ReportsPage';
import VacationBalanceManagementPage from './pages/VacationBalanceManagementPage';
import OvertimeManagementPage from './pages/OvertimeManagementPage';
import BackupPage from './pages/BackupPage';
import YearEndRolloverPage from './pages/YearEndRolloverPage';
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import ForcePasswordChangePage from './pages/ForcePasswordChangePage';
import { Sidebar } from './components/layout/Sidebar';
import { NotificationBell } from './components/notifications/NotificationBell';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { Button } from './components/ui/Button';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { LogOut } from 'lucide-react';
import { useGlobalKeyboardShortcuts, useWebSocket } from './hooks';
import { PrivacyPolicyModal } from './components/privacy/PrivacyPolicyModal';
import { useDesktopNotifications } from './hooks/useDesktopNotifications';
import { useAutoUpdater } from './hooks/useAutoUpdater';
import { SplashScreen } from './components/SplashScreen';
import { UpdateNotification } from './components/ui/UpdateNotification';
import { OfflineBanner } from './components/ui/OfflineBanner';
import { ConnectionStatusIndicator } from './components/ui/ConnectionStatusIndicator';
import maxflowLogo from './assets/maxflow-logo.png';

export default function App() {
  const { user, isAuthenticated, isLoading, checkSession, logout, forcePasswordChange } = useAuthStore();
  const { currentView, setCurrentView } = useUIStore();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

  // Only show splash screen on first app load (not on logout/reload)
  // sessionStorage persists during browser session but clears when app is closed
  const [showSplash, setShowSplash] = useState(() => {
    const hasSeenSplash = sessionStorage.getItem('hasSeenSplash');
    return hasSeenSplash !== 'true';
  });

  // Global Keyboard Shortcuts (Ctrl/Cmd + Number)
  useGlobalKeyboardShortcuts({
    onDashboard: () => setCurrentView('dashboard'),
    onCalendar: () => setCurrentView('calendar'),
    onTimeEntries: () => setCurrentView('time-entries'),
    onAbsences: () => setCurrentView('absences'),
    onReports: () => setCurrentView('reports'),
    onUsers: () => user?.role === 'admin' && setCurrentView('users'),
  });

  // Desktop Notifications (monitors DB notifications and triggers native desktop alerts)
  useDesktopNotifications(user?.id);

  // WebSocket Real-Time Updates (auto-invalidates TanStack Query caches)
  useWebSocket({ userId: user?.id, enabled: isAuthenticated });

  // Auto-Updater (checks for updates on app start)
  const updater = useAutoUpdater();

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Check if user needs to accept privacy policy
  useEffect(() => {
    if (user && !user.privacyConsentAt) {
      setShowPrivacyModal(true);
    } else if (user && user.privacyConsentAt) {
      setShowPrivacyModal(false);
    }
  }, [user]);

  // Handle privacy policy acceptance
  const handlePrivacyAccept = async () => {
    setShowPrivacyModal(false);
    // Refresh user session to get updated privacyConsentAt
    await checkSession();
  };

  // Show splash screen on first load
  if (showSplash) {
    return (
      <SplashScreen
        onComplete={() => {
          sessionStorage.setItem('hasSeenSplash', 'true');
          setShowSplash(false);
        }}
      />
    );
  }

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated || !user) {
    return <Login />;
  }

  // Show force password change page if required (Admin Reset)
  if (forcePasswordChange) {
    return <ForcePasswordChangePage />;
  }

  // Main App with Sidebar + Content Area
  return (
    <>
      {/* Offline Banner (appears above everything when offline/server unreachable) */}
      <OfflineBanner />

      {/* Update Notification Banner (appears above everything when update available) */}
      {updater.available && updater.update && (
        <UpdateNotification
          update={updater.update}
          downloading={updater.downloading}
          readyToInstall={updater.readyToInstall}
          onDownload={() => updater.downloadAndInstall(updater.update!)}
          onRestart={updater.restartApp}
        />
      )}

      <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
        {/* Top Header Bar */}
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-between px-6">
          {/* Logo */}
          <div className="flex items-center gap-3">
            <img
              src={maxflowLogo}
              alt="Maxflow Software"
              className="h-8 w-8 object-contain"
            />
            <div className="hidden sm:block">
              <p className="text-xs text-gray-500 dark:text-gray-400">Powered by</p>
              <p className="text-sm font-semibold bg-gradient-to-r from-blue-600 to-cyan-600 bg-clip-text text-transparent">
                Maxflow Software
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <ConnectionStatusIndicator />
            <ThemeToggle />
            <NotificationBell />
            <Button variant="ghost" size="sm" onClick={logout}>
              <LogOut className="w-4 h-4" />
            </Button>
          </div>
        </header>

        {/* Main Layout */}
        <div className="flex flex-1 overflow-hidden">
          {/* Sidebar Navigation */}
          <Sidebar />

          {/* Main Content Area */}
          <main className="flex-1 overflow-y-auto">
            {currentView === 'dashboard' && (
              user.role === 'admin' ? <AdminDashboard /> : <EmployeeDashboard />
            )}
            {currentView === 'calendar' && <CalendarPage />}
            {currentView === 'time-entries' && <TimeEntriesPage />}
            {currentView === 'absences' && <AbsencesPage />}
            {currentView === 'notifications' && <NotificationsPage />}
            {currentView === 'users' && user.role === 'admin' && <UserManagementPage />}
            {currentView === 'vacation-balances' && user.role === 'admin' && <VacationBalanceManagementPage />}
            {currentView === 'overtime' && user.role === 'admin' && <OvertimeManagementPage />}
            {currentView === 'reports' && <ReportsPage />}
            {currentView === 'backups' && user.role === 'admin' && <BackupPage />}
            {currentView === 'year-end-rollover' && user.role === 'admin' && <YearEndRolloverPage />}
            {currentView === 'settings' && <SettingsPage />}
          </main>
        </div>
      </div>

      {/* Privacy Policy Modal (DSGVO) */}
      <PrivacyPolicyModal isOpen={showPrivacyModal} onAccept={handlePrivacyAccept} />
    </>
  );
}
