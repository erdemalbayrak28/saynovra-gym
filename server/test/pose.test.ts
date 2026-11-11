import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { EXERCISES as CATALOG } from '../src/catalog.ts';
import {
  EXERCISES,
  FORM_EXERCISE_BY_SLUG,
  analyzeFrame,
  coaching,
  countStep,
  countedReps,
  faultText,
  isExerciseId,
  jointAngle,
  measuredChain,
  newAnalysis,
  newCounter,
  readFrame,
  repFaults,
  slowdown,
  torsoLean,
  type Counter,
  type ExerciseSpec,
  type PosePoint,
} from '../../shared/pose.ts';

const squat = EXERCISES.squat;
const bench = EXERCISES.bench;
const FRAME_MS = 33;
const STEPS = 12;

/** Angles moving linearly between keyframes, one sample per frame. */
function motion(keyframes: number[]): number[] {
  const angles: number[] = [];
  for (let i = 1; i < keyframes.length; i++) {
    const from = keyframes[i - 1] ?? 0;
    const to = keyframes[i] ?? 0;
    for (let step = 1; step <= STEPS; step++) angles.push(from + ((to - from) * step) / STEPS);
  }
  return angles;
}

function run(spec: typeof squat, angles: number[], leanDeg: number | null = null, counter: Counter = newCounter(), start = 0): Counter {
  return angles.reduce((state, angle, i) => countStep(state, spec, { angle, at: start + i * FRAME_MS, leanDeg }), counter);
}

/** A side-on body whose left knee (or elbow) is bent to `angle`; the right side is barely visible. */
function body(chain: readonly [number, number, number], angle: number, aspect: number): PosePoint[] {
  const points: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  const [proximal, joint, distal] = chain;
  const rad = (angle * Math.PI) / 180;
  const length = 0.2;
  points[joint] = { x: 0.5, y: 0.6, visibility: 0.9 };
  points[distal] = { x: 0.5, y: 0.6 + length, visibility: 0.9 };
  points[proximal] = { x: 0.5 + (length * Math.sin(rad)) / aspect, y: 0.6 + length * Math.cos(rad), visibility: 0.9 };
  points[11] = { x: 0.5, y: 0.1, visibility: 0.9 };
  return points;
}

describe('pose geometry', () => {
  it('measures joint angles as they look on screen', () => {
    assert.equal(Math.round(jointAngle({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.8, y: 0.5 }, 1)), 90);
    assert.equal(Math.round(jointAngle({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.8 }, 1)), 180);
    // The same normalised points on a 16:9 frame: x stretches, so the angle closes.
    assert.equal(Math.round(jointAngle({ x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 }, 1)), 135);
    assert.equal(Math.round(jointAngle({ x: 0.6, y: 0.4 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.6 }, 16 / 9)), 119);
    assert.ok(Number.isNaN(jointAngle({ x: 0.5, y: 0.5 }, { x: 0.5, y: 0.5 }, { x: 0.5, y: 0.8 }, 1)));
  });

  it('measures torso lean from vertical', () => {
    assert.equal(torsoLean({ x: 0.5, y: 0.2 }, { x: 0.5, y: 0.6 }, 1), 0);
    assert.equal(Math.round(torsoLean({ x: 0.7, y: 0.4 }, { x: 0.5, y: 0.6 }, 1)), 45);
  });

  it('reads the side facing the camera and ignores a body it cannot see', () => {
    const aspect = 16 / 9;
    const landmarks = body(squat.chains.left, 90, aspect);
    const reading = readFrame(landmarks, squat, aspect);
    assert.equal(reading?.chain.side, 'left');
    assert.equal(Math.round(reading?.angle ?? 0), 90);

    const hidden = landmarks.map((point) => ({ ...point, visibility: 0.3 }));
    assert.equal(measuredChain(hidden, squat), null);
    assert.equal(readFrame([], squat, aspect), null);
  });
});

describe('rep counting', () => {
  it('counts clean squats and times the way up', () => {
    const counter = run(squat, motion([170, 85, 170, 85, 170, 85, 170]));
    assert.equal(countedReps(counter), 3);
    assert.deepEqual(
      counter.reps.map((rep) => [rep.number, rep.counted, Math.round(rep.minAngle)]),
      [
        [1, true, 85],
        [2, true, 85],
        [3, true, 85],
      ],
    );
    // From the deepest frame to the first frame at or above 160°: 11 frames.
    assert.equal(counter.reps[0]?.liftMs, 11 * FRAME_MS);
    assert.equal(coaching(counter, squat, true).text, 'Güzel tekrar: 85°');
  });

  it('does not count a squat that stops above the depth line', () => {
    const counter = run(squat, motion([170, 120, 170]));
    assert.equal(countedReps(counter), 0);
    assert.equal(counter.reps.length, 1);
    assert.deepEqual(repFaults(counter.reps[0]!, squat), ['shallow']);
    assert.deepEqual(coaching(counter, squat, true), { tone: 'warn', text: 'Yarım tekrar: daha derine in' });
  });

  it('ignores jitter near the top', () => {
    const counter = run(squat, [170, 165, 172, 151, 169, 166, 171, 152, 170]);
    assert.equal(counter.phase, 'top');
    assert.equal(counter.reps.length, 0);
    assert.equal(coaching(counter, squat, true).text, 'Hazır. Harekete başla.');
  });

  it('coaches through the phases and asks for the body when it is out of frame', () => {
    const goingDown = run(squat, motion([170, 120]));
    assert.equal(goingDown.phase, 'down');
    assert.equal(coaching(goingDown, squat, true).text, 'İn: hedef 100° ve altı');
    const atBottom = run(squat, motion([170, 90]));
    assert.equal(atBottom.phase, 'bottom');
    assert.equal(coaching(atBottom, squat, true).text, 'Derinlik tamam, kalk');
    assert.equal(coaching(atBottom, squat, false).tone, 'warn');
  });

  it('flags a squat with the chest falling forward', () => {
    const counter = run(squat, motion([170, 85, 170]), 62);
    assert.equal(countedReps(counter), 1);
    assert.deepEqual(repFaults(counter.reps[0]!, squat), ['lean']);
  });

  it('judges bench lockout on the highest point before the next rep', () => {
    const soft = run(bench, motion([170, 80, 155, 80]));
    assert.equal(countedReps(soft), 1);
    assert.equal(soft.reps[0]?.closed, true);
    assert.deepEqual(repFaults(soft.reps[0]!, bench), ['no_lockout']);

    const locked = run(bench, motion([170, 80, 172, 80]));
    assert.deepEqual(repFaults(locked.reps[0]!, bench), []);
    // Still open while the lifter holds the top: no verdict on lockout yet.
    const holding = run(bench, motion([170, 80, 155]));
    assert.deepEqual(repFaults(holding.reps[0]!, bench), []);
  });

  it('measures how much the bar slowed down across the set', () => {
    // Three reps whose way up takes 12, 13 and 18 frames.
    let counter = newCounter();
    let at = 0;
    for (const upFrames of [12, 13, 18]) {
      const down = motion([170, 85]);
      const up = Array.from({ length: upFrames }, (_, i) => 85 + ((170 - 85) * (i + 1)) / upFrames);
      counter = run(squat, [...down, ...up], null, counter, at);
      at += (down.length + up.length) * FRAME_MS;
    }
    assert.equal(countedReps(counter), 3);
    const loss = slowdown(counter.reps) ?? 0;
    assert.ok(loss > 0.3 && loss < 0.4, `slowdown ${loss}`);
    assert.match(coaching(counter, squat, true).text, /yavaşladı/);
    assert.equal(slowdown(counter.reps.slice(0, 1)), null);
  });
});

// ---------------------------------------------------------------------------
// Sprint 6 movements: shoulder press, biceps curl, triceps pushdown
// ---------------------------------------------------------------------------

const press = EXERCISES.shoulder_press;
const curl = EXERCISES.biceps_curl;
const pushdown = EXERCISES.triceps_pushdown;

function runWith(spec: ExerciseSpec, angles: number[], extra: { leanDeg?: number | null; driftDeg?: number | null } = {}): Counter {
  return angles.reduce(
    (state, angle, i) => countStep(state, spec, { angle, at: i * FRAME_MS, leanDeg: extra.leanDeg ?? null, driftDeg: extra.driftDeg ?? null }),
    newCounter(),
  );
}

/** A front-on body with both elbows bent: upper arms hang down, forearms swing out by the given angles. */
function frontArms(leftAngle: number, rightAngle: number, visibility = 0.9): PosePoint[] {
  const points: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
  const place = (shoulder: number, elbow: number, wrist: number, x: number, angle: number, outward: number) => {
    const rad = (angle * Math.PI) / 180;
    points[shoulder] = { x, y: 0.3, visibility };
    points[elbow] = { x, y: 0.5, visibility };
    points[wrist] = { x: x + outward * 0.2 * Math.sin(rad), y: 0.5 - 0.2 * Math.cos(rad), visibility };
  };
  place(11, 13, 15, 0.6, leftAngle, 1);
  place(12, 14, 16, 0.4, rightAngle, -1);
  return points;
}

describe('more movements', () => {
  it('maps workout exercises to movements the coach knows', () => {
    const slugs = new Set(CATALOG.map((exercise) => exercise.slug));
    for (const [slug, id] of Object.entries(FORM_EXERCISE_BY_SLUG)) {
      assert.ok(slugs.has(slug), `${slug} is not in the catalog`);
      assert.ok(isExerciseId(id));
    }
    assert.equal(isExerciseId('deadlift'), false);
    assert.equal(isExerciseId('toString'), false);
  });

  it('averages both arms on a front-view shoulder press', () => {
    const reading = readFrame(frontArms(80, 100), press, 1);
    assert.equal(reading?.chains.length, 2);
    assert.equal(Math.round(reading?.angle ?? 0), 90);
    // One arm out of sight: the other one is measured alone.
    const oneArm = frontArms(80, 100).map((point, index) => (index === 12 || index === 14 || index === 16 ? { ...point, visibility: 0.1 } : point));
    assert.equal(Math.round(readFrame(oneArm, press, 1)?.angle ?? 0), 80);
  });

  it('counts a shoulder press started from the shoulders and asks for lockout', () => {
    const clean = runWith(press, motion([85, 172, 85, 172]));
    assert.equal(countedReps(clean), 2);
    assert.deepEqual(repFaults(clean.reps[0]!, press), []);

    const soft = runWith(press, motion([85, 155, 85]));
    assert.deepEqual(repFaults(soft.reps[0]!, press), ['no_lockout']);
    const halfway = runWith(press, motion([120, 172]));
    assert.deepEqual(repFaults(halfway.reps[0]!, press), ['shallow']);
    assert.equal(coaching(runWith(press, motion([172, 85])), press, true).text, 'Omuz hizasında, şimdi yukarı it');
  });

  it('counts curls and times the curl itself, not the lowering', () => {
    const counter = runWith(curl, motion([170, 40, 170, 40, 170]));
    assert.equal(countedReps(counter), 2);
    // Leaves the top (below 128°) on the 4th frame, deepest on the 12th.
    assert.equal(counter.reps[0]?.liftMs, 8 * FRAME_MS);
    assert.equal(coaching(runWith(curl, motion([170, 100])), curl, true).text, 'Kaldır: hedef 60° ve altı');
  });

  it('flags half curls, a swinging torso, drifting elbows and an arm left bent', () => {
    assert.deepEqual(repFaults(runWith(curl, motion([170, 80, 170])).reps[0]!, curl), ['shallow']);
    assert.deepEqual(repFaults(runWith(curl, motion([170, 40, 170]), { leanDeg: 22 }).reps[0]!, curl), ['lean']);
    assert.deepEqual(repFaults(runWith(curl, motion([170, 40, 170]), { driftDeg: 42 }).reps[0]!, curl), ['elbow_drift']);
    assert.deepEqual(repFaults(runWith(curl, motion([170, 40, 145, 40])).reps[0]!, curl), ['no_lockout']);
    // Within limits: a little lean and elbow movement are fine.
    assert.deepEqual(repFaults(runWith(curl, motion([170, 40, 170]), { leanDeg: 8, driftDeg: 20 }).reps[0]!, curl), []);
    assert.equal(faultText('elbow_drift', curl), 'Dirseği gövdeye yakın sabit tut');
  });

  it('counts pushdowns from the chest and wants the arms straight at the bottom', () => {
    const clean = runWith(pushdown, motion([90, 170, 90, 170]));
    assert.equal(countedReps(clean), 2);
    assert.deepEqual(repFaults(clean.reps[0]!, pushdown), []);
    assert.deepEqual(repFaults(runWith(pushdown, motion([90, 150, 90])).reps[0]!, pushdown), ['no_lockout']);
    assert.deepEqual(repFaults(runWith(pushdown, motion([120, 170])).reps[0]!, pushdown), ['shallow']);
    assert.deepEqual(repFaults(runWith(pushdown, motion([90, 170]), { driftDeg: 45 }).reps[0]!, pushdown), ['elbow_drift']);
  });

  it('measures the elbow drift from the torso on side-view arm movements', () => {
    const points: PosePoint[] = Array.from({ length: 33 }, () => ({ x: 0.5, y: 0.5, visibility: 0.2 }));
    points[23] = { x: 0.5, y: 0.8, visibility: 0.9 }; // hip
    points[11] = { x: 0.5, y: 0.4, visibility: 0.9 }; // shoulder
    points[13] = { x: 0.6, y: 0.5732, visibility: 0.9 }; // elbow 30° forward of the torso line
    points[15] = { x: 0.6, y: 0.3732, visibility: 0.9 }; // wrist straight up from the elbow
    const reading = readFrame(points, curl, 1);
    assert.equal(Math.round(reading?.driftDeg ?? 0), 30);
    assert.equal(Math.round(reading?.leanDeg ?? 0), 0);
    assert.equal(readFrame(points, EXERCISES.bench, 1)?.driftDeg, null);
  });

  it('runs a whole frame through one function and keeps the count when the body leaves the frame', () => {
    let state = newAnalysis();
    let at = 0;
    for (const angle of motion([85, 172])) {
      state = analyzeFrame(state, press, frontArms(angle, angle), 1, (at += FRAME_MS));
    }
    assert.equal(countedReps(state.counter), 1);
    const hidden = analyzeFrame(state, press, frontArms(90, 90, 0.1), 1, (at += FRAME_MS));
    assert.equal(hidden.angle, null);
    assert.equal(hidden.reading, null);
    assert.equal(countedReps(hidden.counter), 1);
    assert.equal(analyzeFrame(state, press, [], 1, at).reading, null);
  });
});
