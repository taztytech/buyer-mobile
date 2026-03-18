import React, { useEffect, useRef, useCallback, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  LayoutChangeEvent,
  TouchableOpacity,
  Animated,
  Image,
  Appearance,
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
  mode = 'ready',
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
  const [followMode, setFollowMode] = useState(true);

  const {
    animatedCoordinate,
    rotation,
    applyLocationUpdate,
    getCurrentCenter,
    getCurrentHeading,
  } = useLiveRiderTracking();

  const hasAgent = !!agentLocationUpdate;

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
    const currentCenter = getCurrentCenter();
    mapRef.current.fitToCoordinates(
      [
        restaurantCoordinate,
        customerCoordinate,
        ...(currentCenter ? [currentCenter] : []),
      ],
      { edgePadding: padding, animated }
    );
  }, [restaurantCoordinate, customerCoordinate, getCurrentCenter]);

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

  useEffect(() => {
    if (!agentLocationUpdate) return;
    applyLocationUpdate(agentLocationUpdate);
  }, [applyLocationUpdate, agentLocationUpdate]);

  useEffect(() => {
    if (!followMode || !mapRef.current || !hasAgent) return;
    const center = getCurrentCenter();
    if (!center) return;

    mapRef.current.animateCamera(
      {
        center,
        heading: getCurrentHeading(),
        pitch: 0,
        zoom: inPip ? 16 : 17,
      },
      { duration: 800 },
    );
  }, [followMode, hasAgent, getCurrentCenter, getCurrentHeading, inPip, resizeTrigger]);

  const handleRecenter = useCallback(() => {
    setFollowMode(true);
    const center = getCurrentCenter();
    if (!center || !mapRef.current) return;
    mapRef.current.animateCamera(
      {
        center,
        heading: getCurrentHeading(),
        pitch: 0,
        zoom: inPip ? 16 : 17,
      },
      { duration: 550 },
    );
  }, [getCurrentCenter, getCurrentHeading, inPip]);

  const riderRotationStyle = {
    transform: [
      {
        rotate: rotation.interpolate({
          inputRange: [0, 360],
          outputRange: ['0deg', '360deg'],
        }),
      },
    ],
  };

  const isNightByTime = new Date().getHours() >= 18;
  const isDarkMode = Appearance.getColorScheme() === 'dark';
  const useNightTheme = isNightByTime || isDarkMode;
  const riderIconSource = useNightTheme ? riderNightAsset : riderDayAsset;

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

        {hasAgent && animatedCoordinate ? (
          <Marker.Animated
            key="agent-marker"
            coordinate={animatedCoordinate}
            anchor={{ x: 0.5, y: 0.5 }}
            title="Delivery Partner"
            flat
          >
            <Animated.View style={riderRotationStyle}>
              <Image
                source={riderIconSource}
                style={styles.agentBikeImage}
                resizeMode="contain"
              />
            </Animated.View>
          </Marker.Animated>
        ) : null}
      </MapView>
      {hasAgent && !followMode ? (
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
  agentBikeImage: {
    width: 46,
    height: 46,
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
