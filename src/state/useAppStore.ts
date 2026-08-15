import { create } from 'zustand';

import { seedChats, seedCalls, seedStatuses, seedCommunities, seedChannels, seedPeers } from '../data/seed';
import type { RemoteUser } from '../api/client';

export type MessageStatus = 'sending' | 'sent' | 'delivered' | 'read';
export type MessageKind = 'text' | 'voice' | 'image' | 'sticker' | 'system';

export interface Reaction {
  emoji: string;
  by: string;
  name?: string;
}

export interface Message {
  id: string;
  chatId: string;
  text: string;
  isMe: boolean;
  timestamp: string;
  status: MessageStatus;
  kind: MessageKind;
  editedAt?: string;
  deleted?: boolean;
  /** Voice note length in seconds (kind === 'voice'). */
  durationSec?: number;
  /** Normalised 0..1 amplitude samples for the waveform (kind === 'voice'). */
  waveform?: number[];
  /** Bundled sticker asset (kind === 'sticker'). */
  stickerSource?: number;
  reactions?: Reaction[];
  replyTo?: { id: string; author: string; preview: string } | null;
  authorId?: string;
  authorName?: string;
  authorPicture?: string | null;
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
  peerId?: string;
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
  id?: string;
  googleId: string;
  email: string;
  name: string;
  picture?: string | null;
  avatarColor?: string;
}

export type ConnectionState = 'offline' | 'connecting' | 'connected';

interface AppState {
  user: AppUser | null;
  token: string | null;
  isAuthenticated: boolean;
  connection: ConnectionState;

  peers: RemoteUser[];
  chats: Chat[];
  calls: CallRecord[];
  statuses: StatusUpdate[];
  communities: Community[];
  channels: Channel[];

  activeChatId: string | null;
  typingChatIds: string[];

  setAuthData: (user: AppUser, token: string) => void;
  hydrate: (user: AppUser, token: string) => void;
  logout: () => void;
  setConnection: (c: ConnectionState) => void;
  setPeers: (peers: RemoteUser[]) => void;
  upsertDirectChat: (peer: RemoteUser) => string;
  ensureChatForPeer: (peerId: string) => string | null;

  setActiveChat: (chatId: string | null) => void;
  sendMessage: (chatId: string, message: Omit<Message, 'chatId'>) => void;
  receiveMessage: (chatId: string, message: Omit<Message, 'chatId'>) => void;
  applyMessageAck: (localId: string, patch: { serverId?: string; timestamp?: string; status?: MessageStatus }) => void;
  updateMessageStatus: (chatId: string, messageId: string, status: MessageStatus) => void;
  applyReaction: (chatId: string, messageId: string, emoji: string, userId: string, userName: string) => void;
  /** Optimistically toggle the local user's reaction. */
  toggleReaction: (chatId: string, messageId: string, emoji: string) => void;
  markChatRead: (chatId: string) => void;
  togglePinned: (chatId: string) => void;
  toggleMuted: (chatId: string) => void;
  deleteChat: (chatId: string) => void;
  deleteMessageForMe: (chatId: string, messageId: string) => void;
  markMessageDeleted: (chatId: string, messageId: string) => void;
  editMessage: (chatId: string, messageId: string, text: string) => void;
  patchMessageFromServer: (chatId: string, messageId: string, patch: Partial<Message>) => void;
  clearChat: (chatId: string) => void;
  setTyping: (chatId: string, typing: boolean, peerId?: string) => void;
  markStatusViewed: (statusId: string) => void;
}

const AVATAR_COLORS = [
  '#007AFF', '#34C759', '#5856D6', '#FF9500', '#FF2D55',
  '#AF52DE', '#5AC8FA', '#FF3B30', '#A2845E', '#00C7BE',
];
const colorFor = (seed: string) => {
  let h = 0;
  for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  return AVATAR_COLORS[h % AVATAR_COLORS.length];
};

/** Stable direct-room id, matching the backend convention. */
export const directRoomId = (a: string, b: string) => [a, b].sort().join('::');

/** Chat-list preview text for a message of any kind. */
const previewFor = (m: { kind: MessageKind; text: string }) => {
  if (m.kind === 'voice') return '🎤 Voice message';
  if (m.kind === 'sticker') return '🖼️ Sticker';
  return m.text;
};

const now = () => new Date().toISOString();

export const useAppStore = create<AppState>((set, get) => ({
  user: null,
  token: null,
  isAuthenticated: false,
  connection: 'offline',

  peers: seedPeers.map((p) => ({ ...p, picture: null })),
  chats: seedChats,
  calls: seedCalls,
  statuses: seedStatuses,
  communities: seedCommunities,
  channels: seedChannels,

  activeChatId: null,
  typingChatIds: [],

  setAuthData: (user, token) => {
    const avatarColor = user.avatarColor ?? colorFor(user.id || user.email);
    set({ user: { ...user, avatarColor }, token, isAuthenticated: true });
  },
  hydrate: (user, token) => {
    // Like setAuthData but without emitting a "new sign in" side effect; used
    // when restoring a session from storage on launch.
    const avatarColor = user.avatarColor ?? colorFor(user.id || user.email);
    set({ user: { ...user, avatarColor }, token, isAuthenticated: true });
  },
  logout: () =>
    set({
      user: null,
      token: null,
      isAuthenticated: false,
      activeChatId: null,
      connection: 'offline',
    }),
  setConnection: (connection) => set({ connection }),

  setPeers: (peers) =>
    set((state) => {
      // Keep existing seed peers that are not present on the server.
      const byId = new Map<string, RemoteUser>();
      for (const p of state.peers) byId.set(p.id, p);
      for (const p of peers) byId.set(p.id, p);
      const next = [...byId.values()];
      // Reflect online state on existing direct chats.
      const chats = state.chats.map((c) => {
        if (!c.peerId) return c;
        const peer = byId.get(c.peerId);
        return peer ? { ...c, online: peer.online } : c;
      });
      return { peers: next, chats };
    }),

  upsertDirectChat: (peer) => {
    const me = get().user;
    if (!me?.id) return peer.id;
    const roomId = directRoomId(me.id, peer.id);
    const existing = get().chats.find((c) => c.id === roomId);
    if (existing) {
      // Keep name/online fresh.
      set((s) => ({
        chats: s.chats.map((c) =>
          c.id === roomId ? { ...c, name: peer.name, online: peer.online, peerId: peer.id } : c
        ),
      }));
      return roomId;
    }
    const chat: Chat = {
      id: roomId,
      name: peer.name,
      avatarColor: peer.avatarColor ?? colorFor(peer.id),
      isGroup: false,
      muted: false,
      pinned: false,
      unreadCount: 0,
      lastMessage: '',
      timestamp: now(),
      online: peer.online,
      peerId: peer.id,
      messages: [],
    };
    set((s) => ({
      chats: [chat, ...s.chats],
      peers: s.peers.some((p) => p.id === peer.id)
        ? s.peers
        : [...s.peers, peer],
    }));
    return roomId;
  },

  ensureChatForPeer: (peerId) => {
    const peer = get().peers.find((p) => p.id === peerId);
    if (!peer) return null;
    return get().upsertDirectChat(peer);
  },

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
    set((state) => {
      const exists = state.chats.some((c) => c.id === chatId);
      const peerName = message.authorName || chatId;
      const baseChat = exists
        ? null
        : {
            id: chatId,
            name: peerName,
            avatarColor: colorFor(peerName),
            isGroup: false,
            muted: false,
            pinned: false,
            unreadCount: 0,
            lastMessage: '',
            timestamp: now(),
            online: false,
            peerId: message.authorId,
            messages: [],
          };

      const mapChat = (chat: Chat): Chat => {
        if (chat.id !== chatId) return chat;
        // Deduplicate by server id if we already inserted an optimistic copy.
        const already = chat.messages.some(
          (m) => (message.id && m.id === message.id) || (message.authorId && m.authorId === message.authorId && m.timestamp === message.timestamp && m.text === message.text)
        );
        if (already) return chat;
        return {
          ...chat,
          name: chat.name || peerName,
          peerId: chat.peerId ?? message.authorId,
          messages: [...chat.messages, { ...message, chatId }],
          lastMessage: previewFor(message),
          timestamp: message.timestamp,
          unreadCount: state.activeChatId === chatId ? 0 : chat.unreadCount + 1,
        };
      };

      return {
        chats: exists ? state.chats.map(mapChat) : [mapChat(baseChat as Chat), ...state.chats],
      };
    }),

  applyMessageAck: (localId, patch) =>
    set((state) => ({
      chats: state.chats.map((chat) => ({
        ...chat,
        messages: chat.messages.map((m) => {
          if (m.id !== localId) return m;
          return {
            ...m,
            id: patch.serverId ?? m.id,
            timestamp: patch.timestamp ?? m.timestamp,
            status: patch.status ?? m.status,
          };
        }),
        timestamp: chat.messages.some((m) => m.id === localId) ? patch.timestamp ?? chat.timestamp : chat.timestamp,
      })),
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
    set((state) => {
      const me = state.user;
      const userId = me?.id || 'me';
      const userName = me?.name || 'You';
      return {
        chats: state.chats.map((chat) => {
          if (chat.id !== chatId) return chat;
          return {
            ...chat,
            messages: chat.messages.map((m) => {
              if (m.id !== messageId) return m;
              const existing = m.reactions ?? [];
              const mine = existing.find((r) => r.by === userId);
              if (mine && mine.emoji === emoji) {
                return { ...m, reactions: existing.filter((r) => r.by !== userId) };
              }
              return {
                ...m,
                reactions: [
                  ...existing.filter((r) => r.by !== userId),
                  { emoji, by: userId, name: userName } as Reaction,
                ],
              };
            }),
          };
        }),
      };
    }),

  applyReaction: (chatId, messageId, emoji, userId, userName) =>
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((m) => {
            if (m.id !== messageId) return m;
            const existing = m.reactions ?? [];
            const mine = existing.find((r) => r.by === userId);
            if (mine && mine.emoji === emoji) {
              return { ...m, reactions: existing.filter((r) => r.by !== userId) };
            }
            return {
              ...m,
              reactions: [
                ...existing.filter((r) => r.by !== userId),
                { emoji, by: userId, name: userName } as unknown as Reaction,
              ],
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

  deleteMessageForMe: (chatId, messageId) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id !== chatId
          ? chat
          : { ...chat, messages: chat.messages.filter((m) => m.id !== messageId) }
      ),
    })),

  markMessageDeleted: (chatId, messageId) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id !== chatId
          ? chat
          : { ...chat, messages: chat.messages.map((m) => (m.id === messageId ? { ...m, deleted: true, text: '' } : m)) }
      ),
    })),

  patchMessageFromServer: (chatId, messageId, patch) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id !== chatId
          ? chat
          : { ...chat, messages: chat.messages.map((m) => (m.id === messageId ? { ...m, ...patch } : m)) }
      ),
    })),

  editMessage: (chatId, messageId, text) =>
    set((state) => ({
      chats: state.chats.map((chat) => {
        if (chat.id !== chatId) return chat;
        return {
          ...chat,
          messages: chat.messages.map((m) =>
            m.id === messageId
              ? { ...m, text, editedAt: new Date().toISOString(), status: 'sent' }
              : m
          ),
        };
      }),
    })),

  clearChat: (chatId) =>
    set((state) => ({
      chats: state.chats.map((chat) =>
        chat.id === chatId
          ? { ...chat, messages: [], lastMessage: '', unreadCount: 0 }
          : chat
      ),
    })),

  setTyping: (chatId, typing, _peerId) =>
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
