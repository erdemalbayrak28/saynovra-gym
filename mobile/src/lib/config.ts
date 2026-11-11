import Constants from 'expo-constants';
import { Platform } from 'react-native';
import { deleteSecure, readSecure, writeSecure } from './storage';

const API_PORT = 3000;
const STORAGE_KEY = 'novra.server.v1';
const HEALTH_TIMEOUT_MS = 4000;

/**
 * Where the API is when nothing is saved. In development the phone loads the bundle from the
 * computer running `expo start`, and the API runs on that same computer, so its host is used.
 * An installed build has no such host: the emulator reaches the computer at 10.0.2.2, a real phone
 * needs the address saved on the sign-in screen. EXPO_PUBLIC_API_URL, set at build time, wins.
 */
function defaultApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  if (Platform.OS === 'android' && (!host || host === 'localhost' || host === '127.0.0.1')) {
    return `http://10.0.2.2:${API_PORT}`;
  }
  return `http://${host || 'localhost'}:${API_PORT}`;
}

let current = defaultApiUrl();
let saved = false;

export function apiUrl(): string {
  return current;
}

export function liveUrl(): string {
  return `${current.replace(/^http/, 'ws')}/live`;
}

/** True when the address was set by hand on this phone (rather than worked out). */
export function isServerAddressSaved(): boolean {
  return saved;
}

/**
 * "192.168.1.103", "192.168.1.103:3000" and "http://192.168.1.103:3000/" all become
 * "http://192.168.1.103:3000"; null when it is not a host (and optional port) at all.
 */
export function normaliseServerAddress(input: string): string | null {
  const trimmed = input.trim().replace(/\/+$/, '');
  const withScheme = /^https?:\/\//i.test(trimmed) ? trimmed : `http://${trimmed}`;
  const match = /^(https?):\/\/([A-Za-z0-9.-]+)(?::(\d{1,5}))?$/i.exec(withScheme);
  if (!match) return null;
  const [, scheme, host, port] = match;
  const portNumber = port ? Number(port) : API_PORT;
  if (!host || portNumber < 1 || portNumber > 65535) return null;
  return `${scheme?.toLowerCase()}://${host}:${portNumber}`;
}

/** Loads a saved address; called once before anything talks to the server. */
export async function loadServerAddress(): Promise<void> {
  const stored = await readSecure(STORAGE_KEY).catch(() => null);
  const address = stored ? normaliseServerAddress(stored) : null;
  if (address) {
    current = address;
    saved = true;
  }
}

/** Saves an address by hand, or forgets it (null) to go back to the worked-out default. */
export async function saveServerAddress(address: string | null): Promise<void> {
  if (address === null) {
    await deleteSecure(STORAGE_KEY);
    current = defaultApiUrl();
    saved = false;
    return;
  }
  await writeSecure(STORAGE_KEY, address);
  current = address;
  saved = true;
}

/** Asks the server's health endpoint; true when it answers. */
export async function serverAnswers(address: string): Promise<boolean> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), HEALTH_TIMEOUT_MS);
  try {
    const res = await fetch(`${address}/health`, { signal: controller.signal });
    return res.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timer);
  }
}
