import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Switch,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface ProfileScreenProps {
  onBack?: () => void;
  onEditProfile?: () => void;
  onMyOrders?: () => void;
  onMyAddresses?: () => void;
  onFavorites?: () => void;
  onChatWithUs?: () => void;
  onPrivacyPolicy?: () => void;
  onTermsConditions?: () => void;
  onLogout?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  onBack,
  onEditProfile,
  onMyOrders,
  onMyAddresses,
  onFavorites,
  onChatWithUs,
  onPrivacyPolicy,
  onTermsConditions,
  onLogout,
}) => {
  const [notificationsEnabled, setNotificationsEnabled] = useState(true);

  // Menu item component
  const MenuItem = ({
    label,
    onPress,
    showArrow = true,
  }: {
    label: string;
    onPress?: () => void;
    showArrow?: boolean;
  }) => (
    <>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        activeOpacity={0.7}
      >
        <Text style={styles.menuItemText}>{label}</Text>
        {showArrow && (
          <MaterialIcons name="chevron-right" size={14} color="#000000" />
        )}
      </TouchableOpacity>
      <View style={styles.divider} />
    </>
  );

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar barStyle="dark-content" backgroundColor="#F3FFFA" />
      <View style={styles.container}>
        <ScrollView
          style={styles.scrollContent}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.scrollContentContainer}
        >
          {/* Back Button */}
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <MaterialIcons name="arrow-back" size={24} color="#000000" />
            </TouchableOpacity>
          )}

          {/* Profile Header */}
          <View style={styles.profileHeader}>
            {/* Left side - Avatar and Info */}
            <View style={styles.profileLeft}>
              {/* Avatar with Edit Icon */}
              <View style={styles.avatarContainer}>
                <View style={styles.avatar}>
                  <MaterialIcons name="person" size={24} color="#FFFFFF" />
                </View>
              </View>

              {/* Name and Phone */}
              <View style={styles.profileInfo}>
                <Text style={styles.profileName}>RANJITH</Text>
                <Text style={styles.profilePhone}>+91 78459 65231</Text>
              </View>
            </View>

            {/* Right side - Edit Profile Button */}
            <TouchableOpacity
              style={styles.editProfileButton}
              onPress={onEditProfile}
              activeOpacity={0.7}
            >
              <Text style={styles.editProfileText}>Edit Profile</Text>
              <MaterialIcons name="chevron-right" size={9} color="#000000" />
            </TouchableOpacity>
          </View>

          {/* Menu Container */}
          <View style={styles.menuContainer}>
            <MenuItem label="My Orders" onPress={onMyOrders} />
            <MenuItem label="My Addresses" onPress={onMyAddresses} />
            <MenuItem label="Favorites" onPress={onFavorites} />
            <MenuItem label="Chat With Us" onPress={onChatWithUs} />

            {/* Notification Toggle */}
            <View style={styles.menuItem}>
              <Text style={styles.menuItemText}>Notification</Text>
              <Switch
                value={notificationsEnabled}
                onValueChange={setNotificationsEnabled}
                trackColor={{ false: '#E0E0E0', true: '#00B14F' }}
                thumbColor="#FFFFFF"
                ios_backgroundColor="#E0E0E0"
              />
            </View>
            <View style={styles.divider} />

            <MenuItem label="Privacy Policy" onPress={onPrivacyPolicy} />
            <MenuItem
              label="Terms & Conditions"
              onPress={onTermsConditions}
              showArrow={false}
            />
          </View>
        </ScrollView>

        {/* Bottom Section - App Version & Logout Button */}
        <View style={styles.bottomSection}>
          {/* App Version */}
          <Text style={styles.appVersion}>App Version 1.2</Text>

          {/* Logout Button */}
          <TouchableOpacity
            style={styles.logoutButton}
            onPress={onLogout}
            activeOpacity={0.8}
          >
            <Text style={styles.logoutText}>LOGOUT</Text>
            <MaterialIcons name="arrow-forward" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: '#F3FFFA',
  },
  container: {
    flex: 1,
    backgroundColor: '#F3FFFA',
  },
  scrollContent: {
    flex: 1,
    backgroundColor: '#F3FFFA',
  },
  scrollContentContainer: {
    paddingHorizontal: 20,
    backgroundColor: '#F3FFFA',
  },
  // Back Button
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 10,
    marginBottom: 10,
  },
  // Profile Header
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 30,
    marginBottom: 40,
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
    backgroundColor: '#000000',
    justifyContent: 'center',
    alignItems: 'center',
  },
  profileInfo: {
    gap: 2,
  },
  profileName: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  profilePhone: {
    fontFamily: 'Poppins',
    fontWeight: '400',
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
    fontWeight: '500',
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
    height: 21,
  },
  menuItemText: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  divider: {
    height: 1,
    backgroundColor: 'transparent',
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: 'rgba(158, 158, 158, 0.5)',
    marginVertical: 20,
  },
  // Bottom Section
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F3FFFA',
  },
  // App Version
  appVersion: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
  },
  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 19,
    paddingHorizontal: 20,
    gap: 10,
    height: 60,
    backgroundColor: '#FF0000',
    borderRadius: 10,
  },
  logoutText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
