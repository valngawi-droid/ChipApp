import { Platform } from 'react-native';

/**
 * Where the ChipApp backend lives.
 *
 * Web: relative origin by default. Metro proxies /api and /socket.io to backend in dev.
 * In production:
 *  - Vercel frontend + Render backend (realtime full): set EXPO_PUBLIC_API_URL=https://chipapp-xxxx.onrender.com
 *  - Vercel + NeonDB direct: same origin '' (API served by Vercel serverless api/index.js which uses Neon)
 *  - Render only: same origin '' (backend serves dist + API same origin)
 *  - Cloudflare Tunnel: same origin
 *
 * Native: explicit URL to backend (Render URL or tunnel).
 */

const EXPLICIT_BASE_URL = process.env.EXPO_PUBLIC_API_URL;
const RENDER_BACKEND_URL = process.env.EXPO_PUBLIC_RENDER_BACKEND_URL || process.env.RENDER_BACKEND_URL || EXPLICIT_BASE_URL;

/**
 * Primary custom domain: chiperx.cyou only (user request)
 */
export const PERSONAL_DOMAINS = ['chiperx.cyou'] as const;

export const PERSONAL_DOMAINS_HTTPS = PERSONAL_DOMAINS.flatMap((d) => [
  `https://${d}`,
  `https://www.${d}`,
]);

const isOnPersonalDomain = () => {
  if (Platform.OS !== 'web') return false;
  if (typeof window === 'undefined') return false;
  try {
    const host = window.location.hostname.toLowerCase();
    return PERSONAL_DOMAINS.some((d) => host === d || host === `www.${d}` || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
};

const NATIVE_BASE_URL = EXPLICIT_BASE_URL ?? 'https://chipapp-tunnel.example.com';

/**
 * For realtime fix: if EXPO_PUBLIC_API_URL is set (e.g. Render backend URL), use it.
 * That makes Socket.io connect directly to Render backend (full WebSocket persistent).
 * If not set, use same-origin '' -> Vercel Edge will serve frontend, API proxied via api/index.js to Render if RENDER_BACKEND_URL set.
 */
export const API_BASE_URL =
  Platform.OS === 'web' ? EXPLICIT_BASE_URL ?? '' : NATIVE_BASE_URL;

export const getCurrentDomainInfo = () => {
  if (Platform.OS !== 'web' || typeof window === 'undefined') return null;
  return {
    hostname: window.location.hostname,
    origin: window.location.origin,
    isPersonal: isOnPersonalDomain(),
    isRender: window.location.hostname.includes('onrender.com'),
    isVercel: window.location.hostname.includes('vercel.app'),
    apiBase: API_BASE_URL || window.location.origin,
    renderBackendUrl: RENDER_BACKEND_URL || null,
  };
};

export const GOOGLE_CLIENT_ID =
  process.env.EXPO_PUBLIC_GOOGLE_CLIENT_ID ??
  '68960926780-ti5kaoq71pvg7mb54am9q4176nvcee2i.apps.googleusercontent.com';

export const endpoints = {
  googleAuth: '/api/auth/google',
  demoAuth: '/api/auth/demo',
  me: '/api/me',
  chats: '/api/chats',
  chatMessages: (room: string) => `/api/chats/${encodeURIComponent(room)}/messages`,
  users: '/api/users',
  history: '/api/history',
  dbStats: '/api/db/stats',
  health: '/api/health',
  config: '/api/config',
  domains: '/api/domains',
};
