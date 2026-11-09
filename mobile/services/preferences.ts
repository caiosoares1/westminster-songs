import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

/** Small device preferences (not secret): SecureStore on the phone, localStorage on the web. */
export async function readPreference(key: string): Promise<string | null> {
  try {
    if (Platform.OS === 'web') {
      return window.localStorage.getItem(key);
    }
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function writePreference(key: string, value: string): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      window.localStorage.setItem(key, value);
      return;
    }
    await SecureStore.setItemAsync(key, value);
  } catch {
    // A preference that fails to save just falls back to the default next time.
  }
}
