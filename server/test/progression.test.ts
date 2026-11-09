import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { describeSession, formatKg, suggestNext, type ProgressionTarget, type Session } from '../src/domain/progression.ts';

const upper: ProgressionTarget = { targetSets: 3, repMin: 8, repMax: 10, isLowerBody: false, isBodyweight: false, startWeightKg: 20 };
const lower: ProgressionTarget = { ...upper, isLowerBody: true, startWeightKg: 60 };
const pullUp: ProgressionTarget = { ...upper, isBodyweight: true, startWeightKg: null };

const session = (weight: number | null, reps: number[], rpe: number | null = null): Session =>
  reps.map((r) => ({ weightKg: weight, reps: r, rpe }));

describe('progression rule', () => {
  it('starts from the programme weight the first time', () => {
    const s = suggestNext(upper, []);
    assert.equal(s.kind, 'start');
    assert.equal(s.weightKg, 20);
  });

  it('adds 2.5 kg upper body after two sessions at the top of the range', () => {
    const s = suggestNext(upper, [session(30, [10, 10, 10], 7.5), session(30, [10, 10, 10], 7.5)]);
    assert.equal(s.kind, 'increase');
    assert.equal(s.weightKg, 32.5);
    assert.match(s.reason, /30 kg/);
    assert.match(s.reason, /32,5 kg/);
    assert.match(s.reason, /RPE 7,5/);
  });

  it('adds 5 kg for lower body', () => {
    const s = suggestNext(lower, [session(100, [10, 10, 10]), session(100, [10, 10, 10])]);
    assert.equal(s.kind, 'increase');
    assert.equal(s.weightKg, 105);
  });

  it('waits for a second good session before adding weight', () => {
    const s = suggestNext(upper, [session(30, [10, 10, 10]), session(30, [10, 9, 8])]);
    assert.equal(s.kind, 'hold');
    assert.equal(s.weightKg, 30);
    assert.match(s.reason, /bir sonraki antrenmanda ağırlık artacak/);
  });

  it('needs both sessions at the same weight', () => {
    const s = suggestNext(upper, [session(32.5, [10, 10, 10]), session(30, [10, 10, 10])]);
    assert.equal(s.kind, 'hold');
    assert.equal(s.weightKg, 32.5);
  });

  it('holds when the reps came too hard', () => {
    const s = suggestNext(upper, [session(30, [10, 10, 10], 9.5), session(30, [10, 10, 10], 9)]);
    assert.equal(s.kind, 'hold');
    assert.match(s.reason, /RPE 8 üstü/);
  });

  it('holds when a set was skipped', () => {
    const s = suggestNext(upper, [session(30, [10, 10]), session(30, [10, 10, 10])]);
    assert.equal(s.kind, 'hold');
  });

  it('drops about 10 % after two sessions below the range', () => {
    const s = suggestNext(upper, [session(40, [8, 7, 6]), session(40, [8, 8, 7])]);
    assert.equal(s.kind, 'deload');
    assert.equal(s.weightKg, 35);
  });

  it('always drops at least one step', () => {
    const s = suggestNext(upper, [session(10, [5, 5, 5]), session(10, [5, 5, 5])]);
    assert.equal(s.weightKg, 7.5);
  });

  it('does not deload after a single bad session', () => {
    const s = suggestNext(upper, [session(40, [8, 7, 6]), session(40, [10, 10, 9])]);
    assert.equal(s.kind, 'hold');
    assert.equal(s.weightKg, 40);
  });

  it('progresses bodyweight moves by reps', () => {
    assert.equal(suggestNext(pullUp, []).kind, 'bodyweight');
    const s = suggestNext(pullUp, [session(null, [10, 10, 10])]);
    assert.equal(s.kind, 'increase');
    assert.equal(s.weightKg, null);
  });
});

describe('session text', () => {
  it('describes a session compactly', () => {
    assert.equal(describeSession(session(30, [10, 10, 9])), '30 kg · 10, 10, 9');
    assert.equal(describeSession(session(null, [12, 10])), '12, 10 tekrar');
    assert.equal(describeSession([{ weightKg: 30, reps: 10, rpe: null }, { weightKg: 27.5, reps: 9, rpe: null }]), '30 kg × 10, 27,5 kg × 9');
    assert.equal(describeSession([]), null);
  });

  it('formats kilograms the Turkish way', () => {
    assert.equal(formatKg(32.5), '32,5');
    assert.equal(formatKg(30), '30');
  });
});
