/**
 * Development Build Warning Component
 * Displays a helpful warning when limited runtimes are used.
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@/shims/rn-vector-icons';
import { isLimitedRuntime } from '@/utils/platform.util';

interface DevBuildWarningProps {
  visible?: boolean;
  onDismiss?: () => void;
}

export const DevBuildWarning: React.FC<DevBuildWarningProps> = ({ visible = true, onDismiss }) => {
  if (!isLimitedRuntime() || !visible) {
    return null;
  }

  const handleLearnMore = () => {
    Linking.openURL('https://reactnative.dev/docs/environment-setup');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="info" size={24} color="#FFA500" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Limited Runtime</Text>
          <Text style={styles.message}>
            Some features like Maps, Payment Gateway, and Push Notifications require a full development build.
            The app will use fallback views for testing.
          </Text>
          <TouchableOpacity onPress={handleLearnMore} style={styles.learnMoreButton}>
            <Text style={styles.learnMoreText}>Learn More</Text>
            <MaterialIcons name="arrow-forward" size={16} color="#00B14F" />
          </TouchableOpacity>
        </View>
        {onDismiss && (
          <TouchableOpacity onPress={onDismiss} style={styles.closeButton}>
            <MaterialIcons name="close" size={20} color="#666666" />
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    backgroundColor: '#FFF8DC',
    borderBottomWidth: 1,
    borderBottomColor: '#FFD700',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  content: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  textContainer: {
    flex: 1,
  },
  title: {
    fontFamily: 'Poppins-SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
    marginBottom: 4,
  },
  message: {
    fontFamily: 'Poppins-Regular',
    fontSize: 12,
    lineHeight: 18,
    color: '#666666',
    marginBottom: 8,
  },
  learnMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  learnMoreText: {
    fontFamily: 'Poppins-Medium',
    fontSize: 12,
    color: '#00B14F',
  },
  closeButton: {
    padding: 4,
  },
});
