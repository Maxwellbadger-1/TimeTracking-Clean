/**
 * Tauri Environment Detection Utility
 *
 * Provides robust detection for whether the app is running in a Tauri desktop environment
 * vs a regular browser. Compatible with both Tauri v1 and v2.
 *
 * @see https://github.com/tauri-apps/tauri/discussions/6119
 * @see https://github.com/tauri-apps/tauri/discussions/11586
 */

/**
 * Check if the application is running in a Tauri desktop environment
 *
 * **Why multiple checks?**
 * - Tauri v2 changed how globals are exposed
 * - `window.__TAURI__` is NOT available by default in v2 (requires `withGlobalTauri`)
 * - `window.isTauri` is the official API since v2.0.0-beta.9
 * - `window.__TAURI_INTERNALS__` is always available in v2
 *
 * **Check order:**
 * 1. Official API: `window.isTauri()` (Tauri v2+)
 * 2. Always available: `window.__TAURI_INTERNALS__` (Tauri v2)
 * 3. Legacy: `window.__TAURI__` (Tauri v1 or v2 with withGlobalTauri)
 *
 * @returns {boolean} True if running in Tauri desktop app, false if browser
 *
 * @example
 * ```typescript
 * import { isTauri } from './utils/tauri';
 *
 * if (isTauri()) {
 *   // Use Tauri-specific APIs (file system, dialogs, etc.)
 *   const { save } = await import('@tauri-apps/plugin-dialog');
 * } else {
 *   // Use browser fallback (download link, etc.)
 *   const blob = new Blob([data]);
 * }
 * ```
 */
export function isTauri(): boolean {
  // Server-side rendering check
  if (typeof window === 'undefined') {
    return false;
  }

  // 1. Try official API first (Tauri v2.0.0-beta.9+)
  //    This is the recommended method for Tauri v2
  if ('isTauri' in window && typeof (window as any).isTauri === 'function') {
    try {
      return (window as any).isTauri();
    } catch (error) {
      console.warn('Error calling window.isTauri():', error);
    }
  }

  // 2. Check for __TAURI_INTERNALS__ (always available in Tauri v2)
  //    This is more reliable than __TAURI__ in v2
  if ('__TAURI_INTERNALS__' in window) {
    return true;
  }

  // 3. Legacy check for Tauri v1 or v2 with withGlobalTauri enabled
  //    Note: This is NOT set by default in Tauri v2
  if ('__TAURI__' in window) {
    return true;
  }

  // Not running in Tauri
  return false;
}

/**
 * Platform detection for mobile vs desktop Tauri apps
 * Useful for conditional UI/UX (e.g., touch vs mouse interactions)
 */
export function isTauriMobile(): boolean {
  if (!isTauri()) return false;
  return navigator.maxTouchPoints > 0;
}

/**
 * Platform detection for desktop Tauri apps only
 */
export function isTauriDesktop(): boolean {
  return isTauri() && !isTauriMobile();
}
