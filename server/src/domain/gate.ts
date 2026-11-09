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
import { currentMembership, findMemberById, insertCheckin, isInside, presenceSeq, type MemberRow } from '../queries.ts';
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
 * The transaction serialises concurrent scans, so the same code can never pass twice.
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
  // Any pass since the code was made (including one made with this very code) moves the sequence on.
  if (code.seq !== presenceSeq(db, member.id)) return 'stale_code';

  const inside = isInside(db, member.id, now);
  if (code.direction === 'out') {
    // Leaving is always allowed for someone inside, even if the membership ended meanwhile.
    return inside ? null : 'not_inside';
  }

  const today = localDate(now, timeZone);
  const membership = currentMembership(db, member.id, today);
  if (!membership) return 'no_membership';
  const status = effectiveStatus(membership.status, membership.ends_on, today);
  if (status !== 'active') return MEMBERSHIP_DENIAL[status];

  return inside ? 'already_inside' : null;
}

function signatureMatches(qrSecret: string, code: GateCode): boolean {
  const message = gateMessage(code.memberId, code.step, code.direction, code.seq);
  const expected = gateSigner(qrSecret)(message).slice(0, GATE_SIGNATURE_LENGTH);
  return timingSafeEqual(Buffer.from(expected), Buffer.from(code.signature));
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
