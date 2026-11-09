import { Hono } from 'hono';
import { cors } from 'hono/cors';
import type { Config } from './config.ts';
import type { Db } from './db.ts';
import type { LiveHub } from './live.ts';
import { errorFields, log } from './log.ts';
import type { AppEnv } from './middleware.ts';
import { HttpProblem, problemResponse, toProblem } from './problem.ts';
import { authRoutes } from './routes/auth.ts';
import { gateRoutes } from './routes/gate.ts';
import { meRoutes } from './routes/me.ts';
import { programRoutes } from './routes/programs.ts';
import { staffRoutes } from './routes/staff.ts';

export interface AppDeps {
  db: Db;
  config: Config;
  live: LiveHub;
  now: () => Date;
}

// Local-only demo: browsers on this machine and on the home network may call the API.
const LOCAL_ORIGIN = /^http:\/\/(localhost|127\.0\.0\.1|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?$/;

export function createApp(deps: AppDeps): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', cors({ origin: (origin) => (LOCAL_ORIGIN.test(origin) ? origin : null) }));

  app.get('/health', (c) => c.json({ ok: true }));
  app.route('/auth', authRoutes(deps));
  app.route('/me', meRoutes(deps));
  app.route('/programs', programRoutes(deps));
  app.route('/gate', gateRoutes(deps));
  app.route('/staff', staffRoutes(deps));

  app.notFound((c) => problemResponse(c, { type: 'about:blank', title: 'Bulunamadı', status: 404 }));
  app.onError((err, c) => {
    if (err instanceof HttpProblem) return problemResponse(c, toProblem(err));
    log.error('unhandled request error', { method: c.req.method, path: c.req.path, ...errorFields(err) });
    return problemResponse(c, { type: 'about:blank', title: 'Sunucu hatası', status: 500 });
  });

  return app;
}
