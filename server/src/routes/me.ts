import { Hono } from 'hono';
import { z } from 'zod';
import { qrKeyId, type MeResponse, type MyConsentsResponse, type QrKeyResponse, type UpdateProfileRequest } from '../../../shared/contract.ts';
import { KVKK_NOTICE_VERSION } from '../../../shared/consent.ts';
import type { AppDeps } from '../app.ts';
import { transaction } from '../db.ts';
import { gateSigner } from '../auth.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { daysLeft, effectiveStatus } from '../domain/membership.ts';
import { currentMembership, findMemberById, hasOptionalDataConsent, memberConsents, insideCount, isInside, lastGrantedCheckin, toProfile } from '../queries.ts';
import { socialRoutes } from './social.ts';
import { trainingRoutes } from './training.ts';
import { HttpProblem, readJson } from '../problem.ts';
import { localDate } from '../time.ts';

const profileSchema: z.ZodType<UpdateProfileRequest> = z.object({
  profile: z.object({
    birthYear: z.number().int().min(1920).max(2015).nullable(),
    gender: z.enum(['f', 'm', 'x']).nullable(),
    heightCm: z.number().int().min(120).max(230).nullable(),
    weightKg: z.number().min(30).max(250).nullable(),
    goal: z.enum(['lose', 'gain', 'fit', 'strength']).nullable(),
  }),
  consentVersion: z.string().max(20).nullable(),
});

export function meRoutes(deps: AppDeps): Hono<AppEnv> {
  const { db, config, now } = deps;
  const routes = new Hono<AppEnv>();
  // The account itself (profile, gate key, consents) is the same for members and trainers;
  // training and the buddy radar below guard themselves as member-only.
  routes.use('*', requireRole({ secret: config.JWT_SECRET, db }, 'member', 'trainer'));
  routes.route('/', trainingRoutes(deps));
  routes.route('/', socialRoutes(deps));

  const signedInMember = (memberId: number) => {
    const member = findMemberById(db, memberId);
    if (!member) throw new HttpProblem(401, 'Oturum gerekli', 'Hesap bulunamadı, yeniden giriş yapın');
    return member;
  };

  // The phone asks for this only when the fingerprint in /me no longer matches its stored key.
  routes.get('/qr-key', (c) => {
    const member = signedInMember(c.get('auth').sub);
    const body: QrKeyResponse = { qrSecret: member.qr_secret, qrKeyId: qrKeyId(gateSigner(member.qr_secret)) };
    c.header('Cache-Control', 'no-store');
    return c.json(body);
  });

  routes.get('/consents', (c) => {
    const body: MyConsentsResponse = { consents: memberConsents(db, c.get('auth').sub) };
    return c.json(body);
  });

  // Optional profile fields need explicit consent. A member who gave none at the desk gives it
  // here by confirming the current text; the decision is recorded with no staff member.
  routes.post('/profile', requireRole({ secret: config.JWT_SECRET, db }, 'member'), async (c) => {
    const memberId = c.get('auth').sub;
    const { profile, consentVersion } = await readJson(c, profileSchema);
    const stamp = now().toISOString();
    transaction(db, () => {
      if (!hasOptionalDataConsent(db, memberId)) {
        if (consentVersion !== KVKK_NOTICE_VERSION) {
          throw new HttpProblem(403, 'Açık rıza gerekli', 'Bu bilgileri kaydetmek için açık rıza metnini onaylaman gerekiyor');
        }
        db.prepare(
          "INSERT INTO member_consents (member_id, kind, version, granted, created_at, created_by) VALUES (?, 'optional_data', ?, 1, ?, NULL)",
        ).run(memberId, KVKK_NOTICE_VERSION, stamp);
      }
      db.prepare(
        `UPDATE members SET birth_year = ?, gender = ?, height_cm = ?, weight_kg = ?, goal = ?, modified_at = ?, modified_by = NULL
         WHERE id = ?`,
      ).run(profile.birthYear, profile.gender, profile.heightCm, profile.weightKg, profile.goal, stamp, memberId);
    });
    return c.json(toProfile(signedInMember(memberId)));
  });

  routes.get('/', (c) => {
    const memberId = c.get('auth').sub;
    const member = signedInMember(memberId);

    const at = now();
    const today = localDate(at, config.GYM_TIMEZONE);
    const membership = currentMembership(db, memberId, today);
    const lastPass = lastGrantedCheckin(db, memberId);

    const body: MeResponse = {
      member: toProfile(member),
      optionalDataConsent: hasOptionalDataConsent(db, memberId),
      membership: membership
        ? {
            planName: membership.plan_name,
            status: effectiveStatus(membership.status, membership.ends_on, today),
            startsOn: membership.starts_on,
            endsOn: membership.ends_on,
            daysLeft: daysLeft(membership.ends_on, today),
          }
        : null,
      isInside: isInside(db, memberId, at),
      lastCheckinAt: lastPass?.created_at ?? null,
      presenceSeq: lastPass?.id ?? 0,
      qrKeyId: qrKeyId(gateSigner(member.qr_secret)),
      gym: { insideCount: insideCount(db, at), capacity: config.GYM_CAPACITY },
    };
    return c.json(body);
  });

  return routes;
}
