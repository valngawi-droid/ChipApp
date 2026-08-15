import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import Avatar from '../components/Avatar';
import { Row, Section } from '../components/GroupedList';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ProfileScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { colors, typography } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const user = useAppStore((s) => s.user);
  const connection = useAppStore((s) => s.connection);

  const name = user?.name ?? t('defaultUser');
  const email = user?.email ?? '';
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0])
    .join('')
    .toUpperCase();

  return (
    <View style={[styles.flex, { backgroundColor: colors.groupedBackground }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.secondarySystemBackground, borderBottomColor: colors.separator }]}>
        <Pressable hitSlop={12} onPress={() => navigation.goBack()} accessibilityRole="button" accessibilityLabel={t('back')}>
          <Ionicons name="chevron-back" size={30} color={colors.accent} />
        </Pressable>
        <Text style={[typography.headline, { flex: 1, color: colors.label }]}>{t('profile')}</Text>
      </View>

      <ScrollView contentContainerStyle={{ paddingTop: 24, paddingBottom: insets.bottom + 40 }}>
        <View style={styles.hero}>
          <Avatar name={name} color={user?.avatarColor ?? colors.brand} size={92} uri={user?.picture ?? undefined} />
          <Text style={[typography.title2, { color: colors.label, marginTop: 12 }]}>{name}</Text>
          <Text style={[typography.subheadline, { color: colors.secondaryLabel }]}>{email}</Text>
          <View style={styles.statusRow}>
            <View style={[styles.dot, { backgroundColor: connection === 'connected' ? colors.brand : colors.warning }]} />
            <Text style={[typography.caption1, { color: colors.secondaryLabel }]}>
              {connection === 'connected' ? t('connected') : connection === 'connecting' ? t('connecting') : t('offline')}
            </Text>
          </View>
        </View>

        <Section>
          <Row title={t('account')} icon="person" iconColor="#007AFF" value={user?.googleId ? 'Google' : 'Demo'} showChevron />
          <Row title={t('privacy')} icon="lock-closed" iconColor="#5856D6" showChevron />
          <Row title={t('notifications')} icon="notifications" iconColor="#FF3B30" showChevron />
          <Row title={t('help')} icon="help-circle" iconColor="#34C759" showChevron />
        </Section>

        <View style={styles.qrRow}>
          <Text style={[typography.caption1, { color: colors.secondaryLabel, letterSpacing: 1 }]}>
            {initials} · {user?.id ?? 'local'}
          </Text>
        </View>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 52, borderBottomWidth: StyleSheet.hairlineWidth },
  hero: { alignItems: 'center', paddingVertical: 20, gap: 4 },
  statusRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 8 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  qrRow: { alignItems: 'center', paddingTop: 18 },
});

export default ProfileScreen;
