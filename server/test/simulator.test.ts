import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import type { Config } from '../src/config.ts';
import { LiveHub } from '../src/live.ts';
import { insideMemberIds } from '../src/queries.ts';
import { DemoSimulator } from '../src/simulator.ts';
import { chat, openPost, radar, sendMessage, sendRequest } from '../src/social.ts';
import { TZ, addMember, addMembership, addPlan, pass, testDb } from './helpers.ts';

const config: Config = {
  PORT: 0,
  JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
  DB_PATH: ':memory:',
  GYM_CAPACITY: 85,
  GYM_TIMEZONE: TZ,
  DEMO_SIMULATION: true,
  DEMO_MIN_INSIDE: 6,
};

/** Deterministic stand-in for Math.random. */
function seeded(): () => number {
  let state = 7;
  return () => {
    state = (state * 16807) % 2147483647;
    return state / 2147483647;
  };
}

describe('demo simulation', () => {
  it('fills the gym, keeps buddies posting and answers the demo member', () => {
    const db = testDb();
    let clock = new Date('2026-11-09T23:00:00Z'); // 02:00 in Istanbul: history says empty
    const planId = addPlan(db);
    const demo = addMember(db, '5550000001', 'scrypt$00$00', 'Erdem Albayrak').id;
    const buddies = ['5550000002', '5550000003', '5550000004', '5550000005'].map((phone, i) => addMember(db, phone, 'scrypt$00$00', `Buddy${i} Test`).id);
    const crowd = Array.from({ length: 10 }, (_, i) => addMember(db, `55500002${String(i).padStart(2, '0')}`).id);
    for (const id of [demo, ...buddies, ...crowd]) addMembership(db, id, planId, clock);

    const sim = new DemoSimulator({ db, live: new LiveHub(config.JWT_SECRET), config, now: () => clock, random: seeded() });
    const step = (seconds: number) => {
      clock = new Date(clock.getTime() + seconds * 1000);
      sim.tick();
    };

    step(0);
    const inside = insideMemberIds(db, clock);
    assert.ok(buddies.every((id) => inside.has(id)), 'buddies are inside');
    assert.equal(inside.size, 6, 'occupancy reaches the demo minimum');
    assert.equal(inside.has(demo), false, 'the demo member is never moved');

    pass(db, demo, 'in', clock);
    const view = radar(db, demo, clock);
    assert.equal(view.posts.length, 4, 'every buddy has a post');

    // The demo member asks Buddy0; after a short pause the buddy accepts and writes.
    const target = view.posts.find((p) => p.member.id === buddies[0]);
    const { request } = sendRequest(db, demo, target?.id ?? 0, clock);
    step(3);
    assert.equal(radar(db, demo, clock).matches.length, 1);
    step(3);
    const opening = chat(db, demo, request.id).messages;
    assert.equal(opening.length, 1);
    assert.equal(opening[0]?.senderId, buddies[0]);

    sendMessage(db, demo, request.id, 'Geliyorum', clock);
    step(3);
    assert.equal(chat(db, demo, request.id).messages.at(-1)?.senderId, buddies[0], 'the buddy answers a follow-up');

    // A fresh post from another demo member gets approached by a free buddy.
    const other = addMember(db, '5550000099', 'scrypt$00$00', 'Deniz Yıldız').id;
    pass(db, other, 'in', clock);
    openPost(db, other, { muscleGroup: 'legs', location: 'Squat rack 2', note: '' }, clock);
    step(16);
    assert.equal(radar(db, other, clock).incoming.length, 0, 'only the demo member is approached');
  });

  it('approaches the demo member after a while', () => {
    const db = testDb();
    let clock = new Date('2026-11-09T23:00:00Z');
    const planId = addPlan(db);
    const demo = addMember(db, '5550000001', 'scrypt$00$00', 'Erdem Albayrak').id;
    const buddy = addMember(db, '5550000002', 'scrypt$00$00', 'Burak Bayram').id;
    for (const id of [demo, buddy]) addMembership(db, id, planId, clock);
    const sim = new DemoSimulator({ db, live: new LiveHub(config.JWT_SECRET), config: { ...config, DEMO_MIN_INSIDE: 0 }, now: () => clock, random: seeded() });

    sim.tick();
    pass(db, demo, 'in', clock);
    openPost(db, demo, { muscleGroup: 'chest_back', location: 'Bench 1', note: '' }, clock);
    clock = new Date(clock.getTime() + 5000);
    sim.tick();
    assert.equal(radar(db, demo, clock).incoming.length, 0, 'not before 15 seconds');
    clock = new Date(clock.getTime() + 15_000);
    sim.tick();
    const incoming = radar(db, demo, clock).incoming;
    assert.equal(incoming.length, 1);
    assert.equal(incoming[0]?.from.displayName, 'Burak B.');
  });
});
