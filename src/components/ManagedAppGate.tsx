import React from 'react';
import {
  ActivityIndicator,
  AppState,
  Linking,
  Platform,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import Constants from 'expo-constants';
import DeviceInfo from 'react-native-device-info';

type Policy = {
  update_required: boolean;
  update_available: boolean;
  update_mode: 'none' | 'optional' | 'required';
  latest_build: number;
  latest_version: string;
  store_url: string;
  release_notes: string;
  maintenance: {
    active: boolean;
    title: string;
    reason: string;
    starts_at?: string | null;
    ends_at?: string | null;
    support_url: string;
  };
};

const CONTROL_PLANE_URL = String(
  Constants.expoConfig?.extra?.godfatherPublicUrl ||
    process.env.EXPO_PUBLIC_GODFATHER_PUBLIC_URL ||
    'https://api.godfather.tazty.in',
).replace(/\/$/, '');

export function ManagedAppGate({ children }: React.PropsWithChildren) {
  const [policy, setPolicy] = React.useState<Policy | null>(null);
  const [checking, setChecking] = React.useState(true);
  const [dismissedBuild, setDismissedBuild] = React.useState<number | null>(null);

  const refresh = React.useCallback(async () => {
    try {
      const platform = Platform.OS === 'ios' ? 'ios' : 'android';
      const version = DeviceInfo.getVersion();
      const build = Number(DeviceInfo.getBuildNumber()) || 0;
      const installationId = await DeviceInfo.getUniqueId();
      const response = await fetch(
        `${CONTROL_PLANE_URL}/public/v1/applications/buyer-mobile/policy?platform=${platform}&version_name=${encodeURIComponent(version)}&build_number=${build}&installation_id=${encodeURIComponent(installationId)}`,
        { headers: { Accept: 'application/json' } },
      );
      if (!response.ok) throw new Error(`Policy returned ${response.status}`);
      const body = await response.json();
      setPolicy(body.data as Policy);
    } catch (error) {
      console.warn('Buyer availability policy unavailable; allowing app access', error);
    } finally {
      setChecking(false);
    }
  }, []);

  React.useEffect(() => {
    void refresh();
    const timer = setInterval(() => void refresh(), 60_000);
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') void refresh();
    });
    return () => {
      clearInterval(timer);
      subscription.remove();
    };
  }, [refresh]);

  if (checking && !policy) {
    return (
      <SafeAreaView style={styles.screen}>
        <ActivityIndicator color="#12B76A" size="large" />
        <Text style={styles.eyebrow}>TAZTY CONTROL</Text>
        <Text style={styles.loading}>Checking service availability</Text>
      </SafeAreaView>
    );
  }

  if (policy?.maintenance.active) {
    const end = policy.maintenance.ends_at
      ? new Date(policy.maintenance.ends_at).toLocaleString()
      : 'Updates will be posted here';
    return (
      <GateScreen
        code="MAINTENANCE WINDOW"
        title={policy.maintenance.title || 'Tazty is under maintenance'}
        message={policy.maintenance.reason || 'We are completing scheduled service work.'}
        detail={`Expected return: ${end}`}
        actionLabel={policy.maintenance.support_url ? 'View status' : undefined}
        actionUrl={policy.maintenance.support_url}
        onRetry={refresh}
      />
    );
  }

  if (policy?.update_required) {
    return (
      <GateScreen
        code="REQUIRED UPDATE"
        title={`Tazty ${policy.latest_version} is ready`}
        message={policy.release_notes || 'Update the app to continue securely.'}
        detail="Your current build is no longer supported."
        actionLabel="Update now"
        actionUrl={policy.store_url}
        onRetry={refresh}
      />
    );
  }

  if (policy?.update_available && policy.update_mode === 'optional' && dismissedBuild !== policy.latest_build) {
    return (
      <GateScreen code="UPDATE AVAILABLE" title={`Tazty ${policy.latest_version} is ready`}
        message={policy.release_notes || 'A new version is available.'} detail="You can continue now and update when convenient."
        actionLabel="Update now" actionUrl={policy.store_url} onRetry={refresh} onContinue={() => setDismissedBuild(policy.latest_build)} />
    );
  }

  return <>{children}</>;
}

function GateScreen({ code, title, message, detail, actionLabel, actionUrl, onRetry, onContinue }: {
  code: string;
  title: string;
  message: string;
  detail: string;
  actionLabel?: string;
  actionUrl?: string;
  onRetry: () => Promise<void>;
  onContinue?: () => void;
}) {
  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.frame}>
        <View style={styles.statusRow}>
          <View style={styles.dot} />
          <Text style={styles.eyebrow}>{code}</Text>
        </View>
        <Text style={styles.title}>{title}</Text>
        <Text style={styles.message}>{message}</Text>
        <View style={styles.detailBox}>
          <Text style={styles.detailLabel}>STATUS</Text>
          <Text style={styles.detail}>{detail}</Text>
        </View>
        {actionLabel && actionUrl ? (
          <Pressable style={styles.primary} onPress={() => void Linking.openURL(actionUrl)}>
            <Text style={styles.primaryText}>{actionLabel}</Text>
          </Pressable>
        ) : null}
        <Pressable style={styles.secondary} onPress={() => void onRetry()}>
          <Text style={styles.secondaryText}>Check again</Text>
        </Pressable>
        {onContinue ? <Pressable style={styles.continueButton} onPress={onContinue}><Text style={styles.continueText}>Continue for now</Text></Pressable> : null}
      </View>
      <Text style={styles.footer}>Service policy supplied by Tazty Godfather</Text>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#08130F', alignItems: 'center', justifyContent: 'center', padding: 24 },
  frame: { width: '100%', maxWidth: 520, borderWidth: 1, borderColor: '#255443', backgroundColor: '#0D1D17', padding: 24 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 22 },
  dot: { width: 8, height: 8, backgroundColor: '#37E59A' },
  eyebrow: { color: '#37E59A', fontSize: 12, fontWeight: '700', letterSpacing: 0, marginTop: 14 },
  loading: { color: '#DDEBE5', fontSize: 15, marginTop: 12 },
  title: { color: '#F3FFF9', fontSize: 30, lineHeight: 38, fontWeight: '700', marginBottom: 14 },
  message: { color: '#ACC3B9', fontSize: 16, lineHeight: 25, marginBottom: 24 },
  detailBox: { borderWidth: 1, borderColor: '#24473A', backgroundColor: '#091510', padding: 16, marginBottom: 20 },
  detailLabel: { color: '#7C9B8E', fontSize: 10, fontWeight: '700', letterSpacing: 0, marginBottom: 6 },
  detail: { color: '#DDEBE5', fontSize: 14, lineHeight: 21 },
  primary: { minHeight: 50, alignItems: 'center', justifyContent: 'center', backgroundColor: '#12B76A', marginBottom: 10 },
  primaryText: { color: '#06110C', fontSize: 15, fontWeight: '800', textTransform: 'uppercase' },
  secondary: { minHeight: 48, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#315C4C' },
  secondaryText: { color: '#DDEBE5', fontSize: 14, fontWeight: '700' },
  continueButton: { minHeight: 44, alignItems: 'center', justifyContent: 'center', marginTop: 8 },
  continueText: { color: '#8DA89C', fontSize: 13, fontWeight: '700' },
  footer: { color: '#638276', fontSize: 11, marginTop: 18 },
});
