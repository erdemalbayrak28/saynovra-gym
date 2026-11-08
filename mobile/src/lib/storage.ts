import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// The session holds the token and the gate-code key, so on the phone it lives in the OS keychain.
// SecureStore has no web implementation; the browser build (used only for local previews) falls
// back to localStorage.

export async function readSecure(key: string): Promise<string | null> {
  if (Platform.OS === 'web') {
    try {
      return localStorage.getItem(key);
    } catch {
      return null;
    }
  }
  return SecureStore.getItemAsync(key);
}

export async function writeSecure(key: string, value: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.setItem(key, value);
    } catch {
      // Storage blocked: the session lasts until reload.
    }
    return;
  }
  await SecureStore.setItemAsync(key, value);
}

export async function deleteSecure(key: string): Promise<void> {
  if (Platform.OS === 'web') {
    try {
      localStorage.removeItem(key);
    } catch {
      // Nothing stored.
    }
    return;
  }
  await SecureStore.deleteItemAsync(key);
}
