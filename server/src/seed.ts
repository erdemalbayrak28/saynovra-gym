// Rebuilds the local demo database from scratch: `npm run seed`.
// All people are fictional. Re-run shortly before a demo so "inside now" reflects the current hour.

import { rmSync } from 'node:fs';
import { hashSecret } from './auth.ts';
import { seedCatalog } from './catalog.ts';
import { loadConfig } from './config.ts';
import { openDb, transaction, type Db } from './db.ts';
import { DEMO_MEMBER_PASSWORD, DEMO_MEMBER_PHONE, DEMO_STAFF as STAFF } from './demo.ts';
import { seedTrainingHistory } from './seed-training.ts';
import { addDays, localDate } from './time.ts';

const PLANS = [
  { name: 'Aylık', days: 30, priceTl: 1500, freezeDays: 0 },
  { name: '3 Aylık', days: 90, priceTl: 3900, freezeDays: 15 },
  { name: '6 Aylık', days: 180, priceTl: 6900, freezeDays: 30 },
  { name: 'Yıllık', days: 365, priceTl: 11900, freezeDays: 45 },
] as const;
type PlanName = (typeof PLANS)[number]['name'];

// Named members that appear in the mockup flows. Erdem is the account used on the phone.
const PERSONAS: { name: string; plan: PlanName; daysLeft: number; visitsPerWeek: number; status?: 'frozen' | 'cancelled' }[] = [
  { name: 'Erdem Albayrak', plan: 'Yıllık', daysLeft: 42, visitsPerWeek: 4 },
  { name: 'Burak Bayram', plan: 'Yıllık', daysLeft: 118, visitsPerWeek: 5 },
  { name: 'Kerem Tekin', plan: '6 Aylık', daysLeft: 64, visitsPerWeek: 4 },
  { name: 'Caner Yılmaz', plan: 'Yıllık', daysLeft: 210, visitsPerWeek: 5 },
  { name: 'Emre Kaya', plan: '3 Aylık', daysLeft: 37, visitsPerWeek: 3 },
  { name: 'Mert Demir', plan: 'Aylık', daysLeft: -1, visitsPerWeek: 3 },
];
const GENERATED_MEMBERS = 480;

const FIRST_NAMES = [
  'Ahmet', 'Ayşe', 'Mehmet', 'Zeynep', 'Can', 'Elif', 'Cem', 'Selin', 'Deniz', 'Ece', 'Kaan', 'Gizem',
  'Ozan', 'Merve', 'Onur', 'Büşra', 'Serkan', 'Esra', 'Hakan', 'Derya', 'Tolga', 'Irmak', 'Volkan', 'Defne',
  'Yusuf', 'Ceren', 'Berk', 'İrem', 'Arda', 'Pınar', 'Oğuz', 'Aslı', 'Barış', 'Melis', 'Sinan', 'Yağmur',
  'Tuna', 'Seda', 'Ege', 'Nil', 'Doruk', 'Duygu', 'Umut', 'Şule', 'Alp', 'Gamze', 'Bora', 'Çağla',
];
const LAST_NAMES = [
  'Yılmaz', 'Kaya', 'Demir', 'Şahin', 'Çelik', 'Yıldız', 'Yıldırım', 'Öztürk', 'Aydın', 'Özdemir',
  'Arslan', 'Doğan', 'Kılıç', 'Aslan', 'Çetin', 'Kara', 'Koç', 'Kurt', 'Özkan', 'Şimşek', 'Polat',
  'Korkmaz', 'Güneş', 'Aksoy', 'Tekin', 'Uçar', 'Ateş', 'Bulut', 'Erdem', 'Güler',
];

// Relative share of entries per local hour (07:00 to 23:00): quiet mornings, evening peak.
const HOUR_WEIGHTS: Record<number, number> = {
  7: 3, 8: 4, 9: 3, 10: 2, 11: 2, 12: 3, 13: 3, 14: 2, 15: 3, 16: 4,
  17: 7, 18: 10, 19: 10, 20: 8, 21: 5, 22: 3, 23: 1,
};
const HISTORY_DAYS = 28;
// Türkiye has stayed on UTC+3 all year since 2016; good enough for fabricating history.
const UTC_OFFSET_HOURS = 3;
const KURUS_PER_TL = 100;

// mulberry32: tiny deterministic PRNG so every seed produces the same gym.
function rng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface SeedMember {
  id: number;
  plan: (typeof PLANS)[number];
  startsOn: string;
  endsOn: string;
  status: 'active' | 'frozen' | 'cancelled';
  visitsPerWeek: number;
}

async function main(): Promise<void> {
  const config = loadConfig();
  if (config.DB_PATH !== ':memory:') {
    for (const suffix of ['', '-wal', '-shm']) rmSync(config.DB_PATH + suffix, { force: true });
  }
  const db = openDb(config.DB_PATH);
  const now = new Date();
  const today = localDate(now, config.GYM_TIMEZONE);
  const random = rng(2026);
  const pick = <T>(items: readonly T[]): T => items[Math.floor(random() * items.length)] as T;
  // Deterministic gate keys: re-seeding keeps phones that are already signed in working.
  // Demo database only; real members get random keys at registration (auth.newQrSecret).
  const secretRandom = rng(4242);
  const demoQrSecret = () =>
    Array.from({ length: 32 }, () => Math.floor(secretRandom() * 256).toString(16).padStart(2, '0')).join('');

  const staffHashes = await Promise.all(STAFF.map((s) => hashSecret(s.pin)));
  // Every fictional member shares the demo password, so one hash is enough.
  const memberHash = await hashSecret(DEMO_MEMBER_PASSWORD);

  const summary = transaction(db, () => {
    const stamp = now.toISOString();
    STAFF.forEach((s, i) => {
      db.prepare('INSERT INTO staff (name, role, pin_hash, created_at, modified_at) VALUES (?, ?, ?, ?, ?)').run(
        s.name, s.role, staffHashes[i] ?? '', stamp, stamp,
      );
    });
    const deskId = 2;

    const planIds = new Map<PlanName, number>();
    for (const plan of PLANS) {
      const result = db
        .prepare(
          'INSERT INTO plans (name, duration_days, price_kurus, freeze_days_allowed, created_at, modified_at) VALUES (?, ?, ?, ?, ?, ?)',
        )
        .run(plan.name, plan.days, plan.priceTl * KURUS_PER_TL, plan.freezeDays, stamp, stamp);
      planIds.set(plan.name, Number(result.lastInsertRowid));
    }

    const members: SeedMember[] = [];
    const addMember = (fullName: string, phone: string, extra: { heightCm: number; weightKg: number }) => {
      const result = db
        .prepare(
          `INSERT INTO members (full_name, phone, password_hash, birth_year, height_cm, weight_kg, goal, qr_secret, created_at, modified_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          fullName, phone, memberHash, 1975 + Math.floor(random() * 30), extra.heightCm, extra.weightKg,
          pick(['lose', 'gain', 'fit', 'strength'] as const), demoQrSecret(), stamp, stamp, deskId,
        );
      return Number(result.lastInsertRowid);
    };
    const addMembership = (memberId: number, planName: PlanName, daysLeft: number, status: SeedMember['status'], visitsPerWeek: number) => {
      const plan = PLANS.find((p) => p.name === planName) ?? PLANS[0];
      const endsOn = addDays(today, daysLeft);
      const startsOn = addDays(endsOn, -plan.days);
      const createdAt = `${startsOn}T07:00:00.000Z`;
      const result = db
        .prepare(
          `INSERT INTO memberships (member_id, plan_id, starts_on, ends_on, status, frozen_from, price_kurus, created_at, modified_at, created_by)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        )
        .run(
          memberId, planIds.get(plan.name) ?? 0, startsOn, endsOn, status, status === 'frozen' ? addDays(today, -5) : null,
          plan.priceTl * KURUS_PER_TL, createdAt, createdAt, deskId,
        );
      db.prepare('INSERT INTO payments (membership_id, amount_kurus, method, created_at, created_by) VALUES (?, ?, ?, ?, ?)').run(
        Number(result.lastInsertRowid), plan.priceTl * KURUS_PER_TL, pick(['card', 'card', 'cash', 'transfer'] as const), createdAt, deskId,
      );
      members.push({ id: memberId, plan, startsOn, endsOn, status, visitsPerWeek });
    };

    PERSONAS.forEach((persona, i) => {
      const id = addMember(persona.name, `555000${String(i + 1).padStart(4, '0')}`, {
        heightCm: i === 0 ? 182 : 170 + Math.floor(random() * 20),
        weightKg: i === 0 ? 84 : 65 + Math.round(random() * 30),
      });
      addMembership(id, persona.plan, persona.daysLeft, persona.status ?? 'active', persona.visitsPerWeek);
    });

    for (let i = 0; i < GENERATED_MEMBERS; i++) {
      const id = addMember(`${pick(FIRST_NAMES)} ${pick(LAST_NAMES)}`, `555000${String(PERSONAS.length + i + 1).padStart(4, '0')}`, {
        heightCm: 155 + Math.floor(random() * 40),
        weightKg: 52 + Math.round(random() * 45),
      });
      const roll = random();
      const status = roll < 0.04 ? 'cancelled' : roll < 0.1 ? 'frozen' : 'active';
      const plan = pick(PLANS);
      // Days left can never exceed the plan's length, or the membership would start in the future.
      const daysLeft = random() < 0.08 ? -Math.ceil(random() * 20) : Math.ceil(random() * plan.days);
      addMembership(id, plan.name, daysLeft, status, 2 + Math.floor(random() * 4));
    }

    const programIds = seedCatalog(db, now);
    const workouts = seedTrainingHistory(db, { memberId: 1, programId: programIds.get('hipertrofi-ust-alt') ?? 0, today });
    return { ...insertHistory(db, members, now, today, random), workouts };
  });

  db.close();
  console.log(
    JSON.stringify({
      seeded: config.DB_PATH,
      members: PERSONAS.length + GENERATED_MEMBERS,
      checkins: summary.checkins,
      insideNow: summary.insideNow,
      demoWorkouts: summary.workouts,
      demoMemberPhone: DEMO_MEMBER_PHONE,
      note: 'Demo şifresi ve PIN\'ler README.md içinde',
    }),
  );
}

function insertHistory(db: Db, members: SeedMember[], now: Date, today: string, random: () => number) {
  const insert = db.prepare(
    'INSERT INTO checkins (member_id, direction, result, reason, created_at) VALUES (?, ?, ?, ?, ?)',
  );
  const hours = Object.entries(HOUR_WEIGHTS).flatMap(([hour, weight]) => Array<number>(weight).fill(Number(hour)));
  let checkins = 0;
  let insideNow = 0;

  for (let dayOffset = -HISTORY_DAYS; dayOffset <= 0; dayOffset++) {
    const day = addDays(today, dayOffset);
    for (const member of members) {
      // The phone's demo member starts outside, so the first scan in a demo is an entry.
      if (dayOffset === 0 && member.id === 1) continue;
      if (member.status === 'cancelled' || day < member.startsOn) continue;
      if (random() > member.visitsPerWeek / 7) continue;

      const hour = hours[Math.floor(random() * hours.length)] ?? 18;
      const entry = new Date(`${day}T00:00:00.000Z`);
      entry.setUTCHours(hour - UTC_OFFSET_HOURS, Math.floor(random() * 60), Math.floor(random() * 60));
      if (entry > now) continue;

      const lapsed = day > member.endsOn || member.status === 'frozen';
      if (lapsed) {
        // Lapsed members occasionally still try the gate.
        if (random() < 0.15) {
          insert.run(member.id, 'in', 'denied', member.status === 'frozen' ? 'membership_frozen' : 'membership_expired', entry.toISOString());
          checkins++;
        }
        continue;
      }

      insert.run(member.id, 'in', 'granted', null, entry.toISOString());
      checkins++;
      const exit = new Date(entry.getTime() + (45 + Math.floor(random() * 65)) * 60 * 1000);
      if (exit > now) {
        insideNow++;
        continue;
      }
      insert.run(member.id, 'out', 'granted', null, exit.toISOString());
      checkins++;
      if (random() < 0.02) {
        insert.run(member.id, 'in', 'denied', 'expired_code', new Date(entry.getTime() - 20_000).toISOString());
        checkins++;
      }
    }
  }
  return { checkins, insideNow };
}

main().catch((err: unknown) => {
  console.error(err);
  process.exit(1);
});
