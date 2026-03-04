import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Platform,
  Animated,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { addressService, AddAddressRequest } from '@/services/address.service';
import * as Location from 'expo-location';
import { useConfirmation } from '@/context/ConfirmationContext';
import { Snackbar } from '@/components/Snackbar';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

interface AddAddressFormScreenProps {
  visible: boolean;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  geocodingData?: Location.LocationGeocodedAddress | null;
  onBack?: () => void;
  onSave?: (addressData: any) => void;
  onClose?: () => void;
  // Edit mode props
  editMode?: boolean;
  addressId?: string;
  hasUserChangedLocation?: boolean; // Flag to indicate user changed location during editing
  initialData?: {
    houseNo?: string;
    building?: string;
    locality?: string;
    city?: string;
    state?: string;
    pincode?: string;
    alternateMobile?: string;
    isDefault?: boolean;
    tag?: 'home' | 'work' | 'other';
  };
}

export const AddAddressFormScreen: React.FC<AddAddressFormScreenProps> = ({
  visible,
  locationName,
  locationAddress,
  latitude,
  longitude,
  geocodingData,
  onSave,
  onClose,
  editMode = false,
  addressId,
  hasUserChangedLocation = false,
  initialData,
}) => {
  const [houseNo, setHouseNo] = useState('');
  const [building, setBuilding] = useState('');
  const [locality, setLocality] = useState('');
  const [landmark, setLandmark] = useState('');
  const [pincode, setPincode] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [selectedTag, setSelectedTag] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [loading, setLoading] = useState(false);
  const [houseNoError, setHouseNoError] = useState('');
  const [buildingError, setBuildingError] = useState('');
  const [localityError, setLocalityError] = useState('');
  const [pincodeError, setPincodeError] = useState('');
  const [alternateMobileError, setAlternateMobileError] = useState('');
  const [localToastVisible, setLocalToastVisible] = useState(false);
  const [localToastMessage, setLocalToastMessage] = useState('');
  const slideAnim = useRef(new Animated.Value(1000)).current;
  const { showConfirmation } = useConfirmation();
  const { bottom: bottomInset } = useSafeAreaInsets();
  const hasInitializedRef = useRef(false);
  const previousVisibleRef = useRef(visible);
  const scrollViewRef = useRef<ScrollView>(null);

  // Pre-fill form when in edit mode - only run when modal first opens
  useEffect(() => {
    // Check if modal is opening (visible changed from false to true)
    const isOpening = visible && !previousVisibleRef.current;
    previousVisibleRef.current = visible;

    if (isOpening) {
      // Reset initialization flag when modal opens
      hasInitializedRef.current = false;

      // Clear any previous validation errors when the popup is opened
      setHouseNoError('');
      setBuildingError('');
      setLocalityError('');
      setPincodeError('');
      setAlternateMobileError('');
    }

    if (visible && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      // Priority: If user changed location during edit, use geocodingData; otherwise use initialData
      if (editMode && initialData && !hasUserChangedLocation) {
        // Edit mode with original location - use initial data
        setHouseNo(initialData.houseNo || '');
        setBuilding(initialData.building || '');
        setLocality(initialData.locality || '');
        setLandmark('');
        setPincode(initialData.pincode || '');
        setAlternateMobile(initialData.alternateMobile || '');
        if (initialData.tag) {
          const tagCapitalized = initialData.tag.charAt(0).toUpperCase() + initialData.tag.slice(1) as 'Home' | 'Work' | 'Other';
          setSelectedTag(tagCapitalized);
        }
      } else if (editMode && hasUserChangedLocation) {
        // Edit mode but user changed location - use geocodingData for address fields, but keep tag, isDefault, alternateMobile from initialData
        if (geocodingData) {
          // Extract house/flat number from name or street (if it contains numbers at the start)
          // Look for patterns like "123", "123A", "123-456", "Flat 123", etc.
          const nameOrStreet = (geocodingData.name || geocodingData.street || '').trim();
          let houseNoValue = '';

          // Try to extract house number from the beginning of the string
          const houseNoPatterns = [
            /^(\d+[A-Za-z]*(?:\s*[-/]\s*\d+[A-Za-z]*)?)/,  // "123", "123A", "123-456"
            /^(?:Flat|Unit|Apt|Apartment|House|No\.?|#)\s*(\d+[A-Za-z]*(?:\s*[-/]\s*\d+[A-Za-z]*)?)/i,  // "Flat 123", "Unit 5A"
          ];

          for (const pattern of houseNoPatterns) {
            const match = nameOrStreet.match(pattern);
            if (match) {
              houseNoValue = match[1] || match[0];
              break;
            }
          }

          // Building/Street name - use street, or name without house number
          let buildingValue = geocodingData.street || '';
          if (!buildingValue && geocodingData.name) {
            // Remove house number from name if found
            buildingValue = houseNoValue
              ? geocodingData.name.replace(new RegExp(`^${houseNoValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim()
              : geocodingData.name;
          }


          let localityValue = '';

          // Use district if available (most reliable for locality/area)
          if (geocodingData.district) {
            localityValue = geocodingData.district;
          }
          // Use subregion as fallback (also reliable for area information)
          else if (geocodingData.subregion) {
            localityValue = geocodingData.subregion;
          }
          // If neither is available, leave empty rather than guessing from unreliable fields
          // This ensures we only populate with accurate data

          // Pincode - use postalCode field
          const pincodeValue = geocodingData.postalCode || '';

          // Set geocoded address fields
          setHouseNo(houseNoValue);
          setBuilding(buildingValue);
          setLocality(localityValue);
          setLandmark('');
          setPincode(pincodeValue);

          // Keep existing user preferences from initialData when editing
          setAlternateMobile(initialData?.alternateMobile || '');
          if (initialData?.tag) {
            const tagCapitalized = initialData.tag.charAt(0).toUpperCase() + initialData.tag.slice(1) as 'Home' | 'Work' | 'Other';
            setSelectedTag(tagCapitalized);
          } else {
            setSelectedTag('Home');
          }
        } else {
          // No geocoding data but user changed location - reset address fields only
          setHouseNo('');
          setBuilding('');
          setLocality('');
          setLandmark('');
          setPincode('');

          // Keep existing user preferences from initialData when editing
          setAlternateMobile(initialData?.alternateMobile || '');
          if (initialData?.tag) {
            const tagCapitalized = initialData.tag.charAt(0).toUpperCase() + initialData.tag.slice(1) as 'Home' | 'Work' | 'Other';
            setSelectedTag(tagCapitalized);
          } else {
            setSelectedTag('Home');
          }
        }
      } else if (!editMode) {
        // Pre-fill form with geocoding data if available
        if (geocodingData) {
          // Extract house/flat number from name or street (if it contains numbers at the start)
          // Look for patterns like "123", "123A", "123-456", "Flat 123", etc.
          const nameOrStreet = (geocodingData.name || geocodingData.street || '').trim();
          let houseNoValue = '';

          // Try to extract house number from the beginning of the string
          const houseNoPatterns = [
            /^(\d+[A-Za-z]*(?:\s*[-/]\s*\d+[A-Za-z]*)?)/,  // "123", "123A", "123-456"
            /^(?:Flat|Unit|Apt|Apartment|House|No\.?|#)\s*(\d+[A-Za-z]*(?:\s*[-/]\s*\d+[A-Za-z]*)?)/i,  // "Flat 123", "Unit 5A"
          ];

          for (const pattern of houseNoPatterns) {
            const match = nameOrStreet.match(pattern);
            if (match) {
              houseNoValue = match[1] || match[0];
              break;
            }
          }

          // Building/Street name - use street, or name without house number
          let buildingValue = geocodingData.street || '';
          if (!buildingValue && geocodingData.name) {
            // Remove house number from name if found
            buildingValue = houseNoValue
              ? geocodingData.name.replace(new RegExp(`^${houseNoValue.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\s*`, 'i'), '').trim()
              : geocodingData.name;
          }


          let localityValue = '';

          // Use district if available (most reliable for locality/area)
          if (geocodingData.district) {
            localityValue = geocodingData.district;
          }
          // Use subregion as fallback (also reliable for area information)
          else if (geocodingData.subregion) {
            localityValue = geocodingData.subregion;
          }
          // If neither is available, leave empty rather than guessing from unreliable fields
          // This ensures we only populate with accurate data

          // Pincode - use postalCode field
          const pincodeValue = geocodingData.postalCode || '';

          // Set form values
          setHouseNo(houseNoValue);
          setBuilding(buildingValue);
          setLocality(localityValue);
          setLandmark('');
          setPincode(pincodeValue);
          setAlternateMobile('');
          setSelectedTag('Home');
        } else {
          // Reset form if no geocoding data
          setHouseNo('');
          setBuilding('');
          setLocality('');
          setLandmark('');
          setPincode('');
          setAlternateMobile('');
          setSelectedTag('Home');
        }
      }
    }
  }, [visible, editMode, initialData, geocodingData, hasUserChangedLocation]);

  useEffect(() => {
    if (visible) {
      // Reset and start slide-up animation when modal becomes visible
      slideAnim.setValue(1000);
      Animated.timing(slideAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start();
    }
  }, [visible]);


  const handleClose = () => {
    // Animate slide down before closing
    Animated.timing(slideAnim, {
      toValue: 1000,
      duration: 300,
      useNativeDriver: true,
    }).start(() => {
      // Call onClose after animation completes
      if (onClose) {
        onClose();
      }
    });
  };

  // Validate if address contains geocoding/plus codes (e.g., "X44P+884")
  // These are hard for delivery partners to find, so we ask users to enter proper address
  const isValidAddress = (text: string): boolean => {
    if (!text || !text.trim()) return true; // Empty is valid (will be validated separately)

    const trimmedText = text.trim();

    // Pattern to detect plus codes/geocoding formats:
    // - Contains alphanumeric with "+" (e.g., "X44P+884")
    // - Short alphanumeric codes (3-10 chars) with special characters
    // - Patterns like "X44P+884", "ABC+123", etc.
    const plusCodePattern = /^[A-Z0-9]{2,6}\+[A-Z0-9]{2,6}$/i;
    const shortGeocodePattern = /^[A-Z0-9]{3,10}$/i; // Very short codes without context

    // Check if it matches plus code pattern
    if (plusCodePattern.test(trimmedText)) {
      return false;
    }

    // Check if it's a very short code without proper address context
    // Only flag if it's very short (3-6 chars) and looks like a code
    if (trimmedText.length <= 6 && shortGeocodePattern.test(trimmedText) && !/[a-z]{3,}/i.test(trimmedText)) {
      // If it's all uppercase/numeric and very short, likely a code
      if (trimmedText === trimmedText.toUpperCase() && !trimmedText.includes(' ')) {
        return false;
      }
    }

    return true;
  };

  // Build a user-friendly error snippet from the invalid input
  const getAddressCodeExample = (text: string): string => {
    const trimmed = text.trim();
    if (!trimmed) return 'this';

    // Limit length to keep message short
    if (trimmed.length <= 10) return trimmed;

    return `${trimmed.slice(0, 10)}...`;
  };

  const handleContinue = async () => {
    // Clear any previous errors before running validation
    setHouseNoError('');
    setBuildingError('');
    setLocalityError('');
    // Landmark is optional – no separate error state
    setPincodeError('');
    setAlternateMobileError('');

    // Validation - collect all field errors at once
    let hasFieldError = false;

    if (!houseNo.trim()) {
      setHouseNoError('Please enter house/flat number');
      hasFieldError = true;
    }
    if (!building.trim()) {
      setBuildingError('Please enter your building and street name.');
      hasFieldError = true;
    } else if (!isValidAddress(building)) {
      const example = getAddressCodeExample(building);
      setBuildingError(`Please enter your building and street name (not map codes like "${example}").`);
      hasFieldError = true;
    }

    if (!locality.trim()) {
      setLocalityError('Please enter your area or locality.');
      hasFieldError = true;
    } else if (!isValidAddress(locality)) {
      const example = getAddressCodeExample(locality);
      setLocalityError(`Please enter your area or locality (not map codes like "${example}").`);
      hasFieldError = true;
    }
    if (!pincode.trim()) {
      setPincodeError('Please enter pincode');
      hasFieldError = true;
    } else if (!/^\d{6}$/.test(pincode.trim())) {
      // Validate pincode format (must be exactly 6 digits)
      setPincodeError('Pincode must be exactly 6 digits');
      hasFieldError = true;
    }

    // Validate alternate mobile if provided (must be exactly 10 digits)
    if (alternateMobile.trim() && !/^\d{10}$/.test(alternateMobile.trim())) {
      setAlternateMobileError('Alternate mobile number must be exactly 10 digits');
      hasFieldError = true;
    }

    if (hasFieldError) {
      return;
    }

    setLoading(true);

    try {
      // Prepare address data for API
      // Option B: Pack landmark into existing address3 field along with locality
      const address3Value = landmark.trim()
        ? `${locality.trim()}, ${landmark.trim()}`
        : locality.trim();

      const addressData: AddAddressRequest = {
        address1: houseNo,
        address2: building,
        address3: address3Value,
        city: 'Madurai',
        state: 'Tamil Nadu',
        pincode: pincode,
        latitude: latitude,
        longitude: longitude,
        type: selectedTag.toLowerCase() as 'home' | 'work' | 'other',
        alternate_phone_number: alternateMobile ? parseInt(alternateMobile, 10) : undefined,
        is_default: true, // Set as default for both new and updated addresses
      };

      let response;

      if (editMode && addressId) {
        // Call update API
        response = await addressService.updateAddress(addressId, addressData);
      } else {
        // Call add API
        response = await addressService.addAddress(addressData);
      }

      if (response.success) {
        // Close the form modal immediately (without animation) before navigation
        if (onClose) {
          onClose();
        }

        // Small delay to ensure modal state updates before navigation
        setTimeout(() => {
          // Call onSave to handle navigation back to home
          if (onSave) {
            onSave(response.data);
          }
        }, 50);
      } else {
        // Show API error in toast
        let errorMessage = response.message || (editMode ? 'Failed to update address' : 'Failed to add address');
        if (response.error && response.error !== '[undefined]') {
          errorMessage = response.error;
        } else if ((response as any).fullResponse?.message) {
          errorMessage = (response as any).fullResponse.message;
        } else if (response.message && response.message !== '[undefined]') {
          errorMessage = response.message;
        }

        setLocalToastMessage(errorMessage);
        setLocalToastVisible(true);
      }
    } catch (error) {
      // Show unexpected error in popup
      showConfirmation({
        title: '',
        message: 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: '',
        confirmButtonColor: '#00B14F',
        onConfirm: () => { },
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      statusBarTranslucent={true}
      onRequestClose={handleClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={handleClose}
      >
        <Snackbar
          visible={localToastVisible}
          message={localToastMessage}
          type="error"
          onDismiss={() => setLocalToastVisible(false)}
        />

        <View style={styles.bottomSheetWrapper}>
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
            style={{ flex: 1 }}
          >
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  transform: [{ translateY: slideAnim }],
                  flex: 1,
                }
              ]}
            >
              <KeyboardAvoidingView
                behavior={Platform.OS === 'ios' ? 'padding' : undefined}
                style={{ flex: 1 }}
              >
                <ScrollView
                  ref={scrollViewRef}
                  style={{ flex: 1 }}
                  contentContainerStyle={styles.scrollContent}
                  showsVerticalScrollIndicator={false}
                  keyboardShouldPersistTaps="handled"
                >
                  {/* Header - Location Info */}
                  <View style={styles.header}>
                    <View style={styles.locationHeader}>
                      <TouchableOpacity
                        style={styles.backButton}
                        onPress={handleClose}
                        hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                      >
                        <MaterialIcons name="arrow-back" size={24} color="#001E1F" />
                      </TouchableOpacity>
                      <MaterialIcons name="location-on" size={28} color="#00B14F" />
                      <Text style={styles.locationName}>{editMode ? 'Edit Address' : locationName}</Text>
                    </View>
                    {!editMode && <Text style={styles.locationAddress}>{locationAddress}</Text>}
                  </View>

                  {/* Form Fields */}
                  <View style={styles.formSection}>
                    {/* House/Flat/Floor Number - Full width */}
                    <View style={styles.fieldGroup}>
                      <TextInput autoCorrect={false}
                        style={styles.input}
                        value={houseNo}
                        onChangeText={(text) => {
                          setHouseNo(text);
                          if (houseNoError) {
                            setHouseNoError('');
                          }
                        }}
                        placeholder="Flat / Floor number"
                        placeholderTextColor="#999"
                        maxLength={50}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 0, animated: true });
                          }, 100);
                        }}
                      />
                      {houseNoError ? <Text style={styles.errorText}>{houseNoError}</Text> : null}
                    </View>

                    {/* House/Building/Street Name - Full width */}
                    <View style={styles.fieldGroup}>
                      <TextInput autoCorrect={false}
                        style={styles.input}
                        value={building}
                        onChangeText={(text) => {
                          setBuilding(text);
                          if (buildingError) {
                            setBuildingError('');
                          }
                          // Real-time validation for geocoding codes
                          if (text.trim() && !isValidAddress(text)) {
                            const example = getAddressCodeExample(text);
                            setBuildingError(`Please enter your building and street name (not map codes like "${example}").`);
                          }
                        }}
                        placeholder="House / Building / Street Name"
                        placeholderTextColor="#999"
                        maxLength={100}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 50, animated: true });
                          }, 100);
                        }}
                      />
                      {buildingError ? <Text style={styles.errorText}>{buildingError}</Text> : null}
                    </View>

                    {/* Area / locality - Full width */}
                    <View style={styles.fieldGroup}>
                      <TextInput autoCorrect={false}
                        style={styles.input}
                        value={locality}
                        onChangeText={(text) => {
                          setLocality(text);
                          if (localityError) {
                            setLocalityError('');
                          }
                          // Real-time validation for geocoding codes
                          if (text.trim() && !isValidAddress(text)) {
                            const example = getAddressCodeExample(text);
                            setLocalityError(`Please enter your area or locality (not map codes like "${example}").`);
                          }
                        }}
                        placeholder="Area / locality"
                        placeholderTextColor="#999"
                        maxLength={100}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 100, animated: true });
                          }, 100);
                        }}
                      />
                      {localityError ? <Text style={styles.errorText}>{localityError}</Text> : null}
                    </View>

                    {/* Landmark - Optional */}
                    <View style={styles.fieldGroup}>
                      <TextInput autoCorrect={false}
                        style={styles.input}
                        value={landmark}
                        onChangeText={(text) => {
                          setLandmark(text);
                        }}
                        placeholder="Nearby landmark (Optional)"
                        placeholderTextColor="#999"
                        maxLength={100}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 150, animated: true });
                          }, 100);
                        }}
                      />
                    </View>

                    {/* Pincode */}
                    <View style={styles.fieldGroup}>
                      <TextInput autoCorrect={false}
                        style={styles.input}
                        value={pincode}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '');
                          setPincode(numericText);
                          if (pincodeError) {
                            setPincodeError('');
                          }
                        }}
                        placeholder="Pincode"
                        placeholderTextColor="#999"
                        keyboardType="number-pad"
                        maxLength={6}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollTo({ y: 200, animated: true });
                          }, 100);
                        }}
                      />
                      {pincodeError ? <Text style={styles.errorText}>{pincodeError}</Text> : null}
                    </View>

                    {/* Alternate Mobile Number */}
                    <View style={styles.fieldGroup}>
                      <TextInput autoCorrect={false}
                        style={styles.input}
                        value={alternateMobile}
                        onChangeText={(text) => {
                          const numericText = text.replace(/[^0-9]/g, '');
                          setAlternateMobile(numericText);
                          if (alternateMobileError) {
                            setAlternateMobileError('');
                          }
                        }}
                        placeholder="Alternate Mobile number (Optional)"
                        placeholderTextColor="#999"
                        keyboardType="phone-pad"
                        maxLength={10}
                        onFocus={() => {
                          setTimeout(() => {
                            scrollViewRef.current?.scrollToEnd({ animated: true });
                          }, 100);
                        }}
                      />
                      {alternateMobileError ? <Text style={styles.errorText}>{alternateMobileError}</Text> : null}
                    </View>

                    {/* Address Tags */}
                    <View style={styles.tagsContainer}>
                      <TouchableOpacity
                        style={[styles.tag, selectedTag === 'Home' && styles.tagSelected]}
                        onPress={() => setSelectedTag('Home')}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="home" size={16} color={selectedTag === 'Home' ? '#FFFFFF' : '#001E1F'} />
                        <Text style={[styles.tagText, selectedTag === 'Home' && styles.tagTextSelected]}>Home</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.tag, selectedTag === 'Work' && styles.tagSelected]}
                        onPress={() => setSelectedTag('Work')}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="work" size={16} color={selectedTag === 'Work' ? '#FFFFFF' : '#001E1F'} />
                        <Text style={[styles.tagText, selectedTag === 'Work' && styles.tagTextSelected]}>Work</Text>
                      </TouchableOpacity>

                      <TouchableOpacity
                        style={[styles.tag, selectedTag === 'Other' && styles.tagSelected]}
                        onPress={() => setSelectedTag('Other')}
                        activeOpacity={0.7}
                      >
                        <MaterialIcons name="location-on" size={16} color={selectedTag === 'Other' ? '#FFFFFF' : '#001E1F'} />
                        <Text style={[styles.tagText, selectedTag === 'Other' && styles.tagTextSelected]}>Other</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                </ScrollView>

                {/* Continue / Update Button */}
                <SafeAreaView style={styles.footer} edges={["bottom"]}>
                  <TouchableOpacity
                    style={[styles.continueButton, loading && styles.continueButtonDisabled]}
                    onPress={handleContinue}
                    activeOpacity={0.8}
                    disabled={loading}
                  >
                    {loading ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <>
                        <Text style={styles.continueButtonText}>{editMode ? 'Update' : 'Continue'}</Text>
                        <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
                      </>
                    )}
                  </TouchableOpacity>
                </SafeAreaView>
              </KeyboardAvoidingView>
            </Animated.View>
          </TouchableOpacity>
        </View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  bottomSheetWrapper: {
    width: '100%',
    maxHeight: '85%',
    flex: 1,
  },
  bottomSheet: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    elevation: 10,
    paddingTop: 12,
  },
  keyboardAvoidingView: {
    flex: 1,
  },
  scrollView: {
    flexGrow: 1,
    flexShrink: 1,
  },
  scrollContent: {
    paddingBottom: 20,
  },
  scrollContentWithKeyboard: {
    paddingBottom: 0,
  },
  header: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 12,
    gap: 2,
    position: 'relative',
  },
  locationHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    height: 30,
  },
  backButton: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontFamily: 'Poppins',
    fontSize: 20,
    fontWeight: '700',
    color: '#001E1F',
    lineHeight: 30,
    flex: 1,
  },
  locationAddress: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    color: '#001E1F',
    lineHeight: 21,
    opacity: 0.85,
  },
  relocateButton: {
    position: 'absolute',
    top: 8,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 8,
    backgroundColor: 'rgba(0, 177, 79, 0.1)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  formSection: {
    paddingHorizontal: 20,
    paddingTop: 4,
  },
  fieldGroup: {
    marginBottom: 16,
  },
  fieldHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  fieldLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '600',
    color: '#001E1F',
  },
  checkboxContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkboxRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 16,
  },
  checkbox: {
    width: 20,
    height: 20,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
  },
  checkboxLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    fontWeight: '400',
    color: '#666',
  },
  input: {
    height: 48,
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    paddingHorizontal: 16,
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    color: '#001E1F',
  },
  rowFields: {
    flexDirection: 'row',
    gap: 12,
  },
  halfField: {
    flex: 1,
  },
  tagsContainer: {
    flexDirection: 'row',
    gap: 9,
    marginTop: 8,
  },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 12,
    borderRadius: 13,
    backgroundColor: 'rgba(0, 30, 31, 0.05)',
    gap: 4,
    height: 29,
  },
  tagSelected: {
    backgroundColor: '#001E1F',
  },
  tagText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    fontWeight: '400',
    color: '#001E1F',
    lineHeight: 21,
    opacity: 0.85,
  },
  tagTextSelected: {
    color: '#FFFFFF',
    opacity: 0.85,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderTopWidth: 1,
    borderTopColor: '#F0F0F0',
  },
  continueButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 14,
    backgroundColor: '#00B14F',
    borderRadius: 10,
    gap: 10,
  },
  continueButtonDisabled: {
    backgroundColor: '#80D8A7',
    opacity: 0.7,
  },
  continueButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  errorText: {
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 18,
    color: '#D32F2F',
  },
});
