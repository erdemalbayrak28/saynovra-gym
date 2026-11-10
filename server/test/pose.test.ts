import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  EXERCISES,
  coaching,
  countStep,
  countedReps,
  jointAngle,
  measuredChain,
  newCounter,
  readFrame,
  repFaults,
  slowdown,
  torsoLean,
  type Counter,
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
