/**
 * User Management Page (Admin Only)
 *
 * Features:
 * - View all users (active + deleted)
 * - Create new users
 * - Edit existing users
 * - Delete users (soft delete)
 * - Search and filter users
 * - Role management (Admin <-> Employee)
 * - Department and position management
 */

import { useState, useMemo } from 'react';
import { useAuthStore } from '../store/authStore';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/Card';
import { Button } from '../components/ui/Button';
import { Input } from '../components/ui/Input';
import { Select } from '../components/ui/Select';
import { LoadingSpinner } from '../components/ui/LoadingSpinner';
import { ConfirmDialog } from '../components/ui/ConfirmDialog';
import { Users, UserPlus, Search, Filter, Shield, UserCheck, UserX } from 'lucide-react';
import { useUsers, useDeleteUser, useReactivateUser } from '../hooks';
import type { User } from '../types';
import { CreateUserModal } from '../components/users/CreateUserModal';
import { EditUserModal } from '../components/users/EditUserModal';

export function UserManagementPage() {
  const { user: currentUser } = useAuthStore();
  const { data: users, isLoading } = useUsers();
  const deleteUser = useDeleteUser();
  const reactivateUser = useReactivateUser();

  // Modal States
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<{ userId: number; userName: string } | null>(null);

  // Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'admin' | 'employee'>('all');
  const [statusFilter, setStatusFilter] = useState<'active' | 'all'>('active');
  const [departmentFilter, setDepartmentFilter] = useState('all');

  if (!currentUser || currentUser.role !== 'admin') {
    return (
      <div className="min-h-screen bg-gray-100 dark:bg-gray-900 flex items-center justify-center">
        <Card className="max-w-md">
          <CardContent className="pt-6">
            <p className="text-red-600 dark:text-red-400 text-center">
              Zugriff verweigert. Nur Administratoren können Benutzer verwalten.
            </p>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Get unique departments
  const departments = useMemo(() => {
    if (!users) return [];
    const depts = users
      .map(u => u.department)
      .filter((d): d is string => !!d);
    return Array.from(new Set(depts)).sort();
  }, [users]);

  // Filter & Search
  const filteredUsers = useMemo(() => {
    if (!users) return [];

    let filtered = [...users];

    // Search by name, email, username
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        u =>
          u.firstName.toLowerCase().includes(query) ||
          u.lastName.toLowerCase().includes(query) ||
          u.email.toLowerCase().includes(query) ||
          u.username.toLowerCase().includes(query)
      );
    }

    // Filter by role
    if (roleFilter !== 'all') {
      filtered = filtered.filter(u => u.role === roleFilter);
    }

    // Filter by status
    if (statusFilter === 'active') {
      filtered = filtered.filter(u => u.isActive);
    }

    // Filter by department
    if (departmentFilter !== 'all') {
      filtered = filtered.filter(u => u.department === departmentFilter);
    }

    // Sort by name
    filtered.sort((a, b) => a.lastName.localeCompare(b.lastName));

    return filtered;
  }, [users, searchQuery, roleFilter, statusFilter, departmentFilter]);

  // Statistics
  const stats = useMemo(() => {
    if (!users) return { total: 0, admins: 0, employees: 0, active: 0, inactive: 0 };

    return {
      total: users.length,
      admins: users.filter(u => u.role === 'admin').length,
      employees: users.filter(u => u.role === 'employee').length,
      active: users.filter(u => u.isActive).length,
      inactive: users.filter(u => !u.isActive).length,
    };
  }, [users]);

  const handleDeleteClick = (userId: number, userName: string) => {
    console.log('🔥🔥🔥 HANDLE DELETE CLICKED 🔥🔥🔥');
    console.log('👤 User to delete:', userName);
    console.log('🆔 User ID:', userId);
    console.log('🔒 Current user ID:', currentUser.id);

    if (userId === currentUser.id) {
      console.warn('⚠️ Cannot delete yourself!');
      // TODO: Show error dialog instead of alert
      return;
    }

    console.log('❓ Showing confirmation dialog...');
    setDeleteConfirm({ userId, userName });
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirm) return;

    const { userId } = deleteConfirm;
    console.log('✅ User confirmed deletion');
    console.log('🚀 Calling deleteUser.mutateAsync(' + userId + ')...');

    try {
      const result = await deleteUser.mutateAsync(userId);
      console.log('✅ Delete mutation completed successfully');
      console.log('📊 Result:', result);
    } catch (error) {
      console.error('💥 Delete mutation failed with error:');
      console.error(error);
    }
  };

  const clearFilters = () => {
    setSearchQuery('');
    setRoleFilter('all');
    setStatusFilter('active');
    setDepartmentFilter('all');
  };

  return (
    <div className="min-h-screen bg-gray-100 dark:bg-gray-900">
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Page Header */}
        <div className="mb-8 flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">
              Benutzerverwaltung
            </h1>
            <p className="text-gray-600 dark:text-gray-400 mt-1">
              Mitarbeiter anlegen, bearbeiten und verwalten
            </p>
          </div>
          <Button variant="primary" onClick={() => setShowCreateModal(true)}>
            <UserPlus className="w-4 h-4 mr-2" />
            Neuer Benutzer
          </Button>
        </div>

        {/* Statistics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-5 gap-6 mb-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Gesamt
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.total}
                  </p>
                </div>
                <div className="bg-blue-100 dark:bg-blue-900/20 p-3 rounded-lg">
                  <Users className="w-6 h-6 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Admins
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.admins}
                  </p>
                </div>
                <div className="bg-purple-100 dark:bg-purple-900/20 p-3 rounded-lg">
                  <Shield className="w-6 h-6 text-purple-600 dark:text-purple-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Mitarbeiter
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.employees}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Aktiv
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.active}
                  </p>
                </div>
                <div className="bg-green-100 dark:bg-green-900/20 p-3 rounded-lg">
                  <UserCheck className="w-6 h-6 text-green-600 dark:text-green-400" />
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                    Inaktiv
                  </p>
                  <p className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-1">
                    {stats.inactive}
                  </p>
                </div>
                <div className="bg-gray-100 dark:bg-gray-700 p-3 rounded-lg">
                  <UserX className="w-6 h-6 text-gray-600 dark:text-gray-400" />
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Filters */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle>Suche & Filter</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
              {/* Search */}
              <div className="md:col-span-2">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                  <Input
                    placeholder="Name, E-Mail, Benutzername..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10"
                  />
                </div>
              </div>

              {/* Role Filter */}
              <Select
                value={roleFilter}
                onChange={(e) => setRoleFilter(e.target.value as typeof roleFilter)}
                options={[
                  { value: 'all', label: 'Alle Rollen' },
                  { value: 'admin', label: 'Nur Admins' },
                  { value: 'employee', label: 'Nur Mitarbeiter' },
                ]}
              />

              {/* Status Filter */}
              <Select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)}
                options={[
                  { value: 'active', label: 'Nur Aktive' },
                  { value: 'all', label: 'Alle (inkl. Inaktive)' },
                ]}
              />

              {/* Department Filter */}
              <Select
                value={departmentFilter}
                onChange={(e) => setDepartmentFilter(e.target.value)}
                options={[
                  { value: 'all', label: 'Alle Abteilungen' },
                  ...departments.map(dept => ({ value: dept, label: dept })),
                ]}
              />
            </div>

            {(searchQuery || roleFilter !== 'all' || statusFilter !== 'active' || departmentFilter !== 'all') && (
              <div className="mt-4">
                <Button variant="ghost" size="sm" onClick={clearFilters}>
                  <Filter className="w-4 h-4 mr-2" />
                  Filter zurücksetzen
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Users Table */}
        <Card>
          <CardHeader>
            <CardTitle>
              Benutzer ({filteredUsers.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <div className="flex justify-center py-12">
                <LoadingSpinner size="lg" />
              </div>
            ) : filteredUsers.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
                  <thead className="bg-gray-50 dark:bg-gray-800">
                    <tr>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Name
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        E-Mail
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Rolle
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Abteilung
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Mitarbeiter seit
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Status
                      </th>
                      <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Stunden/Woche
                      </th>
                      <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 dark:text-gray-400 uppercase tracking-wider">
                        Aktionen
                      </th>
                    </tr>
                  </thead>
                  <tbody className="bg-white dark:bg-gray-900 divide-y divide-gray-200 dark:divide-gray-700">
                    {filteredUsers.map((user) => (
                      <tr
                        key={user.id}
                        className={`hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors ${
                          !user.isActive ? 'opacity-50' : ''
                        }`}
                      >
                        <td className="px-6 py-4 whitespace-nowrap">
                          <div className="flex items-center">
                            <div>
                              <div className="text-sm font-medium text-gray-900 dark:text-gray-100">
                                {user.firstName} {user.lastName}
                              </div>
                              <div className="text-sm text-gray-500 dark:text-gray-400">
                                @{user.username}
                              </div>
                            </div>
                          </div>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {user.email}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.role === 'admin'
                              ? 'bg-purple-100 text-purple-800 dark:bg-purple-900/20 dark:text-purple-400'
                              : 'bg-blue-100 text-blue-800 dark:bg-blue-900/20 dark:text-blue-400'
                          }`}>
                            {user.role === 'admin' ? 'Administrator' : 'Mitarbeiter'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {user.department || '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {user.hireDate ? new Date(user.hireDate).toLocaleDateString('de-DE', {
                            day: '2-digit',
                            month: '2-digit',
                            year: 'numeric'
                          }) : '-'}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                            user.isActive
                              ? 'bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400'
                              : 'bg-gray-100 text-gray-800 dark:bg-gray-700 dark:text-gray-400'
                          }`}>
                            {user.isActive ? 'Aktiv' : 'Inaktiv'}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700 dark:text-gray-300">
                          {user.weeklyHours || 40}h
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-right text-sm font-medium">
                          <div className="flex justify-end space-x-2">
                            {!user.isActive ? (
                              // Deleted user - show reactivate button
                              <Button
                                size="sm"
                                variant="primary"
                                onClick={async () => {
                                  try {
                                    await reactivateUser.mutateAsync(user.id);
                                  } catch (error) {
                                    // Error handled by hook
                                  }
                                }}
                                disabled={reactivateUser.isPending}
                              >
                                Reaktivieren
                              </Button>
                            ) : (
                              // Active user - show edit/delete buttons
                              <>
                                <Button
                                  size="sm"
                                  variant="ghost"
                                  onClick={() => setEditingUser(user)}
                                >
                                  Bearbeiten
                                </Button>
                                {user.id !== currentUser.id && (
                                  <Button
                                    size="sm"
                                    variant="danger"
                                    onClick={() => handleDeleteClick(user.id, `${user.firstName} ${user.lastName}`)}
                                    disabled={deleteUser.isPending}
                                  >
                                    Löschen
                                  </Button>
                                )}
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <div className="text-center py-12">
                <Users className="w-12 h-12 text-gray-400 mx-auto mb-4" />
                <p className="text-gray-600 dark:text-gray-400">
                  Keine Benutzer gefunden
                </p>
                {(searchQuery || roleFilter !== 'all' || statusFilter !== 'active' || departmentFilter !== 'all') && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="mt-4"
                    onClick={clearFilters}
                  >
                    Filter zurücksetzen
                  </Button>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      </main>

      {/* Modals */}
      <CreateUserModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
      />

      {editingUser && (
        <EditUserModal
          isOpen={!!editingUser}
          onClose={() => setEditingUser(null)}
          user={editingUser}
        />
      )}

      {/* Delete Confirmation Dialog */}
      <ConfirmDialog
        isOpen={!!deleteConfirm}
        onClose={() => setDeleteConfirm(null)}
        onConfirm={handleDeleteConfirm}
        title="Benutzer löschen"
        message={`Möchten Sie den Benutzer "${deleteConfirm?.userName}" wirklich löschen? Diese Aktion kann nicht rückgängig gemacht werden.`}
        confirmText="Löschen"
        cancelText="Abbrechen"
        variant="danger"
      />
    </div>
  );
}
