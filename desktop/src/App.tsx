import { useEffect } from 'react';
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
import { Sidebar } from './components/layout/Sidebar';
import { NotificationBell } from './components/notifications/NotificationBell';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { Button } from './components/ui/Button';
import { LogOut } from 'lucide-react';
import DebugPanel from './components/DebugPanel';
import { useGlobalKeyboardShortcuts } from './hooks';

export default function App() {
  const { user, isAuthenticated, isLoading, checkSession, logout } = useAuthStore();
  const { currentView, setCurrentView } = useUIStore();

  // Global Keyboard Shortcuts (Ctrl/Cmd + Number)
  useGlobalKeyboardShortcuts({
    onDashboard: () => setCurrentView('dashboard'),
    onCalendar: () => setCurrentView('calendar'),
    onTimeEntries: () => setCurrentView('time-entries'),
    onAbsences: () => setCurrentView('absences'),
    onReports: () => setCurrentView('reports'),
    onUsers: () => user?.role === 'admin' && setCurrentView('users'),
  });

  // Check session on mount
  useEffect(() => {
    checkSession();
  }, [checkSession]);

  // Show loading spinner while checking session
  if (isLoading) {
    return (
      <>
        <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
          <LoadingSpinner size="lg" />
        </div>
        <DebugPanel />
      </>
    );
  }

  // Show login if not authenticated
  if (!isAuthenticated || !user) {
    return (
      <>
        <Login />
        <DebugPanel />
      </>
    );
  }

  // Main App with Sidebar + Content Area
  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-gray-100 dark:bg-gray-900">
        {/* Top Header Bar */}
        <header className="h-14 bg-white dark:bg-gray-800 border-b border-gray-200 dark:border-gray-700 flex items-center justify-end px-6 gap-2">
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
            {currentView === 'users' && user.role === 'admin' && <UserManagementPage />}
            {currentView === 'reports' && <ReportsPage />}
          </main>
        </div>
      </div>
      <DebugPanel />
    </>
  );
}
