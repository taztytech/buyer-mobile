import React from 'react';
import {
  View,
  Text,
  StyleSheet,
  Image,
  TouchableOpacity,
  StatusBar,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { RibbonAnimation } from '@/components/RibbonAnimation';

interface OrderSuccessScreenProps {
  onContinue: () => void;
}

export const OrderSuccessScreen: React.FC<OrderSuccessScreenProps> = ({
  onContinue,
}) => {
  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="rgba(0, 0, 0, 0.5)" translucent />

      {/* Overlay with blur */}
      <BlurView intensity={20} style={styles.overlay} tint="dark">
        {/* Success Card */}
        <View style={styles.successCard}>
          {/* Success Image - positioned to overflow top */}
          <View style={styles.imageContainer}>
            <View style={styles.imageShadow} />
            <Image
              source={require('../../assets/order-success.png')}
              style={styles.successImage}
              resizeMode="contain"
            />
          </View>

          {/* Content */}
          <View style={styles.content}>
            <Text style={styles.title}>Order Placed Successfully..!</Text>
            <Text style={styles.subtitle}>
              Our delivery partner will deliver your food soon.
            </Text>

            {/* Continue Button */}
            <TouchableOpacity
              style={styles.continueButton}
              onPress={onContinue}
              activeOpacity={0.8}
            >
              <Text style={styles.continueText}>Continue</Text>
            </TouchableOpacity>
          </View>
        </View>
      </BlurView>

      {/* Ribbon Animation */}
      <RibbonAnimation active={true} />
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
  },
  overlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
  },
  successCard: {
    width: 350,
    height: 386,
    backgroundColor: '#FFFFFF',
    borderRadius: 20,
    justifyContent: 'flex-end',
    alignItems: 'center',
    padding: 20,
    gap: 20,
    position: 'relative',
  },
  imageContainer: {
    position: 'absolute',
    top: -162,
    left: 45.5,
    width: 259,
    height: 339,
    zIndex: 0,
  },
  imageShadow: {
    position: 'absolute',
    width: 190,
    height: 190,
    left: '50%',
    top: -110,
    marginLeft: -95,
    backgroundColor: 'rgba(0, 0, 0, 0.2)',
    borderRadius: 95,
    // Note: React Native doesn't support blur filter directly
  },
  successImage: {
    width: 259,
    height: 339,
  },
  content: {
    width: '100%',
    alignItems: 'center',
    gap: 20,
    zIndex: 1,
  },
  title: {
    width: 200,
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 22,
    lineHeight: 33,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  subtitle: {
    width: 310,
    fontFamily: 'Poppins',
    fontSize: 15,
    lineHeight: 22,
    textAlign: 'center',
    color: 'rgba(0, 0, 0, 0.5)',
    opacity: 0.85,
  },
  continueButton: {
    width: 310,
    height: 40,
    backgroundColor: '#00B14F',
    borderRadius: 6,
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  continueText: {
    fontFamily: 'Poppins_500Medium',
    fontSize: 14,
    lineHeight: 21,
    color: '#FFFFFF',
    opacity: 0.85,
  },
});
