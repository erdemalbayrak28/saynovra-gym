import { openDb, type Db } from '../src/db.ts';
import { newQrSecret } from '../src/auth.ts';
import { addDays, localDate } from '../src/time.ts';

export const TZ = 'Europe/Istanbul';
// Fast, fixed hash for fixtures; real hashing is covered by the API tests.
const FIXTURE_HASH = 'scrypt$00$00';

export function testDb(): Db {
  return openDb(':memory:');
}

export function addPlan(db: Db, name = 'Aylık', durationDays = 30): number {
  const now = new Date().toISOString();
  const result = db
    .prepare('INSERT INTO plans (name, duration_days, price_kurus, created_at, modified_at) VALUES (?, ?, ?, ?, ?)')
    .run(name, durationDays, 150_000, now, now);
  return Number(result.lastInsertRowid);
}

export function addMember(
  db: Db,
  phone = '5550000001',
  passwordHash = FIXTURE_HASH,
  fullName = 'Test Üye',
): { id: number; qrSecret: string } {
  const now = new Date().toISOString();
  const qrSecret = newQrSecret();
  const result = db
    .prepare(
      `INSERT INTO members (full_name, phone, password_hash, qr_secret, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?)`,
    )
    .run(fullName, phone, passwordHash, qrSecret, now, now);
  return { id: Number(result.lastInsertRowid), qrSecret };
}

/** Records a granted gate pass directly, bypassing codes. */
export function pass(db: Db, memberId: number, direction: 'in' | 'out', at: Date): void {
  db.prepare("INSERT INTO checkins (member_id, direction, result, created_at) VALUES (?, ?, 'granted', ?)").run(memberId, direction, at.toISOString());
}

export function addMembership(
  db: Db,
  memberId: number,
  planId: number,
  at: Date,
  options: { startOffsetDays?: number; endOffsetDays?: number; status?: 'active' | 'frozen' | 'cancelled' } = {},
): number {
  const today = localDate(at, TZ);
  const status = options.status ?? 'active';
  const now = at.toISOString();
  const result = db
    .prepare(
      `INSERT INTO memberships (member_id, plan_id, starts_on, ends_on, status, frozen_from, price_kurus, created_at, modified_at)
       VALUES (?, ?, ?, ?, ?, ?, 150000, ?, ?)`,
    )
    .run(
      memberId,
      planId,
      addDays(today, options.startOffsetDays ?? -10),
      addDays(today, options.endOffsetDays ?? 20),
      status,
      status === 'frozen' ? today : null,
      now,
      now,
    );
  return Number(result.lastInsertRowid);
}
