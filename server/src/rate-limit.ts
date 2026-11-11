import type { Context } from 'hono';
import { getConnInfo } from '@hono/node-server/conninfo';
import { HttpProblem } from './problem.ts';

const MINUTE_MS = 60_000;
/** Entries are pruned once the map grows past this, so a flood of keys cannot grow it without bound. */
const PRUNE_ABOVE = 5_000;

interface Entry {
  failures: number;
  windowStart: number;
  lockedUntil: number;
}

/**
 * Counts failed attempts per key (a phone number, a client address). `max` failures within
 * `windowMs` lock the key for `lockMs`. State lives in this process: enough for one server; several
 * servers would need a shared store. It holds no sessions, only failure counters.
 */
export class AttemptLimiter {
  #entries = new Map<string, Entry>();
  #max: number;
  #windowMs: number;
  #lockMs: number;
  #now: () => Date;

  constructor(options: { max: number; windowMinutes: number; lockMinutes: number; now: () => Date }) {
    this.#max = options.max;
    this.#windowMs = options.windowMinutes * MINUTE_MS;
    this.#lockMs = options.lockMinutes * MINUTE_MS;
    this.#now = options.now;
  }

  /** Milliseconds the key stays locked; 0 when it may try. */
  lockedFor(key: string): number {
    const entry = this.#entries.get(key);
    return entry ? Math.max(0, entry.lockedUntil - this.#now().getTime()) : 0;
  }

  fail(key: string): void {
    const at = this.#now().getTime();
    const previous = this.#entries.get(key);
    const current = previous && at - previous.windowStart < this.#windowMs ? previous : { failures: 0, windowStart: at, lockedUntil: 0 };
    const failures = current.failures + 1;
    this.#entries.set(key, {
      failures,
      windowStart: current.windowStart,
      lockedUntil: failures >= this.#max ? at + this.#lockMs : current.lockedUntil,
    });
    if (this.#entries.size > PRUNE_ABOVE) this.#prune(at);
  }

  reset(key: string): void {
    this.#entries.delete(key);
  }

  #prune(at: number): void {
    for (const [key, entry] of this.#entries) {
      if (entry.lockedUntil <= at && at - entry.windowStart >= this.#windowMs) this.#entries.delete(key);
    }
  }
}

/** Refuses with 429 and Retry-After while any of the keys is locked. */
export function refuseIfLocked(...checks: [AttemptLimiter, string][]): void {
  const waitMs = Math.max(0, ...checks.map(([limiter, key]) => limiter.lockedFor(key)));
  if (waitMs <= 0) return;
  const minutes = Math.ceil(waitMs / MINUTE_MS);
  throw new HttpProblem(429, 'Çok fazla deneme', `Çok fazla deneme. ${minutes} dakika sonra tekrar dene.`, undefined, {
    'Retry-After': String(Math.ceil(waitMs / 1000)),
  });
}

/**
 * The address the connection came from. No proxy sits in front of this server, so forwarding
 * headers (which a client can set to anything) are not read.
 */
export function clientAddress(c: Context): string {
  try {
    return getConnInfo(c).remote.address ?? 'unknown';
  } catch {
    return 'unknown'; // No socket (in-process requests in tests).
  }
}
