import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

const KEY = 'smart_grocer_token';

/** SecureStore on devices; localStorage on web (SecureStore is native-only). Failures are non-fatal. */
export async function readToken(): Promise<string | null> {
  try {
    if (Platform.OS === 'web') return globalThis.localStorage?.getItem(KEY) ?? null;
    return await SecureStore.getItemAsync(KEY);
  } catch {
    return null;
  }
}

export async function writeToken(token: string | null): Promise<void> {
  try {
    if (Platform.OS === 'web') {
      if (token) globalThis.localStorage?.setItem(KEY, token);
      else globalThis.localStorage?.removeItem(KEY);
      return;
    }
    if (token) await SecureStore.setItemAsync(KEY, token);
    else await SecureStore.deleteItemAsync(KEY);
  } catch {
    // Storage can be unavailable in some previews; the session simply won't persist.
  }
}
