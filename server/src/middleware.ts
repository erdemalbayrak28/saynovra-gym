import type { MiddlewareHandler } from 'hono';
import { readToken, type AuthClaims, type Role } from './auth.ts';
import { HttpProblem } from './problem.ts';

export type AppEnv = { Variables: { auth: AuthClaims } };

/** Rejects the request unless it carries a valid bearer token for one of `roles`. */
export function requireRole(secret: string, ...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    const claims = await readToken(secret, token);
    if (!claims) throw new HttpProblem(401, 'Oturum gerekli', 'Lütfen yeniden giriş yapın');
    if (!roles.includes(claims.role)) throw new HttpProblem(403, 'Yetki yok');
    c.set('auth', claims);
    await next();
  };
}
