import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { isStaff, sessionIsCurrent } from './auth.ts';
import { memberSessionEpoch } from './queries.ts';
import { autoUnfreeze } from './reception.ts';
import { localDate } from './time.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { LiveHub } from './live.ts';
import { errorFields, log } from './log.ts';
import { DemoSimulator } from './simulator.ts';

const FREEZE_SWEEP_MS = 10 * 60 * 1000;

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net !== undefined && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

function main(): void {
  const config = loadConfig();
  const db = openDb(config.DB_PATH);
  const live = new LiveHub(config.JWT_SECRET, (claims) => sessionIsCurrent(claims, (id) => memberSessionEpoch(db, id)));
  const app = createApp({ db, config, live, now: () => new Date() });

  // 0.0.0.0 so the phone on the same Wi-Fi can reach the API.
  const server = serve({ fetch: app.fetch, port: config.PORT, hostname: '0.0.0.0' }, (info) => {
    log.info('server listening', { port: info.port, lan: lanAddresses().map((ip) => `http://${ip}:${info.port}`) });
  }) as Server;
  live.attach(server);

  // Freezes end on their own when the allowance runs out: checked now and every ten minutes.
  const sweepFreezes = () => {
    try {
      const at = new Date();
      for (const memberId of autoUnfreeze(db, { now: at, today: localDate(at, config.GYM_TIMEZONE) })) {
        live.publish({ type: 'membership', memberId }, (claims) => isStaff(claims) || (claims.role === 'member' && claims.sub === memberId));
        log.info('freeze ended automatically', { memberId });
      }
    } catch (err) {
      log.error('freeze sweep failed', errorFields(err));
    }
  };
  sweepFreezes();
  const freezeTimer = setInterval(sweepFreezes, FREEZE_SWEEP_MS);
  freezeTimer.unref();

  const simulator = config.DEMO_SIMULATION ? new DemoSimulator({ db, live, config, now: () => new Date() }) : null;
  simulator?.start();

  const shutdown = (signal: string) => {
    log.info('shutting down', { signal });
    simulator?.stop();
    clearInterval(freezeTimer);
    live.close();
    server.close(() => {
      db.close();
      process.exit(0);
    });
  };
  process.on('SIGINT', () => shutdown('SIGINT'));
  process.on('SIGTERM', () => shutdown('SIGTERM'));
}

try {
  main();
} catch (err) {
  log.error('startup failed', errorFields(err));
  process.exit(1);
}
