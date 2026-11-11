// Form analysis rules on top of body landmarks. Pure and dependency-free like contract.ts: the web
// form page and the phone feed it MediaPipe landmarks frame by frame, server/test/pose.test.ts
// drives it with synthetic motion. The landmarks come from a neural network; everything below is
// plain geometry and fixed thresholds, so every number on screen can be explained.

export type ExerciseId = 'squat' | 'bench' | 'shoulder_press' | 'biceps_curl' | 'triceps_pushdown';
export type Side = 'left' | 'right';
/**
 * Which way the measured angle moves while lifting: it opens on squats, presses and pushdowns,
 * and closes on curls.
 */
export type LiftDirection = 'opening' | 'closing';
/** Side view measures the arm or leg turned to the camera; front view averages both arms. */
export type CameraView = 'side' | 'front';

/** Normalised image coordinates (0..1, y pointing down), as MediaPipe Pose returns them. */
export interface PosePoint {
  x: number;
  y: number;
  visibility?: number;
}

type Chain = readonly [number, number, number];

/** What the counter's phases mean for this movement, for the screen. */
export interface PhaseLabels {
  top: string;
  down: string;
  bottom: string;
}

export interface ExerciseTexts {
  /** Coaching while the angle closes towards the bottom threshold ("İn", "Kaldır"). */
  down: string;
  /** Coaching once the bottom threshold is reached. */
  bottom: string;
  shallow: string;
  lean?: string;
  noLockout?: string;
  elbowDrift?: string;
  /** Metric captions: the deepest angle of a rep and the timed lifting phase. */
  depthLabel: string;
  liftLabel: string;
}

export interface ExerciseSpec {
  id: ExerciseId;
  name: string;
  /** What the measured angle is, for the screen. */
  angleLabel: string;
  view: CameraView;
  liftDirection: LiftDirection;
  /** Landmark indices, proximal → joint → distal, for each side of the body. */
  chains: Record<Side, Chain>;
  /** A rep is complete once the angle is back above this. */
  topAngle: number;
  /** A rep counts only if the angle went down to this or below. */
  bottomAngle: number;
  /** Full extension counts above this, judged on the highest point before the next rep; null when not judged. */
  lockoutAngle: number | null;
  /** Torso from vertical: judged at the deepest point or as the most during the rep; null when not judged. */
  lean: { at: 'deepest' | 'max'; maxDeg: number } | null;
  /** Torso to upper arm (the elbow drifting away from the body), the most during the rep; null when not judged. */
  maxElbowDriftDeg: number | null;
  phases: PhaseLabels;
  texts: ExerciseTexts;
  setupHint: string;
}

// MediaPipe Pose landmark indices.
const SHOULDER: Record<Side, number> = { left: 11, right: 12 };
const ELBOW: Record<Side, number> = { left: 13, right: 14 };
const HIP: Record<Side, number> = { left: 23, right: 24 };
const ARMS: Record<Side, Chain> = { left: [11, 13, 15], right: [12, 14, 16] };
const LEGS: Record<Side, Chain> = { left: [23, 25, 27], right: [24, 26, 28] };

export const EXERCISES: Record<ExerciseId, ExerciseSpec> = {
  squat: {
    id: 'squat',
    name: 'Squat',
    angleLabel: 'Diz açısı',
    view: 'side',
    liftDirection: 'opening',
    chains: LEGS,
    topAngle: 160,
    bottomAngle: 100,
    lockoutAngle: null,
    lean: { at: 'deepest', maxDeg: 50 },
    maxElbowDriftDeg: null,
    phases: { top: 'Üstte', down: 'İniyor', bottom: 'Dipte' },
    texts: {
      down: 'İn',
      bottom: 'Derinlik tamam, kalk',
      shallow: 'Yarım tekrar: daha derine in',
      lean: 'Gövde fazla öne eğildi, göğsü dik tut',
      depthLabel: 'Son derinlik',
      liftLabel: 'Dipten yukarı',
    },
    setupHint: 'Kamerayı yana koyun, baştan ayağa tüm vücut kadrajda olsun (2-3 metre).',
  },
  bench: {
    id: 'bench',
    name: 'Bench press',
    angleLabel: 'Dirsek açısı',
    view: 'side',
    liftDirection: 'opening',
    chains: ARMS,
    topAngle: 150,
    bottomAngle: 95,
    lockoutAngle: 165,
    lean: null,
    maxElbowDriftDeg: null,
    phases: { top: 'Üstte', down: 'İniyor', bottom: 'Göğüste' },
    texts: {
      down: 'İndir',
      bottom: 'Göğüste, şimdi it',
      shallow: 'Yarım tekrar: barı göğse kadar indir',
      noLockout: 'Üstte kolları tam kilitle',
      depthLabel: 'Son derinlik',
      liftLabel: 'Göğüsten yukarı',
    },
    setupHint: 'Kamerayı sehpanın yanına, omuz hizasına koyun; omuz, dirsek ve bilek görünsün.',
  },
  shoulder_press: {
    id: 'shoulder_press',
    name: 'Shoulder press',
    angleLabel: 'Dirsek açısı',
    view: 'front',
    liftDirection: 'opening',
    chains: ARMS,
    topAngle: 150,
    bottomAngle: 95,
    lockoutAngle: 165,
    lean: null,
    maxElbowDriftDeg: null,
    phases: { top: 'Yukarıda', down: 'İniyor', bottom: 'Omuzda' },
    texts: {
      down: 'İndir',
      bottom: 'Omuz hizasında, şimdi yukarı it',
      shallow: 'Yarım tekrar: ağırlığı omuz hizasına kadar indir',
      noLockout: 'Üstte kolları tam aç',
      depthLabel: 'Son alt açı',
      liftLabel: 'Omuzdan yukarı',
    },
    setupHint: 'Kamerayı karşına, göğüs hizasına koyun; iki kol ve baş kadrajda olsun.',
  },
  biceps_curl: {
    id: 'biceps_curl',
    name: 'Biceps curl',
    angleLabel: 'Dirsek açısı',
    view: 'side',
    liftDirection: 'closing',
    chains: ARMS,
    topAngle: 140,
    bottomAngle: 60,
    lockoutAngle: 155,
    lean: { at: 'max', maxDeg: 15 },
    maxElbowDriftDeg: 30,
    phases: { top: 'Altta', down: 'Kaldırıyor', bottom: 'Tepede' },
    texts: {
      down: 'Kaldır',
      bottom: 'Tepede, kontrollü indir',
      shallow: 'Yarım tekrar: ağırlığı omza doğru tam kaldır',
      lean: 'Gövdeyi sallama, ağırlığı kolla kaldır',
      noLockout: 'Altta kolu tam aç',
      elbowDrift: 'Dirseği gövdeye yakın sabit tut',
      depthLabel: 'Son tepe açısı',
      liftLabel: 'Kaldırma fazı',
    },
    setupHint: 'Kamerayı yana, bel hizasına koyun; kameraya dönük kol, omuz ve kalça görünsün.',
  },
  triceps_pushdown: {
    id: 'triceps_pushdown',
    name: 'Triceps pushdown',
    angleLabel: 'Dirsek açısı',
    view: 'side',
    liftDirection: 'opening',
    chains: ARMS,
    topAngle: 145,
    bottomAngle: 100,
    lockoutAngle: 160,
    lean: null,
    maxElbowDriftDeg: 30,
    phases: { top: 'Altta', down: 'Bırakıyor', bottom: 'Yukarıda' },
    texts: {
      down: 'Kontrollü bırak',
      bottom: 'Şimdi aşağı it',
      shallow: 'Yarım tekrar: elleri göğüs hizasına kadar bırak',
      noLockout: 'Altta kolları tam aç',
      elbowDrift: 'Dirsekleri yanında sabit tut, omuzdan itme',
      depthLabel: 'Son üst açı',
      liftLabel: 'Aşağı itme fazı',
    },
    setupHint: 'Kamerayı yana, göğüs hizasına koyun; kameraya dönük kol, omuz ve kalça görünsün.',
  },
};

/** Workout exercises (catalog slugs) the form coach can analyse, and the movement it uses for each. */
export const FORM_EXERCISE_BY_SLUG: Readonly<Record<string, ExerciseId>> = {
  squat: 'squat',
  'goblet-squat': 'squat',
  'bench-press': 'bench',
  ohp: 'shoulder_press',
  'db-shoulder-press': 'shoulder_press',
  'biceps-curl': 'biceps_curl',
  'hammer-curl': 'biceps_curl',
  'triceps-pushdown': 'triceps_pushdown',
};

export function isExerciseId(value: unknown): value is ExerciseId {
  return typeof value === 'string' && Object.prototype.hasOwnProperty.call(EXERCISES, value);
}

/** Landmarks the model is less sure about than this are treated as not visible. */
export const MIN_VISIBILITY = 0.5;
/** Leaving the top takes a clear drop, so jitter near the top never starts a rep. */
export const START_DROP_DEG = 12;
/** Slow-down worth showing, and the point where velocity-based training usually ends a set. */
export const NOTABLE_SLOWDOWN = 0.1;
export const SET_END_SLOWDOWN = 0.3;
/** Exponential smoothing of the angle between frames (1 = no smoothing). */
export const SMOOTHING = 0.5;
const MAX_REPS = 200;

// ---------------------------------------------------------------------------
// Geometry
// ---------------------------------------------------------------------------

/**
 * Angle at `b` between b→a and b→c, in degrees. Normalised x is scaled by the frame's aspect
 * ratio (width / height), so the angle matches what is seen on screen.
 */
export function jointAngle(a: PosePoint, b: PosePoint, c: PosePoint, aspect: number): number {
  const abx = (a.x - b.x) * aspect;
  const aby = a.y - b.y;
  const cbx = (c.x - b.x) * aspect;
  const cby = c.y - b.y;
  const lengths = Math.hypot(abx, aby) * Math.hypot(cbx, cby);
  if (lengths === 0) return Number.NaN;
  const cos = Math.max(-1, Math.min(1, (abx * cbx + aby * cby) / lengths));
  return (Math.acos(cos) * 180) / Math.PI;
}

/** Torso angle from vertical (hip → shoulder): 0 when upright. */
export function torsoLean(shoulder: PosePoint, hip: PosePoint, aspect: number): number {
  const dx = (shoulder.x - hip.x) * aspect;
  const dy = hip.y - shoulder.y;
  return Math.abs((Math.atan2(dx, dy) * 180) / Math.PI);
}

export interface MeasuredChain {
  side: Side;
  points: readonly [PosePoint, PosePoint, PosePoint];
  /** The least visible of the three points. */
  visibility: number;
}

/** Chains visible enough to measure, the most visible first. */
export function measuredChains(landmarks: readonly PosePoint[], spec: ExerciseSpec): MeasuredChain[] {
  const chains: MeasuredChain[] = [];
  for (const side of ['left', 'right'] as const) {
    const [i, j, k] = spec.chains[side];
    const a = landmarks[i];
    const b = landmarks[j];
    const c = landmarks[k];
    if (!a || !b || !c) continue;
    const visibility = Math.min(a.visibility ?? 1, b.visibility ?? 1, c.visibility ?? 1);
    if (visibility >= MIN_VISIBILITY) chains.push({ side, points: [a, b, c], visibility });
  }
  // Plain sort on a fresh array: older JavaScript engines on phones lack toSorted.
  return chains.sort((x, y) => y.visibility - x.visibility);
}

/** The side of the body turned to the camera (its weakest point is the most visible), or null. */
export function measuredChain(landmarks: readonly PosePoint[], spec: ExerciseSpec): MeasuredChain | null {
  return measuredChains(landmarks, spec)[0] ?? null;
}

export interface FrameReading {
  /** The most visible chain; front-view movements may also measure `chains[1]`. */
  chain: MeasuredChain;
  chains: MeasuredChain[];
  /** Raw angle of this frame (front view: the mean of both arms when both are visible). */
  angle: number;
  /** Torso lean of this frame, for movements that judge it. */
  leanDeg: number | null;
  /** Torso to upper arm on the measured side, for movements that judge it. */
  driftDeg: number | null;
}

function chainAngle(chain: MeasuredChain, aspect: number): number {
  const [a, b, c] = chain.points;
  return jointAngle(a, b, c, aspect);
}

/** Reads one frame; null when the measured joints are not visible enough. */
export function readFrame(landmarks: readonly PosePoint[], spec: ExerciseSpec, aspect: number): FrameReading | null {
  const visible = measuredChains(landmarks, spec);
  const chain = visible[0];
  if (!chain) return null;
  const chains = spec.view === 'front' ? visible : [chain];
  const angles = chains.map((c) => chainAngle(c, aspect)).filter(Number.isFinite);
  if (angles.length === 0) return null;
  const angle = angles.reduce((sum, value) => sum + value, 0) / angles.length;

  const shoulder = landmarks[SHOULDER[chain.side]];
  const hip = landmarks[HIP[chain.side]];
  const elbow = landmarks[ELBOW[chain.side]];
  const leanDeg = spec.lean && shoulder && hip ? torsoLean(shoulder, hip, aspect) : null;
  const drift = spec.maxElbowDriftDeg !== null && shoulder && hip && elbow ? jointAngle(hip, shoulder, elbow, aspect) : Number.NaN;
  return { chain, chains, angle, leanDeg, driftDeg: Number.isFinite(drift) ? drift : null };
}

export function smoothAngle(previous: number | null, next: number): number {
  return previous === null ? next : previous + SMOOTHING * (next - previous);
}

// ---------------------------------------------------------------------------
// Rep counting (a small state machine)
// ---------------------------------------------------------------------------

export type RepPhase = 'top' | 'down' | 'bottom';

export interface Rep {
  /** Counted reps are numbered from 1; a partial rep carries the number the next counted rep will get. */
  number: number;
  counted: boolean;
  /** Deepest angle reached. */
  minAngle: number;
  /** Highest angle after coming back up; keeps rising until the next rep starts. */
  peakAngle: number;
  /** The lifting phase: from the deepest point back past the top threshold, or for curls from leaving the top to the deepest point. */
  liftMs: number;
  /** Torso lean at the deepest point. */
  leanDeg: number | null;
  /** Most torso lean during the rep. */
  maxLeanDeg: number | null;
  /** Most torso-to-upper-arm angle during the rep. */
  maxDriftDeg: number | null;
  /** Final once the next rep starts; lockout is judged on the peak by then. */
  closed: boolean;
}

interface Attempt {
  startAt: number;
  minAngle: number;
  minAt: number;
  leanDeg: number | null;
  maxLeanDeg: number | null;
  maxDriftDeg: number | null;
}

export interface Counter {
  phase: RepPhase;
  reps: readonly Rep[];
  attempt: Attempt | null;
}

export interface Sample {
  /** Smoothed angle. */
  angle: number;
  /** Milliseconds on any steady clock. */
  at: number;
  leanDeg: number | null;
  driftDeg?: number | null;
}

export function newCounter(): Counter {
  return { phase: 'top', reps: [], attempt: null };
}

function withLast(reps: readonly Rep[], rep: Rep): Rep[] {
  return [...reps.slice(0, -1), rep];
}

function maxOf(current: number | null, next: number | null): number | null {
  if (next === null) return current;
  return current === null || next > current ? next : current;
}

function track(attempt: Attempt, sample: Sample): Attempt {
  const deeper = sample.angle < attempt.minAngle;
  return {
    startAt: attempt.startAt,
    minAngle: deeper ? sample.angle : attempt.minAngle,
    minAt: deeper ? sample.at : attempt.minAt,
    leanDeg: deeper ? sample.leanDeg : attempt.leanDeg,
    maxLeanDeg: maxOf(attempt.maxLeanDeg, sample.leanDeg),
    maxDriftDeg: maxOf(attempt.maxDriftDeg, sample.driftDeg ?? null),
  };
}

function startAttempt(sample: Sample): Attempt {
  return {
    startAt: sample.at,
    minAngle: sample.angle,
    minAt: sample.at,
    leanDeg: sample.leanDeg,
    maxLeanDeg: sample.leanDeg,
    maxDriftDeg: sample.driftDeg ?? null,
  };
}

/**
 * Advances the counter by one sample. Transitions (anything else keeps the phase):
 *   top    → down    the angle drops START_DROP_DEG below the top threshold; the previous rep closes
 *                     (straight to bottom when it is already at the bottom threshold)
 *   down   → bottom  the angle reaches the bottom threshold
 *   down   → top     back above the top threshold without reaching the bottom: a partial rep
 *   bottom → top     back above the top threshold: a counted rep
 * A movement that starts at the bottom (a press from the shoulders, a pushdown from the chest) passes
 * through top → down → bottom on its first frames, so its first rep counts at the first lockout.
 */
export function countStep(counter: Counter, spec: ExerciseSpec, sample: Sample): Counter {
  const { angle, at } = sample;
  if (!Number.isFinite(angle)) return counter;

  if (counter.phase === 'top') {
    const last = counter.reps.at(-1);
    if (angle < spec.topAngle - START_DROP_DEG) {
      const reps = last && !last.closed ? withLast(counter.reps, { ...last, closed: true }) : counter.reps;
      // A lifter already holding the bottom (a press from the shoulders) is at the bottom at once.
      return { phase: angle <= spec.bottomAngle ? 'bottom' : 'down', reps, attempt: startAttempt(sample) };
    }
    if (last && !last.closed && angle > last.peakAngle) return { ...counter, reps: withLast(counter.reps, { ...last, peakAngle: angle }) };
    return counter;
  }

  const attempt = track(counter.attempt ?? startAttempt(sample), sample);

  if (angle >= spec.topAngle) {
    const counted = counter.phase === 'bottom';
    const liftMs = spec.liftDirection === 'closing' ? attempt.minAt - attempt.startAt : at - attempt.minAt;
    const rep: Rep = {
      number: counter.reps.filter((r) => r.counted).length + 1,
      counted,
      minAngle: attempt.minAngle,
      peakAngle: angle,
      liftMs: Math.max(0, liftMs),
      leanDeg: attempt.leanDeg,
      maxLeanDeg: attempt.maxLeanDeg,
      maxDriftDeg: attempt.maxDriftDeg,
      closed: false,
    };
    return { phase: 'top', reps: [...counter.reps, rep].slice(-MAX_REPS), attempt: null };
  }
  if (counter.phase === 'down' && angle <= spec.bottomAngle) return { ...counter, phase: 'bottom', attempt };
  return { ...counter, attempt };
}

export function countedReps(counter: Counter): number {
  return counter.reps.filter((rep) => rep.counted).length;
}

// ---------------------------------------------------------------------------
// One frame end to end: what the web page and the phone both run
// ---------------------------------------------------------------------------

export interface Analysis {
  counter: Counter;
  /** Smoothed angle; null while the measured joints are out of sight. */
  angle: number | null;
  reading: FrameReading | null;
}

export function newAnalysis(): Analysis {
  return { counter: newCounter(), angle: null, reading: null };
}

/** Reads a frame, smooths the angle and advances the counter. Out-of-sight frames restart smoothing. */
export function analyzeFrame(state: Analysis, spec: ExerciseSpec, landmarks: readonly PosePoint[], aspect: number, at: number): Analysis {
  const reading = landmarks.length > 0 ? readFrame(landmarks, spec, aspect) : null;
  if (!reading) return { counter: state.counter, angle: null, reading: null };
  const angle = smoothAngle(state.angle, reading.angle);
  const counter = countStep(state.counter, spec, { angle, at, leanDeg: reading.leanDeg, driftDeg: reading.driftDeg });
  return { counter, angle, reading };
}

// ---------------------------------------------------------------------------
// Judging and coaching
// ---------------------------------------------------------------------------

export type Fault = 'shallow' | 'lean' | 'elbow_drift' | 'no_lockout';

export function repFaults(rep: Rep, spec: ExerciseSpec): Fault[] {
  const faults: Fault[] = [];
  if (!rep.counted) faults.push('shallow');
  if (spec.lean) {
    const lean = spec.lean.at === 'deepest' ? rep.leanDeg : rep.maxLeanDeg;
    if (lean !== null && lean > spec.lean.maxDeg) faults.push('lean');
  }
  if (spec.maxElbowDriftDeg !== null && rep.maxDriftDeg !== null && rep.maxDriftDeg > spec.maxElbowDriftDeg) faults.push('elbow_drift');
  if (spec.lockoutAngle !== null && rep.closed && rep.peakAngle < spec.lockoutAngle) faults.push('no_lockout');
  return faults;
}

export function faultText(fault: Fault, spec: ExerciseSpec): string {
  switch (fault) {
    case 'shallow':
      return spec.texts.shallow;
    case 'lean':
      return spec.texts.lean ?? 'Gövdeni dik tut';
    case 'elbow_drift':
      return spec.texts.elbowDrift ?? 'Dirseği sabit tut';
    case 'no_lockout':
      return spec.texts.noLockout ?? 'Kolları tam aç';
  }
}

/**
 * How much slower the latest counted rep was lifted than the first, from lifting time alone
 * (same range of motion assumed): 0.25 means 25 % slower. Null before two reps.
 */
export function slowdown(reps: readonly Rep[]): number | null {
  const timed = reps.filter((rep) => rep.counted && rep.liftMs > 0);
  const first = timed[0];
  const last = timed.at(-1);
  if (!first || !last || timed.length < 2) return null;
  return Math.max(0, 1 - first.liftMs / last.liftMs);
}

export interface Coaching {
  tone: 'idle' | 'info' | 'good' | 'warn';
  text: string;
}

/** The one line shown over the video. */
export function coaching(counter: Counter, spec: ExerciseSpec, visible: boolean): Coaching {
  if (!visible) return { tone: 'warn', text: `Vücudun kadrajda tam görünmüyor. ${spec.setupHint}` };
  if (counter.phase === 'down') return { tone: 'info', text: `${spec.texts.down}: hedef ${spec.bottomAngle}° ve altı` };
  if (counter.phase === 'bottom') return { tone: 'good', text: spec.texts.bottom };

  const last = counter.reps.at(-1);
  if (!last) return { tone: 'idle', text: 'Hazır. Harekete başla.' };
  const fault = repFaults(last, spec)[0];
  if (fault) return { tone: 'warn', text: faultText(fault, spec) };
  const loss = slowdown(counter.reps);
  if (loss !== null && loss >= SET_END_SLOWDOWN) {
    return { tone: 'warn', text: `Hareket %${Math.round(loss * 100)} yavaşladı: set sonuna gelmiş olabilirsin` };
  }
  return { tone: 'good', text: `Güzel tekrar: ${Math.round(last.minAngle)}°` };
}
