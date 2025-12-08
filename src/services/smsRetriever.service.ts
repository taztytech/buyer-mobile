import { NativeModules, NativeEventEmitter, Platform } from 'react-native';

const { SmsRetrieverModule } = NativeModules;

interface SmsRetrieverEvents {
  onSmsReceived: (data: { otp: string | null; message: string }) => void;
  onSmsTimeout: () => void;
  onSmsError: (error: { error: string }) => void;
}

class SmsRetrieverService {
  private eventEmitter: NativeEventEmitter | null = null;
  private listeners: Array<{ remove: () => void }> = [];

  constructor() {
    // Don't create event emitter in constructor - create it lazily when needed
    // This prevents crashes if the module isn't available yet
  }

  /**
   * Get or create the event emitter
   */
  private getEventEmitter(): NativeEventEmitter | null {
    if (Platform.OS !== 'android' || !SmsRetrieverModule) {
      return null;
    }

    if (!this.eventEmitter) {
      try {
        // Only create if module exists and has required methods
        if (SmsRetrieverModule && typeof SmsRetrieverModule === 'object') {
          this.eventEmitter = new NativeEventEmitter(SmsRetrieverModule);
        }
      } catch (error) {
        console.warn('Failed to create NativeEventEmitter:', error);
        return null;
      }
    }

    return this.eventEmitter;
  }

  /**
   * Start listening for SMS with OTP
   * @param timeoutMs - Timeout in milliseconds (default: 60000 = 60 seconds)
   * @returns Promise<boolean>
   */
  async startSmsRetriever(timeoutMs: number = 60000): Promise<boolean> {
    if (Platform.OS !== 'android') {
      console.warn('SMS Retriever is only available on Android');
      return false;
    }

    if (!SmsRetrieverModule) {
      console.warn('SmsRetrieverModule is not available - SMS auto-read disabled');
      return false;
    }

    // Check if module methods exist
    if (typeof SmsRetrieverModule.startSmsRetriever !== 'function' ||
        typeof SmsRetrieverModule.setTimeout !== 'function') {
      console.warn('SmsRetrieverModule methods not available - SMS auto-read disabled');
      return false;
    }

    try {
      // Set timeout first
      await SmsRetrieverModule.setTimeout(timeoutMs);
      // Start retriever
      const result = await SmsRetrieverModule.startSmsRetriever();
      return result;
    } catch (error: any) {
      // Don't throw - just log and return false
      // This allows the app to continue working with manual OTP entry
      console.warn('Failed to start SMS Retriever (this is OK, manual entry still works):', error?.message || error);
      return false;
    }
  }

  /**
   * Stop listening for SMS
   * @returns Promise<boolean>
   */
  async stopSmsRetriever(): Promise<boolean> {
    if (Platform.OS !== 'android' || !SmsRetrieverModule) {
      return false;
    }

    if (typeof SmsRetrieverModule.stopSmsRetriever !== 'function') {
      return false;
    }

    try {
      const result = await SmsRetrieverModule.stopSmsRetriever();
      this.removeAllListeners();
      return result;
    } catch (error: any) {
      // Don't throw - just log and return false
      console.warn('Failed to stop SMS Retriever (this is OK):', error?.message || error);
      this.removeAllListeners(); // Still try to clean up listeners
      return false;
    }
  }

  /**
   * Get the app's hash string for SMS Retriever API
   * This hash needs to be appended to the SMS message sent by your backend
   * @returns Promise<string> - 11-character hash string
   */
  async getAppHash(): Promise<string> {
    if (Platform.OS !== 'android' || !SmsRetrieverModule) {
      throw new Error('SMS Retriever is only available on Android');
    }

    if (typeof SmsRetrieverModule.getAppHash !== 'function') {
      throw new Error('SmsRetrieverModule.getAppHash is not available');
    }

    try {
      const hash = await SmsRetrieverModule.getAppHash();
      return hash;
    } catch (error: any) {
      console.error('Failed to get app hash:', error);
      throw error;
    }
  }

  /**
   * Add event listeners for SMS Retriever events
   * @param callbacks - Object containing callback functions
   * @returns Function to remove all listeners
   */
  addListeners(callbacks: Partial<SmsRetrieverEvents>): () => void {
    const emitter = this.getEventEmitter();
    if (!emitter) {
      console.warn('Event emitter not available - SMS Retriever may not be supported');
      return () => {};
    }

    const listeners: Array<{ remove: () => void }> = [];

    try {
      if (callbacks.onSmsReceived) {
        const listener = emitter.addListener(
          'onSmsReceived',
          callbacks.onSmsReceived
        );
        listeners.push(listener);
      }

      if (callbacks.onSmsTimeout) {
        const listener = emitter.addListener(
          'onSmsTimeout',
          callbacks.onSmsTimeout
        );
        listeners.push(listener);
      }

      if (callbacks.onSmsError) {
        const listener = emitter.addListener(
          'onSmsError',
          callbacks.onSmsError
        );
        listeners.push(listener);
      }
    } catch (error) {
      console.warn('Failed to add SMS Retriever listeners:', error);
      // Clean up any listeners that were added before the error
      listeners.forEach((listener) => {
        try {
          listener.remove();
        } catch (e) {
          // Ignore cleanup errors
        }
      });
      return () => {};
    }

    this.listeners.push(...listeners);

    // Return function to remove these listeners
    return () => {
      listeners.forEach((listener) => listener.remove());
      this.listeners = this.listeners.filter(
        (l) => !listeners.includes(l)
      );
    };
  }

  /**
   * Remove all event listeners
   */
  removeAllListeners(): void {
    this.listeners.forEach((listener) => listener.remove());
    this.listeners = [];
  }
}

export const smsRetrieverService = new SmsRetrieverService();

