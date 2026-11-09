import type { Server } from 'node:http';
import { networkInterfaces } from 'node:os';
import { serve } from '@hono/node-server';
import { createApp } from './app.ts';
import { loadConfig } from './config.ts';
import { openDb } from './db.ts';
import { LiveHub } from './live.ts';
import { errorFields, log } from './log.ts';
import { DemoSimulator } from './simulator.ts';

function lanAddresses(): string[] {
  return Object.values(networkInterfaces())
    .flat()
    .filter((net) => net !== undefined && net.family === 'IPv4' && !net.internal)
    .map((net) => net!.address);
}

function main(): void {
  const config = loadConfig();
  const db = openDb(config.DB_PATH);
  const live = new LiveHub(config.JWT_SECRET);
  const app = createApp({ db, config, live, now: () => new Date() });

  // 0.0.0.0 so the phone on the same Wi-Fi can reach the API.
  const server = serve({ fetch: app.fetch, port: config.PORT, hostname: '0.0.0.0' }, (info) => {
    log.info('server listening', { port: info.port, lan: lanAddresses().map((ip) => `http://${ip}:${info.port}`) });
  }) as Server;
  live.attach(server);

  const simulator = config.DEMO_SIMULATION ? new DemoSimulator({ db, live, config, now: () => new Date() }) : null;
  simulator?.start();

  const shutdown = (signal: string) => {
    log.info('shutting down', { signal });
    simulator?.stop();
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
