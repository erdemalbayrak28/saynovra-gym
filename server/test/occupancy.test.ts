import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { countInside, hourlyProfile, occupancy, occupancyLevel, type Pass } from '../src/occupancy.ts';
import { addDays, localDate, startOfLocalDate } from '../src/time.ts';
import { TZ, addMember, pass, testDb } from './helpers.ts';

const HOUR = 60 * 60 * 1000;

describe('counting members inside', () => {
  const at = (iso: string) => Date.parse(iso);
  const p = (member_id: number, direction: 'in' | 'out', created_at: string): Pass => ({ member_id, direction, created_at });

  it('counts a stay from entry to exit', () => {
    const passes = [p(1, 'in', '2026-11-02T15:00:00Z'), p(1, 'out', '2026-11-02T16:00:00Z')];
    assert.deepEqual(countInside(passes, [at('2026-11-02T14:59:00Z'), at('2026-11-02T15:30:00Z'), at('2026-11-02T16:30:00Z')]), [0, 1, 0]);
  });

  it('ends a forgotten exit after four hours', () => {
    const passes = [p(1, 'in', '2026-11-02T10:00:00Z')];
    assert.deepEqual(countInside(passes, [at('2026-11-02T13:59:00Z'), at('2026-11-02T14:01:00Z')]), [1, 0]);
  });

  it('handles several members and repeated entries', () => {
    const passes = [
      p(1, 'in', '2026-11-02T10:00:00Z'),
      p(1, 'in', '2026-11-02T12:00:00Z'),
      p(1, 'out', '2026-11-02T12:30:00Z'),
      p(2, 'in', '2026-11-02T10:15:00Z'),
      p(2, 'out', '2026-11-02T11:00:00Z'),
    ];
    assert.deepEqual(countInside(passes, [at('2026-11-02T10:30:00Z'), at('2026-11-02T11:30:00Z'), at('2026-11-02T12:15:00Z'), at('2026-11-02T13:00:00Z')]), [2, 1, 1, 0]);
  });

  it('labels levels', () => {
    assert.equal(occupancyLevel(10), 'calm');
    assert.equal(occupancyLevel(55), 'normal');
    assert.equal(occupancyLevel(80), 'busy');
  });
});

describe('hourly profile', () => {
  it('averages the same weekday of the last four weeks', () => {
    const db = testDb();
    const now = new Date('2026-11-09T09:00:00Z'); // Monday 12:00 in Istanbul
    const members = Array.from({ length: 5 }, (_, i) => addMember(db, `555000010${i}`).id);
    const today = localDate(now, TZ);
    for (let week = 1; week <= 4; week++) {
      const dayStart = Date.parse(startOfLocalDate(addDays(today, -7 * week), TZ));
      // Weeks 1-2: five members 18:00-19:15; weeks 3-4: three members.
      const visitors = week <= 2 ? members : members.slice(0, 3);
      for (const id of visitors) {
        pass(db, id, 'in', new Date(dayStart + 18 * HOUR));
        pass(db, id, 'out', new Date(dayStart + 19.25 * HOUR));
      }
    }
    // A Tuesday visit must not leak into Monday's profile.
    pass(db, members[0] ?? 0, 'in', new Date(Date.parse(startOfLocalDate(addDays(today, -6), TZ)) + 18 * HOUR));

    const hours = hourlyProfile(db, now, TZ, 85);
    assert.equal(hours[0]?.hour, 6);
    assert.equal(hours.at(-1)?.hour, 23);
    assert.equal(hours.find((h) => h.hour === 18)?.expected, 4);
    assert.equal(hours.find((h) => h.hour === 18)?.pct, 5);
    assert.equal(hours.find((h) => h.hour === 19)?.expected, 0);
    assert.equal(hours.find((h) => h.hour === 17)?.expected, 0);

    const summary = occupancy(db, now, TZ, 85);
    assert.equal(summary.weekdayName, 'Pazartesi');
    assert.equal(summary.currentHour, 12);
    assert.ok(summary.quietestUpcoming && summary.quietestUpcoming.hour > 12);
    assert.equal(summary.insideCount, 0);
  });
});
