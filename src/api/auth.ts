import type { AppUser } from '../state/useAppStore';
import { api } from './client';
import { endpoints } from './config';

export interface AuthResponse {
  status: 'success';
  token: string;
  user: AppUser;
}

/**
 * Demo / guest sign-in.
 *
 * Issues a genuine signed JWT for a sample profile so the entire app — realtime
 * chat, calls, settings — is explorable without a Google account. The
 * production path lives in api/googleAuth.ts (expo-auth-session).
 */
export const authenticateDemo = (name?: string) =>
  api.post<AuthResponse>(endpoints.demoAuth, { name });

export const fetchProfile = (token: string) =>
  api.get<{ status: string; user: AppUser }>(endpoints.me, token);
