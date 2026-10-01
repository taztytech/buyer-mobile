import React from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Linking,
  StatusBar,
} from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import LottieView from 'lottie-react-native';
import {
  ExpoSpeechRecognitionModule,
  useSpeechRecognitionEvent,
} from 'expo-speech-recognition';

interface VoiceSearchOverlayProps {
  visible: boolean;
  onClose: () => void;
  /** Called with what the buyer said; the caller runs the search. */
  onResult: (text: string) => void;
}

type Phase = 'listening' | 'retry' | 'denied' | 'unavailable';
type Lang = 'en-IN' | 'ta-IN';

const HINTS: Record<Lang, string> = {
  'en-IN': 'Try “Chicken 65 biryani”',
  'ta-IN': 'சொல்லுங்கள்: “சிக்கன் பிரியாணி”',
};

/**
 * Full-screen voice search: the Lottie ball loops while the phone listens,
 * the words appear as they are spoken, and the final phrase is handed back
 * to run a normal search. English (India) by default, Tamil on the toggle.
 */
export const VoiceSearchOverlay: React.FC<VoiceSearchOverlayProps> = ({
  visible,
  onClose,
  onResult,
}) => {
  const [phase, setPhase] = React.useState<Phase>('listening');
  const [lang, setLang] = React.useState<Lang>('en-IN');
  const [transcript, setTranscript] = React.useState('');
  const doneRef = React.useRef(false);
  const transcriptRef = React.useRef('');

  const start = React.useCallback(async (language: Lang) => {
    doneRef.current = false;
    transcriptRef.current = '';
    setTranscript('');
    try {
      if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
        setPhase('unavailable');
        return;
      }
      const perm = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
      if (!perm.granted) {
        setPhase('denied');
        return;
      }
      setPhase('listening');
      ExpoSpeechRecognitionModule.start({
        lang: language,
        interimResults: true,
        continuous: false,
        maxAlternatives: 1,
        androidIntentOptions: {
          EXTRA_SPEECH_INPUT_COMPLETE_SILENCE_LENGTH_MILLIS: 1500,
        },
      });
    } catch {
      setPhase('retry');
    }
  }, []);

  const stopListening = React.useCallback(() => {
    try {
      ExpoSpeechRecognitionModule.abort();
    } catch {
      // already stopped
    }
  }, []);

  React.useEffect(() => {
    if (visible) start(lang);
    else stopListening();
    return stopListening;
    // Language changes restart through switchLang, not here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visible]);

  const finish = React.useCallback(
    (text: string) => {
      const clean = text.trim();
      if (doneRef.current || !clean) return;
      doneRef.current = true;
      stopListening();
      onResult(clean);
    },
    [onResult, stopListening],
  );

  useSpeechRecognitionEvent('result', event => {
    if (!visible) return;
    const text = event.results?.[0]?.transcript ?? '';
    transcriptRef.current = text;
    setTranscript(text);
    if (event.isFinal) finish(text);
  });

  useSpeechRecognitionEvent('error', event => {
    if (!visible || doneRef.current) return;
    if (event.error === 'aborted') return;
    if (event.error === 'not-allowed') setPhase('denied');
    else if (event.error === 'service-not-allowed' || event.error === 'language-not-supported')
      setPhase('unavailable');
    else setPhase('retry');
  });

  useSpeechRecognitionEvent('end', () => {
    if (!visible || doneRef.current) return;
    // Ended on silence: use what was heard, or offer another try.
    if (transcriptRef.current.trim()) finish(transcriptRef.current);
    else setPhase(p => (p === 'listening' ? 'retry' : p));
  });

  const switchLang = (next: Lang) => {
    if (next === lang) return;
    setLang(next);
    stopListening();
    setTimeout(() => start(next), 150);
  };

  const status =
    phase === 'listening'
      ? lang === 'ta-IN'
        ? 'கேட்கிறது…'
        : 'Listening…'
      : phase === 'retry'
        ? "Didn't catch that. Tap the ball to try again."
        : phase === 'denied'
          ? 'Allow microphone access to search by voice.'
          : 'Voice search is not available on this phone.';

  return (
    <Modal
      visible={visible}
      animationType="fade"
      transparent={false}
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <StatusBar barStyle="dark-content" backgroundColor="#FFFFFF" />
      <View style={styles.screen} testID="voice-search-overlay">
        <View style={styles.topRow}>
          <TouchableOpacity
            onPress={onClose}
            style={styles.close}
            accessibilityRole="button"
            accessibilityLabel="Close voice search"
            testID="voice-search-close"
          >
            <MaterialIcons name="close" size={26} color="#1B1F1D" />
          </TouchableOpacity>
          <View style={styles.langToggle}>
            {(['en-IN', 'ta-IN'] as Lang[]).map(l => (
              <TouchableOpacity
                key={l}
                onPress={() => switchLang(l)}
                style={[styles.langBtn, lang === l && styles.langBtnOn]}
                testID={`voice-lang-${l}`}
              >
                <Text style={[styles.langText, lang === l && styles.langTextOn]}>
                  {l === 'en-IN' ? 'EN' : 'தமிழ்'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        <View style={styles.centre}>
          <TouchableOpacity
            activeOpacity={0.85}
            disabled={phase === 'listening'}
            onPress={() => (phase === 'denied' ? Linking.openSettings() : start(lang))}
            accessibilityRole="button"
            accessibilityLabel={phase === 'listening' ? 'Listening' : 'Try again'}
            testID="voice-search-ball"
          >
            <LottieView
              source={require('@/assets/lottie/voice-listening.json')}
              autoPlay
              loop
              speed={phase === 'listening' ? 1 : 0.4}
              style={[styles.ball, phase !== 'listening' && styles.ballIdle]}
            />
          </TouchableOpacity>

          <Text style={styles.status}>{status}</Text>
          {!!transcript && (
            <Text style={styles.transcript} numberOfLines={3}>
              “{transcript}”
            </Text>
          )}
          {phase === 'listening' && !transcript && <Text style={styles.hint}>{HINTS[lang]}</Text>}
          {phase === 'denied' && (
            <TouchableOpacity
              style={styles.settingsBtn}
              onPress={() => Linking.openSettings()}
              testID="voice-open-settings"
            >
              <Text style={styles.settingsText}>Open settings</Text>
            </TouchableOpacity>
          )}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#FFFFFF', paddingTop: 44 },
  topRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
  },
  close: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  langToggle: {
    flexDirection: 'row',
    backgroundColor: '#F1F4F2',
    borderRadius: 20,
    padding: 3,
  },
  langBtn: { paddingHorizontal: 14, paddingVertical: 6, borderRadius: 17 },
  langBtnOn: { backgroundColor: '#FFFFFF', elevation: 2 },
  langText: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 13,
    letterSpacing: 0.2,
    color: '#6B7671',
  },
  langTextOn: { color: '#0A7A3C' },
  centre: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 28,
    paddingBottom: 80,
  },
  ball: { width: 260, height: 260 },
  ballIdle: { opacity: 0.55 },
  status: {
    fontFamily: 'Poppins',
    fontWeight: '600',
    fontSize: 18,
    lineHeight: 26,
    letterSpacing: 0.1,
    color: '#1B1F1D',
    textAlign: 'center',
    marginTop: 12,
  },
  transcript: {
    fontFamily: 'Poppins',
    fontWeight: '500',
    fontSize: 22,
    lineHeight: 30,
    letterSpacing: 0.1,
    color: '#0A7A3C',
    textAlign: 'center',
    marginTop: 14,
  },
  hint: {
    fontFamily: 'Poppins',
    fontWeight: '400',
    fontSize: 14,
    letterSpacing: 0.1,
    color: '#8A938F',
    textAlign: 'center',
    marginTop: 10,
  },
  settingsBtn: {
    marginTop: 18,
    backgroundColor: '#00B14F',
    borderRadius: 12,
    paddingHorizontal: 20,
    paddingVertical: 10,
  },
  settingsText: {
    fontFamily: 'Poppins',
    fontWeight: '700',
    fontSize: 14,
    letterSpacing: 0.2,
    color: '#FFFFFF',
  },
});
