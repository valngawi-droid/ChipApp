import { Platform } from 'react-native';

/**
 * Where the ChipApp backend lives.
 *
 * Web: relative origin. The browser rendering the app is not inside the sandbox,
 * so it must never be told to call localhost — Metro proxies /api and /socket.io
 * through to the Node server (see metro.config.js). In production the very same
 * relative paths are served by the Cloudflare Tunnel hostname.
 *
 * Native: point at an explicit base URL — the tunnel domain in production, or a
 * LAN address during development.
 */
const EXPLICIT_BASE_URL = process.env.EXPO_PUBLIC_API_URL;

const NATIVE_BASE_URL = EXPLICIT_BASE_URL ?? 'https://chipapp-tunnel.example.com';

/**
 * On web we normally use the page origin (empty string) so the Metro proxy —
 * or the Cloudflare Tunnel in production — forwards /api and /socket.io to the
 * backend. But when EXPO_PUBLIC_API_URL is set explicitly the user is pointing
 * the app at a backend somewhere else (e.g. a phone running Termux on the LAN),
 * so that wins on every platform.
 *
 * Note for web + a remote backend: the browser enforces CORS, and the server
 * already sends permissive CORS headers for both REST and Socket.io.
 */
export const API_BASE_URL =
  Platform.OS === 'web' ? EXPLICIT_BASE_URL ?? '' : NATIVE_BASE_URL;

export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';

export const endpoints = {
  googleAuth: '/api/auth/google',
  demoAuth: '/api/auth/demo',
  me: '/api/me',
  chats: '/api/chats',
  health: '/api/health',
};
