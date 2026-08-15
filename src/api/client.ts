import { API_BASE_URL } from './config';

export interface ApiError extends Error {
  status?: number;
  details?: string;
}

const buildUrl = (path: string) => (path.startsWith('http') ? path : `${API_BASE_URL}${path}`);

/**
 * Minimal fetch wrapper — no axios dependency needed for this surface area,
 * and it keeps the bundle lean while behaving identically on web and native.
 */
export async function request<T>(
  path: string,
  options: RequestInit & { token?: string | null; timeoutMs?: number } = {}
): Promise<T> {
  const { token, timeoutMs = 15_000, headers, ...rest } = options;

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const res = await fetch(buildUrl(path), {
      ...rest,
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(headers ?? {}),
      },
    });

    const raw = await res.text();
    const data = raw ? JSON.parse(raw) : null;

    if (!res.ok) {
      const err: ApiError = new Error(data?.message ?? `Request failed (${res.status})`);
      err.status = res.status;
      err.details = data?.details;
      throw err;
    }
    return data as T;
  } finally {
    clearTimeout(timer);
  }
}

export const api = {
  get: <T>(path: string, token?: string | null) => request<T>(path, { method: 'GET', token }),
  post: <T>(path: string, body?: unknown, token?: string | null) =>
    request<T>(path, { method: 'POST', body: body ? JSON.stringify(body) : undefined, token }),
};
