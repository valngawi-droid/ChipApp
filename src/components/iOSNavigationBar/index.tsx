import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Extrapolation,
  SharedValue,
  interpolate,
  useAnimatedStyle,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { haptics } from '../../utils/haptics';

export interface NavBarAction {
  key: string;
  label?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  onPress: () => void;
  accessibilityLabel?: string;
}

interface Props {
  title: string;
  /** Scroll offset driving the large-title collapse. */
  scrollY?: SharedValue<number>;
  leftActions?: NavBarAction[];
  rightActions?: NavBarAction[];
  /** Hides the large title row (used by nested/detail screens). */
  compact?: boolean;
  subtitle?: string;
}

const COLLAPSE_DISTANCE = 52;

/**
 * iOS large-title navigation bar.
 *
 * The large title shrinks and fades into the compact inline title as content
 * scrolls, matching UINavigationBar's `prefersLargeTitles` behaviour, and the
 * hairline separator only appears once the content is underneath the bar.
 */
export const IOSNavigationBar: React.FC<Props> = ({
  title,
  scrollY,
  leftActions = [],
  rightActions = [],
  compact = false,
  subtitle,
}) => {
  const { colors, typography, layout } = useTheme();
  const insets = useSafeAreaInsets();

  const largeTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: 1, transform: [{ translateY: 0 }, { scale: 1 }] };
    const y = scrollY.value;
    return {
      opacity: interpolate(y, [0, COLLAPSE_DISTANCE * 0.7], [1, 0], Extrapolation.CLAMP),
      transform: [
        { translateY: interpolate(y, [0, COLLAPSE_DISTANCE], [0, -12], Extrapolation.CLAMP) },
        { scale: interpolate(y, [0, COLLAPSE_DISTANCE], [1, 0.88], Extrapolation.CLAMP) },
      ],
    };
  });

  const inlineTitleStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: compact ? 1 : 0 };
    return {
      opacity: interpolate(
        scrollY.value,
        [COLLAPSE_DISTANCE * 0.6, COLLAPSE_DISTANCE],
        [0, 1],
        Extrapolation.CLAMP
      ),
    };
  });

  const separatorStyle = useAnimatedStyle(() => {
    if (!scrollY) return { opacity: compact ? 1 : 0 };
    return { opacity: interpolate(scrollY.value, [0, 12], [0, 1], Extrapolation.CLAMP) };
  });

  const renderAction = (action: NavBarAction) => (
    <Pressable
      key={action.key}
      onPress={() => {
        haptics.selection();
        action.onPress();
      }}
      hitSlop={12}
      accessibilityRole="button"
      accessibilityLabel={action.accessibilityLabel ?? action.label ?? action.key}
      style={({ pressed }) => [styles.action, { opacity: pressed ? 0.35 : 1 }]}
    >
      {action.icon ? (
        <Ionicons name={action.icon} size={23} color={colors.accent} />
      ) : (
        <Text style={[typography.body, { color: colors.accent }]}>{action.label}</Text>
      )}
    </Pressable>
  );

  return (
    <View
      style={[
        styles.container,
        { paddingTop: insets.top, backgroundColor: colors.secondarySystemBackground },
      ]}
    >
      <View style={[styles.topRow, { height: layout.navBarHeight }]}>
        <View style={styles.side}>{leftActions.map(renderAction)}</View>

        <Animated.View style={[styles.inlineTitleWrap, inlineTitleStyle]} pointerEvents="none">
          <Text numberOfLines={1} style={[typography.headline, { color: colors.label }]}>
            {title}
          </Text>
          {!!subtitle && (
            <Text numberOfLines={1} style={[typography.caption1, { color: colors.secondaryLabel }]}>
              {subtitle}
            </Text>
          )}
        </Animated.View>

        <View style={[styles.side, styles.sideEnd]}>{rightActions.map(renderAction)}</View>
      </View>

      {!compact && (
        <Animated.View style={[styles.largeTitleRow, largeTitleStyle]}>
          <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[typography.largeTitle, { color: colors.label }]}
          >
            {title}
          </Text>
        </Animated.View>
      )}

      <Animated.View
        style={[
          styles.separator,
          { backgroundColor: colors.separator, height: StyleSheet.hairlineWidth },
          separatorStyle,
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { width: '100%', zIndex: 10 },
  topRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
  },
  side: { flexDirection: 'row', alignItems: 'center', gap: 18, minWidth: 64 },
  sideEnd: { justifyContent: 'flex-end' },
  action: { paddingVertical: 4 },
  inlineTitleWrap: {
    position: 'absolute',
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  largeTitleRow: { paddingHorizontal: 16, paddingBottom: 8, justifyContent: 'flex-end' },
  separator: { position: 'absolute', bottom: 0, left: 0, right: 0 },
});

export default IOSNavigationBar;
