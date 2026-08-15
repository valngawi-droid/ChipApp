/**
 * Generates ChipApp's notification cues as real, playable 16-bit PCM WAV files.
 *
 * These are synthesised from scratch rather than copied from iOS: Apple's system
 * sounds are copyrighted and cannot be redistributed in a third-party app. Each
 * cue below is an original tone sequence in the same spirit (short, bright,
 * non-intrusive) and is safe to ship.
 *
 * Usage: node scripts/generate-sounds.js
 */
const fs = require('fs');
const path = require('path');

const SAMPLE_RATE = 44100;

/** ADSR-ish envelope with a quick attack and exponential decay. */
const envelope = (t, duration, attack = 0.006) => {
  if (t < attack) return t / attack;
  const rel = (t - attack) / Math.max(1e-6, duration - attack);
  return Math.exp(-4.2 * rel) * (1 - rel * 0.15);
};

/** Render a list of {freq, start, duration, gain, harmonics} into a Float32 buffer. */
const render = (notes, totalDuration) => {
  const length = Math.ceil(SAMPLE_RATE * totalDuration);
  const buf = new Float32Array(length);

  notes.forEach(({ freq, start, duration, gain = 0.5, harmonics = [1, 0.32, 0.12] }) => {
    const s0 = Math.floor(start * SAMPLE_RATE);
    const n = Math.floor(duration * SAMPLE_RATE);
    for (let i = 0; i < n; i += 1) {
      const idx = s0 + i;
      if (idx >= length) break;
      const t = i / SAMPLE_RATE;
      const env = envelope(t, duration);
      let sample = 0;
      harmonics.forEach((amp, h) => {
        sample += amp * Math.sin(2 * Math.PI * freq * (h + 1) * t);
      });
      buf[idx] += (sample / harmonics.length) * env * gain;
    }
  });

  // Soft-clip to avoid inter-note summing distortion.
  for (let i = 0; i < length; i += 1) buf[i] = Math.tanh(buf[i] * 1.25);
  return buf;
};

const toWav = (float32) => {
  const numSamples = float32.length;
  const dataSize = numSamples * 2;
  const buffer = Buffer.alloc(44 + dataSize);

  buffer.write('RIFF', 0);
  buffer.writeUInt32LE(36 + dataSize, 4);
  buffer.write('WAVE', 8);
  buffer.write('fmt ', 12);
  buffer.writeUInt32LE(16, 16);
  buffer.writeUInt16LE(1, 20); // PCM
  buffer.writeUInt16LE(1, 22); // mono
  buffer.writeUInt32LE(SAMPLE_RATE, 24);
  buffer.writeUInt32LE(SAMPLE_RATE * 2, 28);
  buffer.writeUInt16LE(2, 32);
  buffer.writeUInt16LE(16, 34);
  buffer.write('data', 36);
  buffer.writeUInt32LE(dataSize, 40);

  for (let i = 0; i < numSamples; i += 1) {
    const s = Math.max(-1, Math.min(1, float32[i]));
    buffer.writeInt16LE(Math.round(s * 32767), 44 + i * 2);
  }
  return buffer;
};

// Note frequencies (equal temperament)
const N = {
  E5: 659.25, G5: 783.99, A5: 880.0, B5: 987.77, C6: 1046.5, D6: 1174.66,
  E6: 1318.51, G6: 1567.98, A6: 1760.0, C7: 2093.0, E4: 329.63, A4: 440.0, C5: 523.25,
};

const cues = {
  // Ascending three-note chime — incoming message.
  'message-received': {
    total: 0.62,
    notes: [
      { freq: N.A5, start: 0.0, duration: 0.16, gain: 0.5 },
      { freq: N.C6, start: 0.075, duration: 0.18, gain: 0.5 },
      { freq: N.E6, start: 0.15, duration: 0.42, gain: 0.55 },
    ],
  },
  // Short bright pop — outgoing message sent.
  'message-sent': {
    total: 0.26,
    notes: [
      { freq: N.E6, start: 0.0, duration: 0.09, gain: 0.42 },
      { freq: N.A6, start: 0.035, duration: 0.2, gain: 0.36 },
    ],
  },
  // Two-tone descending — message delivered/read confirmation.
  'delivered': {
    total: 0.3,
    notes: [
      { freq: N.C7, start: 0.0, duration: 0.1, gain: 0.3 },
      { freq: N.G6, start: 0.06, duration: 0.2, gain: 0.28 },
    ],
  },
  // Gentle repeating arpeggio — incoming call ringtone (1 loop).
  'ringtone': {
    total: 2.4,
    notes: [
      ...[0, 1.2].flatMap((o) => [
        { freq: N.E5, start: o + 0.0, duration: 0.22, gain: 0.42 },
        { freq: N.G5, start: o + 0.14, duration: 0.22, gain: 0.42 },
        { freq: N.B5, start: o + 0.28, duration: 0.24, gain: 0.44 },
        { freq: N.E6, start: o + 0.42, duration: 0.5, gain: 0.46 },
      ]),
    ],
  },
  // Soft double blip — outgoing call ringback.
  'ringback': {
    total: 1.1,
    notes: [
      { freq: N.A4, start: 0.0, duration: 0.34, gain: 0.3, harmonics: [1, 0.18] },
      { freq: N.A4, start: 0.45, duration: 0.34, gain: 0.3, harmonics: [1, 0.18] },
    ],
  },
  // Descending pair — call ended.
  'call-end': {
    total: 0.5,
    notes: [
      { freq: N.C6, start: 0.0, duration: 0.14, gain: 0.36 },
      { freq: N.E5, start: 0.1, duration: 0.34, gain: 0.34 },
    ],
  },
  // Tiny tick — reaction applied / selection.
  'tap': {
    total: 0.1,
    notes: [{ freq: N.C7, start: 0, duration: 0.06, gain: 0.22, harmonics: [1] }],
  },
  // Voice-note recording start.
  'record-start': {
    total: 0.24,
    notes: [
      { freq: N.C5, start: 0.0, duration: 0.08, gain: 0.34 },
      { freq: N.G5, start: 0.05, duration: 0.16, gain: 0.34 },
    ],
  },
};

const outDir = path.join(__dirname, '..', 'assets', 'sounds');
fs.mkdirSync(outDir, { recursive: true });

let total = 0;
Object.entries(cues).forEach(([name, { notes, total: dur }]) => {
  const wav = toWav(render(notes, dur));
  const file = path.join(outDir, `${name}.wav`);
  fs.writeFileSync(file, wav);
  total += wav.length;
  console.log(`${name}.wav  ${(wav.length / 1024).toFixed(1)} KB  (${dur}s)`);
});

console.log(`\n${Object.keys(cues).length} cues, ${(total / 1024).toFixed(1)} KB total -> assets/sounds/`);
