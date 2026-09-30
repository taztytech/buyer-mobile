import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  Modal,
  TouchableOpacity,
  StyleSheet,
  Animated,
  Easing,
  ScrollView,
  TextInput,
  Pressable,
  Dimensions,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { AddressResponse } from '@/services/address.service';

interface AddressSelectionModalProps {
  visible: boolean;
  onClose: () => void;
  addresses: AddressResponse[];
  selectedAddressId?: string;
  onSelectAddress: (addressId: string) => void;
  onAddNewAddress: () => void;
  onSetDefaultAddress?: (addressId: string) => Promise<void>;
  /** When provided, shows the "Use current location" row. */
  onUseCurrentLocation?: () => void;
  /** Optional secondary line for the current-location row. */
  currentLocationLabel?: string;
}

const { height: SCREEN_H } = Dimensions.get('window');
const SHEET_MAX = Math.round(SCREEN_H * 0.85);

const GREEN = '#00B14F';
const GREEN_INK = '#0A6B36';

const tileStyleFor = (type: string) => {
  switch (type) {
    case 'home':
      return { bg: '#E7F7EE', fg: '#0A7A3C', icon: 'home' as const };
    case 'work':
      return { bg: '#E0ECFF', fg: '#2E6FD6', icon: 'apartment' as const };
    default:
      return { bg: '#FFEDE2', fg: '#FF6A2B', icon: 'location-on' as const };
  }
};

export const AddressSelectionModal: React.FC<AddressSelectionModalProps> = ({
  visible,
  onClose,
  addresses,
  selectedAddressId,
  onSelectAddress,
  onAddNewAddress,
  onSetDefaultAddress,
  onUseCurrentLocation,
  currentLocationLabel,
}) => {
  const translateY = useRef(new Animated.Value(SHEET_MAX)).current;
  const [rendered, setRendered] = useState(visible);
  const [query, setQuery] = useState('');

  // Smooth slide up on open, smooth slide down on close (then unmount).
  useEffect(() => {
    if (visible) {
      setRendered(true);
      translateY.setValue(SHEET_MAX);
      Animated.timing(translateY, {
        toValue: 0,
        duration: 300,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }).start();
    } else if (rendered) {
      Animated.timing(translateY, {
        toValue: SHEET_MAX,
        duration: 240,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }).start(({ finished }) => {
        if (finished) {
          setRendered(false);
          setQuery('');
        }
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const formatAddress = (a: AddressResponse): string =>
    [a.address1, a.address2, a.address3, a.city, a.state, a.pincode]
      .filter(Boolean)
      .join(', ');

  const labelFor = (a: AddressResponse): string =>
    (a.type || 'other').charAt(0).toUpperCase() + (a.type || 'other').slice(1);

  const handleSelect = async (addressId: string) => {
    const hasDefault = addresses.some((a) => a.is_default);
    if (!hasDefault && onSetDefaultAddress) {
      try {
        await onSetDefaultAddress(addressId);
      } catch {
        // selection still applies
      }
    }
    onSelectAddress(addressId);
  };

  const q = query.trim().toLowerCase();
  const filtered = q
    ? addresses.filter(
        (a) =>
          labelFor(a).toLowerCase().includes(q) ||
          formatAddress(a).toLowerCase().includes(q),
      )
    : addresses;

  if (!rendered) return null;

  return (
    <Modal
      visible={rendered}
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose} testID="address-modal-backdrop" />
      <Animated.View style={[styles.sheet, { transform: [{ translateY }] }]}>
        <View style={styles.handle} />

        <Text style={styles.title}>Select delivery location</Text>

        {/* Search */}
        <View style={styles.search}>
          <MaterialIcons name="search" size={18} color={GREEN} />
          <TextInput
            style={styles.searchInput}
            value={query}
            onChangeText={setQuery}
            placeholder="Search area, street name…"
            placeholderTextColor="#9AA0A6"
            autoCorrect={false}
            testID="address-modal-search"
          />
        </View>

        {/* Use current location */}
        {onUseCurrentLocation && (
          <TouchableOpacity
            style={styles.actionRow}
            onPress={onUseCurrentLocation}
            activeOpacity={0.7}
            testID="address-use-current"
          >
            <MaterialIcons name="my-location" size={20} color={GREEN} />
            <View style={styles.actionText}>
              <Text style={styles.actionTitle}>Use current location</Text>
              {!!currentLocationLabel && (
                <Text style={styles.actionSub} numberOfLines={1}>
                  {currentLocationLabel}
                </Text>
              )}
            </View>
            <MaterialIcons name="chevron-right" size={22} color="#C4CAD1" />
          </TouchableOpacity>
        )}

        {/* Add new address */}
        <TouchableOpacity
          style={styles.actionRow}
          onPress={onAddNewAddress}
          activeOpacity={0.7}
          testID="address-add-new"
        >
          <MaterialIcons name="add" size={22} color={GREEN} />
          <Text style={[styles.actionTitle, styles.actionTitleGrow]}>Add new address</Text>
          <MaterialIcons name="chevron-right" size={22} color="#C4CAD1" />
        </TouchableOpacity>

        <View style={styles.divider} />

        {addresses.length > 0 && <Text style={styles.savedLabel}>SAVED ADDRESSES</Text>}

        <ScrollView
          style={styles.list}
          contentContainerStyle={styles.listContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {filtered.map((a) => {
            const tile = tileStyleFor(a.type || 'other');
            const active = selectedAddressId === a.id.toString();
            return (
              <TouchableOpacity
                key={a.id}
                style={[styles.addrCard, active && styles.addrCardActive]}
                onPress={() => handleSelect(a.id.toString())}
                activeOpacity={0.8}
                testID={`address-card-${a.id}`}
              >
                <View style={[styles.tile, { backgroundColor: tile.bg }]}>
                  <MaterialIcons name={tile.icon} size={20} color={tile.fg} />
                </View>
                <View style={styles.addrText}>
                  <Text style={styles.addrLabel}>{labelFor(a)}</Text>
                  <Text style={styles.addrLine} numberOfLines={2}>
                    {formatAddress(a)}
                  </Text>
                </View>
                {active && <MaterialIcons name="check-circle" size={20} color={GREEN} />}
              </TouchableOpacity>
            );
          })}
          {q && filtered.length === 0 && (
            <Text style={styles.noResults}>No saved address matches "{query}"</Text>
          )}
        </ScrollView>
      </Animated.View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    maxHeight: SHEET_MAX,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    paddingHorizontal: 18,
    paddingBottom: 24,
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#E3E7EB',
    alignSelf: 'center',
    marginTop: 10,
    marginBottom: 14,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 19,
    letterSpacing: 0.1,
    color: '#14181B',
    marginBottom: 14,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#F4F6F8',
    borderRadius: 14,
    paddingHorizontal: 13,
    height: 48,
    marginBottom: 6,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13.5,
    letterSpacing: 0.1,
    color: '#14181B',
    padding: 0,
  },
  actionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#F0EBE2',
  },
  actionText: { flex: 1, minWidth: 0 },
  actionTitle: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: GREEN_INK,
  },
  actionTitleGrow: { flex: 1 },
  actionSub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 1,
  },
  divider: { height: 8 },
  savedLabel: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 11,
    letterSpacing: 1.2,
    color: '#8A939B',
    marginTop: 10,
    marginBottom: 10,
  },
  list: { alignSelf: 'stretch' },
  listContent: { paddingBottom: 8, gap: 10 },
  addrCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: '#F7F8FA',
    borderRadius: 14,
    padding: 12,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  addrCardActive: {
    borderColor: GREEN,
    backgroundColor: '#F1FBF5',
  },
  tile: {
    width: 44,
    height: 44,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  addrText: { flex: 1, minWidth: 0 },
  addrLabel: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  addrLine: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 2,
    lineHeight: 16,
  },
  noResults: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 12.5,
    color: '#8A939B',
    textAlign: 'center',
    paddingVertical: 20,
  },
});
