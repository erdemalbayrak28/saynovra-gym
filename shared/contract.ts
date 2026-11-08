// Contract shared by server, web and mobile.
// Every runtime loads this file directly (Node type stripping, Vite, Metro), so it must stay
// dependency-free and import-free. Signing is injected by each runtime (see GateSigner).

// ---------------------------------------------------------------------------
// Gate codes
// ---------------------------------------------------------------------------

export const GATE_CODE_PREFIX = 'NG1';
export const GATE_STEP_SECONDS = 30;
export const GATE_SIGNATURE_LENGTH = 16;
/** Steps accepted on either side of "now", to absorb clock drift between phone and gate. */
export const GATE_STEP_TOLERANCE = 1;

export type GateDirection = 'in' | 'out';

export interface GateCode {
  memberId: number;
  step: number;
  direction: GateDirection;
  signature: string;
}

/** Returns the lowercase hex HMAC-SHA256 of `message`, keyed with the member's qr secret. */
export type GateSigner = (message: string) => string;

const DIRECTION_CHAR: Record<GateDirection, string> = { in: 'i', out: 'o' };
const CODE_PATTERN = new RegExp(
  `^${GATE_CODE_PREFIX}\\.(\\d{1,9})\\.(\\d{1,12})\\.([io])\\.([0-9a-f]{${GATE_SIGNATURE_LENGTH}})$`,
);

export function gateStep(unixMs: number): number {
  return Math.floor(unixMs / 1000 / GATE_STEP_SECONDS);
}

export function msUntilNextStep(unixMs: number): number {
  const stepMs = GATE_STEP_SECONDS * 1000;
  return stepMs - (unixMs % stepMs);
}

/** The exact string that gets signed. Changing it invalidates every code in circulation. */
export function gateMessage(memberId: number, step: number, direction: GateDirection): string {
  return `${memberId}.${step}.${direction}`;
}

export function createGateCode(
  memberId: number,
  direction: GateDirection,
  unixMs: number,
  sign: GateSigner,
): string {
  const step = gateStep(unixMs);
  const signature = sign(gateMessage(memberId, step, direction)).slice(0, GATE_SIGNATURE_LENGTH);
  return [GATE_CODE_PREFIX, memberId, step, DIRECTION_CHAR[direction], signature].join('.');
}

export function parseGateCode(raw: string): GateCode | null {
  const match = CODE_PATTERN.exec(raw.trim());
  if (!match) return null;
  const [, memberId, step, directionChar, signature] = match;
  if (!memberId || !step || !directionChar || !signature) return null;
  return {
    memberId: Number(memberId),
    step: Number(step),
    direction: directionChar === 'i' ? 'in' : 'out',
    signature,
  };
}

// ---------------------------------------------------------------------------
// Gate outcomes
// ---------------------------------------------------------------------------

export type GateDenyReason =
  | 'invalid_format'
  | 'unknown_member'
  | 'bad_signature'
  | 'expired_code'
  | 'replayed'
  | 'no_membership'
  | 'membership_frozen'
  | 'membership_expired'
  | 'membership_cancelled'
  | 'already_inside'
  | 'not_inside';

export const GATE_REASON_TEXT: Record<GateDenyReason, string> = {
  invalid_format: 'Kod okunamadı',
  unknown_member: 'Üye bulunamadı',
  bad_signature: 'Geçersiz kod',
  expired_code: 'Kodun süresi geçmiş. Ekran görüntüsü kabul edilmez',
  replayed: 'Bu kod zaten kullanıldı',
  no_membership: 'Aktif üyelik yok',
  membership_frozen: 'Üyelik dondurulmuş',
  membership_expired: 'Üyelik süresi dolmuş',
  membership_cancelled: 'Üyelik iptal edilmiş',
  already_inside: 'Zaten içeride görünüyorsunuz',
  not_inside: 'İçeride görünmüyorsunuz',
};

// ---------------------------------------------------------------------------
// API shapes
// ---------------------------------------------------------------------------

export type MembershipStatus = 'active' | 'frozen' | 'expired' | 'cancelled';
export type StaffRole = 'owner' | 'desk';
export type MemberGoal = 'lose' | 'gain' | 'fit' | 'strength';

export interface Problem {
  type: string;
  title: string;
  status: number;
  detail?: string;
  errors?: { path: string; message: string }[];
}

export interface GymStatus {
  insideCount: number;
  capacity: number;
}

export interface MembershipSummary {
  planName: string;
  status: MembershipStatus;
  startsOn: string;
  endsOn: string;
  daysLeft: number;
}

export interface MemberProfile {
  id: number;
  fullName: string;
  phone: string;
  birthYear: number | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: MemberGoal | null;
}

export interface MemberLoginResponse {
  token: string;
  /** Hex-encoded HMAC key for gate codes. Returned only at login; store it in secure storage. */
  qrSecret: string;
  member: MemberProfile;
}

export interface StaffLoginResponse {
  token: string;
  staff: { id: number; name: string; role: StaffRole };
}

export interface MeResponse {
  member: MemberProfile;
  membership: MembershipSummary | null;
  isInside: boolean;
  lastCheckinAt: string | null;
  gym: GymStatus;
}

export interface CheckinMember {
  id: number;
  fullName: string;
  initials: string;
  planName: string | null;
  daysLeft: number | null;
}

export interface CheckinDto {
  id: number;
  at: string;
  direction: GateDirection | null;
  result: 'granted' | 'denied';
  reason: GateDenyReason | null;
  member: CheckinMember | null;
}

export interface GateScanRequest {
  code: string;
}

export interface GateScanResponse {
  checkin: CheckinDto;
  reasonText: string | null;
  gym: GymStatus;
}

export interface StaffSummary {
  gym: GymStatus;
  todayGranted: number;
  todayDenied: number;
}

export type LiveEvent = { type: 'checkin'; checkin: CheckinDto; gym: GymStatus };
