import { useState, useEffect, useCallback } from 'react';
import { ASSETS } from '../data/mockData';

export interface ReminderConfig {
  enabled: boolean;
  time: string; // "HH:mm" format (24h)
  lastFiredDate: string | null; // "YYYY-MM-DD"
  soundEnabled: boolean;
}

const STORAGE_KEY = 'dr_radar_reminders_config';

const DEFAULT_CONFIG: ReminderConfig = {
  enabled: false,
  time: '09:00',
  lastFiredDate: null,
  soundEnabled: true,
};

export const useReminders = (onToast?: (message: string, type?: 'success' | 'info' | 'warning') => void) => {
  const [config, setConfig] = useState<ReminderConfig>(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY) || localStorage.getItem('vital_prism_reminders_config');
      if (stored) {
        return { ...DEFAULT_CONFIG, ...JSON.parse(stored) };
      }
    } catch (e) {
      console.warn('Could not read reminder config from storage:', e);
    }
    return DEFAULT_CONFIG;
  });

  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default');
  const [isSupported, setIsSupported] = useState<boolean>(true);

  // Check notification support and permission on mount
  useEffect(() => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      setIsSupported(false);
      setPermission('unsupported');
    } else {
      setIsSupported(true);
      setPermission(Notification.permission);
    }
  }, []);

  // Save config changes to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(config));
    } catch (e) {
      console.warn('Could not save reminder config to storage:', e);
    }
  }, [config]);

  // Request browser notification permission
  const requestPermission = useCallback(async (): Promise<NotificationPermission | 'unsupported'> => {
    if (!('Notification' in window)) {
      setIsSupported(false);
      setPermission('unsupported');
      onToast?.('Browser notifications are not supported on this device.', 'warning');
      return 'unsupported';
    }

    try {
      const result = await Notification.requestPermission();
      setPermission(result);
      if (result === 'granted') {
        onToast?.('Browser notification permission granted!', 'success');
      } else if (result === 'denied') {
        onToast?.('Notifications blocked in browser settings. Please allow in site permissions.', 'warning');
      }
      return result;
    } catch (error) {
      console.error('Failed to request notification permission:', error);
      onToast?.('Could not request notification permission.', 'warning');
      return 'denied';
    }
  }, [onToast]);

  // Fire a browser notification
  const fireNotification = useCallback((title: string, body: string, tag = 'daily-checkin') => {
    if (typeof window === 'undefined' || !('Notification' in window)) {
      onToast?.(`${title}: ${body}`, 'info');
      return;
    }

    if (Notification.permission === 'granted') {
      try {
        const notif = new Notification(title, {
          body,
          icon: ASSETS.logo,
          badge: ASSETS.logo,
          tag,
          requireInteraction: false,
          silent: !config.soundEnabled,
        });

        notif.onclick = () => {
          window.focus();
          notif.close();
        };
      } catch (err) {
        console.warn('Failed to construct system Notification (likely iframe restrictions):', err);
        // Fallback to in-app notification
        onToast?.(`${title}: ${body}`, 'info');
      }
    } else {
      onToast?.(`${title}: ${body}`, 'info');
    }
  }, [config.soundEnabled, onToast]);

  // Toggle reminders ON or OFF
  const toggleReminders = useCallback(async (targetState?: boolean): Promise<boolean> => {
    const nextState = targetState !== undefined ? targetState : !config.enabled;

    if (nextState) {
      // User is enabling reminders - check or request notification permission
      if (!('Notification' in window)) {
        setConfig((prev) => ({ ...prev, enabled: true }));
        onToast?.('Reminders enabled (in-app fallback, browser notifications unsupported).', 'info');
        return true;
      }

      let currentPerm = Notification.permission;
      if (currentPerm === 'default') {
        currentPerm = await requestPermission();
      }

      if (currentPerm === 'granted') {
        setConfig((prev) => ({ ...prev, enabled: true }));
        onToast?.(`Daily check-in reminder active for ${config.time}.`, 'success');
        // Send initial confirmation notification
        fireNotification(
          'Dr. Radar • Check-in Scheduled',
          `Daily check-in reminder set for ${config.time}. We'll notify you to record your heart vitals!`,
          'setup-confirm'
        );
        return true;
      } else if (currentPerm === 'denied') {
        // Still enable the toggle so in-app reminders work, but warn about browser permissions
        setConfig((prev) => ({ ...prev, enabled: true }));
        onToast?.('Enabled, but notifications are blocked in your browser. Check address bar permissions.', 'warning');
        return true;
      } else {
        // Default / dismissed
        setConfig((prev) => ({ ...prev, enabled: true }));
        return true;
      }
    } else {
      // Disabling reminders
      setConfig((prev) => ({ ...prev, enabled: false }));
      onToast?.('Daily check-in reminders disabled.', 'info');
      return false;
    }
  }, [config.enabled, config.time, fireNotification, onToast, requestPermission]);

  // Update scheduled time
  const setReminderTime = useCallback((newTime: string) => {
    setConfig((prev) => ({ ...prev, time: newTime }));
    if (config.enabled) {
      onToast?.(`Daily reminder updated to ${newTime}`, 'success');
    }
  }, [config.enabled, onToast]);

  // Toggle sound
  const toggleSound = useCallback(() => {
    setConfig((prev) => ({ ...prev, soundEnabled: !prev.soundEnabled }));
  }, []);

  // Send an immediate test notification
  const sendTestNotification = useCallback(async () => {
    if (!('Notification' in window)) {
      onToast?.('Notifications API unsupported in this browser.', 'warning');
      return;
    }

    if (Notification.permission === 'default') {
      const perm = await requestPermission();
      if (perm !== 'granted') return;
    } else if (Notification.permission === 'denied') {
      onToast?.('Notifications are blocked by your browser settings. Please allow notifications.', 'warning');
      return;
    }

    fireNotification(
      'Dr. Radar • Daily Cardiac Check-in',
      'Time for your daily heart check-in! Ashton, take 30 seconds to record your resting ECG & BPM.',
      'test-notification'
    );
    onToast?.('Test notification sent!', 'success');
  }, [fireNotification, onToast, requestPermission]);

  // Active interval clock watcher to trigger notification when current time matches scheduled time
  useEffect(() => {
    if (!config.enabled) return;

    const checkSchedule = () => {
      const now = new Date();
      const currentHours = String(now.getHours()).padStart(2, '0');
      const currentMinutes = String(now.getMinutes()).padStart(2, '0');
      const currentTimeStr = `${currentHours}:${currentMinutes}`;
      const todayDateStr = now.toISOString().split('T')[0];

      // If matches time and hasn't fired today
      if (currentTimeStr === config.time && config.lastFiredDate !== todayDateStr) {
        setConfig((prev) => ({ ...prev, lastFiredDate: todayDateStr }));
        fireNotification(
          'Dr. Radar • Daily Cardiac Check-in',
          'Good morning Ashton! Time for your scheduled daily cardiac rhythm screening. Tap to monitor vitals.',
          'scheduled-daily'
        );
      }
    };

    // Check immediately and then every 20 seconds
    checkSchedule();
    const interval = setInterval(checkSchedule, 20000);
    return () => clearInterval(interval);
  }, [config.enabled, config.time, config.lastFiredDate, fireNotification]);

  return {
    enabled: config.enabled,
    time: config.time,
    soundEnabled: config.soundEnabled,
    permission,
    isSupported,
    toggleReminders,
    setReminderTime,
    toggleSound,
    sendTestNotification,
    requestPermission,
  };
};
