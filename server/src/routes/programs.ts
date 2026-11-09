import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { validate } from '../problem.ts';
import { getProgramDetail, listPrograms } from '../training.ts';

const idSchema = z.coerce.number().int().positive();

export function programRoutes({ db, config }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole(config.JWT_SECRET, 'member', 'owner', 'desk'));

  routes.get('/', (c) => c.json(listPrograms(db)));
  routes.get('/:id', (c) => c.json(getProgramDetail(db, validate(idSchema, c.req.param('id')))));

  return routes;
}
