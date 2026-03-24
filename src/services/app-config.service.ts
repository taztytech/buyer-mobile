/**
 * App Config Service
 * Stores app-wide config from home API (e.g. cancel_timer for order cancellation)
 */

const DEFAULT_CANCEL_TIMER_SECONDS = 30;

class AppConfigService {
  private cancelTimerSeconds: number = DEFAULT_CANCEL_TIMER_SECONDS;

  setCancelTimer(seconds: number | null | undefined) {
    if (seconds == null || isNaN(Number(seconds))) {
      this.cancelTimerSeconds = DEFAULT_CANCEL_TIMER_SECONDS;
      return;
    }
    const val = Math.max(0, Math.floor(Number(seconds)));
    this.cancelTimerSeconds = val > 0 ? val : DEFAULT_CANCEL_TIMER_SECONDS;
  }

  getCancelTimer(): number {
    return this.cancelTimerSeconds;
  }
}

export const appConfigService = new AppConfigService();
