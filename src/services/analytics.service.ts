/**
 * Backward-compatible analytics service entrypoint.
 * The implementation now lives under src/analytics/.
 */

export {
  analyticsService,
  AnalyticsManager,
  AnalyticsEvents,
  AnalyticsScreens,
  AnalyticsUserProperties,
  FirebaseStandardEvents,
  FirebaseStandardParams,
} from '@/analytics';
