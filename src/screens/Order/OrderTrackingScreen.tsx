import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import MapView, { Marker, Polyline, PROVIDER_GOOGLE } from 'react-native-maps';
import { LinearGradient } from 'expo-linear-gradient';

interface OrderTrackingScreenProps {
  onBack?: () => void;
  onCallPartner?: () => void;
  orderId?: string;
}

export const OrderTrackingScreen: React.FC<OrderTrackingScreenProps> = ({
  onBack,
  onCallPartner,
}) => {
  // Mock data - replace with actual data
  const restaurantLocation = {
    latitude: 12.9716,
    longitude: 80.2425,
  };

  const deliveryLocation = {
    latitude: 12.9800,
    longitude: 80.2550,
  };

  const currentLocation = {
    latitude: 12.9760,
    longitude: 80.2490,
  };

  const routeCoordinates = [
    restaurantLocation,
    { latitude: 12.9740, longitude: 80.2450 },
    currentLocation,
    deliveryLocation,
  ];

  return (
    <View style={styles.container}>
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />

      {/* Map */}
      <MapView
        provider={PROVIDER_GOOGLE}
        style={styles.map}
        initialRegion={{
          latitude: 12.9750,
          longitude: 80.2490,
          latitudeDelta: 0.02,
          longitudeDelta: 0.02,
        }}
      >
        {/* Route polyline */}
        <Polyline
          coordinates={routeCoordinates}
          strokeColor="#00B14F"
          strokeWidth={6}
        />

        {/* Restaurant marker */}
        <Marker coordinate={restaurantLocation}>
          <View style={styles.restaurantMarker}>
            <MaterialIcons name="restaurant" size={20} color="#00B14F" />
          </View>
        </Marker>

        {/* Current location marker */}
        <Marker coordinate={currentLocation}>
          <View style={styles.currentLocationMarker}>
            <View style={styles.currentLocationDot} />
          </View>
        </Marker>

        {/* Delivery location marker */}
        <Marker coordinate={deliveryLocation}>
          <MaterialIcons name="location-on" size={52} color="#00B14F" />
        </Marker>
      </MapView>

      {/* Back Button */}
      <SafeAreaView style={styles.backButtonContainer} edges={['top']}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
      </SafeAreaView>

      {/* Bottom Sheet */}
      <View style={styles.bottomSheet}>
        {/* Restaurant Info */}
        <View style={styles.restaurantInfo}>
          <View style={styles.restaurantLeft}>
            <Image
              source={require('@/assets/dummy-restaurent.png')}
              style={styles.restaurantLogo}
            />
            <View style={styles.restaurantDetails}>
              <Text style={styles.restaurantName}>KFC</Text>
              <Text style={styles.restaurantLocation}>Keelkattlai | 0.5kms</Text>
              <View style={styles.orderItem}>
                <Text style={styles.orderQuantity}>1x</Text>
                <Text style={styles.orderItemName}>Chicken Roll</Text>
              </View>
            </View>
          </View>
          <LinearGradient
            colors={['rgba(255, 255, 255, 0)', 'rgba(0, 177, 79, 0.2)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.statusBadge}
          >
            <Text style={styles.statusText}>Partner is on the way</Text>
          </LinearGradient>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Estimated Delivery Time */}
        <View style={styles.timeSection}>
          <Image
            source={require('@/assets/delivery-cartoon.png')}
            style={styles.deliveryIcon}
          />
          <View style={styles.timeContent}>
            <Text style={styles.timeValue}>20 min</Text>
            <Text style={styles.timeLabel}>ESTIMATED DELIVERY TIME</Text>
          </View>
        </View>

        {/* Order Tracking Timeline */}
        <View style={styles.timeline}>
          {/* Step 1 - Completed */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconContainer}>
              <View style={[styles.timelineCircle, styles.timelineCircleActive]}>
                <MaterialIcons name="check" size={8} color="#FFFFFF" />
              </View>
              <View style={[styles.timelineLine, styles.timelineLineActive]} />
            </View>
            <Text style={[styles.timelineText, styles.timelineTextActive]}>
              Your order has been received
            </Text>
          </View>

          {/* Step 2 - In Progress */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconContainer}>
              <View style={[styles.timelineCircle, styles.timelineCircleActive]}>
                <View style={styles.loaderDot} />
              </View>
              <View style={[styles.timelineLine, styles.timelineLineInactive]} />
            </View>
            <Text style={styles.timelineText}>
              The restaurant is preparing your food
            </Text>
          </View>

          {/* Step 3 - Pending */}
          <View style={styles.timelineItem}>
            <View style={styles.timelineIconContainer}>
              <View style={[styles.timelineCircle, styles.timelineCircleInactive]}>
                <MaterialIcons name="check" size={8} color="#FFFFFF" />
              </View>
              <View style={[styles.timelineLine, styles.timelineLineInactive]} />
            </View>
            <Text style={styles.timelineText}>
              Your order has been picked up for delivery
            </Text>
          </View>

          {/* Step 4 - Pending */}
          <View style={[styles.timelineItem, { marginBottom: 0 }]}>
            <View style={styles.timelineIconContainer}>
              <View style={[styles.timelineCircle, styles.timelineCircleInactive]}>
                <MaterialIcons name="check" size={8} color="#FFFFFF" />
              </View>
            </View>
            <Text style={styles.timelineText}>Order arriving soon!</Text>
          </View>
        </View>

        {/* Divider */}
        <View style={styles.divider} />

        {/* Delivery Partner */}
        <View style={styles.partnerInfo}>
          <View style={styles.partnerLeft}>
            <Image
              source={require('@/assets/dummy-profile.png')}
              style={styles.partnerPhoto}
            />
            <View style={styles.partnerDetails}>
              <Text style={styles.partnerName}>Ananth V</Text>
              <Text style={styles.partnerRole}>Delivery Partner</Text>
            </View>
          </View>
          <TouchableOpacity
            style={styles.callButton}
            onPress={onCallPartner}
            activeOpacity={0.8}
          >
            <MaterialIcons name="phone" size={16} color="#FFFFFF" />
            <Text style={styles.callButtonText}>+91 9876543210</Text>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#E9E9E9',
  },
  map: {
    flex: 1,
  },
  restaurantMarker: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#00B14F',
  },
  currentLocationMarker: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: '#FFFFFF',
    borderWidth: 4,
    borderColor: '#001E1F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  currentLocationDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#001E1F',
  },
  backButtonContainer: {
    position: 'absolute',
    top: 0,
    left: 20,
    zIndex: 10,
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
    marginTop: 30,
  },
  bottomSheet: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 16,
    paddingTop: 12,
    gap: 12,
  },
  restaurantInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  restaurantLeft: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
  },
  restaurantLogo: {
    width: 36,
    height: 36,
    borderRadius: 8,
    backgroundColor: 'rgba(185, 185, 185, 0.2)',
  },
  restaurantDetails: {
    gap: 0,
  },
  restaurantName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
    color: '#000000',
  },
  restaurantLocation: {
    fontFamily: 'Poppins',
    fontSize: 11,
    lineHeight: 16,
    color: '#000000',
    opacity: 0.85,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  orderQuantity: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 11,
    lineHeight: 16,
    color: '#000000',
    opacity: 0.85,
  },
  orderItemName: {
    fontFamily: 'Poppins',
    fontSize: 11,
    lineHeight: 16,
    color: '#000000',
    opacity: 0.85,
  },
  statusBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    height: 26,
    justifyContent: 'center',
    borderRightWidth: 1,
    borderRightColor: '#00B14F',
  },
  statusText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 11,
    lineHeight: 16,
    color: '#00B14F',
    opacity: 0.85,
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
  },
  timeSection: {
    position: 'relative',
    paddingVertical: 4,
    alignItems: 'center',
  },
  deliveryIcon: {
    position: 'absolute',
    left: 0,
    top: '50%',
    marginTop: -40,
    width: 80,
    height: 80,
  },
  timeContent: {
    alignItems: 'center',
  },
  timeValue: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 26,
    lineHeight: 36,
    textAlign: 'center',
    color: '#000000',
  },
  timeLabel: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    textAlign: 'center',
    textTransform: 'uppercase',
    color: '#000000',
  },
  timeline: {
    gap: 0,
  },
  timelineItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 10,
    marginBottom: 0,
  },
  timelineIconContainer: {
    alignItems: 'center',
    paddingTop: 1,
  },
  timelineCircle: {
    width: 14,
    height: 14,
    borderRadius: 7,
    justifyContent: 'center',
    alignItems: 'center',
  },
  timelineCircleActive: {
    backgroundColor: '#00B14F',
  },
  timelineCircleInactive: {
    backgroundColor: '#BFBCBA',
  },
  timelineLine: {
    width: 1,
    height: 36,
    marginTop: 0,
  },
  timelineLineActive: {
    backgroundColor: '#00B14F',
  },
  timelineLineInactive: {
    backgroundColor: '#B1B1B1',
  },
  loaderDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFFFFF',
  },
  timelineText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#B1B1B1',
    flex: 1,
    marginTop: -2,
  },
  timelineTextActive: {
    color: '#00B14F',
  },
  partnerInfo: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 12,
  },
  partnerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    minWidth: 0,
  },
  partnerPhoto: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#C4C4C4',
    flexShrink: 0,
  },
  partnerDetails: {
    gap: 0,
    flex: 1,
    minWidth: 0,
  },
  partnerName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 17,
    lineHeight: 24,
    textTransform: 'capitalize',
    color: '#181C2E',
  },
  partnerRole: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#888888',
  },
  callButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    gap: 8,
    backgroundColor: '#00B14F',
    borderRadius: 50,
    shadowColor: 'rgba(0, 177, 79, 0.5)',
    shadowOffset: {
      width: 0,
      height: 6,
    },
    shadowOpacity: 1,
    shadowRadius: 20,
    elevation: 6,
    flexShrink: 0,
  },
  callButtonText: {
    fontFamily: 'Poppins',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
  },
});
