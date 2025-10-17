import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  TextInput,
  StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';

interface OrderDetailsScreenProps {
  restaurantName?: string;
  deliveryAddress?: string;
  onBack?: () => void;
}

export const OrderDetailsScreen: React.FC<OrderDetailsScreenProps> = ({
  restaurantName = 'KFC',
  deliveryAddress = 'Chennai | F1, Jeyalakshmi Appartments...',
  onBack,
}) => {
  const [orderExpanded, setOrderExpanded] = useState(true);
  const [deliveryExpanded, setDeliveryExpanded] = useState(true);
  const [tipExpanded, setTipExpanded] = useState(true);
  const [promoExpanded, setPromoExpanded] = useState(true);
  const [billExpanded, setBillExpanded] = useState(true);
  const [cancellationExpanded, setCancellationExpanded] = useState(true);

  const [quantity, setQuantity] = useState(1);
  const [selectedTip, setSelectedTip] = useState<number | null>(null);
  const [selfPickup, setSelfPickup] = useState(false);
  const [notes, setNotes] = useState('');
  const [promoCode, setPromoCode] = useState('');

  const handleIncrement = () => setQuantity(prev => prev + 1);
  const handleDecrement = () => {
    if (quantity > 1) setQuantity(prev => prev - 1);
  };

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="#00B14F" />

      {/* Header */}
      <View style={styles.header}>
        <SafeAreaView edges={['top']} style={styles.headerSafeArea}>
          <View style={styles.headerContent}>
            <TouchableOpacity onPress={onBack} style={styles.backButton}>
              <MaterialIcons name="arrow-back" size={24} color="#FFFFFF" />
            </TouchableOpacity>
            <View style={styles.headerTextContainer}>
              <Text style={styles.restaurantName}>{restaurantName}</Text>
              <TouchableOpacity style={styles.addressContainer}>
                <MaterialIcons name="location-on" size={14} color="#FFFFFF" />
                <Text style={styles.addressText} numberOfLines={1}>
                  {deliveryAddress}
                </Text>
                <MaterialIcons name="expand-more" size={16} color="#FFFFFF" />
              </TouchableOpacity>
            </View>
          </View>
        </SafeAreaView>
      </View>

      {/* Main Content */}
      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        <View style={styles.content}>

          {/* Your Order Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setOrderExpanded(!orderExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Your Order</Text>
              <MaterialIcons
                name={orderExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color="#000000"
              />
            </TouchableOpacity>

            {orderExpanded && (
              <View style={styles.sectionContent}>
                {/* Order Item */}
                <View style={styles.orderItem}>
                  <Image
                    source={require('@/assets/biriyani.png')}
                    style={styles.orderItemImage}
                  />
                  <View style={styles.orderItemDetails}>
                    <Text style={styles.orderItemName}>Chicken Roll</Text>
                    <Text style={styles.orderItemAddOns}>
                      Add Ons: Extra Dip, Extra Ma...{' '}
                      <Text style={styles.orderItemMore}>+1 More</Text>
                    </Text>
                  </View>
                  <View style={styles.quantityControl}>
                    <TouchableOpacity onPress={handleDecrement} activeOpacity={0.7}>
                      <Text style={styles.quantityButton}>-</Text>
                    </TouchableOpacity>
                    <Text style={styles.quantityText}>{quantity}</Text>
                    <TouchableOpacity onPress={handleIncrement} activeOpacity={0.7}>
                      <Text style={styles.quantityButton}>+</Text>
                    </TouchableOpacity>
                  </View>
                  <View style={styles.priceContainer}>
                    <Text style={styles.originalPrice}>₹69</Text>
                    <Text style={styles.finalPrice}>₹69</Text>
                  </View>
                </View>

                {/* Add More Items Button */}
                <TouchableOpacity style={styles.addMoreButton} activeOpacity={0.7}>
                  <Text style={styles.addMoreButtonText}>+ Add More Items</Text>
                </TouchableOpacity>

                {/* Notes */}
                <View style={styles.notesContainer}>
                  <Text style={styles.notesLabel}>Notes</Text>
                  <TextInput
                    style={styles.notesInput}
                    placeholder="I need more spicy and tasty"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    value={notes}
                    onChangeText={setNotes}
                    multiline
                  />
                </View>
              </View>
            )}
          </View>

          {/* Delivery Details Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setDeliveryExpanded(!deliveryExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Delivery Details</Text>
              <MaterialIcons
                name={deliveryExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color="#000000"
              />
            </TouchableOpacity>

            {deliveryExpanded && (
              <View style={styles.sectionContent}>
                {/* Delivery At */}
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Delivery At</Text>
                  <TouchableOpacity style={styles.deliveryAtBox} activeOpacity={0.7}>
                    <View style={styles.deliveryAtContent}>
                      <MaterialIcons name="location-on" size={20} color="#00B14F" />
                      <Text style={styles.deliveryAtText} numberOfLines={1}>
                        {deliveryAddress}
                      </Text>
                    </View>
                    <MaterialIcons name="expand-more" size={20} color="rgba(0, 0, 0, 0.5)" />
                  </TouchableOpacity>
                </View>

                {/* Delivery Option */}
                <View style={styles.subsection}>
                  <Text style={styles.subsectionTitle}>Delivery Option</Text>
                  <View style={styles.deliveryOptionBox}>
                    <View style={styles.deliveryOptionContent}>
                      <Text style={styles.deliveryOptionTitle}>Self Pickup</Text>
                      <Text style={styles.deliveryOptionSubtitle}>
                        Delivery fee will be reduced
                      </Text>
                    </View>
                    <TouchableOpacity
                      style={[
                        styles.toggle,
                        selfPickup && styles.toggleActive,
                      ]}
                      onPress={() => setSelfPickup(!selfPickup)}
                      activeOpacity={0.7}
                    >
                      <View
                        style={[
                          styles.toggleCircle,
                          selfPickup && styles.toggleCircleActive,
                        ]}
                      />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* Delivery Time */}
                <View style={styles.deliveryTimeBox}>
                  <MaterialIcons name="access-time" size={20} color="#00B14F" />
                  <Text style={styles.deliveryTimeText}>
                    Delivery in <Text style={styles.deliveryTimeBold}>15 - 20 mins</Text>
                  </Text>
                </View>
              </View>
            )}
          </View>

          {/* Tip Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setTipExpanded(!tipExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Tip for your delivery partner</Text>
              <MaterialIcons
                name={tipExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color="#000000"
              />
            </TouchableOpacity>

            {tipExpanded && (
              <View style={styles.sectionContent}>
                <View style={styles.tipButtons}>
                  {[10, 20, 30].map((amount) => (
                    <TouchableOpacity
                      key={amount}
                      style={[
                        styles.tipButton,
                        selectedTip === amount && styles.tipButtonSelected,
                      ]}
                      onPress={() => setSelectedTip(selectedTip === amount ? null : amount)}
                      activeOpacity={0.7}
                    >
                      <Text
                        style={[
                          styles.tipButtonText,
                          selectedTip === amount && styles.tipButtonTextSelected,
                        ]}
                      >
                        ₹{amount}
                      </Text>
                    </TouchableOpacity>
                  ))}
                  <TouchableOpacity
                    style={[
                      styles.tipButton,
                      selectedTip === -1 && styles.tipButtonSelected,
                    ]}
                    onPress={() => setSelectedTip(selectedTip === -1 ? null : -1)}
                    activeOpacity={0.7}
                  >
                    <Text
                      style={[
                        styles.tipButtonText,
                        selectedTip === -1 && styles.tipButtonTextSelected,
                      ]}
                    >
                      Other
                    </Text>
                  </TouchableOpacity>
                </View>
                <Text style={styles.tipInfo}>
                  100% of the tip will go to your delivery partner.
                </Text>
              </View>
            )}
          </View>

          {/* Apply Promo Code Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setPromoExpanded(!promoExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Apply Promo Code</Text>
              <MaterialIcons
                name={promoExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color="#000000"
              />
            </TouchableOpacity>

            {promoExpanded && (
              <View style={styles.sectionContent}>
                <View style={styles.promoCodeContainer}>
                  <TextInput
                    style={styles.promoCodeInput}
                    placeholder="Enter promo code"
                    placeholderTextColor="rgba(0, 0, 0, 0.4)"
                    value={promoCode}
                    onChangeText={setPromoCode}
                  />
                  <TouchableOpacity style={styles.applyButton} activeOpacity={0.8}>
                    <Text style={styles.applyButtonText}>APPLY</Text>
                  </TouchableOpacity>
                </View>
              </View>
            )}
          </View>

          {/* Bill Details Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setBillExpanded(!billExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Bill Details</Text>
              <MaterialIcons
                name={billExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color="#000000"
              />
            </TouchableOpacity>

            {billExpanded && (
              <View style={styles.sectionContent}>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Item Total</Text>
                  <Text style={styles.billValue}>₹69</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>GST and Restaurant Charges</Text>
                  <Text style={styles.billValue}>₹29</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Delivery Partner Fee</Text>
                  <Text style={styles.billValue}>₹29</Text>
                </View>
                <View style={styles.billRow}>
                  <Text style={styles.billLabel}>Platform Fee</Text>
                  <Text style={styles.billValue}>₹10</Text>
                </View>
                <View style={styles.billDivider} />
                <View style={styles.billTotalRow}>
                  <Text style={styles.billTotalLabel}>To Pay</Text>
                  <Text style={styles.billTotalValue}>₹195</Text>
                </View>
              </View>
            )}
          </View>

          {/* Cancellation Policy Section */}
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.sectionHeader}
              onPress={() => setCancellationExpanded(!cancellationExpanded)}
              activeOpacity={0.7}
            >
              <Text style={styles.sectionTitle}>Cancellation Policy</Text>
              <MaterialIcons
                name={cancellationExpanded ? 'expand-less' : 'expand-more'}
                size={24}
                color="#000000"
              />
            </TouchableOpacity>

            {cancellationExpanded && (
              <View style={styles.sectionContent}>
                <Text style={styles.cancellationText}>
                  Help us reduce food waste by avoiding cancellation after placing your
                  order. A 100% cancellation fee will be applied.
                </Text>
              </View>
            )}
          </View>

          {/* Add bottom padding for footer */}
          <View style={styles.bottomPadding} />
        </View>
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <SafeAreaView edges={['bottom']} style={styles.footerSafeArea}>
          <View style={styles.footerContent}>
            <TouchableOpacity style={styles.paymentSelector} activeOpacity={0.7}>
              <View style={styles.paymentSelectorContent}>
                <MaterialIcons name="account-balance-wallet" size={20} color="#00B14F" />
                <Text style={styles.paymentSelectorText}>Pay on Delivery</Text>
              </View>
              <MaterialIcons name="expand-more" size={20} color="rgba(0, 0, 0, 0.5)" />
            </TouchableOpacity>

            <TouchableOpacity style={styles.placeOrderButton} activeOpacity={0.8}>
              <Text style={styles.placeOrderButtonText}>Place Order</Text>
              <MaterialIcons name="arrow-forward" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </SafeAreaView>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#00B14F',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 4,
  },
  headerSafeArea: {
    backgroundColor: '#00B14F',
  },
  headerContent: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backButton: {
    marginRight: 12,
  },
  headerTextContainer: {
    flex: 1,
  },
  restaurantName: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    lineHeight: 30,
    color: '#FFFFFF',
  },
  addressContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 2,
  },
  addressText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#FFFFFF',
    marginLeft: 4,
    marginRight: 2,
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: 16,
  },
  section: {
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    marginBottom: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 16,
  },
  sectionTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
    flex: 1,
  },
  sectionContent: {
    paddingHorizontal: 16,
    paddingBottom: 16,
  },
  orderItem: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 16,
  },
  orderItemImage: {
    width: 64,
    height: 64,
    borderRadius: 12,
    marginRight: 12,
  },
  orderItemDetails: {
    flex: 1,
    marginRight: 12,
  },
  orderItemName: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    marginBottom: 2,
  },
  orderItemAddOns: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  orderItemMore: {
    color: '#00B14F',
    fontFamily: 'Poppins_500Medium',
  },
  quantityControl: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    marginRight: 12,
    minWidth: 70,
  },
  quantityButton: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  quantityText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    marginHorizontal: 8,
  },
  priceContainer: {
    alignItems: 'flex-end',
  },
  originalPrice: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.5)',
    textDecorationLine: 'line-through',
  },
  finalPrice: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#000000',
  },
  addMoreButton: {
    borderWidth: 2,
    borderColor: '#00B14F',
    borderStyle: 'dashed',
    borderRadius: 12,
    paddingVertical: 12,
    alignItems: 'center',
    marginBottom: 16,
  },
  addMoreButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 21,
    color: '#00B14F',
  },
  notesContainer: {
    marginTop: 4,
  },
  notesLabel: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: 8,
  },
  notesInput: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    minHeight: 50,
  },
  subsection: {
    marginBottom: 16,
  },
  subsectionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    marginBottom: 8,
  },
  deliveryAtBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  deliveryAtContent: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    marginRight: 8,
  },
  deliveryAtText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    marginLeft: 8,
    flex: 1,
  },
  deliveryOptionBox: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  deliveryOptionContent: {
    flex: 1,
  },
  deliveryOptionTitle: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  deliveryOptionSubtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#00B14F',
    marginTop: 2,
  },
  toggle: {
    width: 40,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.15)',
    padding: 2,
    justifyContent: 'center',
  },
  toggleActive: {
    backgroundColor: '#00B14F',
  },
  toggleCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  toggleCircleActive: {
    alignSelf: 'flex-end',
  },
  deliveryTimeBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
  },
  deliveryTimeText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    marginLeft: 8,
  },
  deliveryTimeBold: {
    fontFamily: 'Poppins_700Bold',
  },
  tipButtons: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  tipButton: {
    flex: 1,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.15)',
    borderRadius: 8,
    paddingVertical: 10,
    paddingHorizontal: 8,
    alignItems: 'center',
    marginHorizontal: 4,
    backgroundColor: '#FFFFFF',
  },
  tipButtonSelected: {
    backgroundColor: '#00B14F',
    borderColor: '#00B14F',
  },
  tipButtonText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  tipButtonTextSelected: {
    color: '#FFFFFF',
    fontFamily: 'Poppins_600SemiBold',
  },
  tipInfo: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11,
    lineHeight: 16,
    color: 'rgba(0, 0, 0, 0.5)',
    textAlign: 'center',
  },
  promoCodeContainer: {
    flexDirection: 'row',
  },
  promoCodeInput: {
    flex: 1,
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderTopLeftRadius: 8,
    borderBottomLeftRadius: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  applyButton: {
    backgroundColor: '#00B14F',
    borderTopRightRadius: 8,
    borderBottomRightRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
  },
  billRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 12,
  },
  billLabel: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  billValue: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
  },
  billDivider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.1)',
    marginVertical: 12,
  },
  billTotalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  billTotalLabel: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  billTotalValue: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 16,
    lineHeight: 24,
    color: '#00B14F',
  },
  cancellationText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    lineHeight: 18,
    color: 'rgba(0, 0, 0, 0.6)',
  },
  bottomPadding: {
    height: 20,
  },
  footer: {
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: 'rgba(0, 0, 0, 0.1)',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 8,
  },
  footerSafeArea: {
    backgroundColor: '#FFFFFF',
  },
  footerContent: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 12,
    alignItems: 'center',
  },
  paymentSelector: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginRight: 12,
  },
  paymentSelectorContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  paymentSelectorText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    marginLeft: 8,
  },
  placeOrderButton: {
    flexDirection: 'row',
    backgroundColor: '#00B14F',
    borderRadius: 8,
    paddingHorizontal: 20,
    paddingVertical: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  placeOrderButtonText: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    marginRight: 8,
  },
});
