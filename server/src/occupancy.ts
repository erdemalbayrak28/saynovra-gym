import type { HourlyOccupancy, OccupancyLevel, OccupancyResponse } from '../../shared/contract.ts';
import type { Db } from './db.ts';
import { INSIDE_TIMEOUT_HOURS, insideCount } from './queries.ts';
import { addDays, localDate, localHour, startOfLocalDate, weekdayName } from './time.ts';

/** Hours shown in the profile; the gym opens at 06:00 and closes at midnight. */
export const FIRST_HOUR = 6;
export const LAST_HOUR = 23;
const HISTORY_WEEKS = 4;
const HOUR_MS = 60 * 60 * 1000;

export function occupancyLevel(pct: number): OccupancyLevel {
  return pct < 40 ? 'calm' : pct < 70 ? 'normal' : 'busy';
}

export interface Pass {
  member_id: number;
  direction: 'in' | 'out';
  created_at: string;
}

/**
 * Members inside at each sample instant. A stay runs from a granted entry to the next exit,
 * capped at INSIDE_TIMEOUT_HOURS (a forgotten exit), the same rule the gate uses.
 * `passes` must be ordered by member, then time.
 */
export function countInside(passes: Pass[], samples: number[]): number[] {
  const timeoutMs = INSIDE_TIMEOUT_HOURS * HOUR_MS;
  const stays: [number, number][] = [];
  let member: number | null = null;
  let start: number | null = null;
  const close = (end: number) => {
    if (start !== null) stays.push([start, Math.min(end, start + timeoutMs)]);
    start = null;
  };
  for (const pass of passes) {
    if (pass.member_id !== member) {
      if (start !== null) close(start + timeoutMs);
      member = pass.member_id;
    }
    const at = Date.parse(pass.created_at);
    if (pass.direction === 'in') {
      if (start !== null) close(at);
      start = at;
    } else {
      close(at);
    }
  }
  if (start !== null) close(start + timeoutMs);
  return samples.map((sample) => stays.filter(([from, to]) => from <= sample && sample < to).length);
}

/** Average members inside at half past each hour, over the same weekday of the last four weeks. */
export function hourlyProfile(db: Db, now: Date, timeZone: string, capacity: number): HourlyOccupancy[] {
  const today = localDate(now, timeZone);
  const hours = Array.from({ length: LAST_HOUR - FIRST_HOUR + 1 }, (_, i) => FIRST_HOUR + i);
  const totals = hours.map(() => 0);
  const select = db.prepare(
    `SELECT member_id, direction, created_at FROM checkins
     WHERE result = 'granted' AND created_at >= ? AND created_at < ?
     ORDER BY member_id, created_at, id`,
  );

  for (let week = 1; week <= HISTORY_WEEKS; week++) {
    const day = addDays(today, -7 * week);
    const dayStart = Date.parse(startOfLocalDate(day, timeZone));
    const passes = select.all(
      new Date(dayStart - INSIDE_TIMEOUT_HOURS * HOUR_MS).toISOString(),
      new Date(dayStart + 24 * HOUR_MS).toISOString(),
    ) as unknown as Pass[];
    const counts = countInside(passes, hours.map((hour) => dayStart + hour * HOUR_MS + HOUR_MS / 2));
    counts.forEach((count, i) => {
      totals[i] = (totals[i] ?? 0) + count;
    });
  }

  return hours.map((hour, i) => {
    const expected = Math.round(((totals[i] ?? 0) / HISTORY_WEEKS) * 10) / 10;
    return { hour, expected, pct: Math.min(100, Math.round((expected / capacity) * 100)) };
  });
}

export function occupancy(db: Db, now: Date, timeZone: string, capacity: number): OccupancyResponse {
  const inside = insideCount(db, now);
  const pct = Math.min(100, Math.round((inside / capacity) * 100));
  const hours = hourlyProfile(db, now, timeZone, capacity);
  const currentHour = localHour(now, timeZone);
  // An hour nobody has visited is the gym being closed or just opening, not a quiet time to recommend.
  const upcoming = hours.filter((h) => h.hour > currentHour && h.expected > 0);
  const quietestUpcoming = upcoming.reduce<HourlyOccupancy | null>((best, h) => (best === null || h.pct < best.pct ? h : best), null);
  return {
    insideCount: inside,
    capacity,
    pct,
    level: occupancyLevel(pct),
    weekdayName: weekdayName(localDate(now, timeZone)),
    currentHour,
    hours,
    quietestUpcoming,
  };
}
