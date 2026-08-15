import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

/**
 * Thin wrapper around expo-haptics.
 *
 * Web (and some emulators) have no Taptic Engine — every call is a no-op there
 * instead of throwing, so call sites never need a platform check.
 */
const supported = Platform.OS === 'ios' || Platform.OS === 'android';

const safe = (fn: () => Promise<void>) => {
  if (!supported) return;
  fn().catch(() => {
    /* haptics are best-effort */
  });
};

export const haptics = {
  /** Light tap — list selection, tab change. */
  selection: () => safe(() => Haptics.selectionAsync()),
  /** Light impact — swipe-to-reply threshold, bubble press. */
  light: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  /** Medium impact — reaction applied, sheet snap. */
  medium: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  /** Heavy impact — call answered / ended. */
  heavy: () => safe(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy)),
  success: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
  error: () => safe(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error)),
};

export default haptics;
