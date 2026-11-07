import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

import type { User } from './auth';

const SESSION_KEY = 'westminster.session';

export interface StoredSession {
  token: string;
  user: User;
}

// SecureStore (Keychain/Keystore) on the phone; localStorage on the web
// build, where SecureStore isn't available.
async function getRaw(): Promise<string | null> {
  if (Platform.OS === 'web') {
    return window.localStorage.getItem(SESSION_KEY);
  }
  return SecureStore.getItemAsync(SESSION_KEY);
}

export async function readSession(): Promise<StoredSession | null> {
  try {
    const raw = await getRaw();
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredSession>) : null;
    return parsed?.token && parsed.user ? (parsed as StoredSession) : null;
  } catch {
    return null;
  }
}

export async function writeSession(session: StoredSession | null): Promise<void> {
  try {
    const raw = session ? JSON.stringify(session) : null;
    if (Platform.OS === 'web') {
      if (raw) window.localStorage.setItem(SESSION_KEY, raw);
      else window.localStorage.removeItem(SESSION_KEY);
      return;
    }
    if (raw) await SecureStore.setItemAsync(SESSION_KEY, raw);
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // Not persisted: the user just logs in again next time.
  }
}
