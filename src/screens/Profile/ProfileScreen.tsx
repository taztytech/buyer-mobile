import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  StatusBar,
  TouchableOpacity,
  ScrollView,
  Linking,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { APP_VERSION_NAME } from '@/config/appVersion.generated';
import { storageService } from '@/services/storage.service';
import { authService } from '@/services/auth.service';
import { useConfirmation } from '@/context/ConfirmationContext';
import { formatRupees, walletService } from '@/services/wallet.service';
import { vcService, VcCreatorState } from '@/services/vc.service';

interface ProfileScreenProps {
  visible?: boolean;
  onBack?: () => void;
  onEditProfile?: () => void;
  onMyOrders?: () => void;
  /** Tazty Wallet. The entry only shows when the server says it is on. */
  onWallet?: () => void;
  onMyAddresses?: () => void;
  onFavorites?: () => void;
  onContactUs?: () => void;
  onPrivacyPolicy?: () => void;
  onTermsConditions?: () => void;
  onFaq?: () => void;
  onLogout?: () => void;
  /** Open creator onboarding (email → OTP → socials). */
  onBecomeCreator?: () => void;
  /** Open the Instagram-style creator profile (approved creators). */
  onCreatorProfile?: () => void;
}

export const ProfileScreen: React.FC<ProfileScreenProps> = ({
  visible = true,
  onBack,
  onEditProfile,
  onMyOrders,
  onWallet,
  onMyAddresses,
  onFavorites,
  onContactUs,
  onPrivacyPolicy,
  onTermsConditions,
  onFaq,
  onLogout,
  onBecomeCreator,
  onCreatorProfile,
}) => {
  const DELETE_ACCOUNT_URL = 'https://www.tazty.in/delete-account';
  const { showConfirmation } = useConfirmation();
  const [userName, setUserName] = useState('User');
  const [userPhone, setUserPhone] = useState('');
  const [userEmail, setUserEmail] = useState('');
  const [memberSince, setMemberSince] = useState('');
  const [creatorState, setCreatorState] = useState<VcCreatorState>('none');

  // Check creator status when the profile opens. We only use it to decide what
  // the creator row shows — the normal profile stays put. An approved creator
  // gets a "View Creator Dashboard" row here and opens the dashboard on tap;
  // auto-routing them was what caused the old-profile → creator flicker/loop.
  useEffect(() => {
    if (!visible) return;
    let active = true;
    vcService.me().then((me) => {
      if (!active) return;
      setCreatorState(me.state);
    });
    return () => {
      active = false;
    };
  }, [visible]);
  // null = hidden. Filled only when the wallet is switched on for this customer.
  const [walletBalance, setWalletBalance] = useState<number | null>(null);

  useEffect(() => {
    if (!visible || !onWallet) return;
    let cancelled = false;
    walletService.getSummary().then(summary => {
      if (cancelled) return;
      setWalletBalance(summary?.enabled ? Number(summary.balance || 0) : null);
    });
    return () => {
      cancelled = true;
    };
  }, [visible, onWallet]);
  // Fetch user data from API whenever screen becomes visible
  useEffect(() => {
    if (visible) {
      const fetchUserData = async () => {
        try {
          // First try to get data from API
          const response = await authService.getProfile();

          if (response.success && response.data?.user) {
            const user = response.data.user as any;
            setUserName(user.name || 'User');
            setUserPhone(user.phoneNumber || '');
            setUserEmail(user.email || '');
            const created = user.created_at || user.createdAt;
            if (created) {
              const d = new Date(created);
              if (!Number.isNaN(d.getTime())) {
                setMemberSince(
                  d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' }),
                );
              }
            }
          } else {
            // If API fails, try to get data from storage as fallback
            const userData = await storageService.getUser();
            if (userData) {
              setUserName(userData.name || 'User');
              setUserPhone(userData.phoneNumber || '');
            }
          }
        } catch (error) {
          // On error, try to load from storage
          try {
            const userData = await storageService.getUser();
            if (userData) {
              setUserName(userData.name || 'User');
              setUserPhone(userData.phoneNumber || '');
            }
          } catch (storageError) {
            // Silent fail - keep default values
          }
        }
      };

      fetchUserData();
    }
  }, [visible]);

  const handleLogout = () => {
    showConfirmation({
      title: 'Logout',
      message: 'Are you sure you want to logout from your account?',
      confirmText: 'Logout',
      cancelText: 'Cancel',
      confirmButtonColor: '#FF0000',
      onConfirm: async () => {
        try {
          await authService.logout();
          if (onLogout) {
            onLogout();
          }
        } catch (error) {
          showConfirmation({
            title: 'Error',
            message: 'Failed to logout. Please try again.',
            confirmText: 'OK',
            cancelText: 'Close',
            onConfirm: () => { },
          });
        }
      },
    });
  };

  const handleDeleteAccount = () => {
    showConfirmation({
      title: 'Delete Account',
      message: 'Are you sure you want to delete your account?',
      confirmText: 'Yes',
      cancelText: 'No',
      confirmButtonColor: '#DC2626',
      onConfirm: async () => {
        try {
          const supported = await Linking.canOpenURL(DELETE_ACCOUNT_URL);
          if (!supported) {
            throw new Error('Unsupported URL');
          }
          await Linking.openURL(DELETE_ACCOUNT_URL);
        } catch (error) {
          showConfirmation({
            title: 'Unable to Open Link',
            message: 'Please try again later.',
            confirmText: 'OK',
            cancelText: 'Close',
            onConfirm: () => { },
          });
        }
      },
    });
  };

  // Menu item component
  const MenuItem = ({
    label,
    icon,
    onPress,
    showArrow = true,
    showDivider = true,
    rightText,
    testID,
  }: {
    label: string;
    icon?: string;
    onPress?: () => void;
    showArrow?: boolean;
    showDivider?: boolean;
    rightText?: string;
    testID?: string;
  }) => (
    <>
      <TouchableOpacity
        style={styles.menuItem}
        onPress={onPress}
        activeOpacity={0.7}
        hitSlop={{ top: 16, bottom: 16, left: 0, right: 0 }}
        testID={testID}
      >
        <View style={styles.menuItemLeft}>
          {icon && (
            <MaterialIcons name={icon as any} size={21} color="#3A3F45" />
          )}
          <Text style={styles.menuItemText}>{label}</Text>
        </View>
        <View style={styles.menuItemRight}>
          {!!rightText && <Text style={styles.menuItemRightText}>{rightText}</Text>}
          {showArrow && (
            <MaterialIcons name="chevron-right" size={20} color="#C4CAD1" />
          )}
        </View>
      </TouchableOpacity>
      {showDivider && (
        <View style={styles.divider} />
      )}
    </>
  );

  const initial = userName && userName.length ? userName.charAt(0).toUpperCase() : 'U';
  const phoneText = userPhone ? `(+91) ${userPhone}` : '';
  const filledFields =
    1 +
    (userName && userName.trim() && userName !== 'User' ? 1 : 0) +
    (userEmail ? 1 : 0);
  const completionPct = Math.round((filledFields / 3) * 100);

  return (
    <View style={styles.rootContainer}>
      <SafeAreaView style={styles.safeAreaTop} edges={['top']}>
        <StatusBar barStyle="dark-content" backgroundColor="#FBF8F2" />
      </SafeAreaView>

      {/* Header */}
      <View style={styles.header}>
        {onBack && (
          <TouchableOpacity
            style={styles.backCircle}
            onPress={onBack}
            activeOpacity={0.7}
          >
            <MaterialIcons name="arrow-back" size={22} color="#14181B" />
          </TouchableOpacity>
        )}
        <Text style={styles.headerTitle} numberOfLines={1}>Account</Text>
      </View>

      <SafeAreaView style={styles.safeArea} edges={['bottom']}>
        <View style={styles.container}>
          <ScrollView
            style={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            contentContainerStyle={styles.scrollContentContainer}
          >
            {/* Identity */}
            <View style={styles.identity}>
              <View style={styles.avatarBig}>
                <Text style={styles.avatarBigText}>{initial}</Text>
              </View>
              <View style={styles.identityText}>
                <Text style={styles.name} numberOfLines={1}>{userName}</Text>
                <Text style={styles.sub} numberOfLines={1}>
                  {phoneText}
                  {memberSince ? `  ✦  Tazty since ${memberSince}` : ''}
                </Text>
                {completionPct < 100 && (
                  <TouchableOpacity
                    style={styles.completeRow}
                    onPress={onEditProfile}
                    activeOpacity={0.7}
                  >
                    <Text style={styles.completeText}>{completionPct}% · Complete profile</Text>
                    <MaterialIcons name="chevron-right" size={16} color="#E29A00" />
                  </TouchableOpacity>
                )}
              </View>
            </View>

            {/* Quick tiles */}
            <View style={styles.tiles}>
              <TouchableOpacity style={styles.tile} onPress={onMyOrders} activeOpacity={0.8}>
                <MaterialIcons name="shopping-bag" size={18} color="#8A939B" style={styles.tileIcon} />
                <Text style={styles.tileLabel}>My{'\n'}Orders</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tile} onPress={onWallet} activeOpacity={0.8}>
                <MaterialIcons name="account-balance-wallet" size={18} color="#8A939B" style={styles.tileIcon} />
                <Text style={styles.tileLabel}>My{'\n'}Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.tile} onPress={onContactUs} activeOpacity={0.8}>
                <MaterialIcons name="headset-mic" size={18} color="#8A939B" style={styles.tileIcon} />
                <Text style={styles.tileLabel}>Help &amp;{'\n'}Support</Text>
              </TouchableOpacity>
            </View>

            {/* Referral banner */}
            <TouchableOpacity style={styles.refBanner} onPress={onEditProfile} activeOpacity={0.9}>
              <View style={styles.refLeft}>
                <Text style={styles.refTitle}>Invite friends &amp; earn</Text>
                <Text style={styles.refSub}>Share Tazty · get wallet credits</Text>
              </View>
              <Text style={styles.refBig}>🎁</Text>
              <View style={styles.refArrow}><MaterialIcons name="chevron-right" size={18} color="#FFFFFF" /></View>
            </TouchableOpacity>

            {/* Menu Container */}
            <View style={styles.menuContainer}>
              {/* Video Commerce (Flix): normal buyers can apply; pending/rejected/
                  paused show status; an APPROVED creator gets a "View Creator
                  Dashboard" row that opens their dashboard on tap. The normal
                  profile always stays here — no auto-routing. */}
              {creatorState === 'none' && (
                <MenuItem
                  label="To be a creator on Tazty"
                  icon="video-call"
                  onPress={onBecomeCreator}
                  testID="become-creator-entry"
                />
              )}
              {creatorState === 'pending' && (
                <MenuItem
                  label="Creator application under review"
                  icon="hourglass-empty"
                  showArrow={false}
                  onPress={undefined}
                />
              )}
              {creatorState === 'rejected' && (
                <MenuItem
                  label="Creator application — reapply"
                  icon="refresh"
                  onPress={onBecomeCreator}
                />
              )}
              {creatorState === 'paused' && (
                <MenuItem
                  label="Creator id paused — contact admin"
                  icon="pause-circle-outline"
                  showArrow={false}
                  onPress={undefined}
                />
              )}
              {creatorState === 'approved' && (
                <MenuItem
                  label="View Creator Dashboard"
                  icon="dashboard"
                  onPress={onCreatorProfile}
                  testID="creator-dashboard-entry"
                />
              )}
              <MenuItem label="Saved address" icon="location-on" onPress={onMyAddresses} />
              <MenuItem label="Favourites" icon="favorite-border" onPress={onFavorites} />
              {walletBalance !== null && (
                <MenuItem
                  label="Tazty Wallet"
                  icon="account-balance-wallet"
                  onPress={onWallet}
                  rightText={formatRupees(walletBalance)}
                  testID="profile-wallet"
                />
              )}
              <MenuItem
                label="Notifications"
                icon="notifications-none"
                onPress={() => Linking.openSettings().catch(() => {})}
              />
              <MenuItem label="Suggest a dish" icon="lightbulb-outline" onPress={onContactUs} />
              <MenuItem label="Help & Support" icon="chat-bubble-outline" onPress={onContactUs} />
              <MenuItem label="Privacy Policy" icon="shield" onPress={onPrivacyPolicy} />
              <MenuItem label="Terms & Conditions" icon="description" onPress={onTermsConditions} />
              <MenuItem label="FAQ" icon="help-outline" onPress={onFaq} />
              <MenuItem
                label="Delete account"
                icon="delete-outline"
                onPress={handleDeleteAccount}
              />
              <MenuItem
                label="Log out"
                icon="logout"
                onPress={handleLogout}
                showArrow={false}
                showDivider={false}
              />
            </View>
            {/* Brand footer */}
            <View style={styles.brandFooter}>
              <Text style={styles.brandWord}>tazty</Text>
              <Text style={styles.brandVer}>{APP_VERSION_NAME}</Text>
            </View>
          </ScrollView>
        </View>
      </SafeAreaView>
    </View>
  );
};

const styles = StyleSheet.create({
  rootContainer: { flex: 1, backgroundColor: '#FBF8F2' },
  safeAreaTop: { backgroundColor: '#FBF8F2' },
  safeArea: { flex: 1, backgroundColor: '#FBF8F2' },
  container: { flex: 1, backgroundColor: '#FBF8F2' },
  scrollContent: { flex: 1, backgroundColor: '#FBF8F2' },
  scrollContentContainer: {
    paddingHorizontal: 18,
    paddingTop: 6,
    paddingBottom: 24,
    backgroundColor: '#FBF8F2',
  },
  header: {
    backgroundColor: '#FBF8F2',
    paddingHorizontal: 16,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    height: 60,
  },
  backCircle: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#F0EBE2',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 22,
    color: '#14181B',
    letterSpacing: -0.2,
  },
  identity: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    marginTop: 6,
    marginBottom: 18,
  },
  avatarBig: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#E7F7EE',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 2,
    borderColor: '#CDEBD6',
  },
  avatarBigText: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 28,
    color: '#0A7A3C',
  },
  identityText: { flex: 1, minWidth: 0 },
  name: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 22,
    color: '#14181B',
    letterSpacing: -0.3,
  },
  sub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 12,
    color: '#7A828B',
    marginTop: 3,
  },
  completeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    marginTop: 6,
  },
  completeText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 12.5,
    color: '#E29A00',
  },
  tiles: { flexDirection: 'row', gap: 10, marginBottom: 14 },
  tile: {
    flex: 1,
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 14,
    height: 82,
    justifyContent: 'space-between',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  tileIcon: { alignSelf: 'flex-end' },
  tileLabel: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 13,
    color: '#14181B',
    lineHeight: 17,
  },
  refBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#E7F7EE',
    borderRadius: 16,
    padding: 14,
    marginBottom: 18,
    gap: 10,
  },
  refLeft: { flex: 1, minWidth: 0 },
  refTitle: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 15,
    color: '#0A6B36',
  },
  refSub: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 11.5,
    color: '#4E6B57',
    marginTop: 2,
  },
  refBig: { fontSize: 30 },
  refArrow: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  brandFooter: { alignItems: 'center', paddingTop: 20, paddingBottom: 8 },
  brandWord: {
    fontFamily: 'Poppins',
    fontWeight: '800',
    fontSize: 22,
    color: '#D8D2C6',
    letterSpacing: -0.5,
  },
  brandVer: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 11,
    color: '#C4BDB0',
    marginTop: 2,
  },
  // Profile Header
  profileHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 20,
    marginBottom: 30,
  },
  profileLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  avatarContainer: {
    width: 50,
    height: 50,
  },
  avatar: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderWidth: 2,
    borderColor: '#00B14F',
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 20,
    color: '#00B14F',
    lineHeight: 24,
  },
  profileInfo: {
    gap: 2,
  },
  profileName: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
  },
  profilePhone: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 12,
    lineHeight: 18,
    color: '#000000',
    opacity: 0.85,
  },
  editProfileButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  editProfileText: {
    fontFamily: 'Poppins',
    fontWeight: '300',
    fontSize: 13,
    lineHeight: 20,
    textAlign: 'center',
    color: '#000000',
    opacity: 0.85,
  },
  // Menu Container
  menuContainer: {
    backgroundColor: '#FFFFFF',
    borderRadius: 18,
    paddingHorizontal: 16,
    paddingVertical: 4,
    marginBottom: 8,
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 1,
  },
  menuItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    minHeight: 52,
    paddingVertical: 13,
  },
  menuItemLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuItemText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14.5,
    lineHeight: 20,
    color: '#14181B',
  },
  menuItemRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  menuItemRightText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0,
    color: '#00B14F',
  },
  switchContainer: {
    transform: [{ scaleX: 0.8 }, { scaleY: 0.8 }],
  },
  divider: {
    height: 1,
    backgroundColor: '#F0EBE2',
    marginVertical: 0,
  },
  // Bottom Section
  bottomSection: {
    paddingHorizontal: 20,
    paddingBottom: 20,
    backgroundColor: '#F5F5F5',
  },
  // App Version
  appVersion: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 14,
    lineHeight: 21,
    color: '#000000',
    textAlign: 'center',
    marginBottom: 20,
    opacity: 0.85,
  },
  // Logout Button
  logoutButton: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 20,
    gap: 10,
    backgroundColor: '#DC2626',
    borderRadius: 10,
  },
  logoutText: {
    fontFamily: 'Poppins_600SemiBold',
    fontSize: 16,
    lineHeight: 24,
    color: '#FFFFFF',
  },
});
