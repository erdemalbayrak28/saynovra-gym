// Form analysis rules on top of body landmarks. Pure and dependency-free like contract.ts: the web
// form page feeds it MediaPipe landmarks frame by frame, server/test/pose.test.ts drives it with
// synthetic motion. The landmarks come from a neural network; everything below is plain geometry
// and fixed thresholds, so every number on screen can be explained.

export type ExerciseId = 'squat' | 'bench';
export type Side = 'left' | 'right';

/** Normalised image coordinates (0..1, y pointing down), as MediaPipe Pose returns them. */
export interface PosePoint {
  x: number;
  y: number;
  visibility?: number;
}

type Chain = readonly [number, number, number];

export interface ExerciseSpec {
  id: ExerciseId;
  name: string;
  /** What the measured angle is, for the screen. */
  angleLabel: string;
  /** Landmark indices, proximal → joint → distal, for each side of the body. */
  chains: Record<Side, Chain>;
  /** A rep is complete once the angle is back above this. */
  topAngle: number;
  /** A rep counts only if the angle went down to this or below. */
  bottomAngle: number;
  /** Arms count as locked out above this (bench); null when not judged. */
  lockoutAngle: number | null;
  setupHint: string;
}

// MediaPipe Pose landmark indices.
const SHOULDER: Record<Side, number> = { left: 11, right: 12 };
const HIP: Record<Side, number> = { left: 23, right: 24 };

export const EXERCISES: Record<ExerciseId, ExerciseSpec> = {
  squat: {
    id: 'squat',
    name: 'Squat',
    angleLabel: 'Diz açısı',
    chains: { left: [23, 25, 27], right: [24, 26, 28] },
    topAngle: 160,
    bottomAngle: 100,
    lockoutAngle: null,
    setupHint: 'Kamerayı yana koyun, baştan ayağa tüm vücut kadrajda olsun (2-3 metre).',
  },
  bench: {
    id: 'bench',
    name: 'Bench press',
    angleLabel: 'Dirsek açısı',
    chains: { left: [11, 13, 15], right: [12, 14, 16] },
    topAngle: 150,
    bottomAngle: 95,
    lockoutAngle: 165,
    setupHint: 'Kamerayı sehpanın yanına, omuz hizasına koyun; omuz, dirsek ve bilek görünsün.',
  },
};

/** Landmarks the model is less sure about than this are treated as not visible. */
export const MIN_VISIBILITY = 0.5;
/** Leaving the top takes a clear drop, so jitter near the top never starts a rep. */
export const START_DROP_DEG = 12;
/** Squat: a torso leaning further than this from vertical at the bottom is flagged. */
export const MAX_SQUAT_LEAN_DEG = 50;
/** Bar slow-down worth showing, and the point where velocity-based training usually ends a set. */
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

/** The side of the body turned to the camera (its weakest point is the most visible), or null. */
export function measuredChain(landmarks: readonly PosePoint[], spec: ExerciseSpec): MeasuredChain | null {
  let best: MeasuredChain | null = null;
  for (const side of ['left', 'right'] as const) {
    const [i, j, k] = spec.chains[side];
    const a = landmarks[i];
    const b = landmarks[j];
    const c = landmarks[k];
    if (!a || !b || !c) continue;
    const visibility = Math.min(a.visibility ?? 1, b.visibility ?? 1, c.visibility ?? 1);
    if (!best || visibility > best.visibility) best = { side, points: [a, b, c], visibility };
  }
  return best && best.visibility >= MIN_VISIBILITY ? best : null;
}

export interface FrameReading {
  chain: MeasuredChain;
  /** Raw angle of this frame. */
  angle: number;
  /** Squat only: torso lean of this frame. */
  leanDeg: number | null;
}

/** Reads one frame; null when the measured joints are not visible enough. */
export function readFrame(landmarks: readonly PosePoint[], spec: ExerciseSpec, aspect: number): FrameReading | null {
  const chain = measuredChain(landmarks, spec);
  if (!chain) return null;
  const [a, b, c] = chain.points;
  const angle = jointAngle(a, b, c, aspect);
  if (!Number.isFinite(angle)) return null;
  const shoulder = landmarks[SHOULDER[chain.side]];
  const hip = landmarks[HIP[chain.side]];
  const leanDeg = spec.id === 'squat' && shoulder && hip ? torsoLean(shoulder, hip, aspect) : null;
  return { chain, angle, leanDeg };
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
  /** From the deepest point back past the top threshold: the lifting phase. */
  liftMs: number;
  /** Squat: torso lean at the deepest point. */
  leanDeg: number | null;
  /** Final once the next rep starts; bench lockout is judged on the peak by then. */
  closed: boolean;
}

interface Attempt {
  minAngle: number;
  minAt: number;
  leanDeg: number | null;
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
}

export function newCounter(): Counter {
  return { phase: 'top', reps: [], attempt: null };
}

function withLast(reps: readonly Rep[], rep: Rep): Rep[] {
  return [...reps.slice(0, -1), rep];
}

/**
 * Advances the counter by one sample. Transitions (anything else keeps the phase):
 *   top    → down    the angle drops START_DROP_DEG below the top threshold; the previous rep closes
 *   down   → bottom  the angle reaches the bottom threshold
 *   down   → top     back above the top threshold without reaching the bottom: a partial rep
 *   bottom → top     back above the top threshold: a counted rep
 */
export function countStep(counter: Counter, spec: ExerciseSpec, sample: Sample): Counter {
  const { angle, at, leanDeg } = sample;
  if (!Number.isFinite(angle)) return counter;

  if (counter.phase === 'top') {
    const last = counter.reps.at(-1);
    if (angle < spec.topAngle - START_DROP_DEG) {
      const reps = last && !last.closed ? withLast(counter.reps, { ...last, closed: true }) : counter.reps;
      return { phase: 'down', reps, attempt: { minAngle: angle, minAt: at, leanDeg } };
    }
    if (last && !last.closed && angle > last.peakAngle) return { ...counter, reps: withLast(counter.reps, { ...last, peakAngle: angle }) };
    return counter;
  }

  const previous = counter.attempt ?? { minAngle: angle, minAt: at, leanDeg };
  const attempt = angle < previous.minAngle ? { minAngle: angle, minAt: at, leanDeg } : previous;

  if (angle >= spec.topAngle) {
    const counted = counter.phase === 'bottom';
    const rep: Rep = {
      number: counter.reps.filter((r) => r.counted).length + 1,
      counted,
      minAngle: attempt.minAngle,
      peakAngle: angle,
      liftMs: Math.max(0, at - attempt.minAt),
      leanDeg: attempt.leanDeg,
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
// Judging and coaching
// ---------------------------------------------------------------------------

export type Fault = 'shallow' | 'lean' | 'no_lockout';

export function repFaults(rep: Rep, spec: ExerciseSpec): Fault[] {
  const faults: Fault[] = [];
  if (!rep.counted) faults.push('shallow');
  if (spec.id === 'squat' && rep.leanDeg !== null && rep.leanDeg > MAX_SQUAT_LEAN_DEG) faults.push('lean');
  if (spec.lockoutAngle !== null && rep.closed && rep.peakAngle < spec.lockoutAngle) faults.push('no_lockout');
  return faults;
}

export function faultText(fault: Fault, spec: ExerciseSpec): string {
  switch (fault) {
    case 'shallow':
      return spec.id === 'squat' ? 'Yarım tekrar: daha derine in' : 'Yarım tekrar: barı göğse kadar indir';
    case 'lean':
      return 'Gövde fazla öne eğildi, göğsü dik tut';
    case 'no_lockout':
      return 'Üstte kolları tam kilitle';
  }
}

/**
 * How much slower the latest counted rep was lifted than the first, from lifting time alone
 * (same range of motion assumed): 0.25 means the bar moved 25 % slower. Null before two reps.
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
  if (counter.phase === 'down') {
    return { tone: 'info', text: `${spec.id === 'squat' ? 'İn' : 'İndir'}: hedef ${spec.bottomAngle}° ve altı` };
  }
  if (counter.phase === 'bottom') return { tone: 'good', text: spec.id === 'squat' ? 'Derinlik tamam, kalk' : 'Göğüste, şimdi it' };

  const last = counter.reps.at(-1);
  if (!last) return { tone: 'idle', text: 'Hazır. Harekete başla.' };
  const fault = repFaults(last, spec)[0];
  if (fault) return { tone: 'warn', text: faultText(fault, spec) };
  const loss = slowdown(counter.reps);
  if (loss !== null && loss >= SET_END_SLOWDOWN) {
    return { tone: 'warn', text: `Bar %${Math.round(loss * 100)} yavaşladı: set sonuna gelmiş olabilirsin` };
  }
  return { tone: 'good', text: `Güzel tekrar: ${Math.round(last.minAngle)}°` };
}
