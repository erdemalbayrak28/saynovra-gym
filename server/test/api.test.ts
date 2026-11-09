import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import { createGateCode, type GateScanResponse, type MeResponse, type MemberLoginResponse } from '../../shared/contract.ts';
import { createApp } from '../src/app.ts';
import { gateSigner, hashSecret } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { LiveHub } from '../src/live.ts';
import { TZ, addMember, addMembership, addPlan, testDb } from './helpers.ts';

const config: Config = {
  PORT: 0,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DB_PATH: ':memory:',
  GYM_CAPACITY: 85,
  GYM_TIMEZONE: TZ,
};
const NOW = new Date('2026-11-09T17:30:10Z');

describe('HTTP API', () => {
  const db = testDb();
  const app = createApp({ db, config, live: new LiveHub(config.JWT_SECRET), now: () => NOW });
  const json = (body: unknown) => ({ method: 'POST', body: JSON.stringify(body), headers: { 'Content-Type': 'application/json' } });
  let memberId = 0;

  before(async () => {
    const planId = addPlan(db);
    memberId = addMember(db, '5550000001', await hashSecret('demo-password')).id;
    addMembership(db, memberId, planId, NOW);
    db.prepare(
      "INSERT INTO staff (name, role, pin_hash, created_at, modified_at) VALUES ('Gişe', 'desk', ?, 'x', 'x')",
    ).run(await hashSecret('2024'));
  });

  it('answers errors as problem details', async () => {
    const res = await app.request('/auth/member/login', json({ phone: '123' }));
    assert.equal(res.status, 400);
    assert.equal(res.headers.get('Content-Type'), 'application/problem+json');
    const body = (await res.json()) as { title: string; errors: unknown[] };
    assert.equal(body.title, 'Doğrulama hatası');
    assert.ok(body.errors.length > 0);

    const missing = await app.request('/nowhere');
    assert.equal(missing.status, 404);
  });

  it('gives the same answer for a wrong password and an unknown phone', async () => {
    const wrong = await app.request('/auth/member/login', json({ phone: '5550000001', password: 'nope' }));
    const unknown = await app.request('/auth/member/login', json({ phone: '5559999999', password: 'nope' }));
    assert.equal(wrong.status, 401);
    assert.equal(unknown.status, 401);
    assert.deepEqual(await wrong.json(), await unknown.json());
  });

  it('runs the whole door flow: login, me, scan, me', async () => {
    const login = await app.request('/auth/member/login', json({ phone: '0555 000 00 01', password: 'demo-password' }));
    assert.equal(login.status, 200);
    const session = (await login.json()) as MemberLoginResponse;
    assert.equal(session.member.id, memberId);
    assert.equal(session.qrSecret.length, 64);

    const asMember = { headers: { Authorization: `Bearer ${session.token}` } };
    const before = (await (await app.request('/me', asMember)).json()) as MeResponse;
    assert.equal(before.isInside, false);
    assert.equal(before.membership?.status, 'active');

    const staffLogin = await app.request('/auth/staff/login', json({ pin: '2024' }));
    const { token: staffToken } = (await staffLogin.json()) as { token: string };
    const code = createGateCode(memberId, 'in', before.presenceSeq, NOW.getTime(), gateSigner(session.qrSecret));
    const scanRes = await app.request('/gate/scan', {
      ...json({ code }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${staffToken}` },
    });
    const scan = (await scanRes.json()) as GateScanResponse;
    assert.equal(scan.checkin.result, 'granted');
    assert.equal(scan.checkin.member?.initials, 'TÜ');
    assert.equal(scan.gym.insideCount, 1);

    const after = (await (await app.request('/me', asMember)).json()) as MeResponse;
    assert.equal(after.isInside, true);
    assert.equal(after.presenceSeq, scan.checkin.id);
  });

  it('keeps members away from staff endpoints and strangers away from everything', async () => {
    const login = await app.request('/auth/member/login', json({ phone: '5550000001', password: 'demo-password' }));
    const { token } = (await login.json()) as MemberLoginResponse;
    const asMember = await app.request('/gate/scan', {
      ...json({ code: 'x' }),
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    });
    assert.equal(asMember.status, 403);
    assert.equal((await app.request('/me')).status, 401);
    assert.equal((await app.request('/me', { headers: { Authorization: 'Bearer forged.token.value' } })).status, 401);
  });
});
