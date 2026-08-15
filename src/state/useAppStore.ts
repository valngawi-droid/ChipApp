import { create } from 'zustand';

import { seedChats, seedCalls, seedStatuses, seedCommunities, seedChannels } from '../data/seed';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageKind = 'text' | 'voice' | 'image' | 'sticker' | 'system';

export interface Reaction {
  emoji: string;
  by: string;
}

export interface Message {
  id: string;
  chatId: string;
  text: string;
  isMe: boolean;
  timestamp: string;
  status: MessageStatus;
  kind: MessageKind;
  /** Voice note length in seconds (kind === 'voice'). */
  durationSec?: number;
  /** Normalised 0..1 amplitude samples for the waveform (kind === 'voice'). */
  waveform?: number[];
  /** Bundled sticker asset (kind === 'sticker'). */
  stickerSource?: number;
  reactions?: Reaction[];
  replyTo?: { id: string; author: string; preview: string } | null;
  authorName?: string;
}

export interface Chat {
  id: string;
  name: string;
  avatarColor: string;
  isGroup: boolean;
  muted: boolean;
  pinned: boolean;
  unreadCount: number;
  lastMessage: string;
  timestamp: string;
  online?: boolean;
  messages: Message[];
}

export interface CallRecord {
  id: string;
  name: string;
  avatarColor: string;
  direction: 'incoming' | 'outgoing' | 'missed';
  video: boolean;
  timestamp: string;
  durationSec: number;
}

export interface StatusUpdate {
  id: string;
  name: string;
  avatarColor: string;
  viewed: boolean;
  timestamp: string;
  /** Individual story frames, each shown for `durationMs`. */
  frames: { id: string; caption: string; gradient: [string, string]; durationMs: number }[];
}

export interface Community {
  id: string;
  name: string;
  avatarColor: string;
  description: string;
  groups: { id: string; name: string; unread: number; lastMessage: string }[];
}

export interface Channel {
  id: string;
  name: string;
  avatarColor: string;
  verified: boolean;
  followers: number;
  latest: string;
  timestamp: string;
}

export interface AppUser {
  googleId: string;
  email: string;
  name: string;
  picture?: string;
}

export type ConnectionState = 'offline' | 'connecting' | 'connected';

interface AppState {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  connection: ConnectionState;

  chats: Chat[];
  calls: CallRecord[];
  statuses: StatusUpdate[];
  communities: Community[];
  channels: Channel[];

  activeChatId: string | null;
  typingChatIds: string[];

  setAuthData: (user: AppUser, token: string) => void;
  logout: () => void;
  setConnection: (c: ConnectionState) => void;

  setActiveChat: (chatId: string | null) => void;
  sendMessage: (chatId: string, message: Omit<Message, 'chatId'>) => void;
  receiveMessage: (chatId: string, message: Omit<Message, 'chatId'>) => void;
  updateMessageStatus: (chatId: string, messageId: string, status: MessageStatus) => void;
  toggleReaction: (chatId: string, messageId: string, emoji: string) => void;
  markChatRead: (chatId: string) => void;
  togglePinned: (chatId: string) => void;
  toggleMuted: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  setTyping: (chatId: string, typing: boolean) => void;
  markStatusViewed: (statusId: string) => void;
}

/** Chat-list preview text for a message of any kind. */
const previewFor = (m: { kind: MessageKind; text: string }) => {
  if (m.kind === 'voice') return '🎤 Voice message';
  if (m.kind === 'sticker') return '🖼️ Sticker';
  return m.text;
};

export const useAppStore = create<AppState>((set) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  connection: 'offline',

  chats: seedChats,
  calls: seedCalls,
  statuses: seedStatuses,
  communities: seedCommunities,
  channels: seedChannels,

  activeChatId: null,
  typingChatIds: [],

  setAuthData: (user, token) => set({ user, token, isAuthenticated: true }),
  logout: () => set({ user: null, token: null, isAuthenticated: false, activeChatId: null }),
  setConnection: (connection) => set({ connection }),

  setActiveChat: (activeChatId) => set({ activeChatId }),

  sendMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, { ...message, chatId }],
              lastMessage: previewFor(message),
              timestamp: message.timestamp,
            }
          : chat
      ),
    })),

  receiveMessage: (chatId, message) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: [...chat.messages, { ...message, chatId }],
              lastMessage: previewFor(message),
              timestamp: message.timestamp,
              unreadCount: state.activeChatId === chatId ? 0 : chat.unreadCount + 1,
            }
          : chat
      ),
    })),

  updateMessageStatus: (chatId, messageId, status) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? {
              ...chat,
              messages: chat.messages.map((m) => (m.id === messageId ? { ...m, status } : m)),
            }
          : chat
      ),
    })),

  toggleReaction: (chatId, messageId, emoji) =>
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = m.reactions ?? [];
            const mine = existing.find((r) => r.by === 'me');
            if (mine && mine.emoji === emoji) {
              return { ...m, reactions: existing.filter((r) => r.by !== 'me') };
            }
            return {
              ...m,
              reactions: [...existing.filter((r) => r.by !== 'me'), { emoji, by: 'me' }],
            };
          }),
        };
      }),
    })),

  markChatRead: (chatId) =>
    set((state) => ({
      chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, unreadCount: 0 } : chat)),
    })),

  togglePinned: (chatId) =>
    set((state) => ({
      chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, pinned: !chat.pinned } : chat)),
    })),

  toggleMuted: (chatId) =>
    set((state) => ({
      chats: state.chats.map((chat) => (chat.id === chatId ? { ...chat, muted: !chat.muted } : chat)),
    })),

  deleteChat: (chatId) => set((state) => ({ chats: state.chats.filter((c) => c.id !== chatId) })),

  setTyping: (chatId, typing) =>
    set((state) => ({
      typingChatIds: typing
        ? Array.from(new Set([...state.typingChatIds, chatId]))
        : state.typingChatIds.filter((id) => id !== chatId),
    })),

  markStatusViewed: (statusId) =>
    set((state) => ({
      statuses: state.statuses.map((s) => (s.id === statusId ? { ...s, viewed: true } : s)),
    })),
}));
