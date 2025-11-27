import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import Constants from 'expo-constants';
import { storageService } from '@/services/storage.service';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';

interface ProfileScreenProps {
  visible?: boolean;
  onBack?: () => void;
  onEditProfile?: () => void;
  onMyOrders?: () => void;
  onMyAddresses?: () => void;
  onFavorites?: () => void;
  onContactUs?: () => void;
  onPrivacyPolicy?: () => void;
  onTermsConditions?: () => void;
  onFaq?: () => void;
  onLogout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  visible = true,
  onBack,
  onEditProfile,
  onMyOrders,
  onMyAddresses,
  onFavorites,
  onContactUs,
  onPrivacyPolicy,
  onTermsConditions,
  onFaq,
  onLogout,
}) => {
  const { showConfirmation } = useConfirmation();
  const [userName, setUserName] = useState('User');
  const [userPhone, setUserPhone] = useState('');

  // Get app version dynamically from Expo Constants
  // Try multiple sources to ensure we get the version in all environments
  const appVersion = 
    Constants.expoConfig?.version || 
    Constants.manifest?.version || 
    Constants.manifest2?.extra?.expoClient?.version ||
    ''; // Fallback version if none found

  // Fetch user data from API whenever screen becomes visible
  useEffect(() => {
    if (visible) {
      const fetchUserData = async () => {
        try {
          // First try to get data from API
          const response = await authService.getProfile();
          
          if (response.success && response.data?.user) {
            const user = response.data.user;
            setUserName(user.name || 'User');
            setUserPhone(user.phoneNumber || '');
          } else {
            // If API fails, try to get data from storage as fallback
            const userData = await storageService.getUser();
            if (userData) {
              setUserName(userData.name || 'User');
              setUserPhone(userData.phoneNumber || '');
            }
          }
        } catch (error) {
          // On error, try to load from storage
          try {
            const userData = await storageService.getUser();
            if (userData) {
              setUserName(userData.name || 'User');
              setUserPhone(userData.phoneNumber || '');
            }
          } catch (storageError) {
            // Silent fail - keep default values
          }
        }
      };

      fetchUserData();
    }
  }, [visible]);

  const handleLogout = () => {
    showConfirmation({
      title: 'Logout',
      message: 'Are you sure you want to logout from your account?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      confirmButtonColor: '#FF0000',
      onConfirm: async () => {
        try {
          await authService.logout();
          if (onLogout) {
            onLogout();
          }
        } catch (error) {
          showConfirmation({
            title: 'Error',
            message: 'Failed to logout. Please try again.',
            confirmText: 'OK',
            cancelText: 'Close',
            onConfirm: () => {},
          });
        }
      },
    });
  };

  // Menu item component
  const MenuItem = ({
    label,
    icon,
    onPress,
    showArrow = true,
    showDivider = true,
  }: {
    label: string;
    icon?: string;
    onPress?: () => void;
    showArrow?: boolean;
    showDivider?: boolean;
  }) => (
    <>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 16, bottom: 16, left: 0, right: 0 }}
      >
        <View style={styles.menuItemLeft}>
          {icon && (
            <MaterialIcons name={icon as any} size={20} color="#00B14F" />
          )}
          <Text style={styles.menuItemText}>{label}</Text>
        </View>
        {showArrow && (
          <MaterialIcons name="chevron-right" size={14} color="#000000" />
        )}
      </TouchableOpacity>
      {showDivider && (
        <View style={styles.divider} />
      )}
    </>
  );

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Green Header */}
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
        <Text style={styles.headerTitle}>Profile</Text>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.container}>
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {/* Left side - Avatar and Info */}
            <View style={styles.profileLeft}>
              {/* Avatar with First Letter */}
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {userName && userName.length > 0 ? userName.charAt(0).toUpperCase() : 'U'}
                  </Text>
                </View>
              </View>

              {/* Name and Phone */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>{userName.toUpperCase()}</Text>
                <Text style={styles.profilePhone}>{userPhone ? `+91 ${userPhone}` : ''}</Text>
              </View>
            </View>

            {/* Right side - Edit Profile Button */}
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={onEditProfile}
              activeOpacity={0.7}
              hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
              <MaterialIcons name="chevron-right" size={9} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Menu Container */}
          <View style={styles.menuContainer}>
            <MenuItem label="My Orders" icon="receipt-long" onPress={onMyOrders} />
            <MenuItem label="My Addresses" icon="location-on" onPress={onMyAddresses} />
            <MenuItem label="Favorites" icon="favorite" onPress={onFavorites} />
            <MenuItem label="Contact Us" icon="chat" onPress={onContactUs} />

            {/* Notification Toggle */}
            {/* <View style={styles.menuItem}>
              <View style={styles.menuItemLeft}>
                <MaterialIcons name="notifications" size={20} color="#00B14F" />
                <Text style={styles.menuItemText}>Notification</Text>
              </View>
              <View style={styles.switchContainer}>
                <Switch
                  value={notificationsEnabled}
                  onValueChange={setNotificationsEnabled}
                  trackColor={{ false: '#E0E0E0', true: '#00B14F' }}
                  thumbColor="#FFFFFF"
                  ios_backgroundColor="#E0E0E0"
                />
              </View>
            </View>
            <View style={styles.divider} /> */}

            <MenuItem 
              label="Privacy Policy" 
              icon="shield" 
              onPress={onPrivacyPolicy} 
            />
            <MenuItem 
              label="FAQ" 
              icon="help-outline" 
              onPress={onFaq} 
            />
            <MenuItem
              label="Terms & Conditions"
              icon="description"
              onPress={onTermsConditions}
              showArrow={false}
              showDivider={false}
            />
          </View>
        </ScrollView>

        {/* Bottom Section - App Version & Logout Button */}
        <View style={styles.bottomSection}>
          {/* App Version */}
          <Text style={styles.appVersion}>App Version {appVersion}</Text>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={handleLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutText}>LOGOUT</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
        </View>
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
  container: {
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
    backgroundColor: '#F5F5F5',
  },
  // Green Header
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
  },
  // Back Button
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
  // Profile Header
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarContainer: {
    width: 50,
    height: 50,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 20,
    color: '#00B14F',
    lineHeight: 24,
  },
  profileInfo: {
    gap: 2,
  },
  profileName: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  profilePhone: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editProfileText: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  // Menu Container
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
    marginBottom: 20,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 21,
    paddingVertical: 2,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  menuItemText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  switchContainer: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 20,
  },
  // Bottom Section
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  // App Version
  appVersion: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.85,
  },
  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
  },
  logoutText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
