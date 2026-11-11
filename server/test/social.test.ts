import assert from 'node:assert/strict';
import { before, describe, it } from 'node:test';
import type { ChatResponse, FloorEvent, RadarResponse, SpotRequestDto, SpotterPostDto } from '../../shared/contract.ts';
import { createApp } from '../src/app.ts';
import { hashSecret, issueToken } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import { LiveHub } from '../src/live.ts';
import { TZ, addMember, pass, testDb } from './helpers.ts';

const config: Config = {
  PORT: 0,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DB_PATH: ':memory:',
  GYM_CAPACITY: 85,
  GYM_TIMEZONE: TZ,
  DEMO_SIMULATION: false,
  DEMO_MIN_INSIDE: 12,
};

describe('buddy radar', () => {
  const db = testDb();
  let clock = new Date('2026-11-09T16:00:00Z');
  const app = createApp({ db, config, live: new LiveHub(config.JWT_SECRET), now: () => clock });
  const tokens: Record<string, string> = {};
  const ids: Record<string, number> = {};

  const call = async <T>(who: string, method: 'GET' | 'POST', path: string, body?: unknown) => {
    const res = await app.request(path, {
      method,
      headers: { Authorization: `Bearer ${tokens[who]}`, ...(body !== undefined ? { 'Content-Type': 'application/json' } : {}) },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    return { status: res.status, body: (res.status === 204 ? null : await res.json()) as T };
  };
  const post = { muscleGroup: 'chest_back', location: 'Bench 2', note: 'Son iki set için spotter lazım' };

  before(async () => {
    for (const [who, phone, name] of [
      ['ayse', '5550000011', 'Ayşe Kaya'],
      ['burak', '5550000012', 'Burak Bayram'],
      ['cem', '5550000013', 'Cem Demir'],
      ['dila', '5550000014', 'Dila Su'],
    ] as const) {
      ids[who] = addMember(db, phone, 'scrypt$00$00', name).id;
      tokens[who] = await issueToken(config.JWT_SECRET, { sub: ids[who] ?? 0, role: 'member' });
    }
    tokens.staff = await issueToken(config.JWT_SECRET, { sub: 1, role: 'desk' });
    db.prepare("INSERT INTO staff (name, role, pin_hash, created_at, modified_at) VALUES ('Gişe', 'desk', ?, 'x', 'x')").run(await hashSecret('2024'));
    for (const who of ['ayse', 'burak', 'cem']) pass(db, ids[who] ?? 0, 'in', new Date(clock.getTime() - 10 * 60 * 1000));
  });

  it('is only for members inside the gym', async () => {
    const outside = await call<RadarResponse>('dila', 'GET', '/me/radar');
    assert.equal(outside.body.inside, false);
    assert.equal(outside.body.posts.length, 0);
    assert.equal((await call('dila', 'POST', '/me/radar/post', post)).status, 409);
  });

  it('validates posts', async () => {
    assert.equal((await call('ayse', 'POST', '/me/radar/post', { ...post, location: 'Çatı' })).status, 400);
    assert.equal((await call('ayse', 'POST', '/me/radar/post', { ...post, note: 'x'.repeat(141) })).status, 400);
  });

  it('shows open posts to others with first name and initial', async () => {
    const opened = await call<SpotterPostDto>('ayse', 'POST', '/me/radar/post', post);
    assert.equal(opened.status, 201);
    const seen = await call<RadarResponse>('burak', 'GET', '/me/radar');
    assert.equal(seen.body.posts.length, 1);
    assert.equal(seen.body.posts[0]?.member.displayName, 'Ayşe K.');
    assert.equal(seen.body.posts[0]?.mine, false);
    assert.ok(seen.body.posts[0]?.enteredAt);
    const own = await call<RadarResponse>('ayse', 'GET', '/me/radar');
    assert.equal(own.body.myPost?.id, opened.body.id);
    assert.equal(own.body.posts.length, 0);
  });

  it('pairs two members and opens a chat only for them', async () => {
    const ayse = await call<RadarResponse>('ayse', 'GET', '/me/radar');
    const postId = ayse.body.myPost?.id ?? 0;
    assert.equal((await call('ayse', 'POST', '/me/spot-requests', { postId })).status, 400);

    const sent = await call<SpotRequestDto>('burak', 'POST', '/me/spot-requests', { postId });
    assert.equal(sent.status, 201);
    assert.equal(sent.body.status, 'pending');
    assert.equal((await call('burak', 'POST', '/me/spot-requests', { postId })).status, 409);
    assert.equal((await call('cem', 'POST', `/me/spot-requests/${sent.body.id}/accept`)).status, 404);
    assert.equal((await call('burak', 'POST', `/me/spot-requests/${sent.body.id}/accept`)).status, 404);
    assert.equal((await call<RadarResponse>('ayse', 'GET', '/me/radar')).body.incoming.length, 1);

    const cemRequest = await call<SpotRequestDto>('cem', 'POST', '/me/spot-requests', { postId });
    const accepted = await call<SpotRequestDto>('ayse', 'POST', `/me/spot-requests/${sent.body.id}/accept`);
    assert.equal(accepted.body.status, 'accepted');

    const after = await call<RadarResponse>('ayse', 'GET', '/me/radar');
    assert.equal(after.body.myPost, null, 'a paired member stops looking');
    assert.equal(after.body.matches.length, 1);
    const cem = await call<RadarResponse>('cem', 'GET', '/me/radar');
    assert.equal(cem.body.outgoing.length, 0, `other requests expire (was ${cemRequest.body.id})`);

    const message = await call('burak', 'POST', `/me/spot-requests/${sent.body.id}/messages`, { body: '  İki dakikaya oradayım ' });
    assert.equal(message.status, 201);
    const conversation = await call<ChatResponse>('ayse', 'GET', `/me/spot-requests/${sent.body.id}/chat`);
    assert.equal(conversation.body.canSend, true);
    assert.equal(conversation.body.messages[0]?.body, 'İki dakikaya oradayım');
    assert.equal((await call('cem', 'GET', `/me/spot-requests/${sent.body.id}/chat`)).status, 404);
    assert.equal((await call('ayse', 'POST', `/me/spot-requests/${sent.body.id}/messages`, { body: '   ' })).status, 400);

    const floor = await call<FloorEvent[]>('staff', 'GET', '/staff/floor');
    assert.ok(floor.body.some((e) => e.kind === 'matched' && e.text.includes('Burak B.') && e.text.includes('Ayşe K.')));
    assert.ok(floor.body.some((e) => e.kind === 'post_opened'));
  });

  it('ends pairings when someone leaves', async () => {
    const matches = (await call<RadarResponse>('ayse', 'GET', '/me/radar')).body.matches;
    const requestId = matches[0]?.id ?? 0;
    clock = new Date(clock.getTime() + 60 * 1000);
    pass(db, ids.burak ?? 0, 'out', clock);

    assert.equal((await call<RadarResponse>('ayse', 'GET', '/me/radar')).body.matches.length, 0);
    const conversation = await call<ChatResponse>('ayse', 'GET', `/me/spot-requests/${requestId}/chat`);
    assert.equal(conversation.body.request.status, 'expired');
    assert.equal(conversation.body.canSend, false);
    assert.equal((await call('ayse', 'POST', `/me/spot-requests/${requestId}/messages`, { body: 'Neredesin?' })).status, 409);
  });

  it('lets the sender cancel and the owner decline', async () => {
    const cemPost = await call<SpotterPostDto>('cem', 'POST', '/me/radar/post', { ...post, location: 'Squat rack 1', muscleGroup: 'legs' });
    const first = await call<SpotRequestDto>('ayse', 'POST', '/me/spot-requests', { postId: cemPost.body.id });
    assert.equal((await call<SpotRequestDto>('ayse', 'POST', `/me/spot-requests/${first.body.id}/cancel`)).body.status, 'cancelled');
    const second = await call<SpotRequestDto>('ayse', 'POST', '/me/spot-requests', { postId: cemPost.body.id });
    assert.equal((await call<SpotRequestDto>('cem', 'POST', `/me/spot-requests/${second.body.id}/decline`)).body.status, 'declined');
    assert.equal((await call('ayse', 'POST', `/me/spot-requests/${second.body.id}/cancel`)).status, 409);
    assert.equal((await call('cem', 'POST', '/me/radar/post/close')).status, 204);
    assert.equal((await call<RadarResponse>('ayse', 'GET', '/me/radar')).body.posts.length, 0);
  });
});
