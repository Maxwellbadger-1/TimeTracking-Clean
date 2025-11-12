import { useState, useMemo } from 'react';
import { Bell, Search, Trash2, Check, CheckCheck, X } from 'lucide-react';
import { useAuthStore } from '../store/authStore';
import {
  useNotifications,
  useMarkNotificationRead,
  useMarkNotificationUnread,
  useMarkAllNotificationsRead,
  useDeleteNotification,
} from '../hooks';
import { Button } from '../components/ui/Button';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { formatDateLong } from '../utils';
import type { Notification } from '../types';

type TabType = 'all' | 'unread' | 'read';
type NotificationType = 'all' | 'absence_approved' | 'absence_rejected' | 'absence_requested' | 'time_edited' | 'system';

export default function NotificationsPage() {
  const { user } = useAuthStore();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<NotificationType>('all');

  const { data: notifications, isLoading } = useNotifications(user?.id || 0);
  const markRead = useMarkNotificationRead();
  const markUnread = useMarkNotificationUnread();
  const markAllRead = useMarkAllNotificationsRead();
  const deleteNotification = useDeleteNotification();

  // Filter notifications based on active tab, search, and type filter
  const filteredNotifications = useMemo(() => {
    if (!notifications) return [];

    let filtered = [...notifications];

    // Tab filter
    if (activeTab === 'unread') {
      filtered = filtered.filter((n) => !n.isRead);
    } else if (activeTab === 'read') {
      filtered = filtered.filter((n) => n.isRead);
    }

    // Search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (n) =>
          n.title.toLowerCase().includes(query) ||
          n.message?.toLowerCase().includes(query)
      );
    }

    // Type filter
    if (typeFilter !== 'all') {
      filtered = filtered.filter((n) => n.type === typeFilter);
    }

    return filtered;
  }, [notifications, activeTab, searchQuery, typeFilter]);

  // Count statistics
  const unreadCount = notifications?.filter((n) => !n.isRead).length || 0;
  const readCount = notifications?.filter((n) => n.isRead).length || 0;
  const totalCount = notifications?.length || 0;

  const handleToggleRead = async (notification: Notification) => {
    if (notification.isRead) {
      await markUnread.mutateAsync(notification.id);
    } else {
      await markRead.mutateAsync(notification.id);
    }
  };

  const handleMarkAllAsRead = async () => {
    if (!user) return;
    await markAllRead.mutateAsync(user.id);
  };

  const handleDelete = async (id: number) => {
    await deleteNotification.mutateAsync(id);
  };

  const getNotificationIcon = (type: string) => {
    switch (type) {
      case 'absence_approved':
        return '✅';
      case 'absence_rejected':
        return '❌';
      case 'absence_requested':
        return '📅';
      case 'time_edited':
      case 'time_edited_by_admin':
      case 'time_entry_deleted':
        return '⏰';
      case 'vacation_days_adjusted':
      case 'vacation_days_low':
        return '🏖️';
      case 'overtime_threshold':
      case 'negative_overtime_alert':
        return '📊';
      case 'user_created':
        return '👋';
      default:
        return '🔔';
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-full">
        <LoadingSpinner size="lg" />
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto p-6">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-center gap-3 mb-2">
          <Bell className="w-8 h-8 text-blue-600 dark:text-blue-400" />
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Benachrichtigungen
          </h1>
        </div>
        <p className="text-gray-600 dark:text-gray-400">
          Verwalte alle deine Benachrichtigungen an einem Ort
        </p>
      </div>

      {/* Tabs */}
      <div className="flex gap-2 mb-6">
        <button
          onClick={() => setActiveTab('all')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'all'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Alle ({totalCount})
        </button>
        <button
          onClick={() => setActiveTab('unread')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'unread'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Ungelesen ({unreadCount})
        </button>
        <button
          onClick={() => setActiveTab('read')}
          className={`px-4 py-2 rounded-lg font-medium transition-colors ${
            activeTab === 'read'
              ? 'bg-blue-600 text-white'
              : 'bg-gray-200 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600'
          }`}
        >
          Gelesen ({readCount})
        </button>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4 mb-6">
        {/* Search */}
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
          <input
            type="text"
            placeholder="Benachrichtigungen durchsuchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="w-full pl-10 pr-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

        {/* Type Filter */}
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value as NotificationType)}
          className="px-4 py-2 border border-gray-300 dark:border-gray-600 rounded-lg bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
        >
          <option value="all">Alle Typen</option>
          <option value="absence_approved">Urlaub genehmigt</option>
          <option value="absence_rejected">Urlaub abgelehnt</option>
          <option value="absence_requested">Urlaub beantragt</option>
          <option value="time_edited">Zeiterfassung bearbeitet</option>
        </select>
      </div>

      {/* Bulk Actions */}
      {unreadCount > 0 && (
        <div className="mb-4">
          <Button
            variant="ghost"
            size="sm"
            onClick={handleMarkAllAsRead}
            disabled={markAllRead.isPending}
            className="text-blue-600 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-900/20"
          >
            <CheckCheck className="w-4 h-4 mr-2" />
            Alle als gelesen markieren
          </Button>
        </div>
      )}

      {/* Notification List */}
      <div className="space-y-2">
        {filteredNotifications.length === 0 ? (
          <div className="text-center py-12 bg-white dark:bg-gray-800 rounded-lg border border-gray-200 dark:border-gray-700">
            <Bell className="w-16 h-16 mx-auto mb-4 text-gray-300 dark:text-gray-600" />
            <p className="text-gray-500 dark:text-gray-400 text-lg">
              {searchQuery || typeFilter !== 'all'
                ? 'Keine Benachrichtigungen gefunden'
                : activeTab === 'unread'
                ? 'Keine ungelesenen Benachrichtigungen'
                : activeTab === 'read'
                ? 'Keine gelesenen Benachrichtigungen'
                : 'Keine Benachrichtigungen vorhanden'}
            </p>
          </div>
        ) : (
          filteredNotifications.map((notification) => (
            <div
              key={notification.id}
              className={`bg-white dark:bg-gray-800 rounded-lg border transition-all ${
                notification.isRead
                  ? 'border-gray-200 dark:border-gray-700 opacity-70'
                  : 'border-blue-200 dark:border-blue-800 shadow-sm'
              }`}
            >
              <div className="p-4">
                <div className="flex items-start justify-between">
                  <div className="flex items-start space-x-3 flex-1">
                    {/* Icon */}
                    <span className="text-2xl flex-shrink-0">
                      {getNotificationIcon(notification.type)}
                    </span>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      {/* Title with unread indicator */}
                      <div className="flex items-center gap-2 mb-1">
                        {!notification.isRead && (
                          <span className="w-2 h-2 bg-blue-600 rounded-full flex-shrink-0" />
                        )}
                        <p
                          className={`text-sm ${
                            notification.isRead
                              ? 'text-gray-600 dark:text-gray-400'
                              : 'font-bold text-gray-900 dark:text-gray-100'
                          }`}
                        >
                          {notification.title}
                        </p>
                      </div>

                      {/* Message */}
                      {notification.message && (
                        <p className="text-sm text-gray-600 dark:text-gray-400 mb-2">
                          {notification.message}
                        </p>
                      )}

                      {/* Date */}
                      <p className="text-xs text-gray-500 dark:text-gray-500">
                        {formatDateLong(notification.createdAt.split('T')[0])} um{' '}
                        {new Date(notification.createdAt).toLocaleTimeString('de-DE', {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center space-x-1 ml-4 flex-shrink-0">
                    <button
                      onClick={() => handleToggleRead(notification)}
                      disabled={markRead.isPending || markUnread.isPending}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title={notification.isRead ? 'Als ungelesen markieren' : 'Als gelesen markieren'}
                    >
                      {notification.isRead ? (
                        <X className="w-4 h-4 text-gray-600 dark:text-gray-400" />
                      ) : (
                        <Check className="w-4 h-4 text-green-600 dark:text-green-400" />
                      )}
                    </button>
                    <button
                      onClick={() => handleDelete(notification.id)}
                      disabled={deleteNotification.isPending}
                      className="p-2 rounded-lg hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                      title="Löschen"
                    >
                      <Trash2 className="w-4 h-4 text-red-600 dark:text-red-400" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))
        )}
      </div>

      {/* Count Info */}
      {filteredNotifications.length > 0 && (
        <div className="mt-6 text-center text-sm text-gray-500 dark:text-gray-400">
          {filteredNotifications.length}{' '}
          {filteredNotifications.length === 1 ? 'Benachrichtigung' : 'Benachrichtigungen'}
          {(searchQuery || typeFilter !== 'all') && ' gefunden'}
        </div>
      )}
    </div>
  );
}
