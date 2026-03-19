import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  TouchableOpacity,
  Appearance,
  Image,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useLiveRiderTracking, LiveRiderLocationUpdate } from '@/hooks/useLiveRiderTracking';

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
  agentLocationUpdate?: LiveRiderLocationUpdate | null;
  routeCoordinates?: OrderRouteCoordinate[];
  storeToAgentRouteCoordinates?: OrderRouteCoordinate[] | null;
  mode?: 'ready' | 'live';
  restaurantName?: string;
  customerAddress?: string;
  /** Pass isInPipMode here — changing it triggers re-fit and re-mount on exit */
  resizeTrigger?: boolean | number;
  style?: object;
}

const riderDayAsset = require('../../assets/map_bike_day.png');
const riderNightAsset = require('../../assets/map_bike_night.png');
const routeOutlineColor = 'rgba(255,255,255,0.92)';
const routePrimaryColor = '#1E5BE0';
const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;
const shortestAngleDelta = (from: number, to: number): number =>
  ((to - from + 540) % 360) - 180;
const computeBearing = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const phi1 = toRadians(lat1);
  const phi2 = toRadians(lat2);
  const dLng = toRadians(lng2 - lng1);
  const y = Math.sin(dLng) * Math.cos(phi2);
  const x =
    Math.cos(phi1) * Math.sin(phi2) -
    Math.sin(phi1) * Math.cos(phi2) * Math.cos(dLng);
  return normalizeAngle((Math.atan2(y, x) * 180) / Math.PI);
};
const nightMapStyle = [
  { elementType: 'geometry', stylers: [{ color: '#1d2c4d' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#8ec3b9' }] },
  { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#304a7d' }] },
  { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0e1626' }] },
];

export const OrderRouteMapView: React.FC<OrderRouteMapViewProps> = ({
  restaurantCoordinate,
  customerCoordinate,
  agentLocationUpdate,
  routeCoordinates,
  storeToAgentRouteCoordinates,
  restaurantName,
  customerAddress,
  resizeTrigger,
  style,
}) => {
  const mapRef = useRef<any>(null);
  const layoutRef = useRef<{ width: number; height: number } | null>(null);
  const prevResizeTriggerRef = useRef(resizeTrigger);
  const fitScheduledRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasInitialStoreFocusRef = useRef(false);

  // Incrementing this key force-remounts the MapView completely.
  // We do this when returning from PiP (resizeTrigger true → false) so all
  // markers re-render fresh and nothing is left in a stale state.
  const [mapKey, setMapKey] = useState(0);
  const [followMode, setFollowMode] = useState(false);
  const [zoomBucket, setZoomBucket] = useState<'near' | 'far'>('near');
  const [markerRotation, setMarkerRotation] = useState(0);
  const lastMarkerCoordRef = useRef<{ lat: number; lng: number } | null>(null);
  const lastHeadingRef = useRef(0);
  const headingAnimTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const {
    animatedCoordinate,
    applyLocationUpdate,
    getCurrentCenter,
    getCurrentHeading,
  } = useLiveRiderTracking();

  const hasValidAgentCoordinate =
    !!agentLocationUpdate &&
    Number.isFinite(agentLocationUpdate.lat) &&
    Number.isFinite(agentLocationUpdate.lng);

  // Whether we are in PiP mode — controls marker label visibility and marker size
  const inPip = !!resizeTrigger;

  const clearFitTimer = useCallback(() => {
    if (fitScheduledRef.current !== null) {
      clearTimeout(fitScheduledRef.current);
      fitScheduledRef.current = null;
    }
  }, []);

  const focusStoreOnOpen = useCallback((animated = true) => {
    if (!mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center: restaurantCoordinate,
        pitch: 0,
        zoom: inPip ? 15 : 16,
      },
      { duration: animated ? 400 : 0 },
    );
    hasInitialStoreFocusRef.current = true;
  }, [restaurantCoordinate, inPip]);

  const scheduleStoreFocus = useCallback((delay: number, animated = true) => {
    clearFitTimer();
    fitScheduledRef.current = setTimeout(() => focusStoreOnOpen(animated), delay);
  }, [focusStoreOnOpen, clearFitTimer]);

  // Initial fit after mount
  useEffect(() => {
    if (!isMapAvailable || !MapView || hasInitialStoreFocusRef.current) return;
    scheduleStoreFocus(450);
    return clearFitTimer;
  }, []);

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
      hasInitialStoreFocusRef.current = false;
    } else if (!wasInPip && nowInPip) {
      // Entering PiP → keep a stable camera around store first.
      hasInitialStoreFocusRef.current = false;
      scheduleStoreFocus(500, false);
    }
  }, [resizeTrigger, scheduleStoreFocus]);

  const handleMapReady = useCallback(() => {
    if (hasInitialStoreFocusRef.current) return;
    scheduleStoreFocus(300);
  }, [scheduleStoreFocus]);

  const handleLayout = useCallback(
    (e: LayoutChangeEvent) => {
      const { width, height } = e.nativeEvent.layout;
      if (width > 0 && height > 0) {
        layoutRef.current = { width, height };
        if (hasInitialStoreFocusRef.current) return;
        scheduleStoreFocus(300);
      }
    },
    [scheduleStoreFocus]
  );

  useEffect(() => {
    if (!hasValidAgentCoordinate || !agentLocationUpdate) return;
    applyLocationUpdate(agentLocationUpdate);
  }, [applyLocationUpdate, hasValidAgentCoordinate, agentLocationUpdate]);

  useEffect(() => {
    if (!hasValidAgentCoordinate || !agentLocationUpdate) return;

    const lat = agentLocationUpdate.lat;
    const lng = agentLocationUpdate.lng;
    const providedHeading = Number.isFinite(agentLocationUpdate.heading as number)
      ? normalizeAngle(Number(agentLocationUpdate.heading))
      : null;

    let targetHeading = providedHeading;
    const previous = lastMarkerCoordRef.current;
    if (targetHeading === null && previous) {
      targetHeading = computeBearing(previous.lat, previous.lng, lat, lng);
    }
    lastMarkerCoordRef.current = { lat, lng };

    if (targetHeading === null) return;

    if (headingAnimTimerRef.current) {
      clearInterval(headingAnimTimerRef.current);
      headingAnimTimerRef.current = null;
    }

    const from = normalizeAngle(lastHeadingRef.current);
    const delta = shortestAngleDelta(from, targetHeading);
    const to = normalizeAngle(from + delta * 0.65); // smooth heading changes

    const durationMs = 520;
    const intervalMs = 16;
    const steps = Math.max(1, Math.round(durationMs / intervalMs));
    let step = 0;

    headingAnimTimerRef.current = setInterval(() => {
      step += 1;
      const t = Math.min(1, step / steps);
      // ease-out for natural rotation at turns
      const eased = 1 - Math.pow(1 - t, 3);
      const current = normalizeAngle(from + shortestAngleDelta(from, to) * eased);
      setMarkerRotation(current);
      if (t >= 1 && headingAnimTimerRef.current) {
        clearInterval(headingAnimTimerRef.current);
        headingAnimTimerRef.current = null;
        lastHeadingRef.current = to;
      }
    }, intervalMs);
  }, [agentLocationUpdate, hasValidAgentCoordinate]);

  useEffect(() => {
    return () => {
      if (headingAnimTimerRef.current) {
        clearInterval(headingAnimTimerRef.current);
        headingAnimTimerRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (!followMode || !mapRef.current || !hasValidAgentCoordinate) return;
    const center = getCurrentCenter();
    const fallbackCenter = hasValidAgentCoordinate
      ? {
          latitude: agentLocationUpdate!.lat,
          longitude: agentLocationUpdate!.lng,
        }
      : null;
    const resolvedCenter = center || fallbackCenter;
    if (!resolvedCenter) return;

    mapRef.current.animateCamera(
      {
        center: resolvedCenter,
        heading: getCurrentHeading(),
        pitch: 0,
      },
      { duration: 800 },
    );
  }, [followMode, hasValidAgentCoordinate, getCurrentCenter, getCurrentHeading, inPip, resizeTrigger, agentLocationUpdate]);

  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    const center = getCurrentCenter();
    if (!center || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center,
        heading: getCurrentHeading(),
        pitch: 0,
      },
      { duration: 550 },
    );
  }, [getCurrentCenter, getCurrentHeading]);

  const isDarkMode = Appearance.getColorScheme() === 'dark';
  const useNightTheme = isDarkMode;
  const riderIconSource = useNightTheme ? riderNightAsset : riderDayAsset;
  const riderResolvedAsset = Image.resolveAssetSource(riderIconSource);
  const riderMarkerSource = {
    uri: riderResolvedAsset.uri,
    // Lower scale => larger marker.
    // Keep icon slightly larger than store marker icon but smaller than previous size.
    scale: zoomBucket === 'far' ? 16 : 18,
  };

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
        customMapStyle={useNightTheme ? nightMapStyle : []}
        initialRegion={{
          latitude: (restaurantCoordinate.latitude + customerCoordinate.latitude) / 2,
          longitude: (restaurantCoordinate.longitude + customerCoordinate.longitude) / 2,
          latitudeDelta: Math.max(0.01, Math.abs(restaurantCoordinate.latitude - customerCoordinate.latitude) * 2.5),
          longitudeDelta: Math.max(0.01, Math.abs(restaurantCoordinate.longitude - customerCoordinate.longitude) * 2.5),
        }}
        onMapReady={handleMapReady}
        onRegionChangeComplete={(region: any) => {
          const delta = Number(region?.latitudeDelta);
          if (!Number.isFinite(delta)) return;
          const nextBucket: 'near' | 'far' = delta >= 0.035 ? 'far' : 'near';
          setZoomBucket((prev) => (prev === nextBucket ? prev : nextBucket));
        }}
        showsUserLocation={false}
        showsMyLocationButton={false}
        moveOnMarkerPress={false}
        onPanDrag={() => {
          if (followMode) {
            setFollowMode(false);
          }
        }}
      >
        {/* White outline behind route (Rider-style road emphasis) */}
        <Polyline
          coordinates={
            routeCoordinates && routeCoordinates.length > 1
              ? routeCoordinates
              : [restaurantCoordinate, customerCoordinate]
          }
          strokeColor={routeOutlineColor}
          strokeWidth={10}
          lineCap="round"
          lineJoin="round"
        />
        {/* Main route (deep blue, consistent with Rider map style) */}
        <Polyline
          coordinates={
            routeCoordinates && routeCoordinates.length > 1
              ? routeCoordinates
              : [restaurantCoordinate, customerCoordinate]
          }
          strokeColor={routePrimaryColor}
          strokeWidth={6}
          lineCap="round"
          lineJoin="round"
        />
        {/* Secondary route (store -> rider), subtle grey with 50% opacity */}
        {storeToAgentRouteCoordinates && storeToAgentRouteCoordinates.length > 1 ? (
          <Polyline
            coordinates={storeToAgentRouteCoordinates}
            strokeColor="rgba(200, 205, 215, 0.5)"
            strokeWidth={4}
            lineCap="round"
            lineJoin="round"
          />
        ) : null}

        {/* Restaurant marker — key ensures it re-renders when coords change */}
        <Marker
          key={`store-${restaurantCoordinate.latitude}-${restaurantCoordinate.longitude}`}
          coordinate={restaurantCoordinate}
          zIndex={10}
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
          zIndex={20}
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

        {hasValidAgentCoordinate && animatedCoordinate ? (
          <Marker.Animated
            key="agent-marker"
            coordinate={animatedCoordinate}
            zIndex={30}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Delivery Partner"
            image={riderMarkerSource}
            tracksViewChanges={true}
            rotation={markerRotation}
            flat
          />
        ) : hasValidAgentCoordinate && agentLocationUpdate ? (
          <Marker
            key="agent-marker-fallback"
            coordinate={{
              latitude: agentLocationUpdate.lat,
              longitude: agentLocationUpdate.lng,
            }}
            zIndex={30}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Delivery Partner"
            image={riderMarkerSource}
            tracksViewChanges={true}
            rotation={markerRotation}
            flat
          />
        ) : null}
      </MapView>
      {hasValidAgentCoordinate && !followMode ? (
        <TouchableOpacity
          style={styles.recenterButton}
          onPress={handleRecenter}
          activeOpacity={0.85}
        >
          <MaterialIcons name="my-location" size={20} color="#00B14F" />
        </TouchableOpacity>
      ) : null}
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
  agentMarker: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#F97316',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3,
    elevation: 5,
  },
  recenterButton: {
    position: 'absolute',
    right: 16,
    bottom: 22,
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 4,
    elevation: 5,
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
