/**
 * User Color Utilities
 *
 * Generates consistent colors for users based on their ID
 * Used for calendar entries, avatars, etc.
 */

// Professional color palette (accessible, WCAG compliant)
const USER_COLORS = [
  { bg: 'bg-blue-50 dark:bg-blue-900/20', text: 'text-blue-700 dark:text-blue-300', border: 'border-blue-200 dark:border-blue-700', badge: 'bg-blue-600' },
  { bg: 'bg-green-50 dark:bg-green-900/20', text: 'text-green-700 dark:text-green-300', border: 'border-green-200 dark:border-green-700', badge: 'bg-green-600' },
  { bg: 'bg-purple-50 dark:bg-purple-900/20', text: 'text-purple-700 dark:text-purple-300', border: 'border-purple-200 dark:border-purple-700', badge: 'bg-purple-600' },
  { bg: 'bg-orange-50 dark:bg-orange-900/20', text: 'text-orange-700 dark:text-orange-300', border: 'border-orange-200 dark:border-orange-700', badge: 'bg-orange-600' },
  { bg: 'bg-pink-50 dark:bg-pink-900/20', text: 'text-pink-700 dark:text-pink-300', border: 'border-pink-200 dark:border-pink-700', badge: 'bg-pink-600' },
  { bg: 'bg-indigo-50 dark:bg-indigo-900/20', text: 'text-indigo-700 dark:text-indigo-300', border: 'border-indigo-200 dark:border-indigo-700', badge: 'bg-indigo-600' },
  { bg: 'bg-teal-50 dark:bg-teal-900/20', text: 'text-teal-700 dark:text-teal-300', border: 'border-teal-200 dark:border-teal-700', badge: 'bg-teal-600' },
  { bg: 'bg-rose-50 dark:bg-rose-900/20', text: 'text-rose-700 dark:text-rose-300', border: 'border-rose-200 dark:border-rose-700', badge: 'bg-rose-600' },
  { bg: 'bg-cyan-50 dark:bg-cyan-900/20', text: 'text-cyan-700 dark:text-cyan-300', border: 'border-cyan-200 dark:border-cyan-700', badge: 'bg-cyan-600' },
  { bg: 'bg-amber-50 dark:bg-amber-900/20', text: 'text-amber-700 dark:text-amber-300', border: 'border-amber-200 dark:border-amber-700', badge: 'bg-amber-600' },
];

/**
 * Get consistent color for a user based on userId
 */
export function getUserColor(userId: number) {
  const index = userId % USER_COLORS.length;
  return USER_COLORS[index];
}

/**
 * Get initials from first and last name
 * Falls back to userInitials if provided
 */
export function getInitials(firstName?: string, lastName?: string, userInitials?: string): string {
  if (userInitials) return userInitials;
  if (!firstName && !lastName) return '??';

  const first = firstName?.charAt(0).toUpperCase() || '';
  const last = lastName?.charAt(0).toUpperCase() || '';

  return first + last;
}

/**
 * Get full name from first and last name
 */
export function getFullName(firstName?: string, lastName?: string): string {
  if (!firstName && !lastName) return 'Unbekannt';
  if (!firstName) return lastName || 'Unbekannt';
  if (!lastName) return firstName;
  return `${firstName} ${lastName}`;
}
