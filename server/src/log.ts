// Structured one-line JSON logs. Never pass passwords, PINs, tokens or qr secrets here.

type Level = 'info' | 'warn' | 'error';

function write(level: Level, msg: string, fields: Record<string, unknown> = {}): void {
  const line = JSON.stringify({ at: new Date().toISOString(), level, msg, ...fields });
  if (level === 'error') console.error(line);
  else console.log(line);
}

export const log = {
  info: (msg: string, fields?: Record<string, unknown>) => write('info', msg, fields),
  warn: (msg: string, fields?: Record<string, unknown>) => write('warn', msg, fields),
  error: (msg: string, fields?: Record<string, unknown>) => write('error', msg, fields),
};

export function errorFields(err: unknown): Record<string, unknown> {
  if (err instanceof Error) return { error: err.message, stack: err.stack };
  return { error: String(err) };
}
