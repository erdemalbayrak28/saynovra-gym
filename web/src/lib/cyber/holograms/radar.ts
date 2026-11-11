/**
 * Buddy radar: a sweeping radar of the members who are inside right now. One of them is
 * locked on, linked to the viewer and matched as a spotter.
 */
import { TAU, easeOutCubic, lerp, mod, ramp } from '../math';
import { LIME, LIME_RGB, WHITE, WHITE_RGB, rgba } from '../palette';
import type { Holo } from './holo';
import { chip, copy, corners, display, fade, label, liveDot, setGlow } from './holo';

const CENTER = { x: 430, y: 212 } as const;
const RADIUS = 186;
const SWEEP_SEC = 3.4;
const LOCK_AT = 2.5;
const LINK_AT = 3.0;
const CARD_AT = 3.3;
const MATCH_AT = 4.3;
const CARD = { x: 632, y: 96, w: 218, h: 150 } as const;

interface Blip {
  /** Distance from the centre as a share of the radius. */
  r: number;
  angle: number;
  name?: string;
  tag?: string;
}

/** The first blip is the one that gets matched. All names are made up. */
const BLIPS: readonly Blip[] = [
  { r: 0.44, angle: -0.62, name: 'Burak B.', tag: 'BENCH' },
  { r: 0.8, angle: 2.0, name: 'Kerem K.', tag: 'SQUAT' },
  { r: 0.64, angle: 3.55, name: 'Elif A.', tag: 'KARDİYO' },
  { r: 0.9, angle: 5.0 },
  { r: 0.34, angle: 2.75 },
  { r: 0.72, angle: 0.55 },
];

function blipPoint(blip: Blip): { x: number; y: number } {
  return { x: CENTER.x + Math.cos(blip.angle) * blip.r * RADIUS, y: CENTER.y + Math.sin(blip.angle) * blip.r * RADIUS };
}

function sweepAngle(e: number): number {
  return -TAU / 4 + (e / SWEEP_SEC) * TAU;
}

function drawDial({ ctx, e }: Holo): void {
  const { x, y } = CENTER;
  ctx.save();
  ctx.globalAlpha = fade(e, 0);
  ctx.lineWidth = 1.5;
  for (const share of [0.25, 0.5, 0.75, 1]) {
    ctx.strokeStyle = rgba(LIME_RGB, share === 1 ? 0.55 : 0.22);
    ctx.beginPath();
    ctx.arc(x, y, RADIUS * share, 0, TAU);
    ctx.stroke();
  }
  ctx.strokeStyle = rgba(LIME_RGB, 0.16);
  ctx.beginPath();
  ctx.moveTo(x - RADIUS, y);
  ctx.lineTo(x + RADIUS, y);
  ctx.moveTo(x, y - RADIUS);
  ctx.lineTo(x, y + RADIUS);
  ctx.stroke();
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const to = RADIUS + (i % 3 === 0 ? 14 : 8);
    ctx.strokeStyle = rgba(LIME_RGB, i % 3 === 0 ? 0.5 : 0.25);
    ctx.beginPath();
    ctx.moveTo(x + Math.cos(a) * (RADIUS + 5), y + Math.sin(a) * (RADIUS + 5));
    ctx.lineTo(x + Math.cos(a) * to, y + Math.sin(a) * to);
    ctx.stroke();
  }

  // The sweep: a bright leading edge with a fading wedge behind it.
  const angle = sweepAngle(e);
  const slices = 40;
  for (let k = 0; k < slices; k++) {
    ctx.fillStyle = rgba(LIME_RGB, (1 - k / slices) ** 2 * 0.28);
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.arc(x, y, RADIUS, angle - (k + 1) * 0.03, angle - k * 0.03);
    ctx.closePath();
    ctx.fill();
  }
  ctx.save();
  ctx.strokeStyle = LIME;
  ctx.lineWidth = 2.5;
  setGlow(ctx, LIME_RGB, 14);
  ctx.beginPath();
  ctx.moveTo(x, y);
  ctx.lineTo(x + Math.cos(angle) * RADIUS, y + Math.sin(angle) * RADIUS);
  ctx.stroke();
  ctx.restore();

  ctx.fillStyle = WHITE;
  ctx.beginPath();
  ctx.moveTo(x, y - 8);
  ctx.lineTo(x + 8, y);
  ctx.lineTo(x, y + 8);
  ctx.lineTo(x - 8, y);
  ctx.closePath();
  ctx.fill();
  label(ctx, 'SEN', x + 14, y + 24, { size: 14, color: WHITE });
  ctx.restore();
}

function drawBlips({ ctx, e }: Holo): void {
  const angle = sweepAngle(e);
  ctx.save();
  ctx.globalAlpha = fade(e, 0.2);
  BLIPS.forEach((blip, i) => {
    const p = blipPoint(blip);
    // A blip flares when the sweep passes it, then cools like phosphor.
    const sincePass = (mod(angle - blip.angle, TAU) / TAU) * SWEEP_SEC;
    const heat = i === 0 && e >= LOCK_AT ? 1 : 0.35 + 0.65 * Math.exp(-sincePass * 1.3);
    ctx.save();
    setGlow(ctx, LIME_RGB, 12 * heat);
    ctx.fillStyle = rgba(LIME_RGB, heat);
    ctx.beginPath();
    ctx.arc(p.x, p.y, 7, 0, TAU);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = rgba(LIME_RGB, heat * 0.5);
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.arc(p.x, p.y, 13, 0, TAU);
    ctx.stroke();
    if (i === 0 || !blip.name) return;
    const left = p.x < CENTER.x;
    const tx = p.x + (left ? -22 : 22);
    copy(ctx, blip.name, tx, p.y + 2, 17, { weight: 600, color: WHITE, align: left ? 'right' : 'left', alpha: 0.5 + 0.5 * heat });
    label(ctx, blip.tag ?? '', tx, p.y + 20, { size: 12, align: left ? 'right' : 'left' });
  });
  ctx.restore();
}

function drawMatch({ ctx, e }: Holo): void {
  const target = BLIPS[0];
  if (!target || e < LOCK_AT) return;
  const p = blipPoint(target);
  const matched = e >= MATCH_AT;

  // Lock-on: brackets close in on the blip.
  const close = easeOutCubic(ramp(e, LOCK_AT, 0.4));
  const size = lerp(52, 24, close);
  ctx.save();
  ctx.translate(p.x, p.y);
  ctx.rotate((1 - close) * 0.8);
  corners(ctx, -size, -size, size * 2, size * 2, size * 0.5, matched ? LIME : WHITE, 2.5);
  ctx.restore();

  const link = ramp(e, LINK_AT, 0.3);
  if (link > 0) {
    ctx.save();
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 2.5;
    ctx.setLineDash(matched ? [] : [6, 5]);
    ctx.lineDashOffset = -e * 40;
    setGlow(ctx, LIME_RGB, 10);
    ctx.beginPath();
    ctx.moveTo(CENTER.x, CENTER.y);
    ctx.lineTo(lerp(CENTER.x, p.x, link), lerp(CENTER.y, p.y, link));
    ctx.stroke();
    ctx.restore();
  }

  if (matched) {
    const wave = ((e - MATCH_AT) * 0.9) % 1;
    ctx.strokeStyle = rgba(LIME_RGB, (1 - wave) * 0.8);
    ctx.lineWidth = 2;
    for (const point of [p, CENTER]) {
      ctx.beginPath();
      ctx.arc(point.x, point.y, 16 + wave * 34, 0, TAU);
      ctx.stroke();
    }
  }

  const card = fade(e, CARD_AT);
  if (card <= 0) return;
  ctx.save();
  ctx.globalAlpha = card;
  ctx.strokeStyle = rgba(WHITE_RGB, 0.5);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(p.x + 26, p.y - 16);
  ctx.lineTo(CARD.x - 30, CARD.y + 26);
  ctx.lineTo(CARD.x, CARD.y + 26);
  ctx.stroke();
  ctx.fillStyle = rgba(LIME_RGB, 0.05);
  ctx.fillRect(CARD.x, CARD.y, CARD.w, CARD.h);
  corners(ctx, CARD.x, CARD.y, CARD.w, CARD.h, 14, rgba(LIME_RGB, 0.7));
  label(ctx, matched ? 'EŞLEŞTİNİZ' : 'SPOTTER ARIYOR', CARD.x + 16, CARD.y + 30, { size: 14, color: matched ? LIME : undefined });
  copy(ctx, target.name ?? '', CARD.x + 16, CARD.y + 68, 27, { weight: 600, color: WHITE });
  copy(ctx, 'Bench Press · 100 kg', CARD.x + 16, CARD.y + 96, 18);
  chip(ctx, matched ? 'SOHBET AÇIK' : 'EŞLEŞ', CARD.x + 16, CARD.y + 124, { size: 14, filled: matched });
  ctx.restore();
}

function drawReadout({ ctx, e, t }: Holo): void {
  ctx.save();
  ctx.globalAlpha = fade(e, 0.15);
  label(ctx, 'İÇERİDE', 20, 52);
  const width = display(ctx, '24', 20, 112, 60);
  copy(ctx, 'üye', 32 + width, 112, 26);
  liveDot(ctx, 26, 386, t);
  label(ctx, 'CANLI RADAR', 40, 391, { size: 15, color: LIME });
  ctx.restore();
}

export function drawRadar(holo: Holo): void {
  drawDial(holo);
  drawBlips(holo);
  drawMatch(holo);
  drawReadout(holo);
}
