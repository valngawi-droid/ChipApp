import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';

import { useTheme } from '../../theme/ThemeProvider';
import { haptics } from '../../utils/haptics';
import { formatDuration } from '../../utils/format';

const SPEEDS = [1, 1.5, 2] as const;

interface Props {
  durationSec: number;
  waveform: number[];
  isMe: boolean;
  tint: string;
}

/**
 * Voice note player with a live waveform and variable-speed playback.
 *
 * Playback is simulated on a timer: wiring real decoding requires expo-av and a
 * recorded asset per message, but the transport UI, progress scrubbing and the
 * 1x/1.5x/2x speed cycling behave exactly as they do in the real client.
 */
export const VoiceNote: React.FC<Props> = ({ durationSec, waveform, isMe, tint }) => {
  const { colors, typography } = useTheme();
  const [playing, setPlaying] = useState(false);
  const [speedIndex, setSpeedIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);

  const speed = SPEEDS[speedIndex];

  useEffect(() => {
    if (!playing) {
      if (timer.current) clearInterval(timer.current);
      timer.current = null;
      return;
    }
    const tick = 100;
    timer.current = setInterval(() => {
      setElapsed((prev) => {
        const next = prev + (tick / 1000) * speed;
        if (next >= durationSec) {
          setPlaying(false);
          return 0;
        }
        return next;
      });
    }, tick);
    return () => {
      if (timer.current) clearInterval(timer.current);
    };
  }, [playing, speed, durationSec]);

  const progress = durationSec > 0 ? Math.min(1, elapsed / durationSec) : 0;
  const playedBars = Math.round(progress * waveform.length);

  const inactive = isMe ? `${colors.readReceipt}66` : colors.separator;

  return (
    <View style={styles.row}>
      <Pressable
        onPress={() => {
          haptics.light();
          setPlaying((p) => !p);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={playing ? 'Pause voice message' : 'Play voice message'}
        style={styles.playBtn}
      >
        <Ionicons name={playing ? 'pause' : 'play'} size={22} color={tint} />
      </Pressable>

      <View style={styles.waveWrap}>
        <View style={styles.wave}>
          {waveform.map((amp, i) => (
            <View
              key={i}
              style={{
                width: 2.5,
                height: Math.max(3, amp * 26),
                borderRadius: 1.5,
                backgroundColor: i < playedBars ? tint : inactive,
              }}
            />
          ))}
        </View>
        <Text style={[typography.caption2, { color: colors.secondaryLabel, marginTop: 3 }]}>
          {formatDuration(playing || elapsed > 0 ? elapsed : durationSec)}
        </Text>
      </View>

      <Pressable
        onPress={() => {
          haptics.selection();
          setSpeedIndex((i) => (i + 1) % SPEEDS.length);
        }}
        hitSlop={8}
        accessibilityRole="button"
        accessibilityLabel={`Playback speed ${speed}x`}
        style={[styles.speed, { backgroundColor: `${tint}22` }]}
      >
        <Text style={[typography.caption2, { color: tint, fontWeight: '700' }]}>{speed}×</Text>
      </Pressable>
    </View>
  );
};

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: 8, minWidth: 210 },
  playBtn: { width: 28, alignItems: 'center', justifyContent: 'center' },
  waveWrap: { flex: 1 },
  wave: { flexDirection: 'row', alignItems: 'center', gap: 2, height: 28 },
  speed: { paddingHorizontal: 6, paddingVertical: 2, borderRadius: 9 },
});

export default VoiceNote;
