import * as Location from 'expo-location';
import { Platform } from 'react-native';

/** A delivery location resolved from the device GPS at app launch. */
export interface ResolvedCurrentLocation {
  /** Shown as the top-bar label, e.g. "Current location". */
  name: string;
  /** Human-readable line under the label (reverse-geocoded). */
  address: string;
  latitude: number;
  longitude: number;
  /** Reverse-geocoded parts, for saving this spot as an address. */
  parts?: {
    line1: string;
    city: string;
    state: string;
    pincode: string;
  };
}

/** Reject a promise if it does not settle within `ms`. Returns null on timeout. */
async function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T | null> {
  return new Promise<T | null>((resolve) => {
    let done = false;
    const timer = setTimeout(() => {
      if (!done) {
        done = true;
        resolve(null);
      }
    }, ms);
    promise
      .then((value) => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(value);
        }
      })
      .catch(() => {
        if (!done) {
          done = true;
          clearTimeout(timer);
          resolve(null);
        }
      });
  });
}

/**
 * Resolve the user's current GPS location as a delivery location, meant to run
 * during the launch splash so the home top bar can default to where the user
 * actually is.
 *
 * Requests foreground permission if not already granted. Returns null when
 * permission is denied, the fix cannot be obtained in time, or anything throws
 * — callers fall back to the saved/default address on null, so this never
 * blocks startup.
 *
 * The whole thing is capped by `timeoutMs` (the splash is ~6.6s) so a slow or
 * missing GPS fix can never delay the app past the splash.
 */
export async function resolveCurrentLocation(
  timeoutMs = 6000,
): Promise<ResolvedCurrentLocation | null> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      const requested = await Location.requestForegroundPermissionsAsync();
      status = requested.status;
    }
    if (status !== 'granted') {
      return null;
    }

    const position = await withTimeout(
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeoutMs,
    );
    if (!position) {
      return null;
    }

    const { latitude, longitude } = position.coords;

    // Reverse-geocode for a readable address; the coordinates alone are enough
    // to render and to fetch nearby restaurants, so a slow/failed geocode just
    // falls back to a generic label.
    let address = 'Your current location';
    let parts: ResolvedCurrentLocation['parts'];
    try {
      const results = await withTimeout(
        Location.reverseGeocodeAsync({ latitude, longitude }),
        2500,
      );
      const place = results && results[0];
      if (place) {
        const line = [
          place.name,
          place.street,
          place.district || place.subregion,
          place.city,
          place.postalCode,
        ]
          .filter(Boolean)
          .join(', ');
        if (line) {
          address = line;
        }
        parts = {
          line1: [place.name, place.street].filter(Boolean).join(', ') || place.district || '',
          city: place.city || place.subregion || '',
          state: place.region || '',
          pincode: (place.postalCode || '').replace(/\D/g, '').slice(0, 6),
        };
      }
    } catch {
      // Keep the generic label.
    }

    return { name: 'Current location', address, latitude, longitude, parts };
  } catch {
    return null;
  }
}

/**
 * Makes sure location can be read: asks for permission, and when the phone's
 * location (GPS) is switched off shows the system "Turn on location" popup
 * (Android). Returns true when location is on and allowed.
 */
export async function ensureLocationOn(): Promise<boolean> {
  try {
    let { status } = await Location.getForegroundPermissionsAsync();
    if (status !== 'granted') {
      status = (await Location.requestForegroundPermissionsAsync()).status;
    }
    if (status !== 'granted') return false;
    if (await Location.hasServicesEnabledAsync()) return true;
    if (Platform.OS === 'android') {
      // Throws when the user taps "No thanks".
      await Location.enableNetworkProviderAsync();
      return await Location.hasServicesEnabledAsync();
    }
    return false;
  } catch {
    return false;
  }
}

/** Distance in metres between two points (haversine). */
export function distanceMeters(
  a: { latitude: number; longitude: number },
  b: { latitude: number; longitude: number },
): number {
  const R = 6371000;
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(h));
}
