import AsyncStorage from '@react-native-async-storage/async-storage';

export const storage = {
  getString: async (key: string): Promise<string | null> => {
    try {
      return await AsyncStorage.getItem(key);
    } catch {
      return null;
    }
  },
  setString: async (key: string, value: string): Promise<void> => {
    try {
      await AsyncStorage.setItem(key, value);
    } catch {
      /* ignore storage failures (private mode, etc.) */
    }
  },
  remove: async (key: string): Promise<void> => {
    try {
      await AsyncStorage.removeItem(key);
    } catch {
      /* ignore */
    }
  },
  getJson: async <T>(key: string): Promise<T | null> => {
    const raw = await storage.getString(key);
    if (!raw) return null;
    try {
      return JSON.parse(raw) as T;
    } catch {
      return null;
    }
  },
  setJson: async (key: string, value: unknown): Promise<void> =>
    storage.setString(key, JSON.stringify(value)),
};

export const STORAGE_KEYS = {
  session: 'chipapp.session.v1',
  theme: 'chipapp.theme.v1',
  locale: 'chipapp.locale.v1',
} as const;
