import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  Linking,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { authService } from '@/services/auth.service';

interface ContactUsScreenProps {
  visible?: boolean;
  onBack?: () => void;
}

export const ContactUsScreen: React.FC<ContactUsScreenProps> = ({
  visible = true,
  onBack,
}) => {
  const [supportEmail, setSupportEmail] = useState<string>('');
  const [supportNumber, setSupportNumber] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    if (!visible) {
      return;
    }

    const fetchSupportDetails = async () => {
      try {
        setIsLoading(true);
        // Get support details from cache first, only call API if not cached
        const supportDetails = await authService.getSupportDetails(false);
        setSupportEmail(supportDetails.support_email);
        setSupportNumber(supportDetails.support_number);
      } catch {
        // Silent fail – leave defaults
      } finally {
        setIsLoading(false);
      }
    };

    fetchSupportDetails();
  }, [visible]);

  const handleCall = () => {
    if (!supportNumber) return;
    const telUrl = `tel:${supportNumber.replace(/\s+/g, '')}`;
    Linking.openURL(telUrl).catch(() => {});
  };

  const handleEmail = () => {
    if (!supportEmail) return;
    const mailUrl = `mailto:${supportEmail}`;
    Linking.openURL(mailUrl).catch(() => {});
  };

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor="#00B14F" />
        <View style={styles.header}>
          {onBack && (
            <TouchableOpacity
              style={styles.backButton}
              onPress={onBack}
              activeOpacity={0.7}
            >
              <MaterialIcons name="chevron-left" size={24} color="#001E1F" />
            </TouchableOpacity>
          )}
          <Text style={styles.headerTitle}>Contact Us</Text>
        </View>
      </SafeAreaView>

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.container}>
          {/* Hero card */}
          <View style={styles.topCard}>
            <View style={styles.topCardBadge}>
              <MaterialIcons name="support-agent" size={28} color="#00B14F" />
            </View>
            <Text style={styles.topCardTitle}>Contact Us for Support</Text>
            <Text style={styles.topCardSubtitle}>
              Have a question? We&apos;re here to help!
            </Text>
            <Text style={styles.topCardHours}>
              Support Hours: 8 AM &ndash; 11 PM (Daily)
            </Text>
          </View>

          {/* Details card */}
          <View style={styles.detailsCard}>
            {isLoading ? (
              <View style={styles.loadingContainer}>
                <ActivityIndicator size="small" color="#00B14F" />
              </View>
            ) : (
              <>
                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <MaterialIcons name="call" size={20} color="#00B14F" />
                    <Text style={styles.label}>Support Mobile</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleCall}
                    activeOpacity={0.7}
                    style={styles.valueContainer}
                  >
                    <Text style={styles.valueText}>{supportNumber || '-'}</Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.divider} />

                <View style={styles.row}>
                  <View style={styles.rowLeft}>
                    <MaterialIcons name="email" size={20} color="#00B14F" />
                    <Text style={styles.label}>Support Mail ID</Text>
                  </View>
                  <TouchableOpacity
                    onPress={handleEmail}
                    activeOpacity={0.7}
                    style={styles.valueContainer}
                  >
                    <Text style={styles.valueText}>{supportEmail || '-'}</Text>
                  </TouchableOpacity>
                </View>
              </>
            )}
          </View>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  safeAreaTop: {
    backgroundColor: '#00B14F',
  },
  safeArea: {
    flex: 1,
    backgroundColor: '#F5F5F5',
  },
  header: {
    backgroundColor: '#00B14F',
    paddingHorizontal: 20,
    paddingVertical: 18,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 76,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 50,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E4E4E4',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#FFFFFF',
    lineHeight: 27,
  },
  container: {
    flex: 1,
    paddingHorizontal: 20,
    paddingTop: 20,
  },
  topCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingVertical: 28,
    paddingHorizontal: 16,
    marginBottom: 20,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  topCardBadge: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(0, 177, 79, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
    alignSelf: 'center',
    marginBottom: 12,
  },
  topCardTitle: {
    textAlign: 'center',
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 18,
    color: '#181C2E',
    marginBottom: 4,
  },
  topCardSubtitle: {
    textAlign: 'center',
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 13,
    color: 'rgba(0, 0, 0, 0.6)',
    marginBottom: 4,
  },
  topCardHours: {
    textAlign: 'center',
    fontFamily: 'Poppins_500Medium',
    fontSize: 13,
    color: '#00B14F',
  },
  detailsCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 18,
    paddingVertical: 20,
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
  },
  loadingContainer: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 16,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 6,
  },
  rowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    flex: 1,
    gap: 8,
  },
  label: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 14,
    color: '#181C2E',
  },
  valueContainer: {
    flexShrink: 1,
    alignItems: 'flex-end',
  },
  valueText: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    color: '#00B14F',
    textAlign: 'right',
  },
  divider: {
    height: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.06)',
    marginVertical: 12,
  },
});

export default ContactUsScreen;


