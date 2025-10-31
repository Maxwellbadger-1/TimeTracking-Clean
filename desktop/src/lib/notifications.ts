import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification';

/**
 * Tauri Native Notifications
 *
 * Diese Funktion nutzt das Tauri Notification Plugin für
 * native OS-Benachrichtigungen (macOS Notification Center, Windows Action Center, etc.)
 */

export async function showNotification(title: string, body: string) {
  try {
    // Check if we have permission
    let permissionGranted = await isPermissionGranted();

    // Request permission if not granted
    if (!permissionGranted) {
      const permission = await requestPermission();
      permissionGranted = permission === 'granted';
    }

    // Send notification if permission granted
    if (permissionGranted) {
      await sendNotification({ title, body });
    } else {
      console.warn('Notification permission denied');
    }
  } catch (error) {
    console.error('Failed to send notification:', error);
  }
}

/**
 * Show absence request notification
 */
export async function notifyAbsenceRequestSubmitted(type: string, startDate: string, endDate: string) {
  await showNotification(
    'Abwesenheitsantrag eingereicht',
    `Ihr ${type}-Antrag vom ${startDate} bis ${endDate} wurde eingereicht und wartet auf Genehmigung.`
  );
}

/**
 * Show absence request approved notification
 */
export async function notifyAbsenceRequestApproved(type: string, startDate: string, endDate: string) {
  await showNotification(
    'Abwesenheitsantrag genehmigt',
    `Ihr ${type}-Antrag vom ${startDate} bis ${endDate} wurde genehmigt.`
  );
}

/**
 * Show absence request rejected notification
 */
export async function notifyAbsenceRequestRejected(type: string, startDate: string, endDate: string, reason?: string) {
  await showNotification(
    'Abwesenheitsantrag abgelehnt',
    `Ihr ${type}-Antrag vom ${startDate} bis ${endDate} wurde abgelehnt.${reason ? ` Grund: ${reason}` : ''}`
  );
}

/**
 * Show overtime threshold notification
 */
export async function notifyOvertimeThreshold(hours: number, threshold: number) {
  await showNotification(
    'Überstunden-Schwellenwert erreicht',
    `Sie haben ${hours} Überstunden erreicht (Schwellenwert: ${threshold}h).`
  );
}

/**
 * Show reminder notification
 */
export async function notifyReminder(message: string) {
  await showNotification(
    'Erinnerung',
    message
  );
}
