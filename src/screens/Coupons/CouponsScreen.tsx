import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { CouponAppliedModal } from '@/components/CouponAppliedModal';

type Coupon = {
  code: string;
  title: string;
  description: string;
  enabled: boolean;
};

type CouponsScreenProps = {
  visible: boolean;
  onBack: () => void;
  onAppliedAndClose: () => void;
};

const ENABLED_COUPONS: Coupon[] = [
  {
    code: 'WELCOME50',
    title: '50% off on your first order',
    description: 'Maximum discount up to ₹100. Valid on orders above ₹200.',
    enabled: true,
  },
  {
    code: 'FESTIVE20',
    title: '20% off on your next order',
    description: 'Valid for all users on orders above ₹150.',
    enabled: true,
  },
  {
    code: 'SAVER10',
    title: 'Flat ₹10 off',
    description: 'Get instant discount on any order above ₹99.',
    enabled: true,
  },
];

const EXPIRED_COUPONS: Coupon[] = [
  {
    code: 'FREEDEL',
    title: 'Free delivery on weekends',
    description: 'Expired on 15th October 2023',
    enabled: false,
  },
  {
    code: 'CASHBACK30',
    title: '₹30 Cashback on UPI',
    description: 'Offer ended due to high demand.',
    enabled: false,
  },
];

export const CouponsScreen: React.FC<CouponsScreenProps> = ({ visible, onBack, onAppliedAndClose }) => {
  const [appliedVisible, setAppliedVisible] = React.useState(false);
  const [confettiKey, setConfettiKey] = React.useState(0);

  const handleApply = (coupon: Coupon) => {
    if (!coupon.enabled) return;
    // Increment first so modal+confetti render in same commit (no effect-delay)
    setConfettiKey((k) => k + 1);
    setAppliedVisible(true);
  };

  const handleOk = () => {
    setAppliedVisible(false);
    // Ensure the popup is gone before navigating back to cart/checkout
    setTimeout(() => {
      onAppliedAndClose();
    }, 0);
  };

  return (
    <View style={styles.container} pointerEvents={visible ? 'auto' : 'none'}>
      {/* Background animation is now rendered inside the applied modal backdrop */}

      <SafeAreaView edges={['top']} style={styles.safeHeader}>
        <View style={styles.header}>
          <TouchableOpacity onPress={onBack} style={styles.backButton} activeOpacity={0.8}>
            <MaterialIcons name="chevron-left" size={26} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Coupons</Text>
          <View style={styles.headerRightSpacer} />
        </View>
      </SafeAreaView>

      <ScrollView contentContainerStyle={styles.scrollContent} showsVerticalScrollIndicator={false}>
        {ENABLED_COUPONS.map((coupon) => (
          <View key={coupon.code} style={styles.couponCard}>
            <View style={styles.couponLeft}>
              <View style={styles.codePill}>
                <Text style={styles.codePillText}>{coupon.code}</Text>
              </View>
              <Text style={styles.couponTitle}>{coupon.title}</Text>
              <Text style={styles.couponDesc}>{coupon.description}</Text>
            </View>
            <TouchableOpacity
              style={[styles.applyButton, !coupon.enabled && styles.applyButtonDisabled]}
              activeOpacity={0.85}
              onPress={() => handleApply(coupon)}
              disabled={!coupon.enabled}
            >
              <Text style={[styles.applyButtonText, !coupon.enabled && styles.applyButtonTextDisabled]}>
                Apply
              </Text>
            </TouchableOpacity>
          </View>
        ))}

        <Text style={styles.expiredLabel}>EXPIRED COUPONS</Text>

        {EXPIRED_COUPONS.map((coupon) => (
          <View key={coupon.code} style={[styles.couponCard, styles.couponCardExpired]}>
            <View style={styles.couponLeft}>
              <View style={[styles.codePill, styles.codePillExpired]}>
                <Text style={[styles.codePillText, styles.codePillTextExpired]}>{coupon.code}</Text>
              </View>
              <Text style={[styles.couponTitle, styles.couponTitleExpired]}>{coupon.title}</Text>
              <Text style={[styles.couponDesc, styles.couponDescExpired]}>{coupon.description}</Text>
            </View>
            <View style={[styles.applyButton, styles.applyButtonDisabled]}>
              <Text style={[styles.applyButtonText, styles.applyButtonTextDisabled]}>Apply</Text>
            </View>
          </View>
        ))}

        <Text style={styles.footerHint}>Check back later for more exciting offers!</Text>
      </ScrollView>

      <CouponAppliedModal
        visible={appliedVisible}
        confettiKey={confettiKey}
        onClose={handleOk}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F3F4F6',
  },
  safeHeader: {
    backgroundColor: '#00B14F',
  },
  header: {
    height: 56,
    backgroundColor: '#00B14F',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    flex: 1,
    textAlign: 'left',
    color: '#FFFFFF',
    fontFamily: 'Poppins_700Bold',
    fontSize: 18,
    lineHeight: 24,
  },
  headerRightSpacer: {
    width: 40,
  },
  scrollContent: {
    paddingTop: 14,
    paddingHorizontal: 14,
    paddingBottom: 28,
  },
  couponCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 14,
    marginBottom: 14,
    flexDirection: 'row',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 10,
    elevation: 2,
  },
  couponCardExpired: {
    backgroundColor: '#F5F5F5',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    shadowOpacity: 0,
    elevation: 0,
  },
  couponLeft: {
    flex: 1,
    paddingRight: 12,
  },
  codePill: {
    alignSelf: 'flex-start',
    backgroundColor: '#E9F7EF',
    borderRadius: 8,
    paddingHorizontal: 10,
    paddingVertical: 6,
    marginBottom: 8,
  },
  codePillText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 16,
    color: '#00B14F',
    letterSpacing: 0.6,
  },
  codePillExpired: {
    backgroundColor: '#EFEFEF',
  },
  codePillTextExpired: {
    color: '#9CA3AF',
  },
  couponTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#111827',
    marginBottom: 4,
  },
  couponTitleExpired: {
    color: '#9CA3AF',
  },
  couponDesc: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#6B7280',
  },
  couponDescExpired: {
    color: '#C4C4C4',
  },
  applyButton: {
    height: 38,
    paddingHorizontal: 18,
    borderRadius: 12,
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  applyButtonDisabled: {
    backgroundColor: '#E5E7EB',
  },
  applyButtonText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 13,
    lineHeight: 18,
    color: '#FFFFFF',
  },
  applyButtonTextDisabled: {
    color: '#9CA3AF',
  },
  expiredLabel: {
    marginTop: 10,
    marginBottom: 10,
    textAlign: 'left',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 12,
    lineHeight: 18,
    letterSpacing: 2,
    color: '#9CA3AF',
  },
  footerHint: {
    marginTop: 16,
    textAlign: 'center',
    fontFamily: 'Poppins_400Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#9CA3AF',
  },
});

