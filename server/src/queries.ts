import type {
  CheckinDto,
  GateDenyReason,
  GateDirection,
  MemberGoal,
  MemberProfile,
  MembershipStatus,
  StaffRole,
} from '../../shared/contract.ts';
import type { Db } from './db.ts';
import { daysLeft } from './domain/membership.ts';
import { hoursAgo } from './time.ts';

/** A member counts as inside for this long after a granted entry with no exit. */
export const INSIDE_TIMEOUT_HOURS = 4;

// ---------------------------------------------------------------------------
// Rows
// ---------------------------------------------------------------------------

export interface MemberRow {
  id: number;
  full_name: string;
  phone: string;
  password_hash: string;
  birth_year: number | null;
  height_cm: number | null;
  weight_kg: number | null;
  goal: MemberGoal | null;
  qr_secret: string;
}

export interface StaffRow {
  id: number;
  name: string;
  role: StaffRole;
  pin_hash: string;
}

export interface MembershipRow {
  id: number;
  plan_name: string;
  starts_on: string;
  ends_on: string;
  status: MembershipStatus;
}

interface CheckinJoinRow {
  id: number;
  created_at: string;
  direction: GateDirection | null;
  result: 'granted' | 'denied';
  reason: GateDenyReason | null;
  member_id: number | null;
  full_name: string | null;
  plan_name: string | null;
  ends_on: string | null;
}

// ---------------------------------------------------------------------------
// Members and staff
// ---------------------------------------------------------------------------

const MEMBER_COLUMNS = 'id, full_name, phone, password_hash, birth_year, height_cm, weight_kg, goal, qr_secret';

export function findMemberById(db: Db, id: number): MemberRow | undefined {
  return db.prepare(`SELECT ${MEMBER_COLUMNS} FROM members WHERE id = ?`).get(id) as MemberRow | undefined;
}

export function findMemberByPhone(db: Db, phone: string): MemberRow | undefined {
  return db.prepare(`SELECT ${MEMBER_COLUMNS} FROM members WHERE phone = ?`).get(phone) as MemberRow | undefined;
}

export function listStaff(db: Db): StaffRow[] {
  return db.prepare('SELECT id, name, role, pin_hash FROM staff ORDER BY id').all() as unknown as StaffRow[];
}

export function toProfile(row: MemberRow): MemberProfile {
  return {
    id: row.id,
    fullName: row.full_name,
    phone: row.phone,
    birthYear: row.birth_year,
    heightCm: row.height_cm,
    weightKg: row.weight_kg,
    goal: row.goal,
  };
}

export function initials(fullName: string): string {
  const words = fullName.trim().split(/\s+/);
  const first = words[0]?.[0] ?? '';
  const last = words.length > 1 ? (words[words.length - 1]?.[0] ?? '') : '';
  return (first + last).toLocaleUpperCase('tr-TR');
}

// ---------------------------------------------------------------------------
// Memberships
// ---------------------------------------------------------------------------

/** The membership that governs today: the latest-ending one that has already started. */
export function currentMembership(db: Db, memberId: number, today: string): MembershipRow | undefined {
  return db
    .prepare(
      `SELECT ms.id, p.name AS plan_name, ms.starts_on, ms.ends_on, ms.status
       FROM memberships ms JOIN plans p ON p.id = ms.plan_id
       WHERE ms.member_id = ? AND ms.starts_on <= ?
       ORDER BY ms.ends_on DESC, ms.id DESC LIMIT 1`,
    )
    .get(memberId, today) as MembershipRow | undefined;
}

// ---------------------------------------------------------------------------
// Presence
// ---------------------------------------------------------------------------

export function lastGrantedCheckin(db: Db, memberId: number): { direction: GateDirection; created_at: string } | undefined {
  return db
    .prepare(
      `SELECT direction, created_at FROM checkins
       WHERE member_id = ? AND result = 'granted'
       ORDER BY created_at DESC, id DESC LIMIT 1`,
    )
    .get(memberId) as { direction: GateDirection; created_at: string } | undefined;
}

export function isInside(db: Db, memberId: number, now: Date): boolean {
  const last = lastGrantedCheckin(db, memberId);
  return last?.direction === 'in' && last.created_at > hoursAgo(now, INSIDE_TIMEOUT_HOURS);
}

export function insideCount(db: Db, now: Date): number {
  // SQLite returns the bare `direction` from the row that holds MAX(created_at).
  const row = db
    .prepare(
      `SELECT COUNT(*) AS n FROM (
         SELECT member_id, direction, MAX(created_at) AS at FROM checkins
         WHERE result = 'granted' AND created_at > ?
         GROUP BY member_id
       ) WHERE direction = 'in'`,
    )
    .get(hoursAgo(now, INSIDE_TIMEOUT_HOURS)) as { n: number };
  return row.n;
}

// ---------------------------------------------------------------------------
// Checkins
// ---------------------------------------------------------------------------

export function insertCheckin(
  db: Db,
  input: { memberId: number | null; direction: GateDirection | null; reason: GateDenyReason | null; at: Date },
): number {
  const result = db
    .prepare(
      `INSERT INTO checkins (member_id, direction, result, reason, created_at)
       VALUES (:memberId, :direction, :result, :reason, :createdAt)`,
    )
    .run({
      memberId: input.memberId,
      direction: input.direction,
      result: input.reason ? 'denied' : 'granted',
      reason: input.reason,
      createdAt: input.at.toISOString(),
    });
  return Number(result.lastInsertRowid);
}

const CHECKIN_SELECT = `
  SELECT c.id, c.created_at, c.direction, c.result, c.reason, c.member_id, mb.full_name,
    (SELECT p.name FROM memberships ms JOIN plans p ON p.id = ms.plan_id
      WHERE ms.member_id = c.member_id AND ms.starts_on <= :today
      ORDER BY ms.ends_on DESC, ms.id DESC LIMIT 1) AS plan_name,
    (SELECT ms.ends_on FROM memberships ms
      WHERE ms.member_id = c.member_id AND ms.starts_on <= :today
      ORDER BY ms.ends_on DESC, ms.id DESC LIMIT 1) AS ends_on
  FROM checkins c LEFT JOIN members mb ON mb.id = c.member_id`;

function toCheckinDto(row: CheckinJoinRow, today: string): CheckinDto {
  return {
    id: row.id,
    at: row.created_at,
    direction: row.direction,
    result: row.result,
    reason: row.reason,
    member:
      row.member_id !== null && row.full_name !== null
        ? {
            id: row.member_id,
            fullName: row.full_name,
            initials: initials(row.full_name),
            planName: row.plan_name,
            daysLeft: row.ends_on ? daysLeft(row.ends_on, today) : null,
          }
        : null,
  };
}

export function getCheckin(db: Db, id: number, today: string): CheckinDto | undefined {
  const row = db.prepare(`${CHECKIN_SELECT} WHERE c.id = :id`).get({ id, today }) as CheckinJoinRow | undefined;
  return row ? toCheckinDto(row, today) : undefined;
}

export function recentCheckins(db: Db, limit: number, today: string): CheckinDto[] {
  const rows = db
    .prepare(`${CHECKIN_SELECT} ORDER BY c.created_at DESC, c.id DESC LIMIT :limit`)
    .all({ limit, today }) as unknown as CheckinJoinRow[];
  return rows.map((row) => toCheckinDto(row, today));
}

export function checkinCountsSince(db: Db, sinceIso: string): { granted: number; denied: number } {
  const row = db
    .prepare(
      `SELECT
         COALESCE(SUM(CASE WHEN result = 'granted' AND direction = 'in' THEN 1 ELSE 0 END), 0) AS granted,
         COALESCE(SUM(CASE WHEN result = 'denied' THEN 1 ELSE 0 END), 0) AS denied
       FROM checkins WHERE created_at >= ?`,
    )
    .get(sinceIso) as { granted: number; denied: number };
  return row;
}
