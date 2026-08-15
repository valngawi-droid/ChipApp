import React from 'react';
import { StyleSheet, View } from 'react-native';

/**
 * The little curved tail on the last bubble of a run.
 *
 * Drawn with two overlapping views instead of SVG: a coloured wedge plus a
 * background-coloured mask that carves the concave curve, which is cheap to
 * render inside long lists and needs no extra dependency.
 */
export const BubbleTail: React.FC<{
  side: 'left' | 'right';
  bubbleColor: string;
  backgroundColor: string;
}> = ({ side, bubbleColor, backgroundColor }) => {
  const isRight = side === 'right';
  return (
    <View
      style={[styles.wrap, isRight ? styles.right : styles.left]}
      pointerEvents="none"
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <View
        style={[
          styles.wedge,
          {
            backgroundColor: bubbleColor,
            borderBottomLeftRadius: isRight ? 0 : 14,
            borderBottomRightRadius: isRight ? 14 : 0,
          },
        ]}
      />
      <View
        style={[
          styles.mask,
          {
            backgroundColor,
            borderBottomLeftRadius: isRight ? 12 : 0,
            borderBottomRightRadius: isRight ? 0 : 12,
            left: isRight ? undefined : -1,
            right: isRight ? -1 : undefined,
          },
        ]}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  wrap: { position: 'absolute', bottom: 0, width: 14, height: 18, overflow: 'hidden' },
  left: { left: -7 },
  right: { right: -7 },
  wedge: { position: 'absolute', bottom: 0, width: 14, height: 18 },
  mask: { position: 'absolute', bottom: 0, width: 9, height: 20 },
});

export default BubbleTail;
