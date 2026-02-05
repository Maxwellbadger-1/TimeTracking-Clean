import { useState } from 'react';
import { useMutation } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Eye, EyeOff, Check, X } from 'lucide-react';
import { apiClient } from '../../api/client';
import PasswordStrengthMeter from '../PasswordStrengthMeter';

export default function PasswordChangeForm() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Real-time validation (updated to 10 characters minimum - Personio 2025 standard)
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
      toast.success('Passwort erfolgreich geändert!');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    },
    onError: (error: any) => {
      // Error toast shown by api/client.ts (no duplicate needed)
      console.error('Password change failed:', error);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (allValid) {
      changePasswordMutation.mutate();
    }
  };

  return (
    <form onSubmit={handleSubmit} className="max-w-md space-y-4">
      {/* Current Password */}
      <div>
        <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
          Aktuelles Passwort
        </label>
        <div className="relative">
          <input
            type={showCurrentPassword ? 'text' : 'password'}
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className="w-full px-4 py-2 pr-10 border border-gray-300 dark:border-gray-600 rounded-lg focus:ring-2 focus:ring-blue-500 dark:bg-gray-700 dark:text-white"
            placeholder="••••••••"
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

      {/* Validation checklist (simple - PasswordStrengthMeter shows detailed requirements) */}
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
        className="w-full px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
      >
        {changePasswordMutation.isPending ? 'Wird geändert...' : 'Passwort ändern'}
      </button>
    </form>
  );
}

function ValidationItem({ valid, label }: { valid: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      {valid ? (
        <Check className="w-4 h-4 text-green-500" />
      ) : (
        <X className="w-4 h-4 text-gray-400" />
      )}
      <span className={valid ? 'text-green-700 dark:text-green-400' : 'text-gray-600 dark:text-gray-400'}>
        {label}
      </span>
    </div>
  );
}
