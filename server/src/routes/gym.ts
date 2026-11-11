import { Hono } from 'hono';
import type { AppDeps } from '../app.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { occupancy } from '../occupancy.ts';

export function gymRoutes({ db, config, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole({ secret: config.JWT_SECRET, db }, 'member', 'trainer', 'owner', 'desk'));

  routes.get('/occupancy', (c) => c.json(occupancy(db, now(), config.GYM_TIMEZONE, config.GYM_CAPACITY)));

  return routes;
}
