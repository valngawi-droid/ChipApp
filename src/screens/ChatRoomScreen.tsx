import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';
import Animated, { FadeIn, FadeOut, useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { useAppStore, type Message } from '../state/useAppStore';
import { formatDaySeparator } from '../utils/format';
import { haptics } from '../utils/haptics';
import Avatar from '../components/Avatar';
import ChatBubble from '../components/ChatBubble';
import ReactionPicker from '../components/ChatBubble/ReactionPicker';
import IOSActionSheet from '../components/iOSActionSheet';
import StickerPicker from '../components/StickerPicker';
import type { RootStackParamList } from '../navigation/types';
import {
  emitReadReceipt,
  emitReaction,
  emitTyping,
  joinChat,
  leaveChat,
  sendWireMessage,
} from '../api/socket';

type Props = NativeStackScreenProps<RootStackParamList, 'ChatRoom'>;

export const ChatRoomScreen: React.FC<Props> = ({ route, navigation }) => {
  const { chatId } = route.params;
  const { colors, typography, radius, springs, layout } = useTheme();
  const { t, locale } = useLocalization();
  const insets = useSafeAreaInsets();

  const chat = useAppStore((s) => s.chats.find((c) => c.id === chatId));
  const sendMessage = useAppStore((s) => s.sendMessage);
  const updateMessageStatus = useAppStore((s) => s.updateMessageStatus);
  const toggleReaction = useAppStore((s) => s.toggleReaction);
  const setActiveChat = useAppStore((s) => s.setActiveChat);
  const markChatRead = useAppStore((s) => s.markChatRead);
  const typingChatIds = useAppStore((s) => s.typingChatIds);
  const user = useAppStore((s) => s.user);

  const [draft, setDraft] = useState('');
  const [replyTo, setReplyTo] = useState<Message | null>(null);
  const [attachOpen, setAttachOpen] = useState(false);
  const [stickerOpen, setStickerOpen] = useState(false);
  const [reactionTarget, setReactionTarget] = useState<{ message: Message; y: number } | null>(null);

  const listRef = useRef<ScrollView>(null);
  const sendScale = useSharedValue(0);
  const typingStopTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const hasDraft = draft.trim().length > 0;

  const clearTypingTimer = useCallback(() => {
    if (typingStopTimer.current) {
      clearTimeout(typingStopTimer.current);
      typingStopTimer.current = null;
    }
  }, []);

  const signalTyping = useCallback(
    (typing: boolean) => {
      emitTyping(chatId, typing);
      if (typing) {
        clearTypingTimer();
        typingStopTimer.current = setTimeout(() => emitTyping(chatId, false), 4000);
      }
    },
    [chatId, clearTypingTimer]
  );

  useEffect(() => {
    sendScale.value = withSpring(hasDraft ? 1 : 0, springs.snappy);
  }, [hasDraft, sendScale, springs.snappy]);

  useEffect(() => {
    setActiveChat(chatId);
    joinChat(chatId);
    markChatRead(chatId);
    // Let peers know their messages are read when opening the room.
    emitReadReceipt(chatId);
    return () => {
      clearTypingTimer();
      emitTyping(chatId, false);
      setActiveChat(null);
      leaveChat(chatId);
    };
  }, [chatId, setActiveChat, markChatRead, clearTypingTimer]);

  const sendStyle = useAnimatedStyle(() => ({
    transform: [{ scale: sendScale.value }],
    opacity: sendScale.value,
  }));
  const micStyle = useAnimatedStyle(() => ({
    transform: [{ scale: 1 - sendScale.value }],
    opacity: 1 - sendScale.value,
  }));

  const handleSend = useCallback(() => {
    const text = draft.trim();
    if (!text || !chat) return;

    const id = `local-${Date.now()}`;
    const timestamp = new Date().toISOString();

    haptics.light();
    sendMessage(chat.id, {
      id,
      text,
      isMe: true,
      timestamp,
      status: 'sending',
      kind: 'text',
      replyTo: replyTo
        ? {
            id: replyTo.id,
            author: replyTo.isMe ? t('you') : replyTo.authorName ?? chat.name,
            preview: replyTo.kind === 'voice' ? '🎤 Voice message' : replyTo.text,
          }
        : null,
    });

    sendWireMessage({ room: chat.id, id, text, timestamp, kind: 'text', author: user?.id });

    setDraft('');
    setReplyTo(null);
    signalTyping(false);

    requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
  }, [draft, chat, replyTo, sendMessage, updateMessageStatus, t, signalTyping]);

  const handleSendSticker = useCallback(
    (packId: string, stickerId: string, source: number) => {
      if (!chat) return;
      const id = `sticker-${Date.now()}`;
      const timestamp = new Date().toISOString();
      haptics.light();
      sendMessage(chat.id, {
        id,
        text: '',
        isMe: true,
        timestamp,
        status: 'sending',
        kind: 'sticker',
        stickerSource: source,
      });
      sendWireMessage({
        room: chat.id,
        id,
        text: `${packId}/${stickerId}`,
        timestamp,
        kind: 'sticker',
        author: user?.id,
      });
      requestAnimationFrame(() => listRef.current?.scrollToEnd({ animated: true }));
    },
    [chat, sendMessage, updateMessageStatus]
  );

  const grouped = useMemo(() => {
    if (!chat) return [];
    const out: { key: string; day: string; items: Message[] }[] = [];
    chat.messages.forEach((m) => {
      const day = formatDaySeparator(m.timestamp, locale, { today: t('today'), yesterday: t('yesterday') });
      const last = out[out.length - 1];
      if (last && last.day === day) last.items.push(m);
      else out.push({ key: `${day}-${m.id}`, day, items: [m] });
    });
    return out;
  }, [chat, locale, t]);

  if (!chat) {
    return (
      <View style={[styles.flex, styles.center, { backgroundColor: colors.systemBackground }]}>
        <Text style={[typography.body, { color: colors.secondaryLabel }]}>{t('chatUnavailable')}</Text>
      </View>
    );
  }

  const isTyping = typingChatIds.includes(chat.id);

  return (
    <View style={[styles.flex, { backgroundColor: colors.chatWallpaper }]}>
      {/* Navigation bar (contact header) */}
      <View
        style={[
          styles.header,
          { paddingTop: insets.top, backgroundColor: colors.secondarySystemBackground, borderBottomColor: colors.separator },
        ]}
      >
        <View style={[styles.headerRow, { height: layout.navBarHeight }]}>
          <Pressable
            onPress={() => navigation.goBack()}
            hitSlop={12}
            accessibilityRole="button"
            accessibilityLabel={t('back')}
            style={styles.back}
          >
            <Ionicons name="chevron-back" size={30} color={colors.accent} />
          </Pressable>

          <Pressable style={styles.headerCenter} accessibilityRole="button">
            <Avatar name={chat.name} color={chat.avatarColor} size={34} />
            <View style={styles.headerText}>
              <Text numberOfLines={1} style={[typography.headline, { color: colors.label, fontSize: 16 }]}>
                {chat.name}
              </Text>
              <Text numberOfLines={1} style={[typography.caption2, { color: isTyping ? colors.brand : colors.secondaryLabel }]}>
                {isTyping ? t('typing') : chat.online ? t('online') : t('tapForContactInfo')}
              </Text>
            </View>
          </Pressable>

          <View style={styles.headerActions}>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('videoCall')}
              onPress={() => navigation.navigate('Call', { name: chat.name, color: chat.avatarColor, video: true, incoming: false })}
            >
              <Ionicons name="videocam-outline" size={25} color={colors.accent} />
            </Pressable>
            <Pressable
              hitSlop={10}
              accessibilityRole="button"
              accessibilityLabel={t('audioCall')}
              onPress={() => navigation.navigate('Call', { name: chat.name, color: chat.avatarColor, video: false, incoming: false })}
            >
              <Ionicons name="call-outline" size={22} color={colors.accent} />
            </Pressable>
          </View>
        </View>
      </View>

      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        keyboardVerticalOffset={insets.top + layout.navBarHeight}
      >
        <ScrollView
          ref={listRef}
          style={styles.flex}
          contentContainerStyle={styles.listContent}
          onContentSizeChange={() => listRef.current?.scrollToEnd({ animated: false })}
          keyboardDismissMode="interactive"
        >
          {grouped.map((group) => (
            <View key={group.key}>
              <View style={styles.dayWrap}>
                <View style={[styles.dayChip, { backgroundColor: colors.bubbleIncoming }]}>
                  <Text style={[typography.caption2, { color: colors.secondaryLabel, fontWeight: '600' }]}>
                    {group.day}
                  </Text>
                </View>
              </View>

              {group.items.map((message, i) => {
                const next = group.items[i + 1];
                const prev = group.items[i - 1];
                return (
                  <ChatBubble
                    key={message.id}
                    message={message}
                    showTail={!next || next.isMe !== message.isMe || next.kind === 'system'}
                    showAuthor={chat.isGroup && (!prev || prev.isMe !== message.isMe || prev.authorName !== message.authorName)}
                    onReply={(m) => setReplyTo(m)}
                    onLongPress={(m, y) => setReactionTarget({ message: m, y })}
                  />
                );
              })}
            </View>
          ))}
        </ScrollView>

        {/* Reply preview */}
        {!!replyTo && (
          <Animated.View
            entering={FadeIn.duration(140)}
            exiting={FadeOut.duration(120)}
            style={[styles.replyPreview, { backgroundColor: colors.secondarySystemBackground, borderTopColor: colors.separator }]}
          >
            <View style={[styles.replyBar, { backgroundColor: colors.brand }]} />
            <View style={styles.flex}>
              <Text style={[typography.caption1, { color: colors.brand, fontWeight: '600' }]}>
                {replyTo.isMe ? t('you') : replyTo.authorName ?? chat.name}
              </Text>
              <Text numberOfLines={1} style={[typography.footnote, { color: colors.secondaryLabel }]}>
                {replyTo.kind === 'voice' ? '🎤 Voice message' : replyTo.text}
              </Text>
            </View>
            <Pressable onPress={() => setReplyTo(null)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('cancel')}>
              <Ionicons name="close-circle" size={22} color={colors.tertiaryLabel} />
            </Pressable>
          </Animated.View>
        )}

        {/* Composer */}
        <View
          style={[
            styles.composer,
            {
              paddingBottom: insets.bottom || 8,
              backgroundColor: colors.secondarySystemBackground,
              borderTopColor: colors.separator,
            },
          ]}
        >
          <Pressable
            onPress={() => {
              haptics.selection();
              setAttachOpen(true);
            }}
            hitSlop={8}
            accessibilityRole="button"
            accessibilityLabel={t('attach')}
          >
            <Ionicons name="add-circle-outline" size={30} color={colors.accent} />
          </Pressable>

          <View style={[styles.inputWrap, { backgroundColor: colors.systemBackground, borderColor: colors.separator, borderRadius: radius.xl }]}>
            <TextInput
              value={draft}
              onChangeText={(v) => {
                setDraft(v);
                signalTyping(v.length > 0);
              }}
              placeholder={t('typeMessage')}
              placeholderTextColor={colors.placeholder}
              multiline
              style={[typography.body, styles.input, { color: colors.label }]}
              accessibilityLabel={t('typeMessage')}
            />
            <Pressable
              hitSlop={6}
              accessibilityRole="button"
              accessibilityLabel={t('stickers')}
              onPress={() => {
                haptics.selection();
                setStickerOpen(true);
              }}
            >
              <Ionicons name="happy-outline" size={22} color={colors.placeholder} />
            </Pressable>
          </View>

          <View style={styles.sendSlot}>
            <Animated.View style={[styles.sendAbs, micStyle]} pointerEvents={hasDraft ? 'none' : 'auto'}>
              <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={t('recordVoice')} onPress={haptics.light}>
                <Ionicons name="mic-outline" size={26} color={colors.accent} />
              </Pressable>
            </Animated.View>

            <Animated.View style={[styles.sendAbs, sendStyle]} pointerEvents={hasDraft ? 'auto' : 'none'}>
              <Pressable
                onPress={handleSend}
                hitSlop={8}
                accessibilityRole="button"
                accessibilityLabel={t('send')}
                style={[styles.sendBtn, { backgroundColor: colors.brand }]}
              >
                <Ionicons name="arrow-up" size={19} color="#FFFFFF" />
              </Pressable>
            </Animated.View>
          </View>
        </View>
      </KeyboardAvoidingView>

      <IOSActionSheet
        visible={attachOpen}
        onClose={() => setAttachOpen(false)}
        options={[
          { key: 'camera', label: t('camera'), icon: 'camera-outline', onPress: () => {} },
          { key: 'photo', label: t('photoVideo'), icon: 'images-outline', onPress: () => {} },
          { key: 'doc', label: t('document'), icon: 'document-outline', onPress: () => {} },
          { key: 'location', label: t('location'), icon: 'location-outline', onPress: () => {} },
          { key: 'contact', label: t('contact'), icon: 'person-outline', onPress: () => {} },
          { key: 'poll', label: t('poll'), icon: 'stats-chart-outline', onPress: () => {} },
          { key: 'sticker', label: t('sticker'), icon: 'happy-outline', onPress: () => setStickerOpen(true) },
        ]}
      />

      <StickerPicker
        visible={stickerOpen}
        onClose={() => setStickerOpen(false)}
        onSelect={handleSendSticker}
      />

      <ReactionPicker
        visible={!!reactionTarget}
        anchor={reactionTarget ? { x: 0, y: reactionTarget.y } : null}
        onClose={() => setReactionTarget(null)}
        onSelect={(emoji) => {
          if (reactionTarget) {
            toggleReaction(chat.id, reactionTarget.message.id, emoji);
            // Broadcast to peers so the reaction is real-time; the local
            // optimistic update is applied immediately by toggleReaction.
            if (reactionTarget.message.id.startsWith('local-')) {
              // No server id yet; the ack will rename it. For reactions sent
              // before ack we fall through silently; users can retry after.
            } else {
              emitReaction(chat.id, reactionTarget.message.id, emoji);
            }
          }
          setReactionTarget(null);
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  center: { alignItems: 'center', justifyContent: 'center' },
  header: { borderBottomWidth: StyleSheet.hairlineWidth, zIndex: 5 },
  headerRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 8, gap: 4 },
  back: { paddingEnd: 2 },
  headerCenter: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 8 },
  headerText: { flex: 1 },
  headerActions: { flexDirection: 'row', alignItems: 'center', gap: 20, paddingHorizontal: 8 },
  listContent: { paddingVertical: 10 },
  dayWrap: { alignItems: 'center', marginVertical: 10 },
  dayChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  replyPreview: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  replyBar: { width: 3, height: 34, borderRadius: 2 },
  composer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 8,
    paddingHorizontal: 10,
    paddingTop: 7,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  inputWrap: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    minHeight: 36,
    maxHeight: 120,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderWidth: StyleSheet.hairlineWidth,
  },
  input: {
    flex: 1,
    padding: 0,
    maxHeight: 100,
    ...(({ outlineStyle: 'none' } as unknown) as object),
  },
  sendSlot: { width: 32, height: 36, alignItems: 'center', justifyContent: 'center' },
  sendAbs: { position: 'absolute', alignItems: 'center', justifyContent: 'center' },
  sendBtn: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center' },
});

export default ChatRoomScreen;
