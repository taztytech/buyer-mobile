import React from 'react';
import { View, Text, StyleSheet } from 'react-native';

export const AppFooter: React.FC = () => {
  return (
    <View style={styles.footer}>
      <View style={styles.contentContainer}>
        <Text style={styles.footerTitle}>Go Tazty,{'\n'}     Get Fed!</Text>
        <Text style={styles.footerSubtitle}>
          Crafted with <Text style={styles.heart}>❤</Text> in Madurai, India
        </Text>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    backgroundColor: '#E8E8E8',
    paddingVertical: 80,
    paddingHorizontal: 20,
  },
  contentContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
  },
  footerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 56,
    fontWeight: '700',
    lineHeight: 62,
    color: '#9B9B9B',
    marginBottom: 16,
    textAlign: 'left',
    letterSpacing: -1,
  },
  footerSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: '#ABABAB',
    textAlign: 'left',
    letterSpacing: 0.13,
  },
  heart: {
    color: '#FF6B9D',
  },
});