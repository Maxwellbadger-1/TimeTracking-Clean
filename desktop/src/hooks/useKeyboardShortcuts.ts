import { useEffect } from 'react';

/**
 * Keyboard Shortcuts Hook
 *
 * Desktop-specific keyboard shortcuts for better UX
 */

interface ShortcutConfig {
  key: string;
  ctrl?: boolean;
  shift?: boolean;
  alt?: boolean;
  meta?: boolean; // Cmd on Mac
  handler: () => void;
  description: string;
}

export function useKeyboardShortcuts(shortcuts: ShortcutConfig[]) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      shortcuts.forEach((shortcut) => {
        const keyMatches = event.key.toLowerCase() === shortcut.key.toLowerCase();
        const ctrlMatches = shortcut.ctrl ? event.ctrlKey || event.metaKey : !event.ctrlKey && !event.metaKey;
        const shiftMatches = shortcut.shift ? event.shiftKey : !event.shiftKey;
        const altMatches = shortcut.alt ? event.altKey : !event.altKey;

        if (keyMatches && ctrlMatches && shiftMatches && altMatches) {
          event.preventDefault();
          shortcut.handler();
        }
      });
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [shortcuts]);
}

/**
 * Global Keyboard Shortcuts Hook
 * For app-wide shortcuts (navigation, etc.)
 */
export function useGlobalKeyboardShortcuts(handlers: {
  onDashboard?: () => void;
  onCalendar?: () => void;
  onReports?: () => void;
  onTimeEntries?: () => void;
  onAbsences?: () => void;
  onUsers?: () => void;
}) {
  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      // Only trigger if Ctrl/Cmd + number
      if (!(event.ctrlKey || event.metaKey)) return;

      // Ignore if user is typing in input/textarea
      const target = event.target as HTMLElement;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') return;

      switch (event.key) {
        case '1':
          event.preventDefault();
          handlers.onDashboard?.();
          break;
        case '2':
          event.preventDefault();
          handlers.onCalendar?.();
          break;
        case '3':
          event.preventDefault();
          handlers.onTimeEntries?.();
          break;
        case '4':
          event.preventDefault();
          handlers.onAbsences?.();
          break;
        case '5':
          event.preventDefault();
          handlers.onReports?.();
          break;
        case '6':
          event.preventDefault();
          handlers.onUsers?.();
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [handlers]);
}

/**
 * Modal Keyboard Shortcuts Hook
 * For handling Escape to close, Enter to submit
 */
export function useModalKeyboardShortcuts(
  isOpen: boolean,
  onClose: () => void,
  onSubmit?: () => void
) {
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        onClose();
      }

      if (event.key === 'Enter' && onSubmit) {
        // Only trigger if not in textarea
        const target = event.target as HTMLElement;
        if (target.tagName === 'TEXTAREA') return;

        event.preventDefault();
        onSubmit();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, onSubmit]);
}
