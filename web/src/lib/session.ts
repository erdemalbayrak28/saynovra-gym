import type { StaffLoginResponse } from '../../../shared/contract';

// Per-tab staff session. Storage can be unavailable (private mode, blocked site data);
// then the session simply lasts until the page reloads.
const KEY = 'novra.staff';

export type StaffSession = StaffLoginResponse;

export function loadSession(): StaffSession | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<StaffSession>;
    return typeof parsed.token === 'string' && parsed.staff ? (parsed as StaffSession) : null;
  } catch {
    return null;
  }
}

export function saveSession(session: StaffSession): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // See note above.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    // See note above.
  }
}
