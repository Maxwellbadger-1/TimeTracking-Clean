import { useEffect } from 'react';
import { useAuthStore } from './store/authStore';
import { Login } from './components/auth/Login';
import { EmployeeDashboard } from './components/dashboard/EmployeeDashboard';
import { AdminDashboard } from './components/dashboard/AdminDashboard';
import { LoadingSpinner } from './components/ui/LoadingSpinner';
import DebugPanel from './components/DebugPanel';

export default function App() {
  const { user, isAuthenticated, isLoading, checkSession } = useAuthStore();

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

  // Show dashboard based on role
  if (user.role === 'admin') {
    return (
      <>
        <AdminDashboard />
        <DebugPanel />
      </>
    );
  }

  return (
    <>
      <EmployeeDashboard />
      <DebugPanel />
    </>
  );
}
