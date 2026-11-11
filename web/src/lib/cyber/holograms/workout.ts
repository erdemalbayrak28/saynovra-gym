/**
 * Guided training: a barbell finishing its set, then the two things the app does by itself:
 * it raises the weight by 2,5 kg and starts the rest timer.
 */
import { TAU, clamp, easeOutBack, ramp } from '../math';
import { FONT_MONO, LIME, LIME_RGB, WHITE, WHITE_RGB, rgba } from '../palette';
import type { Holo } from './holo';
import { HOLO_LABEL, chip, clearGlow, copy, corners, display, fade, label, setGlow } from './holo';

const REP_SEC = 0.85;
const FIRST_REP_AT = 0.45;
const START_REPS = 6;
const TARGET_REPS = 10;
const SET_DONE_AT = FIRST_REP_AT + (TARGET_REPS - START_REPS) * REP_SEC;
const LEVEL_UP_AT = SET_DONE_AT + 0.25;
const REST_AT = LEVEL_UP_AT + 0.25;
const REST_SEC = 90;

const BAR = { x: 430, y: 106, travel: 44, half: 312 } as const;
/** Plates from the collar outward: [distance from the bar's centre, width, height]. */
const PLATES: ReadonlyArray<readonly [number, number, number]> = [
  [218, 18, 118],
  [240, 16, 94],
  [260, 14, 68],
];
const TILE = { y: 222, w: 260, h: 180, xs: [20, 300, 580] } as const;

function repsAt(e: number): number {
  return clamp(START_REPS + Math.floor((e - FIRST_REP_AT) / REP_SEC), START_REPS, TARGET_REPS);
}

/** 0 at lock-out, 1 at the chest. */
function barDepth(e: number): number {
  if (e < FIRST_REP_AT || e >= SET_DONE_AT) return 0;
  const phase = ((e - FIRST_REP_AT) / REP_SEC) % 1;
  return 0.5 - 0.5 * Math.cos(TAU * phase);
}

function drawBarbell(ctx: CanvasRenderingContext2D, y: number, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = rgba(WHITE_RGB, 0.85);
  ctx.fillRect(BAR.x - BAR.half, y - 4, BAR.half * 2, 8);
  // Knurling in the grip area.
  ctx.fillStyle = rgba(WHITE_RGB, 0.35);
  for (let i = -6; i <= 6; i++) ctx.fillRect(BAR.x + i * 14 - 1, y - 7, 2, 14);

  ctx.strokeStyle = LIME;
  ctx.lineWidth = 2.5;
  for (const side of [-1, 1]) {
    for (const [offset, width, height] of PLATES) {
      ctx.beginPath();
      ctx.roundRect(BAR.x + side * offset - width / 2, y - height / 2, width, height, 5);
      ctx.fillStyle = rgba(LIME_RGB, 0.18);
      ctx.fill();
      ctx.stroke();
    }
    ctx.fillStyle = WHITE;
    ctx.fillRect(BAR.x + side * 200 - 4, y - 13, 8, 26);
  }
  ctx.restore();
}

function drawLift({ ctx, e }: Holo): void {
  ctx.save();
  ctx.globalAlpha = fade(e, 0);
  label(ctx, 'BENCH PRESS · SET 3 / 4', 20, 34);
  for (const [lag, alpha] of [
    [0.1, 0.12],
    [0.05, 0.25],
  ] as const) {
    drawBarbell(ctx, BAR.y + barDepth(e - lag) * BAR.travel, alpha);
  }
  ctx.save();
  setGlow(ctx, LIME_RGB, 14, 0.7);
  drawBarbell(ctx, BAR.y + barDepth(e) * BAR.travel, 1);
  ctx.restore();
  ctx.restore();
}

function drawTile(ctx: CanvasRenderingContext2D, x: number, title: string, alpha: number): void {
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.fillStyle = rgba(LIME_RGB, 0.04);
  ctx.fillRect(x, TILE.y, TILE.w, TILE.h);
  corners(ctx, x, TILE.y, TILE.w, TILE.h, 14, rgba(LIME_RGB, 0.6));
  label(ctx, title, x + 20, TILE.y + 36);
  ctx.restore();
}

function drawWeight({ ctx, e }: Holo, x: number): void {
  const leveled = e >= LEVEL_UP_AT;
  // A short horizontal jitter as the figure flips to the new weight.
  const settle = ramp(e, LEVEL_UP_AT, 0.25);
  const jitter = leveled && settle < 1 ? Math.sin(e * 90) * 5 * (1 - settle) : 0;
  const width = display(ctx, leveled ? '85' : '82,5', x + 20 + jitter, TILE.y + 118, 78, { color: leveled ? LIME : WHITE });
  copy(ctx, 'kg', x + 30 + width + jitter, TILE.y + 118, 30);
  if (leveled) {
    const pop = easeOutBack(ramp(e, LEVEL_UP_AT, 0.35));
    ctx.save();
    ctx.translate(x + 20, TILE.y + 152);
    ctx.scale(pop, pop);
    chip(ctx, '+2,5 KG', 0, 0, { filled: true, size: 16 });
    ctx.restore();
  } else {
    label(ctx, 'HEDEF 10 TEKRAR', x + 20, TILE.y + 158, { size: 14 });
  }
}

function drawReps({ ctx, e }: Holo, x: number): void {
  const reps = repsAt(e);
  const done = reps >= TARGET_REPS;
  const width = display(ctx, String(reps), x + 20, TILE.y + 118, 78, { color: done ? LIME : WHITE });
  copy(ctx, `/ ${TARGET_REPS}`, x + 32 + width, TILE.y + 118, 34);
  for (let i = 0; i < TARGET_REPS; i++) {
    ctx.fillStyle = i < reps ? LIME : rgba(WHITE_RGB, 0.16);
    ctx.fillRect(x + 20 + i * 22, TILE.y + 146, 16, 8);
  }
}

function drawRest({ ctx, e }: Holo, x: number): void {
  const active = e >= REST_AT;
  const left = REST_SEC - Math.max(0, e - REST_AT);
  const cx = x + 62;
  const cy = TILE.y + 104;
  ctx.save();
  ctx.lineWidth = 7;
  ctx.strokeStyle = rgba(WHITE_RGB, 0.14);
  ctx.beginPath();
  ctx.arc(cx, cy, 40, 0, TAU);
  ctx.stroke();
  if (active) {
    ctx.lineCap = 'round';
    ctx.strokeStyle = LIME;
    setGlow(ctx, LIME_RGB, 12);
    ctx.beginPath();
    ctx.arc(cx, cy, 40, -TAU / 4, -TAU / 4 + TAU * (left / REST_SEC) * ramp(e, REST_AT, 0.4));
    ctx.stroke();
    clearGlow(ctx);
  }
  // Mono digits keep the clock from wobbling as the seconds change.
  const seconds = Math.ceil(left);
  const clock = `${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`;
  ctx.font = `700 40px ${FONT_MONO}`;
  ctx.fillStyle = active ? WHITE : rgba(WHITE_RGB, 0.35);
  ctx.fillText(clock, x + 120, TILE.y + 118);
  ctx.restore();
  label(ctx, active ? 'SAYAÇ BAŞLADI' : 'SET BİTİNCE BAŞLAR', x + 20, TILE.y + 164, { size: 14, color: active ? LIME : HOLO_LABEL });
}

export function drawWorkout(holo: Holo): void {
  const { ctx, e } = holo;
  drawLift(holo);
  const tiles = [
    { title: 'AĞIRLIK', draw: drawWeight },
    { title: 'TEKRAR', draw: drawReps },
    { title: 'DİNLENME', draw: drawRest },
  ];
  tiles.forEach((tile, i) => {
    const x = TILE.xs[i] ?? 20;
    const alpha = fade(e, 0.15 + i * 0.06);
    drawTile(ctx, x, tile.title, alpha);
    ctx.save();
    ctx.globalAlpha *= alpha;
    tile.draw(holo, x);
    ctx.restore();
  });
}
