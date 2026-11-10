import { Hono } from 'hono';
import { qrKeyId, type MeResponse, type MyConsentsResponse, type QrKeyResponse } from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import { gateSigner } from '../auth.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { daysLeft, effectiveStatus } from '../domain/membership.ts';
import { currentMembership, findMemberById, memberConsents, insideCount, isInside, lastGrantedCheckin, toProfile } from '../queries.ts';
import { socialRoutes } from './social.ts';
import { trainingRoutes } from './training.ts';
import { HttpProblem } from '../problem.ts';
import { localDate } from '../time.ts';

export function meRoutes(deps: AppDeps): Hono<AppEnv> {
  const { db, config, now } = deps;
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole({ secret: config.JWT_SECRET, db }, 'member'));
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

  routes.get('/', (c) => {
    const memberId = c.get('auth').sub;
    const member = signedInMember(memberId);

    const at = now();
    const today = localDate(at, config.GYM_TIMEZONE);
    const membership = currentMembership(db, memberId, today);
    const lastPass = lastGrantedCheckin(db, memberId);

    const body: MeResponse = {
      member: toProfile(member),
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
