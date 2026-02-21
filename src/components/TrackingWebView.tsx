import React, { useCallback, useMemo } from 'react';
import { View, ActivityIndicator, StyleSheet } from 'react-native';
import { WebView } from 'react-native-webview';

interface TrackingWebViewProps {
  trackingUrl: string;
  webViewRef: React.RefObject<any>;
  webViewLoadedRef: React.MutableRefObject<boolean>;
}

/**
 * TrackingWebView — memoized WebView for the order tracking map.
 *
 * Why React.memo?
 * ───────────────
 * The tracking overlay parent re-renders whenever any screen-level state
 * changes: isInPipMode, bottom-sheet position, order status updates, etc.
 * Without memoization, every such re-render would pass new object references
 * for `source`, `style`, and callback props to the WebView — even if the
 * actual values are identical — causing the WebView to process unnecessary
 * prop changes and producing the visible lag / freeze when switching between
 * PiP and normal mode.
 *
 * With React.memo + stable props:
 *  • trackingUrl  → only changes when the URL actually changes
 *  • webViewRef   → a React ref, always the same object reference
 *  • webViewLoadedRef → a React ref, always the same object reference
 *
 * Result: the WebView NEVER re-renders during PiP ↔ normal transitions,
 * bottom-sheet drags, status polls, or any other parent state change.
 */
const TrackingWebView: React.FC<TrackingWebViewProps> = React.memo(
  ({ trackingUrl, webViewRef, webViewLoadedRef }) => {

    // Stable source object — new reference ONLY when the URI actually changes
    const source = useMemo(() => ({ uri: trackingUrl }), [trackingUrl]);

    const handleLoad = useCallback(() => {
      console.log('[TrackingWebView] Map loaded successfully');
      webViewLoadedRef.current = true;
    }, [webViewLoadedRef]);

    const handleLoadStart = useCallback(() => {
      if (!webViewLoadedRef.current) {
        console.log('[TrackingWebView] Map loading started');
      }
    }, [webViewLoadedRef]);

    const handleError = useCallback((e: any) => {
      console.error('[TrackingWebView] Error:', e.nativeEvent);
    }, []);

    const handleHttpError = useCallback((e: any) => {
      console.error('[TrackingWebView] HTTP Error:', e.nativeEvent.statusCode, e.nativeEvent.description);
    }, []);

    // Loading overlay — neutral dark background that works in both normal and PiP mode.
    // This is intentionally NOT mode-aware so the prop reference stays stable.
    const renderLoadingView = useCallback(() => (
      <View style={styles.loadingOverlay}>
        <ActivityIndicator size="large" color="#00B14F" />
      </View>
    ), []);

    return (
      <WebView
        ref={webViewRef}
        source={source}
        style={styles.webView}
        startInLoadingState={!webViewLoadedRef.current}
        renderLoading={webViewLoadedRef.current ? undefined : renderLoadingView}
        onLoad={handleLoad}
        onLoadStart={handleLoadStart}
        onError={handleError}
        onHttpError={handleHttpError}
        javaScriptEnabled={true}
        domStorageEnabled={true}
        thirdPartyCookiesEnabled={true}
        sharedCookiesEnabled={true}
        mixedContentMode="always"
        allowsInlineMediaPlayback={true}
        mediaPlaybackRequiresUserAction={false}
        showsHorizontalScrollIndicator={false}
        showsVerticalScrollIndicator={false}
        androidHardwareAccelerationDisabled={false}
        geolocationEnabled={true}
        cacheEnabled={true}
        incognito={false}
        containerStyle={styles.container}
      />
    );
  },
);

TrackingWebView.displayName = 'TrackingWebView';

export default TrackingWebView;

// ─── Stable style objects (defined outside component — zero recreation cost) ──

const styles = StyleSheet.create({
  webView: {
    flex: 1,
    backgroundColor: '#000000',
  },
  container: {
    flex: 1,
  },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

