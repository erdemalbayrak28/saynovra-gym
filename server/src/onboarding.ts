import { randomBytes, randomInt } from 'node:crypto';
import {
  ACTIVATION_CODE_LENGTH,
  ACTIVATION_CODE_TTL_MINUTES,
  ACTIVATION_MAX_ATTEMPTS,
  type ActivationCodeResponse,
  type CreateMemberRequest,
} from '../../shared/contract.ts';
import { hashSecret, newQrSecret, verifySecret } from './auth.ts';
import { transaction, type Db } from './db.ts';
import { HttpProblem } from './problem.ts';
import { findMemberById, findMemberByPhone, type MemberRow } from './queries.ts';
import { insertSale, type StaffAction } from './reception.ts';

const MINUTE_MS = 60_000;
const INVALID_CODE = 'Kod hatalı ya da süresi dolmuş. Resepsiyondan yeni kod isteyin.';

// Checked against when the phone or code is unknown, so every failure costs one scrypt.
let decoyCodeHash: Promise<string> | undefined;
const decoy = () => (decoyCodeHash ??= hashSecret('decoy-activation-code'));

export function newActivationCode(): string {
  return randomInt(0, 10 ** ACTIVATION_CODE_LENGTH).toString().padStart(ACTIVATION_CODE_LENGTH, '0');
}

interface PreparedCode {
  code: string;
  hash: string;
}

// scrypt is async and transactions are synchronous, so hashes are made before the transaction.
async function prepareCode(): Promise<PreparedCode> {
  const code = newActivationCode();
  return { code, hash: await hashSecret(code) };
}

/** Revokes any open code of the member and stores a new one. Call inside a transaction. */
function insertActivation(db: Db, memberId: number, prepared: PreparedCode, action: StaffAction): ActivationCodeResponse {
  const stamp = action.now.toISOString();
  db.prepare(
    `UPDATE member_activations SET revoked_at = ?, modified_at = ?
     WHERE member_id = ? AND used_at IS NULL AND revoked_at IS NULL`,
  ).run(stamp, stamp, memberId);
  const expiresAt = new Date(action.now.getTime() + ACTIVATION_CODE_TTL_MINUTES * MINUTE_MS).toISOString();
  db.prepare(
    `INSERT INTO member_activations (member_id, code_hash, expires_at, created_at, created_by, modified_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
  ).run(memberId, prepared.hash, expiresAt, stamp, action.staffId, stamp);
  return { code: prepared.code, expiresAt };
}

/**
 * Opens an account at reception: member row, KVKK decisions, optional first package and an
 * activation code, all in one transaction. The account has no usable password until the member
 * activates it. `request` must already be validated (optional fields only with consent).
 */
export async function registerMember(
  db: Db,
  request: CreateMemberRequest,
  action: StaffAction,
): Promise<{ memberId: number; activation: ActivationCodeResponse }> {
  // A hash of 32 random bytes nobody knows: no password matches it before activation.
  const [prepared, lockedHash] = await Promise.all([prepareCode(), hashSecret(randomBytes(32).toString('hex'))]);

  return transaction(db, () => {
    if (findMemberByPhone(db, request.phone)) {
      throw new HttpProblem(409, 'Kayıt yapılamadı', 'Bu telefon numarasıyla kayıtlı bir üye var', [
        { path: 'phone', message: 'Bu numarayla kayıtlı üye var' },
      ]);
    }
    const stamp = action.now.toISOString();
    const { profile } = request;
    const result = db
      .prepare(
        `INSERT INTO members (full_name, phone, password_hash, birth_year, gender, height_cm, weight_kg, goal, qr_secret,
           created_at, modified_at, created_by, modified_by)
         VALUES (:fullName, :phone, :passwordHash, :birthYear, :gender, :heightCm, :weightKg, :goal, :qrSecret,
           :stamp, :stamp, :staffId, :staffId)`,
      )
      .run({
        fullName: request.fullName,
        phone: request.phone,
        passwordHash: lockedHash,
        birthYear: profile.birthYear,
        gender: profile.gender,
        heightCm: profile.heightCm,
        weightKg: profile.weightKg,
        goal: profile.goal,
        qrSecret: newQrSecret(),
        stamp,
        staffId: action.staffId,
      });
    const memberId = Number(result.lastInsertRowid);

    const consent = db.prepare(
      'INSERT INTO member_consents (member_id, kind, version, granted, created_at, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    );
    consent.run(memberId, 'notice', request.noticeVersion, 1, stamp, action.staffId);
    consent.run(memberId, 'optional_data', request.noticeVersion, request.consents.optionalData ? 1 : 0, stamp, action.staffId);

    if (request.sale) insertSale(db, memberId, request.sale, action);
    return { memberId, activation: insertActivation(db, memberId, prepared, action) };
  });
}

/**
 * A fresh activation code for an existing member. Also the password reset: the member sets a new
 * password with it, which signs out every older session.
 */
export async function issueActivation(db: Db, memberId: number, action: StaffAction): Promise<ActivationCodeResponse> {
  const prepared = await prepareCode();
  return transaction(db, () => {
    if (!findMemberById(db, memberId)) throw new HttpProblem(404, 'Üye bulunamadı');
    return insertActivation(db, memberId, prepared, action);
  });
}

interface OpenActivation {
  id: number;
  code_hash: string;
  expires_at: string;
}

/**
 * Uses an activation code: sets the member's password, marks the account activated and bumps the
 * session epoch. Unknown phone, wrong code and expired code all give the same answer. Every wrong
 * guess counts against the open code; at ACTIVATION_MAX_ATTEMPTS it is revoked.
 */
export async function activateMember(db: Db, input: { phone: string; code: string; password: string }, now: Date): Promise<MemberRow> {
  const member = findMemberByPhone(db, input.phone);
  const open = member
    ? (db
        .prepare('SELECT id, code_hash, expires_at FROM member_activations WHERE member_id = ? AND used_at IS NULL AND revoked_at IS NULL')
        .get(member.id) as OpenActivation | undefined)
    : undefined;
  const matches = await verifySecret(input.code, open?.code_hash ?? (await decoy()));
  const stamp = now.toISOString();

  if (!member || !open || !matches || open.expires_at <= stamp) {
    if (open && !matches) {
      db.prepare(
        `UPDATE member_activations
         SET failed_attempts = failed_attempts + 1,
             revoked_at = CASE WHEN failed_attempts + 1 >= :max THEN :stamp ELSE NULL END,
             modified_at = :stamp
         WHERE id = :id AND used_at IS NULL AND revoked_at IS NULL`,
      ).run({ id: open.id, stamp, max: ACTIVATION_MAX_ATTEMPTS });
    }
    throw new HttpProblem(400, 'Etkinleştirilemedi', INVALID_CODE);
  }

  const passwordHash = await hashSecret(input.password);
  return transaction(db, () => {
    // Another request may have used or revoked the code while the password was being hashed.
    const claimed = db
      .prepare(
        `UPDATE member_activations SET used_at = :stamp, modified_at = :stamp
         WHERE id = :id AND used_at IS NULL AND revoked_at IS NULL AND expires_at > :stamp`,
      )
      .run({ id: open.id, stamp });
    if (claimed.changes !== 1) throw new HttpProblem(400, 'Etkinleştirilemedi', INVALID_CODE);
    db.prepare(
      `UPDATE members SET password_hash = ?, activated_at = COALESCE(activated_at, ?), session_epoch = session_epoch + 1,
         modified_at = ?, modified_by = NULL
       WHERE id = ?`,
    ).run(passwordHash, stamp, stamp, member.id);
    const updated = findMemberById(db, member.id);
    if (!updated) throw new Error('Member vanished during activation');
    return updated;
  });
}
