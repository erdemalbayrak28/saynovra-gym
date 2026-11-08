import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { daysLeft, effectiveStatus, nextStatus } from '../src/domain/membership.ts';
import { addDays, daysBetween, localDate, startOfLocalDay } from '../src/time.ts';

describe('membership state machine', () => {
  it('allows the documented transitions', () => {
    assert.equal(nextStatus('active', 'freeze'), 'frozen');
    assert.equal(nextStatus('frozen', 'unfreeze'), 'active');
    assert.equal(nextStatus('active', 'expire'), 'expired');
    assert.equal(nextStatus('active', 'cancel'), 'cancelled');
    assert.equal(nextStatus('frozen', 'cancel'), 'cancelled');
  });

  it('refuses everything else', () => {
    assert.equal(nextStatus('frozen', 'freeze'), null);
    assert.equal(nextStatus('active', 'unfreeze'), null);
    assert.equal(nextStatus('frozen', 'expire'), null);
    assert.equal(nextStatus('expired', 'unfreeze'), null);
    assert.equal(nextStatus('cancelled', 'unfreeze'), null);
    assert.equal(nextStatus('expired', 'cancel'), null);
  });

  it('treats an active membership past its last day as expired', () => {
    assert.equal(effectiveStatus('active', '2026-11-08', '2026-11-09'), 'expired');
    assert.equal(effectiveStatus('active', '2026-11-09', '2026-11-09'), 'active');
    assert.equal(effectiveStatus('frozen', '2026-11-01', '2026-11-09'), 'frozen');
  });

  it('counts days left and never goes negative', () => {
    assert.equal(daysLeft('2026-12-21', '2026-11-09'), 42);
    assert.equal(daysLeft('2026-11-09', '2026-11-09'), 0);
    assert.equal(daysLeft('2026-11-01', '2026-11-09'), 0);
  });
});

describe('calendar helpers', () => {
  it('uses the gym time zone for the calendar day', () => {
    // 22:30 UTC on Nov 9 is already Nov 10 in Istanbul (UTC+3).
    assert.equal(localDate(new Date('2026-11-09T22:30:00Z'), 'Europe/Istanbul'), '2026-11-10');
    assert.equal(startOfLocalDay(new Date('2026-11-09T22:30:00Z'), 'Europe/Istanbul'), '2026-11-09T21:00:00.000Z');
  });

  it('adds days across month and year boundaries', () => {
    assert.equal(addDays('2026-12-30', 3), '2027-01-02');
    assert.equal(addDays('2026-03-01', -1), '2026-02-28');
    assert.equal(daysBetween('2026-12-30', '2027-01-02'), 3);
  });
});
