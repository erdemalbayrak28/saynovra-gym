import { Hono } from 'hono';
import { z } from 'zod';
import type { AppDeps } from '../app.ts';
import { isStaff } from '../auth.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { trainerIdOf } from '../queries.ts';
import { readJson, validate } from '../problem.ts';
import {
  discardWorkout,
  enroll,
  exerciseProgress,
  finishWorkout,
  logSet,
  myTraining,
  progress,
  startWorkout,
} from '../training.ts';

const idSchema = z.coerce.number().int().positive();
const enrollSchema = z.object({ programId: z.number().int().positive() });
const logSetSchema = z.object({
  programItemId: z.number().int().positive(),
  setNo: z.number().int().min(1).max(20),
  weightKg: z.number().min(0).max(500).multipleOf(0.25).nullable(),
  reps: z.number().int().min(0).max(100),
  rpe: z.number().min(5).max(10).nullable().default(null),
});

const PATHS = ['/training', '/program', '/workouts', '/workouts/*', '/progress', '/progress/*'];

/** Member training endpoints, mounted under /me. Trainers have no training of their own here. */
export function trainingRoutes({ db, config, live, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  for (const path of PATHS) routes.use(path, requireRole({ secret: config.JWT_SECRET, db }, 'member'));

  routes.get('/training', (c) => c.json(myTraining(db, c.get('auth').sub, now(), config.GYM_TIMEZONE)));

  routes.post('/program', async (c) => {
    const { programId } = await readJson(c, enrollSchema);
    const memberId = c.get('auth').sub;
    const enrollment = enroll(db, memberId, programId, now());
    // The member's trainer sees the change on their list.
    const trainerId = trainerIdOf(db, memberId);
    if (trainerId !== null) live.publish({ type: 'training', memberId }, (claims) => !isStaff(claims) && claims.sub === trainerId);
    return c.json(enrollment, 201);
  });

  routes.post('/workouts', (c) => c.json(startWorkout(db, c.get('auth').sub, now())));

  routes.post('/workouts/:id/sets', async (c) => {
    const workoutId = validate(idSchema, c.req.param('id'));
    const input = await readJson(c, logSetSchema);
    return c.json(logSet(db, c.get('auth').sub, workoutId, input, now()));
  });

  routes.post('/workouts/:id/finish', (c) => {
    const workoutId = validate(idSchema, c.req.param('id'));
    return c.json(finishWorkout(db, c.get('auth').sub, workoutId, now()));
  });

  routes.post('/workouts/:id/discard', (c) => {
    discardWorkout(db, c.get('auth').sub, validate(idSchema, c.req.param('id')));
    return c.body(null, 204);
  });

  routes.get('/progress', (c) => c.json(progress(db, c.get('auth').sub, now(), config.GYM_TIMEZONE)));

  routes.get('/progress/:exerciseId', (c) => {
    const exerciseId = validate(idSchema, c.req.param('exerciseId'));
    return c.json(exerciseProgress(db, c.get('auth').sub, exerciseId, config.GYM_TIMEZONE));
  });

  return routes;
}
