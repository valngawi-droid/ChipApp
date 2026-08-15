import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import type { StatusUpdate } from '../state/useAppStore';
import Avatar from '../components/Avatar';
import { haptics } from '../utils/haptics';

interface Props {
  status: StatusUpdate | null;
  onClose: () => void;
}

const ProgressBar: React.FC<{ active: boolean; done: boolean; durationMs: number; paused: boolean; onDone: () => void }> = ({
  active,
  done,
  durationMs,
  paused,
  onDone,
}) => {
  const progress = useSharedValue(done ? 1 : 0);
  const remaining = useRef(durationMs);
  const startedAt = useRef<number | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clear = () => {
    if (timer.current) clearTimeout(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (!active) {
      progress.value = done ? 1 : 0;
      remaining.current = durationMs;
      clear();
      return;
    }
    if (paused) {
      if (startedAt.current) remaining.current -= Date.now() - startedAt.current;
      startedAt.current = null;
      // Freeze the bar where it is.
      progress.value = withTiming(progress.value, { duration: 0 });
      clear();
      return;
    }
    startedAt.current = Date.now();
    progress.value = withTiming(1, { duration: Math.max(0, remaining.current) });
    timer.current = setTimeout(onDone, Math.max(0, remaining.current));
    return clear;
  }, [active, paused, done, durationMs]); // eslint-disable-line react-hooks/exhaustive-deps

  const style = useAnimatedStyle(() => ({ width: `${progress.value * 100}%` }));

  return (
    <View style={styles.progressTrack}>
      <Animated.View style={[styles.progressFill, style]} />
    </View>
  );
};

/** Full-screen story viewer with tap-to-advance and hold-to-pause. */
export const StatusViewer: React.FC<Props> = ({ status, onClose }) => {
  const { typography } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(0);
    setPaused(false);
  }, [status?.id]);

  const advance = useCallback(() => {
    if (!status) return;
    if (index + 1 < status.frames.length) setIndex((i) => i + 1);
    else onClose();
  }, [index, status, onClose]);

  if (!status) return null;
  const frame = status.frames[index];

  return (
    <Modal visible animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <LinearGradient colors={frame.gradient} style={styles.flex}>
        <Pressable
          style={styles.flex}
          onPressIn={() => setPaused(true)}
          onPressOut={() => setPaused(false)}
          onPress={() => {
            haptics.selection();
            advance();
          }}
          accessibilityRole="button"
          accessibilityLabel={`${status.name} status, tap to advance`}
        >
          <View style={[styles.top, { paddingTop: insets.top + 8 }]}>
            <View style={styles.bars}>
              {status.frames.map((f, i) => (
                <ProgressBar
                  key={f.id}
                  active={i === index}
                  done={i < index}
                  paused={paused}
                  durationMs={f.durationMs}
                  onDone={advance}
                />
              ))}
            </View>

            <View style={styles.header}>
              <Avatar name={status.name} color={status.avatarColor} size={36} />
              <Text style={[typography.headline, styles.name]} numberOfLines={1}>
                {status.name}
              </Text>
              <Pressable onPress={onClose} hitSlop={12} accessibilityRole="button" accessibilityLabel={t('cancel')}>
                <Ionicons name="close" size={28} color="#FFFFFF" />
              </Pressable>
            </View>
          </View>

          <View style={styles.body}>
            <Text style={[typography.title2, styles.caption]}>{frame.caption}</Text>
          </View>
        </Pressable>

        <View style={[styles.replyBar, { paddingBottom: insets.bottom + 10 }]}>
          <View style={styles.replyField}>
            <TextInput
              placeholder={`${t('reply')}…`}
              placeholderTextColor="#FFFFFFB3"
              style={[typography.body, styles.replyInput]}
              accessibilityLabel={t('reply')}
            />
          </View>
          <Pressable hitSlop={8} accessibilityRole="button" accessibilityLabel={t('send')}>
            <Ionicons name="send" size={22} color="#FFFFFF" />
          </Pressable>
        </View>
      </LinearGradient>
    </Modal>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  top: { paddingHorizontal: 10, gap: 10 },
  bars: { flexDirection: 'row', gap: 4 },
  progressTrack: { flex: 1, height: 2.5, borderRadius: 2, backgroundColor: '#FFFFFF4D', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: '#FFFFFF' },
  header: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 4 },
  name: { color: '#FFFFFF', flex: 1 },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 32 },
  caption: { color: '#FFFFFF', textAlign: 'center', lineHeight: 32 },
  replyBar: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 16, paddingTop: 10 },
  replyField: {
    flex: 1,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FFFFFF80',
    justifyContent: 'center',
    paddingHorizontal: 16,
  },
  replyInput: { color: '#FFFFFF', padding: 0, ...(({ outlineStyle: 'none' } as unknown) as object) },
});

export default StatusViewer;
