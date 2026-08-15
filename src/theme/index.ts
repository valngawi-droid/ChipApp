import { Platform, TextStyle } from 'react-native';

/**
 * ChipApp design tokens.
 *
 * Colour values follow the Apple HIG system palette plus the WhatsApp brand
 * greens, split into adaptive light / dark ramps.
 */
export const palette = {
  light: {
    systemBackground: '#FFFFFF',
    secondarySystemBackground: '#F2F2F7',
    groupedBackground: '#F2F2F7',
    secondaryGroupedBackground: '#FFFFFF',
    tertiaryBackground: '#FFFFFF',
    label: '#000000',
    secondaryLabel: '#3C3C4399',
    tertiaryLabel: '#3C3C434D',
    placeholder: '#8E8E93',
    separator: '#C6C6C8',
    opaqueSeparator: '#C6C6C8',
    accent: '#007AFF',
    brand: '#25D366',
    brandDeep: '#128C7E',
    tint: '#25D366',
    destructive: '#FF3B30',
    warning: '#FF9500',
    bubbleOutgoing: '#DCF8C6',
    bubbleIncoming: '#FFFFFF',
    bubbleOutgoingText: '#000000',
    bubbleIncomingText: '#000000',
    chatWallpaper: '#EFE7DE',
    navBar: '#F6F6F6E6',
    tabBar: '#F9F9F9F2',
    readReceipt: '#34B7F1',
    fill: '#78788033',
    searchField: '#7676801F',
    overlay: '#00000059',
    white: '#FFFFFF',
    black: '#000000',
  },
  dark: {
    systemBackground: '#000000',
    secondarySystemBackground: '#1C1C1E',
    groupedBackground: '#000000',
    secondaryGroupedBackground: '#1C1C1E',
    tertiaryBackground: '#2C2C2E',
    label: '#FFFFFF',
    secondaryLabel: '#EBEBF599',
    tertiaryLabel: '#EBEBF54D',
    placeholder: '#8E8E93',
    separator: '#38383A',
    opaqueSeparator: '#38383A',
    accent: '#0A84FF',
    brand: '#1EBE5D',
    brandDeep: '#25D366',
    tint: '#1EBE5D',
    destructive: '#FF453A',
    warning: '#FF9F0A',
    bubbleOutgoing: '#005C4B',
    bubbleIncoming: '#1F2C34',
    bubbleOutgoingText: '#FFFFFF',
    bubbleIncomingText: '#FFFFFF',
    chatWallpaper: '#0B141A',
    navBar: '#1C1C1EE6',
    tabBar: '#1C1C1EF2',
    readReceipt: '#53BDEB',
    fill: '#7878805C',
    searchField: '#7676803D',
    overlay: '#00000099',
    white: '#FFFFFF',
    black: '#000000',
  },
};

export type ColorScheme = keyof typeof palette;
export type Colors = typeof palette.light;

/**
 * San Francisco is the iOS system face. Apple's licence does not permit
 * redistributing the SF Pro binaries inside an app bundle, so we resolve the
 * genuine system font on Apple platforms and fall back to the closest
 * metrically-similar stack elsewhere.
 */
export const fontFamily = Platform.select({
  ios: { display: 'System', text: 'System', rounded: 'System' },
  android: { display: 'sans-serif', text: 'sans-serif', rounded: 'sans-serif-medium' },
  default: {
    display: '-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, sans-serif',
    text: '-apple-system, BlinkMacSystemFont, "SF Pro Text", "Segoe UI", Roboto, sans-serif',
    rounded: '-apple-system, BlinkMacSystemFont, "SF Pro Rounded", "Segoe UI", Roboto, sans-serif',
  },
}) as { display: string; text: string; rounded: string };

/** Apple HIG type ramp (iOS 17 default Dynamic Type sizes). */
export const typography = {
  largeTitle: { fontFamily: fontFamily.display, fontSize: 34, lineHeight: 41, fontWeight: '700', letterSpacing: 0.37 },
  title1: { fontFamily: fontFamily.display, fontSize: 28, lineHeight: 34, fontWeight: '700', letterSpacing: 0.36 },
  title2: { fontFamily: fontFamily.display, fontSize: 22, lineHeight: 28, fontWeight: '700', letterSpacing: 0.35 },
  title3: { fontFamily: fontFamily.display, fontSize: 20, lineHeight: 25, fontWeight: '600', letterSpacing: 0.38 },
  headline: { fontFamily: fontFamily.text, fontSize: 17, lineHeight: 22, fontWeight: '600', letterSpacing: -0.41 },
  body: { fontFamily: fontFamily.text, fontSize: 17, lineHeight: 22, fontWeight: '400', letterSpacing: -0.41 },
  callout: { fontFamily: fontFamily.text, fontSize: 16, lineHeight: 21, fontWeight: '400', letterSpacing: -0.32 },
  subheadline: { fontFamily: fontFamily.text, fontSize: 15, lineHeight: 20, fontWeight: '400', letterSpacing: -0.24 },
  footnote: { fontFamily: fontFamily.text, fontSize: 13, lineHeight: 18, fontWeight: '400', letterSpacing: -0.08 },
  caption1: { fontFamily: fontFamily.text, fontSize: 12, lineHeight: 16, fontWeight: '400', letterSpacing: 0 },
  caption2: { fontFamily: fontFamily.text, fontSize: 11, lineHeight: 13, fontWeight: '400', letterSpacing: 0.07 },
  tabLabel: { fontFamily: fontFamily.text, fontSize: 10, lineHeight: 12, fontWeight: '500', letterSpacing: 0.12 },
} as const satisfies Record<string, TextStyle>;

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 24,
  screenH: 16,
  rowH: 16,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  xl: 20,
  bubble: 18,
  bubbleTail: 5,
  sheet: 13,
  pill: 999,
} as const;

/** iOS-flavoured spring configs used by every physics animation in the app. */
export const springs = {
  /** Default UIKit-like snappy spring. */
  snappy: { damping: 20, stiffness: 300, mass: 0.6 },
  /** Bouncier spring for reaction popups. */
  bouncy: { damping: 12, stiffness: 220, mass: 0.7 },
  /** Gentle spring for sheets and modal presentation. */
  gentle: { damping: 26, stiffness: 180, mass: 0.9 },
} as const;

export const layout = {
  navBarHeight: 44,
  largeTitleHeight: 52,
  tabBarHeight: 49,
  rowMinHeight: 44,
  avatarSm: 32,
  avatarMd: 40,
  avatarLg: 49,
  avatarXl: 64,
  hairline: 0.5,
} as const;

export const getColors = (scheme: ColorScheme): Colors => palette[scheme];
