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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface AddAddressFormScreenProps {
  locationName: string;
  locationAddress: string;
  latitude: number;
  longitude: number;
  onBack?: () => void;
  onSave?: (addressData: any) => void;
}

export const AddAddressFormScreen: React.FC<AddAddressFormScreenProps> = ({
  locationName,
  locationAddress,
  latitude,
  longitude,
  onBack,
  onSave,
}) => {
  const [houseNo, setHouseNo] = useState('');
  const [building, setBuilding] = useState('');
  const [locality, setLocality] = useState('');
  const [alternateMobile, setAlternateMobile] = useState('');
  const [isDefault, setIsDefault] = useState(false);
  const [selectedTag, setSelectedTag] = useState<'Home' | 'Work' | 'Other'>('Home');
  const bottomPosition = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const keyboardDidShowListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      (event) => {
        Animated.timing(bottomPosition, {
          toValue: event.endCoordinates.height,
          duration: Platform.OS === 'ios' ? 250 : 200,
          useNativeDriver: false,
        }).start();
      }
    );

    const keyboardDidHideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => {
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
    };
  }, []);

  const handleContinue = () => {
    const addressData = {
      name: selectedTag,
      locationName,
      locationAddress,
      houseNo,
      building,
      locality,
      alternateMobile,
      isDefault,
      latitude,
      longitude,
    };

    if (onSave) {
      onSave(addressData);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.backdrop} />

      <Animated.View
        style={[styles.bottomSheet, { bottom: bottomPosition }]}
      >

        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Header - Location Info */}
          <View style={styles.header}>
            <View style={styles.locationHeader}>
              <MaterialIcons name="location-on" size={28} color="#00B14F" />
              <Text style={styles.locationName}>{locationName}</Text>
            </View>
            <Text style={styles.locationAddress}>{locationAddress}</Text>
            <TouchableOpacity style={styles.relocateButton} onPress={onBack}>
              <MaterialIcons name="my-location" size={20} color="#00B14F" />
            </TouchableOpacity>
          </View>

          {/* Form Fields */}
          <View style={styles.formSection}>
            {/* House/Flat No */}
            <View style={styles.fieldGroup}>
              <View style={styles.fieldHeader}>
                <Text style={styles.fieldLabel}>House / Flat No</Text>
                <View style={styles.checkboxContainer}>
                  <TouchableOpacity
                    style={styles.checkbox}
                    onPress={() => setIsDefault(!isDefault)}
                    activeOpacity={0.7}
                  >
                    {isDefault && (
                      <MaterialIcons name="check" size={16} color="#00B14F" />
                    )}
                  </TouchableOpacity>
                  <Text style={styles.checkboxLabel}>Make is as default</Text>
                </View>
              </View>
              <TextInput
                style={styles.input}
                value={houseNo}
                onChangeText={setHouseNo}
                placeholder="Flat No"
                placeholderTextColor="#999"
              />
            </View>

            {/* Building/Street and Locality */}
            <View style={styles.rowFields}>
              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text style={styles.fieldLabel}>Building / Street</Text>
                <TextInput
                  style={styles.input}
                  value={building}
                  onChangeText={setBuilding}
                  placeholder="Jeyalakshmi Appart..."
                  placeholderTextColor="#999"
                />
              </View>

              <View style={[styles.fieldGroup, styles.halfField]}>
                <Text style={styles.fieldLabel}>Locality</Text>
                <TextInput
                  style={styles.input}
                  value={locality}
                  onChangeText={setLocality}
                  placeholder="Nanganallur"
                  placeholderTextColor="#999"
                />
              </View>
            </View>

            {/* Alternate Mobile Number */}
            <View style={styles.fieldGroup}>
              <Text style={styles.fieldLabel}>Alternate Mobile number</Text>
              <TextInput
                style={styles.input}
                value={alternateMobile}
                onChangeText={setAlternateMobile}
                placeholder="+91 9876543210"
                placeholderTextColor="#999"
                keyboardType="phone-pad"
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
            style={styles.continueButton}
            onPress={handleContinue}
            activeOpacity={0.8}
          >
            <Text style={styles.continueButtonText}>Continue</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </Animated.View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.3)',
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    maxHeight: '60%',
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
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingBottom: 16,
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
    height: 39,
    paddingRight: 48,
  },
  locationInfo: {
    flex: 1,
  },
  locationName: {
    fontFamily: 'Poppins',
    fontSize: 26,
    fontWeight: '700',
    color: '#001E1F',
    lineHeight: 39,
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
    paddingBottom: 24,
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
  continueButtonText: {
    fontFamily: 'Poppins',
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
