import React, { useEffect, useRef, useCallback, useState } from 'react';
import { View, Text, StyleSheet, LayoutChangeEvent } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

// Same map setup as LocationSelectionScreen: react-native-maps with Google provider
let MapView: any = null;
let Marker: any = null;
let Polyline: any = null;
let PROVIDER_GOOGLE: any = null;
let isMapAvailable = false;

try {
  const MapViewModule = require('react-native-maps');
  MapView = MapViewModule.default;
  Marker = MapViewModule.Marker;
  Polyline = MapViewModule.Polyline;
  PROVIDER_GOOGLE = MapViewModule.PROVIDER_GOOGLE;
  isMapAvailable = true;
} catch {
  isMapAvailable = false;
}

export interface OrderRouteCoordinate {
  latitude: number;
  longitude: number;
}

interface OrderRouteMapViewProps {
  restaurantCoordinate: OrderRouteCoordinate;
  customerCoordinate: OrderRouteCoordinate;
  restaurantName?: string;
  customerAddress?: string;
  /** Pass isInPipMode here — changing it triggers re-fit and re-mount on exit */
  resizeTrigger?: boolean | number;
  style?: object;
}

export const OrderRouteMapView: React.FC<OrderRouteMapViewProps> = ({
  restaurantCoordinate,
  customerCoordinate,
  restaurantName,
  customerAddress,
  resizeTrigger,
  style,
}) => {
  const mapRef = useRef<any>(null);
  const layoutRef = useRef<{ width: number; height: number } | null>(null);
  const prevResizeTriggerRef = useRef(resizeTrigger);
  const fitScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Incrementing this key force-remounts the MapView completely.
  // We do this when returning from PiP (resizeTrigger true → false) so all
  // markers re-render fresh and nothing is left in a stale state.
  const [mapKey, setMapKey] = useState(0);

  // Whether we are in PiP mode — controls marker label visibility and marker size
  const inPip = !!resizeTrigger;

  const clearFitTimer = useCallback(() => {
    if (fitScheduledRef.current !== null) {
      clearTimeout(fitScheduledRef.current);
      fitScheduledRef.current = null;
    }
  }, []);

  const fitToRoute = useCallback((animated = true) => {
    if (!mapRef.current) return;
    const layout = layoutRef.current;
    const isPip = !!prevResizeTriggerRef.current;
    // Generous padding so both markers and their label bubbles are fully visible.
    const padding = isPip
      ? { top: 36, right: 36, bottom: 36, left: 36 }
      : layout
        ? {
            top:    Math.max(100, Math.round(layout.height * 0.22)),
            right:  Math.max(100, Math.round(layout.width * 0.22)),
            bottom: Math.max(180, Math.round(layout.height * 0.28)),
            left:   Math.max(100, Math.round(layout.width * 0.22)),
          }
        : { top: 120, right: 120, bottom: 200, left: 120 };
    mapRef.current.fitToCoordinates(
      [restaurantCoordinate, customerCoordinate],
      { edgePadding: padding, animated }
    );
  }, [restaurantCoordinate, customerCoordinate]);

  const scheduleFit = useCallback((delay: number, animated = true) => {
    clearFitTimer();
    fitScheduledRef.current = setTimeout(() => fitToRoute(animated), delay);
  }, [fitToRoute, clearFitTimer]);

  // Initial fit after mount
  useEffect(() => {
    if (!isMapAvailable || !MapView) return;
    scheduleFit(450);
    return clearFitTimer;
  }, [scheduleFit, clearFitTimer]);

  // React to PiP ↔ normal transitions
  useEffect(() => {
    const prev = prevResizeTriggerRef.current;
    prevResizeTriggerRef.current = resizeTrigger;

    if (resizeTrigger === prev) return;

    const wasInPip = !!prev;
    const nowInPip = !!resizeTrigger;

    if (wasInPip && !nowInPip) {
      // Returning from PiP → force-remount so all markers re-render cleanly
      setMapKey(k => k + 1);
    } else if (!wasInPip && nowInPip) {
      // Entering PiP → re-fit after the window has shrunk
      scheduleFit(500, false);
    }
  }, [resizeTrigger, scheduleFit]);

  const handleMapReady = useCallback(() => {
    scheduleFit(300);
  }, [scheduleFit]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        layoutRef.current = { width, height };
        scheduleFit(300);
      }
    },
    [scheduleFit]
  );

  if (!isMapAvailable || !MapView || !Marker || !Polyline) {
    return (
      <View style={[styles.container, style]} onLayout={handleLayout}>
        <MaterialIcons name="map" size={64} color="#999" />
        <Text style={styles.mapPlaceholderText}>
          Map Preview{'\n'}(Requires development build)
        </Text>
      </View>
    );
  }

  return (
    <View style={[styles.container, style]} onLayout={handleLayout}>
      <MapView
        key={mapKey}
        ref={mapRef}
        provider={PROVIDER_GOOGLE}
        style={StyleSheet.absoluteFill}
        initialRegion={{
          latitude: (restaurantCoordinate.latitude + customerCoordinate.latitude) / 2,
          longitude: (restaurantCoordinate.longitude + customerCoordinate.longitude) / 2,
          latitudeDelta: Math.max(0.01, Math.abs(restaurantCoordinate.latitude - customerCoordinate.latitude) * 2.5),
          longitudeDelta: Math.max(0.01, Math.abs(restaurantCoordinate.longitude - customerCoordinate.longitude) * 2.5),
        }}
        onMapReady={handleMapReady}
        showsUserLocation={false}
        showsMyLocationButton={false}
        moveOnMarkerPress={false}
      >
        {/* White outline behind the route */}
        <Polyline
          coordinates={[restaurantCoordinate, customerCoordinate]}
          strokeColor="rgba(255,255,255,0.85)"
          strokeWidth={9}
          lineCap="round"
          lineJoin="round"
        />
        {/* Green dashed route line */}
        <Polyline
          coordinates={[restaurantCoordinate, customerCoordinate]}
          strokeColor="#00B14F"
          strokeWidth={5}
          lineDashPattern={[18, 10]}
          lineCap="round"
          lineJoin="round"
        />

        {/* Restaurant marker — key ensures it re-renders when coords change */}
        <Marker
          key={`store-${restaurantCoordinate.latitude}-${restaurantCoordinate.longitude}`}
          coordinate={restaurantCoordinate}
          anchor={{ x: 0.5, y: inPip ? 0.5 : 0.28 }}
          title={restaurantName || 'Restaurant'}
        >
          <View style={styles.markerWithLabel}>
            <View style={[styles.storeMarker, inPip && styles.storeMarkerPip]}>
              <MaterialIcons
                name="restaurant"
                size={inPip ? 13 : 18}
                color="#FFFFFF"
              />
            </View>
            {!inPip && restaurantName ? (
              <View style={[styles.labelBubble, styles.storeLabel]}>
                <Text style={styles.labelText} numberOfLines={2}>
                  {restaurantName}
                </Text>
              </View>
            ) : null}
          </View>
        </Marker>

        {/* Customer / delivery marker — key ensures it re-renders when coords change */}
        <Marker
          key={`customer-${customerCoordinate.latitude}-${customerCoordinate.longitude}`}
          coordinate={customerCoordinate}
          anchor={{ x: 0.5, y: inPip ? 0.5 : 0.28 }}
          title={customerAddress || 'Delivery location'}
        >
          <View style={styles.markerWithLabel}>
            <View style={[styles.customerMarker, inPip && styles.customerMarkerPip]}>
              <MaterialIcons
                name="person"
                size={inPip ? 14 : 20}
                color="#2196F3"
              />
            </View>
            {!inPip && customerAddress ? (
              <View style={[styles.labelBubble, styles.customerLabel]}>
                <Text style={styles.labelText} numberOfLines={2}>
                  {customerAddress}
                </Text>
              </View>
            ) : null}
          </View>
        </Marker>
      </MapView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    width: '100%',
    height: '100%',
    backgroundColor: '#E9E9E9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  mapPlaceholderText: {
    marginTop: 12,
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
    color: '#666',
    lineHeight: 22,
  },
  markerWithLabel: {
    alignItems: 'center',
    justifyContent: 'flex-start',
  },
  storeMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#DC2626',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  storeMarkerPip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  customerMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: '#90CAF9',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 6,
  },
  customerMarkerPip: {
    width: 24,
    height: 24,
    borderRadius: 12,
    borderWidth: 2,
  },
  labelBubble: {
    marginTop: 5,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    maxWidth: 140,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 3,
    elevation: 3,
  },
  storeLabel: {
    backgroundColor: '#DC2626',
  },
  customerLabel: {
    backgroundColor: '#2196F3',
  },
  labelText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    color: '#FFFFFF',
    textAlign: 'center',
  },
});
