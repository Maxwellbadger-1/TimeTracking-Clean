import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff, AlertTriangle, Shield } from 'lucide-react';
import { apiClient } from '../api/client';
import PasswordStrengthMeter from '../components/PasswordStrengthMeter';
import { useCurrentUser } from '../hooks';
import { useAuthStore } from '../store/authStore';

/**
 * Force Password Change Page
 *
 * Shown when user logs in and forcePasswordChange flag is set (Admin Reset)
 * User CANNOT skip this page - must change password before accessing the app
 */
export default function ForcePasswordChangePage() {
  const { data: currentUser } = useCurrentUser();
  const { clearForcePasswordChange } = useAuthStore();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time validation
  const validations = {
    length: newPassword.length >= 10,
    different: newPassword && currentPassword && newPassword !== currentPassword,
    match: newPassword && confirmPassword && newPassword === confirmPassword,
  };

  const allValid = validations.length && validations.different && validations.match && !!currentPassword;

  const changePasswordMutation = useMutation({
    mutationFn: async () => {
      return apiClient.patch('/users/me/password', { currentPassword, newPassword });
    },
    onSuccess: () => {
      toast.success('Passwort erfolgreich geändert! Sie können nun fortfahren.');
      // Clear force password change flag - user can now access the app
      clearForcePasswordChange();
    },
    onError: (error: any) => {
      // Error toast shown by api/client.ts (no duplicate needed)
      console.error('Force password change failed:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allValid) {
      changePasswordMutation.mutate();
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 dark:from-gray-900 dark:to-gray-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md">
        {/* Warning Card */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border-2 border-yellow-400 dark:border-yellow-600 rounded-lg p-6 mb-6 shadow-lg">
          <div className="flex items-start gap-4">
            <div className="p-3 bg-yellow-400 dark:bg-yellow-600 rounded-full">
              <AlertTriangle className="w-6 h-6 text-white" />
            </div>
            <div className="flex-1">
              <h2 className="text-lg font-semibold text-yellow-900 dark:text-yellow-100 mb-2">
                Passwortänderung erforderlich
              </h2>
              <p className="text-sm text-yellow-800 dark:text-yellow-200">
                Ihr Administrator hat Ihr Passwort zurückgesetzt. Aus Sicherheitsgründen müssen Sie ein neues Passwort festlegen, bevor Sie fortfahren können.
              </p>
            </div>
          </div>
        </div>

        {/* Form Card */}
        <div className="bg-white dark:bg-gray-800 rounded-lg shadow-xl p-8">
          {/* Header */}
          <div className="flex items-center gap-3 mb-6">
            <div className="p-2 bg-blue-100 dark:bg-blue-900/20 rounded-lg">
              <Shield className="w-6 h-6 text-blue-600 dark:text-blue-400" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
                Neues Passwort setzen
              </h1>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentUser?.firstName} {currentUser?.lastName}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Current Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Aktuelles Passwort (vom Admin)
              </label>
              <div className="relative">
                <input
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  {showCurrentPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* New Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Neues Passwort
              </label>
              <div className="relative">
                <input
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  {showNewPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>

              {/* Password Strength Meter */}
              {newPassword && (
                <div className="mt-3">
                  <PasswordStrengthMeter password={newPassword} />
                </div>
              )}
            </div>

            {/* Confirm Password */}
            <div>
              <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                Neues Passwort bestätigen
              </label>
              <div className="relative">
                <input
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
                  placeholder="••••••••"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700 dark:text-gray-400"
                >
                  {showConfirmPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                </button>
              </div>
            </div>

            {/* Validation checklist */}
            {(currentPassword || confirmPassword) && (
              <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 space-y-2">
                <p className="text-sm font-medium text-gray-700 dark:text-gray-300">Zusätzliche Anforderungen:</p>
                <div className="space-y-1">
                  <ValidationItem valid={!!validations.different} label="Unterschiedlich vom aktuellen Passwort" />
                  <ValidationItem valid={!!validations.match} label="Passwörter stimmen überein" />
                </div>
              </div>
            )}

            <button
              type="submit"
              disabled={!allValid || changePasswordMutation.isPending}
              className="w-full px-4 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-medium"
            >
              {changePasswordMutation.isPending ? 'Wird geändert...' : 'Passwort ändern'}
            </button>
          </form>

          <div className="mt-6 pt-6 border-t border-gray-200 dark:border-gray-700">
            <p className="text-xs text-gray-600 dark:text-gray-400 text-center">
              Sie können diese Seite nicht überspringen. Bitte ändern Sie Ihr Passwort, um fortzufahren.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

function ValidationItem({ valid, label }: { valid: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <div className={`w-4 h-4 rounded-full flex items-center justify-center ${
        valid ? 'bg-green-500' : 'bg-gray-300 dark:bg-gray-600'
      }`}>
        {valid && <span className="text-white text-xs">✓</span>}
      </div>
      <span className={valid ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
        {label}
      </span>
    </div>
  );
}
