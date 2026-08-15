import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  interpolate,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import Ionicons from '@expo/vector-icons/Ionicons';
import type { NativeStackScreenProps } from '@react-navigation/native-stack';

import { useTheme } from '../theme/ThemeProvider';
import { useLocalization } from '../i18n';
import { haptics } from '../utils/haptics';
import { formatDuration } from '../utils/format';
import Avatar from '../components/Avatar';
import type { RootStackParamList } from '../navigation/types';

type Props = NativeStackScreenProps<RootStackParamList, 'Call'>;

const SLIDER_WIDTH = 280;
const KNOB = 62;
const TRAVEL = SLIDER_WIDTH - KNOB - 8;

export const CallScreen: React.FC<Props> = ({ route, navigation }) => {
  const { name, color, video, incoming } = route.params;
  const { colors, typography, springs } = useTheme();
  const { t } = useLocalization();
  const insets = useSafeAreaInsets();

  const [answered, setAnswered] = useState(!incoming);
  const [seconds, setSeconds] = useState(0);
  const [muted, setMuted] = useState(false);
  const [speaker, setSpeaker] = useState(false);
  const [videoOn, setVideoOn] = useState(video);

  const knobX = useSharedValue(0);
  const shimmer = useSharedValue(0);

  useEffect(() => {
    shimmer.value = withRepeat(withTiming(1, { duration: 1600 }), -1, false);
  }, [shimmer]);

  useEffect(() => {
    if (!answered) return;
    const id = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(id);
  }, [answered]);

  const answer = () => {
    haptics.heavy();
    setAnswered(true);
  };

  const hangUp = () => {
    haptics.heavy();
    navigation.goBack();
  };

  /** Slide-to-answer: drag the knob past ~65% of the track. */
  const pan = Gesture.Pan()
    .onUpdate((e) => {
      knobX.value = Math.min(TRAVEL, Math.max(0, e.translationX));
    })
    .onEnd(() => {
      if (knobX.value > TRAVEL * 0.65) {
        knobX.value = withSpring(TRAVEL, springs.snappy);
        runOnJS(answer)();
      } else {
        knobX.value = withSpring(0, springs.snappy);
      }
    });

  const knobStyle = useAnimatedStyle(() => ({ transform: [{ translateX: knobX.value }] }));
  const hintStyle = useAnimatedStyle(() => ({
    opacity: interpolate(knobX.value, [0, TRAVEL * 0.5], [1, 0]) * (0.45 + shimmer.value * 0.55),
  }));

  const pulse = useAnimatedStyle(() => ({
    transform: [{ scale: answered ? 1 : 1 + shimmer.value * 0.06 }],
    opacity: answered ? 0 : 1 - shimmer.value,
  }));

  return (
    <LinearGradient colors={['#2B2B2E', '#0B0B0D']} style={styles.flex}>
      <View style={[styles.content, { paddingTop: insets.top + 40, paddingBottom: insets.bottom + 28 }]}>
        <View style={styles.headerBlock}>
          <Text style={[typography.title1, styles.name]} numberOfLines={1}>
            {name}
          </Text>
          <Text style={[typography.body, styles.subtitle]}>
            {answered
              ? formatDuration(seconds)
              : incoming
              ? `ChipApp ${video ? t('videoCall') : t('audioCall')}`
              : t('calling')}
          </Text>
          <View style={styles.encBadge}>
            <Ionicons name="lock-closed" size={11} color="#FFFFFFB3" />
            <Text style={[typography.caption1, { color: '#FFFFFFB3' }]}>{t('endToEndEncrypted')}</Text>
          </View>
        </View>

        <View style={styles.avatarBlock}>
          <Animated.View style={[styles.pulseRing, pulse]} />
          <Avatar name={name} color={color} size={148} />
        </View>

        {answered ? (
          <View style={styles.controls}>
            <View style={styles.controlRow}>
              <ControlButton
                icon={muted ? 'mic-off' : 'mic'}
                label={t('mute')}
                active={muted}
                onPress={() => {
                  haptics.selection();
                  setMuted((m) => !m);
                }}
              />
              <ControlButton
                icon="keypad"
                label="keypad"
                onPress={haptics.selection}
              />
              <ControlButton
                icon={speaker ? 'volume-high' : 'volume-medium'}
                label={t('speaker')}
                active={speaker}
                onPress={() => {
                  haptics.selection();
                  setSpeaker((s) => !s);
                }}
              />
            </View>
            <View style={styles.controlRow}>
              <ControlButton
                icon={videoOn ? 'videocam' : 'videocam-off'}
                label={t('videoCall')}
                active={videoOn}
                onPress={() => {
                  haptics.selection();
                  setVideoOn((v) => !v);
                }}
              />
              <ControlButton icon="person-add" label="add" onPress={haptics.selection} />
              <ControlButton icon="chatbubble" label="chat" onPress={haptics.selection} />
            </View>

            <Pressable
              onPress={hangUp}
              accessibilityRole="button"
              accessibilityLabel="End call"
              style={({ pressed }) => [
                styles.endBtn,
                { backgroundColor: colors.destructive, opacity: pressed ? 0.8 : 1 },
              ]}
            >
              <Ionicons name="call" size={30} color="#FFFFFF" style={styles.endIcon} />
            </Pressable>
          </View>
        ) : (
          <View style={styles.answerBlock}>
            <View style={styles.declineRow}>
              <Pressable
                onPress={hangUp}
                accessibilityRole="button"
                accessibilityLabel={t('decline')}
                style={[styles.roundBtn, { backgroundColor: colors.destructive }]}
              >
                <Ionicons name="call" size={26} color="#FFFFFF" style={styles.endIcon} />
              </Pressable>
              <Text style={[typography.caption1, styles.btnLabel]}>{t('decline')}</Text>
            </View>

            <View style={styles.sliderTrack}>
              <Animated.Text style={[typography.footnote, styles.sliderHint, hintStyle]}>
                {t('slideToAnswer')}
              </Animated.Text>
              <GestureDetector gesture={pan}>
                <Animated.View style={[styles.knob, { backgroundColor: '#34C759' }, knobStyle]}>
                  <Ionicons name={video ? 'videocam' : 'call'} size={26} color="#FFFFFF" />
                </Animated.View>
              </GestureDetector>
            </View>
          </View>
        )}
      </View>
    </LinearGradient>
  );
};

const ControlButton: React.FC<{
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  active?: boolean;
  onPress: () => void;
}> = ({ icon, label, active, onPress }) => {
  const { typography } = useTheme();
  return (
    <View style={styles.control}>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={label}
        accessibilityState={{ selected: !!active }}
        style={({ pressed }) => [
          styles.controlBtn,
          { backgroundColor: active ? '#FFFFFF' : '#FFFFFF29', opacity: pressed ? 0.7 : 1 },
        ]}
      >
        <Ionicons name={icon} size={26} color={active ? '#000000' : '#FFFFFF'} />
      </Pressable>
      <Text style={[typography.caption1, styles.btnLabel]}>{label}</Text>
    </View>
  );
};

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { flex: 1, alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 24 },
  headerBlock: { alignItems: 'center', gap: 6 },
  name: { color: '#FFFFFF' },
  subtitle: { color: '#FFFFFFB3' },
  encBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  avatarBlock: { alignItems: 'center', justifyContent: 'center' },
  pulseRing: {
    position: 'absolute',
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 2,
    borderColor: '#FFFFFF40',
  },
  controls: { width: '100%', alignItems: 'center', gap: 22 },
  controlRow: { flexDirection: 'row', justifyContent: 'center', gap: 34 },
  control: { alignItems: 'center', gap: 6, width: 74 },
  controlBtn: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  btnLabel: { color: '#FFFFFFCC', textTransform: 'capitalize' },
  endBtn: { width: 72, height: 72, borderRadius: 36, alignItems: 'center', justifyContent: 'center', marginTop: 4 },
  endIcon: { transform: [{ rotate: '135deg' }] },
  answerBlock: { width: '100%', alignItems: 'center', gap: 26 },
  declineRow: { alignItems: 'center', gap: 8 },
  roundBtn: { width: 66, height: 66, borderRadius: 33, alignItems: 'center', justifyContent: 'center' },
  sliderTrack: {
    width: SLIDER_WIDTH,
    height: KNOB + 8,
    borderRadius: (KNOB + 8) / 2,
    backgroundColor: '#FFFFFF1F',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  sliderHint: { position: 'absolute', alignSelf: 'center', color: '#FFFFFF' },
  knob: { width: KNOB, height: KNOB, borderRadius: KNOB / 2, alignItems: 'center', justifyContent: 'center' },
});

export default CallScreen;
