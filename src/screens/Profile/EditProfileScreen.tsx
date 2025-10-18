import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface EditProfileScreenProps {
  onBack?: () => void;
  onSave?: (data: { name: string; phone: string; email?: string; alternatePhone?: string }) => void;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
  initialAlternatePhone?: string;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  onBack,
  onSave,
  initialName = 'Ranjith',
  initialPhone = '8965715421',
  initialEmail = 'example@gmail.com',
  initialAlternatePhone = '8965715421',
}) => {
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [alternatePhone, setAlternatePhone] = useState(initialAlternatePhone);

  const handleUpdate = () => {
    if (onSave) {
      onSave({ name, phone, email, alternatePhone });
    }
    if (onBack) {
      onBack();
    }
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Edit Profile</Text>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Mobile Number */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Mobile Number</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <View style={styles.phoneInputBox}>
                <TextInput
                  style={styles.phoneInput}
                  value={phone}
                  onChangeText={setPhone}
                  placeholder="Enter mobile number"
                  placeholderTextColor="rgba(0, 0, 0, 0.3)"
                  keyboardType="phone-pad"
                />
                <MaterialIcons name="check-circle" size={24} color="#00B14F" />
              </View>
            </View>
          </View>

          {/* Name */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Name</Text>
            <TextInput
              style={styles.textInput}
              value={name}
              onChangeText={setName}
              placeholder="Enter your name"
              placeholderTextColor="rgba(0, 0, 0, 0.3)"
            />
          </View>

          {/* Email (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Email (optional)</Text>
            <TextInput
              style={styles.textInput}
              value={email}
              onChangeText={setEmail}
              placeholder="Enter your email"
              placeholderTextColor="rgba(0, 0, 0, 0.3)"
              keyboardType="email-address"
              autoCapitalize="none"
            />
          </View>

          {/* Alternate Mobile Number (Optional) */}
          <View style={styles.inputGroup}>
            <Text style={styles.label}>Alternate Mobile Number (Optional)</Text>
            <View style={styles.phoneRow}>
              <View style={styles.countryCodeBox}>
                <Text style={styles.flagEmoji}>🇮🇳</Text>
                <Text style={styles.countryCode}>+91</Text>
              </View>
              <View style={styles.phoneInputBox}>
                <TextInput
                  style={styles.phoneInput}
                  value={alternatePhone}
                  onChangeText={setAlternatePhone}
                  placeholder="Enter alternate mobile number"
                  placeholderTextColor="rgba(0, 0, 0, 0.3)"
                  keyboardType="phone-pad"
                />
                <MaterialIcons name="check-circle" size={24} color="#00B14F" />
              </View>
            </View>
          </View>
        </ScrollView>

        {/* Update Button - Fixed at bottom */}
        <View style={styles.bottomButtonContainer}>
          <TouchableOpacity
            style={styles.updateButton}
            onPress={handleUpdate}
            activeOpacity={0.8}
          >
            <Text style={styles.updateButtonText}>Update</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#000000" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
    opacity: 0.85,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 18,
    paddingBottom: 24,
  },
  inputGroup: {
    gap: 10,
  },
  label: {
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 23,
    color: '#000000',
  },
  phoneRow: {
    flexDirection: 'row',
    gap: 10,
  },
  countryCodeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 14,
    paddingVertical: 16,
    gap: 8,
  },
  flagEmoji: {
    fontSize: 20,
  },
  countryCode: {
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 23,
    color: '#000000',
  },
  phoneInputBox: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    gap: 12,
  },
  phoneInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 23,
    color: '#000000',
    paddingVertical: 0,
  },
  textInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 16,
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 23,
    color: '#000000',
  },
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  updateButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#E5E5E5',
    borderRadius: 10,
  },
  updateButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
});
