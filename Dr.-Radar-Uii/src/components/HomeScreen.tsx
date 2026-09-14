import { ScreenTab } from '../types';
import { OverviewScreen } from './OverviewScreen';

interface HomeScreenProps {
  onNavigate: (tab: ScreenTab) => void;
  onOpenReport?: (title: string, date: string) => void;
  onOpenSettings?: () => void;
  onOpenPatientProfile?: () => void;
  onOpenNotifications?: () => void;
  reminders?: {
    enabled: boolean;
    time: string;
    soundEnabled: boolean;
    permission: NotificationPermission;
    isSupported: boolean;
    toggleReminders: () => void;
    setReminderTime: (time: string) => void;
    toggleSound: () => void;
    sendTestNotification: () => void;
    requestPermission: () => Promise<boolean>;
  };
}

export const HomeScreen = ({
  onNavigate,
  onOpenSettings,
  onOpenPatientProfile,
  onOpenNotifications,
}: HomeScreenProps) => {
  return (
    <OverviewScreen
      onNavigate={onNavigate}
      onOpenSettings={onOpenSettings}
      onOpenPatientProfile={onOpenPatientProfile}
      onOpenNotifications={onOpenNotifications}
    />
  );
};
