/**
 * The door code: a QR that re-assembles itself on a timer while a scan beam reads it, with its
 * signature on one side and the refresh ring on the other. The pattern is a stand-in, not a real code.
 */
import { TAU, hash, ramp } from '../math';
import { ALERT, LIME, LIME_RGB, WHITE, WHITE_RGB, rgba } from '../palette';
import type { Holo } from './holo';
import { chip, clearGlow, corners, display, fade, label, setGlow } from './holo';

const MODULES = 25;
/** One refresh cycle on screen. It stands for the real 30 seconds. */
const CYCLE_SEC = 2.8;
const SCAN_FROM = 0.55;
const SCAN_SEC = 1.2;
const CONFIRM_FROM = 1.85;
const CONFIRM_TO = 2.7;
const QR = { x: 290, y: 46, size: 280 } as const;
const FINDERS: ReadonlyArray<readonly [number, number]> = [
  [0, 0],
  [MODULES - 7, 0],
  [0, MODULES - 7],
];

/** The fixed parts every QR has: three finders, an alignment square and the timing lines. */
function fixedModule(col: number, row: number): boolean | null {
  for (const [zx, zy] of FINDERS) {
    const lx = col - zx;
    const ly = row - zy;
    if (lx < -1 || lx > 7 || ly < -1 || ly > 7) continue;
    if (lx < 0 || lx > 6 || ly < 0 || ly > 6) return false;
    const edge = lx === 0 || lx === 6 || ly === 0 || ly === 6;
    const core = lx >= 2 && lx <= 4 && ly >= 2 && ly <= 4;
    return edge || core;
  }
  const ax = col - 16;
  const ay = row - 16;
  if (ax >= 0 && ax <= 4 && ay >= 0 && ay <= 4) return ax === 0 || ax === 4 || ay === 0 || ay === 4 || (ax === 2 && ay === 2);
  if (row === 6 || col === 6) return (row + col) % 2 === 0;
  return null;
}

function moduleOn(generation: number, col: number, row: number): boolean {
  return fixedModule(col, row) ?? hash(generation + 3, col, row) > 0.52;
}

function hexLine(seed: number, line: number): string {
  let out = '';
  for (let i = 0; i < 12; i++) {
    out += Math.floor(hash(seed, line, i) * 16).toString(16);
    if (i % 4 === 3 && i < 11) out += ' ';
  }
  return out;
}

function drawCode({ ctx, e }: Holo, generation: number, cycle: number): void {
  const cell = QR.size / MODULES;
  const confirmed = cycle > CONFIRM_FROM && cycle < CONFIRM_TO;
  ctx.save();
  ctx.globalAlpha = fade(e, 0);
  corners(ctx, QR.x - 22, QR.y - 22, QR.size + 44, QR.size + 44, 34, confirmed ? LIME : rgba(LIME_RGB, 0.6), confirmed ? 4 : 2.5);

  for (let row = 0; row < MODULES; row++) {
    for (let col = 0; col < MODULES; col++) {
      if (!moduleOn(generation, col, row)) continue;
      // Modules pop in at scattered moments, so each new code visibly assembles.
      const appear = ramp(cycle, hash(generation + 1, col, row) * 0.32, 0.08);
      if (appear <= 0) continue;
      ctx.fillStyle = rgba(LIME_RGB, 0.3 + 0.7 * appear);
      ctx.fillRect(QR.x + col * cell + 0.6, QR.y + row * cell + 0.6, cell - 1.2, cell - 1.2);
    }
  }

  const scan = ramp(cycle, SCAN_FROM, SCAN_SEC);
  if (scan > 0 && scan < 1) {
    const y = QR.y + scan * QR.size;
    const trail = ctx.createLinearGradient(0, y - 46, 0, y);
    trail.addColorStop(0, rgba(WHITE_RGB, 0));
    trail.addColorStop(1, rgba(WHITE_RGB, 0.28));
    ctx.fillStyle = trail;
    ctx.fillRect(QR.x - 14, y - 46, QR.size + 28, 46);
    ctx.save();
    setGlow(ctx, WHITE_RGB, 16);
    ctx.fillStyle = WHITE;
    ctx.fillRect(QR.x - 22, y - 1.5, QR.size + 44, 3);
    ctx.restore();
  }

  const statusY = QR.y + QR.size + 66;
  if (confirmed) {
    const width = label(ctx, 'GEÇİŞ ONAYLANDI', 446, statusY, { align: 'center', size: 19, weight: 700, color: LIME });
    // A tick just left of the words.
    const left = 446 - width / 2;
    ctx.strokeStyle = LIME;
    ctx.lineWidth = 3.5;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.beginPath();
    ctx.moveTo(left - 36, statusY - 8);
    ctx.lineTo(left - 28, statusY);
    ctx.lineTo(left - 14, statusY - 15);
    ctx.stroke();
  } else {
    label(ctx, 'TURNİKEYE OKUT', 430, statusY, { align: 'center' });
  }
  ctx.restore();
}

function drawSignature({ ctx, e, t }: Holo, generation: number, cycle: number): void {
  const scrambling = cycle < 0.34;
  const seed = scrambling ? Math.floor(t * 30) * 7 + generation : generation;
  ctx.save();
  ctx.globalAlpha = fade(e, 0.25);
  label(ctx, 'İMZA', 20, 62);
  label(ctx, 'HMAC-SHA256', 20, 90, { size: 19, color: WHITE });
  for (let line = 0; line < 5; line++) {
    label(ctx, hexLine(seed, line), 20, 136 + line * 34, { size: 21, spacing: 1.2, color: rgba(LIME_RGB, scrambling ? 0.6 : 0.92) });
  }
  chip(ctx, 'OFFLINE ÇALIŞIR', 20, 330, { size: 15 });
  ctx.restore();
}

function drawRefresh({ ctx, e }: Holo, cycle: number): void {
  const x = 725;
  const y = 126;
  const r = 60;
  ctx.save();
  ctx.globalAlpha = fade(e, 0.4);
  ctx.lineWidth = 8;
  ctx.strokeStyle = rgba(WHITE_RGB, 0.12);
  ctx.beginPath();
  ctx.arc(x, y, r, 0, TAU);
  ctx.stroke();
  ctx.lineCap = 'round';
  ctx.strokeStyle = LIME;
  setGlow(ctx, LIME_RGB, 14);
  ctx.beginPath();
  ctx.arc(x, y, r, -TAU / 4, -TAU / 4 + TAU * (1 - cycle / CYCLE_SEC));
  ctx.stroke();
  clearGlow(ctx);
  display(ctx, '30', x, y + 12, 44, { align: 'center' });
  label(ctx, 'SN', x, y + 34, { align: 'center', size: 14 });
  label(ctx, 'YENİLENİR', x, y + r + 40, { align: 'center', size: 16 });

  // A screenshot of the code is worthless: a crossed-out frame.
  ctx.strokeStyle = rgba(WHITE_RGB, 0.75);
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.roundRect(x - 26, 262, 52, 36, 6);
  ctx.stroke();
  ctx.strokeStyle = ALERT;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(x - 34, 306);
  ctx.lineTo(x + 34, 254);
  ctx.stroke();
  label(ctx, 'EKRAN GÖRÜNTÜSÜ', x, 334, { align: 'center', size: 15 });
  label(ctx, 'GEÇERSİZ', x, 358, { align: 'center', size: 15, color: WHITE });
  ctx.restore();
}

export function drawQr(holo: Holo): void {
  const generation = Math.floor(holo.e / CYCLE_SEC);
  const cycle = holo.e - generation * CYCLE_SEC;
  drawCode(holo, generation, cycle);
  drawSignature(holo, generation, cycle);
  drawRefresh(holo, cycle);
}
