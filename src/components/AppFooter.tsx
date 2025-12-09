import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { colors, spacing, typography } from '@/theme';

const ACCENT_SPACING = 32; // Spacing before "Get Fed!" in pixels

export const AppFooter: React.FC = () => {
  // Calculate number of spaces needed based on font size
  const spacesCount = Math.floor(ACCENT_SPACING / 14); // Approximate space width
  const spacerText = '  '.repeat(spacesCount);

  return (
    <View style={styles.footer}>
      <View style={styles.contentContainer}>
        <View style={styles.titleContainer}>
          <Text style={styles.footerTitle}>
            Go Tazty,{'\n'}
            <Text style={styles.spacer}>{spacerText}</Text>
            <Text style={styles.footerTitleAccent}>Get Fed!</Text>
          </Text>
        </View>
        <View style={styles.divider} />
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
    paddingVertical: spacing.xxl * 1.5,
    paddingHorizontal: spacing.lg,
    alignItems: 'flex-start',
    justifyContent: 'center',
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
    ...typography.h1,
    fontFamily: 'Poppins_700Bold',
    fontSize: 56,
    lineHeight: 64,
    color: colors.text,
    textAlign: 'left',
    letterSpacing: 1.5,
  },
  spacer: {
    fontSize: 56,
  },
  footerTitleAccent: {
    ...typography.h1,
    fontFamily: 'Poppins_700Bold',
    fontSize: 56,
    lineHeight: 64,
    color: colors.primary,
    letterSpacing: 1.5,
  },
  divider: {
    width: 80,
    height: 3,
    backgroundColor: colors.primary,
    marginBottom: spacing.lg,
    borderRadius: 2,
    shadowColor: colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 3,
  },
  footerSubtitle: {
    ...typography.caption,
    fontFamily: 'Poppins_400Regular',
    fontSize: 13,
    lineHeight: 20,
    color: colors.textSecondary,
    textAlign: 'left',
    letterSpacing: 0.5,
  },
  heart: {
    color: colors.primary,
    fontSize: 14,
    fontFamily: 'Poppins_600SemiBold',
  },
});