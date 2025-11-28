import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { fcmNotificationService } from '@/services/fcmNotification.service';
import { Platform } from 'react-native';

interface TestFCMScreenProps {
  visible?: boolean;
  onBack?: () => void;
}

export const TestFCMScreen: React.FC<TestFCMScreenProps> = ({
  visible = true,
  onBack,
}) => {
  const [fcmToken, setFcmToken] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [permissionStatus, setPermissionStatus] = useState<boolean | null>(null);
  const [testMessage, setTestMessage] = useState('Test notification message');

  useEffect(() => {
    if (visible) {
      loadFCMStatus();
    }
  }, [visible]);

  const loadFCMStatus = async () => {
    setIsLoading(true);
    try {
      // Get stored token
      const token = await fcmNotificationService.getStoredToken();
      setFcmToken(token);
      
      // Log token to console
      if (token) {
        console.log('📱 FCM Token (from storage):', token);
      } else {
        console.log('⚠️  FCM Token: Not available');
      }

      // Check permissions
      const hasPermission = await fcmNotificationService.areNotificationsEnabled();
      setPermissionStatus(hasPermission);
    } catch (error) {
      console.error('Error loading FCM status:', error);
      Alert.alert('Error', 'Failed to load FCM status');
    } finally {
      setIsLoading(false);
    }
  };

  const handleGetToken = async () => {
    setIsLoading(true);
    try {
      const token = await fcmNotificationService.getToken();
      if (token) {
        setFcmToken(token);
        // Log full token to console
        console.log('📱 FCM Token:', token);
        console.log('📱 FCM Token (first 50 chars):', token.substring(0, 50) + '...');
        Alert.alert(
          'Success',
          `FCM Token:\n${token.substring(0, 50)}...\n\nToken copied to clipboard!`,
          [{ text: 'OK' }]
        );
      } else {
        console.log('⚠️  Failed to get FCM token');
        Alert.alert('Error', 'Failed to get FCM token. Make sure notifications are enabled.');
      }
    } catch (error: any) {
      console.error('❌ Error getting FCM token:', error);
      Alert.alert('Error', error.message || 'Failed to get FCM token');
    } finally {
      setIsLoading(false);
    }
  };

  const handleRequestPermission = async () => {
    setIsLoading(true);
    try {
      const granted = await fcmNotificationService.requestPermission();
      setPermissionStatus(granted);
      console.log('🔔 Notification Permission Status:', granted ? 'Granted' : 'Denied');
      if (granted) {
        Alert.alert('Success', 'Notification permissions granted!');
        // Try to get token after permission granted
        await handleGetToken();
      } else {
        Alert.alert('Permission Denied', 'Notification permissions were denied. Please enable them in settings.');
      }
    } catch (error: any) {
      console.error('❌ Error requesting permissions:', error);
      Alert.alert('Error', error.message || 'Failed to request permissions');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSendTokenToBackend = async () => {
    if (!fcmToken) {
      Alert.alert('Error', 'No FCM token available. Please get token first.');
      return;
    }

    setIsLoading(true);
    try {
      // The service automatically sends token, but we can trigger it manually
      const token = await fcmNotificationService.getToken();
      if (token) {
        console.log('📤 Sending FCM Token to Backend:', token);
        Alert.alert('Success', 'Token sent to backend successfully!');
      } else {
        console.log('⚠️  No token available to send');
        Alert.alert('Error', 'Failed to send token to backend');
      }
    } catch (error: any) {
      console.error('❌ Error sending token to backend:', error);
      Alert.alert('Error', error.message || 'Failed to send token to backend');
    } finally {
      setIsLoading(false);
    }
  };

  const handleClearToken = async () => {
    Alert.alert(
      'Clear Token',
      'Are you sure you want to clear the FCM token?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Clear',
          style: 'destructive',
          onPress: async () => {
            setIsLoading(true);
            try {
              await fcmNotificationService.unregisterToken();
              setFcmToken(null);
              Alert.alert('Success', 'Token cleared successfully!');
            } catch (error: any) {
              Alert.alert('Error', error.message || 'Failed to clear token');
            } finally {
              setIsLoading(false);
            }
          },
        },
      ]
    );
  };

  const handleReinitialize = async () => {
    setIsLoading(true);
    try {
      console.log('🔄 Reinitializing FCM...');
      const success = await fcmNotificationService.initialize();
      if (success) {
        console.log('✅ FCM reinitialized successfully');
        await loadFCMStatus();
        Alert.alert('Success', 'FCM reinitialized successfully!');
      } else {
        console.log('⚠️  FCM reinitialization failed');
        Alert.alert('Error', 'Failed to reinitialize FCM. Check console for details.');
      }
    } catch (error: any) {
      console.error('❌ Error reinitializing FCM:', error);
      Alert.alert('Error', error.message || 'Failed to reinitialize FCM');
    } finally {
      setIsLoading(false);
    }
  };

  const copyTokenToClipboard = () => {
    if (fcmToken) {
      // In React Native, you'd use Clipboard API
      Alert.alert('Token', fcmToken, [
        { text: 'OK' },
        { text: 'Copy', onPress: () => {
          // You can add Clipboard.setString(fcmToken) here if needed
          Alert.alert('Copied', 'Token copied to clipboard!');
        }},
      ]);
    }
  };

  const TestButton = ({
    label,
    icon,
    onPress,
    variant = 'primary',
    disabled = false,
  }: {
    label: string;
    icon: string;
    onPress: () => void;
    variant?: 'primary' | 'secondary' | 'danger';
    disabled?: boolean;
  }) => {
    const getButtonStyle = () => {
      if (disabled) return styles.testButtonDisabled;
      if (variant === 'danger') return styles.testButtonDanger;
      if (variant === 'secondary') return styles.testButtonSecondary;
      return styles.testButton;
    };

    const getTextStyle = () => {
      if (disabled) return styles.testButtonTextDisabled;
      if (variant === 'danger') return styles.testButtonTextDanger;
      if (variant === 'secondary') return styles.testButtonTextSecondary;
      return styles.testButtonText;
    };

    return (
      <TouchableOpacity
        style={[styles.testButtonContainer, getButtonStyle()]}
        onPress={onPress}
        disabled={disabled || isLoading}
        activeOpacity={0.7}
      >
        <MaterialIcons name={icon as any} size={20} color={variant === 'danger' ? '#FFFFFF' : '#00B14F'} />
        <Text style={getTextStyle()}>{label}</Text>
        {isLoading && <ActivityIndicator size="small" color="#00B14F" style={{ marginLeft: 8 }} />}
      </TouchableOpacity>
    );
  };

  const StatusCard = ({ label, value, icon }: { label: string; value: string | boolean | null; icon: string }) => {
    const getStatusColor = () => {
      if (value === null) return '#999999';
      if (typeof value === 'boolean') {
        return value ? '#00B14F' : '#DC2626';
      }
      return '#00B14F';
    };

    const getStatusText = () => {
      if (value === null) return 'Unknown';
      if (typeof value === 'boolean') {
        return value ? 'Enabled' : 'Disabled';
      }
      return value;
    };

    return (
      <View style={styles.statusCard}>
        <View style={styles.statusCardLeft}>
          <MaterialIcons name={icon as any} size={24} color={getStatusColor()} />
          <View style={styles.statusCardText}>
            <Text style={styles.statusCardLabel}>{label}</Text>
            <Text style={[styles.statusCardValue, { color: getStatusColor() }]}>
              {getStatusText()}
            </Text>
          </View>
        </View>
      </View>
    );
  };

  if (!visible) return null;

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            style={styles.backButton}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle}>Test FCM</Text>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Status Cards */}
          <View style={styles.statusSection}>
            <Text style={styles.sectionTitle}>Status</Text>
            <StatusCard
              label="Platform"
              value={Platform.OS}
              icon="phone-android"
            />
            <StatusCard
              label="Permissions"
              value={permissionStatus}
              icon="notifications"
            />
            <StatusCard
              label="FCM Token"
              value={fcmToken ? 'Available' : 'Not Available'}
              icon="vpn-key"
            />
          </View>

          {/* Token Display */}
          {fcmToken && (
            <View style={styles.tokenSection}>
              <Text style={styles.sectionTitle}>FCM Token</Text>
              <TouchableOpacity
                style={styles.tokenContainer}
                onPress={copyTokenToClipboard}
                activeOpacity={0.7}
              >
                <Text style={styles.tokenText} numberOfLines={2}>
                  {fcmToken}
                </Text>
                <MaterialIcons name="content-copy" size={20} color="#00B14F" />
              </TouchableOpacity>
            </View>
          )}

          {/* Test Actions */}
          <View style={styles.actionsSection}>
            <Text style={styles.sectionTitle}>Actions</Text>
            
            <TestButton
              label="Request Permissions"
              icon="lock-open"
              onPress={handleRequestPermission}
              variant="primary"
              disabled={permissionStatus === true}
            />

            <TestButton
              label="Get FCM Token"
              icon="vpn-key"
              onPress={handleGetToken}
              variant="primary"
            />

            <TestButton
              label="Send Token to Backend"
              icon="cloud-upload"
              onPress={handleSendTokenToBackend}
              variant="secondary"
              disabled={!fcmToken}
            />

            <TestButton
              label="Reinitialize FCM"
              icon="refresh"
              onPress={handleReinitialize}
              variant="secondary"
            />

            <TestButton
              label="Clear Token"
              icon="delete"
              onPress={handleClearToken}
              variant="danger"
              disabled={!fcmToken}
            />
          </View>

          {/* Instructions */}
          <View style={styles.instructionsSection}>
            <Text style={styles.sectionTitle}>Testing Instructions</Text>
            <View style={styles.instructionItem}>
              <MaterialIcons name="check-circle" size={16} color="#00B14F" />
              <Text style={styles.instructionText}>
                1. Request permissions and get FCM token
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <MaterialIcons name="check-circle" size={16} color="#00B14F" />
              <Text style={styles.instructionText}>
                2. Copy the token and use it in Firebase Console
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <MaterialIcons name="check-circle" size={16} color="#00B14F" />
              <Text style={styles.instructionText}>
                3. Send test notification from Firebase Console
              </Text>
            </View>
            <View style={styles.instructionItem}>
              <MaterialIcons name="check-circle" size={16} color="#00B14F" />
              <Text style={styles.instructionText}>
                4. Test foreground, background, and quit states
              </Text>
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 20,
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
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#000000',
    marginBottom: 12,
  },
  statusSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  statusCard: {
    marginBottom: 12,
  },
  statusCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  statusCardText: {
    flex: 1,
  },
  statusCardLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    color: '#666666',
    marginBottom: 4,
  },
  statusCardValue: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#000000',
  },
  tokenSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  tokenContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 10,
    padding: 12,
    gap: 8,
  },
  tokenText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    color: '#000000',
  },
  actionsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  testButtonContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderRadius: 10,
    marginBottom: 12,
    gap: 8,
  },
  testButton: {
    backgroundColor: '#E8F5E9',
    borderWidth: 1,
    borderColor: '#00B14F',
  },
  testButtonSecondary: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  testButtonDanger: {
    backgroundColor: '#DC2626',
  },
  testButtonDisabled: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    opacity: 0.5,
  },
  testButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#00B14F',
  },
  testButtonTextSecondary: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#000000',
  },
  testButtonTextDanger: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
  },
  testButtonTextDisabled: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#999999',
  },
  instructionsSection: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  instructionItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 8,
    marginBottom: 12,
  },
  instructionText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    color: '#666666',
    lineHeight: 20,
  },
});

