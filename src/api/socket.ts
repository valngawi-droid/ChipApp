import { io, Socket } from 'socket.io-client';
import { Platform } from 'react-native';

import { API_BASE_URL } from './config';

/**
 * Socket.io transport — Realtime fix for Vercel + Render + NeonDB
 *
 * - Web: if API_BASE_URL set (e.g. Render backend https://chipapp-xxxx.onrender.com), connect directly to Render for full WebSocket persistent realtime
 * - Else same-origin '' -> Vercel Edge serves frontend, API proxied via /api to Render if RENDER_BACKEND_URL set, or Vercel serverless fallback
 * - Polling first keeps handshake working through proxies (Vercel, Cloudflare, Render), upgrades to websocket transparently
 */

export const socket: Socket = io(API_BASE_URL || undefined, {
  autoConnect: false,
  // For Vercel + Render hybrid: polling first to survive proxy, then upgrade to websocket for full realtime
  transports: Platform.OS === 'web' ? ['polling', 'websocket'] : ['websocket'],
  reconnection: true,
  reconnectionAttempts: Infinity,
  reconnectionDelay: 500,
  reconnectionDelayMax: 5000,
  timeout: 15_000,
  // For chiperx.cyou realtime
  withCredentials: true,
  // Force new connection when token changes
  forceNew: false,
});

export const initializeSocket = (token?: string | null) => {
  socket.auth = token ? { token } : {};
  if (!socket.connected) {
    console.log(`[socket] connecting to ${API_BASE_URL || 'same-origin'} (chiperx.cyou realtime)`);
    socket.connect();
  }
  return socket;
};

export const teardownSocket = () => {
  if (socket.connected) {
    console.log('[socket] disconnecting');
    socket.disconnect();
  }
};

export interface WirePayload {
  room: string;
  id: string;
  text: string;
  kind?: string;
  timestamp: string;
  author?: string;
  authorName?: string;
}

export const joinChat = (room: string) => {
  console.log(`[socket] join_chat ${room}`);
  socket.emit('join_chat', room);
};
export const leaveChat = (room: string) => socket.emit('leave_chat', room);
export const sendWireMessage = (payload: WirePayload) => {
  console.log(`[socket] send_message to ${payload.room}: ${payload.text.slice(0, 50)}`);
  socket.emit('send_message', payload);
};
export const emitTyping = (room: string, typing: boolean) => socket.emit('typing', { room, typing });
export const requestHistory = (room: string, limit = 100) => socket.emit('request_history', { room, limit });
