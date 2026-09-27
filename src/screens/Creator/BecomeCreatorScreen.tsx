import { MaterialIcons } from '@expo/vector-icons';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { vcService } from '@/services/vc.service';

const GREEN = '#00B14F';

interface BecomeCreatorScreenProps {
  onBack: () => void;
  // Called once the application is submitted, so the app can refresh status.
  onSubmitted: () => void;
}

type Step = 'email' | 'otp' | 'details';

/**
 * Creator onboarding: verify an email, then choose a creator id and share the
 * three social profiles admin will review. Name and mobile come from the buyer's
 * account, so we do not ask for them again.
 */
export const BecomeCreatorScreen: React.FC<BecomeCreatorScreenProps> = ({
  onBack,
  onSubmitted,
}) => {
  const [step, setStep] = useState<Step>('email');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const [email, setEmail] = useState('');
  const [otp, setOtp] = useState('');

  const [handle, setHandle] = useState('');
  const [handleState, setHandleState] = useState<
    'idle' | 'checking' | 'free' | 'taken' | 'invalid'
  >('idle');
  const [instagram, setInstagram] = useState('');
  const [youtube, setYoutube] = useState('');
  const [facebook, setFacebook] = useState('');

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  const sendOtp = async () => {
    setError('');
    if (!emailValid) {
      setError('Enter a valid email address');
      return;
    }
    setBusy(true);
    try {
      await vcService.requestEmailOtp(email.trim());
      setStep('otp');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Could not send the code.');
    } finally {
      setBusy(false);
    }
  };

  const verifyOtp = async () => {
    setError('');
    if (otp.trim().length !== 6) {
      setError('Enter the 6-digit code');
      return;
    }
    setBusy(true);
    try {
      await vcService.verifyEmailOtp(email.trim(), otp.trim());
      setStep('details');
    } catch (e: any) {
      setError(e?.response?.data?.message || 'Invalid code.');
    } finally {
      setBusy(false);
    }
  };

  const checkHandle = async (value: string) => {
    const normalized = value.trim().toLowerCase();
    setHandle(normalized);
    if (!/^[a-z0-9._]{3,50}$/.test(normalized)) {
      setHandleState(normalized.length === 0 ? 'idle' : 'invalid');
      return;
    }
    setHandleState('checking');
    try {
      const free = await vcService.isHandleAvailable(normalized);
      setHandleState(free ? 'free' : 'taken');
    } catch {
      setHandleState('idle');
    }
  };

  const submit = async () => {
    setError('');
    if (handleState !== 'free') {
      setError('Choose an available creator id');
      return;
    }
    if (!instagram.trim() && !youtube.trim() && !facebook.trim()) {
      setError('Add at least one social profile link');
      return;
    }
    setBusy(true);
    try {
      await vcService.apply({
        handle: handle.trim().toLowerCase(),
        email: email.trim(),
        instagram_profile_url: instagram.trim() || undefined,
        youtube_channel_url: youtube.trim() || undefined,
        facebook_profile_url: facebook.trim() || undefined,
      });
      onSubmitted();
    } catch (e: any) {
      setError(
        e?.response?.data?.message || 'Could not submit your application.',
      );
    } finally {
      setBusy(false);
    }
  };

  const handleHint = {
    idle: '',
    checking: 'Checking…',
    free: 'Available',
    taken: 'This creator id is already taken, choose another',
    invalid: 'Use lowercase letters, numbers, dot or underscore (3-50)',
  }[handleState];

  return (
    <View style={styles.root}>
      <SafeAreaView style={styles.safeTop} edges={['top']}>
        <StatusBar barStyle="light-content" backgroundColor={GREEN} />
      </SafeAreaView>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={onBack}
          style={styles.backBtn}
          testID="become-creator-back"
        >
          <MaterialIcons name="chevron-left" size={26} color="#001E1F" />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>
          Become a creator
        </Text>
      </View>

      <View style={styles.body}>
        {step === 'email' && (
          <>
            <Text style={styles.title}>What's your email?</Text>
            <Text style={styles.sub}>
              We'll send a 6-digit code to verify it.
            </Text>
            <TextInput
              style={styles.input}
              placeholder="you@example.com"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              keyboardType="email-address"
              value={email}
              onChangeText={setEmail}
              testID="creator-email"
            />
            <PrimaryButton
              label="Send code"
              onPress={sendOtp}
              busy={busy}
              testID="creator-send-otp"
            />
          </>
        )}

        {step === 'otp' && (
          <>
            <Text style={styles.title}>Enter the code</Text>
            <Text style={styles.sub}>Sent to {email}</Text>
            <TextInput
              style={[styles.input, styles.otpInput]}
              placeholder="______"
              placeholderTextColor="#9CA3AF"
              keyboardType="number-pad"
              maxLength={6}
              value={otp}
              onChangeText={setOtp}
              testID="creator-otp"
            />
            <PrimaryButton
              label="Verify"
              onPress={verifyOtp}
              busy={busy}
              testID="creator-verify-otp"
            />
            <TouchableOpacity onPress={sendOtp} testID="creator-resend">
              <Text style={styles.link}>Resend code</Text>
            </TouchableOpacity>
          </>
        )}

        {step === 'details' && (
          <>
            <Text style={styles.title}>Set up your creator profile</Text>
            <Text style={styles.label}>Creator id</Text>
            <TextInput
              style={styles.input}
              placeholder="food_vloges_madurai"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={handle}
              onChangeText={checkHandle}
              testID="creator-handle"
            />
            {!!handleHint && (
              <Text
                style={[
                  styles.hint,
                  handleState === 'free' && styles.hintOk,
                  (handleState === 'taken' || handleState === 'invalid') &&
                    styles.hintErr,
                ]}
              >
                {handleHint}
              </Text>
            )}
            <Text style={styles.label}>Instagram profile URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://instagram.com/…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={instagram}
              onChangeText={setInstagram}
              testID="creator-instagram"
            />
            <Text style={styles.label}>YouTube channel URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://youtube.com/…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={youtube}
              onChangeText={setYoutube}
              testID="creator-youtube"
            />
            <Text style={styles.label}>Facebook profile URL</Text>
            <TextInput
              style={styles.input}
              placeholder="https://facebook.com/…"
              placeholderTextColor="#9CA3AF"
              autoCapitalize="none"
              value={facebook}
              onChangeText={setFacebook}
              testID="creator-facebook"
            />
            <PrimaryButton
              label="Submit for review"
              onPress={submit}
              busy={busy}
              testID="creator-submit"
            />
          </>
        )}

        {!!error && <Text style={styles.error}>{error}</Text>}
      </View>
    </View>
  );
};

const PrimaryButton = ({
  label,
  onPress,
  busy,
  testID,
}: {
  label: string;
  onPress: () => void;
  busy?: boolean;
  testID?: string;
}) => (
  <TouchableOpacity
    style={[styles.button, busy && styles.buttonDisabled]}
    onPress={onPress}
    disabled={busy}
    activeOpacity={0.8}
    testID={testID}
  >
    {busy ? (
      <ActivityIndicator color="#FFFFFF" />
    ) : (
      <Text style={styles.buttonText}>{label}</Text>
    )}
  </TouchableOpacity>
);

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#FFFFFF' },
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
  body: { padding: 20 },
  title: {
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 22,
    letterSpacing: 0.2,
    color: '#111827',
    marginBottom: 6,
  },
  sub: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#6B7280',
    marginBottom: 18,
  },
  label: {
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    color: '#374151',
    marginTop: 14,
    marginBottom: 6,
  },
  input: {
    borderWidth: 1,
    borderColor: '#D1D5DB',
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 15,
    letterSpacing: 0.2,
    color: '#111827',
  },
  otpInput: { letterSpacing: 8, textAlign: 'center', fontSize: 22 },
  hint: {
    fontFamily: 'Poppins',
    fontWeight: 400,
    fontSize: 12,
    letterSpacing: 0.1,
    color: '#6B7280',
    marginTop: 6,
  },
  hintOk: { color: GREEN },
  hintErr: { color: '#DC2626' },
  button: {
    backgroundColor: GREEN,
    borderRadius: 14,
    paddingVertical: 15,
    alignItems: 'center',
    marginTop: 22,
  },
  buttonDisabled: { opacity: 0.6 },
  buttonText: {
    color: '#FFFFFF',
    fontFamily: 'Poppins',
    fontWeight: 700,
    fontSize: 16,
    letterSpacing: 0.3,
  },
  link: {
    color: GREEN,
    fontFamily: 'Poppins',
    fontWeight: 600,
    fontSize: 14,
    letterSpacing: 0.2,
    textAlign: 'center',
    marginTop: 16,
  },
  error: {
    color: '#DC2626',
    fontFamily: 'Poppins',
    fontWeight: 500,
    fontSize: 13,
    letterSpacing: 0.1,
    marginTop: 16,
  },
});
