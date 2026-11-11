import type { MiddlewareHandler } from 'hono';
import { readToken, sessionIsCurrent, type AuthClaims, type Role } from './auth.ts';
import type { Db } from './db.ts';
import { HttpProblem } from './problem.ts';
import { memberSessionEpoch } from './queries.ts';

export type AppEnv = { Variables: { auth: AuthClaims } };

export interface AuthContext {
  secret: string;
  db: Db;
}

const SIGN_IN_AGAIN = 'Lütfen yeniden giriş yapın';

/**
 * Rejects the request unless it carries a valid bearer token for one of `roles`. Member tokens
 * must also match the member's session epoch (a password reset signs out older sessions).
 */
export function requireRole({ secret, db }: AuthContext, ...roles: Role[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const header = c.req.header('Authorization') ?? '';
    const token = header.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    const claims = await readToken(secret, token);
    if (!claims) throw new HttpProblem(401, 'Oturum gerekli', SIGN_IN_AGAIN);
    if (!roles.includes(claims.role)) throw new HttpProblem(403, 'Yetki yok');
    if (!sessionIsCurrent(claims, (id) => memberSessionEpoch(db, id))) {
      throw new HttpProblem(401, 'Oturum sona erdi', SIGN_IN_AGAIN);
    }
    c.set('auth', claims);
    await next();
  };
}
