import React from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { addressService, type AddressResponse } from '@/services/address.service';
import type { ResolvedCurrentLocation } from '@/services/currentLocation.service';

/**
 * Shown on app open when a logged-in user is somewhere none of their saved
 * addresses are: offers to save the spot as Home, Office or Other.
 */

type Label = 'home' | 'work' | 'other';

const LABELS: Array<{ key: Label; title: string; icon: keyof typeof MaterialIcons.glyphMap }> = [
  { key: 'home', title: 'Home', icon: 'home' },
  { key: 'work', title: 'Office', icon: 'work' },
  { key: 'other', title: 'Other', icon: 'place' },
];

interface Props {
  location: ResolvedCurrentLocation | null;
  onSaved: (address: AddressResponse) => void;
  onDismiss: () => void;
}

export const NewLocationSheet: React.FC<Props> = ({ location, onSaved, onDismiss }) => {
  const [label, setLabel] = React.useState<Label>('home');
  const [house, setHouse] = React.useState('');
  const [landmark, setLandmark] = React.useState('');
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');

  React.useEffect(() => {
    if (location) {
      setLabel('home');
      setHouse('');
      setLandmark('');
      setError('');
    }
  }, [location]);

  if (!location) return null;

  const save = async () => {
    if (!house.trim()) {
      setError('Please add your house / flat number so the rider can find you');
      return;
    }
    setSaving(true);
    setError('');
    const p = location.parts;
    const pin = p?.pincode && p.pincode.length === 6 ? p.pincode : location.address.match(/\b(\d{6})\b/)?.[1];
    const res = await addressService.addAddress({
      address1: house.trim().slice(0, 200),
      address2: landmark.trim() ? landmark.trim().slice(0, 200) : undefined,
      address3: location.address.slice(0, 500),
      city: (p?.city || 'Madurai').slice(0, 100),
      state: (p?.state || 'Tamil Nadu').slice(0, 100),
      pincode: pin || '625001',
      latitude: location.latitude,
      longitude: location.longitude,
      type: label,
      is_default: true,
    });
    setSaving(false);
    if (res.success && res.data) {
      onSaved(res.data);
    } else {
      setError(res.error || 'Could not save this address. Please try again.');
    }
  };

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onDismiss} statusBarTranslucent>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={styles.flex}>
        <Pressable style={styles.backdrop} onPress={onDismiss} testID="new-location-backdrop" />
        <SafeAreaView edges={['bottom']} style={styles.sheet}>
          <View style={styles.handle} />
          <View style={styles.headRow}>
            <View style={styles.pin}>
              <MaterialIcons name="my-location" size={22} color="#0A6B35" />
            </View>
            <View style={styles.flex}>
              <Text style={styles.title}>{"You're at a new location"}</Text>
              <Text style={styles.sub}>Save it for faster checkout next time</Text>
            </View>
          </View>

          <View style={styles.addrBox}>
            <MaterialIcons name="place" size={18} color="#E53935" />
            <Text style={styles.addrText} numberOfLines={3}>
              {location.address}
            </Text>
          </View>

          <TextInput
            style={styles.input}
            placeholder="House / flat no., floor, building *"
            placeholderTextColor="#9AA39A"
            value={house}
            onChangeText={t => {
              setHouse(t);
              if (error) setError('');
            }}
            testID="new-location-house-input"
          />
          <TextInput
            style={styles.input}
            placeholder="Landmark (optional)"
            placeholderTextColor="#9AA39A"
            value={landmark}
            onChangeText={setLandmark}
            testID="new-location-landmark-input"
          />

          <Text style={styles.saveAs}>Save as</Text>
          <View style={styles.labels}>
            {LABELS.map(l => {
              const on = label === l.key;
              return (
                <TouchableOpacity
                  key={l.key}
                  style={[styles.chip, on && styles.chipOn]}
                  onPress={() => setLabel(l.key)}
                  activeOpacity={0.8}
                  testID={`new-location-label-${l.key}`}
                >
                  <MaterialIcons name={l.icon} size={18} color={on ? '#FFFFFF' : '#0A6B35'} />
                  <Text style={[styles.chipText, on && styles.chipTextOn]}>{l.title}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <TouchableOpacity
            style={[styles.saveBtn, saving && styles.saveBtnBusy]}
            onPress={save}
            disabled={saving}
            activeOpacity={0.85}
            testID="new-location-save-button"
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={styles.saveText}>Save address</Text>
            )}
          </TouchableOpacity>
          <TouchableOpacity onPress={onDismiss} style={styles.notNow} testID="new-location-not-now">
            <Text style={styles.notNowText}>Not now</Text>
          </TouchableOpacity>
        </SafeAreaView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const INK = '#14201A';

const styles = StyleSheet.create({
  flex: { flex: 1 },
  backdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.45)' },
  sheet: {
    position: 'absolute',
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: '#FFFFFF',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    paddingHorizontal: 20,
    paddingTop: 10,
    paddingBottom: 12,
  },
  handle: {
    alignSelf: 'center',
    width: 42,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#DADFD8',
    marginBottom: 14,
  },
  headRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  pin: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#E8F5EC',
  },
  title: { fontFamily: 'Poppins', fontWeight: '700', fontSize: 18, letterSpacing: 0, color: INK },
  sub: { fontFamily: 'Poppins', fontWeight: '400', fontSize: 13, letterSpacing: 0.1, color: '#6B756E' },
  addrBox: {
    flexDirection: 'row',
    gap: 8,
    marginTop: 14,
    padding: 12,
    borderRadius: 14,
    backgroundColor: '#F7FAF3',
  },
  addrText: {
    flex: 1,
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 13,
    lineHeight: 19,
    letterSpacing: 0.1,
    color: INK,
  },
  input: {
    marginTop: 10,
    height: 50,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E1E6DE',
    paddingHorizontal: 14,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    letterSpacing: 0.1,
    color: INK,
  },
  saveAs: {
    marginTop: 16,
    marginBottom: 8,
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#6B756E',
  },
  labels: { flexDirection: 'row', gap: 10 },
  chip: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: '#BFE0C9',
    backgroundColor: '#FFFFFF',
  },
  chipOn: { backgroundColor: '#0A6B35', borderColor: '#0A6B35' },
  chipText: { fontFamily: 'Poppins', fontWeight: '600', fontSize: 14, letterSpacing: 0.1, color: '#0A6B35' },
  chipTextOn: { color: '#FFFFFF' },
  error: {
    marginTop: 10,
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#D32F2F',
  },
  saveBtn: {
    marginTop: 16,
    height: 52,
    borderRadius: 26,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0A6B35',
  },
  saveBtnBusy: { opacity: 0.7 },
  saveText: { fontFamily: 'Poppins', fontWeight: '700', fontSize: 16, letterSpacing: 0.3, color: '#FFFFFF' },
  notNow: { alignItems: 'center', paddingVertical: 12 },
  notNowText: { fontFamily: 'Poppins', fontWeight: '600', fontSize: 14, letterSpacing: 0.2, color: '#6B756E' },
});
