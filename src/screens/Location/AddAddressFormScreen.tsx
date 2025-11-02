import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  StyleSheet,
  StatusBar,
  ScrollView,
  Platform,
  Keyboard,
  Animated,
  Alert,
  ActivityIndicator,
  Modal,
  KeyboardAvoidingView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { addressService, AddAddressRequest } from '@/services/address.service';
import { useConfirmation } from '@/context/ConfirmationContext';

interface AddAddressFormScreenProps {
  visible: boolean;
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  onBack?: () => void;
  onSave?: (addressData: any) => void;
  onClose?: () => void;
  // Edit mode props
  editMode?: boolean;
  addressId?: string;
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
  onBack,
  onSave,
  onClose,
  editMode = false,
  addressId,
  initialData,
}) => {
  const { showConfirmation } = useConfirmation();
  const [houseNo, setHouseNo] = useState('');
  const [building, setBuilding] = useState('');
  const [locality, setLocality] = useState('');
  const [city, setCity] = useState('');
  const [state, setState] = useState('');
  const [pincode, setPincode] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [selectedTag, setSelectedTag] = useState<'Home' | 'Work' | 'Other'>('Home');
  const [loading, setLoading] = useState(false);
  const [keyboardVisible, setKeyboardVisible] = useState(false);
  const slideAnim = useRef(new Animated.Value(1000)).current;
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
    }

    if (visible && !hasInitializedRef.current) {
      hasInitializedRef.current = true;

      if (editMode && initialData) {
        setHouseNo(initialData.houseNo || '');
        setBuilding(initialData.building || '');
        setLocality(initialData.locality || '');
        setCity(initialData.city || '');
        setState(initialData.state || '');
        setPincode(initialData.pincode || '');
        setAlternateMobile(initialData.alternateMobile || '');
        setIsDefault(initialData.isDefault || false);
        if (initialData.tag) {
          const tagCapitalized = initialData.tag.charAt(0).toUpperCase() + initialData.tag.slice(1) as 'Home' | 'Work' | 'Other';
          setSelectedTag(tagCapitalized);
        }
      } else if (!editMode) {
        // Reset form for add mode
        setHouseNo('');
        setBuilding('');
        setLocality('');
        setCity('');
        setState('');
        setPincode('');
        setAlternateMobile('');
        setIsDefault(false);
        setSelectedTag('Home');
      }
    }
  }, [visible, editMode, initialData]);

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

  // Listen to keyboard events
  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
      }
    );
    const keyboardDidHideListener = Keyboard.addListener(
      'keyboardDidHide',
      () => {
        setKeyboardVisible(false);
      }
    );

    return () => {
      keyboardDidShowListener.remove();
      keyboardDidHideListener.remove();
    };
  }, []);

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

  const handleContinue = async () => {
    // Validation
    if (!houseNo.trim()) {
      showConfirmation({
        title: 'Validation Error',
        message: 'Please enter house/flat number',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }
    if (!building.trim()) {
      showConfirmation({
        title: 'Validation Error',
        message: 'Please enter building/street name',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }
    if (!locality.trim()) {
      showConfirmation({
        title: 'Validation Error',
        message: 'Please enter landmark',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }
    if (!pincode.trim()) {
      showConfirmation({
        title: 'Validation Error',
        message: 'Please enter pincode',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }
    // Validate pincode format (must be exactly 6 digits)
    if (!/^\d{6}$/.test(pincode.trim())) {
      showConfirmation({
        title: 'Validation Error',
        message: 'Pincode must be exactly 6 digits',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }
    // Validate alternate mobile if provided (must be exactly 10 digits)
    if (alternateMobile.trim() && !/^\d{10}$/.test(alternateMobile.trim())) {
      showConfirmation({
        title: 'Validation Error',
        message: 'Alternate mobile number must be exactly 10 digits',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
      return;
    }

    setLoading(true);

    try {
      // Log received coordinates

      // Prepare address data for API
      const addressData: AddAddressRequest = {
        address1: houseNo,
        address2: building,
        address3: locality,
        city: 'Madurai',
        state: 'Tamil Nadu',
        pincode: pincode,
        latitude: latitude,
        longitude: longitude,
        type: selectedTag.toLowerCase() as 'home' | 'work' | 'other',
        alternate_phone_number: alternateMobile ? parseInt(alternateMobile, 10) : undefined,
        is_default: false,
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
        // Call onSave to handle state cleanup and refresh
        if (onSave) {
          onSave(response.data);
        }

        // Show success message
        showConfirmation({
          title: 'Success',
          message: editMode ? 'Address updated successfully' : 'Address added successfully',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      } else {
        showConfirmation({
          title: 'Error',
          message: response.error || (editMode ? 'Failed to update address' : 'Failed to add address'),
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      }
    } catch (error) {
      showConfirmation({
        title: 'Error',
        message: 'An unexpected error occurred. Please try again.',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
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

        <Animated.View
          style={[
            styles.bottomSheetWrapper,
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            <Animated.View
              style={[
                styles.bottomSheet,
                {
                  transform: [{ translateY: slideAnim }],
                }
              ]}
            >
          <KeyboardAvoidingView
            behavior={Platform.OS === 'ios' ? 'padding' : undefined}
            style={styles.keyboardAvoidingView}
            keyboardVerticalOffset={0}
          >
          <ScrollView
            ref={scrollViewRef}
            style={styles.scrollView}
            contentContainerStyle={[
              styles.scrollContent,
              keyboardVisible && styles.scrollContentWithKeyboard
            ]}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
          {/* Header - Location Info */}
          <View style={styles.header}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="location-on" size={28} color="#00B14F" />
              <Text style={styles.locationName}>{editMode ? 'Edit Address' : locationName}</Text>
            </View>
            {!editMode && <Text style={styles.locationAddress}>{locationAddress}</Text>}
            <TouchableOpacity style={styles.relocateButton} onPress={onBack}>
              <MaterialIcons name="my-location" size={20} color="#00B14F" />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* House/Flat/Floor Number - Full width */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={styles.input}
                value={houseNo}
                onChangeText={setHouseNo}
                placeholder="House / flat / floor number"
                placeholderTextColor="#999"
                maxLength={50}
              />
            </View>

            {/* House/Building/Street Name - Full width */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={styles.input}
                value={building}
                onChangeText={setBuilding}
                placeholder="House / Building / Street Name"
                placeholderTextColor="#999"
                maxLength={100}
              />
            </View>

            {/* Landmark - Full width */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={styles.input}
                value={locality}
                onChangeText={setLocality}
                placeholder="Landmark"
                placeholderTextColor="#999"
                maxLength={100}
              />
            </View>

            {/* Pincode */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={styles.input}
                value={pincode}
                onChangeText={(text) => {
                  // Only allow numeric input
                  const numericText = text.replace(/[^0-9]/g, '');
                  setPincode(numericText);
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
            </View>

            {/* Alternate Mobile Number */}
            <View style={styles.fieldGroup}>
              <TextInput
                style={styles.input}
                value={alternateMobile}
                onChangeText={(text) => {
                  // Only allow numeric input
                  const numericText = text.replace(/[^0-9]/g, '');
                  setAlternateMobile(numericText);
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
            </View>

            {/* Address Tags */}
            <View style={styles.tagsContainer}>
              <TouchableOpacity
                style={[
                  styles.tag,
                  selectedTag === 'Home' && styles.tagSelected,
                ]}
                onPress={() => setSelectedTag('Home')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="home"
                  size={16}
                  color={selectedTag === 'Home' ? '#FFFFFF' : '#001E1F'}
                />
                <Text
                  style={[
                    styles.tagText,
                    selectedTag === 'Home' && styles.tagTextSelected,
                  ]}
                >
                  Home
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tag,
                  selectedTag === 'Work' && styles.tagSelected,
                ]}
                onPress={() => setSelectedTag('Work')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="work"
                  size={16}
                  color={selectedTag === 'Work' ? '#FFFFFF' : '#001E1F'}
                />
                <Text
                  style={[
                    styles.tagText,
                    selectedTag === 'Work' && styles.tagTextSelected,
                  ]}
                >
                  Work
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                style={[
                  styles.tag,
                  selectedTag === 'Other' && styles.tagSelected,
                ]}
                onPress={() => setSelectedTag('Other')}
                activeOpacity={0.7}
              >
                <MaterialIcons
                  name="location-on"
                  size={16}
                  color={selectedTag === 'Other' ? '#FFFFFF' : '#001E1F'}
                />
                <Text
                  style={[
                    styles.tagText,
                    selectedTag === 'Other' && styles.tagTextSelected,
                  ]}
                >
                  Other
                </Text>
              </TouchableOpacity>
            </View>
          </View>
        </ScrollView>

        {/* Continue Button */}
        <View style={styles.footer}>
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
            </View>
          </KeyboardAvoidingView>
            </Animated.View>
          </TouchableOpacity>
        </Animated.View>
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
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '75%',
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
    height: '100%',
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
    gap: 10,
    height: 30,
    paddingRight: 48,
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
});
