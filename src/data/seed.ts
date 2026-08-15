import type { CallRecord, Channel, Chat, Community, StatusUpdate } from '../state/useAppStore';

/** Deterministic relative timestamps so the UI looks alive on every launch. */
const minutesAgo = (m: number) => new Date(Date.now() - m * 60_000).toISOString();
const hoursAgo = (h: number) => minutesAgo(h * 60);
const daysAgo = (d: number) => hoursAgo(d * 24);

/** iOS-flavoured avatar tints. */
export const avatarColors = {
  blue: '#007AFF',
  green: '#34C759',
  indigo: '#5856D6',
  orange: '#FF9500',
  pink: '#FF2D55',
  purple: '#AF52DE',
  teal: '#5AC8FA',
  red: '#FF3B30',
  brown: '#A2845E',
  mint: '#00C7BE',
};

const waveA = [
  0.43, 0.94, 0.71, 0.95, 0.29, 0.89, 0.52, 0.29, 0.3, 0.99, 0.98, 0.65, 0.59, 0.66, 0.7, 0.83, 0.83,
  0.56, 0.61, 0.89, 0.52, 0.61, 0.32, 0.81, 0.88, 0.52, 0.38, 0.99, 0.34, 0.59, 0.59, 0.33, 0.34, 0.72,
];
const waveB = [
  0.43, 0.39, 0.4, 0.58, 0.53, 0.49, 0.55, 0.91, 0.39, 0.84, 0.49, 0.34, 0.35, 0.9, 0.85, 0.48, 0.94,
  0.72, 0.74, 0.45, 0.28, 0.52, 0.61, 0.81, 0.61, 0.66, 0.68, 0.79,
];

export const seedChats: Chat[] = [
  {
    id: 'c1',
    name: 'Nadia Pratiwi',
    avatarColor: avatarColors.pink,
    isGroup: false,
    muted: false,
    pinned: true,
    unreadCount: 2,
    lastMessage: 'Sudah sampai rumah? 😊',
    timestamp: minutesAgo(3),
    online: true,
    messages: [
      {
        id: 'm1',
        chatId: 'c1',
        text: 'Pesan dan panggilan dienkripsi secara end-to-end. Tidak ada pihak di luar obrolan ini yang dapat membaca atau mendengarkannya.',
        isMe: false,
        timestamp: daysAgo(1),
        status: 'read',
        kind: 'system',
      },
      {
        id: 'm2',
        chatId: 'c1',
        text: 'Halo! Jadi ketemu nanti sore?',
        isMe: false,
        timestamp: minutesAgo(52),
        status: 'read',
        kind: 'text',
      },
      {
        id: 'm3',
        chatId: 'c1',
        text: 'Jadi dong. Jam 4 di kafe biasa ya',
        isMe: true,
        timestamp: minutesAgo(48),
        status: 'read',
        kind: 'text',
        reactions: [{ emoji: '👍', by: 'nadia' }],
      },
      {
        id: 'm4',
        chatId: 'c1',
        text: '',
        isMe: false,
        timestamp: minutesAgo(30),
        status: 'read',
        kind: 'voice',
        durationSec: 14,
        waveform: waveA,
      },
      {
        id: 'm5',
        chatId: 'c1',
        text: 'Oke, aku bawa laptop buat nunjukin desainnya',
        isMe: true,
        timestamp: minutesAgo(12),
        status: 'delivered',
        kind: 'text',
        replyTo: { id: 'm4', author: 'Nadia Pratiwi', preview: '🎤 Voice message (0:14)' },
      },
      {
        id: 'm6',
        chatId: 'c1',
        text: 'Sudah sampai rumah? 😊',
        isMe: false,
        timestamp: minutesAgo(3),
        status: 'delivered',
        kind: 'text',
      },
    ],
  },
  {
    id: 'c2',
    name: 'Design Team',
    avatarColor: avatarColors.indigo,
    isGroup: true,
    muted: true,
    pinned: true,
    unreadCount: 0,
    lastMessage: 'Rizky: Mockup v4 sudah di Figma',
    timestamp: minutesAgo(41),
    messages: [
      {
        id: 'g1',
        chatId: 'c2',
        text: 'Selamat pagi tim! Standup jam 9 ya',
        isMe: false,
        timestamp: hoursAgo(5),
        status: 'read',
        kind: 'text',
        authorName: 'Putri',
      },
      {
        id: 'g2',
        chatId: 'c2',
        text: 'Siap 👍',
        isMe: true,
        timestamp: hoursAgo(5),
        status: 'read',
        kind: 'text',
      },
      {
        id: 'g3',
        chatId: 'c2',
        text: 'Mockup v4 sudah di Figma',
        isMe: false,
        timestamp: minutesAgo(41),
        status: 'read',
        kind: 'text',
        authorName: 'Rizky',
        reactions: [
          { emoji: '🔥', by: 'putri' },
          { emoji: '🎉', by: 'dian' },
        ],
      },
    ],
  },
  {
    id: 'c3',
    name: 'Mom',
    avatarColor: avatarColors.orange,
    isGroup: false,
    muted: false,
    pinned: false,
    unreadCount: 1,
    lastMessage: 'Jangan lupa makan siang ya nak',
    timestamp: hoursAgo(2),
    messages: [
      {
        id: 'mm1',
        chatId: 'c3',
        text: 'Jangan lupa makan siang ya nak',
        isMe: false,
        timestamp: hoursAgo(2),
        status: 'delivered',
        kind: 'text',
      },
    ],
  },
  {
    id: 'c4',
    name: 'Alexander Chen',
    avatarColor: avatarColors.blue,
    isGroup: false,
    muted: false,
    pinned: false,
    unreadCount: 0,
    lastMessage: 'Terima kasih atas responsnya yang cepat!',
    timestamp: hoursAgo(6),
    messages: [
      {
        id: 'ac1',
        chatId: 'c4',
        text: 'Kontraknya sudah saya kirim untuk ditinjau.',
        isMe: false,
        timestamp: hoursAgo(7),
        status: 'read',
        kind: 'text',
      },
      {
        id: 'ac2',
        chatId: 'c4',
        text: 'Sudah diterima — akan saya tanda tangani sore ini.',
        isMe: true,
        timestamp: hoursAgo(6.5),
        status: 'read',
        kind: 'text',
      },
      {
        id: 'ac3',
        chatId: 'c4',
        text: 'Terima kasih atas responsnya yang cepat!',
        isMe: false,
        timestamp: hoursAgo(6),
        status: 'read',
        kind: 'text',
      },
    ],
  },
  {
    id: 'c5',
    name: 'Keluarga Besar',
    avatarColor: avatarColors.green,
    isGroup: true,
    muted: false,
    pinned: false,
    unreadCount: 12,
    lastMessage: 'Om Budi: Undangan arisan bulan depan',
    timestamp: daysAgo(1),
    messages: [
      {
        id: 'kb1',
        chatId: 'c5',
        text: 'Undangan arisan bulan depan',
        isMe: false,
        timestamp: daysAgo(1),
        status: 'delivered',
        kind: 'text',
        authorName: 'Om Budi',
      },
    ],
  },
  {
    id: 'c6',
    name: 'Sofia Martínez',
    avatarColor: avatarColors.purple,
    isGroup: false,
    muted: false,
    pinned: false,
    unreadCount: 0,
    lastMessage: '¡Nos vemos mañana!',
    timestamp: daysAgo(2),
    messages: [
      {
        id: 'sm1',
        chatId: 'c6',
        text: '',
        isMe: false,
        timestamp: daysAgo(2),
        status: 'read',
        kind: 'voice',
        durationSec: 9,
        waveform: waveB,
      },
      {
        id: 'sm2',
        chatId: 'c6',
        text: '¡Nos vemos mañana!',
        isMe: false,
        timestamp: daysAgo(2),
        status: 'read',
        kind: 'text',
      },
    ],
  },
  {
    id: 'c7',
    name: 'Dev Standup',
    avatarColor: avatarColors.teal,
    isGroup: true,
    muted: false,
    pinned: false,
    unreadCount: 0,
    lastMessage: 'Anda: Sudah dideploy ke staging ✅',
    timestamp: daysAgo(3),
    messages: [
      {
        id: 'ds1',
        chatId: 'c7',
        text: 'Sudah dideploy ke staging ✅',
        isMe: true,
        timestamp: daysAgo(3),
        status: 'read',
        kind: 'text',
      },
    ],
  },
];

export const seedCalls: CallRecord[] = [
  { id: 'v1', name: 'Nadia Pratiwi', avatarColor: avatarColors.pink, direction: 'incoming', video: true, timestamp: minutesAgo(35), durationSec: 742 },
  { id: 'v2', name: 'Alexander Chen', avatarColor: avatarColors.blue, direction: 'missed', video: false, timestamp: hoursAgo(3), durationSec: 0 },
  { id: 'v3', name: 'Design Team', avatarColor: avatarColors.indigo, direction: 'outgoing', video: true, timestamp: hoursAgo(9), durationSec: 1841 },
  { id: 'v4', name: 'Mom', avatarColor: avatarColors.orange, direction: 'outgoing', video: false, timestamp: daysAgo(1), durationSec: 320 },
  { id: 'v5', name: 'Sofia Martínez', avatarColor: avatarColors.purple, direction: 'missed', video: true, timestamp: daysAgo(2), durationSec: 0 },
  { id: 'v6', name: 'Rizky Ananda', avatarColor: avatarColors.mint, direction: 'incoming', video: false, timestamp: daysAgo(4), durationSec: 96 },
];

export const seedStatuses: StatusUpdate[] = [
  {
    id: 's1',
    name: 'Nadia Pratiwi',
    avatarColor: avatarColors.pink,
    viewed: false,
    timestamp: minutesAgo(22),
    frames: [
      { id: 's1f1', caption: 'Sunset di Bandung 🌇', gradient: ['#FF9500', '#FF2D55'], durationMs: 5000 },
      { id: 's1f2', caption: 'Kopi dulu ☕️', gradient: ['#A2845E', '#5856D6'], durationMs: 5000 },
    ],
  },
  {
    id: 's2',
    name: 'Design Team',
    avatarColor: avatarColors.indigo,
    viewed: false,
    timestamp: hoursAgo(1),
    frames: [{ id: 's2f1', caption: 'Rilis v4.2 hari ini 🚀', gradient: ['#5856D6', '#00C7BE'], durationMs: 5000 }],
  },
  {
    id: 's3',
    name: 'Alexander Chen',
    avatarColor: avatarColors.blue,
    viewed: true,
    timestamp: hoursAgo(8),
    frames: [{ id: 's3f1', caption: 'Lari pagi, 10K selesai', gradient: ['#007AFF', '#34C759'], durationMs: 5000 }],
  },
  {
    id: 's4',
    name: 'Sofia Martínez',
    avatarColor: avatarColors.purple,
    viewed: true,
    timestamp: hoursAgo(14),
    frames: [{ id: 's4f1', caption: 'Barcelona 💜', gradient: ['#AF52DE', '#FF2D55'], durationMs: 5000 }],
  },
];

export const seedCommunities: Community[] = [
  {
    id: 'cm1',
    name: 'Warga RW 08',
    avatarColor: avatarColors.green,
    description: 'RW 08 — pengumuman, keamanan, dan acara.',
    groups: [
      { id: 'cm1g1', name: 'Pengumuman', unread: 3, lastMessage: 'Kerja bakti Minggu pagi' },
      { id: 'cm1g2', name: 'Ronda Keamanan', unread: 0, lastMessage: 'Jadwal ronda diperbarui' },
      { id: 'cm1g3', name: 'Jual Beli', unread: 7, lastMessage: 'Dijual sepeda anak' },
    ],
  },
  {
    id: 'cm2',
    name: 'ChipApp Builders',
    avatarColor: avatarColors.blue,
    description: 'Tim teknis yang membangun platform ChipApp.',
    groups: [
      { id: 'cm2g1', name: 'Pengumuman', unread: 1, lastMessage: 'Rilis 4.2.0 sudah tayang' },
      { id: 'cm2g2', name: 'Tim iOS', unread: 0, lastMessage: 'Catatan migrasi Reanimated 4' },
      { id: 'cm2g3', name: 'Backend', unread: 2, lastMessage: 'Penskalaan cluster socket' },
    ],
  },
];

export const seedChannels: Channel[] = [
  { id: 'ch1', name: 'ChipApp', avatarColor: avatarColors.green, verified: true, followers: 1_284_000, latest: 'Versi 4.2 menghadirkan pesan suara yang lebih cepat.', timestamp: hoursAgo(4) },
  { id: 'ch2', name: 'Tech Daily', avatarColor: avatarColors.blue, verified: true, followers: 892_400, latest: 'Apple mengumumkan panduan HIG terbaru.', timestamp: hoursAgo(11) },
  { id: 'ch3', name: 'Jakarta Traffic', avatarColor: avatarColors.orange, verified: false, followers: 45_200, latest: 'Tol dalam kota lancar pagi ini.', timestamp: daysAgo(1) },
];

/**
 * Demo peers shown in the "new chat" picker before any live users have
 * connected. They use synthetic ids that the backend treats as demo users
 * once the same person signs in with the matching demo name.
 */
export interface SeedPeer {
  id: string;
  name: string;
  email: string;
  avatarColor: string;
  online: boolean;
}

export const seedPeers: SeedPeer[] = [
  { id: 'demo-nadia-pratiwi', name: 'Nadia Pratiwi', email: 'nadia-pratiwi@chipapp.demo', avatarColor: avatarColors.pink, online: true },
  { id: 'demo-budi-santoso', name: 'Budi Santoso', email: 'budi-santoso@chipapp.demo', avatarColor: avatarColors.blue, online: false },
  { id: 'demo-siti-rahma', name: 'Siti Rahma', email: 'siti-rahma@chipapp.demo', avatarColor: avatarColors.green, online: true },
  { id: 'demo-arif-wijaya', name: 'Arif Wijaya', email: 'arif-wijaya@chipapp.demo', avatarColor: avatarColors.indigo, online: false },
  { id: 'demo-dewi-lestari', name: 'Dewi Lestari', email: 'dewi-lestari@chipapp.demo', avatarColor: avatarColors.purple, online: true },
  { id: 'demo-rudi-hartono', name: 'Rudi Hartono', email: 'rudi-hartono@chipapp.demo', avatarColor: avatarColors.orange, online: false },
];
