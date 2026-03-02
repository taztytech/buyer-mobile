import React, { useCallback, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, Animated } from 'react-native';
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

    const [showOverlay, setShowOverlay] = useState(!webViewLoadedRef.current);
    const overlayOpacity = useRef(new Animated.Value(showOverlay ? 1 : 0)).current;

    // Stable source object — new reference ONLY when the URI actually changes
    const source = useMemo(() => ({ uri: trackingUrl }), [trackingUrl]);

    const handleLoad = useCallback(() => {
      console.log('[TrackingWebView] Map loaded successfully');
      webViewLoadedRef.current = true;
      if (showOverlay) {
        Animated.timing(overlayOpacity, {
          toValue: 0,
          duration: 220,
          useNativeDriver: true,
        }).start(() => {
          setShowOverlay(false);
        });
      }
    }, [overlayOpacity, showOverlay, webViewLoadedRef]);

    const handleLoadStart = useCallback(() => {
      if (!webViewLoadedRef.current && !showOverlay) {
        console.log('[TrackingWebView] Map loading started');
        overlayOpacity.setValue(1);
        setShowOverlay(true);
      }
    }, [overlayOpacity, showOverlay, webViewLoadedRef]);

    const handleError = useCallback((e: any) => {
      console.error('[TrackingWebView] Error:', e.nativeEvent);
    }, []);

    const handleHttpError = useCallback((e: any) => {
      console.error('[TrackingWebView] HTTP Error:', e.nativeEvent.statusCode, e.nativeEvent.description);
    }, []);

    const injectedTrackingLayoutScript = `
      (function() {
        function fixLayout() {
          try {
            var docEl = document.documentElement;
            var body = document.body || docEl;
            docEl.style.height = '100vh';
            body.style.height = '100vh';

            var candidates = document.querySelectorAll('.gm-style, #map, [id*="map"], [class*="map"]');
            var vh = window.innerHeight || docEl.clientHeight || body.clientHeight || 0;

            for (var i = 0; i < candidates.length; i++) {
              var el = candidates[i];
              el.style.height = vh + 'px';
              el.style.maxHeight = '100vh';
            }

            try {
              var evt = new Event('resize');
              window.dispatchEvent(evt);
            } catch (e) {}
          } catch (e) {}
        }

        window.__taztyFixTrackingLayout = fixLayout;

        if (document.readyState === 'complete' || document.readyState === 'interactive') {
          setTimeout(fixLayout, 50);
        } else {
          document.addEventListener('DOMContentLoaded', function() { setTimeout(fixLayout, 50); });
        }

        window.addEventListener('resize', function() {
          setTimeout(fixLayout, 50);
        });
      })();
      true;
    `;

    return (
      <View style={styles.container}>
        <WebView
          ref={webViewRef}
          source={source}
          style={styles.webView}
          injectedJavaScript={injectedTrackingLayoutScript}
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
        />
        {showOverlay && (
          <Animated.View style={[styles.loadingOverlay, { opacity: overlayOpacity }]}>
            <ActivityIndicator size="large" color="#00B14F" />
          </Animated.View>
        )}
      </View>
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
    backgroundColor: 'rgba(0, 0, 0, 0.35)',
    justifyContent: 'center',
    alignItems: 'center',
  },
});

