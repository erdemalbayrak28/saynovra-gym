import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { createGateCode, type LiveEvent, type MemberDetail, type MemberListItem, type PlanDto, type ReceptionSummary } from '../../shared/contract.ts';
import { createApp } from '../src/app.ts';
import { gateSigner, issueToken, type AuthClaims } from '../src/auth.ts';
import type { Config } from '../src/config.ts';
import type { Db } from '../src/db.ts';
import { scanGateCode } from '../src/domain/gate.ts';
import type { LiveHub } from '../src/live.ts';
import { currentMembership, presenceSeq } from '../src/queries.ts';
import {
  cancelMembership,
  expiringMembers,
  freezeMembership,
  memberDetail,
  receptionSummary,
  searchMembers,
  sellMembership,
  unfreezeMembership,
  type StaffAction,
} from '../src/reception.ts';
import { addDays, localDate, startOfLocalDay } from '../src/time.ts';
import { TZ, addMember, addMembership, testDb } from './helpers.ts';

const NOW = new Date('2026-11-09T15:00:00Z');
const TODAY = localDate(NOW, TZ);
const DAY_MS = 24 * 60 * 60 * 1000;
const OWNER_ID = 1;
const DESK_ID = 2;

function gym() {
  const db = testDb();
  const stamp = NOW.toISOString();
  db.prepare(
    "INSERT INTO staff (name, role, pin_hash, created_at, modified_at) VALUES ('Salon Sahibi', 'owner', 'x', ?, ?), ('Gişe', 'desk', 'x', ?, ?)",
  ).run(stamp, stamp, stamp, stamp);
  const plan = (name: string, days: number, priceKurus: number, freezeDays: number) =>
    Number(
      db
        .prepare('INSERT INTO plans (name, duration_days, price_kurus, freeze_days_allowed, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)')
        .run(name, days, priceKurus, freezeDays, stamp, stamp).lastInsertRowid,
    );
  return { db, monthly: plan('Aylık', 30, 150_000, 0), quarterly: plan('3 Aylık', 90, 390_000, 15) };
}

const at = (daysLater: number, staffId = DESK_ID): StaffAction => {
  const now = new Date(NOW.getTime() + daysLater * DAY_MS);
  return { staffId, now, today: localDate(now, TZ) };
};

const membershipRow = (db: Db, id: number) =>
  db.prepare('SELECT starts_on, ends_on, status, frozen_from, freeze_days_used, modified_by FROM memberships WHERE id = ?').get(id) as {
    starts_on: string;
    ends_on: string;
    status: string;
    frozen_from: string | null;
    freeze_days_used: number;
    modified_by: number | null;
  };

const names = (items: MemberListItem[]) => items.map((item) => item.fullName);

describe('reception', () => {
  it('finds members by name in any case, with or without Turkish letters, and by phone', () => {
    const { db } = gym();
    addMember(db, '5551112233', undefined, 'İrem Şahin');
    addMember(db, '5552223344', undefined, 'Irmak Işık');
    addMember(db, '5553334455', undefined, 'Ali Veli');

    assert.deepEqual(names(searchMembers(db, 'irem', TODAY, NOW)), ['İrem Şahin']);
    assert.deepEqual(names(searchMembers(db, 'ŞAHİN', TODAY, NOW)), ['İrem Şahin']);
    assert.deepEqual(names(searchMembers(db, 'sahin', TODAY, NOW)), ['İrem Şahin']);
    assert.deepEqual(names(searchMembers(db, 'ışık', TODAY, NOW)), ['Irmak Işık']);
    assert.deepEqual(names(searchMembers(db, 'IRMAK', TODAY, NOW)), ['Irmak Işık']);
    // Names starting with the query come before names that only contain it.
    assert.deepEqual(names(searchMembers(db, 'ir', TODAY, NOW)), ['Irmak Işık', 'İrem Şahin']);
    assert.deepEqual(names(searchMembers(db, '0555 333', TODAY, NOW)), ['Ali Veli']);
    assert.deepEqual(names(searchMembers(db, '+90 555 222 33 44', TODAY, NOW)), ['Irmak Işık']);
    // LIKE wildcards are searched for literally.
    assert.deepEqual(searchMembers(db, '_r', TODAY, NOW), []);
    assert.deepEqual(searchMembers(db, '%%', TODAY, NOW), []);
  });

  it('lists memberships that end within a week and leaves out the renewed ones', () => {
    const { db, monthly } = gym();
    const soon = addMember(db, '5550000010', undefined, 'Biten Üye').id;
    const renewed = addMember(db, '5550000011', undefined, 'Yenileyen Üye').id;
    const later = addMember(db, '5550000012', undefined, 'Uzun Üye').id;
    addMembership(db, soon, monthly, NOW, { endOffsetDays: 3 });
    addMembership(db, renewed, monthly, NOW, { endOffsetDays: 2 });
    addMembership(db, later, monthly, NOW, { endOffsetDays: 20 });
    sellMembership(db, renewed, { planId: monthly, method: 'card' }, at(0));

    const list = expiringMembers(db, TODAY, NOW);
    assert.deepEqual(names(list), ['Biten Üye']);
    assert.equal(list[0]?.membership?.daysLeft, 3);
    assert.equal(receptionSummary(db, TODAY, startOfLocalDay(NOW, TZ)).expiringSoon, 1);
  });

  it('sells a first package from today and a renewal straight after the running one', () => {
    const { db, monthly, quarterly } = gym();
    const fresh = addMember(db, '5550000020', undefined, 'Yeni Üye').id;
    const first = sellMembership(db, fresh, { planId: monthly, method: 'cash' }, at(0));
    assert.deepEqual(
      { starts: membershipRow(db, first).starts_on, ends: membershipRow(db, first).ends_on },
      { starts: TODAY, ends: addDays(TODAY, 29) },
    );

    const renewal = sellMembership(db, fresh, { planId: quarterly, method: 'card' }, at(0));
    assert.equal(membershipRow(db, renewal).starts_on, addDays(TODAY, 30));
    assert.equal(membershipRow(db, renewal).ends_on, addDays(TODAY, 119));

    const detail = memberDetail(db, fresh, TODAY, NOW);
    assert.equal(detail.current?.id, first);
    assert.equal(detail.memberships[0]?.upcoming, true);
    assert.deepEqual(
      detail.history.map((event) => [event.type, event.planName, event.amountKurus, event.method, event.staffName]),
      [
        ['sale', '3 Aylık', 390_000, 'card', 'Gişe'],
        ['sale', 'Aylık', 150_000, 'cash', 'Gişe'],
      ],
    );

    // A lapsed member's new package starts today, not after the old end date.
    const lapsed = addMember(db, '5550000021', undefined, 'Dönen Üye').id;
    addMembership(db, lapsed, monthly, NOW, { startOffsetDays: -40, endOffsetDays: -5 });
    const comeback = sellMembership(db, lapsed, { planId: monthly, method: 'transfer' }, at(0));
    assert.equal(membershipRow(db, comeback).starts_on, TODAY);
  });

  it('refuses a sale while frozen, for a package not on sale, or for a stranger', () => {
    const { db, monthly, quarterly } = gym();
    const member = addMember(db).id;
    addMembership(db, member, quarterly, NOW, { status: 'frozen' });
    assert.throws(() => sellMembership(db, member, { planId: monthly, method: 'cash' }, at(0)), /önce dondurmayı kaldırın/);

    db.prepare('UPDATE plans SET is_active = 0 WHERE id = ?').run(monthly);
    const other = addMember(db, '5550000030').id;
    assert.throws(() => sellMembership(db, other, { planId: monthly, method: 'cash' }, at(0)), /satışta değil/);
    assert.throws(() => sellMembership(db, 999, { planId: quarterly, method: 'cash' }, at(0)), /Üye bulunamadı/);
  });

  it('freezes only when the package allows it, and the frozen member is refused at the gate', () => {
    const { db, monthly, quarterly } = gym();
    const short = addMember(db, '5550000040').id;
    const shortMembership = addMembership(db, short, monthly, NOW);
    assert.throws(() => freezeMembership(db, shortMembership, at(0)), /Aylık pakette dondurma hakkı yok/);

    const { id: member, qrSecret } = addMember(db, '5550000041');
    const membership = addMembership(db, member, quarterly, NOW);
    freezeMembership(db, membership, at(0));
    assert.equal(membershipRow(db, membership).status, 'frozen');
    assert.equal(membershipRow(db, membership).frozen_from, TODAY);
    assert.equal(membershipRow(db, membership).modified_by, DESK_ID);
    assert.equal(currentMembership(db, member, TODAY)?.status, 'frozen');
    assert.throws(() => freezeMembership(db, membership, at(0)), /Dondurulmuş/);

    const code = createGateCode(member, 'in', presenceSeq(db, member), NOW.getTime(), gateSigner(qrSecret));
    const scan = scanGateCode(db, code, NOW, TZ);
    const { reason } = db.prepare('SELECT reason FROM checkins WHERE id = ?').get(scan.checkinId) as { reason: string };
    assert.equal(reason, 'membership_frozen');

    const upcoming = sellMembership(db, short, { planId: quarterly, method: 'card' }, at(0));
    assert.throws(() => freezeMembership(db, upcoming, at(0)), /başlamamış/);
  });

  it('adds the frozen days on unfreeze, within the allowance, and moves a renewal along', () => {
    const { db, quarterly } = gym();
    const member = addMember(db).id;
    const membership = addMembership(db, member, quarterly, NOW, { endOffsetDays: 80 });
    const renewal = sellMembership(db, member, { planId: quarterly, method: 'card' }, at(0));
    assert.equal(membershipRow(db, renewal).starts_on, addDays(TODAY, 81));

    freezeMembership(db, membership, at(0));
    unfreezeMembership(db, membership, at(5));
    assert.equal(membershipRow(db, membership).ends_on, addDays(TODAY, 85));
    assert.equal(membershipRow(db, membership).freeze_days_used, 5);
    assert.equal(membershipRow(db, renewal).starts_on, addDays(TODAY, 86));

    // 20 more days frozen, but only 10 of the 15 allowed days are left.
    freezeMembership(db, membership, at(10));
    unfreezeMembership(db, membership, at(30));
    assert.equal(membershipRow(db, membership).ends_on, addDays(TODAY, 95));
    assert.equal(membershipRow(db, membership).freeze_days_used, 15);
    assert.equal(membershipRow(db, renewal).starts_on, addDays(TODAY, 96));
    assert.throws(() => freezeMembership(db, membership, at(31)), /dondurma hakkı bitti/);

    const credited = memberDetail(db, member, at(31).today, at(31).now)
      .history.filter((event) => event.type === 'unfreeze')
      .map((event) => event.days);
    assert.deepEqual(credited, [10, 5]);
  });

  it('cancels active, frozen and upcoming memberships, but not expired ones', () => {
    const { db, monthly, quarterly } = gym();
    const member = addMember(db).id;
    const frozen = addMembership(db, member, quarterly, NOW);
    freezeMembership(db, frozen, at(0));
    cancelMembership(db, frozen, at(0, OWNER_ID));
    assert.equal(membershipRow(db, frozen).status, 'cancelled');
    assert.equal(membershipRow(db, frozen).frozen_from, null);
    assert.throws(() => unfreezeMembership(db, frozen, at(1)), /İptal edildi/);

    const upcoming = sellMembership(db, member, { planId: monthly, method: 'cash' }, at(0));
    assert.doesNotThrow(() => cancelMembership(db, upcoming, at(0, OWNER_ID)));

    const lapsed = addMember(db, '5550000050').id;
    const old = addMembership(db, lapsed, monthly, NOW, { startOffsetDays: -40, endOffsetDays: -1 });
    assert.throws(() => cancelMembership(db, old, at(0, OWNER_ID)), /Süresi dolmuş/);
  });

  it('keeps the history append-only', () => {
    const { db, monthly } = gym();
    const member = addMember(db).id;
    sellMembership(db, member, { planId: monthly, method: 'cash' }, at(0));
    assert.throws(() => db.prepare("UPDATE membership_events SET type = 'cancel'").run(), /append-only/);
    assert.throws(() => db.prepare('DELETE FROM membership_events').run(), /append-only/);
  });

  it("adds up today's takings by payment method and counts the member base", () => {
    const { db, monthly, quarterly } = gym();
    const a = addMember(db, '5550000060').id;
    const b = addMember(db, '5550000061').id;
    const c = addMember(db, '5550000062').id;
    const d = addMember(db, '5550000063').id;
    sellMembership(db, a, { planId: monthly, method: 'cash' }, at(-1));
    sellMembership(db, b, { planId: monthly, method: 'card' }, at(0));
    sellMembership(db, c, { planId: quarterly, method: 'card' }, at(0));
    freezeMembership(db, sellMembership(db, d, { planId: quarterly, method: 'transfer' }, at(-31)), at(-31));

    const summary = receptionSummary(db, TODAY, startOfLocalDay(NOW, TZ));
    assert.equal(summary.todaySales, 2);
    assert.equal(summary.todayRevenueKurus, 540_000);
    assert.deepEqual(summary.byMethod, { cash: 0, card: 540_000, transfer: 0 });
    assert.equal(summary.activeMembers, 3);
    assert.equal(summary.frozenMembers, 1);
  });
});

describe('reception API', () => {
  const config: Config = {
    PORT: 0,
    JWT_SECRET: 'test-secret-that-is-at-least-32-characters-long',
    DB_PATH: ':memory:',
    GYM_CAPACITY: 85,
    GYM_TIMEZONE: TZ,
    DEMO_SIMULATION: false,
    DEMO_MIN_INSIDE: 12,
  };
  const published: { event: LiveEvent; audience: (claims: AuthClaims) => boolean }[] = [];
  const live = { publish: (event: LiveEvent, audience: (claims: AuthClaims) => boolean) => published.push({ event, audience }) };
  const { db, quarterly } = gym();
  const app = createApp({ db, config, live: live as unknown as LiveHub, now: () => NOW });
  const member = addMember(db, '5551112233', undefined, 'İrem Şahin').id;
  const membership = addMembership(db, member, quarterly, NOW);

  const as = async (claims: AuthClaims) => ({ Authorization: `Bearer ${await issueToken(config.JWT_SECRET, claims)}` });
  const post = async (path: string, claims: AuthClaims, body?: unknown) =>
    app.request(path, {
      method: 'POST',
      headers: { ...(await as(claims)), 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });

  it('serves search, call list, packages and summary to staff only', async () => {
    const desk = await as({ sub: DESK_ID, role: 'desk' });
    const found = (await (await app.request('/staff/members?q=irem', { headers: desk })).json()) as MemberListItem[];
    assert.deepEqual(names(found), ['İrem Şahin']);
    assert.equal(found[0]?.membership?.planName, '3 Aylık');
    assert.equal((await app.request('/staff/members?q=i', { headers: desk })).status, 400);
    assert.equal((await app.request('/staff/members/expiring', { headers: desk })).status, 200);
    const plans = (await (await app.request('/staff/plans', { headers: desk })).json()) as PlanDto[];
    assert.deepEqual(plans.map((p) => p.name), ['Aylık', '3 Aylık']);
    assert.equal((await app.request('/staff/members/999', { headers: desk })).status, 404);
    assert.equal((await app.request('/staff/members/abc', { headers: desk })).status, 400);

    const asMember = await as({ sub: member, role: 'member' });
    assert.equal((await app.request('/staff/members?q=irem', { headers: asMember })).status, 403);
    assert.equal((await app.request('/staff/plans')).status, 401);
  });

  it('lets the desk sell and freeze, keeps cancelling for the owner, and pushes every change', async () => {
    const plans = (await (await app.request('/staff/plans', { headers: await as({ sub: DESK_ID, role: 'desk' }) })).json()) as PlanDto[];
    const monthly = plans.find((p) => p.name === 'Aylık');
    assert.ok(monthly);

    const sale = await post(`/staff/members/${member}/memberships`, { sub: DESK_ID, role: 'desk' }, { planId: monthly.id, method: 'card' });
    assert.equal(sale.status, 201);
    const afterSale = (await sale.json()) as MemberDetail;
    assert.equal(afterSale.memberships.length, 2);
    assert.equal((await post(`/staff/members/${member}/memberships`, { sub: DESK_ID, role: 'desk' }, { planId: monthly.id, method: 'gold' })).status, 400);

    const frozen = await post(`/staff/memberships/${membership}/freeze`, { sub: DESK_ID, role: 'desk' });
    assert.equal(((await frozen.json()) as MemberDetail).current?.status, 'frozen');

    const denied = await post(`/staff/memberships/${membership}/cancel`, { sub: DESK_ID, role: 'desk' });
    assert.equal(denied.status, 403);
    const cancelled = await post(`/staff/memberships/${membership}/cancel`, { sub: OWNER_ID, role: 'owner' });
    assert.equal(((await cancelled.json()) as MemberDetail).current?.status, 'cancelled');

    const changes = published.filter((p) => p.event.type === 'membership');
    assert.equal(changes.length, 3);
    const audience = changes[0]?.audience;
    assert.ok(audience);
    assert.equal(audience({ sub: member, role: 'member' }), true);
    assert.equal(audience({ sub: member + 1, role: 'member' }), false);
    assert.equal(audience({ sub: DESK_ID, role: 'desk' }), true);
    // A member whose id equals a staff id does not receive another member's change.
    assert.equal(audience({ sub: DESK_ID, role: 'member' }), member === DESK_ID);

    const summary = (await (await app.request('/staff/reception/summary', { headers: await as({ sub: OWNER_ID, role: 'owner' }) })).json()) as ReceptionSummary;
    assert.equal(summary.todaySales, 1);
    assert.equal(summary.byMethod.card, 150_000);
  });
});
