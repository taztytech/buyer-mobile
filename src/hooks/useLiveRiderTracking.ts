import { useCallback, useMemo, useRef, useState } from 'react';
import { Animated } from 'react-native';

export interface LiveRiderLocationUpdate {
  lat: number;
  lng: number;
  timestamp?: number;
  heading?: number;
  speed?: number;
  accuracy?: number;
}

type UseLiveRiderTrackingOptions = {
  minDurationMs?: number;
  maxDurationMs?: number;
  maxJumpMeters?: number;
  stationarySpeedMps?: number;
  headingSmoothingFactor?: number;
  minMoveMetersForDirection?: number;
};

const toRadians = (deg: number): number => (deg * Math.PI) / 180;
const normalizeAngle = (angle: number): number => ((angle % 360) + 360) % 360;
const shortestAngleDelta = (from: number, to: number): number =>
  ((to - from + 540) % 360) - 180;

const haversineMeters = (
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number => {
  const earthRadius = 6371000;
  const dLat = toRadians(lat2 - lat1);
  const dLng = toRadians(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRadians(lat1)) *
      Math.cos(toRadians(lat2)) *
      Math.sin(dLng / 2) *
      Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return earthRadius * c;
};

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

export function useLiveRiderTracking(
  options: UseLiveRiderTrackingOptions = {},
): {
  animatedCoordinate: any;
  rotation: Animated.Value;
  applyLocationUpdate: (update: LiveRiderLocationUpdate | null | undefined) => void;
  getCurrentCenter: () => { latitude: number; longitude: number } | null;
  getCurrentHeading: () => number;
} {
  const {
    minDurationMs = 300,
    maxDurationMs = 1800,
    maxJumpMeters = 1200,
    stationarySpeedMps = 0.8,
    headingSmoothingFactor = 0.42,
    minMoveMetersForDirection = 5,
  } = options;

  const animatedCoordinateRef = useRef<any>(null);
  const rotationRef = useRef(new Animated.Value(0));
  const lastPointRef = useRef<{ lat: number; lng: number; ts: number } | null>(null);
  const lastAppliedTimestampRef = useRef<number>(0);
  const lastHeadingRef = useRef<number>(0);
  const latestCenterRef = useRef<{ latitude: number; longitude: number } | null>(null);
  const [regionReadyVersion, setRegionReadyVersion] = useState(0);

  const applyLocationUpdate = useCallback(
    (update: LiveRiderLocationUpdate | null | undefined) => {
      if (!update) return;
      if (!Number.isFinite(update.lat) || !Number.isFinite(update.lng)) return;

      const ts = Number.isFinite(update.timestamp as number)
        ? Number(update.timestamp)
        : Date.now();
      if (ts <= lastAppliedTimestampRef.current) {
        return;
      }

      if (!animatedCoordinateRef.current) {
        // Lazy-load to avoid importing map types in non-map contexts.
        const maps = require('react-native-maps');
        const AnimatedRegion = maps.AnimatedRegion;
        animatedCoordinateRef.current = new AnimatedRegion({
          latitude: update.lat,
          longitude: update.lng,
          latitudeDelta: 0,
          longitudeDelta: 0,
        });
        setRegionReadyVersion((v) => v + 1);
        latestCenterRef.current = { latitude: update.lat, longitude: update.lng };
        lastPointRef.current = { lat: update.lat, lng: update.lng, ts };
        lastAppliedTimestampRef.current = ts;
        return;
      }

      const prev = lastPointRef.current;
      if (!prev) {
        animatedCoordinateRef.current.setValue({
          latitude: update.lat,
          longitude: update.lng,
        });
        latestCenterRef.current = { latitude: update.lat, longitude: update.lng };
        lastPointRef.current = { lat: update.lat, lng: update.lng, ts };
        lastAppliedTimestampRef.current = ts;
        return;
      }

      const distanceMeters = haversineMeters(prev.lat, prev.lng, update.lat, update.lng);
      const dtMs = Math.max(1, ts - prev.ts);
      const impliedSpeedMps = distanceMeters / (dtMs / 1000);

      // Ignore clearly noisy spikes.
      if (
        distanceMeters > maxJumpMeters &&
        impliedSpeedMps > 45 &&
        (!update.accuracy || update.accuracy > 40)
      ) {
        return;
      }

      const baseDuration = Math.round(Math.max(minDurationMs, Math.min(maxDurationMs, distanceMeters * 8)));
      const durationFromUpdateCadence = Math.round(
        Math.max(minDurationMs, Math.min(maxDurationMs, dtMs * 0.9)),
      );
      const duration = Math.min(baseDuration, durationFromUpdateCadence);

      animatedCoordinateRef.current.stopAnimation((currentValue: any) => {
        const fromLat = Number.isFinite(currentValue?.latitude)
          ? currentValue.latitude
          : prev.lat;
        const fromLng = Number.isFinite(currentValue?.longitude)
          ? currentValue.longitude
          : prev.lng;

        animatedCoordinateRef.current.setValue({
          latitude: fromLat,
          longitude: fromLng,
        });

        animatedCoordinateRef.current
          .timing({
            latitude: update.lat,
            longitude: update.lng,
            duration,
            useNativeDriver: false,
          })
          .start();

        latestCenterRef.current = { latitude: update.lat, longitude: update.lng };
      });

      const providedHeading = Number.isFinite(update.heading as number)
        ? normalizeAngle(Number(update.heading))
        : null;
      const movementBearing =
        distanceMeters >= minMoveMetersForDirection
          ? computeBearing(prev.lat, prev.lng, update.lat, update.lng)
          : null;
      const preferredHeading =
        movementBearing !== null &&
        (update.speed === undefined || update.speed === null || update.speed >= stationarySpeedMps)
          ? movementBearing
          : providedHeading;

      if (preferredHeading !== null) {
        const prevHeading = normalizeAngle(lastHeadingRef.current);
        const delta = shortestAngleDelta(prevHeading, preferredHeading);
        const nextHeading = normalizeAngle(prevHeading + delta * headingSmoothingFactor);
        lastHeadingRef.current = nextHeading;
        Animated.timing(rotationRef.current, {
          toValue: nextHeading,
          duration,
          useNativeDriver: true,
        }).start();
      }

      lastPointRef.current = { lat: update.lat, lng: update.lng, ts };
      lastAppliedTimestampRef.current = ts;
    },
    [
      headingSmoothingFactor,
      maxDurationMs,
      maxJumpMeters,
      minDurationMs,
      minMoveMetersForDirection,
      stationarySpeedMps,
    ],
  );

  return useMemo(
    () => ({
      animatedCoordinate: animatedCoordinateRef.current,
      rotation: rotationRef.current,
      applyLocationUpdate,
      getCurrentCenter: () => latestCenterRef.current,
      getCurrentHeading: () => normalizeAngle(lastHeadingRef.current),
    }),
    [applyLocationUpdate, regionReadyVersion],
  );
}

