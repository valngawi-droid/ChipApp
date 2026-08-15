import React, { useEffect } from 'react';
import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, {
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { useLocalization } from '../../i18n';
import { haptics } from '../../utils/haptics';

export interface SheetOption {
  key: string;
  label: string;
  icon?: string;
  destructive?: boolean;
  onPress: () => void;
}

interface Props {
  visible: boolean;
  title?: string;
  message?: string;
  options: SheetOption[];
  onClose: () => void;
}

/** UIAlertControllerStyleActionSheet clone with spring presentation. */
export const IOSActionSheet: React.FC<Props> = ({ visible, title, message, options, onClose }) => {
  const { colors, typography, radius, springs } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const progress = useSharedValue(0);
  const [mounted, setMounted] = React.useState(visible);

  useEffect(() => {
    if (visible) {
      setMounted(true);
      progress.value = withSpring(1, springs.gentle);
    } else if (mounted) {
      progress.value = withTiming(0, { duration: 200 }, (finished) => {
        if (finished) runOnJS(setMounted)(false);
      });
    }
  }, [visible]); // eslint-disable-line react-hooks/exhaustive-deps

  const backdropStyle = useAnimatedStyle(() => ({ opacity: progress.value }));
  const sheetStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: (1 - progress.value) * 420 }],
  }));

  const handle = (option: SheetOption) => {
    haptics.medium();
    onClose();
    // Let the dismissal animation start before the action mutates the tree.
    setTimeout(option.onPress, 60);
  };

  if (!mounted) return null;

  return (
    <Modal transparent visible animationType="none" onRequestClose={onClose}>
      <View style={StyleSheet.absoluteFill}>
        <Animated.View style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay }, backdropStyle]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={onClose} accessibilityLabel={t('cancel')} />
        </Animated.View>

        <Animated.View
          style={[styles.container, { paddingBottom: insets.bottom + 8 }, sheetStyle]}
        >
          <View style={[styles.group, { backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.lg }]}>
            {(!!title || !!message) && (
              <View style={[styles.header, { borderBottomColor: colors.separator }]}>
                {!!title && (
                  <Text style={[typography.footnote, { color: colors.secondaryLabel, fontWeight: '600' }]}>
                    {title}
                  </Text>
                )}
                {!!message && (
                  <Text style={[typography.caption1, { color: colors.secondaryLabel, marginTop: 2 }]}>
                    {message}
                  </Text>
                )}
              </View>
            )}

            {options.map((option, index) => (
              <Pressable
                key={option.key}
                onPress={() => handle(option)}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.row,
                  {
                    borderTopWidth: index === 0 && !title && !message ? 0 : StyleSheet.hairlineWidth,
                    borderTopColor: colors.separator,
                    backgroundColor: pressed ? colors.fill : 'transparent',
                  },
                ]}
              >
                <Text
                  style={[
                    typography.title3,
                    { color: option.destructive ? colors.destructive : colors.accent, fontWeight: '400' },
                  ]}
                >
                  {option.label}
                </Text>
                {!!option.icon && (
                  <Ionicons
                    name={option.icon as keyof typeof Ionicons.glyphMap}
                    size={22}
                    color={option.destructive ? colors.destructive : colors.accent}
                  />
                )}
              </Pressable>
            ))}
          </View>

          <Pressable
            onPress={onClose}
            accessibilityRole="button"
            style={({ pressed }) => [
              styles.group,
              styles.cancel,
              {
                backgroundColor: pressed ? colors.fill : colors.secondaryGroupedBackground,
                borderRadius: radius.lg,
              },
            ]}
          >
            <Text style={[typography.title3, { color: colors.accent, fontWeight: '600' }]}>
              {t('cancel')}
            </Text>
          </Pressable>
        </Animated.View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: { position: 'absolute', left: 8, right: 8, bottom: 0, gap: 8 },
  group: { overflow: 'hidden' },
  header: { paddingVertical: 14, paddingHorizontal: 16, alignItems: 'center', borderBottomWidth: StyleSheet.hairlineWidth },
  row: {
    minHeight: 57,
    paddingHorizontal: 20,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  cancel: { height: 57, alignItems: 'center', justifyContent: 'center' },
});

export default IOSActionSheet;
