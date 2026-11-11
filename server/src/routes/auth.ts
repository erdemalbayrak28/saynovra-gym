import { Hono } from 'hono';
import { z } from 'zod';
import {
  ACTIVATION_CODE_LENGTH,
  PASSWORD_MIN_LENGTH,
  type MemberLoginResponse,
  type StaffLoginResponse,
} from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import type { AppEnv } from '../middleware.ts';
import { hashSecret, isStaff, issueToken, verifySecret } from '../auth.ts';
import { log } from '../log.ts';
import { activateMember } from '../onboarding.ts';
import { findMemberByPhone, listStaff, toProfile, type MemberRow } from '../queries.ts';
import { HttpProblem, readJson } from '../problem.ts';
import { AttemptLimiter, clientAddress, refuseIfLocked } from '../rate-limit.ts';

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

const activateSchema = z.object({
  phone: phoneSchema,
  code: z.string().regex(new RegExp(String.raw`^\d{${ACTIVATION_CODE_LENGTH}}$`), `Kod ${ACTIVATION_CODE_LENGTH} haneli olmalı`),
  password: z.string().min(PASSWORD_MIN_LENGTH, `Şifre en az ${PASSWORD_MIN_LENGTH} karakter olmalı`).max(200),
});

const staffLoginSchema = z.object({
  pin: z.string().regex(/^\d{4}$/, 'PIN 4 haneli olmalı'),
});

const INVALID_LOGIN = 'Telefon veya şifre hatalı';

export function authRoutes({ db, config, live, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  const loginResponse = async (member: MemberRow): Promise<MemberLoginResponse> => ({
    token: await issueToken(config.JWT_SECRET, { sub: member.id, role: member.role, ep: member.session_epoch }),
    qrSecret: member.qr_secret,
    member: toProfile(member),
  });
  // Wrong guesses lock the phone number or the client address for a while (PLAN.md, sprint 6).
  const window = { windowMinutes: 15, lockMinutes: 15, now };
  const limits = {
    loginPhone: new AttemptLimiter({ max: 5, ...window }),
    loginClient: new AttemptLimiter({ max: 20, ...window }),
    pinClient: new AttemptLimiter({ max: 5, ...window }),
    activateClient: new AttemptLimiter({ max: 10, ...window }),
  };

  // Verified against when the phone is unknown, so both failure paths cost the same time.
  const decoyHash = hashSecret('decoy-password-for-timing');

  routes.post('/member/login', async (c) => {
    const { phone, password } = await readJson(c, memberLoginSchema);
    const client = clientAddress(c);
    refuseIfLocked([limits.loginPhone, phone], [limits.loginClient, client]);
    const member = findMemberByPhone(db, phone);
    const valid = await verifySecret(password, member?.password_hash ?? (await decoyHash));
    if (!member || !valid) {
      // Counted for unknown phones too, so the answer does not reveal which numbers exist.
      limits.loginPhone.fail(phone);
      limits.loginClient.fail(client);
      throw new HttpProblem(401, 'Giriş başarısız', INVALID_LOGIN);
    }
    limits.loginPhone.reset(phone);

    return c.json(await loginResponse(member));
  });

  // Accounts are opened at reception (POST /staff/members); the member turns the one-time code
  // into a password of their own here.
  routes.post('/member/activate', async (c) => {
    const input = await readJson(c, activateSchema);
    const client = clientAddress(c);
    refuseIfLocked([limits.activateClient, client]);
    const member = await activateMember(db, input, now()).catch((err: unknown) => {
      if (err instanceof HttpProblem && err.status === 400) limits.activateClient.fail(client);
      throw err;
    });
    // A new password ends any lock on the old one.
    limits.loginPhone.reset(member.phone);
    live.publish({ type: 'member', memberId: member.id }, isStaff);
    log.info('member activated', { memberId: member.id });
    return c.json(await loginResponse(member));
  });

  routes.post('/staff/login', async (c) => {
    const { pin } = await readJson(c, staffLoginSchema);
    const client = clientAddress(c);
    refuseIfLocked([limits.pinClient, client]);
    for (const staff of listStaff(db)) {
      if (await verifySecret(pin, staff.pin_hash)) {
        const body: StaffLoginResponse = {
          token: await issueToken(config.JWT_SECRET, { sub: staff.id, role: staff.role }),
          staff: { id: staff.id, name: staff.name, role: staff.role },
        };
        limits.pinClient.reset(client);
        return c.json(body);
      }
    }
    limits.pinClient.fail(client);
    throw new HttpProblem(401, 'Giriş başarısız', 'PIN hatalı');
  });

  return routes;
}
