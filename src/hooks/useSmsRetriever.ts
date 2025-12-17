import { useEffect, useRef, useCallback } from 'react';
import { Platform } from 'react-native';
import { smsRetrieverService } from '@/services/smsRetriever.service';

interface UseSmsRetrieverOptions {
  /**
   * Timeout in milliseconds (default: 60000 = 60 seconds)
   */
  timeoutMs?: number;
  /**
   * Callback when OTP is received
   */
  onOtpReceived?: (otp: string) => void;
  /**
   * Callback when SMS retrieval times out
   */
  onTimeout?: () => void;
  /**
   * Callback when an error occurs
   */
  onError?: (error: string) => void;
  /**
   * Whether to automatically start on mount (default: true)
   */
  autoStart?: boolean;
  /**
   * Whether SMS Retriever is enabled (default: true on Android)
   */
  enabled?: boolean;
}

interface UseSmsRetrieverReturn {
  /**
   * Start listening for SMS
   */
  start: () => Promise<void>;
  /**
   * Stop listening for SMS
   */
  stop: () => Promise<void>;
  /**
   * Get the app hash string (for backend SMS formatting)
   */
  getAppHash: () => Promise<string>;
  /**
   * Whether SMS Retriever is currently active
   */
  isActive: boolean;
}

/**
 * React Hook for SMS Retriever API
 * 
 * @example
 * ```tsx
 * const { start, stop, isActive } = useSmsRetriever({
 *   onOtpReceived: (otp) => {
 *     setOtp(otp);
 *   },
 *   onTimeout: () => {
 *     console.log('SMS retrieval timed out');
 *   },
 * });
 * 
 * useEffect(() => {
 *   start();
 *   return () => {
 *     stop();
 *   };
 * }, []);
 * ```
 */
export const useSmsRetriever = (
  options: UseSmsRetrieverOptions = {}
): UseSmsRetrieverReturn => {
  const {
    timeoutMs = 60000,
    onOtpReceived,
    onTimeout,
    onError,
    autoStart = true,
    enabled = Platform.OS === 'android',
  } = options;

  const isActiveRef = useRef(false);
  const removeListenersRef = useRef<(() => void) | null>(null);

  const start = useCallback(async () => {
    if (!enabled || Platform.OS !== 'android') {
      return;
    }

    if (isActiveRef.current) {
      console.warn('SMS Retriever is already active');
      return;
    }

    try {
      // Remove any existing listeners first
      if (removeListenersRef.current) {
        try {
          removeListenersRef.current();
        } catch (e) {
          // Ignore cleanup errors
        }
      }

      // Add event listeners (with error handling)
      try {
        removeListenersRef.current = smsRetrieverService.addListeners({
          onSmsReceived: (data) => {
            try {
              isActiveRef.current = false;
              if (data.otp && onOtpReceived) {
                onOtpReceived(data.otp);
              }
              // Auto-stop after receiving
              smsRetrieverService.stopSmsRetriever().catch(() => {
                // Silently ignore stop errors
              });
            } catch (error) {
              console.error('Error in onSmsReceived callback:', error);
            }
          },
          onSmsTimeout: () => {
            try {
              isActiveRef.current = false;
              if (onTimeout) {
                onTimeout();
              }
            } catch (error) {
              console.error('Error in onSmsTimeout callback:', error);
            }
          },
          onSmsError: (error) => {
            try {
              isActiveRef.current = false;
              if (onError) {
                onError(error.error);
              }
            } catch (e) {
              console.error('Error in onSmsError callback:', e);
            }
          },
        });
      } catch (listenerError) {
        console.warn('Failed to add SMS Retriever listeners:', listenerError);
        // Continue anyway - might still work
      }

      // Start SMS Retriever
      await smsRetrieverService.startSmsRetriever(timeoutMs);
      isActiveRef.current = true;
    } catch (error: any) {
      isActiveRef.current = false;
      const errorMessage = error?.message || 'Failed to start SMS Retriever';
      // Only log as warning - don't crash the app
      console.warn('SMS Retriever start error (this is OK, manual entry still works):', errorMessage);
      if (onError) {
        try {
          onError(errorMessage);
        } catch (e) {
          // Ignore callback errors
        }
      }
    }
  }, [timeoutMs, onOtpReceived, onTimeout, onError, enabled]);

  const stop = useCallback(async () => {
    if (!enabled || Platform.OS !== 'android') {
      return;
    }

    try {
      await smsRetrieverService.stopSmsRetriever();
      isActiveRef.current = false;

      // Remove listeners
      if (removeListenersRef.current) {
        try {
          removeListenersRef.current();
        } catch (e) {
          // Ignore cleanup errors
        }
        removeListenersRef.current = null;
      }
    } catch (error: any) {
      // Silently ignore stop errors - not critical
      console.warn('SMS Retriever stop error (this is OK):', error);
    }
  }, [enabled]);

  const getAppHash = useCallback(async () => {
    if (!enabled || Platform.OS !== 'android') {
      throw new Error('SMS Retriever is only available on Android');
    }
    return smsRetrieverService.getAppHash();
  }, [enabled]);

  // Auto-start on mount if enabled
  useEffect(() => {
    if (autoStart && enabled) {
      // Use setTimeout to avoid calling during render
      const timer = setTimeout(() => {
        start().catch(() => {
          // Silently ignore - manual entry still works
        });
      }, 100);
      
      return () => {
        clearTimeout(timer);
        stop().catch(() => {
          // Silently ignore cleanup errors
        });
      };
    }

    // Cleanup on unmount
    return () => {
      if (enabled) {
        stop().catch(() => {
          // Silently ignore cleanup errors
        });
      }
    };
  }, [autoStart, enabled]); // eslint-disable-line react-hooks/exhaustive-deps

  return {
    start,
    stop,
    getAppHash,
    isActive: isActiveRef.current,
  };
};

