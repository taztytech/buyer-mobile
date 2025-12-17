import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  Dimensions,
  Platform,
  Keyboard,
  Animated,
  ActivityIndicator,
  Alert,
  Linking,
  AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import * as Location from 'expo-location';
import { AddAddressFormScreen } from './AddAddressFormScreen';

// Dynamic import for MapView to prevent crash in Expo Go
let MapView: any = null;
let PROVIDER_GOOGLE: any = null;
let isMapAvailable = false;

try {
  const MapViewModule = require('react-native-maps');
  MapView = MapViewModule.default;
  PROVIDER_GOOGLE = MapViewModule.PROVIDER_GOOGLE;
  isMapAvailable = true;
} catch (error) {
  isMapAvailable = false;
}

interface Region {
  latitude: number;
  longitude: number;
  latitudeDelta: number;
  longitudeDelta: number;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');

interface LocationSelectionScreenProps {
  onBack?: () => void;
  onLocationConfirm?: (location: { name: string; address: string; latitude: number; longitude: number }) => void;
  initialSearchQuery?: string;
  editingAddress?: any;
  initialLatitude?: number;
  initialLongitude?: number;
}

export const LocationSelectionScreen: React.FC<LocationSelectionScreenProps> = ({
  onBack,
  onLocationConfirm,
  editingAddress,
  initialSearchQuery = '',
  initialLatitude,
  initialLongitude,
}) => {
  const isEditing = !!editingAddress;

  const [region, setRegion] = useState<Region>({
    // Use provided initial coordinates when available; otherwise start from a neutral placeholder.
    // The actual region will be updated from current location or user interaction.
    latitude: initialLatitude ? parseFloat(String(initialLatitude)) : 0,
    longitude: initialLongitude ? parseFloat(String(initialLongitude)) : 0,
    latitudeDelta: 0.01,
    longitudeDelta: 0.01,
  });

  const [locationName, setLocationName] = useState(
    isEditing ? (editingAddress?.city || 'Location') : 'Set location'
  );
  const [locationAddress, setLocationAddress] = useState(
    isEditing
      ? [
          editingAddress?.address1,
          editingAddress?.address2,
          editingAddress?.address3,
          editingAddress?.city,
          editingAddress?.state,
          editingAddress?.pincode,
        ]
          .filter(Boolean)
          .join(', ')
      : 'Move the pin or use "Use current location"'
  );
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);
  const [searchText, setSearchText] = useState(initialSearchQuery);
  const [showAddressForm, setShowAddressForm] = useState(false);
  const [geocodingData, setGeocodingData] = useState<Location.LocationGeocodedAddress | null>(null);
  const [isGettingLocation, setIsGettingLocation] = useState(false);
  const [hasSelectedLocation, setHasSelectedLocation] = useState(false);
  const [isCurrentLocationSet, setIsCurrentLocationSet] = useState(false);
  const [isGeocodingInProgress, setIsGeocodingInProgress] = useState(false);
  const bottomPosition = useRef(new Animated.Value(0)).current;
  const mapRef = useRef<any>(null);
  const isUpdatingFromCode = useRef(false);
  const geocodingTimeout = useRef<NodeJS.Timeout | null>(null);
  const isGeocodingRef = useRef(false);
  const isDraggingRef = useRef(false);
  const dragTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const currentMapRegion = useRef<Region>(region);
  const appState = useRef(AppState.currentState);
  const hasTriedAutoLocationOnResume = useRef(false);
  const previousPermissionStatus = useRef<string | null>(null);

  // Reset all cached data when switching contexts (editing vs adding new address)
  useEffect(() => {
    // Clear any pending timeouts
    if (geocodingTimeout.current) {
      clearTimeout(geocodingTimeout.current);
      geocodingTimeout.current = null;
    }
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }

    // Reset geocoding flag
    isGeocodingRef.current = false;
    isDraggingRef.current = false;
    isUpdatingFromCode.current = false;

    // Reset geocoding data when switching contexts
    setGeocodingData(null);
    setShowAddressForm(false);
    setIsCurrentLocationSet(false);
    setIsGeocodingInProgress(false);
    
    // Reset permission tracking and auto-location flag
    hasTriedAutoLocationOnResume.current = false;
    previousPermissionStatus.current = null;
  }, [editingAddress, initialLatitude, initialLongitude, initialSearchQuery]);

  // Update region and location info when editing address changes
  useEffect(() => {
    if (editingAddress && editingAddress.latitude && editingAddress.longitude) {
      const newRegion = {
        latitude: parseFloat(editingAddress.latitude),
        longitude: parseFloat(editingAddress.longitude),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      isUpdatingFromCode.current = true;
      setRegion(newRegion);
      currentMapRegion.current = newRegion;

      // Animate map to the location if map is available
      if (mapRef.current && isMapAvailable) {
        setTimeout(() => {
          mapRef.current?.animateToRegion(newRegion, 500);
          setTimeout(() => {
            isUpdatingFromCode.current = false;
          }, 600);
        }, 100);
      } else {
        setTimeout(() => {
          isUpdatingFromCode.current = false;
        }, 100);
      }

      // Set location name and address from editing address
      setLocationName(editingAddress.city || 'Location');
      const fullAddress = [
        editingAddress.address1,
        editingAddress.address2,
        editingAddress.address3,
        editingAddress.city,
        editingAddress.state,
        editingAddress.pincode
      ].filter(Boolean).join(', ');
      setLocationAddress(fullAddress);
      // Clear geocoding data when editing (use address data instead)
      setGeocodingData(null);
      // Existing address already has coordinates – treat as a confirmed location
      setHasSelectedLocation(true);
    }
    // Note: Non-editing cases (adding new address) are handled by the next useEffect
  }, [editingAddress, initialLatitude, initialLongitude]);

  // Automatically get current location if initialLatitude and initialLongitude are provided (from "Add address" button)
  // For new address creation (including redirect from home with no addresses), if there are no initial
  // coordinates, we also try to use the user's current location instead of any hardcoded default.
  useEffect(() => {
    // Skip if editing an address (handled by previous useEffect)
    if (editingAddress) {
      return;
    }

    // If initial coordinates are provided, automatically get and set the location
    if (initialLatitude && initialLongitude) {
      // Set the region to the provided coordinates
      const newRegion = {
        latitude: parseFloat(String(initialLatitude)),
        longitude: parseFloat(String(initialLongitude)),
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      isUpdatingFromCode.current = true;
      setRegion(newRegion);
      currentMapRegion.current = newRegion;

      // Animate map to the location if map is available
      if (mapRef.current && isMapAvailable) {
        setTimeout(() => {
          mapRef.current?.animateToRegion(newRegion, 500);
          setTimeout(() => {
            isUpdatingFromCode.current = false;
          }, 600);
        }, 100);
      } else {
        setTimeout(() => {
          isUpdatingFromCode.current = false;
        }, 100);
      }

      // Get address from coordinates
      (async () => {
        try {
          const { status } = await Location.getForegroundPermissionsAsync();
          if (status === 'granted') {
            const addresses = await Location.reverseGeocodeAsync({
              latitude: newRegion.latitude,
              longitude: newRegion.longitude,
            });

            if (addresses.length > 0) {
              const addr = addresses[0];
              setLocationName(addr.name || addr.street || 'Current Location');
              setLocationAddress(
                `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`
              );
              // Store geocoding data for pre-filling address form
              setGeocodingData(addr);
              // Initial coordinates provided (from "Add address"), treat as current location
              setIsCurrentLocationSet(true);
              setHasSelectedLocation(true);
            }
          }
        } catch (error) {
          // Keep default location name and address
        }
      })();
    } else if (!initialLatitude && !initialLongitude) {
      // No initial coordinates and not editing: try to use current location as the default.
      // This is used both when user taps "Add address" and when home redirects due to no addresses.
      getCurrentLocation();
    }
  }, [editingAddress, initialLatitude, initialLongitude]);

  // Initialize permission status on mount
  useEffect(() => {
    const checkInitialPermission = async () => {
      try {
        const { status } = await Location.getForegroundPermissionsAsync();
        previousPermissionStatus.current = status;
      } catch (error) {
        // Silently fail - permission tracking is optional
      }
    };
    
    checkInitialPermission();
  }, []);

  // When user returns from system settings (after turning on location/services),
  // automatically try to fetch current location once, for new address flows.
  useEffect(() => {
    const subscription = AppState.addEventListener('change', async (nextState) => {
      const prevState = appState.current;
      appState.current = nextState;

      // When app becomes active (user returns from background/settings)
      if (nextState === 'active' && prevState !== 'active') {
        // Check current permission status
        const { status } = await Location.getForegroundPermissionsAsync();
        
        // If permission was just granted (changed from denied to granted)
        const wasPermissionJustGranted = 
          previousPermissionStatus.current !== 'granted' && 
          status === 'granted';

        // Update previous permission status
        previousPermissionStatus.current = status;

        // Auto-fetch location if:
        // 1. Permission was just granted, OR
        // 2. First time trying (for new address flows without initial coords)
        if (
          !editingAddress &&
          !initialLatitude &&
          !initialLongitude &&
          !isCurrentLocationSet &&
          !hasSelectedLocation
        ) {
          if (wasPermissionJustGranted || !hasTriedAutoLocationOnResume.current) {
            hasTriedAutoLocationOnResume.current = true;
            getCurrentLocation();
          }
        }
      }
    });

    return () => {
      subscription.remove();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editingAddress, initialLatitude, initialLongitude, isCurrentLocationSet, hasSelectedLocation]);

  // Clear search text when component mounts (ensures fresh state)
  useEffect(() => {
    setSearchText('');
  }, []);

  // Update searchText and trigger search when initialSearchQuery changes
  useEffect(() => {
    // Reset search text when initialSearchQuery changes
    if (initialSearchQuery.trim()) {
      setSearchText(initialSearchQuery);
      // Trigger search directly with the query
      performSearch(initialSearchQuery);
    } else {
      // Clear search text when initialSearchQuery is empty
      setSearchText('');
    }
  }, [initialSearchQuery]);

  // Keyboard listeners
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (e) => {
        setIsKeyboardVisible(true);
        const height = e.endCoordinates.height;
        // Position search bar above keyboard with proper spacing
        Animated.timing(bottomPosition, {
          toValue: height + 8,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
        setIsKeyboardVisible(false);
        Animated.timing(bottomPosition, {
          toValue: 0,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
      // Clear any pending timeouts on unmount
      if (geocodingTimeout.current) {
        clearTimeout(geocodingTimeout.current);
      }
      if (dragTimeoutRef.current) {
        clearTimeout(dragTimeoutRef.current);
      }
    };
  }, []);

  // Helper function to open location settings
  const openLocationSettings = () => {
    try {
      if (Platform.OS === 'android') {
        // Try to open Android location settings directly
        // This may not work on all devices, so we have a fallback
        Linking.openURL('android.settings.LOCATION_SOURCE_SETTINGS').catch(() => {
          // Fallback to app settings if location settings can't be opened
          Linking.openSettings();
        });
      } else {
        // iOS - open app settings (location settings are within app settings)
        Linking.openSettings();
      }
    } catch (error) {
      // Fallback to app settings
      try {
        Linking.openSettings();
      } catch {
        // Ignore errors
      }
    }
  };

  // Helper to show clear, OS-specific steps to enable location
  const getLocationSettingsGuide = () => {
    if (Platform.OS === 'android') {
      return (
        'How to turn on location for Tazty on Android:\n' +
        '1. Tap "Open Settings" below (or open the Settings app).\n' +
        '2. Go to "Apps" → "Tazty".\n' +
        '3. Tap "Permissions" → "Location".\n' +
        '4. Select "Allow only while using the app".\n' +
        '5. Then go back and make sure "Location" is turned ON in the main Settings screen.'
      );
    }

    return (
      'How to turn on location for Tazty on iPhone:\n' +
      '1. Tap "Open Settings" below (or open the Settings app).\n' +
      '2. Scroll down and tap "Tazty".\n' +
      '3. Tap "Location".\n' +
      '4. Choose "While Using the App".\n' +
      '5. Also ensure Location Services are ON in "Settings" → "Privacy & Security" → "Location Services".'
    );
  };

  const getCurrentLocation = async (): Promise<boolean> => {
    // Prevent multiple simultaneous requests
    if (isGettingLocation) {
      return false;
    }

    setIsGettingLocation(true);
    let success = false;

    try {
      // First check existing permission
      let permission = await Location.getForegroundPermissionsAsync();

      // If not granted, request it (this will trigger the system popup,
      // similar to the "Add address" button flow)
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      if (permission.status !== 'granted') {
        // Still not granted – guide the user instead of silently falling back
        if (!permission.canAskAgain) {
          // Permission is blocked ("Don't ask again") – send user to settings
          Alert.alert(
            'Enable Location',
            'To use your current location, please enable location access for Tazty in your device settings.\n\n' +
              getLocationSettingsGuide(),
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  try {
                    Linking.openSettings();
                  } catch {
                    // Ignore Linking errors
                  }
                },
              },
            ]
          );
        } else {
          // Permission was denied but can be asked again – show a clear, actionable message
          Alert.alert(
            'Turn on location access',
            'To fetch your current location, please turn on device location and allow Tazty to access your location (choose "While using this app" or "Allow all the time").\n\n' +
              getLocationSettingsGuide()
          );
        }

        return false;
      }

      // Permission granted – fetch current location
      const location = await Location.getCurrentPositionAsync({
        accuracy:
          Platform.OS === 'ios'
            ? Location.Accuracy.Balanced
            : Location.Accuracy.High,
      });

      const newRegion = {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        latitudeDelta: 0.01,
        longitudeDelta: 0.01,
      };

      isUpdatingFromCode.current = true;
      setRegion(newRegion);
      currentMapRegion.current = newRegion;

      // Animate map to new location if map is available
      if (mapRef.current && isMapAvailable) {
        mapRef.current.animateToRegion(newRegion, 1000);
      }

      setTimeout(() => {
        isUpdatingFromCode.current = false;
      }, 1500);

      // Get address from coordinates
      try {
        const addresses = await Location.reverseGeocodeAsync({
          latitude: location.coords.latitude,
          longitude: location.coords.longitude,
        });

        if (addresses.length > 0) {
          const addr = addresses[0];
          setLocationName(addr.name || addr.street || 'Current Location');
          setLocationAddress(
            `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${
              addr.country || ''
            }`,
          );
          // Store geocoding data for pre-filling address form
          setGeocodingData(addr);
          setIsCurrentLocationSet(true);
          setHasSelectedLocation(true);
          success = true; // Successfully got geocoding data
        } else {
          setLocationName('Current Location');
          setLocationAddress('Current Location');
          success = false; // No geocoding data available
        }
      } catch (reverseGeoError) {
        setLocationName('Current Location');
        setLocationAddress('Current Location');
        success = false; // Reverse geocoding failed
      }
    } catch (error) {
      // Keep existing map state; show a helpful, actionable message
      Alert.alert(
        'Turn on location access',
        'We could not fetch your current location. Please turn on device location and allow Tazty to access your location (choose "While using this app" or "Allow all the time"), then try again.\n\n' +
          getLocationSettingsGuide()
      );
      success = false;
    } finally {
      setIsGettingLocation(false);
    }

    return success;
  };

  const handleRegionChange = (newRegion: Region) => {
    // Skip if we're updating from code (search, getCurrentLocation, editing)
    // This prevents overwriting the programmatically set coordinates
    if (isUpdatingFromCode.current) {
      return;
    }

    // Track the current map position in the ref (without triggering re-render)
    currentMapRegion.current = newRegion;

    // User is actively dragging the map
    isDraggingRef.current = true;

    // Clear the drag timeout if it exists
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
    }

    // Clear any pending geocoding timeout while dragging
    if (geocodingTimeout.current) {
      clearTimeout(geocodingTimeout.current);
      // Reset geocoding state if user starts dragging again
      if (isGeocodingRef.current) {
        isGeocodingRef.current = false;
        setIsGeocodingInProgress(false);
      }
    }

    // Set a timeout to mark dragging as complete
    dragTimeoutRef.current = setTimeout(() => {
      isDraggingRef.current = false;
    }, 150);
  };

  const handleRegionChangeComplete = async (newRegion: Region) => {
    // Skip if we're updating from code (editing address)
    if (isUpdatingFromCode.current) {
      return;
    }


    // DON'T update region state for user-initiated changes
    // Only programmatic updates (getCurrentLocation, search, editing) should update region
    // This prevents the map from jumping during user interaction

    // Clear any existing timeout
    if (geocodingTimeout.current) {
      clearTimeout(geocodingTimeout.current);
    }

    // Schedule geocoding - wait for both drag completion AND debounce
    geocodingTimeout.current = setTimeout(async () => {
      // Skip if already geocoding
      if (isGeocodingRef.current) {
        return;
      }

      // Skip if still dragging (user might have started dragging again)
      if (isDraggingRef.current) {
        return;
      }

      try {
        // Mark geocoding as in progress
        isGeocodingRef.current = true;
        setIsGeocodingInProgress(true);
        
        // User has stopped dragging and we have a pinned map position – treat this
        // as a confirmed location regardless of whether reverse geocoding succeeds.
        setHasSelectedLocation(true);

        // Step 1: Check and request permission first
        let permission = await Location.getForegroundPermissionsAsync();

        // If permission is not granted, request it (this will show the system popup)
        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        // Step 2: Handle permission response
        if (permission.status !== 'granted') {
          // Permission denied - show instructions but don't block the UI
          if (!permission.canAskAgain) {
            // Permission is blocked ("Don't ask again") – send user to settings
            Alert.alert(
              'Enable Location Access',
              'To get address details for this location, please enable location access for Tazty in your device settings. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
                getLocationSettingsGuide(),
              [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    try {
                      Linking.openSettings();
                    } catch {
                      // Ignore Linking errors
                    }
                  },
                },
              ]
            );
          } else {
            // Permission was denied but can be asked again
            Alert.alert(
              'Location Permission Required',
              'Please allow Tazty to access your location to get address details. Turn on device location and choose "While using this app" or "Allow all the time" when prompted. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
                getLocationSettingsGuide()
            );
          }
          // Keep current location name and address, but don't update geocoding data
          return;
        }

        // Step 3: Permission is granted - check if location services are enabled
        const isLocationEnabled = await Location.hasServicesEnabledAsync();
        
        if (!isLocationEnabled) {
          // Permission granted but location services are disabled - try to get location (triggers system prompt)
          try {
            // Try to get location - this may trigger system to prompt to turn on location
            await Location.getCurrentPositionAsync({
              accuracy: Platform.OS === 'ios'
                ? Location.Accuracy.Balanced
                : Location.Accuracy.High,
            });
            // If successful, location services were turned on - proceed with geocoding
          } catch (locationError) {
            // Location services still disabled - show alert to turn on location
            Alert.alert(
              'Turn on Location',
              'Location permission is granted, but location services are turned off. Please turn on location services in your device settings to get address details. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
                getLocationSettingsGuide(),
              [
                { text: 'OK', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    openLocationSettings();
                  },
                },
              ]
            );
            // Keep current location name and address, but don't update geocoding data
            return;
          }
        }

        // Step 4: Both permission and location services are available - proceed with reverse geocoding
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: newRegion.latitude,
            longitude: newRegion.longitude,
          });

          if (addresses.length > 0) {
            const addr = addresses[0];
            setLocationName(addr.name || addr.street || 'Location');
            setLocationAddress(
              `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`
            );
            // Store geocoding data for pre-filling address form
            setGeocodingData(addr);
            // User manually moved the pin, so reset current location flag
            setIsCurrentLocationSet(false);
          }
        } catch (reverseGeoError) {
          // Keep the current location name and address if reverse geocoding fails
        }
      } catch (error) {
        // Error checking permission or location services - silently fail
        // User can still interact with the map
      } finally {
        // Mark geocoding as complete
        isGeocodingRef.current = false;
        setIsGeocodingInProgress(false);
      }
    }, 650); // Wait 650ms (150ms drag detection + 500ms debounce)
  };

  const handleConfirm = async () => {
    // Validate that we have actual coordinates (not hardcoded or default values)
    const currentLat = currentMapRegion.current.latitude;
    const currentLng = currentMapRegion.current.longitude;
    const hasValidCoordinates = 
      currentLat !== 0 && 
      currentLng !== 0 && 
      !isNaN(currentLat) && 
      !isNaN(currentLng);

    // If editing an address, ensure we have a confirmed map location first
    if (editingAddress) {
      const hasExistingCoords =
        !!editingAddress.latitude && !!editingAddress.longitude;

      try {
        // Step 1: Check and request permission first
        let permission = await Location.getForegroundPermissionsAsync();

        if (permission.status !== 'granted') {
          permission = await Location.requestForegroundPermissionsAsync();
        }

        // If permission is still not granted, guide the user (same UX as add flow)
        if (permission.status !== 'granted') {
          if (!permission.canAskAgain) {
            Alert.alert(
              'Enable Location Access',
              'To update this address accurately, please enable location access for Tazty in your device settings.\n\n' +
                getLocationSettingsGuide(),
              [
                { text: 'Not now', style: 'cancel' },
                {
                  text: 'Open Settings',
                  onPress: () => {
                    try {
                      Linking.openSettings();
                    } catch {
                      // Ignore Linking errors
                    }
                  },
                },
              ]
            );
          } else {
            Alert.alert(
              'Location Permission Required',
              'Please allow Tazty to access your location to update this address accurately. Turn on device location and choose "While using this app" or "Allow all the time" when prompted.\n\n' +
                getLocationSettingsGuide()
            );
          }
          return;
        }

        // Step 2: Ensure location services are enabled
        const isLocationEnabled = await Location.hasServicesEnabledAsync();

        if (!isLocationEnabled) {
          Alert.alert(
            'Turn on Location',
            'Location permission is granted, but location services are turned off. Please turn on location services in your device settings to update this address accurately.\n\n' +
              getLocationSettingsGuide(),
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  openLocationSettings();
                },
              },
            ]
          );
          return;
        }

        // Step 3: With permission + services ON, ensure user has selected a map location
        if (!hasExistingCoords && !hasSelectedLocation) {
          Alert.alert(
            'Set location on map',
            'Please move the pin on the map or use "Use current location" to set your exact location before editing this address.'
          );
          return;
        }

        // Step 4: Validate coordinates before opening form
        if (!hasValidCoordinates && !hasExistingCoords) {
          Alert.alert(
            'Invalid location',
            'Please select a valid location on the map or use "Use current location" before proceeding.'
          );
          return;
        }

        setShowAddressForm(true);
        return;
      } catch (error) {
        // Fallback: if something goes wrong, still prevent editing without a confirmed location
        if (!hasExistingCoords && !hasSelectedLocation) {
          Alert.alert(
            'Set location on map',
            'Please move the pin on the map or use "Use current location" to set your exact location before editing this address.'
          );
          return;
        }

        // Also check for valid coordinates
        if (!hasValidCoordinates && !hasExistingCoords) {
          Alert.alert(
            'Invalid location',
            'Please select a valid location on the map or use "Use current location" before proceeding.'
          );
          return;
        }

        setShowAddressForm(true);
        return;
      }
    }

    // For new addresses, check permission first, then location services
    try {
      // Step 1: Check and request permission first
      let permission = await Location.getForegroundPermissionsAsync();

      // If permission is not granted, request it (this will show the system popup)
      if (permission.status !== 'granted') {
        permission = await Location.requestForegroundPermissionsAsync();
      }

      // Step 2: Handle permission response
      if (permission.status !== 'granted') {
        // Permission denied - show instructions
        if (!permission.canAskAgain) {
          // Permission is blocked ("Don't ask again") – send user to settings
          Alert.alert(
            'Enable Location Access',
            'To use your current location, please enable location access for Tazty in your device settings. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
              getLocationSettingsGuide(),
            [
              { text: 'Not now', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  try {
                    Linking.openSettings();
                  } catch {
                    // Ignore Linking errors
                  }
                },
              },
            ]
          );
        } else {
          // Permission was denied but can be asked again
          Alert.alert(
            'Location Permission Required',
            'Please allow Tazty to access your location. Turn on device location and choose "While using this app" or "Allow all the time" when prompted. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
              getLocationSettingsGuide()
          );
        }
        return;
      }

      // Step 3: Permission is granted - check if location services are enabled
      const isLocationEnabled = await Location.hasServicesEnabledAsync();
      
      if (!isLocationEnabled) {
        // Permission granted but location services are disabled - try to get location (triggers system prompt) or open settings
        try {
          // Try to get location - this may trigger system to prompt to turn on location
          await Location.getCurrentPositionAsync({
            accuracy: Platform.OS === 'ios'
              ? Location.Accuracy.Balanced
              : Location.Accuracy.High,
          });
          // If successful, location services were turned on - proceed
        } catch (locationError) {
          // Location services still disabled - show alert to turn on location
          Alert.alert(
            'Turn on Location',
            'Location permission is granted, but location services are turned off. Please turn on location services in your device settings. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
              getLocationSettingsGuide(),
            [
              { text: 'Cancel', style: 'cancel' },
              {
                text: 'Open Settings',
                onPress: () => {
                  openLocationSettings();
                },
              },
            ]
          );
          return;
        }
      }

      // Step 4: Both permission and location services are available - validate coordinates
      if (!hasValidCoordinates) {
        Alert.alert(
          'Invalid location',
          'Please select a valid location on the map or use "Use current location" before confirming.',
          [{ text: 'OK' }]
        );
        return;
      }

      // Step 5: Check if we have geocoding data
      if (geocodingData) {
        // Both permission and geocoding data available - proceed to form
        setShowAddressForm(true);
        return;
      }

      // Permission granted and services enabled, but no geocoding data yet.
      // Ask user to explicitly set their exact location via map or current location.
      Alert.alert(
        'Set location on map',
        'Please move the pin on the map or use "Use current location" to set your exact location before confirming.',
        [{ text: 'OK' }]
      );
    } catch (error) {
      // Error checking permission or location services - show generic alert
      Alert.alert(
        'Location Error',
        'Unable to access location. Please ensure location services are enabled and try again. Alternatively, you can use the "Use Current Location" button if needed.\n\n' +
          getLocationSettingsGuide()
      );
    }
  };

  const handleBackPress = () => {
    // Dismiss keyboard before navigating back
    Keyboard.dismiss();
    
    // Clear any pending timeouts
    if (geocodingTimeout.current) {
      clearTimeout(geocodingTimeout.current);
      geocodingTimeout.current = null;
    }
    if (dragTimeoutRef.current) {
      clearTimeout(dragTimeoutRef.current);
      dragTimeoutRef.current = null;
    }
    
    // Reset flags
    isGeocodingRef.current = false;
    isDraggingRef.current = false;
    isUpdatingFromCode.current = false;
    
    // Clear cached data and search text
    setGeocodingData(null);
    setShowAddressForm(false);
    setSearchText('');
    setIsGeocodingInProgress(false);
    
    if (onBack) {
      onBack();
    }
  };

  // Callback when map is ready - ensure it's at the correct position
  const handleMapReady = () => {
    if (mapRef.current && isMapAvailable) {
      // If no editing and no initial coords, show Madurai for visual display only
      // DO NOT update currentMapRegion.current to avoid sending hardcoded coords to API
      if (!editingAddress && !initialLatitude && !initialLongitude) {
        const maduraiRegion = {
          latitude: 9.9252,
          longitude: 78.1198,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };
        // Only animate map to Madurai for visual display
        // Do NOT update currentMapRegion.current
        setTimeout(() => {
          mapRef.current?.animateToRegion(maduraiRegion, 300);
        }, 100);
      } else {
        // Otherwise use the current region
        setTimeout(() => {
          mapRef.current?.animateToRegion(currentMapRegion.current, 300);
        }, 100);
      }
    }
  };

  const handleAddressSave = (addressData: any) => {
    // Final validation: Ensure coordinates are valid before sending to API
    const lat = currentMapRegion.current.latitude;
    const lng = currentMapRegion.current.longitude;
    
    if (lat === 0 || lng === 0 || isNaN(lat) || isNaN(lng)) {
      Alert.alert(
        'Invalid location',
        'Cannot save address with invalid coordinates. Please select a valid location and try again.'
      );
      setShowAddressForm(false);
      return;
    }
    
    // Close the address form first
    setShowAddressForm(false);
    
    // Clear cached data after saving
    setGeocodingData(null);
    setSearchText('');
    
    // onLocationConfirm handles navigation back to the appropriate screen
    // Don't call onBack() here as it conflicts with the navigation animation
    if (onLocationConfirm) {
      onLocationConfirm({
        name: locationName,
        address: locationAddress,
        latitude: lat,
        longitude: lng,
        ...addressData,
      });
    }
  };

  const performSearch = async (query: string) => {
    if (!query.trim()) return;


    try {
      // Only check if permission is already granted, don't request it
      const { status } = await Location.getForegroundPermissionsAsync();

      if (status !== 'granted') {
        return;
      }

      // Use geocoding to search for the location
      const results = await Location.geocodeAsync(query);

      if (results.length > 0) {
        const result = results[0];

        const newRegion = {
          latitude: result.latitude,
          longitude: result.longitude,
          latitudeDelta: 0.01,
          longitudeDelta: 0.01,
        };

        isUpdatingFromCode.current = true;
        setRegion(newRegion);
        currentMapRegion.current = newRegion;

        // Animate map to new location if map is available
        if (mapRef.current && isMapAvailable) {
          mapRef.current.animateToRegion(newRegion, 1000);
        }

        setTimeout(() => {
          isUpdatingFromCode.current = false;
        }, 1500); // Increased from 1100ms to ensure animation completes

        // Get address details
        try {
          const addresses = await Location.reverseGeocodeAsync({
            latitude: result.latitude,
            longitude: result.longitude,
          });

          if (addresses.length > 0) {
            const addr = addresses[0];
            setLocationName(addr.name || addr.street || query);
            setLocationAddress(
              `${addr.street || ''}, ${addr.city || ''}, ${addr.region || ''}, ${addr.country || ''}`
            );
            // Store geocoding data for pre-filling address form
            setGeocodingData(addr);
            // User searched for location, so reset current location flag
            setIsCurrentLocationSet(false);
          }
        } catch (reverseGeoError) {
          setLocationName(query);
          setLocationAddress(query);
          setGeocodingData(null);
          setIsCurrentLocationSet(false);
        }

        // Dismiss keyboard
        Keyboard.dismiss();
      }
    } catch (error) {
      Keyboard.dismiss();
    }
  };

  const handleSearch = async () => {
    performSearch(searchText);
  };

  return (
    <View style={styles.safeArea}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Header with Back Button and Search Bar */}
      <SafeAreaView style={styles.headerSafeArea} edges={['top']}>
        <View style={styles.headerContainer}>
          <TouchableOpacity style={styles.backButton} onPress={handleBackPress}>
            <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
          </TouchableOpacity>
          
          {/* Search Bar */}
          <View style={styles.searchContainer}>
            <MaterialIcons name="search" size={24} color="#001E1F" />
            <TextInput
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              placeholder="Search By Street, building,"
              placeholderTextColor="#8E8E8E"
              autoCapitalize="none"
              autoCorrect={false}
              autoFocus={false}
              returnKeyType="search"
              underlineColorAndroid="transparent"
              onSubmitEditing={handleSearch}
            />
          </View>
        </View>
      </SafeAreaView>

      <View style={styles.container}>
        {/* Google Maps or Placeholder */}
        {isMapAvailable && MapView ? (
          <MapView
            ref={mapRef}
            provider={PROVIDER_GOOGLE}
            style={styles.map}
            initialRegion={region}
            region={region}
            onRegionChange={handleRegionChange}
            onRegionChangeComplete={handleRegionChangeComplete}
            onMapReady={handleMapReady}
            showsUserLocation={false}
            showsMyLocationButton={false}
          />
        ) : (
          <View style={styles.mapPlaceholder}>
            <MaterialIcons name="map" size={80} color="#999" />
            <Text style={styles.mapPlaceholderText}>
              Map Preview{'\n'}
              (Requires development build)
            </Text>
            <Text style={styles.coordinatesText}>
              📍 {region.latitude.toFixed(4)}, {region.longitude.toFixed(4)}
            </Text>
            <Text style={styles.mapHintText}>
              Location features still work!{'\n'}
              Run: npx expo run:android
            </Text>
          </View>
        )}

        {/* Center Pin Marker */}
        <View style={styles.centerMarker}>
          <MaterialIcons name="location-on" size={40} color="#00B14F" />
          <View style={styles.pinShadow} />
        </View>

        {/* Tooltip */}
        <View style={styles.tooltip}>
          <Text style={styles.tooltipText}>
            {isCurrentLocationSet 
              ? 'Current location set. Move the pin to adjust' 
              : 'Move the pin to change location'}
          </Text>
        </View>

        {/* Bottom Section */}
        <Animated.View style={[
          styles.bottomSection,
          {
            bottom: bottomPosition,
            paddingBottom: isKeyboardVisible ? 12 : 40,
          }
        ]}>
          {/* Location Info Card - Hidden when keyboard is visible */}
          {!isKeyboardVisible && (
            <>
              {/* Current Location Button */}
              <TouchableOpacity 
                style={[
                  styles.currentLocationButton,
                  isGettingLocation && styles.currentLocationButtonDisabled
                ]} 
                onPress={getCurrentLocation}
                disabled={isGettingLocation}
                activeOpacity={0.7}
              >
                {isGettingLocation ? (
                  <>
                    <ActivityIndicator size="small" color="#00B14F" />
                    <Text style={styles.currentLocationButtonText}>Getting location...</Text>
                  </>
                ) : (
                  <>
                    <MaterialIcons name="my-location" size={16} color="#00B14F" />
                    <Text style={styles.currentLocationButtonText}>Use current location</Text>
                  </>
                )}
              </TouchableOpacity>

              <View style={styles.locationCard}>
                <View style={styles.locationInfo}>
                  <View style={styles.locationHeader}>
                    <MaterialIcons name="location-on" size={24} color="#00B14F" />
                    <Text style={styles.locationName} numberOfLines={2} ellipsizeMode="tail">{locationName}</Text>
                  </View>
                  <Text style={styles.locationAddress}>{locationAddress}</Text>
                </View>
              </View>

              {/* Confirm Button */}
              <TouchableOpacity 
                style={[
                  styles.confirmButton,
                  (isGeocodingInProgress || isGettingLocation) && styles.confirmButtonDisabled
                ]} 
                onPress={handleConfirm}
                disabled={isGeocodingInProgress || isGettingLocation}
                activeOpacity={0.7}
              >
                {isGeocodingInProgress ? (
                  <>
                    <ActivityIndicator size="small" color="#FFFFFF" />
                    <Text style={styles.confirmButtonText}>Fetching location...</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.confirmButtonText}>Confirm</Text>
                    <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
                  </>
                )}
              </TouchableOpacity>
            </>
          )}
        </Animated.View>

        {/* Address Form Modal */}
        <AddAddressFormScreen
          visible={showAddressForm}
          editMode={!!editingAddress}
          addressId={editingAddress?.id?.toString()}
          locationName={locationName}
          locationAddress={locationAddress}
          latitude={currentMapRegion.current.latitude}
          longitude={currentMapRegion.current.longitude}
          geocodingData={geocodingData}
          initialData={editingAddress ? {
            houseNo: editingAddress.address1 || '',
            building: editingAddress.address2 || '',
            locality: editingAddress.address3 || '',
            city: editingAddress.city || '',
            state: editingAddress.state || '',
            pincode: editingAddress.pincode?.toString() || '',
            alternateMobile: editingAddress.alternate_phone_number?.toString() || '',
            isDefault: editingAddress.is_default || false,
            tag: editingAddress.type || 'home',
          } : undefined}
          onBack={() => setShowAddressForm(false)}
          onSave={handleAddressSave}
          onClose={() => setShowAddressForm(false)}
        />
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#FFFFFF',
  },
  container: {
    flex: 1,
    backgroundColor: '#E9E9E9',
  },
  map: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  },
  mapPlaceholder: {
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    backgroundColor: '#E9E9E9',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 40,
  },
  mapPlaceholderText: {
    fontFamily: 'Poppins',
    fontSize: 18,
    fontWeight: '600',
    textAlign: 'center',
    color: '#666',
    lineHeight: 27,
  },
  coordinatesText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '500',
    color: '#00B14F',
  },
  mapHintText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    textAlign: 'center',
    color: '#999',
    lineHeight: 18,
  },
  centerMarker: {
    position: 'absolute',
    left: '50%',
    top: '50%',
    marginLeft: -20,
    marginTop: -40,
    alignItems: 'center',
  },
  pinShadow: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
    marginTop: -5,
  },
  tooltip: {
    position: 'absolute',
    left: (SCREEN_WIDTH - 240) / 2,
    top: (SCREEN_HEIGHT / 2) - 80,
    backgroundColor: '#001E1F',
    borderRadius: 13,
    paddingVertical: 4,
    paddingHorizontal: 15,
    maxWidth: 240,
  },
  tooltipText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 10,
    lineHeight: 15,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  headerSafeArea: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    zIndex: 10,
    paddingTop: 16,
  },
  headerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
  },
  backButton: {
    width: 40,
    height: 40,
    backgroundColor: '#FFFFFF',
    borderRadius: 50,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  bottomSection: {
    position: 'absolute',
    bottom: 0,
    left: 20,
    right: 20,
    gap: 16,
    paddingBottom: 40,
  },
  searchContainer: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    padding: 19,
    paddingHorizontal: 20,
    gap: 10,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 30,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontStyle: 'normal',
    fontWeight: '400',
    fontSize: 14,
    color: '#001E1F',
    paddingVertical: 0,
    paddingHorizontal: 0,
    margin: 0,
    textAlignVertical: 'center',
    includeFontPadding: false,
  },
  locationCard: {
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 4,
  },
  locationInfo: {
    flex: 1,
    gap: 2,
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  locationName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#001E1F',
    flex: 1,
    flexShrink: 1,
  },
  locationAddress: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#001E1F',
    opacity: 0.75,
    marginTop: 2,
  },
  currentLocationButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 8,
    paddingHorizontal: 12,
    gap: 6,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    alignSelf: 'flex-end',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.08)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.08,
    shadowRadius: 3,
    elevation: 2,
  },
  currentLocationButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12,
    color: '#001E1F',
    lineHeight: 16,
  },
  currentLocationButtonDisabled: {
    opacity: 0.6,
  },
  confirmButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 16,
    paddingHorizontal: 20,
    gap: 8,
    backgroundColor: '#00B14F',
    borderRadius: 12,
    shadowColor: '#00B14F',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
    elevation: 4,
  },
  confirmButtonDisabled: {
    backgroundColor: '#B3B3B3',
    shadowColor: '#B3B3B3',
    opacity: 0.7,
  },
  confirmButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});

