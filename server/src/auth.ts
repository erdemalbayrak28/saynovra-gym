import { createHmac, randomBytes, scrypt, timingSafeEqual } from 'node:crypto';
import { sign, verify } from 'hono/jwt';
import type { AccountRole, GateSigner, StaffRole } from '../../shared/contract.ts';

// ---------------------------------------------------------------------------
// Passwords and PINs (scrypt, async so logins never block the event loop)
// ---------------------------------------------------------------------------

const SCRYPT_KEY_LENGTH = 32;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1, maxmem: 64 * 1024 * 1024 };

function scryptAsync(secret: string, salt: Buffer, keyLength: number): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    scrypt(secret, salt, keyLength, SCRYPT_OPTIONS, (err, key) => (err ? reject(err) : resolve(key)));
  });
}

export async function hashSecret(plain: string): Promise<string> {
  const salt = randomBytes(16);
  const key = await scryptAsync(plain, salt, SCRYPT_KEY_LENGTH);
  return `scrypt$${salt.toString('hex')}$${key.toString('hex')}`;
}

export async function verifySecret(plain: string, stored: string): Promise<boolean> {
  const [scheme, saltHex, keyHex] = stored.split('$');
  if (scheme !== 'scrypt' || !saltHex || !keyHex) return false;
  const expected = Buffer.from(keyHex, 'hex');
  const actual = await scryptAsync(plain, Buffer.from(saltHex, 'hex'), expected.length);
  return timingSafeEqual(actual, expected);
}

// ---------------------------------------------------------------------------
// Gate code keys
// ---------------------------------------------------------------------------

export function newQrSecret(): string {
  return randomBytes(32).toString('hex');
}

export function gateSigner(qrSecretHex: string): GateSigner {
  const key = Buffer.from(qrSecretHex, 'hex');
  return (message) => createHmac('sha256', key).update(message).digest('hex');
}

// ---------------------------------------------------------------------------
// Tokens (stateless JWT, HS256 pinned on both sign and verify)
// ---------------------------------------------------------------------------

/** App accounts (member, trainer) sign in with phone and password; staff (owner, desk) with a PIN. */
export type Role = AccountRole | StaffRole;

export interface AuthClaims {
  sub: number;
  role: Role;
  /**
   * App account tokens only: members.session_epoch when the token was issued. A password reset bumps
   * the epoch, so older tokens stop working without the server keeping sessions. Tokens issued
   * before epochs existed carry none and count as 0.
   */
  ep?: number;
}

const TOKEN_TTL_SECONDS: Record<Role, number> = {
  member: 30 * 24 * 60 * 60,
  trainer: 30 * 24 * 60 * 60,
  owner: 12 * 60 * 60,
  desk: 12 * 60 * 60,
};

export function issueToken(secret: string, claims: AuthClaims, nowMs = Date.now()): Promise<string> {
  const iat = Math.floor(nowMs / 1000);
  const epoch = isAccount(claims.role) ? { ep: claims.ep ?? 0 } : {};
  return sign({ sub: claims.sub, role: claims.role, ...epoch, iat, exp: iat + TOKEN_TTL_SECONDS[claims.role] }, secret, 'HS256');
}

export async function readToken(secret: string, token: string): Promise<AuthClaims | null> {
  if (!token) return null;
  try {
    const { sub, role, ep } = await verify(token, secret, 'HS256');
    if (typeof sub !== 'number' || !isRole(role)) return null;
    if (!isAccount(role)) return { sub, role };
    if (ep !== undefined && (typeof ep !== 'number' || !Number.isInteger(ep) || ep < 0)) return null;
    return { sub, role, ep: ep ?? 0 };
  } catch {
    return null;
  }
}

/** App account tokens must carry the account's current session epoch; staff tokens need no check. */
export function sessionIsCurrent(claims: AuthClaims, currentEpoch: (memberId: number) => number | undefined): boolean {
  if (!isAccount(claims.role)) return true;
  const epoch = currentEpoch(claims.sub);
  return epoch !== undefined && epoch === (claims.ep ?? 0);
}

function isRole(value: unknown): value is Role {
  return value === 'member' || value === 'trainer' || value === 'owner' || value === 'desk';
}

function isAccount(role: Role): role is AccountRole {
  return role === 'member' || role === 'trainer';
}

export function isStaff(claims: AuthClaims): boolean {
  return claims.role === 'owner' || claims.role === 'desk';
}
