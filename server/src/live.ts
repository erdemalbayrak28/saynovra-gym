import type { IncomingMessage, Server } from 'node:http';
import type { Duplex } from 'node:stream';
import { WebSocketServer, type WebSocket } from 'ws';
import type { LiveEvent } from '../../shared/contract.ts';
import { readToken, type AuthClaims } from './auth.ts';
import { errorFields, log } from './log.ts';

const LIVE_PATH = '/live';
const HEARTBEAT_MS = 30_000;

interface Client {
  claims: AuthClaims;
  alive: boolean;
}

/**
 * Push channel at /live?token=<jwt>. Browsers cannot set headers on WebSocket requests, so the
 * token travels in the query string; it is verified before the upgrade and never logged.
 */
export class LiveHub {
  #secret: string;
  #wss = new WebSocketServer({ noServer: true });
  #clients = new Map<WebSocket, Client>();
  #heartbeat: NodeJS.Timeout | undefined;

  constructor(secret: string) {
    this.#secret = secret;
  }

  attach(server: Server): void {
    server.on('upgrade', (req, socket, head) => {
      this.#handleUpgrade(req, socket, head).catch((err: unknown) => {
        log.error('live upgrade failed', errorFields(err));
        socket.destroy();
      });
    });
    this.#heartbeat = setInterval(() => this.#sweep(), HEARTBEAT_MS);
    this.#heartbeat.unref();
  }

  publish(event: LiveEvent, audience: (claims: AuthClaims) => boolean): void {
    const payload = JSON.stringify(event);
    for (const [socket, client] of this.#clients) {
      if (socket.readyState === socket.OPEN && audience(client.claims)) socket.send(payload);
    }
  }

  close(): void {
    clearInterval(this.#heartbeat);
    for (const socket of this.#clients.keys()) socket.terminate();
    this.#wss.close();
  }

  async #handleUpgrade(req: IncomingMessage, socket: Duplex, head: Buffer): Promise<void> {
    const url = new URL(req.url ?? '/', 'http://localhost');
    if (url.pathname !== LIVE_PATH) {
      socket.destroy();
      return;
    }
    const claims = await readToken(this.#secret, url.searchParams.get('token') ?? '');
    if (!claims) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n');
      return;
    }
    this.#wss.handleUpgrade(req, socket, head, (ws) => this.#register(ws, claims));
  }

  #register(socket: WebSocket, claims: AuthClaims): void {
    const client: Client = { claims, alive: true };
    this.#clients.set(socket, client);
    socket.on('pong', () => {
      client.alive = true;
    });
    socket.on('close', () => this.#clients.delete(socket));
    socket.on('error', (err) => {
      log.warn('live socket error', { error: err.message, role: claims.role });
      this.#clients.delete(socket);
    });
  }

  #sweep(): void {
    for (const [socket, client] of this.#clients) {
      if (!client.alive) {
        socket.terminate();
        this.#clients.delete(socket);
        continue;
      }
      client.alive = false;
      socket.ping();
    }
  }
}
