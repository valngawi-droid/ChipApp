import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';

import { useTheme } from '../../theme/ThemeProvider';
import { haptics } from '../../utils/haptics';

export const REACTIONS = ['👍', '❤️', '😂', '😮', '😢', '🙏'] as const;

interface Props {
  visible: boolean;
  onSelect: (emoji: string) => void;
  onClose: () => void;
  anchor: { x: number; y: number } | null;
}

const Emoji: React.FC<{ emoji: string; index: number; visible: boolean; onPress: () => void }> = ({
  emoji,
  index,
  visible,
  onPress,
}) => {
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = visible
      ? withDelay(index * 28, withSpring(1, { damping: 12, stiffness: 220, mass: 0.7 }))
      : withTiming(0, { duration: 120 });
  }, [visible, index, scale]);

  const style = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
    opacity: scale.value,
  }));

  return (
    <Animated.View style={style}>
      <Pressable onPress={onPress} hitSlop={6} accessibilityRole="button" accessibilityLabel={emoji}>
        <Text style={styles.emoji}>{emoji}</Text>
      </Pressable>
    </Animated.View>
  );
};

/** Reaction tray that springs in above a long-pressed bubble. */
export const ReactionPicker: React.FC<Props> = ({ visible, onSelect, onClose, anchor }) => {
  const { colors, radius } = useTheme();
  const [mounted, setMounted] = React.useState(visible);
  const container = useSharedValue(0);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      container.value = withSpring(1, { damping: 15, stiffness: 240, mass: 0.6 });
    } else if (mounted) {
      container.value = withTiming(0, { duration: 140 }, (f) => {
        if (f) runOnJS(setMounted)(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const trayStyle = useAnimatedStyle(() => ({
    opacity: container.value,
    transform: [{ scale: 0.85 + container.value * 0.15 }, { translateY: (1 - container.value) * 10 }],
  }));

  if (!mounted || !anchor) return null;

  const top = Math.max(60, anchor.y - 64);

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <Pressable style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }]} onPress={onClose}>
        <Animated.View
          style={[
            styles.tray,
            {
              top,
              backgroundColor: colors.secondaryGroupedBackground,
              borderRadius: radius.pill,
              shadowColor: '#000',
            },
            trayStyle,
          ]}
        >
          {REACTIONS.map((emoji, i) => (
            <Emoji
              key={emoji}
              emoji={emoji}
              index={i}
              visible={visible}
              onPress={() => {
                haptics.medium();
                onSelect(emoji);
              }}
            />
          ))}
        </Animated.View>
      </Pressable>
    </Modal>
  );
};

const styles = StyleSheet.create({
  tray: {
    position: 'absolute',
    alignSelf: 'center',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 14,
    paddingVertical: 9,
    shadowOpacity: 0.18,
    shadowRadius: 16,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  emoji: { fontSize: 30 },
});

export default ReactionPicker;
