import React from 'react';
import {
  Modal,
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Pressable,
} from 'react-native';

export interface CodConfirmationModalProps {
  visible: boolean;
  /** Final payable amount in rupees (e.g. from cart summary) */
  amount: number;
  onPlaceOrder: () => void;
  onCancel: () => void;
}

const GREEN = '#00B14F';

export const CodConfirmationModal: React.FC<CodConfirmationModalProps> = ({
  visible,
  amount,
  onPlaceOrder,
  onCancel,
}) => {
  const formatted = Number.isFinite(amount) ? amount.toFixed(2) : '0.00';

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onCancel}
    >
      <Pressable style={styles.overlay} onPress={onCancel}>
        <Pressable style={styles.card} onPress={(e) => e.stopPropagation()}>
          <Text style={styles.title}>Cash on Delivery?</Text>

          <Text style={styles.body}>
            {`Ready to order? You'll pay `}
            <Text style={styles.bodyBold}>₹{formatted}</Text>
            {` in cash once your delivery arrives at your door.`}
          </Text>

          <TouchableOpacity
            style={styles.primaryButton}
            activeOpacity={0.85}
            onPress={onPlaceOrder}
          >
            <Text style={styles.primaryButtonText}>Place Order</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.secondaryButton}
            activeOpacity={0.85}
            onPress={onCancel}
          >
            <Text style={styles.secondaryButtonText}>Cancel</Text>
          </TouchableOpacity>
        </Pressable>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
  },
  card: {
    width: '100%',
    maxWidth: 400,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    paddingHorizontal: 22,
    paddingTop: 26,
    paddingBottom: 22,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#000000',
    textAlign: 'center',
    marginBottom: 14,
  },
  body: {
    fontSize: 16,
    fontWeight: '400',
    color: '#000000',
    textAlign: 'center',
    lineHeight: 24,
    marginBottom: 24,
  },
  bodyBold: {
    fontWeight: '700',
  },
  primaryButton: {
    backgroundColor: GREEN,
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  secondaryButton: {
    marginTop: 12,
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingVertical: 15,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#D1D5DB',
  },
  secondaryButtonText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#000000',
  },
});
