import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import { sign } from 'hono/jwt';
import {
  ACTIVATION_MAX_ATTEMPTS,
  createGateCode,
  type ActivationCodeResponse,
  type CreateMemberRequest,
  type CreateMemberResponse,
  type GateScanResponse,
  type LiveEvent,
  type MeResponse,
  type MemberLoginResponse,
  type MyConsentsResponse,
} from '../../shared/contract.ts';
import { KVKK_NOTICE_VERSION } from '../../shared/consent.ts';
import { createApp } from '../src/app.ts';
import { gateSigner, issueToken, readToken, verifySecret, type AuthClaims } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { openDb, type Db } from '../src/db.ts';
import { MIGRATIONS } from '../src/migrations.ts';
import type { LiveHub } from '../src/live.ts';
import { activateMember, issueActivation, newActivationCode, registerMember } from '../src/onboarding.ts';
import { HttpProblem } from '../src/problem.ts';
import { findMemberByPhone } from '../src/queries.ts';
import { memberDetail, type StaffAction } from '../src/reception.ts';
import { localDate } from '../src/time.ts';
import { TZ, addPlan, testDb } from './helpers.ts';

const NOW = new Date('2026-11-10T15:00:00Z');
const MINUTE_MS = 60_000;
const DESK_ID = 1;
const PHONE = '5557770001';
const PASSWORD = 'yeni-sifre-123';

const config: Config = {
  PORT: 0,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DB_PATH: ':memory:',
  GYM_CAPACITY: 85,
  GYM_TIMEZONE: TZ,
  DEMO_SIMULATION: false,
  DEMO_MIN_INSIDE: 12,
};

function gym(): { db: Db; planId: number } {
  const db = testDb();
  const stamp = NOW.toISOString();
  db.prepare("INSERT INTO staff (name, role, pin_hash, created_at, modified_at) VALUES ('Gişe', 'desk', 'x', ?, ?)").run(stamp, stamp);
  return { db, planId: addPlan(db) };
}

const at = (minutesLater = 0): StaffAction => {
  const now = new Date(NOW.getTime() + minutesLater * MINUTE_MS);
  return { staffId: DESK_ID, now, today: localDate(now, TZ) };
};
const later = (minutes: number) => new Date(NOW.getTime() + minutes * MINUTE_MS);

const NO_PROFILE = { birthYear: null, gender: null, heightCm: null, weightKg: null, goal: null } as const;

function request(overrides: Partial<CreateMemberRequest> = {}): CreateMemberRequest {
  return {
    role: 'member',
    fullName: 'Deniz Yılmaz',
    phone: PHONE,
    noticeVersion: KVKK_NOTICE_VERSION,
    consents: { notice: true, optionalData: false },
    profile: { ...NO_PROFILE },
    sale: null,
    ...overrides,
  };
}

async function rejects(promise: Promise<unknown>, status: number): Promise<HttpProblem> {
  try {
    await promise;
  } catch (err) {
    assert.ok(err instanceof HttpProblem, `expected HttpProblem, got ${String(err)}`);
    assert.equal(err.status, status);
    return err;
  }
  assert.fail('expected a rejection');
}

const activationRow = (db: Db, memberId: number) =>
  db.prepare('SELECT failed_attempts, used_at, revoked_at FROM member_activations WHERE member_id = ? ORDER BY id DESC LIMIT 1').get(memberId) as {
    failed_attempts: number;
    used_at: string | null;
    revoked_at: string | null;
  };

describe('onboarding', () => {
  it('treats members from before migration 5 as activated, on epoch 0', () => {
    const dir = mkdtempSync(join(tmpdir(), 'novra-mig-'));
    const path = join(dir, 'gym.db');
    try {
      const old = new DatabaseSync(path);
      MIGRATIONS.slice(0, 4).forEach((sql) => old.exec(sql));
      old.exec('PRAGMA user_version = 4');
      old.prepare(
        "INSERT INTO members (full_name, phone, password_hash, qr_secret, created_at, modified_at) VALUES ('Eski Üye', '5550000001', 'x', ?, '2026-01-01T00:00:00Z', '2026-01-01T00:00:00Z')",
      ).run('a'.repeat(64));
      old.close();

      const db = openDb(path);
      assert.deepEqual({ ...(db.prepare('SELECT activated_at, session_epoch FROM members').get() as object) }, { activated_at: '2026-01-01T00:00:00Z', session_epoch: 0 });
      db.close();
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });

  it('makes six-digit codes, zero padded', () => {
    for (let i = 0; i < 200; i++) assert.match(newActivationCode(), /^\d{6}$/);
  });

  it('opens an account with consents, a first package and a code, but no usable password', async () => {
    const { db, planId } = gym();
    const { memberId, activation } = await registerMember(db, request({ sale: { planId, method: 'card' } }), at());

    assert.match(activation.code, /^\d{6}$/);
    assert.equal(activation.expiresAt, later(15).toISOString());
    const detail = memberDetail(db, memberId, at().today, NOW);
    assert.equal(detail.member.activated, false);
    assert.equal(detail.activatedAt, null);
    assert.equal(detail.activationExpiresAt, activation.expiresAt);
    assert.equal(detail.current?.status, 'active');
    assert.equal(detail.history[0]?.type, 'sale');
    assert.deepEqual(
      detail.consents.map((c) => [c.kind, c.granted, c.version, c.staffName]),
      [
        ['optional_data', false, KVKK_NOTICE_VERSION, 'Gişe'],
        ['notice', true, KVKK_NOTICE_VERSION, 'Gişe'],
      ],
    );
    const row = db.prepare('SELECT password_hash, created_by, modified_by FROM members WHERE id = ?').get(memberId) as {
      password_hash: string;
      created_by: number;
      modified_by: number;
    };
    assert.equal(row.created_by, DESK_ID);
    assert.equal(row.modified_by, DESK_ID);
    assert.equal(await verifySecret(activation.code, row.password_hash), false);
    // The code is never stored as written.
    const stored = db.prepare('SELECT code_hash FROM member_activations WHERE member_id = ?').get(memberId) as { code_hash: string };
    assert.ok(!stored.code_hash.includes(activation.code));
  });

  it('keeps optional profile fields only when consent was given', async () => {
    const { db } = gym();
    const profile = { birthYear: 1994, gender: 'f', heightCm: 168, weightKg: 61.5, goal: 'fit' } as const;
    const { memberId } = await registerMember(db, request({ consents: { notice: true, optionalData: true }, profile }), at());
    const row = db.prepare('SELECT birth_year, gender, height_cm, weight_kg, goal FROM members WHERE id = ?').get(memberId);
    assert.deepEqual({ ...row }, { birth_year: 1994, gender: 'f', height_cm: 168, weight_kg: 61.5, goal: 'fit' });
  });

  it('refuses a phone that already has an account', async () => {
    const { db } = gym();
    await registerMember(db, request(), at());
    const problem = await rejects(registerMember(db, request({ fullName: 'Başka Biri' }), at()), 409);
    assert.equal(problem.errors?.[0]?.path, 'phone');
  });

  it('writes nothing when the first sale fails', async () => {
    const { db } = gym();
    await rejects(registerMember(db, request({ sale: { planId: 999, method: 'cash' } }), at()), 404);
    assert.equal(findMemberByPhone(db, PHONE), undefined);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM member_consents').get() as { n: number }).n, 0);
    assert.equal((db.prepare('SELECT COUNT(*) AS n FROM member_activations').get() as { n: number }).n, 0);
  });

  it('keeps consent decisions append-only', async () => {
    const { db } = gym();
    await registerMember(db, request(), at());
    assert.throws(() => db.prepare('UPDATE member_consents SET granted = 1').run(), /append-only/);
    assert.throws(() => db.prepare('DELETE FROM member_consents').run(), /append-only/);
    assert.throws(
      () => db.prepare("INSERT INTO member_consents (member_id, kind, version, granted, created_at) VALUES (1, 'notice', 'v', 0, 'x')").run(),
      /CHECK/,
    );
  });

  it('activates with the code once: password set, account activated, new session epoch', async () => {
    const { db } = gym();
    const { memberId, activation } = await registerMember(db, request(), at());

    const member = await activateMember(db, { phone: PHONE, code: activation.code, password: PASSWORD }, later(3));
    assert.equal(member.id, memberId);
    assert.equal(member.session_epoch, 1);
    assert.equal(await verifySecret(PASSWORD, member.password_hash), true);
    const detail = memberDetail(db, memberId, at().today, later(3));
    assert.equal(detail.member.activated, true);
    assert.equal(detail.activatedAt, later(3).toISOString());
    assert.equal(detail.activationExpiresAt, null);

    await rejects(activateMember(db, { phone: PHONE, code: activation.code, password: 'baska-sifre-1' }, later(4)), 400);
  });

  it('gives the same answer for an unknown phone, a wrong code and an expired code', async () => {
    const { db } = gym();
    const { activation } = await registerMember(db, request(), at());
    const wrongCode = activation.code === '000000' ? '111111' : '000000';

    const unknown = await rejects(activateMember(db, { phone: '5559999999', code: activation.code, password: PASSWORD }, later(1)), 400);
    const wrong = await rejects(activateMember(db, { phone: PHONE, code: wrongCode, password: PASSWORD }, later(1)), 400);
    const expired = await rejects(activateMember(db, { phone: PHONE, code: activation.code, password: PASSWORD }, later(16)), 400);
    assert.equal(unknown.detail, wrong.detail);
    assert.equal(wrong.detail, expired.detail);
  });

  it(`revokes a code after ${ACTIVATION_MAX_ATTEMPTS} wrong guesses, even if the right one comes next`, async () => {
    const { db } = gym();
    const { memberId, activation } = await registerMember(db, request(), at());
    const wrongCode = activation.code === '000000' ? '111111' : '000000';

    for (let i = 1; i <= ACTIVATION_MAX_ATTEMPTS; i++) {
      await rejects(activateMember(db, { phone: PHONE, code: wrongCode, password: PASSWORD }, later(1)), 400);
      assert.equal(activationRow(db, memberId).failed_attempts, i);
    }
    assert.notEqual(activationRow(db, memberId).revoked_at, null);
    await rejects(activateMember(db, { phone: PHONE, code: activation.code, password: PASSWORD }, later(2)), 400);
  });

  it('kills the old code when reception hands out a new one', async () => {
    const { db } = gym();
    const { memberId, activation: first } = await registerMember(db, request(), at());
    const second = await issueActivation(db, memberId, at(5));
    await rejects(activateMember(db, { phone: PHONE, code: first.code, password: PASSWORD }, later(6)), 400);
    const member = await activateMember(db, { phone: PHONE, code: second.code, password: PASSWORD }, later(6));
    assert.equal(member.id, memberId);
    await rejects(issueActivation(db, 999, at()), 404);
  });

  it('resets a forgotten password with a new code and keeps the first activation date', async () => {
    const { db } = gym();
    const { memberId, activation } = await registerMember(db, request(), at());
    await activateMember(db, { phone: PHONE, code: activation.code, password: PASSWORD }, later(1));

    const reset = await issueActivation(db, memberId, at(60));
    const member = await activateMember(db, { phone: PHONE, code: reset.code, password: 'unuttum-yeni-1' }, later(61));
    assert.equal(member.session_epoch, 2);
    assert.equal(await verifySecret('unuttum-yeni-1', member.password_hash), true);
    assert.equal(memberDetail(db, memberId, at().today, later(61)).activatedAt, later(1).toISOString());
  });
});

describe('onboarding API', () => {
  const published: LiveEvent[] = [];
  const live = { publish: (event: LiveEvent) => published.push(event) };
  const { db, planId } = gym();
  let clock = NOW;
  const app = createApp({ db, config, live: live as unknown as LiveHub, now: () => clock });

  const auth = async (claims: AuthClaims) => ({ Authorization: `Bearer ${await issueToken(config.JWT_SECRET, claims)}` });
  const desk = () => auth({ sub: DESK_ID, role: 'desk' });
  const post = (path: string, body: unknown, headers: Record<string, string> = {}) =>
    app.request(path, { method: 'POST', headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

  it('lets only staff open accounts and has no public sign-up', async () => {
    assert.equal((await post('/staff/members', request())).status, 401);
    assert.equal((await post('/staff/members', request(), await auth({ sub: 1, role: 'member', ep: 0 }))).status, 403);
    const signUp = await post('/auth/member/register', { fullName: 'Biri', phone: '5550001122', password: 'sifre-1234' });
    assert.equal(signUp.status, 404);
  });

  it('validates the KVKK side of a new account', async () => {
    const headers = await desk();
    const noConsent = await post('/staff/members', request({ profile: { ...NO_PROFILE, heightCm: 180 } }), headers);
    assert.equal(noConsent.status, 400);
    const body = (await noConsent.json()) as { errors: { path: string }[] };
    assert.deepEqual(body.errors.map((e) => e.path), ['profile.heightCm']);

    assert.equal((await post('/staff/members', request({ noticeVersion: '2020-01' }), headers)).status, 400);
    assert.equal((await post('/staff/members', { ...request(), consents: { notice: false, optionalData: false } }, headers)).status, 400);
    assert.equal(findMemberByPhone(db, PHONE), undefined);
  });

  it('runs reception to gate: register, activate on the phone, me, consents, scan', async () => {
    const created = await post('/staff/members', request({ phone: '0555 777 00 01', sale: { planId, method: 'cash' } }), await desk());
    assert.equal(created.status, 201);
    assert.equal(created.headers.get('Cache-Control'), 'no-store');
    const { detail, activation } = (await created.json()) as CreateMemberResponse;
    assert.equal(detail.member.phone, PHONE);
    assert.equal(detail.member.activated, false);
    assert.deepEqual(published.at(-1), { type: 'member', memberId: detail.member.id });

    const login = await post('/auth/member/login', { phone: PHONE, password: activation.code });
    assert.equal(login.status, 401);
    assert.equal((await post('/auth/member/activate', { phone: PHONE, code: '12', password: PASSWORD })).status, 400);
    assert.equal((await post('/auth/member/activate', { phone: PHONE, code: activation.code, password: 'kisa' })).status, 400);

    const activated = await post('/auth/member/activate', { phone: PHONE, code: activation.code, password: PASSWORD });
    assert.equal(activated.status, 200);
    const session = (await activated.json()) as MemberLoginResponse;
    assert.equal(session.member.id, detail.member.id);
    assert.deepEqual(published.at(-1), { type: 'member', memberId: detail.member.id });

    const asMember = { headers: { Authorization: `Bearer ${session.token}` } };
    const me = (await (await app.request('/me', asMember)).json()) as MeResponse;
    assert.equal(me.membership?.status, 'active');
    const { consents } = (await (await app.request('/me/consents', asMember)).json()) as MyConsentsResponse;
    assert.equal(consents.length, 2);

    const code = createGateCode(me.member.id, 'in', me.presenceSeq, clock.getTime(), gateSigner(session.qrSecret));
    const scan = (await (await post('/gate/scan', { code }, await desk())).json()) as GateScanResponse;
    assert.equal(scan.checkin.result, 'granted');

    // The password from activation is now the password for normal sign-in.
    assert.equal((await post('/auth/member/login', { phone: PHONE, password: PASSWORD })).status, 200);
  });

  it('signs out older sessions when the password is reset with a new code', async () => {
    const member = findMemberByPhone(db, PHONE);
    assert.ok(member);
    const oldToken = (await (await post('/auth/member/login', { phone: PHONE, password: PASSWORD })).json()) as MemberLoginResponse;

    clock = later(120);
    const issued = await post(`/staff/members/${member.id}/activation`, {}, await desk());
    assert.equal(issued.status, 201);
    const { code } = (await issued.json()) as ActivationCodeResponse;
    const fresh = (await (await post('/auth/member/activate', { phone: PHONE, code, password: 'yepyeni-sifre-9' })).json()) as MemberLoginResponse;

    const old = await app.request('/me', { headers: { Authorization: `Bearer ${oldToken.token}` } });
    assert.equal(old.status, 401);
    assert.equal((await app.request('/me', { headers: { Authorization: `Bearer ${fresh.token}` } })).status, 200);
    assert.equal((await post('/auth/member/login', { phone: PHONE, password: PASSWORD })).status, 401);
  });

  it('reads member tokens from before session epochs as epoch 0', async () => {
    const iat = Math.floor(Date.now() / 1000);
    const legacy = await sign({ sub: 7, role: 'member', iat, exp: iat + 60 }, config.JWT_SECRET, 'HS256');
    assert.deepEqual(await readToken(config.JWT_SECRET, legacy), { sub: 7, role: 'member', ep: 0 });
    const forged = await sign({ sub: 7, role: 'member', ep: -1, iat, exp: iat + 60 }, config.JWT_SECRET, 'HS256');
    assert.equal(await readToken(config.JWT_SECRET, forged), null);
  });
});
