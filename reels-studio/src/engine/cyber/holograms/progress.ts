/**
 * Progress: eight weeks of training volume drawn as a constellation that climbs to a record,
 * next to the weekly figure and the trainer who sees it live.
 */
import { TAU, easeOutCubic, hash, lerp, ramp } from '../math';
import { LIME, LIME_RGB, WHITE, WHITE_RGB, rgba } from '../palette';
import type { Holo } from './holo';
import { chip, copy, display, fade, label, liveDot, setGlow } from './holo';

/** Tonnes lifted per week. */
const WEEKS = [9.8, 10.6, 10.2, 11.5, 12.3, 12.0, 13.6, 14.92] as const;
const LAST = WEEKS.length - 1;
const CHART = { x: 62, step: 72, base: 346, top: 84, min: 9, max: 15 } as const;
const DRAW_FROM = 0.35;
const DRAW_SEC = 1.9;
const SIDE_X = 614;

interface Point {
  x: number;
  y: number;
}

function pointAt(index: number): Point {
  const value = WEEKS[index] ?? CHART.min;
  const share = (value - CHART.min) / (CHART.max - CHART.min);
  return { x: CHART.x + index * CHART.step, y: CHART.base - share * (CHART.base - CHART.top) };
}

/** The points reached so far; the last one is the moving tip of the line. */
function drawnPath(progress: number): Point[] {
  const reach = progress * LAST;
  const whole = Math.floor(reach);
  const points: Point[] = [];
  for (let i = 0; i <= Math.min(whole, LAST); i++) points.push(pointAt(i));
  if (whole < LAST) {
    const from = pointAt(whole);
    const to = pointAt(whole + 1);
    const part = reach - whole;
    points.push({ x: lerp(from.x, to.x, part), y: lerp(from.y, to.y, part) });
  }
  return points;
}

function drawBackdrop({ ctx, e, t }: Holo): void {
  ctx.save();
  ctx.globalAlpha = fade(e, 0);
  for (let i = 0; i < 30; i++) {
    const twinkle = 0.6 + 0.4 * Math.sin(t * 2 + i * 1.7);
    ctx.fillStyle = rgba(WHITE_RGB, (0.15 + hash(i, 71) * 0.3) * twinkle);
    ctx.fillRect(34 + hash(i, 72) * 560, 44 + hash(i, 73) * 290, 2, 2);
  }
  ctx.setLineDash([3, 9]);
  ctx.strokeStyle = rgba(WHITE_RGB, 0.12);
  ctx.lineWidth = 1;
  for (const y of [CHART.top + 18, (CHART.top + CHART.base) / 2 + 9]) {
    ctx.beginPath();
    ctx.moveTo(40, y);
    ctx.lineTo(592, y);
    ctx.stroke();
  }
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(WHITE_RGB, 0.28);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(40, CHART.base + 0.5);
  ctx.lineTo(592, CHART.base + 0.5);
  ctx.stroke();
  WEEKS.forEach((_, i) => {
    label(ctx, `H${i + 1}`, pointAt(i).x, CHART.base + 28, { align: 'center', size: 15, color: i === LAST ? LIME : undefined });
  });
  ctx.restore();
}

function drawStar(ctx: CanvasRenderingContext2D, point: Point, size: number): void {
  ctx.strokeStyle = rgba(WHITE_RGB, 0.8);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(point.x - size, point.y);
  ctx.lineTo(point.x + size, point.y);
  ctx.moveTo(point.x, point.y - size);
  ctx.lineTo(point.x, point.y + size);
  ctx.stroke();
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.arc(point.x, point.y, size * 0.42, 0, TAU);
  ctx.fill();
}

function drawLine({ ctx, e, t }: Holo, progress: number): void {
  const path = drawnPath(progress);
  const tip = path[path.length - 1];
  const first = path[0];
  if (!tip || !first) return;

  ctx.save();
  const area = ctx.createLinearGradient(0, CHART.top, 0, CHART.base);
  area.addColorStop(0, rgba(LIME_RGB, 0.2));
  area.addColorStop(1, rgba(LIME_RGB, 0));
  ctx.fillStyle = area;
  ctx.beginPath();
  ctx.moveTo(first.x, CHART.base);
  for (const p of path) ctx.lineTo(p.x, p.y);
  ctx.lineTo(tip.x, CHART.base);
  ctx.closePath();
  ctx.fill();

  ctx.setLineDash([2, 6]);
  ctx.strokeStyle = rgba(WHITE_RGB, 0.2);
  ctx.lineWidth = 1;
  for (const p of path.slice(0, Math.floor(progress * LAST) + 1)) {
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x, CHART.base);
    ctx.stroke();
  }
  ctx.setLineDash([]);

  ctx.save();
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 3.5;
  ctx.lineJoin = 'round';
  ctx.lineCap = 'round';
  setGlow(ctx, LIME_RGB, 16);
  ctx.beginPath();
  path.forEach((p, i) => (i === 0 ? ctx.moveTo(p.x, p.y) : ctx.lineTo(p.x, p.y)));
  ctx.stroke();
  ctx.restore();

  for (let i = 0; i <= Math.min(Math.floor(progress * LAST), LAST - 1); i++) drawStar(ctx, pointAt(i), 9);

  if (progress >= 1) {
    const record = pointAt(LAST);
    const since = e - (DRAW_FROM + DRAW_SEC);
    // Rings keep spreading from the record point.
    for (const offset of [0, 0.5]) {
      const wave = (since * 0.8 + offset) % 1;
      ctx.strokeStyle = rgba(LIME_RGB, (1 - wave) * 0.7);
      ctx.lineWidth = 2;
      ctx.beginPath();
      ctx.arc(record.x, record.y, 12 + wave * 30, 0, TAU);
      ctx.stroke();
    }
    ctx.save();
    setGlow(ctx, LIME_RGB, 18);
    drawStar(ctx, record, 15 + Math.sin(t * 4) * 1.5);
    ctx.restore();
    chip(ctx, 'REKOR', record.x - 22, record.y - 34, { filled: true, align: 'right', alpha: fade(since, 0, 0.3) });
  }
  ctx.restore();
}

function drawSide({ ctx, e, t }: Holo, progress: number): void {
  ctx.save();
  ctx.globalAlpha = fade(e, 0.2);
  label(ctx, 'HAFTALIK HACİM', SIDE_X, 66);
  const kilos = Math.round(lerp(WEEKS[0] * 1000, (WEEKS[LAST] ?? WEEKS[0]) * 1000, easeOutCubic(progress)));
  const width = display(ctx, kilos.toLocaleString('tr-TR'), SIDE_X, 134, 58);
  copy(ctx, 'kg', SIDE_X + width + 10, 134, 24);
  chip(ctx, '+%9,7 BU HAFTA', SIDE_X, 172, { size: 15, alpha: fade(e, DRAW_FROM + DRAW_SEC) });

  ctx.strokeStyle = rgba(WHITE_RGB, 0.18);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(SIDE_X, 222.5);
  ctx.lineTo(846, 222.5);
  ctx.stroke();

  label(ctx, 'EĞİTMEN', SIDE_X, 258);
  ctx.fillStyle = rgba(LIME_RGB, 0.12);
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(SIDE_X + 22, 306, 22, 0, TAU);
  ctx.fill();
  ctx.stroke();
  label(ctx, 'HK', SIDE_X + 23, 311, { align: 'center', size: 15, color: LIME, spacing: 1 });
  copy(ctx, 'Hakan Koç', SIDE_X + 56, 302, 23, { weight: 600, color: WHITE });
  liveDot(ctx, SIDE_X + 62, 325, t);
  label(ctx, 'CANLI GÖRÜYOR', SIDE_X + 76, 330, { size: 14, color: LIME });
  ctx.restore();
}

export function drawProgress(holo: Holo): void {
  const progress = ramp(holo.e, DRAW_FROM, DRAW_SEC);
  drawBackdrop(holo);
  drawLine(holo, progress);
  drawSide(holo, progress);
}
