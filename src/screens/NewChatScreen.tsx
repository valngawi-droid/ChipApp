import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore } from '../state/useAppStore';
import { haptics } from '../utils/haptics';
import Avatar from '../components/Avatar';
import SearchBar from '../components/SearchBar';
import type { RootStackParamList } from '../navigation/types';
import { openDirectChat } from '../api/client';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const NewChatScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { colors, typography } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const token = useAppStore((s) => s.token);
  const peers = useAppStore((s) => s.peers);
  const user = useAppStore((s) => s.user);
  const upsertDirectChat = useAppStore((s) => s.upsertDirectChat);

  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = peers.filter((p) => p.id !== user?.id);
    return q
      ? list.filter((p) => p.name.toLowerCase().includes(q) || p.email.toLowerCase().includes(q))
      : list;
  }, [peers, query, user?.id]);

  const openPeer = async (peerId: string) => {
    const peer = peers.find((p) => p.id === peerId);
    if (!peer) return;
    haptics.selection();
    const roomId = upsertDirectChat(peer);
    // Best-effort hydrate history from the server; ignore failures (offline).
    if (token) {
      setBusyId(peerId);
      setError(null);
      try {
        await openDirectChat(token, peerId);
      } catch {
        // Local room still works; messages will sync when connected.
      } finally {
        setBusyId(null);
      }
    }
    navigation.replace('ChatRoom', { chatId: roomId });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.systemBackground }]}>
      <View style={[styles.header, { paddingTop: insets.top, backgroundColor: colors.secondarySystemBackground, borderBottomColor: colors.separator }]}>
        <View style={styles.headerRow}>
          <Pressable
            hitSlop={12}
            onPress={() => navigation.goBack()}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
          >
            <Ionicons name="chevron-back" size={30} color={colors.accent} />
          </Pressable>
          <Text style={[typography.headline, { color: colors.label, flex: 1 }]}>{t('newChat')}</Text>
        </View>
      </View>

      <View style={{ backgroundColor: colors.secondarySystemBackground }}>
        <SearchBar value={query} onChangeText={setQuery} />
      </View>

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}
      >
        {data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={42} color={colors.tertiaryLabel} />
            <Text style={[typography.subheadline, { color: colors.secondaryLabel }]}>{t('noResults')}</Text>
          </View>
        ) : (
          data.map((peer, i) => (
            <View key={peer.id}>
              {i > 0 && <View style={[styles.sep, { backgroundColor: colors.separator }]} />}
              <Pressable
                onPress={() => openPeer(peer.id)}
                disabled={busyId === peer.id}
                style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
                accessibilityRole="button"
              >
                <Avatar name={peer.name} color={peer.avatarColor} size={46} uri={peer.picture ?? undefined} online={peer.online} />
                <View style={styles.body}>
                  <Text style={[typography.body, { color: colors.label }]} numberOfLines={1}>{peer.name}</Text>
                  <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={1}>{peer.email}</Text>
                </View>
                {peer.online && <View style={[styles.dot, { backgroundColor: colors.brand }]} />}
              </Pressable>
            </View>
          ))
        )}
        {!!error && <Text style={[typography.footnote, styles.err, { color: colors.destructive }]}>{error}</Text>}
      </Animated.ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  header: { borderBottomWidth: StyleSheet.hairlineWidth },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, height: 52 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  body: { flex: 1, gap: 2 },
  dot: { width: 10, height: 10, borderRadius: 5 },
  sep: { height: StyleSheet.hairlineWidth, marginStart: 74 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  err: { textAlign: 'center', padding: 16 },
});

export default NewChatScreen;
