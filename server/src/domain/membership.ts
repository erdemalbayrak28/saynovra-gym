import type { MembershipStatus } from '../../../shared/contract.ts';
import { daysBetween } from '../time.ts';

export type MembershipEvent = 'freeze' | 'unfreeze' | 'expire' | 'cancel';

// The only place membership status changes are decided. Anything not listed is refused.
const TRANSITIONS: Record<MembershipStatus, Partial<Record<MembershipEvent, MembershipStatus>>> = {
  active: { freeze: 'frozen', expire: 'expired', cancel: 'cancelled' },
  frozen: { unfreeze: 'active', cancel: 'cancelled' },
  expired: {},
  cancelled: {},
};

export function nextStatus(current: MembershipStatus, event: MembershipEvent): MembershipStatus | null {
  return TRANSITIONS[current][event] ?? null;
}

/**
 * The stored status lags behind the calendar: an active membership whose last day has passed is
 * expired even before anything rewrites the row. A membership is valid through its `endsOn` day.
 */
export function effectiveStatus(status: MembershipStatus, endsOn: string, today: string): MembershipStatus {
  return status === 'active' && endsOn < today ? 'expired' : status;
}

export function daysLeft(endsOn: string, today: string): number {
  return Math.max(0, daysBetween(today, endsOn));
}
