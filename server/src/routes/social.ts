import { Hono } from 'hono';
import { z } from 'zod';
import { GYM_SPOTS, SPOT_MESSAGE_MAX, SPOT_NOTE_MAX } from '../../../shared/contract.ts';
import type { AppDeps } from '../app.ts';
import { requireRole, type AppEnv } from '../middleware.ts';
import { readJson, validate } from '../problem.ts';
import { actOnRequest, chat, closePost, closeStalePosts, openPost, radar, sendMessage, sendRequest } from '../social.ts';
import { publishMessage, publishSocialChange } from '../social-events.ts';

const idSchema = z.coerce.number().int().positive();
const postSchema = z.object({
  muscleGroup: z.enum(['chest_back', 'shoulders_arms', 'legs', 'full_body']),
  location: z.enum(GYM_SPOTS),
  note: z.string().trim().max(SPOT_NOTE_MAX).default(''),
});
const requestSchema = z.object({ postId: z.number().int().positive() });
const messageSchema = z.object({ body: z.string().trim().min(1, 'Mesaj boş olamaz').max(SPOT_MESSAGE_MAX) });

/** Buddy radar, mounted under /me. Members only: trainers are not on the radar. */
export function socialRoutes({ db, config, live, now }: AppDeps): Hono<AppEnv> {
  const routes = new Hono<AppEnv>();
  for (const path of ['/radar', '/radar/*', '/spot-requests', '/spot-requests/*']) {
    routes.use(path, requireRole({ secret: config.JWT_SECRET, db }, 'member'));
  }

  routes.get('/radar', (c) => {
    const at = now();
    publishSocialChange(live, closeStalePosts(db, at));
    return c.json(radar(db, c.get('auth').sub, at));
  });

  routes.post('/radar/post', async (c) => {
    const input = await readJson(c, postSchema);
    const { post, change } = openPost(db, c.get('auth').sub, input, now());
    publishSocialChange(live, change);
    return c.json(post, 201);
  });

  routes.post('/radar/post/close', (c) => {
    publishSocialChange(live, closePost(db, c.get('auth').sub, now()));
    return c.body(null, 204);
  });

  routes.post('/spot-requests', async (c) => {
    const { postId } = await readJson(c, requestSchema);
    const { request, change } = sendRequest(db, c.get('auth').sub, postId, now());
    publishSocialChange(live, change);
    return c.json(request, 201);
  });

  for (const event of ['accept', 'decline', 'cancel'] as const) {
    routes.post(`/spot-requests/:id/${event}`, (c) => {
      const { request, change } = actOnRequest(db, c.get('auth').sub, validate(idSchema, c.req.param('id')), event, now());
      publishSocialChange(live, change);
      return c.json(request);
    });
  }

  routes.get('/spot-requests/:id/chat', (c) => c.json(chat(db, c.get('auth').sub, validate(idSchema, c.req.param('id')))));

  routes.post('/spot-requests/:id/messages', async (c) => {
    const { body } = await readJson(c, messageSchema);
    const { message, request } = sendMessage(db, c.get('auth').sub, validate(idSchema, c.req.param('id')), body, now());
    publishMessage(live, message, request);
    return c.json(message, 201);
  });

  return routes;
}
