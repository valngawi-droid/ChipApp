import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

import { API_BASE_URL } from './config';

/**
 * Socket.io transport.
 *
 * On web we connect to the page origin (empty base URL) so the Metro dev-server
 * proxy — and, in production, the Cloudflare Tunnel — forwards the upgrade to
 * the Node backend. Native builds dial the configured tunnel URL directly.
 */
export const socket: Socket = io(API_BASE_URL || undefined, {
  autoConnect: false,
  // Polling first keeps the handshake working through proxies that do not
  // upgrade websockets immediately; socket.io upgrades transparently after.
  transports: Platform.OS === 'web' ? ['polling', 'websocket'] : ['websocket', 'polling'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 800,
  reconnectionDelayMax: 5000,
  timeout: 10_000,
});

export const initializeSocket = (token?: string | null) => {
  socket.auth = token ? { token } : {};
  if (!socket.connected) socket.connect();
  return socket;
};

export const teardownSocket = () => {
  if (socket.connected) socket.disconnect();
};

export interface WireMessage {
  id?: string;
  serverId?: string;
  room: string;
  text: string;
  kind?: string;
  timestamp?: string;
  author?: string;
  authorName?: string;
  authorPicture?: string | null;
}

export interface WireReaction {
  room: string;
  messageId: string;
  emoji: string;
  userId: string;
  userName: string;
  reactions: Record<string, string[]>;
}

export const joinChat = (room: string) => socket.emit('join_chat', room);
export const leaveChat = (room: string) => socket.emit('leave_chat', room);
export const sendWireMessage = (payload: WireMessage) => socket.emit('send_message', payload);
export const emitTyping = (room: string, typing: boolean) =>
  socket.emit('typing', { room, typing });
export const emitReadReceipt = (room: string, messageId?: string) =>
  socket.emit('read_receipt', { room, messageId });
export const emitReaction = (room: string, messageId: string, emoji: string) =>
  socket.emit('react', { room, messageId, emoji });
export const emitEditMessage = (room: string, messageId: string, text: string) =>
  socket.emit('edit_message', { room, messageId, text });
export const emitDeleteMessage = (room: string, messageId: string, forEveryone: boolean) =>
  socket.emit('delete_message', { room, messageId, forEveryone });
