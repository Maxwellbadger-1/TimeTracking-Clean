import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { useUIStore } from './store/uiStore';
import { Login } from './components/auth/Login';
import { EmployeeDashboard } from './components/dashboard/EmployeeDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { CalendarPage } from './pages/CalendarPage';
import { TimeEntriesPage } from './pages/TimeEntriesPage';
import { Sidebar } from './components/layout/Sidebar';
import { NotificationBell } from './components/notifications/NotificationBell';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import { Button } from './components/ui/Button';
import { LogOut } from 'lucide-react';
import DebugPanel from './components/DebugPanel';

export default function App() {
  const { user, isAuthenticated, isLoading, checkSession, logout } = useAuthStore();
  const { currentView } = useUIStore();

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
            {currentView === 'users' && user.role === 'admin' && (
              <div className="p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Mitarbeiterverwaltung
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Mitarbeiter anlegen, bearbeiten und verwalten
                </p>
                <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-4">
                  <p className="text-yellow-800 dark:text-yellow-200">
                    👥 <strong>Backend ist fertig!</strong> Das User Management UI kommt als nächstes.
                  </p>
                  <p className="text-sm text-yellow-700 dark:text-yellow-300 mt-2">
                    Alle APIs funktionieren bereits (GET/POST/PUT/DELETE /api/users).
                  </p>
                </div>
              </div>
            )}
            {currentView === 'reports' && user.role === 'admin' && (
              <div className="p-8">
                <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100 mb-2">
                  Berichte & Export
                </h1>
                <p className="text-gray-600 dark:text-gray-400 mb-6">
                  Monatsberichte, Überstunden-Reports, PDF/CSV Export
                </p>
                <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-lg p-4">
                  <p className="text-blue-800 dark:text-blue-200">
                    📊 <strong>Phase 7</strong> - Wird als nächstes implementiert
                  </p>
                  <p className="text-sm text-blue-700 dark:text-blue-300 mt-2">
                    Features: Monatsberichte, Überstunden-Auswertung, Urlaubsübersichten, PDF/CSV Export
                  </p>
                </div>
              </div>
            )}
          </main>
        </div>
      </div>
      <DebugPanel />
    </>
  );
}
