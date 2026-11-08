import Constants from 'expo-constants';

const API_PORT = 3000;

/**
 * In development the phone loads the bundle from the computer running `expo start`; the API runs
 * on that same computer, so its address comes from the dev server's host. EXPO_PUBLIC_API_URL wins.
 */
function resolveApiUrl(): string {
  const override = process.env.EXPO_PUBLIC_API_URL;
  if (override) return override.replace(/\/$/, '');
  const host = Constants.expoConfig?.hostUri?.split(':')[0];
  return `http://${host || 'localhost'}:${API_PORT}`;
}

export const API_URL = resolveApiUrl();
export const LIVE_URL = `${API_URL.replace(/^http/, 'ws')}/live`;
