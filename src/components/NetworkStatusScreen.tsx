import React, { useMemo } from 'react';
import { View, Text, StyleSheet, StatusBar, ScrollView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { LinearGradient } from '@/shims/rn-linear-gradient';
import { colors } from '@/theme';

interface NetworkStatusScreenProps {
  selectedLocation?: { name: string; address: string; latitude?: number; longitude?: number };
}

// Memoize default location to prevent recreation on every render
const DEFAULT_LOCATION = {
  name: 'Madurai',
  address: 'Madurai, Tamil Nadu, India',
} as const;

const NetworkStatusScreenComponent: React.FC<NetworkStatusScreenProps> = ({
  selectedLocation,
}) => {
  const insets = useSafeAreaInsets();

  // Memoize location to prevent unnecessary recalculations
  const location = useMemo(
    () => selectedLocation || DEFAULT_LOCATION,
    [selectedLocation]
  );

  // Memoize header padding style
  const headerStyle = useMemo(
    () => [styles.headerBackground, { paddingTop: insets.top + 20 }],
    [insets.top]
  );

  return (
    <View style={styles.outerContainer}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />
      <SafeAreaView style={styles.safeArea} edges={[]}>
        <ScrollView
          style={styles.container}
          bounces={false}
          showsVerticalScrollIndicator={false}
        >
          {/* Header without default background image */}
          <View style={headerStyle}>
            {/* Location Section - Disabled */}
            <View style={styles.locationSection}>
              <View style={[styles.locationInfo, styles.disabledElement]}>
                <View style={styles.cityRow}>
                  <MaterialIcons name="location-on" size={20} color="#FFFFFF" />
                  <Text style={styles.cityName}>{location.name}</Text>
                  <View style={styles.arrowIconWrapper}>
                    <MaterialIcons name="keyboard-arrow-down" size={16} color="#FFFFFF" />
                  </View>
                </View>
                <Text style={styles.addressText} numberOfLines={1} ellipsizeMode="tail">
                  {location.address}
                </Text>
              </View>

              {/* Profile Avatar - Disabled */}
              <View style={[styles.profileButton, styles.disabledElement]}>
                <View style={styles.profileAvatar}>
                  <MaterialIcons name="person" size={22} color="#00B14F" />
                </View>
              </View>
            </View>

            {/* Search Bar - Disabled */}
            <View style={styles.searchSection}>
              <View style={{ flex: 1 }}>
                <LinearGradient
                  colors={['rgba(255, 255, 255, 0.5)', 'rgba(255, 255, 255, 0.2)']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={[styles.searchBar, styles.disabledElement]}
                >
                  <MaterialIcons name="search" size={24} color="#FFFFFF" />
                  <Text style={styles.searchInput} numberOfLines={1}>
                    Search Restaurants & foods..
                  </Text>
                </LinearGradient>
              </View>
            </View>
          </View>

          {/* Network Error Message - Exact Match with Restaurant Empty State */}
          <View style={styles.networkErrorContainer}>
            <View style={styles.iconWrapper}>
              <MaterialIcons name="wifi-off" size={48} color="rgba(0, 0, 0, 0.3)" />
            </View>
            <Text style={styles.networkErrorTitle}>No Internet Connection</Text>
            <Text style={styles.networkErrorMessage}>
              Please check your internet connection and try again.
            </Text>
          </View>
        </ScrollView>
      </SafeAreaView>
    </View>
  );
};

export const NetworkStatusScreen = React.memo(NetworkStatusScreenComponent);

const styles = StyleSheet.create({
  outerContainer: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#00B14F',
  },
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  // Header styles - Same as HomeScreen
  headerBackground: {
    width: '100%',
    paddingHorizontal: 20,
    paddingBottom: 20,
    gap: 18,
    minHeight: 240,
    backgroundColor: '#00B14F',
  },
  locationSection: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    width: '100%',
    height: 50,
  },
  locationInfo: {
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: 0,
    gap: 2,
    flex: 1,
  },
  cityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 0,
    gap: 4,
    marginLeft: -3,
  },
  arrowIconWrapper: {
    ...Platform.select({
      ios: {
        paddingTop: 2,
      },
    }),
  },
  cityName: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
    letterSpacing: 0,
  },
  addressText: {
    maxWidth: 260,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    opacity: 0.85,
  },
  profileButton: {
    width: 50,
    height: 50,
  },
  profileAvatar: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#F7F7F7',
    justifyContent: 'center',
    alignItems: 'center',
  },
  searchSection: {
    flexDirection: 'row',
    alignItems: 'center',
    width: '100%',
    height: 60,
    gap: 11,
  },
  searchBar: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    height: 60,
    borderRadius: 10,
    gap: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 20,
    color: '#FFFFFF',
    opacity: 0.9,
  },
  // Network Error Styles - Exact match with RestaurantScreen empty state
  networkErrorContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 100,
    paddingHorizontal: 40,
  },
  iconWrapper: {
    marginBottom: 0,
  },
  networkErrorTitle: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 18,
    lineHeight: 27,
    color: '#000000',
    opacity: 0.85,
    textAlign: 'center',
    marginTop: 16,
  },
  networkErrorMessage: {
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: 'rgba(0, 0, 0, 0.6)',
    opacity: 0.85,
    textAlign: 'center',
    marginTop: 8,
  },
  disabledElement: {
    opacity: 0.6,
  },
});

NetworkStatusScreen.displayName = 'NetworkStatusScreen';
