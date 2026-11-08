import { Hono } from 'hono';
import { z } from 'zod';
import type { MemberLoginResponse, StaffLoginResponse } from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import type { AppEnv } from '../middleware.ts';
import { hashSecret, issueToken, newQrSecret, verifySecret } from '../auth.ts';
import { findMemberById, findMemberByPhone, listStaff, toProfile } from '../queries.ts';
import { HttpProblem, readJson } from '../problem.ts';

/** Accepts "0555 000 00 01", "+90 555...", "5550000001"; stores the 10-digit national form. */
export const phoneSchema = z
  .string()
  .max(20)
  .transform((raw) => {
    const digits = raw.replace(/\D/g, '');
    if (digits.length === 12 && digits.startsWith('90')) return digits.slice(2);
    if (digits.length === 11 && digits.startsWith('0')) return digits.slice(1);
    return digits;
  })
  .pipe(z.string().regex(/^5\d{9}$/, 'Telefon 5 ile başlayan 10 haneli bir cep numarası olmalı'));

const memberLoginSchema = z.object({
  phone: phoneSchema,
  password: z.string().min(1).max(200),
});

const registerSchema = z.object({
  fullName: z.string().trim().min(2).max(80),
  phone: phoneSchema,
  password: z.string().min(8, 'Şifre en az 8 karakter olmalı').max(200),
  birthYear: z.number().int().min(1920).max(2015).nullable().default(null),
  heightCm: z.number().int().min(120).max(230).nullable().default(null),
  weightKg: z.number().min(30).max(250).nullable().default(null),
  goal: z.enum(['lose', 'gain', 'fit', 'strength']).nullable().default(null),
});

const staffLoginSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN 4 haneli olmalı'),
});

const INVALID_LOGIN = 'Telefon veya şifre hatalı';

export function authRoutes({ db, config }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  // Verified against when the phone is unknown, so both failure paths cost the same time.
  const decoyHash = hashSecret('decoy-password-for-timing');

  routes.post('/member/login', async (c) => {
    const { phone, password } = await readJson(c, memberLoginSchema);
    const member = findMemberByPhone(db, phone);
    const valid = await verifySecret(password, member?.password_hash ?? (await decoyHash));
    if (!member || !valid) throw new HttpProblem(401, 'Giriş başarısız', INVALID_LOGIN);

    const body: MemberLoginResponse = {
      token: await issueToken(config.JWT_SECRET, { sub: member.id, role: 'member' }),
      qrSecret: member.qr_secret,
      member: toProfile(member),
    };
    return c.json(body);
  });

  routes.post('/member/register', async (c) => {
    const input = await readJson(c, registerSchema);
    if (findMemberByPhone(db, input.phone)) {
      throw new HttpProblem(409, 'Kayıt yapılamadı', 'Bu telefon numarasıyla kayıtlı bir üye var');
    }
    const now = new Date().toISOString();
    const result = db
      .prepare(
        `INSERT INTO members (full_name, phone, password_hash, birth_year, height_cm, weight_kg, goal, qr_secret, created_at, modified_at)
         VALUES (:fullName, :phone, :passwordHash, :birthYear, :heightCm, :weightKg, :goal, :qrSecret, :now, :now)`,
      )
      .run({
        fullName: input.fullName,
        phone: input.phone,
        passwordHash: await hashSecret(input.password),
        birthYear: input.birthYear,
        heightCm: input.heightCm,
        weightKg: input.weightKg,
        goal: input.goal,
        qrSecret: newQrSecret(),
        now,
      });
    const member = findMemberById(db, Number(result.lastInsertRowid));
    if (!member) throw new Error('Member vanished right after insert');

    const body: MemberLoginResponse = {
      token: await issueToken(config.JWT_SECRET, { sub: member.id, role: 'member' }),
      qrSecret: member.qr_secret,
      member: toProfile(member),
    };
    return c.json(body, 201);
  });

  routes.post('/staff/login', async (c) => {
    const { pin } = await readJson(c, staffLoginSchema);
    for (const staff of listStaff(db)) {
      if (await verifySecret(pin, staff.pin_hash)) {
        const body: StaffLoginResponse = {
          token: await issueToken(config.JWT_SECRET, { sub: staff.id, role: staff.role }),
          staff: { id: staff.id, name: staff.name, role: staff.role },
        };
        return c.json(body);
      }
    }
    throw new HttpProblem(401, 'Giriş başarısız', 'PIN hatalı');
  });

  return routes;
}
