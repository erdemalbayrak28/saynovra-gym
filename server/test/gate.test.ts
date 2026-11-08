import assert from 'node:assert/strict';
import { beforeEach, describe, it } from 'node:test';
import { GATE_STEP_SECONDS, createGateCode, type GateDirection } from '../../shared/contract.ts';
import { gateSigner, newQrSecret } from '../src/auth.ts';
import type { Db } from '../src/db.ts';
import { scanGateCode } from '../src/domain/gate.ts';
import { insideCount, isInside } from '../src/queries.ts';
import { TZ, addMember, addMembership, addPlan, testDb } from './helpers.ts';

const NOW = new Date('2026-11-09T17:30:10Z');
const STEP_MS = GATE_STEP_SECONDS * 1000;

function reasonOf(db: Db, checkinId: number): string | null {
  const row = db.prepare('SELECT reason FROM checkins WHERE id = ?').get(checkinId) as { reason: string | null };
  return row.reason;
}

describe('gate scan', () => {
  let db: Db;
  let member: { id: number; qrSecret: string };
  let planId: number;
  const code = (direction: GateDirection, at = NOW, who = member) =>
    createGateCode(who.id, direction, at.getTime(), gateSigner(who.qrSecret));
  const scan = (raw: string, at = NOW) => scanGateCode(db, raw, at, TZ);

  beforeEach(() => {
    db = testDb();
    planId = addPlan(db);
    member = addMember(db);
  });

  it('lets an active member in and then out', () => {
    addMembership(db, member.id, planId, NOW);
    const entry = scan(code('in'));
    assert.equal(entry.granted, true);
    assert.equal(isInside(db, member.id, NOW), true);
    assert.equal(insideCount(db, NOW), 1);

    const later = new Date(NOW.getTime() + 60 * 60 * 1000);
    const exit = scan(code('out', later), later);
    assert.equal(exit.granted, true);
    assert.equal(isInside(db, member.id, later), false);
    assert.equal(insideCount(db, later), 0);
  });

  it('rejects garbage and unknown members', () => {
    assert.equal(reasonOf(db, scan('not a code').checkinId), 'invalid_format');
    const stranger = { id: 999, qrSecret: newQrSecret() };
    assert.equal(reasonOf(db, scan(code('in', NOW, stranger)).checkinId), 'unknown_member');
  });

  it('rejects a code signed with someone else\'s secret', () => {
    addMembership(db, member.id, planId, NOW);
    const forged = code('in', NOW, { id: member.id, qrSecret: newQrSecret() });
    assert.equal(reasonOf(db, scan(forged).checkinId), 'bad_signature');
  });

  it('accepts one step of clock drift and rejects older screenshots', () => {
    addMembership(db, member.id, planId, NOW);
    const drifted = new Date(NOW.getTime() - STEP_MS);
    assert.equal(scan(code('in', drifted)).granted, true);

    const other = addMember(db, '5550000002');
    addMembership(db, other.id, planId, NOW);
    const screenshot = new Date(NOW.getTime() - 2 * STEP_MS);
    assert.equal(reasonOf(db, scan(code('in', screenshot, other)).checkinId), 'expired_code');
  });

  it('rejects the same code twice', () => {
    addMembership(db, member.id, planId, NOW);
    const raw = code('in');
    assert.equal(scan(raw).granted, true);
    assert.equal(reasonOf(db, scan(raw).checkinId), 'replayed');
  });

  it('enforces anti-passback in both directions', () => {
    addMembership(db, member.id, planId, NOW);
    assert.equal(reasonOf(db, scan(code('out')).checkinId), 'not_inside');

    const entryAt = new Date(NOW.getTime() + STEP_MS);
    assert.equal(scan(code('in', entryAt), entryAt).granted, true);
    const again = new Date(NOW.getTime() + 2 * STEP_MS);
    assert.equal(reasonOf(db, scan(code('in', again), again).checkinId), 'already_inside');
  });

  it('turns members away for membership problems', () => {
    assert.equal(reasonOf(db, scan(code('in')).checkinId), 'no_membership');

    const frozen = addMember(db, '5550000003');
    addMembership(db, frozen.id, planId, NOW, { status: 'frozen' });
    assert.equal(reasonOf(db, scan(code('in', NOW, frozen)).checkinId), 'membership_frozen');

    const lapsed = addMember(db, '5550000004');
    addMembership(db, lapsed.id, planId, NOW, { startOffsetDays: -40, endOffsetDays: -1 });
    assert.equal(reasonOf(db, scan(code('in', NOW, lapsed)).checkinId), 'membership_expired');

    const cancelled = addMember(db, '5550000005');
    addMembership(db, cancelled.id, planId, NOW, { status: 'cancelled' });
    assert.equal(reasonOf(db, scan(code('in', NOW, cancelled)).checkinId), 'membership_cancelled');
  });

  it('still lets a member out after the membership ends', () => {
    addMembership(db, member.id, planId, NOW, { endOffsetDays: 0 });
    assert.equal(scan(code('in')).granted, true);
    // Two hours later it is the next calendar day in Istanbul: the membership has lapsed.
    const nextDay = new Date('2026-11-09T21:10:00Z');
    assert.equal(scan(code('out', nextDay), nextDay).granted, true);
  });

  it('forgets a forgotten exit after four hours', () => {
    addMembership(db, member.id, planId, NOW);
    assert.equal(scan(code('in')).granted, true);
    const muchLater = new Date(NOW.getTime() + 4 * 60 * 60 * 1000 + STEP_MS);
    assert.equal(isInside(db, member.id, muchLater), false);
    assert.equal(scan(code('in', muchLater), muchLater).granted, true);
  });

  it('records every attempt', () => {
    addMembership(db, member.id, planId, NOW);
    scan('nope');
    scan(code('in'));
    const { n } = db.prepare('SELECT COUNT(*) AS n FROM checkins').get() as { n: number };
    assert.equal(n, 2);
  });
});
