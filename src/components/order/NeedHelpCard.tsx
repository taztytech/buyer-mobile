import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

interface NeedHelpCardProps {
  onPress?: () => void;
}

/**
 * "Need help?" entry for the order screen — a single tap into support for this
 * order. Deliberately plain wording (no "chat with us" label).
 */
export const NeedHelpCard: React.FC<NeedHelpCardProps> = ({ onPress }) => {
  return (
    <TouchableOpacity
      style={styles.card}
      onPress={onPress}
      activeOpacity={0.8}
      testID="order-need-help"
    >
      <View style={styles.icon}>
        <MaterialIcons name="chat-bubble-outline" size={18} color="#0A7A3C" />
      </View>
      <View style={styles.text}>
        <Text style={styles.title}>Need help?</Text>
        <Text style={styles.sub}>Get support for any issue with this order</Text>
      </View>
      <MaterialIcons name="chevron-right" size={22} color="#8A939B" />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    padding: 15,
  },
  icon: {
    width: 30,
    height: 30,
    borderRadius: 9,
    backgroundColor: '#E7F7EE',
    alignItems: 'center',
    justifyContent: 'center',
  },
  text: {
    flex: 1,
    minWidth: 0,
  },
  title: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14.5,
    letterSpacing: 0.1,
    color: '#14181B',
  },
  sub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    letterSpacing: 0.1,
    color: '#8A939B',
    marginTop: 1,
  },
});
