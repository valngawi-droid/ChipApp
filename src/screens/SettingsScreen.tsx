import React, { useState } from 'react';
import { Alert, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme, type ThemePreference } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import { haptics } from '../utils/haptics';
import { formatBytes, safetyNumber } from '../utils';
import Avatar from '../components/Avatar';
import IOSNavigationBar from '../components/iOSNavigationBar';
import LanguagePicker from '../components/LanguagePicker';
import IOSActionSheet from '../components/iOSActionSheet';
import { Row, Section } from '../components/GroupedList';
import { teardownSocket } from '../api/socket';
import type { RootStackParamList } from '../navigation/types';

export const SettingsScreen: React.FC = () => {
  const navigation = useNavigation<NativeStackNavigationProp<RootStackParamList>>();
  const { colors, typography, preference, setPreference, scheme } = useTheme();
  const { t, locale, languages, isManual } = useLocalization();
  const insets = useSafeAreaInsets();

  const user = useAppStore((s) => s.user);
  const logout = useAppStore((s) => s.logout);
  const connection = useAppStore((s) => s.connection);

  const [langOpen, setLangOpen] = useState(false);
  const [themeOpen, setThemeOpen] = useState(false);
  const [readReceipts, setReadReceipts] = useState(true);
  const [twoStep, setTwoStep] = useState(false);
  const [securityNotifications, setSecurityNotifications] = useState(true);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const currentLanguage = languages.find((l) => l.code === locale);
  const code = safetyNumber(user?.email ?? 'me@chipapp', 'peer@chipapp');

  const confirmSignOut = () => {
    haptics.warning();
    const doLogout = () => {
      teardownSocket();
      logout();
    };
    if (Platform.OS === 'web') {
      doLogout();
      return;
    }
    Alert.alert(t('signOut'), '', [
      { text: t('cancel'), style: 'cancel' },
      { text: t('signOut'), style: 'destructive', onPress: doLogout },
    ]);
  };

  const themeLabel: Record<ThemePreference, string> = {
    system: t('systemDefault'),
    light: t('light'),
    dark: t('dark'),
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.groupedBackground }]}>
      <IOSNavigationBar title={t('settings')} scrollY={scrollY} />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingTop: 18, paddingBottom: insets.bottom + 90 }}
      >
        {/* Profile card */}
        <Section>
          <Pressable
            onPress={() => navigation.navigate('Profile')}
            accessibilityRole="button"
            style={({ pressed }) => [styles.profile, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
          >
            <Avatar name={user?.name ?? t('defaultUser')} color={colors.brand} size={64} uri={user?.picture} />
            <View style={styles.profileBody}>
              <Text style={[typography.title3, { color: colors.label }]} numberOfLines={1}>
                {user?.name ?? t('defaultUser')}
              </Text>
              <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
                {user?.email ?? '—'}
              </Text>
              <View style={styles.statusRow}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: connection === 'connected' ? colors.brand : colors.warning },
                  ]}
                />
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
                  {connection === 'connected' ? t('connected') : connection === 'connecting' ? t('connecting') : t('offline')}
                </Text>
              </View>
            </View>
            <Ionicons name="qr-code" size={22} color={colors.accent} />
          </Pressable>
        </Section>

        <Section>
          <Row title={t('account')} icon="key" iconColor="#007AFF" showChevron onPress={haptics.selection} />
          <Row title={t('privacy')} icon="lock-closed" iconColor="#5856D6" showChevron onPress={haptics.selection} />
          <Row title={t('avatar')} icon="happy" iconColor="#34C759" showChevron onPress={haptics.selection} />
          <Row title={t('chatWallpaper')} icon="image" iconColor="#00C7BE" showChevron onPress={haptics.selection} />
          <Row title={t('notifications')} icon="notifications" iconColor="#FF3B30" showChevron onPress={haptics.selection} />
          <Row title={t('storage')} icon="server" iconColor="#34C759" value={formatBytes(78 * 1024 * 1024)} showChevron onPress={haptics.selection} />
        </Section>

        <Section header={t('security')} footer={t('encryptionNotice')}>
          <Row
            title={t('twoStep')}
            icon="shield-checkmark"
            iconColor="#FF9500"
            toggle={{ value: twoStep, onValueChange: (v) => { haptics.selection(); setTwoStep(v); } }}
          />
          <Row
            title={t('readReceipts')}
            icon="checkmark-done"
            iconColor="#0A84FF"
            toggle={{ value: readReceipts, onValueChange: (v) => { haptics.selection(); setReadReceipts(v); } }}
          />
          <Row
            title={t('securityNotifications')}
            icon="notifications-circle"
            iconColor="#5856D6"
            toggle={{ value: securityNotifications, onValueChange: (v) => { haptics.selection(); setSecurityNotifications(v); } }}
          />
        </Section>

        <Section header={t('safetyNumber')} footer={t('safetyNumberFooter')}>
          <View style={styles.codeGrid}>
            {code.map((group, i) => (
              <Text key={i} style={[typography.callout, styles.codeGroup, { color: colors.secondaryLabel }]}>
                {group}
              </Text>
            ))}
          </View>
        </Section>

        <Section header={t('language')}>
          <Row
            title={t('selectLanguage')}
            icon="globe"
            iconColor="#5AC8FA"
            value={`${currentLanguage?.flag ?? ''} ${currentLanguage?.nativeName ?? ''}${isManual ? '' : ` (${t('systemDefault')})`}`}
            showChevron
            onPress={() => {
              haptics.selection();
              setLangOpen(true);
            }}
          />
          <Row
            title={t('appearance')}
            icon={scheme === 'dark' ? 'moon' : 'sunny'}
            iconColor="#000000"
            value={themeLabel[preference]}
            showChevron
            onPress={() => {
              haptics.selection();
              setThemeOpen(true);
            }}
          />
        </Section>

        <Section>
          <Row title={t('starredMessages')} icon="star" iconColor="#FF9500" showChevron onPress={haptics.selection} />
          <Row title={t('linkedDevices')} icon="laptop" iconColor="#30B0C7" showChevron onPress={haptics.selection} />
          <Row title={t('help')} icon="help-circle" iconColor="#007AFF" showChevron onPress={haptics.selection} />
          <Row title={t('inviteFriend')} icon="heart" iconColor="#FF2D55" showChevron onPress={haptics.selection} />
        </Section>

        <Section footer={`ChipApp 4.3.0 · Build 4300${'\n'}${t('madeWithLove')}`}>
          <Row title={t('signOut')} destructive onPress={confirmSignOut} />
        </Section>
      </Animated.ScrollView>

      <LanguagePicker visible={langOpen} onClose={() => setLangOpen(false)} />

      <IOSActionSheet
        visible={themeOpen}
        title={t('appearance')}
        onClose={() => setThemeOpen(false)}
        options={[
          {
            key: 'system',
            label: t('appearanceSystem'),
            icon: 'phone-portrait-outline',
            onPress: () => setPreference('system'),
          },
          {
            key: 'light',
            label: t('appearanceLight'),
            icon: 'sunny-outline',
            onPress: () => setPreference('light'),
          },
          {
            key: 'dark',
            label: t('appearanceDark'),
            icon: 'moon-outline',
            onPress: () => setPreference('dark'),
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  profile: { flexDirection: 'row', alignItems: 'center', gap: 14, padding: 12 },
  profileBody: { flex: 1, gap: 2 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 2 },
  dot: { width: 7, height: 7, borderRadius: 3.5 },
  codeGrid: { flexDirection: 'row', flexWrap: 'wrap', padding: 14, gap: 10, justifyContent: 'center' },
  codeGroup: { fontVariant: ['tabular-nums'], letterSpacing: 1.5 },
});

export default SettingsScreen;
