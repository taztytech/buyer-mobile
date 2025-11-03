/**
 * Expo Go Warning Component
 * Displays a helpful warning when the app is running in Expo Go
 */

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Linking } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { isExpoGo } from '@/utils/platform.util';

interface ExpoGoWarningProps {
  visible?: boolean;
  onDismiss?: () => void;
}

export const ExpoGoWarning: React.FC<ExpoGoWarningProps> = ({ visible = true, onDismiss }) => {
  if (!isExpoGo() || !visible) {
    return null;
  }

  const handleLearnMore = () => {
    Linking.openURL('https://docs.expo.dev/develop/development-builds/introduction/');
  };

  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <MaterialIcons name="info" size={24} color="#FFA500" />
        <View style={styles.textContainer}>
          <Text style={styles.title}>Running in Expo Go</Text>
          <Text style={styles.message}>
            Some features like Maps, Payment Gateway, and Push Notifications require a development build.
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
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 14,
    lineHeight: 20,
    color: '#333333',
    marginBottom: 4,
  },
  message: {
    fontFamily: 'Poppins_400Regular',
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
    fontFamily: 'Poppins_500Medium',
    fontSize: 12,
    color: '#00B14F',
  },
  closeButton: {
    padding: 4,
  },
});
