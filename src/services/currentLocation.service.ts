import * as Location from 'expo-location';

/** A delivery location resolved from the device GPS at app launch. */
export interface ResolvedCurrentLocation {
  /** Shown as the top-bar label, e.g. "Current location". */
  name: string;
  /** Human-readable line under the label (reverse-geocoded). */
  address: string;
  latitude: number;
  longitude: number;
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
      }
    } catch {
      // Keep the generic label.
    }

    return { name: 'Current location', address, latitude, longitude };
  } catch {
    return null;
  }
}
