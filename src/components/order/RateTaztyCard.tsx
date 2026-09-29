import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const PLAY_STORE_URL =
  'https://play.google.com/store/apps/details?id=in.tazty.buyer';
const PLAY_STORE_MARKET = 'market://details?id=in.tazty.buyer';

/**
 * A gentle nudge to rate the app on the Play Store, pinned near the bottom of
 * the order screen. Prefers the native store deep link and falls back to the
 * web URL.
 */
export const RateTaztyCard: React.FC = () => {
  const openStore = async () => {
    try {
      const canOpen = await Linking.canOpenURL(PLAY_STORE_MARKET);
      await Linking.openURL(canOpen ? PLAY_STORE_MARKET : PLAY_STORE_URL);
    } catch {
      Linking.openURL(PLAY_STORE_URL).catch(() => {});
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.icon}>
        <MaterialIcons name="star" size={20} color="#FFFFFF" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Enjoying Tazty?</Text>
        <Text style={styles.subtitle}>Rate us on the Play Store — it helps a lot</Text>
      </View>
      <TouchableOpacity
        style={styles.button}
        onPress={openStore}
        activeOpacity={0.85}
        testID="rate-tazty-button"
      >
        <Text style={styles.buttonText}>Rate</Text>
      </TouchableOpacity>
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F7EE',
    borderWidth: 1,
    borderColor: 'rgba(0,177,79,0.2)',
    borderRadius: 18,
    paddingVertical: 14,
    paddingHorizontal: 15,
    marginHorizontal: 14,
    marginTop: 12,
  },
  icon: {
    width: 38,
    height: 38,
    borderRadius: 11,
    backgroundColor: '#00B14F',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#0A6B36',
  },
  subtitle: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#566068',
    marginTop: 2,
  },
  button: {
    backgroundColor: '#00B14F',
    borderRadius: 999,
    paddingHorizontal: 18,
    paddingVertical: 9,
    marginLeft: 12,
  },
  buttonText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12.5,
    letterSpacing: 0.1,
    color: '#FFFFFF',
  },
});
