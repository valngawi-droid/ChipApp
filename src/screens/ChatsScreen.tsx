import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { useAnimatedScrollHandler, useSharedValue } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore, type Chat } from '../state/useAppStore';
import { formatListTimestamp } from '../utils/format';
import { haptics } from '../utils/haptics';
import Avatar from '../components/Avatar';
import IOSNavigationBar from '../components/iOSNavigationBar';
import SearchBar from '../components/SearchBar';
import IOSActionSheet from '../components/iOSActionSheet';
import type { RootStackParamList } from '../navigation/types';

type Nav = NativeStackNavigationProp<RootStackParamList>;

const ChatRow: React.FC<{
  chat: Chat;
  typing: boolean;
  onPress: () => void;
  onLongPress: () => void;
}> = ({ chat, typing, onPress, onLongPress }) => {
  const { colors, typography, layout } = useTheme();
  const { locale, t } = useLocalization();

  return (
    <Pressable
      onPress={onPress}
      onLongPress={onLongPress}
      accessibilityRole="button"
      accessibilityLabel={`${chat.name}, ${chat.unreadCount} unread`}
      style={({ pressed }) => [styles.row, { backgroundColor: pressed ? colors.fill : 'transparent' }]}
    >
      <Avatar name={chat.name} color={chat.avatarColor} size={layout.avatarLg} online={chat.online} />

      <View style={styles.rowBody}>
        <View style={styles.rowTop}>
          <Text
            numberOfLines={1}
            style={[
              typography.body,
              { color: colors.label, fontWeight: chat.unreadCount ? '600' : '400', flexShrink: 1 },
            ]}
          >
            {chat.name}
          </Text>
          <View style={styles.rowMeta}>
            {chat.pinned && <Ionicons name="pin" size={12} color={colors.tertiaryLabel} />}
            <Text style={[typography.footnote, { color: chat.unreadCount ? colors.brand : colors.secondaryLabel }]}>
              {formatListTimestamp(chat.timestamp, locale, { today: t('today'), yesterday: t('yesterday') })}
            </Text>
            <Ionicons name="chevron-forward" size={14} color={colors.tertiaryLabel} />
          </View>
        </View>

        <View style={styles.rowBottom}>
          <Text
            numberOfLines={2}
            style={[
              typography.subheadline,
              { color: typing ? colors.brand : colors.secondaryLabel, flex: 1, fontStyle: typing ? 'italic' : 'normal' },
            ]}
          >
            {typing ? t('typing') : chat.lastMessage}
          </Text>
          <View style={styles.badges}>
            {chat.muted && <Ionicons name="volume-mute" size={15} color={colors.tertiaryLabel} />}
            {chat.unreadCount > 0 && (
              <View style={[styles.unread, { backgroundColor: colors.brand }]}>
                <Text style={[typography.caption2, styles.unreadText]}>{chat.unreadCount}</Text>
              </View>
            )}
          </View>
        </View>
      </View>
    </Pressable>
  );
};

export const ChatsScreen: React.FC = () => {
  const navigation = useNavigation<Nav>();
  const { colors, typography } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const chats = useAppStore((s) => s.chats);
  const typingChatIds = useAppStore((s) => s.typingChatIds);
  const togglePinned = useAppStore((s) => s.togglePinned);
  const toggleMuted = useAppStore((s) => s.toggleMuted);
  const deleteChat = useAppStore((s) => s.deleteChat);
  const markChatRead = useAppStore((s) => s.markChatRead);

  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState(false);
  const [sheetChat, setSheetChat] = useState<Chat | null>(null);

  const scrollY = useSharedValue(0);
  const onScroll = useAnimatedScrollHandler((e) => {
    scrollY.value = e.contentOffset.y;
  });

  const data = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? chats.filter(
          (c) => c.name.toLowerCase().includes(q) || c.lastMessage.toLowerCase().includes(q)
        )
      : chats;
    return [...filtered].sort((a, b) => {
      if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
      return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime();
    });
  }, [chats, query]);

  const openChat = (chat: Chat) => {
    haptics.selection();
    markChatRead(chat.id);
    navigation.navigate('ChatRoom', { chatId: chat.id });
  };

  return (
    <View style={[styles.flex, { backgroundColor: colors.systemBackground }]}>
      <IOSNavigationBar
        title={t('chats')}
        scrollY={scrollY}
        leftActions={[
          {
            key: 'edit',
            label: editing ? t('done') : t('edit'),
            onPress: () => setEditing((v) => !v),
          },
        ]}
        rightActions={[
          { key: 'camera', icon: 'camera-outline', onPress: () => {}, accessibilityLabel: t('camera') },
          {
            key: 'new',
            icon: 'create-outline',
            onPress: () => navigation.navigate('NewChat'),
            accessibilityLabel: t('newChat'),
          },
        ]}
      />

      <Animated.ScrollView
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentInsetAdjustmentBehavior="automatic"
        contentContainerStyle={{ paddingBottom: insets.bottom + 80 }}
        style={{ backgroundColor: colors.systemBackground }}
      >
        <View style={{ backgroundColor: colors.secondarySystemBackground }}>
          <SearchBar value={query} onChangeText={setQuery} />
        </View>

        {data.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="chatbubbles-outline" size={44} color={colors.tertiaryLabel} />
            <Text style={[typography.subheadline, { color: colors.secondaryLabel }]}>
              {t('noResults')}
            </Text>
          </View>
        ) : (
          data.map((chat, index) => (
            <View key={chat.id}>
              {index > 0 && (
                <View style={[styles.separator, { backgroundColor: colors.separator }]} />
              )}
              <ChatRow
                chat={chat}
                typing={typingChatIds.includes(chat.id)}
                onPress={() => openChat(chat)}
                onLongPress={() => {
                  haptics.medium();
                  setSheetChat(chat);
                }}
              />
            </View>
          ))
        )}

        <View style={styles.encFooter}>
          <Ionicons name="lock-closed" size={11} color={colors.tertiaryLabel} />
          <Text style={[typography.caption1, { color: colors.tertiaryLabel }]}>
            {t('endToEndEncrypted')}
          </Text>
        </View>
      </Animated.ScrollView>

      <IOSActionSheet
        visible={!!sheetChat}
        title={sheetChat?.name}
        onClose={() => setSheetChat(null)}
        options={
          sheetChat
            ? [
                {
                  key: 'pin',
                  label: sheetChat.pinned ? t('unpinChat') : t('pinChat'),
                  icon: 'pin-outline',
                  onPress: () => togglePinned(sheetChat.id),
                },
                {
                  key: 'mute',
                  label: sheetChat.muted ? t('unmuteChat') : t('muteChat'),
                  icon: 'volume-mute-outline',
                  onPress: () => toggleMuted(sheetChat.id),
                },
                {
                  key: 'delete',
                  label: t('delete'),
                  icon: 'trash-outline',
                  destructive: true,
                  onPress: () => deleteChat(sheetChat.id),
                },
              ]
            : []
        }
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingVertical: 9 },
  rowBody: { flex: 1, gap: 2 },
  rowTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8 },
  rowMeta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  rowBottom: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  badges: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingTop: 2 },
  unread: { minWidth: 21, height: 21, borderRadius: 10.5, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
  unreadText: { color: '#FFFFFF', fontWeight: '600' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 77 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 80, gap: 10 },
  encFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 22 },
});

export default ChatsScreen;
