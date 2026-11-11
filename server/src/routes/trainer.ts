import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { log } from '../log.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { readJson, validate } from '../problem.ts';
import { assignProgram, listTrainees, traineeDetail } from '../trainer.ts';

const idSchema = z.coerce.number().int().positive();
const assignSchema = z.object({ programId: z.number().int().positive() });

/** Trainer app: the members assigned to the signed-in trainer, and nothing else. */
export function trainerRoutes({ db, config, live, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  routes.use('*', requireRole({ secret: config.JWT_SECRET, db }, 'trainer'));

  routes.get('/members', (c) => c.json(listTrainees(db, c.get('auth').sub, now(), config.GYM_TIMEZONE)));

  routes.get('/members/:id', (c) => {
    const memberId = validate(idSchema, c.req.param('id'));
    return c.json(traineeDetail(db, c.get('auth').sub, memberId, now(), config.GYM_TIMEZONE));
  });

  routes.post('/members/:id/program', async (c) => {
    const memberId = validate(idSchema, c.req.param('id'));
    const { programId } = await readJson(c, assignSchema);
    const trainerId = c.get('auth').sub;
    const detail = assignProgram(db, trainerId, memberId, programId, now(), config.GYM_TIMEZONE);
    // The member's training tab picks the new programme up at once.
    live.publish({ type: 'training', memberId }, (claims) => claims.role === 'member' && claims.sub === memberId);
    log.info('programme assigned', { trainerId, memberId, programId });
    return c.json(detail, 201);
  });

  return routes;
}
