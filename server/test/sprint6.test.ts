import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  createGateCode,
  type CreateMemberRequest,
  type CreateMemberResponse,
  type LiveEvent,
  type MeResponse,
  type MemberDetail,
  type MemberLoginResponse,
  type MemberProfile,
  type MyTrainingResponse,
  type TrainerMemberDetail,
  type TrainerMemberItem,
  type TrainerOption,
} from '../../shared/contract.ts';
import { KVKK_NOTICE_VERSION, KVKK_TRAINER_NOTICE_VERSION } from '../../shared/consent.ts';
import { createApp } from '../src/app.ts';
import { gateSigner, hashSecret, issueToken, type AuthClaims } from '../src/auth.ts';
import { seedCatalog } from '../src/catalog.ts';
import type { Config } from '../src/config.ts';
import type { Db } from '../src/db.ts';
import { scanGateCode } from '../src/domain/gate.ts';
import type { LiveHub } from '../src/live.ts';
import { getCheckin, presenceSeq } from '../src/queries.ts';
import { AttemptLimiter } from '../src/rate-limit.ts';
import { autoUnfreeze, freezeMembership, memberDetail, sellMembership, type StaffAction } from '../src/reception.ts';
import { addDays, localDate } from '../src/time.ts';
import { TZ, addMember, addMembership, testDb } from './helpers.ts';

const NOW = new Date('2026-11-10T15:00:00Z');
const TODAY = localDate(NOW, TZ);
const MINUTE_MS = 60_000;
const DAY_MS = 24 * 60 * MINUTE_MS;
const OWNER_ID = 1;
const DESK_ID = 2;
const NO_PROFILE = { birthYear: null, gender: null, heightCm: null, weightKg: null, goal: null } as const;

const config: Config = {
  PORT: 0,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DB_PATH: ':memory:',
  GYM_CAPACITY: 85,
  GYM_TIMEZONE: TZ,
  DEMO_SIMULATION: false,
  DEMO_MIN_INSIDE: 12,
};

interface Gym {
  db: Db;
  monthly: number;
  quarterly: number;
}

function gym(ownerPinHash = 'x', deskPinHash = 'x'): Gym {
  const db = testDb();
  const stamp = NOW.toISOString();
  db.prepare(
    "INSERT INTO staff (name, role, pin_hash, created_at, modified_at) VALUES ('Salon Sahibi', 'owner', ?, ?, ?), ('Gişe', 'desk', ?, ?, ?)",
  ).run(ownerPinHash, stamp, stamp, deskPinHash, stamp, stamp);
  const plan = (name: string, days: number, freezeDays: number) =>
    Number(
      db
        .prepare('INSERT INTO plans (name, duration_days, price_kurus, freeze_days_allowed, created_at, modified_at) VALUES (?, ?, 150000, ?, ?, ?)')
        .run(name, days, freezeDays, stamp, stamp).lastInsertRowid,
    );
  return { db, monthly: plan('Aylık', 30, 0), quarterly: plan('3 Aylık', 90, 15) };
}

function addTrainer(db: Db, phone: string, fullName: string, passwordHash = 'x'): { id: number; qrSecret: string } {
  const account = addMember(db, phone, passwordHash, fullName);
  // Fixtures may set the kind once, before the account is used (the trigger forbids changing it later).
  db.exec('DROP TRIGGER members_role_fixed');
  db.prepare("UPDATE members SET role = 'trainer' WHERE id = ?").run(account.id);
  db.exec("CREATE TRIGGER members_role_fixed BEFORE UPDATE OF role ON members WHEN NEW.role <> OLD.role BEGIN SELECT RAISE(ABORT, 'role cannot change'); END");
  return account;
}

function harness({ db }: Gym) {
  const published: LiveEvent[] = [];
  const live = { publish: (event: LiveEvent) => published.push(event) };
  const clock = { now: NOW };
  const app = createApp({ db, config, live: live as unknown as LiveHub, now: () => clock.now });
  const as = async (claims: AuthClaims) => ({ Authorization: `Bearer ${await issueToken(config.JWT_SECRET, claims)}` });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  const get = (path: string, headers: Record<string, string>) => app.request(path, { headers });
  return { app, published, clock, as, post, get, owner: () => as({ sub: OWNER_ID, role: 'owner' }), desk: () => as({ sub: DESK_ID, role: 'desk' }) };
}

const at = (daysLater: number, staffId = DESK_ID): StaffAction => {
  const now = new Date(NOW.getTime() + daysLater * DAY_MS);
  return { staffId, now, today: localDate(now, TZ) };
};

function trainerRequest(overrides: Partial<CreateMemberRequest> = {}): CreateMemberRequest {
  return {
    role: 'trainer',
    fullName: 'Hakan Koç',
    phone: '5550001001',
    noticeVersion: KVKK_TRAINER_NOTICE_VERSION,
    consents: { notice: true, optionalData: false },
    profile: { ...NO_PROFILE },
    sale: null,
    ...overrides,
  };
}

describe('trainer accounts', () => {
  it('lets only the owner open a trainer account, with its own notice and nothing optional', async () => {
    const g = gym();
    const h = harness(g);
    assert.equal((await h.post('/staff/members', trainerRequest(), await h.desk())).status, 403);
    assert.equal((await h.post('/staff/members', trainerRequest({ noticeVersion: KVKK_NOTICE_VERSION }), await h.owner())).status, 400);
    assert.equal((await h.post('/staff/members', trainerRequest({ sale: { planId: g.monthly, method: 'cash' } }), await h.owner())).status, 400);
    assert.equal((await h.post('/staff/members', trainerRequest({ consents: { notice: true, optionalData: true } }), await h.owner())).status, 400);

    const created = await h.post('/staff/members', trainerRequest(), await h.owner());
    assert.equal(created.status, 201);
    const { detail } = (await created.json()) as CreateMemberResponse;
    assert.equal(detail.member.role, 'trainer');
    assert.equal(detail.current, null);
    assert.deepEqual(
      detail.consents.map((c) => [c.kind, c.version]),
      [['notice', KVKK_TRAINER_NOTICE_VERSION]],
    );
    // A trainer has no package to buy.
    const sale = await h.post(`/staff/members/${detail.member.id}/memberships`, { planId: g.monthly, method: 'cash' }, await h.desk());
    assert.equal(sale.status, 409);
  });

  it('signs a trainer in as a trainer: account endpoints open, member features closed', async () => {
    const g = gym();
    const h = harness(g);
    const { activation } = (await (await h.post('/staff/members', trainerRequest(), await h.owner())).json()) as CreateMemberResponse;
    const session = (await (
      await h.post('/auth/member/activate', { phone: '5550001001', code: activation.code, password: 'egitmen-sifre-1' })
    ).json()) as MemberLoginResponse;
    assert.equal(session.member.role, 'trainer');

    const headers = { Authorization: `Bearer ${session.token}` };
    const me = (await (await h.get('/me', headers)).json()) as MeResponse;
    assert.equal(me.member.role, 'trainer');
    assert.equal(me.membership, null);
    assert.equal((await h.get('/me/qr-key', headers)).status, 200);
    assert.equal((await h.get('/me/consents', headers)).status, 200);
    assert.equal((await h.get('/programs', headers)).status, 200);
    assert.equal((await h.get('/trainer/members', headers)).status, 200);
    for (const path of ['/me/training', '/me/progress', '/me/radar']) assert.equal((await h.get(path, headers)).status, 403, path);
    assert.equal((await h.post('/me/program', { programId: 1 }, headers)).status, 403);
    assert.equal((await h.post('/me/profile', { profile: NO_PROFILE, consentVersion: null }, headers)).status, 403);

    // And the other way round: a member is not a trainer.
    const member = addMember(g.db, '5557770001');
    assert.equal((await h.get('/trainer/members', await h.as({ sub: member.id, role: 'member', ep: 0 }))).status, 403);
    assert.equal((await h.get('/me/training', await h.as({ sub: member.id, role: 'member', ep: 0 }))).status, 200);
  });

  it('assigns trainers at reception and guards the link in the database', async () => {
    const g = gym();
    const h = harness(g);
    const trainer = addTrainer(g.db, '5550001001', 'Hakan Koç');
    const member = addMember(g.db, '5557770001', undefined, 'Deniz Yılmaz');
    const other = addMember(g.db, '5557770002', undefined, 'Ali Veli');

    const assigned = await h.post(`/staff/members/${member.id}/trainer`, { trainerId: trainer.id }, await h.desk());
    assert.equal(assigned.status, 200);
    assert.deepEqual(((await assigned.json()) as MemberDetail).trainer, { id: trainer.id, fullName: 'Hakan Koç' });
    assert.deepEqual(h.published.at(-1), { type: 'training', memberId: member.id });
    const trainers = (await (await h.get('/staff/trainers', await h.desk())).json()) as TrainerOption[];
    assert.deepEqual(trainers, [{ id: trainer.id, fullName: 'Hakan Koç', traineeCount: 1 }]);
    assert.deepEqual(memberDetail(g.db, trainer.id, TODAY, NOW).trainees, [{ id: member.id, fullName: 'Deniz Yılmaz' }]);

    // Not a trainer, no such account, and a trainer cannot have a trainer.
    assert.equal((await h.post(`/staff/members/${member.id}/trainer`, { trainerId: other.id }, await h.desk())).status, 404);
    assert.equal((await h.post(`/staff/members/${member.id}/trainer`, { trainerId: 999 }, await h.desk())).status, 404);
    assert.equal((await h.post(`/staff/members/${trainer.id}/trainer`, { trainerId: trainer.id }, await h.desk())).status, 409);
    assert.throws(() => g.db.prepare('UPDATE members SET trainer_id = ? WHERE id = ?').run(other.id, member.id), /must point to a trainer/);
    assert.throws(() => g.db.prepare("UPDATE members SET role = 'trainer' WHERE id = ?").run(member.id), /role cannot change/);

    const removed = await h.post(`/staff/members/${member.id}/trainer`, { trainerId: null }, await h.desk());
    assert.equal(((await removed.json()) as MemberDetail).trainer, null);
  });

  it('shows a trainer only their own members and lets them assign programmes', async () => {
    const g = gym();
    const h = harness(g);
    const programs = seedCatalog(g.db, NOW);
    const programId = programs.get('hipertrofi-ust-alt') ?? 0;
    const otherProgramId = programs.get('guc-5x5') ?? [...programs.values()].at(-1) ?? 0;
    const hakan = addTrainer(g.db, '5550001001', 'Hakan Koç');
    const derya = addTrainer(g.db, '5550001002', 'Derya Aksoy');
    const mine = addMember(g.db, '5557770001', undefined, 'Deniz Yılmaz');
    const theirs = addMember(g.db, '5557770002', undefined, 'Ali Veli');
    addMembership(g.db, mine.id, g.monthly, NOW);
    g.db.prepare('UPDATE members SET trainer_id = ? WHERE id = ?').run(hakan.id, mine.id);
    g.db.prepare('UPDATE members SET trainer_id = ? WHERE id = ?').run(derya.id, theirs.id);

    const asHakan = await h.as({ sub: hakan.id, role: 'trainer', ep: 0 });
    const asMine = await h.as({ sub: mine.id, role: 'member', ep: 0 });
    const list = (await (await h.get('/trainer/members', asHakan)).json()) as TrainerMemberItem[];
    assert.deepEqual(
      list.map((m) => [m.fullName, m.membershipStatus, m.programName, m.weekWorkouts]),
      [['Deniz Yılmaz', 'active', null, 0]],
    );
    // Someone else's member looks exactly like a member who does not exist.
    assert.equal((await h.get(`/trainer/members/${theirs.id}`, asHakan)).status, 404);
    assert.equal((await h.post(`/trainer/members/${theirs.id}/program`, { programId }, asHakan)).status, 404);
    assert.equal((await h.get('/trainer/members/999', asHakan)).status, 404);

    const assigned = await h.post(`/trainer/members/${mine.id}/program`, { programId }, asHakan);
    assert.equal(assigned.status, 201);
    const detail = (await assigned.json()) as TrainerMemberDetail;
    assert.deepEqual(detail.enrollment?.assignedBy, { id: hakan.id, fullName: 'Hakan Koç' });
    assert.ok(detail.nextDay);
    assert.deepEqual(h.published.at(-1), { type: 'training', memberId: mine.id });

    const training = (await (await h.get('/me/training', asMine)).json()) as MyTrainingResponse;
    assert.deepEqual(training.trainer, { id: hakan.id, fullName: 'Hakan Koç' });
    assert.equal(training.enrollment?.assignedBy?.id, hakan.id);

    // A workout in progress blocks a new programme, whoever asks.
    assert.equal((await h.post('/me/workouts', {}, asMine)).status, 200);
    assert.equal((await h.post(`/trainer/members/${mine.id}/program`, { programId: otherProgramId }, asHakan)).status, 409);
    assert.equal(((await (await h.get(`/trainer/members/${mine.id}`, asHakan)).json()) as TrainerMemberDetail).activeWorkout, true);

    // The member may still choose another programme; the trainer is told, and it is no longer "assigned".
    g.db.prepare("DELETE FROM workouts WHERE member_id = ? AND status = 'active'").run(mine.id);
    const before = h.published.length;
    assert.equal((await h.post('/me/program', { programId: otherProgramId }, asMine)).status, 201);
    assert.deepEqual(h.published.slice(before), [{ type: 'training', memberId: mine.id }]);
    const after = (await (await h.get(`/trainer/members/${mine.id}`, asHakan)).json()) as TrainerMemberDetail;
    assert.equal(after.enrollment?.assignedBy, null);
  });

  it('opens the gate for a trainer without a membership, with the usual anti-passback', () => {
    const g = gym();
    const trainer = addTrainer(g.db, '5550001001', 'Hakan Koç');
    const code = (direction: 'in' | 'out') => createGateCode(trainer.id, direction, presenceSeq(g.db, trainer.id), NOW.getTime(), gateSigner(trainer.qrSecret));

    const first = scanGateCode(g.db, code('in'), NOW, TZ);
    assert.equal(first.granted, true);
    assert.equal(getCheckin(g.db, first.checkinId, TODAY)?.member?.role, 'trainer');
    const again = scanGateCode(g.db, code('in'), NOW, TZ);
    assert.equal(getCheckin(g.db, again.checkinId, TODAY)?.reason, 'already_inside');
    assert.equal(scanGateCode(g.db, code('out'), NOW, TZ).granted, true);

    // A member with no membership is still turned away.
    const member = addMember(g.db, '5557770001');
    const denied = scanGateCode(g.db, createGateCode(member.id, 'in', 0, NOW.getTime(), gateSigner(member.qrSecret)), NOW, TZ);
    assert.equal(getCheckin(g.db, denied.checkinId, TODAY)?.reason, 'no_membership');
  });
});

describe('sign-in attempt limits', () => {
  it('locks a key after too many failures and frees it when the lock runs out', () => {
    let now = NOW;
    const limiter = new AttemptLimiter({ max: 3, windowMinutes: 15, lockMinutes: 15, now: () => now });
    limiter.fail('a');
    limiter.fail('a');
    assert.equal(limiter.lockedFor('a'), 0);
    limiter.fail('a');
    assert.equal(limiter.lockedFor('a'), 15 * MINUTE_MS);
    assert.equal(limiter.lockedFor('b'), 0);
    now = new Date(NOW.getTime() + 16 * MINUTE_MS);
    assert.equal(limiter.lockedFor('a'), 0);
    // Failures spread over more than the window never add up.
    limiter.fail('c');
    limiter.fail('c');
    now = new Date(now.getTime() + 16 * MINUTE_MS);
    limiter.fail('c');
    assert.equal(limiter.lockedFor('c'), 0);
    limiter.fail('a');
    limiter.reset('a');
    limiter.fail('a');
    limiter.fail('a');
    assert.equal(limiter.lockedFor('a'), 0);
  });

  it('stops PIN guessing, even when the next guess is right', async () => {
    const h = harness(gym(await hashSecret('1907'), await hashSecret('2024')));
    for (let i = 0; i < 5; i++) assert.equal((await h.post('/auth/staff/login', { pin: '0000' })).status, 401);
    const locked = await h.post('/auth/staff/login', { pin: '1907' });
    assert.equal(locked.status, 429);
    assert.equal(locked.headers.get('Retry-After'), String(15 * 60));
    assert.equal(locked.headers.get('Content-Type'), 'application/problem+json');
    assert.match(((await locked.json()) as { detail: string }).detail, /15 dakika sonra/);

    h.clock.now = new Date(NOW.getTime() + 16 * MINUTE_MS);
    assert.equal((await h.post('/auth/staff/login', { pin: '1907' })).status, 200);
  });

  it('locks a phone number after five wrong passwords and forgets failures after a good one', async () => {
    const g = gym();
    const h = harness(g);
    addMember(g.db, '5557770001', await hashSecret('dogru-sifre-1'));
    addMember(g.db, '5557770002', await hashSecret('dogru-sifre-2'));
    const login = (phone: string, password: string) => h.post('/auth/member/login', { phone, password });

    for (let i = 0; i < 4; i++) assert.equal((await login('5557770001', 'yanlis')).status, 401);
    assert.equal((await login('5557770001', 'dogru-sifre-1')).status, 200);
    for (let i = 0; i < 4; i++) assert.equal((await login('5557770001', 'yanlis')).status, 401);
    assert.equal((await login('5557770001', 'dogru-sifre-1')).status, 200);

    for (let i = 0; i < 5; i++) assert.equal((await login('5557770001', 'yanlis')).status, 401);
    assert.equal((await login('5557770001', 'dogru-sifre-1')).status, 429);
    // Another member is not affected by that phone's lock.
    assert.equal((await login('5557770002', 'dogru-sifre-2')).status, 200);
  });
});

describe('profile editing', () => {
  it('saves the optional fields only with consent, which the member can give in the app', async () => {
    const g = gym();
    const h = harness(g);
    const member = addMember(g.db, '5557770001');
    const headers = await h.as({ sub: member.id, role: 'member', ep: 0 });
    const profile = { birthYear: 1994, gender: 'f', heightCm: 168, weightKg: 61.5, goal: 'fit' } as const;

    assert.equal(((await (await h.get('/me', headers)).json()) as MeResponse).optionalDataConsent, false);
    assert.equal((await h.post('/me/profile', { profile, consentVersion: null }, headers)).status, 403);
    assert.equal((await h.post('/me/profile', { profile, consentVersion: '2020-01' }, headers)).status, 403);
    assert.equal((g.db.prepare('SELECT height_cm FROM members WHERE id = ?').get(member.id) as { height_cm: number | null }).height_cm, null);

    const saved = await h.post('/me/profile', { profile, consentVersion: KVKK_NOTICE_VERSION }, headers);
    assert.equal(saved.status, 200);
    const body = (await saved.json()) as MemberProfile;
    assert.deepEqual([body.birthYear, body.gender, body.heightCm, body.weightKg, body.goal], [1994, 'f', 168, 61.5, 'fit']);
    const consent = g.db.prepare('SELECT kind, version, granted, created_by FROM member_consents WHERE member_id = ?').get(member.id);
    assert.deepEqual({ ...consent }, { kind: 'optional_data', version: KVKK_NOTICE_VERSION, granted: 1, created_by: null });
    assert.equal(((await (await h.get('/me', headers)).json()) as MeResponse).optionalDataConsent, true);

    // With consent on record, later edits need no confirmation; fields can be cleared.
    const cleared = await h.post('/me/profile', { profile: { ...profile, weightKg: null }, consentVersion: null }, headers);
    assert.equal(((await cleared.json()) as MemberProfile).weightKg, null);
    assert.equal((g.db.prepare('SELECT COUNT(*) AS n FROM member_consents').get() as { n: number }).n, 1);
    assert.equal((await h.post('/me/profile', { profile: { ...profile, heightCm: 500 }, consentVersion: null }, headers)).status, 400);
  });
});

describe('freezes that end on their own', () => {
  const row = (db: Db, id: number) =>
    db.prepare('SELECT starts_on, ends_on, status, freeze_days_used, modified_by FROM memberships WHERE id = ?').get(id) as {
      starts_on: string;
      ends_on: string;
      status: string;
      freeze_days_used: number;
      modified_by: number | null;
    };

  it('ends a freeze the day its allowance runs out, crediting the days and moving the renewal', () => {
    const g = gym();
    const member = addMember(g.db, '5557770001');
    const membershipId = addMembership(g.db, member.id, g.quarterly, NOW, { startOffsetDays: -10, endOffsetDays: 20 });
    const renewalId = sellMembership(g.db, member.id, { planId: g.monthly, method: 'card' }, at(0));
    const renewalBefore = row(g.db, renewalId);
    freezeMembership(g.db, membershipId, at(0));

    assert.deepEqual(autoUnfreeze(g.db, at(14)), []);
    assert.equal(row(g.db, membershipId).status, 'frozen');

    assert.deepEqual(autoUnfreeze(g.db, at(15)), [member.id]);
    const after = row(g.db, membershipId);
    assert.deepEqual([after.status, after.ends_on, after.freeze_days_used, after.modified_by], ['active', addDays(TODAY, 35), 15, null]);
    const renewalAfter = row(g.db, renewalId);
    assert.deepEqual([renewalAfter.starts_on, renewalAfter.ends_on], [addDays(renewalBefore.starts_on, 15), addDays(renewalBefore.ends_on, 15)]);

    const [latest] = memberDetail(g.db, member.id, at(15).today, at(15).now).history;
    assert.deepEqual([latest?.type, latest?.days, latest?.staffName], ['unfreeze', 15, null]);
    // Nothing left to do on the next sweep.
    assert.deepEqual(autoUnfreeze(g.db, at(16)), []);
  });

  it('lets a member whose allowance just ran out through the gate', () => {
    const g = gym();
    const member = addMember(g.db, '5557770001');
    const membershipId = addMembership(g.db, member.id, g.quarterly, NOW, { startOffsetDays: -10, endOffsetDays: 20 });
    freezeMembership(g.db, membershipId, at(0));
    const scan = (daysLater: number) => {
      const when = at(daysLater).now;
      const result = scanGateCode(g.db, createGateCode(member.id, 'in', presenceSeq(g.db, member.id), when.getTime(), gateSigner(member.qrSecret)), when, TZ);
      return getCheckin(g.db, result.checkinId, localDate(when, TZ));
    };
    assert.equal(scan(3)?.reason, 'membership_frozen');
    assert.equal(scan(15)?.result, 'granted');
    assert.equal(row(g.db, membershipId).status, 'active');
  });

  it('keeps membership history append-only after the table rebuild', () => {
    const g = gym();
    const member = addMember(g.db, '5557770001');
    sellMembership(g.db, member.id, { planId: g.monthly, method: 'cash' }, at(0));
    assert.throws(() => g.db.prepare('UPDATE membership_events SET days = 1').run(), /append-only/);
    assert.throws(() => g.db.prepare('DELETE FROM membership_events').run(), /append-only/);
    // Only an unfreeze may be recorded without a staff member.
    assert.throws(
      () => g.db.prepare("INSERT INTO membership_events (membership_id, type, created_at, created_by) VALUES (1, 'freeze', 'x', NULL)").run(),
      /CHECK/,
    );
  });
});
