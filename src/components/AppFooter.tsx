import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';

export const AppFooter: React.FC = () => {
  return (
    <ImageBackground
      source={require('../../assets/2148723447_Copy.jpg')}
      style={styles.footer}
      resizeMode="cover"
    >
      <View style={styles.contentContainer}>
        <Text style={styles.footerTitle}>Go Tazty,{'\n'}     Get Fed!</Text>
        <Text style={styles.footerSubtitle}>
          Crafted with <Text style={styles.heart}>❤</Text> in Madurai, India
        </Text>
      </View>
    </ImageBackground>
  );
};

const styles = StyleSheet.create({
  footer: {
    width: '100%',
    paddingVertical: 80,
    paddingHorizontal: 0,
  },
  contentContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
  },
  footerTitle: {
    fontFamily: 'Poppins_700Bold',
    fontSize: 36,
    marginLeft: 10,
    // fontWeight: '700',
    lineHeight: 40,
    color: '#FFFFFF',
    marginBottom: 10,
    // textAlign: 'left',
    letterSpacing: -1,
  },
  footerSubtitle: {
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    marginLeft: 10,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'left',
    letterSpacing: 0.13,
  },
  heart: {
    color: '#FF6B9D',
  },
});