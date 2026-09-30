import { MaterialIcons } from '@expo/vector-icons';
import React from 'react';
import {
  ScrollView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

const GREEN = '#00B14F';

interface SettingsScreenProps {
  onBack: () => void;
  walletBalanceText?: string;
  onMyOrders?: () => void;
  onWallet?: () => void;
  onMyAddresses?: () => void;
  onFavorites?: () => void;
  onContactUs?: () => void;
  onPrivacyPolicy?: () => void;
  onTermsConditions?: () => void;
  onFaq?: () => void;
  onDeleteAccount?: () => void;
  onLogout?: () => void;
}

/**
 * Account settings for a creator. Their profile screen is the Instagram-style
 * grid; everything account-related that used to sit on the Profile screen lives
 * here, reached from the settings icon.
 */
export const SettingsScreen: React.FC<SettingsScreenProps> = ({
  onBack,
  walletBalanceText,
  onMyOrders,
  onWallet,
  onMyAddresses,
  onFavorites,
  onContactUs,
  onPrivacyPolicy,
  onTermsConditions,
  onFaq,
  onDeleteAccount,
  onLogout,
}) => {
  const Item = ({
    label,
    icon,
    onPress,
    rightText,
    testID,
  }: {
    label: string;
    icon: string;
    onPress?: () => void;
    rightText?: string;
    testID?: string;
  }) => (
    <>
      <TouchableOpacity
        style={styles.item}
        onPress={onPress}
        activeOpacity={0.7}
        testID={testID}
      >
        <View style={styles.itemLeft}>
          <MaterialIcons name={icon as any} size={20} color={GREEN} />
          <Text style={styles.itemText}>{label}</Text>
        </View>
        <View style={styles.itemRight}>
          {!!rightText && <Text style={styles.itemRightText}>{rightText}</Text>}
          <MaterialIcons name="chevron-right" size={16} color="#111827" />
        </View>
      </TouchableOpacity>
      <View style={styles.divider} />
    </>
  );

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN} />
      </SafeAreaView>
      <View style={styles.header}>
        <TouchableOpacity onPress={onBack} style={styles.backBtn} testID="settings-back">
          <MaterialIcons name="arrow-back" size={26} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Settings</Text>
      </View>

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.card}>
          <Item label="My Orders" icon="receipt-long" onPress={onMyOrders} testID="settings-orders" />
          <Item
            label="Tazty Wallet"
            icon="account-balance-wallet"
            onPress={onWallet}
            rightText={walletBalanceText}
            testID="settings-wallet"
          />
          <Item label="My Addresses" icon="location-on" onPress={onMyAddresses} testID="settings-addresses" />
          <Item label="Favorites" icon="favorite" onPress={onFavorites} testID="settings-favorites" />
          <Item label="Contact Us" icon="chat" onPress={onContactUs} testID="settings-contact" />
          <Item label="Privacy Policy" icon="shield" onPress={onPrivacyPolicy} testID="settings-privacy" />
          <Item label="FAQ" icon="help-outline" onPress={onFaq} testID="settings-faq" />
          <Item label="Terms & Conditions" icon="description" onPress={onTermsConditions} testID="settings-terms" />
          <Item label="Delete Account" icon="delete-outline" onPress={onDeleteAccount} testID="settings-delete" />
        </View>

        <TouchableOpacity
          style={styles.logout}
          onPress={onLogout}
          activeOpacity={0.85}
          testID="settings-logout"
        >
          <MaterialIcons name="logout" size={20} color="#FFFFFF" />
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#F5F5F5' },
  safeTop: { backgroundColor: GREEN },
  header: {
    backgroundColor: GREEN,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingBottom: 14,
    paddingTop: 6,
  },
  backBtn: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 18,
    letterSpacing: 0.2,
    marginLeft: 12,
  },
  body: { padding: 16 },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    paddingHorizontal: 16,
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 16,
  },
  itemLeft: { flexDirection: 'row', alignItems: 'center', gap: 14 },
  itemText: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#111827',
  },
  itemRight: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  itemRightText: {
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0.2,
    color: GREEN,
  },
  divider: { height: 1, backgroundColor: '#F0F0F0' },
  logout: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#E11900',
    borderRadius: 14,
    paddingVertical: 15,
    marginTop: 20,
  },
  logoutText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.3,
  },
});
