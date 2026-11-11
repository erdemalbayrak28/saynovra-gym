import {
  EXPIRING_WITHIN_DAYS,
  type AccountRole,
  MEMBERSHIP_STATUS_TEXT,
  type MemberDetail,
  type MemberListItem,
  type MembershipDetail,
  type MembershipEventDto,
  type MembershipEventType,
  type MembershipStatus,
  type PaymentMethod,
  type PersonRef,
  type PlanDto,
  type ReceptionSummary,
  type SellMembershipRequest,
  type TrainerOption,
} from '../../shared/contract.ts';
import { searchFold, transaction, type Db } from './db.ts';
import { daysLeft, effectiveStatus, nextStatus, type MembershipEvent } from './domain/membership.ts';
import { HttpProblem } from './problem.ts';
import { initials, insideMemberIds, isInside, memberConsents, openActivationExpiry, personRef } from './queries.ts';
import { addDays, daysBetween, hoursAgo } from './time.ts';

const LIST_LIMIT = 20;
const HISTORY_LIMIT = 30;
const VISIT_WINDOW_HOURS = 30 * 24;
// SQLite sorts bytes ("İrem" after "Sinan"); lists are re-sorted in Turkish alphabetical order.
const turkish = new Intl.Collator('tr', { sensitivity: 'base' });

/** Who acts and when; every reception change is attributed to a staff member. */
export interface StaffAction {
  staffId: number;
  now: Date;
  today: string;
}

// ---------------------------------------------------------------------------
// Reading
// ---------------------------------------------------------------------------

// The membership that governs a member's day: the latest-ending one that has started. Same rule
// as queries.currentMembership, computed for every member in one pass.
const GOVERNING_CTE = `
  governing AS (
    SELECT ms.member_id, p.name AS plan_name, ms.starts_on, ms.ends_on, ms.status,
      ROW_NUMBER() OVER (PARTITION BY ms.member_id ORDER BY ms.ends_on DESC, ms.id DESC) AS rank
    FROM memberships ms JOIN plans p ON p.id = ms.plan_id
    WHERE ms.starts_on <= :today
  )`;

const LIST_SELECT = `
  WITH ${GOVERNING_CTE}
  SELECT m.id, m.role, m.trainer_id, m.full_name, m.phone, m.birth_year, m.created_at, m.activated_at, g.plan_name, g.starts_on, g.ends_on, g.status
  FROM members m LEFT JOIN governing g ON g.member_id = m.id AND g.rank = 1`;

// An active membership with no renewal sold after it.
const NO_RENEWAL = `NOT EXISTS (
  SELECT 1 FROM memberships later
  WHERE later.member_id = m.id AND later.starts_on > :today AND later.status = 'active')`;

interface ListRow {
  id: number;
  role: AccountRole;
  trainer_id: number | null;
  full_name: string;
  phone: string;
  birth_year: number | null;
  created_at: string;
  activated_at: string | null;
  plan_name: string | null;
  starts_on: string | null;
  ends_on: string | null;
  status: MembershipStatus | null;
}

interface MembershipRow {
  id: number;
  member_id: number;
  plan_name: string;
  starts_on: string;
  ends_on: string;
  status: MembershipStatus;
  frozen_from: string | null;
  freeze_days_used: number;
  freeze_days_allowed: number;
  price_kurus: number;
}

const MEMBERSHIP_SELECT = `
  SELECT ms.id, ms.member_id, p.name AS plan_name, ms.starts_on, ms.ends_on, ms.status, ms.frozen_from,
    ms.freeze_days_used, p.freeze_days_allowed, ms.price_kurus
  FROM memberships ms JOIN plans p ON p.id = ms.plan_id`;

function toListItem(row: ListRow, today: string, inside: boolean): MemberListItem {
  const { plan_name: planName, starts_on: startsOn, ends_on: endsOn, status } = row;
  return {
    id: row.id,
    role: row.role,
    fullName: row.full_name,
    phone: row.phone,
    initials: initials(row.full_name),
    membership:
      planName && startsOn && endsOn && status
        ? { planName, status: effectiveStatus(status, endsOn, today), startsOn, endsOn, daysLeft: daysLeft(endsOn, today) }
        : null,
    isInside: inside,
    activated: row.activated_at !== null,
  };
}

function toMembershipDetail(row: MembershipRow, today: string): MembershipDetail {
  return {
    id: row.id,
    planName: row.plan_name,
    status: effectiveStatus(row.status, row.ends_on, today),
    startsOn: row.starts_on,
    endsOn: row.ends_on,
    daysLeft: daysLeft(row.ends_on, today),
    priceKurus: row.price_kurus,
    freezeDaysAllowed: row.freeze_days_allowed,
    freezeDaysUsed: row.freeze_days_used,
    frozenFrom: row.frozen_from,
    upcoming: row.starts_on > today,
  };
}

/** LIKE treats % and _ as wildcards; a search for "%" must not list everyone. */
function escapeLike(text: string): string {
  return text.replace(/[\\%_]/g, (char) => `\\${char}`);
}

/** Phone digits in the stored national form ("0555..." and "90555..." both become "555..."), or null. */
function phoneDigits(query: string): string | null {
  let digits = query.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('90')) digits = digits.slice(2);
  else if (digits.startsWith('0')) digits = digits.slice(1);
  return digits.length >= 3 ? digits : null;
}

/** By name (any case, with or without Turkish letters) or phone digits; names that start with the query come first. */
export function searchMembers(db: Db, query: string, today: string, now: Date): MemberListItem[] {
  const text = escapeLike(searchFold(query.trim()));
  const digits = phoneDigits(query);
  const rows = db
    .prepare(
      `${LIST_SELECT}
       WHERE search_fold(m.full_name) LIKE :contains ESCAPE '\\'
          OR (:digits IS NOT NULL AND m.phone LIKE :phone ESCAPE '\\')
       ORDER BY search_fold(m.full_name) LIKE :prefix ESCAPE '\\' DESC, m.full_name, m.id
       LIMIT :limit`,
    )
    .all({ today, contains: `%${text}%`, prefix: `${text}%`, digits, phone: digits ? `%${digits}%` : null, limit: LIST_LIMIT }) as unknown as ListRow[];
  const plain = searchFold(query.trim());
  const startsWith = (row: ListRow) => (searchFold(row.full_name).startsWith(plain) ? 0 : 1);
  const inside = insideMemberIds(db, now);
  return rows
    .toSorted((a, b) => startsWith(a) - startsWith(b) || turkish.compare(a.full_name, b.full_name))
    .map((row) => toListItem(row, today, inside.has(row.id)));
}

/** Active memberships that end within the window and have no renewal yet: the desk's call list. */
export function expiringMembers(db: Db, today: string, now: Date): MemberListItem[] {
  const rows = db
    .prepare(
      `${LIST_SELECT}
       WHERE g.status = 'active' AND g.ends_on BETWEEN :today AND :until AND ${NO_RENEWAL}
       ORDER BY g.ends_on, m.full_name, m.id
       LIMIT :limit`,
    )
    .all({ today, until: addDays(today, EXPIRING_WITHIN_DAYS), limit: LIST_LIMIT }) as unknown as ListRow[];
  const inside = insideMemberIds(db, now);
  return rows
    .toSorted((a, b) => (a.ends_on ?? '').localeCompare(b.ends_on ?? '') || turkish.compare(a.full_name, b.full_name))
    .map((row) => toListItem(row, today, inside.has(row.id)));
}

export function memberDetail(db: Db, memberId: number, today: string, now: Date): MemberDetail {
  const row = db.prepare(`${LIST_SELECT} WHERE m.id = :id`).get({ today, id: memberId }) as ListRow | undefined;
  if (!row) throw new HttpProblem(404, 'Üye bulunamadı');

  const memberships = (
    db.prepare(`${MEMBERSHIP_SELECT} WHERE ms.member_id = ? ORDER BY ms.starts_on DESC, ms.id DESC`).all(memberId) as unknown as MembershipRow[]
  ).map((membership) => toMembershipDetail(membership, today));
  const governing = memberships
    .filter((membership) => !membership.upcoming)
    .reduce<MembershipDetail | null>((best, m) => (!best || m.endsOn > best.endsOn || (m.endsOn === best.endsOn && m.id > best.id) ? m : best), null);

  const visits = db
    .prepare(
      `SELECT COUNT(*) AS recent,
         (SELECT MAX(created_at) FROM checkins WHERE member_id = :id AND result = 'granted' AND direction = 'in') AS last
       FROM checkins WHERE member_id = :id AND result = 'granted' AND direction = 'in' AND created_at >= :since`,
    )
    .get({ id: memberId, since: hoursAgo(now, VISIT_WINDOW_HOURS) }) as { recent: number; last: string | null };

  return {
    member: toListItem(row, today, isInside(db, memberId, now)),
    birthYear: row.birth_year,
    joinedAt: row.created_at,
    lastVisitAt: visits.last,
    visitsLast30Days: visits.recent,
    current: governing,
    memberships,
    history: membershipHistory(db, memberId),
    activatedAt: row.activated_at,
    activationExpiresAt: openActivationExpiry(db, memberId, now),
    consents: memberConsents(db, memberId),
    trainer: personRef(db, row.trainer_id),
    trainees: row.role === 'trainer' ? traineesOf(db, memberId) : [],
  };
}

function traineesOf(db: Db, trainerId: number): PersonRef[] {
  const rows = db.prepare('SELECT id, full_name FROM members WHERE trainer_id = ?').all(trainerId) as unknown as { id: number; full_name: string }[];
  return rows.toSorted((a, b) => turkish.compare(a.full_name, b.full_name)).map((row) => ({ id: row.id, fullName: row.full_name }));
}

/** Trainer accounts, for the "assign a trainer" list. */
export function listTrainers(db: Db): TrainerOption[] {
  const rows = db
    .prepare(
      `SELECT t.id, t.full_name, (SELECT COUNT(*) FROM members m WHERE m.trainer_id = t.id) AS trainee_count
       FROM members t WHERE t.role = 'trainer'`,
    )
    .all() as unknown as { id: number; full_name: string; trainee_count: number }[];
  return rows
    .toSorted((a, b) => turkish.compare(a.full_name, b.full_name))
    .map((row) => ({ id: row.id, fullName: row.full_name, traineeCount: row.trainee_count }));
}

/** Gives a member a trainer, or takes it away (null). Returns the previous trainer id. */
export function assignTrainer(db: Db, memberId: number, trainerId: number | null, action: StaffAction): number | null {
  return transaction(db, () => {
    const member = db.prepare('SELECT role, trainer_id FROM members WHERE id = ?').get(memberId) as
      | { role: AccountRole; trainer_id: number | null }
      | undefined;
    if (!member) throw new HttpProblem(404, 'Üye bulunamadı');
    if (member.role !== 'member') throw new HttpProblem(409, 'Atanamadı', 'Eğitmen hesabına eğitmen atanamaz');
    if (trainerId !== null) {
      const trainer = db.prepare('SELECT role FROM members WHERE id = ?').get(trainerId) as { role: AccountRole } | undefined;
      if (trainer?.role !== 'trainer') throw new HttpProblem(404, 'Eğitmen bulunamadı');
    }
    db.prepare('UPDATE members SET trainer_id = ?, modified_at = ?, modified_by = ? WHERE id = ?').run(
      trainerId,
      action.now.toISOString(),
      action.staffId,
      memberId,
    );
    return member.trainer_id;
  });
}

interface EventRow {
  id: number;
  membership_id: number;
  type: MembershipEventType;
  created_at: string;
  days: number | null;
  plan_name: string;
  staff_name: string | null;
  amount_kurus: number | null;
  method: PaymentMethod | null;
}

function membershipHistory(db: Db, memberId: number): MembershipEventDto[] {
  const rows = db
    .prepare(
      `SELECT e.id, e.membership_id, e.type, e.created_at, e.days, p.name AS plan_name, s.name AS staff_name,
         pay.amount_kurus, pay.method
       FROM membership_events e
       JOIN memberships ms ON ms.id = e.membership_id
       JOIN plans p ON p.id = ms.plan_id
       LEFT JOIN staff s ON s.id = e.created_by
       LEFT JOIN payments pay ON pay.id = e.payment_id
       WHERE ms.member_id = ?
       ORDER BY e.id DESC LIMIT ?`,
    )
    .all(memberId, HISTORY_LIMIT) as unknown as EventRow[];
  return rows.map((row) => ({
    id: row.id,
    membershipId: row.membership_id,
    type: row.type,
    at: row.created_at,
    planName: row.plan_name,
    staffName: row.staff_name,
    days: row.days,
    amountKurus: row.amount_kurus,
    method: row.method,
  }));
}

export function listPlans(db: Db): PlanDto[] {
  const rows = db
    .prepare('SELECT id, name, duration_days, price_kurus, freeze_days_allowed FROM plans WHERE is_active = 1 ORDER BY duration_days')
    .all() as unknown as { id: number; name: string; duration_days: number; price_kurus: number; freeze_days_allowed: number }[];
  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    durationDays: row.duration_days,
    priceKurus: row.price_kurus,
    freezeDaysAllowed: row.freeze_days_allowed,
  }));
}

export function receptionSummary(db: Db, today: string, dayStart: string): ReceptionSummary {
  const byMethod: Record<PaymentMethod, number> = { cash: 0, card: 0, transfer: 0 };
  let todayRevenueKurus = 0;
  let todaySales = 0;
  const takings = db
    .prepare('SELECT method, SUM(amount_kurus) AS total, COUNT(*) AS n FROM payments WHERE created_at >= ? GROUP BY method')
    .all(dayStart) as unknown as { method: PaymentMethod; total: number; n: number }[];
  for (const row of takings) {
    byMethod[row.method] = row.total;
    todayRevenueKurus += row.total;
    todaySales += row.n;
  }

  const counts = db
    .prepare(
      `WITH ${GOVERNING_CTE}
       SELECT
         COALESCE(SUM(g.status = 'active' AND g.ends_on >= :today), 0) AS active,
         COALESCE(SUM(g.status = 'frozen'), 0) AS frozen,
         COALESCE(SUM(g.status = 'active' AND g.ends_on BETWEEN :today AND :until AND ${NO_RENEWAL}), 0) AS expiring
       FROM governing g JOIN members m ON m.id = g.member_id
       WHERE g.rank = 1`,
    )
    .get({ today, until: addDays(today, EXPIRING_WITHIN_DAYS) }) as { active: number; frozen: number; expiring: number };

  return {
    todayRevenueKurus,
    todaySales,
    byMethod,
    activeMembers: counts.active,
    frozenMembers: counts.frozen,
    expiringSoon: counts.expiring,
  };
}

// ---------------------------------------------------------------------------
// Changing (each in one transaction, each leaving a history row)
// ---------------------------------------------------------------------------

function loadMembership(db: Db, membershipId: number): MembershipRow {
  const row = db.prepare(`${MEMBERSHIP_SELECT} WHERE ms.id = ?`).get(membershipId) as MembershipRow | undefined;
  if (!row) throw new HttpProblem(404, 'Üyelik bulunamadı');
  return row;
}

/** Asks the membership state machine; anything it does not allow is refused. */
function transition(row: MembershipRow, event: MembershipEvent, today: string): MembershipStatus {
  const current = effectiveStatus(row.status, row.ends_on, today);
  const next = nextStatus(current, event);
  if (!next) {
    throw new HttpProblem(409, 'İşlem yapılamadı', `Durumu "${MEMBERSHIP_STATUS_TEXT[current]}" olan bir üyelikte bu işlem yapılamaz`);
  }
  return next;
}

function recordEvent(
  db: Db,
  input: { membershipId: number; type: MembershipEventType; days?: number; paymentId?: number; action: Pick<StaffAction, 'now'> & { staffId: number | null } },
): void {
  db.prepare(
    `INSERT INTO membership_events (membership_id, type, days, payment_id, created_at, created_by)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(input.membershipId, input.type, input.days ?? null, input.paymentId ?? null, input.action.now.toISOString(), input.action.staffId);
}

/**
 * Sells a package. A member with time left gets the new package straight after it (a renewal);
 * otherwise it starts today. A frozen membership has no fixed end yet, so it must be unfrozen first.
 * Returns the new membership id.
 */
export function sellMembership(db: Db, memberId: number, request: SellMembershipRequest, action: StaffAction): number {
  return transaction(db, () => insertSale(db, memberId, request, action));
}

/** The sale itself, for callers already inside a transaction (new member with a first package). */
export function insertSale(db: Db, memberId: number, request: SellMembershipRequest, action: StaffAction): number {
  const buyer = db.prepare('SELECT role FROM members WHERE id = ?').get(memberId) as { role: AccountRole } | undefined;
  if (!buyer) throw new HttpProblem(404, 'Üye bulunamadı');
  if (buyer.role !== 'member') throw new HttpProblem(409, 'Satış yapılamadı', 'Eğitmen hesabına paket satılmaz');
  const plan = db
    .prepare('SELECT id, duration_days, price_kurus FROM plans WHERE id = ? AND is_active = 1')
    .get(request.planId) as { id: number; duration_days: number; price_kurus: number } | undefined;
  if (!plan) throw new HttpProblem(404, 'Paket bulunamadı', 'Bu paket satışta değil');
  if (db.prepare("SELECT 1 FROM memberships WHERE member_id = ? AND status = 'frozen'").get(memberId)) {
    throw new HttpProblem(409, 'Satış yapılamadı', 'Dondurulmuş üyelik varken yeni paket satılamaz; önce dondurmayı kaldırın');
  }

  const { last } = db
    .prepare("SELECT MAX(ends_on) AS last FROM memberships WHERE member_id = ? AND status = 'active'")
    .get(memberId) as { last: string | null };
  const startsOn = last && last >= action.today ? addDays(last, 1) : action.today;
  const endsOn = addDays(startsOn, plan.duration_days - 1);
  const stamp = action.now.toISOString();

  const membership = db
    .prepare(
      `INSERT INTO memberships (member_id, plan_id, starts_on, ends_on, status, price_kurus, created_at, modified_at, created_by, modified_by)
       VALUES (?, ?, ?, ?, 'active', ?, ?, ?, ?, ?)`,
    )
    .run(memberId, plan.id, startsOn, endsOn, plan.price_kurus, stamp, stamp, action.staffId, action.staffId);
  const membershipId = Number(membership.lastInsertRowid);
  const payment = db
    .prepare('INSERT INTO payments (membership_id, amount_kurus, method, created_at, created_by) VALUES (?, ?, ?, ?, ?)')
    .run(membershipId, plan.price_kurus, request.method, stamp, action.staffId);
  recordEvent(db, { membershipId, type: 'sale', paymentId: Number(payment.lastInsertRowid), action });
  return membershipId;
}

/** Freezes the running membership if its package allows it. Returns the member id. */
export function freezeMembership(db: Db, membershipId: number, action: StaffAction): number {
  return transaction(db, () => {
    const row = loadMembership(db, membershipId);
    if (row.starts_on > action.today) throw new HttpProblem(409, 'Dondurulamadı', 'Henüz başlamamış bir üyelik dondurulamaz');
    transition(row, 'freeze', action.today);
    if (row.freeze_days_used >= row.freeze_days_allowed) {
      throw new HttpProblem(
        409,
        'Dondurulamadı',
        row.freeze_days_allowed === 0 ? `${row.plan_name} pakette dondurma hakkı yok` : 'Bu üyeliğin dondurma hakkı bitti',
      );
    }
    db.prepare(
      "UPDATE memberships SET status = 'frozen', frozen_from = ?, modified_at = ?, modified_by = ? WHERE id = ?",
    ).run(action.today, action.now.toISOString(), action.staffId, row.id);
    recordEvent(db, { membershipId: row.id, type: 'freeze', action });
    return row.member_id;
  });
}

/**
 * Ends a freeze. The frozen days are added to the end date, up to what the package still allows;
 * renewals sold in advance move by the same amount so memberships never overlap.
 * Returns the member id.
 */
export function unfreezeMembership(db: Db, membershipId: number, action: StaffAction): number {
  return transaction(db, () => {
    const row = loadMembership(db, membershipId);
    transition(row, 'unfreeze', action.today);
    applyUnfreeze(db, row, action);
    return row.member_id;
  });
}

/** The unfreeze itself; `staffId` is null when the server ends a freeze whose allowance ran out. */
function applyUnfreeze(db: Db, row: MembershipRow, action: { now: Date; today: string; staffId: number | null }): void {
  const frozenDays = Math.max(0, daysBetween(row.frozen_from ?? action.today, action.today));
  const credited = Math.min(frozenDays, Math.max(0, row.freeze_days_allowed - row.freeze_days_used));
  const stamp = action.now.toISOString();

  if (credited > 0) {
    db.prepare(
      `UPDATE memberships SET starts_on = date(starts_on, :shift), ends_on = date(ends_on, :shift), modified_at = :stamp, modified_by = :staffId
       WHERE member_id = :memberId AND id != :id AND status = 'active' AND starts_on > :oldEnd`,
    ).run({ shift: `+${credited} days`, stamp, staffId: action.staffId, memberId: row.member_id, id: row.id, oldEnd: row.ends_on });
  }
  db.prepare(
    `UPDATE memberships SET status = 'active', frozen_from = NULL, ends_on = ?, freeze_days_used = freeze_days_used + ?,
       modified_at = ?, modified_by = ?
     WHERE id = ?`,
  ).run(addDays(row.ends_on, credited), credited, stamp, action.staffId, row.id);
  recordEvent(db, { membershipId: row.id, type: 'unfreeze', days: credited, action });
}

// A freeze ends on its own on the day its allowance is used up. A frozen membership with no
// allowance left to count (the desk never creates one) is left for the desk to end.
const DUE_FREEZES = `${MEMBERSHIP_SELECT}
  WHERE ms.status = 'frozen'
    AND p.freeze_days_allowed > ms.freeze_days_used
    AND julianday(:today) - julianday(ms.frozen_from) >= p.freeze_days_allowed - ms.freeze_days_used`;

function unfreezeDue(db: Db, rows: MembershipRow[], clock: { now: Date; today: string }): number[] {
  for (const row of rows) applyUnfreeze(db, row, { ...clock, staffId: null });
  return rows.map((row) => row.member_id);
}

/**
 * Ends every freeze whose allowance has run out, exactly as the desk would (days credited,
 * renewals moved), recorded with no staff member. Returns the members whose membership changed.
 */
export function autoUnfreeze(db: Db, clock: { now: Date; today: string }): number[] {
  return transaction(db, () => unfreezeDue(db, db.prepare(DUE_FREEZES).all({ today: clock.today }) as unknown as MembershipRow[], clock));
}

/** The same for one member, inside the caller's transaction (the gate checks right before deciding). */
export function autoUnfreezeMember(db: Db, memberId: number, clock: { now: Date; today: string }): boolean {
  const rows = db.prepare(`${DUE_FREEZES} AND ms.member_id = :memberId`).all({ today: clock.today, memberId }) as unknown as MembershipRow[];
  return unfreezeDue(db, rows, clock).length > 0;
}

/** Cancels an active, frozen or upcoming membership. Returns the member id. */
export function cancelMembership(db: Db, membershipId: number, action: StaffAction): number {
  return transaction(db, () => {
    const row = loadMembership(db, membershipId);
    transition(row, 'cancel', action.today);
    db.prepare(
      "UPDATE memberships SET status = 'cancelled', frozen_from = NULL, modified_at = ?, modified_by = ? WHERE id = ?",
    ).run(action.now.toISOString(), action.staffId, row.id);
    recordEvent(db, { membershipId: row.id, type: 'cancel', action });
    return row.member_id;
  });
}
