import { Hono } from 'hono';
import type { MeResponse } from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { daysLeft, effectiveStatus } from '../domain/membership.ts';
import { currentMembership, findMemberById, insideCount, isInside, lastGrantedCheckin, toProfile } from '../queries.ts';
import { HttpProblem } from '../problem.ts';
import { localDate } from '../time.ts';

export function meRoutes({ db, config, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole(config.JWT_SECRET, 'member'));

  routes.get('/', (c) => {
    const memberId = c.get('auth').sub;
    const member = findMemberById(db, memberId);
    if (!member) throw new HttpProblem(401, 'Oturum gerekli', 'Hesap bulunamadı, yeniden giriş yapın');

    const at = now();
    const today = localDate(at, config.GYM_TIMEZONE);
    const membership = currentMembership(db, memberId, today);

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
      lastCheckinAt: lastGrantedCheckin(db, memberId)?.created_at ?? null,
      gym: { insideCount: insideCount(db, at), capacity: config.GYM_CAPACITY },
    };
    return c.json(body);
  });

  return routes;
}
