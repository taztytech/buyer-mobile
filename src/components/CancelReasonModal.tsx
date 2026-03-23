/**
 * CancelReasonModal - Reusable modal for selecting cancellation reason
 * Same flow as Help section: show reason selection, on submit call cancel API
 */

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { colors } from '@/theme/colors';
import { ordersService, CancelReason } from '@/services/orders.service';

interface CancelReasonModalProps {
  visible: boolean;
  orderNumber: string;
  onClose: () => void;
  onSuccess: () => void;
  onError?: (message: string) => void;
  /** Remaining seconds for cancellation - shown on confirm button when > 0 */
  cancelSecondsLeft?: number;
}

export const CancelReasonModal: React.FC<CancelReasonModalProps> = ({
  visible,
  orderNumber,
  onClose,
  onSuccess,
  onError,
  cancelSecondsLeft = 0,
}) => {
  const [cancelReasons, setCancelReasons] = useState<CancelReason[]>([]);
  const [selectedReason, setSelectedReason] = useState<CancelReason | null>(null);
  const [manualReason, setManualReason] = useState('');
  const [showDropdown, setShowDropdown] = useState(false);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (visible && cancelReasons.length === 0) {
      setLoading(true);
      ordersService
        .getCancelReasons()
        .then((res) => {
          if (res.success && res.data) {
            setCancelReasons(res.data);
          } else {
            onError?.(res.error || 'Failed to load cancel reasons');
          }
        })
        .catch(() => {
          onError?.('Failed to load cancel reasons');
        })
        .finally(() => setLoading(false));
    }
  }, [visible, cancelReasons.length, onError]);

  useEffect(() => {
    if (!visible) {
      setSelectedReason(null);
      setManualReason('');
      setShowDropdown(false);
    }
  }, [visible]);

  // Close modal when cancellation duration finishes (time ran out)
  useEffect(() => {
    if (visible && cancelSecondsLeft <= 0) {
      onClose();
    }
  }, [visible, cancelSecondsLeft, onClose]);

  const isOtherReason =
    selectedReason?.code?.toLowerCase().includes('other') ||
    selectedReason?.reason?.toLowerCase().includes('other');

  const canSubmit =
    selectedReason &&
    (!isOtherReason || manualReason.trim().length > 0);

  const handleSubmit = async () => {
    if (!canSubmit || !orderNumber) return;

    setSubmitting(true);
    try {
      const finalReason =
        isOtherReason && manualReason.trim()
          ? manualReason.trim()
          : selectedReason!.reason;

      const response = await ordersService.cancelOrder(
        orderNumber,
        selectedReason!.code,
        finalReason,
        selectedReason!.cancelled_by || 'buyer'
      );

      if (response.success) {
        onClose();
        onSuccess();
      } else {
        onError?.(response.error || 'Failed to cancel order');
      }
    } catch (err: any) {
      onError?.(err?.message || 'An error occurred');
    } finally {
      setSubmitting(false);
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <TouchableOpacity
        style={styles.overlay}
        activeOpacity={1}
        onPress={onClose}
      >
        <TouchableOpacity
          activeOpacity={1}
          onPress={(e) => e.stopPropagation()}
          style={styles.modal}
        >
          <Text style={styles.title}>Cancel Order</Text>
          <Text style={styles.subtitle}>
            Please select a reason for cancellation
          </Text>

          {loading ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={styles.loadingText}>Loading reasons...</Text>
            </View>
          ) : (
            <>
              <TouchableOpacity
                style={styles.dropdown}
                onPress={() => setShowDropdown(!showDropdown)}
                activeOpacity={0.7}
              >
                <Text
                  style={[
                    styles.dropdownText,
                    !selectedReason && styles.placeholder,
                  ]}
                  numberOfLines={1}
                >
                  {selectedReason?.reason || 'Select a reason'}
                </Text>
                <MaterialIcons
                  name={showDropdown ? 'expand-less' : 'expand-more'}
                  size={24}
                  color={colors.textSecondary}
                />
              </TouchableOpacity>

              {showDropdown && (
                <View style={styles.dropdownOptions}>
                  <ScrollView
                    style={styles.dropdownScroll}
                    nestedScrollEnabled
                    keyboardShouldPersistTaps="handled"
                  >
                    {cancelReasons.map((r) => (
                      <TouchableOpacity
                        key={r.code}
                        style={[
                          styles.option,
                          selectedReason?.code === r.code &&
                            styles.optionSelected,
                        ]}
                        onPress={() => {
                          setSelectedReason(r);
                          setShowDropdown(false);
                        }}
                        activeOpacity={0.7}
                      >
                        <Text
                          style={[
                            styles.optionText,
                            selectedReason?.code === r.code &&
                              styles.optionTextSelected,
                          ]}
                        >
                          {r.reason}
                        </Text>
                        {selectedReason?.code === r.code && (
                          <MaterialIcons
                            name="check"
                            size={20}
                            color={colors.primary}
                          />
                        )}
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              )}

              {isOtherReason && (
                <View style={styles.manualContainer}>
                  <Text style={styles.manualLabel}>
                    Please specify the reason
                  </Text>
                  <TextInput
                    style={styles.manualInput}
                    placeholder="Enter your reason..."
                    placeholderTextColor={colors.textSecondary}
                    value={manualReason}
                    onChangeText={setManualReason}
                    multiline
                    maxLength={200}
                  />
                </View>
              )}

              <View style={styles.buttons}>
                <TouchableOpacity
                  style={[styles.button, styles.buttonSecondary]}
                  onPress={onClose}
                  disabled={submitting}
                  activeOpacity={0.8}
                >
                  <Text style={styles.buttonTextSecondary}>Cancel</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[
                    styles.button,
                    styles.buttonPrimary,
                    styles.buttonPrimaryFixed,
                    (!canSubmit || submitting) && styles.buttonDisabled,
                  ]}
                  onPress={handleSubmit}
                  disabled={!canSubmit || submitting}
                  activeOpacity={0.8}
                >
                  <View style={styles.buttonContent}>
                    {submitting ? (
                      <ActivityIndicator size="small" color="#FFFFFF" />
                    ) : (
                      <Text style={styles.buttonTextPrimary}>
                        Confirm{cancelSecondsLeft > 0 ? ` (${cancelSecondsLeft}s)` : ''}
                      </Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}
        </TouchableOpacity>
      </TouchableOpacity>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  modal: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    width: '100%',
    maxWidth: 400,
  },
  title: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 20,
    color: '#000000',
    marginBottom: 8,
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: colors.textSecondary,
    marginBottom: 16,
  },
  loadingContainer: {
    padding: 20,
    alignItems: 'center',
  },
  loadingText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: colors.textSecondary,
    marginTop: 8,
  },
  dropdown: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    minHeight: 48,
  },
  dropdownText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  placeholder: {
    color: colors.textSecondary,
  },
  dropdownOptions: {
    backgroundColor: '#FFFFFF',
    borderRadius: 8,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    marginBottom: 12,
    maxHeight: 200,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  dropdownScroll: {
    maxHeight: 200,
  },
  option: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F5F5F5',
  },
  optionSelected: {
    backgroundColor: '#F0F9F4',
  },
  optionText: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    flex: 1,
  },
  optionTextSelected: {
    fontFamily: 'Poppins_500Medium',
    color: colors.primary,
  },
  manualContainer: {
    marginBottom: 16,
  },
  manualLabel: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    marginBottom: 8,
  },
  manualInput: {
    fontFamily: 'Poppins',
    fontSize: 14,
    color: '#000000',
    backgroundColor: '#F5F5F5',
    borderRadius: 8,
    padding: 12,
    borderWidth: 1,
    borderColor: '#E4E4E4',
    minHeight: 80,
    textAlignVertical: 'top',
  },
  buttons: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 12,
  },
  button: {
    paddingHorizontal: 24,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 100,
    alignItems: 'center',
  },
  buttonPrimary: {
    backgroundColor: colors.primary,
  },
  buttonPrimaryFixed: {
    minWidth: 140,
  },
  buttonContent: {
    minWidth: 110,
    alignItems: 'center',
    justifyContent: 'center',
  },
  buttonSecondary: {
    backgroundColor: '#F5F5F5',
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonTextPrimary: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#FFFFFF',
  },
  buttonTextSecondary: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    color: '#000000',
  },
});
