/** Live occupancy: a ring gauge of who is inside now, and the day's hourly load with the forecast. */
import { TAU, easeOutCubic, ramp } from '../math';
import { LIME, LIME_RGB, WHITE, WHITE_RGB, rgba } from '../palette';
import type { Holo } from './holo';
import { chip, clearGlow, display, fade, label, liveDot, setGlow } from './holo';

/** Relative load per hour from 08:00 to 22:00; hours after "now" are a forecast. */
const HOURS = [0.16, 0.22, 0.3, 0.27, 0.33, 0.3, 0.38, 0.47, 0.62, 0.86, 1, 0.9, 0.66, 0.42, 0.24] as const;
const FIRST_HOUR = 8;
const NOW_INDEX = 4;
const PEAK_INDEX = 10;
const INSIDE = 24;
const CAPACITY = 85;

const GAUGE = { x: 190, y: 206, r: 128 } as const;
const CHART = { x: 412, base: 334, height: 214, step: 29, bar: 19 } as const;

function drawGauge({ ctx, e, t }: Holo): void {
  const { x, y, r } = GAUGE;
  const sweep = easeOutCubic(ramp(e, 0.2, 1.2));

  ctx.save();
  ctx.globalAlpha = fade(e, 0);
  ctx.lineWidth = 1.5;
  for (let i = 0; i < 60; i++) {
    const a = (i / 60) * TAU;
    const long = i % 5 === 0;
    const from = r + 20;
    const to = from + (long ? 12 : 6);
    ctx.strokeStyle = rgba(LIME_RGB, long ? 0.55 : 0.25);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * from, y + Math.sin(a) * from);
    ctx.lineTo(x + Math.cos(a) * to, y + Math.sin(a) * to);
    ctx.stroke();
  }

  ctx.lineWidth = 16;
  ctx.strokeStyle = rgba(WHITE_RGB, 0.1);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();

  ctx.lineCap = 'round';
  ctx.strokeStyle = LIME;
  setGlow(ctx, LIME_RGB, 18);
  ctx.beginPath();
  ctx.arc(x, y, r, -TAU / 4, -TAU / 4 + TAU * (INSIDE / CAPACITY) * sweep);
  ctx.stroke();
  clearGlow(ctx);

  liveDot(ctx, x - 44, y - 68, t);
  label(ctx, 'CANLI', x - 30, y - 62, { color: LIME });
  display(ctx, String(Math.round(INSIDE * sweep)), x, y + 40, 112, { align: 'center' });
  label(ctx, `/ ${CAPACITY} KİŞİ`, x, y + 76, { align: 'center', size: 19 });
  ctx.restore();

  chip(ctx, 'RAHAT · %28', x, 398, { align: 'center', size: 17, alpha: fade(e, 1.1) });
}

function drawBar(ctx: CanvasRenderingContext2D, index: number, x: number, y: number, height: number): void {
  const { bar } = CHART;
  if (index === NOW_INDEX) {
    ctx.save();
    setGlow(ctx, LIME_RGB, 20);
    ctx.fillStyle = LIME;
    ctx.fillRect(x, y, bar, height);
    ctx.restore();
  } else if (index < NOW_INDEX) {
    ctx.fillStyle = rgba(LIME_RGB, 0.32);
    ctx.fillRect(x, y, bar, height);
    ctx.fillStyle = rgba(LIME_RGB, 0.9);
    ctx.fillRect(x, y, bar, 2.5);
  } else {
    // Forecast hours: a dashed outline instead of a solid bar.
    ctx.fillStyle = rgba(LIME_RGB, 0.08);
    ctx.fillRect(x, y, bar, height);
    ctx.save();
    ctx.setLineDash([5, 4]);
    ctx.strokeStyle = rgba(LIME_RGB, 0.8);
    ctx.lineWidth = 1.5;
    ctx.strokeRect(x + 0.75, y + 0.75, bar - 1.5, height);
    ctx.restore();
  }
}

function drawHours({ ctx, e }: Holo): void {
  const { x, base, height, step, bar } = CHART;
  ctx.save();
  label(ctx, 'SAATLİK YOĞUNLUK · TAHMİN', x, 44, { alpha: fade(e, 0.15) });
  ctx.strokeStyle = rgba(WHITE_RGB, 0.22);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(x - 8, base + 0.5);
  ctx.lineTo(x + step * HOURS.length, base + 0.5);
  ctx.stroke();

  HOURS.forEach((value, i) => {
    const grow = easeOutCubic(ramp(e, 0.3 + i * 0.05, 0.5));
    const barHeight = Math.max(2, value * height * grow);
    drawBar(ctx, i, x + i * step, base - barHeight, barHeight);
  });

  const ticks = fade(e, 0.6);
  for (const i of [0, 8, 12]) {
    label(ctx, `${String(FIRST_HOUR + i).padStart(2, '0')}:00`, x + i * step + bar / 2, base + 30, { align: 'center', size: 15, alpha: ticks });
  }
  label(ctx, 'ŞİMDİ', x + NOW_INDEX * step + bar / 2, base + 30, { align: 'center', size: 15, color: LIME, alpha: ticks });

  const peak = fade(e, 1.3);
  const peakX = x + PEAK_INDEX * step + bar / 2;
  const peakY = base - height - 14;
  label(ctx, `EN YOĞUN ${FIRST_HOUR + PEAK_INDEX}:00`, peakX, peakY - 12, { align: 'center', size: 15, color: WHITE, alpha: peak });
  ctx.globalAlpha = peak;
  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(peakX - 6, peakY - 4);
  ctx.lineTo(peakX + 6, peakY - 4);
  ctx.lineTo(peakX, peakY + 4);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

export function drawOccupancy(holo: Holo): void {
  drawGauge(holo);
  drawHours(holo);
}
