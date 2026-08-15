import * as AuthSession from 'expo-auth-session';
import * as WebBrowser from 'expo-web-browser';
import { Platform } from 'react-native';

import { api } from './client';
import { GOOGLE_CLIENT_ID, endpoints } from './config';
import type { AppUser } from '../state/useAppStore';

// Web based Google sign-in needs the in-browser result to be dismissed.
WebBrowser.maybeCompleteAuthSession();

export interface AuthResponse {
  status: 'success';
  token: string;
  user: AppUser;
}

interface GoogleUserInfo {
  sub: string;
  email: string;
  name: string;
  picture?: string;
}

/**
 * Production Google sign-in.
 *
 * Uses expo-auth-session (OpenID Connect) so no native Google Sign-In SDK is
 * required — keeps the build dependency-light for Termux/EAS. The resulting
 * ID token is verified by the Node backend against the same client id.
 */
export async function signInWithGoogle(): Promise<AuthResponse> {
  const redirectUri = AuthSession.makeRedirectUri({
    scheme: 'chipapp',
  });

  const request = new AuthSession.AuthRequest({
    clientId: GOOGLE_CLIENT_ID,
    scopes: ['openid', 'profile', 'email'],
    responseType: AuthSession.ResponseType.IdToken,
    redirectUri,
    usePKCE: false,
    extraParams: {
      // For the Expo auth proxy / loopback clients. Native builds can set
      // a matching Android OAuth client if configured.
      nonce: String(Date.now()),
    },
  });

  const result = await request.promptAsync({
    authorizationEndpoint: 'https://accounts.google.com/o/oauth2/v2/auth',
  } as AuthSession.AuthDiscoveryDocument);

  if (result.type !== 'success' || !result.params.id_token) {
    if (result.type === 'cancel' || result.type === 'dismiss') {
      const err = new Error('Sign-in dibatalkan');
      (err as Error & { cancelled?: boolean }).cancelled = true;
      throw err;
    }
    throw new Error('Gagal mendapatkan token Google');
  }

  // Exchange the Google ID token for a ChipApp session JWT.
  const session = await api.post<AuthResponse>(endpoints.googleAuth, {
    token: result.params.id_token,
  });

  // The backend already returned the profile; no extra userinfo call needed.
  return session;
}

/**
 * Verifies a Google access token against the userinfo endpoint and then swaps
 * it for a ChipApp session. Used as a fallback path when the ID token isn't
 * available (some web/proxy configurations).
 */
export async function exchangeGoogleAccessToken(accessToken: string): Promise<AuthResponse> {
  const info = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!info.ok) throw new Error('Google profile gagal dimuat');
  const profile = (await info.json()) as GoogleUserInfo;

  // We can't forge an ID token locally, so we use the demo-style session but
  // pin it to the verified Google identity. This endpoint requires the server
  // to trust verified profile data — for a real release prefer the ID token
  // path above.
  return api.post<AuthResponse>('/api/auth/google/exchange', {
    googleId: profile.sub,
    email: profile.email,
    name: profile.name,
    picture: profile.picture,
  });
}

export const isWeb = Platform.OS === 'web';
