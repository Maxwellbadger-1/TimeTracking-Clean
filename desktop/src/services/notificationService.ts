/**
 * Notification Service
 * Handles native desktop notifications via Tauri
 */

import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

export interface NotificationOptions {
  title: string;
  body: string;
  icon?: string;
}

export type NotificationType =
  | 'absence_approved'
  | 'absence_rejected'
  | 'absence_cancelled'
  | 'overtime_warning'
  | 'break_warning'
  | 'rest_period_warning'
  | 'working_hours_warning';

class NotificationService {
  private permissionGranted: boolean = false;
  private enabled: boolean = true;

  constructor() {
    this.checkPermission();
  }

  /**
   * Check and request notification permission
   */
  async checkPermission(): Promise<boolean> {
    try {
      let permission = await isPermissionGranted();

      if (!permission) {
        const result = await requestPermission();
        permission = result === 'granted';
      }

      this.permissionGranted = permission;
      return permission;
    } catch (error) {
      console.error('Failed to check notification permission:', error);
      return false;
    }
  }

  /**
   * Enable or disable notifications
   */
  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
    localStorage.setItem('notifications_enabled', enabled ? 'true' : 'false');
  }

  /**
   * Check if notifications are enabled
   */
  isEnabled(): boolean {
    const stored = localStorage.getItem('notifications_enabled');
    if (stored !== null) {
      this.enabled = stored === 'true';
    }
    return this.enabled;
  }

  /**
   * Send a native desktop notification
   */
  async send(options: NotificationOptions): Promise<void> {
    if (!this.isEnabled()) {
      console.log('Notifications disabled by user');
      return;
    }

    if (!this.permissionGranted) {
      await this.checkPermission();
    }

    if (!this.permissionGranted) {
      console.warn('Notification permission not granted');
      return;
    }

    try {
      await sendNotification({
        title: options.title,
        body: options.body,
        icon: options.icon,
      });

      console.log('✅ Notification sent:', options.title);
    } catch (error) {
      console.error('Failed to send notification:', error);
    }
  }

  /**
   * Send typed notification with predefined templates
   */
  async sendTyped(type: NotificationType, data: Record<string, any>): Promise<void> {
    const notification = this.getNotificationTemplate(type, data);

    if (notification) {
      await this.send(notification);
    }
  }

  /**
   * Get notification template based on type
   */
  private getNotificationTemplate(
    type: NotificationType,
    data: Record<string, any>
  ): NotificationOptions | null {
    switch (type) {
      case 'absence_approved':
        return {
          title: '✅ Abwesenheit genehmigt',
          body: `Dein ${this.getAbsenceTypeLabel(data.type)} vom ${data.startDate} bis ${data.endDate} wurde genehmigt.`,
        };

      case 'absence_rejected':
        return {
          title: '❌ Abwesenheit abgelehnt',
          body: `Dein ${this.getAbsenceTypeLabel(data.type)} vom ${data.startDate} bis ${data.endDate} wurde abgelehnt.${
            data.reason ? ` Grund: ${data.reason}` : ''
          }`,
        };

      case 'absence_cancelled':
        return {
          title: '⚠️ Abwesenheit storniert',
          body: `Dein genehmigter ${this.getAbsenceTypeLabel(data.type)} vom ${data.startDate} bis ${
            data.endDate
          } wurde vom Administrator storniert.${data.reason ? ` Grund: ${data.reason}` : ''}`,
        };

      case 'overtime_warning':
        return {
          title: '⚠️ Überstunden-Warnung',
          body: `Du hast heute bereits ${data.hours} Stunden gearbeitet. Maximale Arbeitszeit: 10 Stunden pro Tag (ArbZG §3).`,
        };

      case 'break_warning':
        return {
          title: '⚠️ Pausenregelung',
          body: `Bei ${data.workHours} Stunden Arbeit sind mindestens ${data.requiredBreak} Minuten Pause erforderlich (ArbZG §4).`,
        };

      case 'rest_period_warning':
        return {
          title: '⚠️ Ruhezeit-Warnung',
          body: `Zwischen Arbeitsende und -beginn müssen mindestens 11 Stunden Ruhezeit liegen (ArbZG §5). Letztes Arbeitsende: ${data.lastEndTime}`,
        };

      case 'working_hours_warning':
        return {
          title: '⚠️ Wochenarbeitszeit',
          body: `Du hast diese Woche bereits ${data.weekHours} Stunden gearbeitet. Durchschnittlich maximal 48 Stunden pro Woche erlaubt.`,
        };

      default:
        console.warn('Unknown notification type:', type);
        return null;
    }
  }

  /**
   * Get localized absence type label
   */
  private getAbsenceTypeLabel(type: string): string {
    const labels: Record<string, string> = {
      vacation: 'Urlaub',
      sick: 'Krankmeldung',
      unpaid: 'Unbezahlter Urlaub',
      overtime_comp: 'Überstundenausgleich',
    };

    return labels[type] || type;
  }
}

// Export singleton instance
export const notificationService = new NotificationService();
