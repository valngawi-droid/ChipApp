import React, { useState } from 'react';
import { Image, Modal, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { useLocalization } from '../../i18n';
import { haptics } from '../../utils/haptics';
import { STICKER_PACKS } from '../../assets/stickers';

interface Props {
  visible: boolean;
  onClose: () => void;
  onSelect: (packId: string, stickerId: string, source: number) => void;
}

/** Bottom sticker tray with pack tabs, mirroring the iOS sticker keyboard. */
export const StickerPicker: React.FC<Props> = ({ visible, onClose, onSelect }) => {
  const { colors, typography, radius } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();
  const [packIndex, setPackIndex] = useState(0);

  const pack = STICKER_PACKS[packIndex];

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={[styles.backdrop, { backgroundColor: colors.overlay }]} onPress={onClose} />
      <View
        style={[
          styles.sheet,
          {
            backgroundColor: colors.secondarySystemBackground,
            paddingBottom: insets.bottom + 8,
            borderTopLeftRadius: radius.lg,
            borderTopRightRadius: radius.lg,
          },
        ]}
      >
        <View style={[styles.grabber, { backgroundColor: colors.separator }]} />

        <View style={styles.headerRow}>
          <Text style={[typography.headline, { color: colors.label }]}>{pack?.name ?? t('stickers')}</Text>
          <Pressable onPress={onClose} hitSlop={10} accessibilityRole="button" accessibilityLabel={t('cancel')}>
            <Ionicons name="close-circle" size={24} color={colors.tertiaryLabel} />
          </Pressable>
        </View>

        <ScrollView contentContainerStyle={styles.grid}>
          {pack?.stickers.map((sticker) => (
            <Animated.View key={sticker.id} entering={FadeIn.duration(160)}>
              <Pressable
                onPress={() => {
                  haptics.medium();
                  onSelect(pack.id, sticker.id, sticker.source);
                  onClose();
                }}
                accessibilityRole="button"
                accessibilityLabel={sticker.id}
                style={({ pressed }) => [
                  styles.cell,
                  { backgroundColor: pressed ? colors.fill : 'transparent', borderRadius: radius.md },
                ]}
              >
                <Image source={sticker.source} style={styles.sticker} resizeMode="contain" />
              </Pressable>
            </Animated.View>
          ))}
        </ScrollView>

        <View style={[styles.tabs, { borderTopColor: colors.separator }]}>
          {STICKER_PACKS.map((p, i) => {
            const active = i === packIndex;
            return (
              <Pressable
                key={p.id}
                onPress={() => {
                  haptics.selection();
                  setPackIndex(i);
                }}
                accessibilityRole="tab"
                accessibilityState={{ selected: active }}
                style={[
                  styles.tab,
                  active && { backgroundColor: colors.fill, borderRadius: radius.sm },
                ]}
              >
                <Image source={p.stickers[0].source} style={styles.tabIcon} resizeMode="contain" />
              </Pressable>
            );
          })}
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: { flex: 1 },
  sheet: { position: 'absolute', left: 0, right: 0, bottom: 0, maxHeight: '62%' },
  grabber: { width: 36, height: 5, borderRadius: 3, alignSelf: 'center', marginTop: 8 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 10,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', paddingHorizontal: 10, gap: 6, paddingBottom: 10 },
  cell: { width: 78, height: 78, alignItems: 'center', justifyContent: 'center' },
  sticker: { width: 66, height: 66 },
  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: 12, paddingTop: 8, borderTopWidth: StyleSheet.hairlineWidth },
  tab: { padding: 6 },
  tabIcon: { width: 28, height: 28 },
});

export default StickerPicker;
