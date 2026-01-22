import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  TextInput,
  ScrollView,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';

interface EditProfileScreenProps {
  onBack?: () => void;
  onSave?: (data: { name: string; phone: string; email?: string }) => void;
  initialName?: string;
  initialPhone?: string;
  initialEmail?: string;
}

export const EditProfileScreen: React.FC<EditProfileScreenProps> = ({
  onBack,
  onSave,
  initialName = '',
  initialPhone = '',
  initialEmail = '',
}) => {
  const { showConfirmation } = useConfirmation();
  const [name, setName] = useState(initialName);
  const [phone, setPhone] = useState(initialPhone);
  const [email, setEmail] = useState(initialEmail);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Fetch profile data on mount
  useEffect(() => {
    const fetchProfile = async () => {
      setIsLoading(true);
      try {
        // First try to get data from API
        const response = await authService.getProfile();

        if (response.success && response.data?.user) {
          const user = response.data.user;
          setName(user.name || '');
          setPhone(user.phoneNumber || '');
          setEmail(user.email || '');
          // Alternate phone not available in current API response
        } else {
          // If API fails, try to get data from storage as fallback
          const currentUser = await authService.getCurrentUser();
          if (currentUser) {
            setName(currentUser.name || '');
            setPhone(currentUser.phoneNumber || '');
            setEmail(currentUser.email || '');
          }
        }
      } catch (error) {
        // On error, try to load from storage
        try {
          const currentUser = await authService.getCurrentUser();
          if (currentUser) {
            setName(currentUser.name || '');
            setPhone(currentUser.phoneNumber || '');
            setEmail(currentUser.email || '');
          }
        } catch (storageError) {
          // Silent fail - form will be empty
        }
      } finally {
        setIsLoading(false);
      }
    };

    fetchProfile();
  }, []);

  const handleUpdate = async () => {
    // Clear any existing inline messages before validation
    if (error) setError('');
    if (success) setSuccess('');

    // Validate required fields
    if (!name.trim()) {
      setError('Name is required');
      return;
    }

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setError('Email is required');
      return;
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(trimmedEmail)) {
      setError('Please enter a valid email address');
      return;
    }

    setIsSaving(true);
    try {
      const response = await authService.updateProfile({
        name: name.trim(),
        email: trimmedEmail,
      });

      if (response.success) {
        // Show inline success message and propagate changes
        setSuccess('Profile updated successfully');
        setError('');

        if (onSave) {
          onSave({ name, phone, email });
        }
        if (onBack) {
          onBack();
        }
      } else {
        showConfirmation({
          title: 'Error',
          message: 'Email already exist',
          confirmText: 'OK',
          cancelText: 'Close',
          onConfirm: () => {},
        });
      }
    } catch (error) {
      showConfirmation({
        title: 'Error',
        message: 'Email already exist',
        confirmText: 'OK',
        cancelText: 'Close',
        onConfirm: () => {},
      });
    } finally {
      setIsSaving(false);
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
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00B14F" />
            <Text style={styles.loadingText}>Loading profile...</Text>
          </View>
        ) : (
          <>
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
                      placeholder="Enter mobile number"
                      placeholderTextColor="rgba(0, 0, 0, 0.3)"
                      keyboardType="phone-pad"
                      editable={false}
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
                  onChangeText={(text) => {
                    setName(text);
                    if (error) {
                      setError('');
                    }
                    if (success) {
                      setSuccess('');
                    }
                  }}
                  placeholder="Enter your name"
                  placeholderTextColor="rgba(0, 0, 0, 0.3)"
                  maxLength={18}
                />
              </View>

              {/* Email */}
              <View style={styles.inputGroup}>
                <Text style={styles.label}>Email</Text>
                <TextInput
                  style={styles.textInput}
                  value={email}
                  onChangeText={(text) => {
                    setEmail(text);
                    if (error) {
                      setError('');
                    }
                    if (success) {
                      setSuccess('');
                    }
                  }}
                  placeholder="Enter your email"
                  placeholderTextColor="rgba(0, 0, 0, 0.3)"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  maxLength={30}
                />
              </View>

              {/* Inline Error Message */}
              {error ? <Text style={styles.errorText}>{error}</Text> : null}
              {success ? <Text style={styles.successText}>{success}</Text> : null}
            </ScrollView>

            {/* Update Button - Fixed at bottom */}
            <View style={styles.bottomButtonContainer}>
              <TouchableOpacity
                style={[styles.updateButton, isSaving && styles.updateButtonDisabled]}
                onPress={handleUpdate}
                activeOpacity={0.8}
                disabled={isSaving}
              >
                {isSaving ? (
                  <ActivityIndicator size="small" color="#000000" />
                ) : (
                  <>
                    <Text style={styles.updateButtonText}>Update</Text>
                    <MaterialIcons name="arrow-forward" size={24} color="#000000" />
                  </>
                )}
              </TouchableOpacity>
            </View>
          </>
        )}
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
    paddingVertical: 15,
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
  errorText: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 18,
    color: '#D32F2F',
  },
  successText: {
    width: '100%',
    marginTop: 4,
    marginBottom: 4,
    fontFamily: 'Poppins',
    fontSize: 13,
    lineHeight: 18,
    color: '#00B14F',
  },
  bottomButtonContainer: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 60,
    gap: 12,
  },
  loadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#666',
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
  updateButtonDisabled: {
    opacity: 0.6,
  },
  updateButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
});
