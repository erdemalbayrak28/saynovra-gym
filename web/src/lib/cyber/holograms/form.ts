/**
 * AI form coach: a pose skeleton squatting inside a camera frame. The knee angle is measured
 * live; one rep is cut short and one comes up slowly, and both are caught.
 */
import { DEG, TAU, clamp, lerp, ramp } from '../math';
import { ALERT, ALERT_RGB, LIME, LIME_RGB, WHITE, WHITE_RGB, rgba } from '../palette';
import type { Holo } from './holo';
import { HOLO_LABEL, chip, corners, display, fade, label, liveDot, setGlow } from './holo';

const REP_SEC = 1.5;
const FIRST_REP_AT = 0.4;
const START_COUNT = 5;
const STANDING_KNEE = 172;
const DEEP_KNEE = 86;
const FRAME = { x: 282, y: 14, w: 296, h: 392 } as const;
const LEFT_X = 20;
const RIGHT_X = 626;
const LIMB = { shin: 84, thigh: 90, torso: 104, neck: 36, head: 20 } as const;
/** Bar speed of the last six reps, as a share of the best; the final one is the slow rep. */
const TEMPO = [0.8, 0.84, 0.81, 0.83, 0.82, 0.705] as const;

interface Rep {
  /** How deep the rep goes: 1 is a full squat. */
  depth: number;
  /** A slow rep grinds on the way up. */
  slow: boolean;
}

const REPS: readonly Rep[] = [
  { depth: 1, slow: false },
  { depth: 0.56, slow: false },
  { depth: 1, slow: true },
];

interface Squat {
  depth: number;
  count: number;
  halfReps: number;
  /** Warnings on screen right now. */
  halfWarning: boolean;
  slowWarning: boolean;
  /** Rep position in rep units, for timing the tempo bar. */
  u: number;
}

function squatAt(e: number): Squat {
  const u = (e - FIRST_REP_AT) / REP_SEC;
  const index = Math.floor(u);
  const rep = u >= 0 ? REPS[index] : undefined;
  let depth = 0;
  if (rep) {
    const phase = u - index;
    // A slow rep goes down normally and sticks on the way up.
    const paced = rep.slow && phase > 0.4 ? 0.5 + ((phase - 0.4) / 0.6) ** 1.6 * 0.5 : rep.slow ? (phase / 0.4) * 0.5 : phase;
    depth = rep.depth * (0.5 - 0.5 * Math.cos(TAU * paced));
  }
  const finished = REPS.filter((r, i) => u >= i + 1 && r.depth >= 0.9).length;
  return {
    depth,
    count: START_COUNT + finished,
    halfReps: u >= 1.5 ? 1 : 0,
    halfWarning: u >= 1.5 && u < 2.6,
    slowWarning: u >= 2.75,
    u,
  };
}

interface Point {
  x: number;
  y: number;
}

interface Pose {
  ankle: Point;
  knee: Point;
  hip: Point;
  shoulder: Point;
  head: Point;
  elbow: Point;
  bar: Point;
  kneeAngle: number;
  torsoLean: number;
  /** Canvas directions of the shin (knee to ankle) and the thigh (knee to hip). */
  shinDir: number;
  thighDir: number;
}

function step(from: Point, direction: number, length: number): Point {
  return { x: from.x + Math.cos(direction) * length, y: from.y + Math.sin(direction) * length };
}

/** Side view, facing right. Angles follow the canvas: 0 is right, 90 degrees is down. */
function poseAt(depth: number): Pose {
  const ankle = { x: 414, y: 372 };
  const shinLean = lerp(6, 31, depth);
  const kneeAngle = lerp(STANDING_KNEE, DEEP_KNEE, depth);
  const torsoLean = lerp(5, 40, depth);
  const knee = step(ankle, (shinLean - 90) * DEG, LIMB.shin);
  const shinDir = (shinLean + 90) * DEG;
  const thighDir = shinDir + kneeAngle * DEG;
  const hip = step(knee, thighDir, LIMB.thigh);
  const shoulder = step(hip, (torsoLean - 90) * DEG, LIMB.torso);
  return {
    ankle,
    knee,
    hip,
    shoulder,
    head: step(shoulder, (torsoLean * 0.7 - 90) * DEG, LIMB.neck),
    elbow: { x: shoulder.x - 16, y: shoulder.y + 32 },
    bar: { x: shoulder.x - 8, y: shoulder.y - 4 },
    kneeAngle,
    torsoLean,
    shinDir,
    thighDir,
  };
}

function drawViewfinder({ ctx, e, t }: Holo): void {
  ctx.save();
  ctx.globalAlpha = fade(e, 0);
  ctx.fillStyle = rgba(LIME_RGB, 0.03);
  ctx.fillRect(FRAME.x, FRAME.y, FRAME.w, FRAME.h);
  corners(ctx, FRAME.x, FRAME.y, FRAME.w, FRAME.h, 26, rgba(LIME_RGB, 0.8), 2.5);
  const scanY = FRAME.y + ((t * 0.45) % 1) * FRAME.h;
  ctx.fillStyle = rgba(LIME_RGB, 0.22);
  ctx.fillRect(FRAME.x + 6, scanY, FRAME.w - 12, 1.5);
  liveDot(ctx, FRAME.x + 20, FRAME.y + 22, t);
  label(ctx, 'CANLI ANALİZ', FRAME.x + 34, FRAME.y + 27, { size: 14, color: LIME });
  label(ctx, 'MEDIAPIPE', FRAME.x + FRAME.w - 14, FRAME.y + FRAME.h - 12, { size: 12, align: 'right' });
  ctx.strokeStyle = rgba(WHITE_RGB, 0.3);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(FRAME.x + 30, 381);
  ctx.lineTo(FRAME.x + FRAME.w - 30, 381);
  ctx.stroke();
  ctx.restore();
}

function drawSkeleton({ ctx, e }: Holo, pose: Pose): void {
  const { ankle, knee, hip, shoulder, head, elbow, bar } = pose;
  ctx.save();
  ctx.globalAlpha = fade(e, 0.1);
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';

  // The plate of the bar, end-on, resting on the shoulders.
  ctx.strokeStyle = rgba(WHITE_RGB, 0.6);
  ctx.fillStyle = rgba(WHITE_RGB, 0.08);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.arc(bar.x, bar.y, 25, 0, TAU);
  ctx.fill();
  ctx.stroke();

  ctx.save();
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 6;
  setGlow(ctx, LIME_RGB, 14);
  ctx.beginPath();
  ctx.moveTo(ankle.x + 48, ankle.y + 7);
  ctx.lineTo(ankle.x - 14, ankle.y + 7);
  ctx.lineTo(ankle.x, ankle.y);
  ctx.lineTo(knee.x, knee.y);
  ctx.lineTo(hip.x, hip.y);
  ctx.lineTo(shoulder.x, shoulder.y);
  ctx.lineTo(head.x, head.y);
  ctx.moveTo(shoulder.x, shoulder.y);
  ctx.lineTo(elbow.x, elbow.y);
  ctx.lineTo(bar.x, bar.y);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(head.x, head.y, LIMB.head, 0, TAU);
  ctx.fillStyle = rgba(LIME_RGB, 0.12);
  ctx.fill();
  ctx.lineWidth = 4;
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = WHITE;
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 2.5;
  for (const joint of [ankle, knee, hip, shoulder]) {
    ctx.beginPath();
    ctx.arc(joint.x, joint.y, 7, 0, TAU);
    ctx.fill();
    ctx.stroke();
  }

  // The measured angle, drawn at the back of the knee.
  ctx.strokeStyle = WHITE;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(knee.x, knee.y, 30, pose.shinDir, pose.thighDir);
  ctx.stroke();
  const middle = (pose.shinDir + pose.thighDir) / 2;
  label(ctx, `${Math.round(pose.kneeAngle)}°`, knee.x + Math.cos(middle) * 40, knee.y + Math.sin(middle) * 40 + 7, {
    align: 'right',
    size: 18,
    weight: 700,
    color: WHITE,
    spacing: 0,
  });
  ctx.restore();
}

function drawAngles({ ctx, e, t }: Holo, squat: Squat, pose: Pose): void {
  const deep = squat.depth > 0.9;
  ctx.save();
  ctx.globalAlpha = fade(e, 0.15);
  label(ctx, 'DİZ AÇISI', LEFT_X, 56);
  display(ctx, `${Math.round(pose.kneeAngle)}°`, LEFT_X, 132, 80, { color: deep ? LIME : WHITE });

  // Depth meter with the 90 degree target marked.
  const meter = 210;
  const target = (STANDING_KNEE - 90) / (STANDING_KNEE - DEEP_KNEE);
  ctx.fillStyle = rgba(WHITE_RGB, 0.14);
  ctx.fillRect(LEFT_X, 158, meter, 10);
  ctx.fillStyle = LIME;
  ctx.fillRect(LEFT_X, 158, meter * clamp(squat.depth), 10);
  ctx.fillStyle = WHITE;
  ctx.fillRect(LEFT_X + meter * target - 1, 152, 2, 22);
  label(ctx, 'HEDEF 90°', LEFT_X + meter, 194, { size: 13, align: 'right' });

  label(ctx, 'GÖVDE EĞİMİ', LEFT_X, 244, { size: 15 });
  display(ctx, `${Math.round(pose.torsoLean)}°`, LEFT_X, 286, 36);

  const blink = 0.82 + 0.18 * Math.sin(t * 12);
  if (squat.halfWarning) chip(ctx, 'YARIM TEKRAR', LEFT_X, 350, { filled: true, rgb: ALERT_RGB, alpha: blink });
  else if (squat.slowWarning) chip(ctx, 'HIZ KAYBI %14', LEFT_X, 350, { filled: true, rgb: ALERT_RGB, alpha: blink });
  else chip(ctx, 'FORM İYİ', LEFT_X, 350, {});
  ctx.restore();
}

function drawCounters({ ctx, e }: Holo, squat: Squat): void {
  ctx.save();
  ctx.globalAlpha = fade(e, 0.2);
  label(ctx, 'TEKRAR', RIGHT_X, 56);
  display(ctx, String(squat.count), RIGHT_X, 132, 80);

  label(ctx, 'TEMPO', RIGHT_X, 196, { size: 15 });
  TEMPO.forEach((speed, i) => {
    const last = i === TEMPO.length - 1;
    // The last bar grows in while the slow rep is being lifted.
    const grow = last ? ramp(squat.u, 2.75, 0.35) : 1;
    if (grow <= 0) return;
    const height = speed * 86 * grow;
    ctx.fillStyle = last ? ALERT : rgba(LIME_RGB, 0.75);
    ctx.fillRect(RIGHT_X + i * 34, 300 - height, 22, height);
  });
  ctx.strokeStyle = rgba(WHITE_RGB, 0.25);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(RIGHT_X - 4, 300.5);
  ctx.lineTo(RIGHT_X + TEMPO.length * 34, 300.5);
  ctx.stroke();

  label(ctx, 'YARIM', RIGHT_X, 352, { size: 15 });
  display(ctx, String(squat.halfReps), RIGHT_X + 92, 356, 34, { color: squat.halfReps > 0 ? ALERT : HOLO_LABEL });
  ctx.restore();
}

export function drawForm(holo: Holo): void {
  const squat = squatAt(holo.e);
  const pose = poseAt(squat.depth);
  drawViewfinder(holo);
  drawSkeleton(holo, pose);
  drawAngles(holo, squat, pose);
  drawCounters(holo, squat);
}
