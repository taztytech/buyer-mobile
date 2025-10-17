import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface OrderDetailScreenProps {
  orderId?: string;
  onBack?: () => void;
  onChatWithUs?: () => void;
  onThankDriver?: () => void;
  onRateOrder?: () => void;
  onReorder?: () => void;
  onDownloadInvoice?: () => void;
}

export const OrderDetailScreen: React.FC<OrderDetailScreenProps> = ({
  orderId = '123',
  onBack,
  onChatWithUs,
  onThankDriver,
  onRateOrder,
  onReorder,
  onDownloadInvoice,
}) => {
  // Mock data - replace with actual data from API
  const orderData = {
    status: 'delivered',
    driver: {
      name: 'John Peter',
      avatar: require('@/assets/icon.png'),
    },
    restaurant: {
      name: 'KFC',
      location: 'Velachery',
      logo: require('@/assets/icon.png'),
    },
    date: 'July 05, 2025',
    total: 69,
    items: [
      { id: '1', name: 'Chicken Roll', isVeg: false },
    ],
    deliveryAddress: {
      address: 'F1, Jeyalakshmi Apartments, Chennai - 98',
      phone: '+91 87451 254869',
    },
    billSummary: {
      itemTotal: 29,
      gstAndCharges: 29,
      deliveryFee: 29,
      platformFee: 10,
      toPay: 195,
    },
    paymentMethod: 'Paid By UPI',
  };

  return (
    <View style={styles.outerContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backButton}>
          <MaterialIcons name="chevron-left" size={24} color="#000000" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Order Details</Text>
        <TouchableOpacity
          style={styles.chatButton}
          onPress={onChatWithUs}
          activeOpacity={0.7}
        >
          <MaterialIcons name="support-agent" size={20} color="#FFFFFF" />
          <Text style={styles.chatButtonText}>Chat with us</Text>
        </TouchableOpacity>
      </View>

      <SafeAreaView style={styles.container} edges={['bottom']}>
        <ScrollView
          style={styles.scrollView}
          contentContainerStyle={styles.scrollContent}
          showsVerticalScrollIndicator={false}
        >
          {/* Delivery Status Card */}
          <View style={styles.card}>
            <Text style={styles.statusTitle}>Your order was delivered!</Text>

            {/* Driver Info */}
            <View style={styles.driverSection}>
              <Image source={orderData.driver.avatar} style={styles.driverAvatar} />
              <View style={styles.driverInfo}>
                <Text style={styles.driverName}>{orderData.driver.name}</Text>
                <Text style={styles.driverLabel}>Your delivery driver</Text>
              </View>
            </View>

            {/* Thank Driver Button */}
            <TouchableOpacity
              style={styles.thankButton}
              onPress={onThankDriver}
              activeOpacity={0.8}
            >
              <MaterialIcons name="thumb-up" size={20} color="#FFFFFF" />
              <Text style={styles.thankButtonText}>Thank Driver</Text>
            </TouchableOpacity>
          </View>

          {/* Order Info Card */}
          <View style={styles.card}>
            <View style={styles.orderHeader}>
              <View style={styles.restaurantInfo}>
                <Image source={orderData.restaurant.logo} style={styles.restaurantLogo} />
                <View style={styles.restaurantDetails}>
                  <Text style={styles.restaurantName}>{orderData.restaurant.name}</Text>
                  <Text style={styles.restaurantLocation}>{orderData.restaurant.location}</Text>
                  {orderData.items.map((item) => (
                    <View key={item.id} style={styles.itemRow}>
                      <View style={styles.vegIndicator}>
                        <View style={styles.vegDot} />
                      </View>
                      <Text style={styles.itemName}>{item.name}</Text>
                    </View>
                  ))}
                </View>
              </View>
              <View style={styles.orderMeta}>
                <Text style={styles.orderDate}>{orderData.date}</Text>
                <Text style={styles.orderAmount}>₹{orderData.total}</Text>
              </View>
            </View>

            {/* Action Buttons */}
            <View style={styles.actionButtons}>
              <TouchableOpacity
                style={styles.rateButton}
                onPress={onRateOrder}
                activeOpacity={0.7}
              >
                <MaterialIcons name="star-outline" size={20} color="#001E1F" />
                <Text style={styles.rateButtonText}>Rate Order</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.reorderButton}
                onPress={onReorder}
                activeOpacity={0.8}
              >
                <MaterialIcons name="refresh" size={20} color="#FFFFFF" />
                <Text style={styles.reorderButtonText}>Reorder</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Delivery Address Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Delivery Address</Text>
            <View style={styles.addressRow}>
              <MaterialIcons name="location-on" size={24} color="#00B14F" />
              <Text style={styles.addressText}>{orderData.deliveryAddress.address}</Text>
            </View>
            <View style={styles.dashedDivider} />
            <View style={styles.addressRow}>
              <MaterialIcons name="phone" size={24} color="#00B14F" />
              <Text style={styles.addressText}>{orderData.deliveryAddress.phone}</Text>
            </View>
          </View>

          {/* Bill Summary Card */}
          <View style={styles.card}>
            <View style={styles.billHeader}>
              <Text style={styles.sectionTitle}>Bill Summary</Text>
              <TouchableOpacity
                style={styles.invoiceButton}
                onPress={onDownloadInvoice}
                activeOpacity={0.7}
              >
                <MaterialIcons name="download" size={18} color="#00B14F" />
                <Text style={styles.invoiceButtonText}>Invoice</Text>
              </TouchableOpacity>
            </View>

            <View style={styles.billItems}>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Item Total</Text>
                <Text style={styles.billValue}>₹{orderData.billSummary.itemTotal}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>GST and Restaurant Charges</Text>
                <Text style={styles.billValue}>₹{orderData.billSummary.gstAndCharges}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Delivery Partner Fee</Text>
                <Text style={styles.billValue}>₹{orderData.billSummary.deliveryFee}</Text>
              </View>
              <View style={styles.billRow}>
                <Text style={styles.billLabel}>Platform Fee</Text>
                <Text style={styles.billValue}>₹{orderData.billSummary.platformFee}</Text>
              </View>
            </View>

            <View style={styles.dashedDivider} />

            <View style={styles.totalRow}>
              <Text style={styles.totalLabel}>To Pay</Text>
              <Text style={styles.totalValue}>₹{orderData.billSummary.toPay}</Text>
            </View>
          </View>

          {/* Payment Method Card */}
          <View style={styles.card}>
            <Text style={styles.sectionTitle}>Payment Method</Text>
            <View style={styles.paymentRow}>
              <View style={styles.paymentIcon}>
                <MaterialIcons name="account-balance-wallet" size={24} color="#00B14F" />
              </View>
              <Text style={styles.paymentText}>{orderData.paymentMethod}</Text>
            </View>
          </View>
        </ScrollView>
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
    backgroundColor: '#F3F4F6',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
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
    flex: 1,
    marginLeft: 8,
  },
  chatButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chatButtonText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 21,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    padding: 20,
    gap: 14,
    paddingBottom: 24,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    padding: 20,
  },
  statusTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#001E1F',
    lineHeight: 30,
    textAlign: 'center',
    marginBottom: 16,
  },
  driverSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    gap: 16,
  },
  driverAvatar: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    borderColor: '#00B14F',
  },
  driverInfo: {
    alignItems: 'flex-start',
  },
  driverName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  driverLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  thankButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    backgroundColor: '#00B14F',
    borderRadius: 8,
    gap: 8,
  },
  thankButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
    lineHeight: 24,
  },
  orderHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  restaurantInfo: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    flex: 1,
  },
  restaurantLogo: {
    width: 48,
    height: 48,
    borderRadius: 8,
    marginRight: 12,
  },
  restaurantDetails: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  restaurantLocation: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
    marginBottom: 4,
  },
  itemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  vegIndicator: {
    width: 16,
    height: 16,
    borderWidth: 1.5,
    borderColor: '#00B14F',
    borderRadius: 2,
    justifyContent: 'center',
    alignItems: 'center',
  },
  vegDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#00B14F',
  },
  itemName: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  orderMeta: {
    alignItems: 'flex-end',
  },
  orderDate: {
    fontFamily: 'Poppins',
    fontSize: 12,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 18,
  },
  orderAmount: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  actionButtons: {
    flexDirection: 'row',
    gap: 16,
  },
  rateButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.2)',
    backgroundColor: '#F3F4F6',
    gap: 8,
  },
  rateButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
  },
  reorderButton: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    borderRadius: 8,
    backgroundColor: '#00B14F',
    gap: 8,
  },
  reorderButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#FFFFFF',
    lineHeight: 21,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
    marginBottom: 12,
  },
  addressRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
    marginBottom: 12,
  },
  addressText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#001E1F',
    lineHeight: 21,
    flex: 1,
  },
  dashedDivider: {
    height: 1,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  billHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  invoiceButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  invoiceButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    color: '#00B14F',
    lineHeight: 21,
  },
  billItems: {
    gap: 12,
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  billLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  billValue: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: 'rgba(0, 30, 31, 0.6)',
    lineHeight: 21,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  totalLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  totalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    color: '#001E1F',
    lineHeight: 27,
  },
  paymentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  paymentIcon: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 16,
    color: '#001E1F',
    lineHeight: 24,
  },
});
