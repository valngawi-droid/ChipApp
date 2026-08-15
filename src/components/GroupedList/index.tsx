import React from 'react';
import { Pressable, StyleSheet, Switch, Text, View, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';

export const Section: React.FC<{
  header?: string;
  footer?: string;
  children: React.ReactNode;
  style?: ViewStyle;
}> = ({ header, footer, children, style }) => {
  const { colors, typography, radius } = useTheme();
  const items = React.Children.toArray(children).filter(Boolean);

  return (
    <View style={[styles.section, style]}>
      {!!header && (
        <Text style={[typography.footnote, styles.header, { color: colors.secondaryLabel }]}>
          {header.toUpperCase()}
        </Text>
      )}
      <View
        style={[
          styles.group,
          { backgroundColor: colors.secondaryGroupedBackground, borderRadius: radius.md },
        ]}
      >
        {items.map((child, i) => (
          <View key={i}>
            {i > 0 && (
              <View
                style={[styles.separator, { backgroundColor: colors.separator }]}
              />
            )}
            {child}
          </View>
        ))}
      </View>
      {!!footer && (
        <Text style={[typography.footnote, styles.footer, { color: colors.secondaryLabel }]}>
          {footer}
        </Text>
      )}
    </View>
  );
};

interface RowProps {
  title: string;
  subtitle?: string;
  icon?: keyof typeof Ionicons.glyphMap;
  iconColor?: string;
  value?: string;
  onPress?: () => void;
  showChevron?: boolean;
  destructive?: boolean;
  toggle?: { value: boolean; onValueChange: (v: boolean) => void };
  accessory?: React.ReactNode;
  selected?: boolean;
}

export const Row: React.FC<RowProps> = ({
  title,
  subtitle,
  icon,
  iconColor,
  value,
  onPress,
  showChevron,
  destructive,
  toggle,
  accessory,
  selected,
}) => {
  const { colors, typography, radius } = useTheme();
  const interactive = !!onPress;

  const content = (
    <View style={styles.row}>
      {!!icon && (
        <View
          style={[
            styles.iconBox,
            { backgroundColor: iconColor ?? colors.accent, borderRadius: radius.sm },
          ]}
        >
          <Ionicons name={icon} size={17} color="#FFFFFF" />
        </View>
      )}
      <View style={styles.rowText}>
        <Text
          style={[typography.body, { color: destructive ? colors.destructive : colors.label }]}
          numberOfLines={1}
        >
          {title}
        </Text>
        {!!subtitle && (
          <Text style={[typography.footnote, { color: colors.secondaryLabel }]} numberOfLines={2}>
            {subtitle}
          </Text>
        )}
      </View>
      {!!value && (
        <Text style={[typography.body, { color: colors.secondaryLabel }]} numberOfLines={1}>
          {value}
        </Text>
      )}
      {selected && <Ionicons name="checkmark" size={20} color={colors.accent} />}
      {accessory}
      {toggle && (
        <Switch
          value={toggle.value}
          onValueChange={toggle.onValueChange}
          trackColor={{ true: colors.brand, false: colors.fill }}
        />
      )}
      {showChevron && <Ionicons name="chevron-forward" size={17} color={colors.tertiaryLabel} />}
    </View>
  );

  if (!interactive) return <View>{content}</View>;

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => ({ backgroundColor: pressed ? colors.fill : 'transparent' })}
    >
      {content}
    </Pressable>
  );
};

const styles = StyleSheet.create({
  section: { marginBottom: 28 },
  header: { marginHorizontal: 32, marginBottom: 7 },
  footer: { marginHorizontal: 32, marginTop: 7 },
  group: { marginHorizontal: 16, overflow: 'hidden' },
  separator: { height: StyleSheet.hairlineWidth, marginStart: 16 },
  row: {
    minHeight: 44,
    paddingVertical: 8,
    paddingHorizontal: 16,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconBox: { width: 29, height: 29, alignItems: 'center', justifyContent: 'center' },
  rowText: { flex: 1, gap: 1 },
});

export default { Section, Row };
