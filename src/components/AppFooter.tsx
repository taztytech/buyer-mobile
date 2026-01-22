import React from 'react';
import { View, Text, StyleSheet, ImageBackground } from 'react-native';
import { spacing, typography } from '@/theme';

const ACCENT_SPACING = 32; // Spacing before "Get Fed!" in pixels

export const AppFooter: React.FC = () => {
  // Calculate number of spaces needed based on font size
  const spacesCount = Math.floor(ACCENT_SPACING / 14); // Approximate space width
  const spacerText = '  '.repeat(spacesCount);

  return (
    <ImageBackground
      source={require('@../../../assets/2148723447.jpg')}
      style={styles.footer}
      resizeMode="cover"
    >
      <View style={styles.contentContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.footerTitle}>
            Go <Text style={styles.taztyText}>Tazty</Text>,{'\n'}
            <Text style={styles.spacer}>{spacerText}</Text>
            <Text style={styles.footerTitleWhite}>Get Fed!</Text>
          </Text>
        </View>
        <View style={styles.divider} />
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
    paddingVertical: spacing.xxl,
    // paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
    justifyContent: 'center',
    minHeight: 100,
  },
  contentContainer: {
    alignItems: 'flex-start',
    justifyContent: 'center',
    width: '100%',
    maxWidth: 600,
  },
  titleContainer: {
    alignItems: 'flex-start',
    marginBottom: spacing.lg,
  },
  footerTitle: {
    // ...typography.h1,
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    lineHeight: 36,
    color: '#FFFFFF',
    // textAlign: 'left',
    marginLeft: 10,
    // letterSpacing: 1.5,
  },
  taztyText: {
    color: '#01B14F', // Theme color for "Tazty"
  },
  spacer: {
    // fontSize: 56,
    color: '#FFFFFF',
  },
  footerTitleWhite: {
    // ...typography.h1,
    fontFamily: 'Poppins_700Bold',
    fontSize: 32,
    lineHeight: 36,
    color: '#FFFFFF',
    letterSpacing: 1.5,
  },
  divider: {
    width: 80,
    height: 3,
    marginLeft: 15,
    backgroundColor: '#FFFFFF',
    marginBottom: spacing.lg,
    borderRadius: 2,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  footerSubtitle: {
    ...typography.caption,
    fontFamily: 'Poppins_400Regular',
    fontSize: 10,
    marginLeft: 15,
    lineHeight: 20,
    color: '#FFFFFF',
    textAlign: 'left',
    letterSpacing: 0.5,
  },
  heart: {
    color: '#FFFFFF',
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
});