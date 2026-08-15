import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useNavigation } from '@react-navigation/native';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import { formatDuration, formatListTimestamp } from '../utils/format';
import { haptics } from '../utils/haptics';
import Avatar from '../components/Avatar';
import IOSNavigationBar from '../components/iOSNavigationBar';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

export const CallsScreen: React.FC = () => {
  const { colors, typography, radius } = useTheme();
  const { t, locale } = useLocalization();
  const insets = useSafeAreaInsets();
  const navigation = useNavigation<Nav>();

  const calls = useAppStore((s) => s.calls);
  const [filter, setFilter] = useState<'all' | 'missed'>('all');

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const data = useMemo(
    () => (filter === 'missed' ? calls.filter((c) => c.direction === 'missed') : calls),
    [calls, filter]
  );

  return (
    <View style={[styles.flex, { backgroundColor: colors.systemBackground }]}>
      <IOSNavigationBar
        title={t('calls')}
        scrollY={scrollY}
        leftActions={[{ key: 'edit', label: t('edit'), onPress: () => {} }]}
        rightActions={[{ key: 'add', icon: 'add', onPress: () => {} }]}
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
      >
        {/* Segmented control */}
        <View style={[styles.segmentWrap, { backgroundColor: colors.secondarySystemBackground }]}>
          <View style={[styles.segment, { backgroundColor: colors.searchField, borderRadius: 9 }]}>
            {(['all', 'missed'] as const).map((key) => {
              const active = filter === key;
              return (
                <Pressable
                  key={key}
                  onPress={() => {
                    haptics.selection();
                    setFilter(key);
                  }}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[
                    styles.segmentItem,
                    active && { backgroundColor: colors.secondaryGroupedBackground, borderRadius: 7 },
                  ]}
                >
                  <Text
                    style={[
                      typography.subheadline,
                      { color: colors.label, fontWeight: active ? '600' : '400' },
                    ]}
                  >
                    {key === 'all' ? 'All' : t('missedCall')}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        <Pressable
          style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
          accessibilityRole="button"
        >
          <View style={[styles.linkIcon, { backgroundColor: colors.brand, borderRadius: radius.md }]}>
            <Ionicons name="link" size={20} color="#FFFFFF" />
          </View>
          <Text style={[typography.body, { color: colors.accent, flex: 1 }]}>Create Call Link</Text>
        </Pressable>

        <Text style={[typography.footnote, styles.sectionHeader, { color: colors.secondaryLabel, backgroundColor: colors.secondarySystemBackground }]}>
          {'Recent'.toUpperCase()}
        </Text>

        {data.map((call, i) => {
          const missed = call.direction === 'missed';
          return (
            <View key={call.id}>
              {i > 0 && <View style={[styles.separator, { backgroundColor: colors.separator }]} />}
              <Pressable
                onPress={() => {
                  haptics.selection();
                  navigation.navigate('Call', {
                    name: call.name,
                    color: call.avatarColor,
                    video: call.video,
                    incoming: false,
                  });
                }}
                accessibilityRole="button"
                accessibilityLabel={`${call.name}, ${call.direction} ${call.video ? 'video' : 'voice'} call`}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
              >
                <Avatar name={call.name} color={call.avatarColor} size={44} />
                <View style={styles.rowBody}>
                  <Text
                    numberOfLines={1}
                    style={[typography.body, { color: missed ? colors.destructive : colors.label }]}
                  >
                    {call.name}
                  </Text>
                  <View style={styles.metaRow}>
                    <Ionicons
                      name={
                        call.direction === 'outgoing'
                          ? 'arrow-up-outline'
                          : missed
                          ? 'close-outline'
                          : 'arrow-down-outline'
                      }
                      size={13}
                      color={missed ? colors.destructive : colors.secondaryLabel}
                    />
                    <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                      {missed
                        ? t('missedCall')
                        : `${call.direction === 'incoming' ? t('incoming') : t('outgoing')} · ${formatDuration(call.durationSec)}`}
                    </Text>
                  </View>
                </View>
                <Text style={[typography.footnote, { color: colors.secondaryLabel }]}>
                  {formatListTimestamp(call.timestamp, locale, { today: t('today'), yesterday: t('yesterday') })}
                </Text>
                <Ionicons name={call.video ? 'videocam' : 'call'} size={20} color={colors.accent} />
              </Pressable>
            </View>
          );
        })}

        <View style={styles.encFooter}>
          <Ionicons name="lock-closed" size={11} color={colors.tertiaryLabel} />
          <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
            {t('endToEndEncrypted')}
          </Text>
        </View>
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  segmentWrap: { paddingHorizontal: 16, paddingBottom: 10 },
  segment: { flexDirection: 'row', padding: 2 },
  segmentItem: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 6 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  rowBody: { flex: 1, gap: 2 },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  linkIcon: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 72 },
  sectionHeader: { paddingHorizontal: 16, paddingVertical: 6 },
  encFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 22 },
});

export default CallsScreen;
