import { Hono } from 'hono';
import { z } from 'zod';
import type { StaffSummary } from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { checkinCountsSince, insideCount, recentCheckins } from '../queries.ts';
import { validate } from '../problem.ts';
import { localDate, startOfLocalDay } from '../time.ts';

const checkinsQuery = z.object({ limit: z.coerce.number().int().min(1).max(200).default(50) });

export function staffRoutes({ db, config, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole(config.JWT_SECRET, 'owner', 'desk'));

  routes.get('/checkins', (c) => {
    const { limit } = validate(checkinsQuery, c.req.query());
    return c.json(recentCheckins(db, limit, localDate(now(), config.GYM_TIMEZONE)));
  });

  routes.get('/summary', (c) => {
    const at = now();
    const counts = checkinCountsSince(db, startOfLocalDay(at, config.GYM_TIMEZONE));
    const body: StaffSummary = {
      gym: { insideCount: insideCount(db, at), capacity: config.GYM_CAPACITY },
      todayGranted: counts.granted,
      todayDenied: counts.denied,
    };
    return c.json(body);
  });

  return routes;
}
