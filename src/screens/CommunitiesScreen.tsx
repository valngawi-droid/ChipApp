import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  FadeIn,
  useAnimatedScrollHandler,
  useSharedValue,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import { haptics } from '../utils/haptics';
import Avatar from '../components/Avatar';
import IOSNavigationBar from '../components/iOSNavigationBar';

const compact = (n: number) => {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(0)}K`;
  return String(n);
};

export const CommunitiesScreen: React.FC = () => {
  const { colors, typography, radius } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const communities = useAppStore((s) => s.communities);
  const channels = useAppStore((s) => s.channels);
  const [expanded, setExpanded] = useState<string | null>(communities[0]?.id ?? null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  return (
    <View style={[styles.flex, { backgroundColor: colors.systemBackground }]}>
      <IOSNavigationBar
        title={t('communities')}
        scrollY={scrollY}
        rightActions={[{ key: 'new', icon: 'add', onPress: () => {}, accessibilityLabel: t('createCommunity') }]}
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
          <View style={[styles.newIcon, { backgroundColor: colors.fill, borderRadius: radius.lg }]}>
            <Ionicons name="people" size={24} color={colors.secondaryLabel} />
          </View>
          <View style={styles.rowBody}>
            <Text style={[typography.body, { color: colors.label }]}>{t('createCommunity')}</Text>
            <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={2}>
              {t('communitiesSubtitle')}
            </Text>
          </View>
        </Pressable>

        {communities.map((community) => {
          const open = expanded === community.id;
          return (
            <View key={community.id} style={styles.community}>
              <Pressable
                onPress={() => {
                  haptics.selection();
                  setExpanded(open ? null : community.id);
                }}
                accessibilityRole="button"
                accessibilityState={{ expanded: open }}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
              >
                <Avatar name={community.name} color={community.avatarColor} size={52} />
                <View style={styles.rowBody}>
                  <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
                    {community.name}
                  </Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
                    {community.groups.length} groups · {community.description}
                  </Text>
                </View>
                <Ionicons name={open ? 'chevron-down' : 'chevron-forward'} size={17} color={colors.tertiaryLabel} />
              </Pressable>

              {open &&
                community.groups.map((group) => (
                  <Animated.View key={group.id} entering={FadeIn.duration(160)}>
                    <Pressable
                      onPress={haptics.selection}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.groupRow,
                        { backgroundColor: pressed ? colors.fill : 'transparent' },
                      ]}
                    >
                      <View style={[styles.groupIcon, { backgroundColor: colors.fill, borderRadius: radius.md }]}>
                        <Ionicons
                          name={group.name === 'Announcements' ? 'megaphone' : 'chatbubbles'}
                          size={17}
                          color={colors.secondaryLabel}
                        />
                      </View>
                      <View style={styles.rowBody}>
                        <Text style={[typography.subheadline, { color: colors.label }]} numberOfLines={1}>
                          {group.name}
                        </Text>
                        <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                          {group.lastMessage}
                        </Text>
                      </View>
                      {group.unread > 0 && (
                        <View style={[styles.badge, { backgroundColor: colors.brand }]}>
                          <Text style={[typography.caption2, { color: '#FFFFFF', fontWeight: '600' }]}>
                            {group.unread}
                          </Text>
                        </View>
                      )}
                    </Pressable>
                  </Animated.View>
                ))}
            </View>
          );
        })}

        <Text style={[typography.footnote, styles.sectionHeader, { color: colors.secondaryLabel, backgroundColor: colors.secondarySystemBackground }]}>
          {t('channels').toUpperCase()}
        </Text>

        {channels.map((channel, i) => (
          <View key={channel.id}>
            {i > 0 && <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
            <Pressable
              onPress={haptics.selection}
              accessibilityRole="button"
              style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
            >
              <Avatar name={channel.name} color={channel.avatarColor} size={46} />
              <View style={styles.rowBody}>
                <View style={styles.nameRow}>
                  <Text style={[typography.body, { color: colors.label, fontWeight: '600' }]} numberOfLines={1}>
                    {channel.name}
                  </Text>
                  {channel.verified && <Ionicons name="checkmark-circle" size={15} color={colors.accent} />}
                </View>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>
                  {channel.latest}
                </Text>
                <Text style={[typography.caption2, { color: colors.tertiaryLabel }]}>
                  {compact(channel.followers)} {t('followers')}
                </Text>
              </View>
            </Pressable>
          </View>
        ))}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 10 },
  rowBody: { flex: 1, gap: 2 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  newIcon: { width: 52, height: 52, alignItems: 'center', justifyContent: 'center' },
  community: { marginTop: 6 },
  groupRow: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingStart: 40, paddingEnd: 16, paddingVertical: 8 },
  groupIcon: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  badge: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 74 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 6, marginTop: 14 },
});

export default CommunitiesScreen;
