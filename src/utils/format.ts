import type { LocaleCode } from '../i18n';

/** Clock time in the user's locale, e.g. "09:41" / "9:41 AM". */
export const formatTime = (iso: string | number | Date, locale: LocaleCode = 'en') => {
  const d = new Date(iso);
  try {
    return new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit' }).format(d);
  } catch {
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  }
};

/**
 * WhatsApp-style relative stamp used in the chat list:
 * today -> time, yesterday -> label, this week -> weekday, older -> date.
 */
export const formatListTimestamp = (
  iso: string | number | Date,
  locale: LocaleCode = 'en',
  labels: { today: string; yesterday: string } = { today: 'Today', yesterday: 'Yesterday' }
) => {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);

  if (dayDiff <= 0) return formatTime(d, locale);
  if (dayDiff === 1) return labels.yesterday;
  if (dayDiff < 7) {
    try {
      return new Intl.DateTimeFormat(locale, { weekday: 'long' }).format(d);
    } catch {
      return d.toDateString().slice(0, 3);
    }
  }
  try {
    return new Intl.DateTimeFormat(locale, { day: '2-digit', month: '2-digit', year: '2-digit' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
};

/** Day separator chip inside a conversation. */
export const formatDaySeparator = (
  iso: string | number | Date,
  locale: LocaleCode = 'en',
  labels: { today: string; yesterday: string } = { today: 'Today', yesterday: 'Yesterday' }
) => {
  const d = new Date(iso);
  const now = new Date();
  const startOfDay = (x: Date) => new Date(x.getFullYear(), x.getMonth(), x.getDate()).getTime();
  const dayDiff = Math.round((startOfDay(now) - startOfDay(d)) / 86_400_000);
  if (dayDiff <= 0) return labels.today;
  if (dayDiff === 1) return labels.yesterday;
  try {
    return new Intl.DateTimeFormat(locale, { day: 'numeric', month: 'long', year: 'numeric' }).format(d);
  } catch {
    return d.toLocaleDateString();
  }
};

/** Duration in seconds -> "m:ss" (voice notes, call logs). */
export const formatDuration = (totalSeconds: number) => {
  const s = Math.max(0, Math.floor(totalSeconds));
  const m = Math.floor(s / 60);
  const rem = s % 60;
  return `${m}:${String(rem).padStart(2, '0')}`;
};

/** Byte count -> human readable storage figure. */
export const formatBytes = (bytes: number) => {
  if (bytes < 1024) return `${bytes} B`;
  const units = ['KB', 'MB', 'GB', 'TB'];
  let value = bytes / 1024;
  let i = 0;
  while (value >= 1024 && i < units.length - 1) {
    value /= 1024;
    i += 1;
  }
  return `${value.toFixed(value >= 10 ? 0 : 1)} ${units[i]}`;
};

/** Initials fallback used when an avatar image is unavailable. */
export const initials = (name: string) =>
  name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase() ?? '')
    .join('');
