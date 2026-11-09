import { z } from 'zod';

const configSchema = z.object({
  PORT: z.coerce.number().int().min(1).max(65535).default(3000),
  JWT_SECRET: z.string().min(32, 'must be at least 32 characters'),
  DB_PATH: z.string().min(1).default('./data/novra.db'),
  GYM_CAPACITY: z.coerce.number().int().positive().default(85),
  GYM_TIMEZONE: z.string().min(1).default('Europe/Istanbul'),
  /** Demo only: fictional members walk in and out and the scripted buddies use the radar. */
  DEMO_SIMULATION: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  /** With the simulation on, keep at least this many members inside so the radar is never empty. */
  DEMO_MIN_INSIDE: z.coerce.number().int().min(0).max(500).default(12),
});

export type Config = z.infer<typeof configSchema>;

/** Validates the environment once at startup; the process refuses to start on bad config. */
export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const parsed = configSchema.safeParse(env);
  if (!parsed.success) {
    const lines = parsed.error.issues.map((issue) => `  ${issue.path.join('.')}: ${issue.message}`);
    throw new Error(`Invalid configuration (see server/.env.example):\n${lines.join('\n')}`);
  }
  try {
    new Intl.DateTimeFormat('en-CA', { timeZone: parsed.data.GYM_TIMEZONE });
  } catch {
    throw new Error(`Invalid configuration: GYM_TIMEZONE "${parsed.data.GYM_TIMEZONE}" is not a known time zone`);
  }
  return parsed.data;
}
