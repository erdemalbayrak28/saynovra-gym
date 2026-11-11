import type { SpotRequestStatus } from '../../../shared/contract.ts';

export type SpotEvent = 'accept' | 'decline' | 'cancel' | 'expire';

// The only place spot request status changes are decided. Anything not listed is refused.
//   pending ──accept──► accepted ──expire──► expired   (someone left the gym, or the post closed)
//   pending ──decline / cancel / expire──► declined / cancelled / expired
const TRANSITIONS: Record<SpotRequestStatus, Partial<Record<SpotEvent, SpotRequestStatus>>> = {
  pending: { accept: 'accepted', decline: 'declined', cancel: 'cancelled', expire: 'expired' },
  accepted: { expire: 'expired' },
  declined: {},
  cancelled: {},
  expired: {},
};

export function nextSpotStatus(current: SpotRequestStatus, event: SpotEvent): SpotRequestStatus | null {
  return TRANSITIONS[current][event] ?? null;
}

/** "Burak Bayram" -> "Burak B."; others never see a member's full name. */
export function displayName(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const first = words[0] ?? '';
  const last = words.length > 1 ? words[words.length - 1] : undefined;
  return last ? `${first} ${last[0]?.toLocaleUpperCase('tr-TR')}.` : first;
}
