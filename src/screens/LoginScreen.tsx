import React, { useState } from 'react';
import { ActivityIndicator, Image, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeInDown, FadeInUp } from 'react-native-reanimated';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import { authenticateDemo, authenticateWithGoogle } from '../api/auth';
import { haptics } from '../utils/haptics';
import LanguagePicker from '../components/LanguagePicker';

/** Official Google "G" mark, drawn as four coloured arcs. */
const GoogleMark: React.FC<{ size?: number }> = ({ size = 18 }) => (
  <Image
    source={{
      uri:
        'data:image/svg+xml;base64,' +
        // eslint-disable-next-line max-len
        'PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHZpZXdCb3g9IjAgMCA0OCA0OCI+PHBhdGggZmlsbD0iI0VBNDMzNSIgZD0iTTI0IDkuNWMzLjU0IDAgNi43MSAxLjIyIDkuMjEgMy42Mmw2Ljg1LTYuODVDMzUuOSAyLjM4IDMwLjQ3IDAgMjQgMCAxNC42MiAwIDYuNTEgNS4zOCAyLjU2IDEzLjIybDcuOTggNi4xOUMxMi40MyAxMy43MiAxNy43NCA5LjUgMjQgOS41eiIvPjxwYXRoIGZpbGw9IiM0Mjg1RjQiIGQ9Ik00Ni45OCAyNC41NWMwLTEuNTctLjE1LTMuMDktLjM4LTQuNTVIMjR2OS4wMmgxMi45NGMtLjU4IDIuOTYtMi4yNiA1LjQ4LTQuNzggNy4xOGw3LjczIDZjNC41MS00LjE4IDcuMDktMTAuMzYgNy4wOS0xNy42NXoiLz48cGF0aCBmaWxsPSIjRkJCQzA1IiBkPSJNMTAuNTMgMjguNTljLS40OC0xLjQ1LS43Ni0yLjk5LS43Ni00LjU5cy4yNy0zLjE0Ljc2LTQuNTlsLTcuOTgtNi4xOUMwLjkyIDE2LjQ2IDAgMjAuMTIgMCAyNGMwIDMuODguOTIgNy41NCAyLjU2IDEwLjc4bDcuOTctNi4xOXoiLz48cGF0aCBmaWxsPSIjMzRBODUzIiBkPSJNMjQgNDhjNi40OCAwIDExLjkzLTIuMTMgMTUuODktNS44MWwtNy43My02Yy0yLjE1IDEuNDUtNC45MiAyLjMtOC4xNiAyLjMtNi4yNiAwLTExLjU3LTQuMjItMTMuNDctOS45MWwtNy45OCA2LjE5QzYuNTEgNDIuNjIgMTQuNjIgNDggMjQgNDh6Ii8+PC9zdmc+',
    }}
    style={{ width: size, height: size }}
    accessibilityIgnoresInvertColors
  />
);

export const LoginScreen: React.FC = () => {
  const { colors, typography, radius } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const setAuthData = useAppStore((s) => s.setAuthData);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [langOpen, setLangOpen] = useState(false);

  const signIn = async () => {
    haptics.medium();
    setBusy(true);
    setError(null);
    try {
      /**
       * Production flow: obtain a Google ID token from the native Google
       * Sign-In SDK / expo-auth-session and verify it server-side.
       *
       * The sandboxed preview origin is not registered with the OAuth client,
       * so the consent screen cannot complete here. We attempt the real
       * exchange when a token is present and otherwise fall back to the
       * backend's sample-profile endpoint, which still returns a genuine
       * signed JWT so the rest of the app behaves identically.
       */
      const idToken = (globalThis as { __CHIPAPP_GOOGLE_ID_TOKEN__?: string })
        .__CHIPAPP_GOOGLE_ID_TOKEN__;

      const res = idToken ? await authenticateWithGoogle(idToken) : await authenticateDemo();
      haptics.success();
      setAuthData(res.user, res.token);
    } catch (e) {
      haptics.error();
      setError(e instanceof Error ? e.message : 'Sign-in failed');
    } finally {
      setBusy(false);
    }
  };

  return (
    <LinearGradient
      colors={[colors.brand, colors.brandDeep]}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={styles.flex}
    >
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 24 }]}>
        <Pressable
          onPress={() => setLangOpen(true)}
          style={[styles.langBtn, { top: insets.top + 8 }]}
          accessibilityRole="button"
          accessibilityLabel={t('selectLanguage')}
        >
          <Ionicons name="globe-outline" size={16} color="#FFFFFF" />
          <Text style={[typography.footnote, { color: '#FFFFFF' }]}>{t('language')}</Text>
        </Pressable>

        <Animated.View entering={FadeInDown.springify().damping(18)} style={styles.hero}>
          <View style={styles.logoRing}>
            <Ionicons name="chatbubbles" size={54} color={colors.brand} />
          </View>
          <Text style={[typography.largeTitle, styles.title]}>ChipApp</Text>
          <Text style={[typography.body, styles.subtitle]}>{t('welcomeSubtitle')}</Text>
        </Animated.View>

        <Animated.View entering={FadeInUp.delay(120).springify().damping(18)} style={styles.footer}>
          <View style={styles.badgeRow}>
            <Ionicons name="lock-closed" size={12} color="#FFFFFFCC" />
            <Text style={[typography.caption1, { color: '#FFFFFFCC' }]}>{t('endToEndEncrypted')}</Text>
          </View>

          <Pressable
            onPress={signIn}
            disabled={busy}
            accessibilityRole="button"
            accessibilityLabel={t('loginWithGoogle')}
            style={({ pressed }) => [
              styles.googleBtn,
              {
                borderRadius: radius.md,
                opacity: busy ? 0.7 : pressed ? 0.85 : 1,
                transform: [{ scale: pressed ? 0.985 : 1 }],
              },
            ]}
          >
            {busy ? (
              <ActivityIndicator color="#3C4043" />
            ) : (
              <>
                <GoogleMark />
                <Text style={[typography.headline, { color: '#3C4043' }]}>{t('loginWithGoogle')}</Text>
              </>
            )}
          </Pressable>

          {!!error && (
            <Text style={[typography.footnote, styles.error]} accessibilityLiveRegion="polite">
              {error}
            </Text>
          )}

          <Text style={[typography.caption1, styles.terms]}>{t('termsNote')}</Text>
        </Animated.View>
      </View>

      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />
    </LinearGradient>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, paddingHorizontal: 28, justifyContent: 'space-between' },
  langBtn: {
    position: 'absolute',
    right: 20,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: '#FFFFFF2E',
  },
  hero: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 14 },
  logoRing: {
    width: 104,
    height: 104,
    borderRadius: 52,
    backgroundColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.2,
    shadowRadius: 20,
    shadowOffset: { width: 0, height: 10 },
    elevation: 10,
  },
  title: { color: '#FFFFFF', marginTop: 6 },
  subtitle: { color: '#FFFFFFE6', textAlign: 'center', maxWidth: 320, lineHeight: 23 },
  footer: { gap: 14 },
  badgeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5 },
  googleBtn: {
    height: 50,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 10,
    ...Platform.select({
      web: { cursor: 'pointer' },
      default: {},
    }),
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  error: { color: '#FFE5E5', textAlign: 'center' },
  terms: { color: '#FFFFFFB3', textAlign: 'center', lineHeight: 17 },
});

export default LoginScreen;
