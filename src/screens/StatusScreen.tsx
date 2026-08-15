import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore, type StatusUpdate } from '../state/useAppStore';
import { formatListTimestamp } from '../utils/format';
import { haptics } from '../utils/haptics';
import Avatar from '../components/Avatar';
import IOSNavigationBar from '../components/iOSNavigationBar';
import StatusViewer from './StatusViewer';

const StatusRow: React.FC<{ item: StatusUpdate; onPress: () => void }> = ({ item, onPress }) => {
  const { colors, typography } = useTheme();
  const { locale, t } = useLocalization();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`${item.name} status`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
    >
      <Avatar name={item.name} color={item.avatarColor} size={54} ring={item.viewed ? 'seen' : 'unseen'} />
      <View style={styles.rowBody}>
        <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
          {item.name}
        </Text>
        <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
          {formatListTimestamp(item.timestamp, locale, { today: t('today'), yesterday: t('yesterday') })}
        </Text>
      </View>
    </Pressable>
  );
};

export const StatusScreen: React.FC = () => {
  const { colors, typography } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const statuses = useAppStore((s) => s.statuses);
  const markStatusViewed = useAppStore((s) => s.markStatusViewed);
  const user = useAppStore((s) => s.user);

  const [viewing, setViewing] = useState<StatusUpdate | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const recent = statuses.filter((s) => !s.viewed);
  const viewed = statuses.filter((s) => s.viewed);

  const open = (item: StatusUpdate) => {
    haptics.selection();
    setViewing(item);
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.systemBackground }]}>
      <IOSNavigationBar
        title={t('status')}
        scrollY={scrollY}
        leftActions={[{ key: 'privacy', label: t('privacy'), onPress: () => {} }]}
        rightActions={[{ key: 'camera', icon: 'camera-outline', onPress: () => {} }]}
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        <Pressable
          onPress={haptics.selection}
          accessibilityRole="button"
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
        >
          <View>
            <Avatar name={user?.name ?? 'Me'} color={colors.placeholder} size={54} />
            <View style={[styles.plus, { backgroundColor: colors.brand, borderColor: colors.systemBackground }]}>
              <Ionicons name="add" size={14} color="#FFFFFF" />
            </View>
          </View>
          <View style={styles.rowBody}>
            <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]}>{t('myStatus')}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>{t('tapToAddStatus')}</Text>
          </View>
        </Pressable>

        {recent.length > 0 && (
          <>
            <Text style={[typography.footnote, styles.sectionHeader, { color: colors.secondaryLabel, backgroundColor: colors.secondarySystemBackground }]}>
              {t('recentUpdates').toUpperCase()}
            </Text>
            {recent.map((s) => (
              <StatusRow key={s.id} item={s} onPress={() => open(s)} />
            ))}
          </>
        )}

        {viewed.length > 0 && (
          <>
            <Text style={[typography.footnote, styles.sectionHeader, { color: colors.secondaryLabel, backgroundColor: colors.secondarySystemBackground }]}>
              {t('viewedUpdates').toUpperCase()}
            </Text>
            {viewed.map((s) => (
              <StatusRow key={s.id} item={s} onPress={() => open(s)} />
            ))}
          </>
        )}

        <Text style={[typography.caption1, styles.note, { color: colors.tertiaryLabel }]}>
          {t('statusPrivacyNote')}
        </Text>
      </Animated.ScrollView>

      <StatusViewer
        status={viewing}
        onClose={() => {
          if (viewing) markStatusViewed(viewing.id);
          setViewing(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 8 },
  rowBody: { flex: 1, gap: 2 },
  plus: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 22,
    height: 22,
    borderRadius: 11,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
  },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 6, marginTop: 8 },
  note: { textAlign: 'center', paddingHorizontal: 40, paddingVertical: 24, lineHeight: 17 },
});

export default StatusScreen;
