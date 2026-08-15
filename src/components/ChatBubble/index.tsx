import React, { useCallback } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
} from 'react-native-reanimated';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { useLocalization } from '../../i18n';
import { haptics } from '../../utils/haptics';
import { formatTime } from '../../utils/format';
import type { Message } from '../../state/useAppStore';
import BubbleTail from './BubbleTail';
import VoiceNote from './VoiceNote';

interface Props {
  message: Message;
  /** Last message of a consecutive run from the same author — gets the tail. */
  showTail: boolean;
  showAuthor: boolean;
  onReply: (message: Message) => void;
  onLongPress: (message: Message, y: number) => void;
}

const REPLY_THRESHOLD = 62;

export const ChatBubble: React.FC<Props> = ({
  message,
  showTail,
  showAuthor,
  onReply,
  onLongPress,
}) => {
  const { colors, typography, radius, springs } = useTheme();
  const { locale, t } = useLocalization();

  const translateX = useSharedValue(0);
  const triggered = useSharedValue(false);
  const pressScale = useSharedValue(1);

  const isMe = message.isMe;

  const fireReply = useCallback(() => {
    haptics.light();
    onReply(message);
  }, [message, onReply]);

  /**
   * Swipe-to-reply: horizontal pan that rubber-bands past the threshold, fires
   * a haptic exactly once on crossing, then springs back to rest.
   */
  const pan = Gesture.Pan()
    .activeOffsetX(isMe ? [-14, 14] : [-14, 14])
    .failOffsetY([-12, 12])
    .onUpdate((e) => {
      const raw = e.translationX;
      // Only allow dragging toward the centre of the screen, WhatsApp-style.
      const dir = isMe ? Math.min(0, raw) : Math.max(0, raw);
      const magnitude = Math.abs(dir);
      const damped = magnitude > REPLY_THRESHOLD
        ? REPLY_THRESHOLD + (magnitude - REPLY_THRESHOLD) * 0.25
        : magnitude;
      translateX.value = isMe ? -damped : damped;

      if (!triggered.value && magnitude >= REPLY_THRESHOLD) {
        triggered.value = true;
        runOnJS(haptics.light)();
      } else if (triggered.value && magnitude < REPLY_THRESHOLD) {
        triggered.value = false;
      }
    })
    .onEnd(() => {
      if (Math.abs(translateX.value) >= REPLY_THRESHOLD) {
        runOnJS(fireReply)();
      }
      triggered.value = false;
      translateX.value = withSpring(0, springs.snappy);
    });

  const longPress = Gesture.LongPress()
    .minDuration(320)
    .onStart((e) => {
      pressScale.value = withSpring(1.04, springs.bouncy);
      runOnJS(haptics.medium)();
      runOnJS(onLongPress)(message, e.absoluteY);
    })
    .onFinalize(() => {
      pressScale.value = withSpring(1, springs.snappy);
    });

  const composed = Gesture.Simultaneous(pan, longPress);

  const rowStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: translateX.value }, { scale: pressScale.value }],
  }));

  const replyIconStyle = useAnimatedStyle(() => {
    const p = Math.min(1, Math.abs(translateX.value) / REPLY_THRESHOLD);
    return {
      opacity: p,
      transform: [{ scale: 0.6 + p * 0.4 }],
    };
  });

  // System notice (encryption banner) renders as a centred chip.
  if (message.kind === 'system') {
    return (
      <View style={styles.systemWrap}>
        <View style={[styles.systemChip, { backgroundColor: colors.bubbleIncoming }]}>
          <Ionicons name="lock-closed" size={10} color={colors.secondaryLabel} />
          <Text style={[typography.caption2, styles.systemText, { color: colors.secondaryLabel }]}>
            {message.text || t('encryptionNotice')}
          </Text>
        </View>
      </View>
    );
  }

  // Stickers render bare (no bubble chrome), exactly like the real client.
  const isSticker = message.kind === 'sticker';
  const bubbleColor = isSticker
    ? 'transparent'
    : isMe
    ? colors.bubbleOutgoing
    : colors.bubbleIncoming;
  const textColor = isMe ? colors.bubbleOutgoingText : colors.bubbleIncomingText;
  const tint = isMe ? colors.brand : colors.accent;
  const hasReactions = !!message.reactions?.length;

  return (
    <View style={[styles.container, hasReactions && styles.containerWithReactions]}>
      <Animated.View
        style={[
          styles.replyIcon,
          isMe ? styles.replyIconRight : styles.replyIconLeft,
          replyIconStyle,
        ]}
        pointerEvents="none"
      >
        <Ionicons name="arrow-undo" size={16} color={colors.secondaryLabel} />
      </Animated.View>

      <GestureDetector gesture={composed}>
        <Animated.View
          style={[styles.row, isMe ? styles.rowRight : styles.rowLeft, rowStyle]}
          accessibilityRole="text"
          accessibilityLabel={`${isMe ? t('you') : message.authorName ?? ''} ${message.text}`}
        >
          <View
            style={[
              styles.bubble,
              isSticker && styles.stickerBubble,
              {
                backgroundColor: bubbleColor,
                borderRadius: radius.bubble,
                borderBottomRightRadius: isMe && showTail ? radius.bubbleTail : radius.bubble,
                borderBottomLeftRadius: !isMe && showTail ? radius.bubbleTail : radius.bubble,
              },
            ]}
          >
            {showTail && !isSticker && (
              <BubbleTail
                side={isMe ? 'right' : 'left'}
                bubbleColor={bubbleColor}
                backgroundColor={colors.chatWallpaper}
              />
            )}

            {showAuthor && !!message.authorName && !isMe && (
              <Text style={[typography.footnote, { color: colors.brand, fontWeight: '600', marginBottom: 2 }]}>
                {message.authorName}
              </Text>
            )}

            {!!message.replyTo && (
              <View style={[styles.quote, { backgroundColor: `${tint}1A`, borderStartColor: tint }]}>
                <Text style={[typography.caption1, { color: tint, fontWeight: '600' }]} numberOfLines={1}>
                  {message.replyTo.author}
                </Text>
                <Text style={[typography.caption1, { color: colors.secondaryLabel }]} numberOfLines={1}>
                  {message.replyTo.preview}
                </Text>
              </View>
            )}

            {message.kind === 'voice' ? (
              <VoiceNote
                durationSec={message.durationSec ?? 0}
                waveform={message.waveform ?? []}
                isMe={isMe}
                tint={tint}
              />
            ) : isSticker ? (
              <Image
                source={message.stickerSource}
                style={styles.sticker}
                resizeMode="contain"
                accessibilityLabel={t('sticker')}
              />
            ) : message.deleted ? (
              <Text style={[typography.body, { color: colors.secondaryLabel, fontStyle: 'italic' }]}>
                🚫 {t('messageDeleted')}
              </Text>
            ) : (
              <Text style={[typography.body, { color: textColor }]} selectable>
                {message.text}
                {!!message.editedAt && (
                  <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
                    {'  '}
                    {t('edited')}
                  </Text>
                )}
              </Text>
            )}

            <View style={styles.footer}>
              <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
                {formatTime(message.timestamp, locale)}
              </Text>
              {isMe && <ReadReceipt status={message.status} readColor={colors.readReceipt} idleColor={colors.secondaryLabel} />}
            </View>
          </View>
        </Animated.View>
      </GestureDetector>

      {hasReactions && (
        <View
          style={[
            styles.reactionBadge,
            isMe ? styles.reactionRight : styles.reactionLeft,
            { backgroundColor: colors.secondaryGroupedBackground, borderColor: colors.chatWallpaper },
          ]}
        >
          {message.reactions!.map((r, i) => (
            <Text key={`${r.emoji}-${i}`} style={styles.reactionEmoji}>
              {r.emoji}
            </Text>
          ))}
          {message.reactions!.length > 1 && (
            <Text style={[typography.caption2, { color: colors.secondaryLabel }]}>
              {message.reactions!.length}
            </Text>
          )}
        </View>
      )}
    </View>
  );
};

/** Single tick -> sent, double -> delivered, blue double -> read. */
const ReadReceipt: React.FC<{ status: Message['status']; readColor: string; idleColor: string }> = ({
  status,
  readColor,
  idleColor,
}) => {
  const scale = useSharedValue(status === 'read' ? 1 : 0.9);

  React.useEffect(() => {
    if (status === 'read') {
      scale.value = withSpring(1.18, { damping: 9, stiffness: 260 }, () => {
        scale.value = withSpring(1, { damping: 14, stiffness: 220 });
      });
    }
  }, [status, scale]);

  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));

  if (status === 'sending') {
    return <Ionicons name="time-outline" size={13} color={idleColor} style={styles.tick} />;
  }
  const color = status === 'read' ? readColor : idleColor;
  return (
    <Animated.View style={[styles.tick, style]}>
      <Ionicons name={status === 'sent' ? 'checkmark' : 'checkmark-done'} size={15} color={color} />
    </Animated.View>
  );
};

const styles = StyleSheet.create({
  container: { marginVertical: 1.5, marginHorizontal: 10, justifyContent: 'center' },
  containerWithReactions: { marginBottom: 14 },
  row: { flexDirection: 'row' },
  rowRight: { justifyContent: 'flex-end' },
  rowLeft: { justifyContent: 'flex-start' },
  bubble: {
    maxWidth: '78%',
    paddingHorizontal: 9,
    paddingTop: 6,
    paddingBottom: 5,
    shadowColor: '#000',
    shadowOpacity: 0.06,
    shadowRadius: 1,
    shadowOffset: { width: 0, height: 1 },
    elevation: 1,
  },
  stickerBubble: { paddingHorizontal: 0, paddingTop: 0, shadowOpacity: 0, elevation: 0 },
  sticker: { width: 128, height: 128 },
  footer: { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 3, marginTop: 1 },
  tick: { marginStart: 1 },
  quote: {
    borderStartWidth: 3,
    paddingStart: 6,
    paddingEnd: 8,
    paddingVertical: 3,
    borderRadius: 4,
    marginBottom: 4,
  },
  replyIcon: { position: 'absolute', top: '50%', marginTop: -8 },
  replyIconLeft: { left: 6 },
  replyIconRight: { right: 6 },
  reactionBadge: {
    position: 'absolute',
    bottom: -13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 1,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: 999,
    borderWidth: 1.5,
  },
  reactionLeft: { left: 14 },
  reactionRight: { right: 14 },
  reactionEmoji: { fontSize: 12 },
  systemWrap: { alignItems: 'center', marginVertical: 8, paddingHorizontal: 32 },
  systemChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
  },
  systemText: { textAlign: 'center', flexShrink: 1 },
});

export default ChatBubble;
