// Contract shared by server, web and mobile.
// Every runtime loads this file directly (Node type stripping, Vite, Metro), so it must stay
// dependency-free and import-free. Signing is injected by each runtime (see GateSigner).

// ---------------------------------------------------------------------------
// Gate codes
// ---------------------------------------------------------------------------

// Code: NG2.<memberId>.<step>.<i|o>.<seq>.<signature>
// `seq` is the id of the member's last granted gate pass (0 if none). Every pass changes it, so a
// code stops working the moment it (or any later code) is used: screenshots cannot be replayed.
export const GATE_CODE_PREFIX = 'NG2';
export const GATE_STEP_SECONDS = 30;
export const GATE_SIGNATURE_LENGTH = 16;
/** Steps accepted on either side of "now", to absorb clock drift between phone and gate. */
export const GATE_STEP_TOLERANCE = 1;

export type GateDirection = 'in' | 'out';

export interface GateCode {
  memberId: number;
  step: number;
  direction: GateDirection;
  seq: number;
  signature: string;
}

/** Returns the lowercase hex HMAC-SHA256 of `message`, keyed with the member's qr secret. */
export type GateSigner = (message: string) => string;

const DIRECTION_CHAR: Record<GateDirection, string> = { in: 'i', out: 'o' };
const CODE_PATTERN = new RegExp(
  `^${GATE_CODE_PREFIX}\\.(\\d{1,9})\\.(\\d{1,12})\\.([io])\\.(\\d{1,12})\\.([0-9a-f]{${GATE_SIGNATURE_LENGTH}})$`,
);

export function gateStep(unixMs: number): number {
  return Math.floor(unixMs / 1000 / GATE_STEP_SECONDS);
}

export function msUntilNextStep(unixMs: number): number {
  const stepMs = GATE_STEP_SECONDS * 1000;
  return stepMs - (unixMs % stepMs);
}

/** The exact string that gets signed. Changing it invalidates every code in circulation. */
export function gateMessage(memberId: number, step: number, direction: GateDirection, seq: number): string {
  return `${memberId}.${step}.${direction}.${seq}`;
}

export function createGateCode(
  memberId: number,
  direction: GateDirection,
  seq: number,
  unixMs: number,
  sign: GateSigner,
): string {
  const step = gateStep(unixMs);
  const signature = sign(gateMessage(memberId, step, direction, seq)).slice(0, GATE_SIGNATURE_LENGTH);
  return [GATE_CODE_PREFIX, memberId, step, DIRECTION_CHAR[direction], seq, signature].join('.');
}

// Gate messages always start with a digit, so this label can never be confused with one.
const QR_KEY_ID_LABEL = 'novra:qr-key-id';

/**
 * Short fingerprint of a member's gate key. It is an HMAC of a fixed label, so it reveals nothing
 * about the key and cannot sign a gate message. The phone compares its own with the one in /me to
 * notice a key that changed on the server (a reset demo database) and fetches the new key.
 */
export function qrKeyId(sign: GateSigner): string {
  return sign(QR_KEY_ID_LABEL).slice(0, GATE_SIGNATURE_LENGTH);
}

export function parseGateCode(raw: string): GateCode | null {
  const match = CODE_PATTERN.exec(raw.trim());
  if (!match) return null;
  const [, memberId, step, directionChar, seq, signature] = match;
  if (!memberId || !step || !directionChar || !seq || !signature) return null;
  return {
    memberId: Number(memberId),
    step: Number(step),
    direction: directionChar === 'i' ? 'in' : 'out',
    seq: Number(seq),
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
  | 'stale_code'
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
  stale_code: 'Bu kod artık geçerli değil. Telefondaki güncel kodu gösterin',
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
export type MemberGender = 'f' | 'm' | 'x';

export const MEMBER_GOAL_TEXT: Record<MemberGoal, string> = {
  lose: 'Kilo vermek',
  gain: 'Kas kazanmak',
  fit: 'Formda kalmak',
  strength: 'Güçlenmek',
};

export const MEMBER_GENDER_TEXT: Record<MemberGender, string> = {
  f: 'Kadın',
  m: 'Erkek',
  x: 'Belirtmek istemiyor',
};

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

export interface MyConsentsResponse {
  consents: ConsentDto[];
}

export interface MemberLoginResponse {
  token: string;
  /** Hex-encoded HMAC key for gate codes. Store it in secure storage; /me/qr-key hands out a changed one. */
  qrSecret: string;
  member: MemberProfile;
}

export interface QrKeyResponse {
  qrSecret: string;
  qrKeyId: string;
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
  /** Goes into the gate code; see GateCode.seq. */
  presenceSeq: number;
  /** Fingerprint of the current gate key (see qrKeyId); differs from the phone's when its key is out of date. */
  qrKeyId: string;
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

export type LiveEvent =
  | { type: 'checkin'; checkin: CheckinDto; gym: GymStatus }
  /** The list of open spotter posts changed; radar screens refetch. */
  | { type: 'radar' }
  /** A spot request was created or changed state; sent to both members involved. */
  | { type: 'spot_request'; request: SpotRequestDto }
  | { type: 'spot_message'; message: SpotMessageDto }
  /** Gym floor feed for staff screens. */
  | { type: 'floor'; event: FloorEvent }
  /** Reception changed a member's membership; sent to staff screens and to that member's phone. */
  | { type: 'membership'; memberId: number }
  /** A member was registered or activated their account; staff screens refetch. */
  | { type: 'member'; memberId: number };

// ---------------------------------------------------------------------------
// Reception
// ---------------------------------------------------------------------------

export type PaymentMethod = 'cash' | 'card' | 'transfer';
export type MembershipEventType = 'sale' | 'freeze' | 'unfreeze' | 'cancel';

export const PAYMENT_METHOD_TEXT: Record<PaymentMethod, string> = {
  cash: 'Nakit',
  card: 'Kart',
  transfer: 'Havale',
};

export const MEMBERSHIP_STATUS_TEXT: Record<MembershipStatus, string> = {
  active: 'Aktif',
  frozen: 'Dondurulmuş',
  expired: 'Süresi dolmuş',
  cancelled: 'İptal edildi',
};

/** Searches need this many characters; shorter input lists memberships that end soon instead. */
export const MEMBER_SEARCH_MIN = 2;
/** "Ends soon" window for the reception list and summary, in days. */
export const EXPIRING_WITHIN_DAYS = 7;

export interface PlanDto {
  id: number;
  name: string;
  durationDays: number;
  priceKurus: number;
  freezeDaysAllowed: number;
}

export interface MemberListItem {
  id: number;
  fullName: string;
  phone: string;
  initials: string;
  /** The membership that governs today, if any has started. */
  membership: MembershipSummary | null;
  isInside: boolean;
  /** Has set a password in the app; false until the first activation code is used. */
  activated: boolean;
}

export interface MembershipDetail {
  id: number;
  planName: string;
  /** Effective status: an active membership past its last day reads as expired. */
  status: MembershipStatus;
  startsOn: string;
  endsOn: string;
  daysLeft: number;
  priceKurus: number;
  freezeDaysAllowed: number;
  freezeDaysUsed: number;
  frozenFrom: string | null;
  /** Sold in advance: starts after today. */
  upcoming: boolean;
}

export interface MembershipEventDto {
  id: number;
  membershipId: number;
  type: MembershipEventType;
  at: string;
  planName: string;
  staffName: string;
  /** Days credited back on unfreeze. */
  days: number | null;
  amountKurus: number | null;
  method: PaymentMethod | null;
}

export interface MemberDetail {
  member: MemberListItem;
  birthYear: number | null;
  joinedAt: string;
  lastVisitAt: string | null;
  visitsLast30Days: number;
  /** Same as member.membership, with the fields reception acts on. */
  current: MembershipDetail | null;
  /** Newest first, including upcoming, expired and cancelled ones. */
  memberships: MembershipDetail[];
  /** Append-only record of reception actions, newest first. */
  history: MembershipEventDto[];
  activatedAt: string | null;
  /** Expiry of an activation code that can still be used, if one was handed out. */
  activationExpiresAt: string | null;
  /** KVKK decisions, newest first. */
  consents: ConsentDto[];
}

export interface SellMembershipRequest {
  planId: number;
  method: PaymentMethod;
}

// ---------------------------------------------------------------------------
// Onboarding: reception opens the account, the member activates it with a one-time code
// ---------------------------------------------------------------------------

export const ACTIVATION_CODE_LENGTH = 6;
export const ACTIVATION_CODE_TTL_MINUTES = 15;
/** Wrong guesses a code survives; after that reception has to hand out a new one. */
export const ACTIVATION_MAX_ATTEMPTS = 5;
export const PASSWORD_MIN_LENGTH = 8;

export type ConsentKind = 'notice' | 'optional_data';

export interface ConsentDto {
  kind: ConsentKind;
  version: string;
  granted: boolean;
  at: string;
  staffName: string | null;
}

export interface NewMemberProfile {
  birthYear: number | null;
  gender: MemberGender | null;
  heightCm: number | null;
  weightKg: number | null;
  goal: MemberGoal | null;
}

export interface CreateMemberRequest {
  fullName: string;
  phone: string;
  /** Must equal KVKK_NOTICE_VERSION (shared/consent.ts): the text the member was shown. */
  noticeVersion: string;
  /** Notice acknowledged (required) and explicit consent for the optional profile fields. */
  consents: { notice: true; optionalData: boolean };
  /** Every field must be null unless consents.optionalData is true. */
  profile: NewMemberProfile;
  /** First package, sold in the same step; null to register without one. */
  sale: SellMembershipRequest | null;
}

export interface ActivationCodeResponse {
  /** Shown once; the server keeps only a hash. */
  code: string;
  expiresAt: string;
}

export interface CreateMemberResponse {
  detail: MemberDetail;
  activation: ActivationCodeResponse;
}

export interface ActivateRequest {
  phone: string;
  code: string;
  password: string;
}

export interface ReceptionSummary {
  todayRevenueKurus: number;
  todaySales: number;
  /** Today's takings per payment method, in kuruş. */
  byMethod: Record<PaymentMethod, number>;
  activeMembers: number;
  frozenMembers: number;
  /** Active memberships ending within EXPIRING_WITHIN_DAYS with no renewal sold. */
  expiringSoon: number;
}

// ---------------------------------------------------------------------------
// Gym floor: occupancy and buddy radar
// ---------------------------------------------------------------------------

export type OccupancyLevel = 'calm' | 'normal' | 'busy';

export const OCCUPANCY_LEVEL_TEXT: Record<OccupancyLevel, string> = {
  calm: 'Sakin',
  normal: 'Normal',
  busy: 'Yoğun',
};

export interface HourlyOccupancy {
  hour: number;
  /** Average number of members inside at half past this hour, same weekday, last 4 weeks. */
  expected: number;
  pct: number;
}

export interface OccupancyResponse {
  insideCount: number;
  capacity: number;
  pct: number;
  level: OccupancyLevel;
  /** e.g. "Pazartesi": the hourly profile is built from this weekday. */
  weekdayName: string;
  currentHour: number;
  hours: HourlyOccupancy[];
  /** Quietest remaining hour today, if any. */
  quietestUpcoming: HourlyOccupancy | null;
}

export type MuscleGroup = 'chest_back' | 'shoulders_arms' | 'legs' | 'full_body';

export const MUSCLE_GROUP_TEXT: Record<MuscleGroup, string> = {
  chest_back: 'Göğüs & Sırt',
  shoulders_arms: 'Omuz & Kol',
  legs: 'Bacak',
  full_body: 'Tüm vücut',
};

/** Places on the gym floor a post can point to. A fixed list: no free-text locations. */
export const GYM_SPOTS = ['Bench 1', 'Bench 2', 'Squat rack 1', 'Squat rack 2', 'Kablo istasyonu', 'Serbest ağırlık', 'Makine alanı'] as const;
export type GymSpot = (typeof GYM_SPOTS)[number];

export const SPOT_NOTE_MAX = 140;
export const SPOT_MESSAGE_MAX = 280;

export type SpotRequestStatus = 'pending' | 'accepted' | 'declined' | 'cancelled' | 'expired';

/** How other members see someone: first name and initial only. */
export interface PublicMember {
  id: number;
  displayName: string;
  initials: string;
}

export interface SpotterPostDto {
  id: number;
  member: PublicMember;
  muscleGroup: MuscleGroup;
  location: GymSpot;
  note: string;
  createdAt: string;
  /** When the owner came through the gate. */
  enteredAt: string | null;
  mine: boolean;
  /** The viewer's request to this post, if any. */
  myRequest: { id: number; status: SpotRequestStatus } | null;
}

export interface SpotRequestDto {
  id: number;
  postId: number;
  status: SpotRequestStatus;
  from: PublicMember;
  to: PublicMember;
  location: GymSpot;
  muscleGroup: MuscleGroup;
  createdAt: string;
  modifiedAt: string;
}

export interface SpotMessageDto {
  id: number;
  requestId: number;
  senderId: number;
  body: string;
  createdAt: string;
}

export interface RadarResponse {
  /** The radar is only for members inside the gym. */
  inside: boolean;
  myPost: SpotterPostDto | null;
  /** Pending requests to my post. */
  incoming: SpotRequestDto[];
  /** My pending requests to others. */
  outgoing: SpotRequestDto[];
  /** Accepted pairings I am part of (chat is open while both are inside). */
  matches: SpotRequestDto[];
  posts: SpotterPostDto[];
}

export interface OpenPostRequest {
  muscleGroup: MuscleGroup;
  location: GymSpot;
  note: string;
}

export interface ChatResponse {
  request: SpotRequestDto;
  messages: SpotMessageDto[];
  canSend: boolean;
}

export interface FloorEvent {
  id: string;
  at: string;
  kind: 'post_opened' | 'matched';
  text: string;
}

// ---------------------------------------------------------------------------
// Training
// ---------------------------------------------------------------------------

export type ProgramGoal = 'beginner' | 'hypertrophy' | 'strength' | 'fat_loss';
export type ProgramLevel = 'beginner' | 'intermediate' | 'advanced';

export const PROGRAM_GOAL_TEXT: Record<ProgramGoal, string> = {
  beginner: 'Yeni başlayan',
  hypertrophy: 'Kas kazanımı',
  strength: 'Güç',
  fat_loss: 'Yağ yakımı',
};

export const PROGRAM_LEVEL_TEXT: Record<ProgramLevel, string> = {
  beginner: 'Başlangıç',
  intermediate: 'Orta',
  advanced: 'İleri',
};

export interface ProgramSummary {
  id: number;
  name: string;
  goal: ProgramGoal;
  level: ProgramLevel;
  daysPerWeek: number;
  weeks: number;
  description: string;
  dayCount: number;
}

export interface ExerciseInfo {
  id: number;
  name: string;
  muscleGroup: string;
  equipment: string;
  isBodyweight: boolean;
  cue: string;
}

export interface ProgramItemDto {
  id: number;
  exercise: ExerciseInfo;
  targetSets: number;
  repMin: number;
  repMax: number;
  restSec: number;
}

export interface ProgramDayDto {
  id: number;
  dayIndex: number;
  name: string;
  focus: string;
  items: ProgramItemDto[];
  estimatedMinutes: number;
}

export interface ProgramDetail extends ProgramSummary {
  days: ProgramDayDto[];
}

export type SuggestionKind = 'start' | 'increase' | 'hold' | 'deload' | 'bodyweight';

/** What the guided workout proposes for an exercise today, with the reason in plain Turkish. */
export interface Suggestion {
  weightKg: number | null;
  kind: SuggestionKind;
  reason: string;
}

export interface WorkoutSetDto {
  programItemId: number;
  setNo: number;
  weightKg: number | null;
  reps: number;
  rpe: number | null;
}

export interface WorkoutItemPlan {
  item: ProgramItemDto;
  suggestion: Suggestion;
  /** Previous session of this exercise, e.g. "30 kg · 10, 10, 9"; null the first time. */
  lastTime: string | null;
  doneSets: WorkoutSetDto[];
}

export interface WorkoutDto {
  id: number;
  startedAt: string;
  programName: string;
  dayIndex: number;
  dayCount: number;
  dayName: string;
  items: WorkoutItemPlan[];
}

export interface LogSetRequest {
  programItemId: number;
  setNo: number;
  weightKg: number | null;
  reps: number;
  rpe: number | null;
}

export interface WorkoutRecord {
  exerciseName: string;
  weightKg: number;
}

export interface WorkoutSummary {
  workoutId: number;
  durationMinutes: number;
  totalSets: number;
  totalReps: number;
  volumeKg: number;
  records: WorkoutRecord[];
  nextDayName: string;
}

export interface Enrollment {
  id: number;
  program: ProgramSummary;
  startedAt: string;
  completedWorkouts: number;
}

export interface MyTrainingResponse {
  enrollment: Enrollment | null;
  nextDay: ProgramDayDto | null;
  activeWorkoutId: number | null;
  weekWorkouts: number;
}

export interface ProgressExercise {
  exerciseId: number;
  name: string;
  sessions: number;
  bestWeightKg: number | null;
}

export interface ProgressWeek {
  weekStart: string;
  workouts: number;
  volumeKg: number;
}

export interface ProgressResponse {
  exercises: ProgressExercise[];
  weeks: ProgressWeek[];
}

export interface ExerciseProgressPoint {
  date: string;
  topWeightKg: number | null;
  topReps: number;
  volumeKg: number;
}

export interface ExerciseProgressResponse {
  exercise: ExerciseInfo;
  points: ExerciseProgressPoint[];
}
