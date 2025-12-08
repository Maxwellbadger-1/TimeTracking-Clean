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
import SettingsPage from './pages/SettingsPage';
import NotificationsPage from './pages/NotificationsPage';
import { Sidebar } from './components/layout/Sidebar';
import { NotificationBell } from './components/notifications/NotificationBell';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { Button } from './components/ui/Button';
import { ThemeToggle } from './components/ui/ThemeToggle';
import { LogOut } from 'lucide-react';
import { useGlobalKeyboardShortcuts } from './hooks';
import { PrivacyPolicyModal } from './components/privacy/PrivacyPolicyModal';
import { useDesktopNotifications } from './hooks/useDesktopNotifications';
import DevToolPanel from './components/devtools/DevToolPanel';

export default function App() {
  const { user, isAuthenticated, isLoading, checkSession, logout } = useAuthStore();
  const { currentView, setCurrentView } = useUIStore();
  const [showPrivacyModal, setShowPrivacyModal] = useState(false);

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

  // Main App with Sidebar + Content Area
  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
        {/* Top Header Bar */}
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end px-6 gap-2">
          <ThemeToggle />
          <NotificationBell />
          <Button variant="ghost" size="sm" onClick={logout}>
            <LogOut className="w-4 h-4" />
          </Button>
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
            {currentView === 'settings' && <SettingsPage />}
          </main>
        </div>
      </div>

      {/* Privacy Policy Modal (DSGVO) */}
      <PrivacyPolicyModal isOpen={showPrivacyModal} onAccept={handlePrivacyAccept} />

      {/* Dev Tool Panel */}
      <DevToolPanel />
    </>
  );
}
