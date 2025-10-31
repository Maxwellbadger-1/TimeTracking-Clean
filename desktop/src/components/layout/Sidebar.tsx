/**
 * Modern Sidebar Navigation Component
 *
 * Inspired by Google Calendar, Motion, Cal.com
 * Features:
 * - Clean, minimal design
 * - Icon + label navigation
 * - Active state highlighting
 * - Role-based menu items
 * - Collapsible (future)
 */

import { useAuthStore } from '../../store/authStore';
import { useUIStore } from '../../store/uiStore';
import {
  LayoutDashboard,
  Calendar,
  Users,
  FileText,
  Clock,
  Umbrella,
  LogOut,
} from 'lucide-react';
import { Button } from '../ui/Button';

type ViewType = 'dashboard' | 'calendar' | 'users' | 'reports' | 'time-entries' | 'absences';

interface NavItem {
  id: ViewType;
  label: string;
  icon: React.ReactNode;
  adminOnly?: boolean;
}

const navItems: NavItem[] = [
  {
    id: 'dashboard',
    label: 'Dashboard',
    icon: <LayoutDashboard className="w-5 h-5" />,
  },
  {
    id: 'calendar',
    label: 'Kalender',
    icon: <Calendar className="w-5 h-5" />,
  },
  {
    id: 'time-entries',
    label: 'Zeiterfassung',
    icon: <Clock className="w-5 h-5" />,
  },
  {
    id: 'absences',
    label: 'Abwesenheiten',
    icon: <Umbrella className="w-5 h-5" />,
  },
  {
    id: 'users',
    label: 'Mitarbeiter',
    icon: <Users className="w-5 h-5" />,
    adminOnly: true,
  },
  {
    id: 'reports',
    label: 'Berichte',
    icon: <FileText className="w-5 h-5" />,
    adminOnly: true,
  },
];

export function Sidebar() {
  const { user, logout } = useAuthStore();
  const { currentView, setCurrentView } = useUIStore();

  if (!user) return null;

  // Filter menu items based on role
  const visibleItems = navItems.filter((item) => {
    if (item.adminOnly) {
      return user.role === 'admin';
    }
    return true;
  });

  return (
    <aside className="w-64 bg-white dark:bg-gray-800 border-r border-gray-200 dark:border-gray-700 flex flex-col h-screen">
      {/* Header */}
      <div className="p-6 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-900 dark:text-gray-100">
          TimeTracker
        </h1>
        <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
          {user.firstName} {user.lastName}
        </p>
        <p className="text-xs text-gray-500 dark:text-gray-500">
          {user.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
        </p>
      </div>

      {/* Navigation */}
      <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
        {visibleItems.map((item) => {
          const isActive = currentView === item.id;
          return (
            <button
              key={item.id}
              onClick={() => setCurrentView(item.id)}
              className={`
                w-full flex items-center space-x-3 px-4 py-3 rounded-lg
                transition-all duration-200 text-left
                ${
                  isActive
                    ? 'bg-blue-50 dark:bg-blue-900/20 text-blue-600 dark:text-blue-400 font-medium'
                    : 'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700'
                }
              `}
            >
              <span
                className={isActive ? 'text-blue-600 dark:text-blue-400' : ''}
              >
                {item.icon}
              </span>
              <span>{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Footer */}
      <div className="p-4 border-t border-gray-200 dark:border-gray-700">
        {/* Logout Button */}
        <Button
          variant="ghost"
          fullWidth
          onClick={logout}
          className="justify-start"
        >
          <LogOut className="w-4 h-4 mr-3" />
          Abmelden
        </Button>
      </div>
    </aside>
  );
}
