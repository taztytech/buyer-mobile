import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  TextInput,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { analyticsService } from '@/services/analytics.service';
import { AnalyticsScreens, AnalyticsEvents } from '@/services/analytics.service';

interface PaymentModalProps {
  visible: boolean;
  onClose: () => void;
  selectedPayment?: string;
  onSelectPayment: (paymentMethod: string) => void;
}

export const PaymentModal: React.FC<PaymentModalProps> = ({
  visible,
  onClose,
  selectedPayment = 'pay_on_delivery',
  onSelectPayment,
}) => {
  const slideAnim = useRef(new Animated.Value(1000)).current;
  const [upiId, setUpiId] = useState('ranjith@okaxis');
  const [selectedMethod, setSelectedMethod] = useState(selectedPayment);

  useEffect(() => {
    if (visible) {
      // Track payment screen view when modal opens
      analyticsService.logScreenView(AnalyticsScreens.PAYMENT);
      
      // Track payment start event
      analyticsService.logEvent(AnalyticsEvents.PAYMENT_START, {
        payment_method: selectedPayment,
      });

      Animated.spring(slideAnim, {
        toValue: 0,
        useNativeDriver: true,
        tension: 65,
        friction: 11,
      }).start();
    } else {
      slideAnim.setValue(1000);
    }
  }, [visible, selectedPayment]);

  const handleSelectPayment = (method: string) => {
    setSelectedMethod(method);
    onSelectPayment(method);
    
    // Track payment method selection
    analyticsService.logEvent(AnalyticsEvents.PAYMENT_START, {
      payment_method: method,
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent={true}
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <Animated.View
          style={[
            styles.modalContainer,
            {
              transform: [{ translateY: slideAnim }],
            },
          ]}
        >
          <TouchableOpacity
            activeOpacity={1}
            onPress={(e) => e.stopPropagation()}
          >
            {/* Header */}
            <View style={styles.header}>
              <Text style={styles.title}>Choose Payment Method</Text>
              <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                <MaterialIcons name="close" size={16} color="#000000" />
              </TouchableOpacity>
            </View>

            {/* Payment Options */}
            <View style={styles.optionsContainer}>
              {/* Online Payment */}
              <TouchableOpacity
                style={styles.paymentOption}
                onPress={() => handleSelectPayment('online')}
                activeOpacity={0.7}
              >
                <View style={styles.paymentLeft}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="credit-card" size={20} color="#000000" />
                  </View>
                  <Text style={styles.paymentText}>Online Payment</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedMethod === 'online' && styles.radioButtonSelected
                ]}>
                  {selectedMethod === 'online' && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </TouchableOpacity>

              {/* Pay on Delivery */}
              <TouchableOpacity
                style={styles.paymentOption}
                onPress={() => handleSelectPayment('pay_on_delivery')}
                activeOpacity={0.7}
              >
                <View style={styles.paymentLeft}>
                  <View style={styles.iconContainer}>
                    <MaterialIcons name="delivery-dining" size={24} color="#000000" />
                  </View>
                  <Text style={styles.paymentText}>Pay on Delivery</Text>
                </View>
                <View style={[
                  styles.radioButton,
                  selectedMethod === 'pay_on_delivery' && styles.radioButtonSelected
                ]}>
                  {selectedMethod === 'pay_on_delivery' && (
                    <View style={styles.radioButtonInner} />
                  )}
                </View>
              </TouchableOpacity>

              {/* UPI Payment Option (when online is selected) */}
              {selectedMethod === 'online' && (
                <View style={styles.upiContainer}>
                  <View style={styles.upiHeader}>
                    <View style={styles.upiIconContainer}>
                      <MaterialIcons name="payment" size={16} color="#000000" />
                    </View>
                    <Text style={styles.upiText}>Pay using UPI ID</Text>
                  </View>
                  <View style={styles.upiInputContainer}>
                    <TextInput
                      style={styles.upiInput}
                      value={upiId}
                      onChangeText={setUpiId}
                      placeholder="Enter UPI ID"
                      placeholderTextColor="rgba(0, 0, 0, 0.3)"
                    />
                    <MaterialIcons name="check-circle" size={20} color="#00B14F" />
                  </View>
                </View>
              )}
            </View>
          </TouchableOpacity>
        </Animated.View>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    padding: 20,
    paddingBottom: 30,
    minHeight: 400,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    width: '100%',
    height: 30,
    marginBottom: 30,
  },
  title: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 20,
    lineHeight: 30,
    color: '#000000',
    flex: 1,
  },
  closeButton: {
    width: 16,
    height: 16,
    justifyContent: 'center',
    alignItems: 'center',
  },
  optionsContainer: {
    gap: 20,
  },
  paymentOption: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: 10,
    height: 60,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
  },
  paymentLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  iconContainer: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paymentText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
  },
  radioButton: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    borderColor: '#D9D9D9',
    justifyContent: 'center',
    alignItems: 'center',
  },
  radioButtonSelected: {
    borderColor: '#00B14F',
  },
  radioButtonInner: {
    width: 10,
    height: 10,
    borderRadius: 5,
    backgroundColor: '#00B14F',
  },
  upiContainer: {
    padding: 10,
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.1)',
    borderRadius: 10,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 2,
    marginTop: 5,
  },
  upiHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 40,
  },
  upiIconContainer: {
    width: 40,
    height: 40,
    borderWidth: 1,
    borderColor: 'rgba(0, 0, 0, 0.25)',
    borderRadius: 13,
    justifyContent: 'center',
    alignItems: 'center',
  },
  upiText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    lineHeight: 20,
    color: '#000000',
    opacity: 0.85,
  },
  upiInputContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 19,
    height: 60,
    backgroundColor: 'rgba(0, 0, 0, 0.05)',
    borderWidth: 1,
    borderColor: '#E0E0E0',
    borderRadius: 10,
  },
  upiInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
});
