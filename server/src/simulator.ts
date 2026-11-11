// Demo mode (DEMO_SIMULATION=true): makes the local gym feel alive for rehearsals and filming.
// - Fictional members walk in and out, steering occupancy towards the historical profile for the
//   current hour (never below DEMO_MIN_INSIDE).
// - Four scripted buddies keep spotter posts open, accept requests and answer chats.
// - If the demo member opens a post, a buddy sends a request.
// It never moves the demo member, and everything goes through the same services and live events
// as real use, so the kiosk and phone cannot tell the difference.

import type { GymSpot, MuscleGroup } from '../../shared/contract.ts';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import { DEMO_MEMBER_PHONE } from './demo.ts';
import { isStaff } from './auth.ts';
import type { LiveHub } from './live.ts';
import { errorFields, log } from './log.ts';
import { hourlyProfile } from './occupancy.ts';
import { findMemberByPhone, getCheckin, insertCheckin, insideCount, insideMemberIds, lastGrantedCheckin } from './queries.ts';
import { actOnRequest, chat, leaveFloor, openPost, radar, sendMessage, sendRequest } from './social.ts';
import { publishMessage, publishSocialChange } from './social-events.ts';
import { localDate, localHour } from './time.ts';

const TICK_MS = 2000;
const CROWD_EVERY_TICKS = 8;
const POSTS_EVERY_TICKS = 5;
const MAX_MOVES_PER_ROUND = 3;
const MIN_STAY_MS = 20 * 60 * 1000;
const REPLY_DELAY_MS = 2500;
const APPROACH_AFTER_MS = 15_000;
const MAX_FOLLOW_UPS = 3;

interface BuddyScript {
  phone: string;
  muscleGroup: MuscleGroup;
  location: GymSpot;
  note: string;
  reply: string;
}

/** The four buddies from the founder's mockup, with lines in the brand voice. */
export const DEMO_BUDDIES: readonly BuddyScript[] = [
  { phone: '5550000002', muscleGroup: 'chest_back', location: 'Bench 2', note: 'Incline bench son iki sette ağır gireceğim, spotter lazım.', reply: "Süper, 2. bench'teyim. Isınma setim bitiyor, bekliyorum." },
  { phone: '5550000003', muscleGroup: 'chest_back', location: 'Kablo istasyonu', note: 'Aynı spliti çalışan varsa set aralarını soğutmadan beraber gidelim.', reply: 'Selam! Kablo istasyonunun yanındayım, gel beraber girelim.' },
  { phone: '5550000004', muscleGroup: 'legs', location: 'Squat rack 1', note: 'Squat 3x5 ağır sette yanlardan emniyet için spotter arıyorum.', reply: "Squat rack 1'de kemeri taktım, iki dakikaya başlıyorum." },
  { phone: '5550000005', muscleGroup: 'shoulders_arms', location: 'Serbest ağırlık', note: 'Shoulder press son sette yardım edebilecek biri arıyorum.', reply: 'Dumbbell rafının sağındayım, hemen geliyorum.' },
];

const FOLLOW_UPS = ['Tamam, bekliyorum.', 'Harika, ilk seti seninle girelim.', 'Ben hazırım, ne zaman istersen.'];

export interface SimulatorDeps {
  db: Db;
  live: LiveHub;
  config: Config;
  now: () => Date;
  random?: () => number;
}

export class DemoSimulator {
  #deps: SimulatorDeps;
  #random: () => number;
  #timer: NodeJS.Timeout | undefined;
  #ticks = 0;
  #demoMemberId: number | null;
  #buddies = new Map<number, BuddyScript>();
  #approachedPosts = new Set<number>();

  constructor(deps: SimulatorDeps) {
    this.#deps = deps;
    this.#random = deps.random ?? Math.random;
    this.#demoMemberId = findMemberByPhone(deps.db, DEMO_MEMBER_PHONE)?.id ?? null;
    for (const script of DEMO_BUDDIES) {
      const member = findMemberByPhone(deps.db, script.phone);
      if (member) this.#buddies.set(member.id, script);
    }
  }

  start(): void {
    this.#timer = setInterval(() => {
      try {
        this.tick();
      } catch (err) {
        log.error('demo simulation tick failed', errorFields(err));
      }
    }, TICK_MS);
    this.#timer.unref();
    log.info('demo simulation on', { minInside: this.#deps.config.DEMO_MIN_INSIDE, buddies: this.#buddies.size });
  }

  stop(): void {
    clearInterval(this.#timer);
  }

  /** One simulation step. Public so tests can drive it with a fixed clock. */
  tick(): void {
    this.#ticks++;
    const now = this.#deps.now();
    if (this.#ticks % CROWD_EVERY_TICKS === 1) this.#moveCrowd(now);
    if (this.#ticks % POSTS_EVERY_TICKS === 1) this.#keepBuddiesPosting(now);
    this.#answerRequests(now);
    this.#approachDemoMember(now);
    this.#chatBack(now);
  }

  // -------------------------------------------------------------------------
  // Crowd
  // -------------------------------------------------------------------------

  #expectedNow(now: Date): number {
    const { db, config } = this.#deps;
    const hour = localHour(now, config.GYM_TIMEZONE);
    return hourlyProfile(db, now, config.GYM_TIMEZONE, config.GYM_CAPACITY).find((h) => h.hour === hour)?.expected ?? 0;
  }

  #moveCrowd(now: Date): void {
    const { db, config } = this.#deps;
    const inside = insideMemberIds(db, now);
    const today = localDate(now, config.GYM_TIMEZONE);
    const active = new Set(
      (db
        .prepare("SELECT DISTINCT member_id FROM memberships WHERE status = 'active' AND starts_on <= ? AND ends_on >= ?")
        .all(today, today) as unknown as { member_id: number }[]).map((row) => row.member_id),
    );

    for (const id of this.#buddies.keys()) {
      if (!inside.has(id) && active.has(id)) {
        this.#pass(id, 'in', now);
        inside.add(id);
      }
    }

    const target = Math.max(config.DEMO_MIN_INSIDE, Math.round(this.#expectedNow(now)));
    const crowd = (id: number) => id !== this.#demoMemberId && !this.#buddies.has(id);
    const outside = [...active].filter((id) => crowd(id) && !inside.has(id));
    const leavers = [...inside].filter((id) => crowd(id) && now.getTime() - Date.parse(lastGrantedCheckin(db, id)?.created_at ?? '') >= MIN_STAY_MS);
    const diff = target - inside.size;

    if (diff > 0) {
      for (const id of this.#sample(outside, Math.min(diff, MAX_MOVES_PER_ROUND))) this.#pass(id, 'in', now);
    } else if (diff < 0) {
      for (const id of this.#sample(leavers, Math.min(-diff, MAX_MOVES_PER_ROUND))) this.#pass(id, 'out', now);
    } else if (this.#random() < 0.6) {
      // Keep the gate log moving even when occupancy is on target.
      for (const id of this.#sample(outside, 1)) this.#pass(id, 'in', now);
      for (const id of this.#sample(leavers, 1)) this.#pass(id, 'out', now);
    }
  }

  #pass(memberId: number, direction: 'in' | 'out', now: Date): void {
    const { db, live, config } = this.#deps;
    const checkinId = insertCheckin(db, { memberId, direction, reason: null, at: now });
    const checkin = getCheckin(db, checkinId, localDate(now, config.GYM_TIMEZONE));
    if (!checkin) return;
    live.publish(
      { type: 'checkin', checkin, gym: { insideCount: insideCount(db, now), capacity: config.GYM_CAPACITY } },
      (claims) => isStaff(claims) || claims.sub === memberId,
    );
    if (direction === 'out') publishSocialChange(live, leaveFloor(db, memberId, now));
  }

  #sample<T>(items: T[], count: number): T[] {
    const pool = [...items];
    const picked: T[] = [];
    while (picked.length < count && pool.length > 0) {
      const [item] = pool.splice(Math.floor(this.#random() * pool.length), 1);
      if (item !== undefined) picked.push(item);
    }
    return picked;
  }

  // -------------------------------------------------------------------------
  // Buddies
  // -------------------------------------------------------------------------

  #keepBuddiesPosting(now: Date): void {
    const { db, live } = this.#deps;
    for (const [id, script] of this.#buddies) {
      const view = radar(db, id, now);
      if (!view.inside || view.myPost || view.matches.length > 0) continue;
      const { change } = openPost(db, id, { muscleGroup: script.muscleGroup, location: script.location, note: script.note }, now);
      publishSocialChange(live, change);
    }
  }

  /** Buddies accept requests to their posts after a short, human pause. */
  #answerRequests(now: Date): void {
    const { db, live } = this.#deps;
    for (const id of this.#buddies.keys()) {
      for (const request of radar(db, id, now).incoming) {
        if (now.getTime() - Date.parse(request.createdAt) < REPLY_DELAY_MS) continue;
        publishSocialChange(live, actOnRequest(db, id, request.id, 'accept', now).change);
      }
    }
  }

  /** When the demo member opens a post and nobody has answered, a free buddy asks to join. */
  #approachDemoMember(now: Date): void {
    const { db, live } = this.#deps;
    if (this.#demoMemberId === null) return;
    const mine = radar(db, this.#demoMemberId, now);
    const post = mine.myPost;
    if (!post || mine.incoming.length > 0 || this.#approachedPosts.has(post.id)) return;
    if (now.getTime() - Date.parse(post.createdAt) < APPROACH_AFTER_MS) return;

    const free = [...this.#buddies.keys()].find((id) => {
      const view = radar(db, id, now);
      return view.inside && view.matches.length === 0;
    });
    if (free === undefined) return;
    this.#approachedPosts.add(post.id);
    publishSocialChange(live, sendRequest(db, free, post.id, now).change);
  }

  /** Buddies open the chat after a match and answer up to a few messages. */
  #chatBack(now: Date): void {
    const { db, live } = this.#deps;
    for (const [id, script] of this.#buddies) {
      for (const match of radar(db, id, now).matches) {
        const conversation = chat(db, id, match.id);
        if (!conversation.canSend) continue;
        const mine = conversation.messages.filter((m) => m.senderId === id);
        const last = conversation.messages.at(-1);
        const sinceMatch = now.getTime() - Date.parse(match.modifiedAt);

        let body: string | null = null;
        if (mine.length === 0 && sinceMatch >= REPLY_DELAY_MS) {
          const other = match.from.id === id ? match.to : match.from;
          body = match.from.id === id ? `Selam ${other.displayName.split(' ')[0]}! İlanını gördüm, müsaitsen yanına geliyorum.` : script.reply;
        } else if (last && last.senderId !== id && mine.length <= MAX_FOLLOW_UPS && now.getTime() - Date.parse(last.createdAt) >= REPLY_DELAY_MS) {
          body = FOLLOW_UPS[(mine.length - 1) % FOLLOW_UPS.length] ?? null;
        }
        if (!body) continue;
        const sent = sendMessage(db, id, match.id, body, now);
        publishMessage(live, sent.message, sent.request);
      }
    }
  }
}
