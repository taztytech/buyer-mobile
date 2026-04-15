import { fcmNotificationService } from './fcmNotification.service';

class PushNotificationService {
  async registerForPushNotifications(): Promise<boolean> {
    return fcmNotificationService.initialize();
  }

  async unregisterPushToken(): Promise<boolean> {
    return fcmNotificationService.unregisterToken();
  }

  async getPushToken(): Promise<string | null> {
    return fcmNotificationService.getStoredToken();
  }

  async areNotificationsEnabled(): Promise<boolean> {
    return fcmNotificationService.areNotificationsEnabled();
  }
}

// Export singleton instance
export const pushNotificationService = new PushNotificationService();
export default pushNotificationService;
