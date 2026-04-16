import { PermissionsAndroid, Platform } from 'react-native';
import Geolocation from 'react-native-geolocation-service';
import Geocoder from 'react-native-geocoding';
import Constants from './rn-constants';

type PermissionStatus = 'granted' | 'denied' | 'undetermined';
type PermissionResponse = { status: PermissionStatus; canAskAgain?: boolean };

let geocoderInitialized = false;
const FALLBACK_MAPS_API_KEY = 'AIzaSyByxizUPOdWROrVV1IikPFPrI-F6EmACk0';

const resolveMapsApiKey = (): string => {
  const keyFromConfig = Constants.appConfig?.extra?.GOOGLE_MAPS_API_KEY;
  const keyFromEnv = process.env.GOOGLE_MAPS_API_KEY || process.env.PUBLIC_GOOGLE_MAPS_API_KEY;
  return (keyFromConfig || keyFromEnv || FALLBACK_MAPS_API_KEY || '').trim();
};

const ensureGeocoder = () => {
  if (geocoderInitialized) return;
  const mapsApiKey = resolveMapsApiKey();
  if (!mapsApiKey) {
    throw new Error('Google Maps API key is missing for geocoder initialization');
  }
  Geocoder.init(mapsApiKey);
  geocoderInitialized = true;
};

export const Accuracy = {
  Balanced: 'balanced',
  High: 'high',
} as const;

export interface LocationGeocodedAddress {
  city?: string;
  district?: string;
  subregion?: string;
  street?: string;
  name?: string;
  postalCode?: string;
  region?: string;
  country?: string;
}

export const getForegroundPermissionsAsync = async (): Promise<PermissionResponse> => {
  if (Platform.OS === 'ios') {
    const result = await Geolocation.requestAuthorization('whenInUse');
    return { status: result === 'granted' ? 'granted' : 'denied', canAskAgain: true };
  }
  try {
    const fineGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION);
    const coarseGranted = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION);
    if (fineGranted || coarseGranted) {
      return { status: 'granted', canAskAgain: true };
    }
    // Treat "not granted yet" as undetermined to support first-launch flows.
    return { status: 'undetermined', canAskAgain: true };
  } catch {
    return { status: 'denied', canAskAgain: true };
  }
};

export const requestForegroundPermissionsAsync = async (): Promise<PermissionResponse> => {
  if (Platform.OS === 'ios') {
    const result = await Geolocation.requestAuthorization('whenInUse');
    return { status: result === 'granted' ? 'granted' : 'denied', canAskAgain: true };
  }
  try {
    // Request FINE first (Android 12+ may still grant approximate location).
    const fineResult = await PermissionsAndroid.request(
      PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
    );

    if (fineResult === PermissionsAndroid.RESULTS.GRANTED) {
      return { status: 'granted', canAskAgain: true };
    }

    // If fine is denied, check whether coarse was granted implicitly/previously.
    const coarseGranted = await PermissionsAndroid.check(
      PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
    );
    if (coarseGranted) {
      return { status: 'granted', canAskAgain: true };
    }

    return {
      status: 'denied',
      canAskAgain: fineResult !== PermissionsAndroid.RESULTS.NEVER_ASK_AGAIN,
    };
  } catch {
    return { status: 'denied', canAskAgain: true };
  }
};

export const hasServicesEnabledAsync = async (): Promise<boolean> => true;

export const getCurrentPositionAsync = async (_options: {
  accuracy?: string;
  timeout?: number;
  maximumAge?: number;
} = {}) => {
  let enableHighAccuracy = Platform.OS === 'ios' ? true : _options.accuracy === Accuracy.High;

  if (Platform.OS === 'android') {
    try {
      const hasFinePermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_FINE_LOCATION
      );
      const hasCoarsePermission = await PermissionsAndroid.check(
        PermissionsAndroid.PERMISSIONS.ACCESS_COARSE_LOCATION
      );

      if (!hasFinePermission && !hasCoarsePermission) {
        throw new Error('Location permission not granted');
      }

      // Android 12+ can grant only approximate location.
      // Never force GPS/high-accuracy mode when FINE is unavailable.
      if (!hasFinePermission) {
        enableHighAccuracy = false;
      }
    } catch (permissionError) {
      return Promise.reject(permissionError);
    }
  }

  return new Promise<{ coords: { latitude: number; longitude: number } }>((resolve, reject) => {
    try {
      Geolocation.getCurrentPosition(
        (position) => {
          resolve({ coords: { latitude: position.coords.latitude, longitude: position.coords.longitude } });
        },
        (error) => reject(error),
        {
          enableHighAccuracy,
          timeout: _options.timeout ?? 15000,
          maximumAge: _options.maximumAge ?? 10000,
          // Android stability: avoid Google Play Services dependency path that can crash on some devices.
          ...(Platform.OS === 'android'
            ? {
                forceLocationManager: true,
                showLocationDialog: true,
              }
            : {}),
        }
      );
    } catch (error) {
      reject(error);
    }
  });
};

export const reverseGeocodeAsync = async ({
  latitude,
  longitude,
}: {
  latitude: number;
  longitude: number;
}): Promise<LocationGeocodedAddress[]> => {
  ensureGeocoder();
  const response = await Geocoder.from(latitude, longitude);
  const first = response.results?.[0];
  if (!first) return [];
  const parts = first.address_components || [];
  const get = (type: string) => parts.find((c) => c.types.includes(type))?.long_name;
  return [
    {
      city: get('locality'),
      district: get('administrative_area_level_2'),
      subregion: get('sublocality') || get('sublocality_level_1'),
      street: get('route'),
      name: first.formatted_address?.split(',')[0],
      postalCode: get('postal_code'),
      region: get('administrative_area_level_1'),
      country: get('country'),
    },
  ];
};

export const geocodeAsync = async (address: string): Promise<Array<{ latitude: number; longitude: number }>> => {
  ensureGeocoder();
  const response = await Geocoder.from(address);
  return (response.results || []).map((r) => ({
    latitude: r.geometry.location.lat,
    longitude: r.geometry.location.lng,
  }));
};
