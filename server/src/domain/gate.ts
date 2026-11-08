import { timingSafeEqual } from 'node:crypto';
import {
  GATE_SIGNATURE_LENGTH,
  GATE_STEP_TOLERANCE,
  gateMessage,
  gateStep,
  parseGateCode,
  type GateCode,
  type GateDenyReason,
  type GateDirection,
} from '../../../shared/contract.ts';
import { gateSigner } from '../auth.ts';
import { transaction, type Db } from '../db.ts';
import { currentMembership, findMemberById, insertCheckin, isInside, type MemberRow } from '../queries.ts';
import { localDate } from '../time.ts';
import { effectiveStatus } from './membership.ts';

export interface GateScan {
  checkinId: number;
  memberId: number | null;
  granted: boolean;
}

const MEMBERSHIP_DENIAL: Record<'frozen' | 'expired' | 'cancelled', GateDenyReason> = {
  frozen: 'membership_frozen',
  expired: 'membership_expired',
  cancelled: 'membership_cancelled',
};

/**
 * Decides one scan and records it. Checks run in a fixed order and the first failure wins,
 * so the stored reason always names the most fundamental problem (see PLAN.md section 3).
 */
export function scanGateCode(db: Db, rawCode: string, now: Date, timeZone: string): GateScan {
  return transaction(db, () => {
    const code = parseGateCode(rawCode);
    if (!code) return record(db, now, null, null, 'invalid_format');

    const member = findMemberById(db, code.memberId);
    if (!member) return record(db, now, null, code.direction, 'unknown_member');

    const reason = denialFor(db, member, code, now, timeZone);
    return record(db, now, member.id, code.direction, reason);
  });
}

function denialFor(db: Db, member: MemberRow, code: GateCode, now: Date, timeZone: string): GateDenyReason | null {
  if (!signatureMatches(member.qr_secret, code)) return 'bad_signature';
  if (Math.abs(code.step - gateStep(now.getTime())) > GATE_STEP_TOLERANCE) return 'expired_code';
  if (!claimCode(db, member.id, code, now)) return 'replayed';

  const inside = isInside(db, member.id, now);
  if (code.direction === 'out') {
    // Leaving is always allowed for someone inside, even if the membership ended meanwhile.
    return inside ? null : 'not_inside';
  }

  const membership = currentMembership(db, member.id, localDate(now, timeZone));
  if (!membership) return 'no_membership';
  const status = effectiveStatus(membership.status, membership.ends_on, localDate(now, timeZone));
  if (status !== 'active') return MEMBERSHIP_DENIAL[status];

  return inside ? 'already_inside' : null;
}

function signatureMatches(qrSecret: string, code: GateCode): boolean {
  const expected = gateSigner(qrSecret)(gateMessage(code.memberId, code.step, code.direction)).slice(0, GATE_SIGNATURE_LENGTH);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(code.signature));
}

/** First use of (member, step, direction) wins; any later use of the same code is a replay. */
function claimCode(db: Db, memberId: number, code: GateCode, now: Date): boolean {
  const result = db
    .prepare('INSERT OR IGNORE INTO gate_code_uses (member_id, step, direction, created_at) VALUES (?, ?, ?, ?)')
    .run(memberId, code.step, code.direction, now.toISOString());
  return result.changes === 1;
}

function record(
  db: Db,
  now: Date,
  memberId: number | null,
  direction: GateDirection | null,
  reason: GateDenyReason | null,
): GateScan {
  const checkinId = insertCheckin(db, { memberId, direction, reason, at: now });
  return { checkinId, memberId, granted: reason === null };
}
