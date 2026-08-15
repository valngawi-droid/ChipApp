import React from 'react';
import { Image, StyleSheet, Text, View, ViewStyle } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';

import { useTheme } from '../../theme/ThemeProvider';
import { initials } from '../../utils/format';

interface AvatarProps {
  name: string;
  color?: string;
  size?: number;
  uri?: string | null;
  /** Draws the story ring: 'unseen' = brand gradient, 'seen' = muted grey. */
  ring?: 'none' | 'unseen' | 'seen';
  online?: boolean;
  style?: ViewStyle;
}

export const Avatar: React.FC<AvatarProps> = ({
  name,
  color = '#8E8E93',
  size = 49,
  uri,
  ring = 'none',
  online = false,
  style,
}) => {
  const { colors } = useTheme();
  const ringWidth = ring === 'none' ? 0 : 2.5;
  const gap = ring === 'none' ? 0 : 2;
  const inner = size - (ringWidth + gap) * 2;
  const dot = Math.max(10, size * 0.26);

  const core = (
    <View
      style={[
        styles.core,
        {
          width: inner,
          height: inner,
          borderRadius: inner / 2,
          backgroundColor: color,
        },
      ]}
    >
      {uri ? (
        <Image source={{ uri }} style={{ width: inner, height: inner, borderRadius: inner / 2 }} />
      ) : (
        <Text
          allowFontScaling={false}
          style={{
            color: '#FFFFFF',
            fontSize: inner * 0.4,
            fontWeight: '600',
          }}
        >
          {initials(name)}
        </Text>
      )}
    </View>
  );

  return (
    <View style={[{ width: size, height: size }, style]}>
      {ring === 'none' ? (
        core
      ) : ring === 'unseen' ? (
        <LinearGradient
          colors={[colors.brand, '#25D366', '#128C7E']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[styles.ring, { width: size, height: size, borderRadius: size / 2 }]}
        >
          <View
            style={[
              styles.ringInner,
              {
                width: size - ringWidth * 2,
                height: size - ringWidth * 2,
                borderRadius: (size - ringWidth * 2) / 2,
                backgroundColor: colors.systemBackground,
              },
            ]}
          >
            {core}
          </View>
        </LinearGradient>
      ) : (
        <View
          style={[
            styles.ring,
            {
              width: size,
              height: size,
              borderRadius: size / 2,
              borderWidth: ringWidth,
              borderColor: colors.separator,
            },
          ]}
        >
          {core}
        </View>
      )}

      {online && (
        <View
          style={[
            styles.onlineDot,
            {
              width: dot,
              height: dot,
              borderRadius: dot / 2,
              backgroundColor: colors.brand,
              borderColor: colors.systemBackground,
            },
          ]}
        />
      )}
    </View>
  );
};

const styles = StyleSheet.create({
  core: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  ring: { alignItems: 'center', justifyContent: 'center' },
  ringInner: { alignItems: 'center', justifyContent: 'center' },
  onlineDot: { position: 'absolute', right: 0, bottom: 0, borderWidth: 2 },
});

export default Avatar;
