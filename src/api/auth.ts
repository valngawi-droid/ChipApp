import type { AppUser } from '../state/useAppStore';
import { api } from './client';
import { endpoints } from './config';

export interface AuthResponse {
  status: 'success';
  token: string;
  user: AppUser;
}

/** Exchange a Google ID token for a ChipApp session JWT. */
export const authenticateWithGoogle = (idToken: string) =>
  api.post<AuthResponse>(endpoints.googleAuth, { token: idToken });

/**
 * Demo sign-in.
 *
 * Google's real OAuth flow cannot complete inside the sandboxed preview (the
 * origin is not on the client's authorised list), so the backend exposes a
 * clearly-separated demo endpoint that issues a genuine, signed JWT for a
 * sample profile. The production Google path above is fully implemented and
 * used whenever a real ID token is available.
 */
export const authenticateDemo = (name?: string) =>
  api.post<AuthResponse>(endpoints.demoAuth, { name });

export const fetchProfile = (token: string) =>
  api.get<{ status: string; user: AppUser }>(endpoints.me, token);
