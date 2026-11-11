/**
 * The neon city on both sides of the avenue: dark towers in five lanes (low ones by the road,
 * giants far out), fogged toward the horizon, with lit windows, light bands, signs and beacons.
 * Every tower is derived from its row, lane and side, so the city is the same on every render.
 */
import type { Camera } from './camera';
import { NEAR } from './camera';
import { clamp, hash, lerp } from './math';
import { CYAN_RGB, FONT_DISPLAY, LIME_RGB, MAGENTA_RGB, rgba } from './palette';

const ROW_SPACING = 9;
const FAR = 210;
const WINDOW_RANGE = 95;
const REFLECTION_RANGE = 80;
/** Rows farther than this sit behind the horizon haze. */
const HAZE_DISTANCE = 62;

interface Lane {
  x: number;
  jitter: number;
  minHeight: number;
  maxHeight: number;
  detail: boolean;
}

/** Outer lanes first, so the towers nearer the road paint over them. */
const LANES: readonly Lane[] = [
  { x: 58, jitter: 8, minHeight: 20, maxHeight: 50, detail: false },
  { x: 41, jitter: 6, minHeight: 16, maxHeight: 38, detail: false },
  { x: 28, jitter: 3.5, minHeight: 10, maxHeight: 26, detail: true },
  { x: 19, jitter: 2, minHeight: 7, maxHeight: 17, detail: true },
  { x: 12.4, jitter: 1, minHeight: 3.5, maxHeight: 10, detail: true },
];

type Rgb = readonly [number, number, number];
const BODY: Rgb = [8, 10, 18];
const SIDE: Rgb = [14, 17, 30];
const FOG: Rgb = [24, 17, 54];
const LIGHTS = [LIME_RGB, LIME_RGB, '255, 232, 188', MAGENTA_RGB, CYAN_RGB] as const;
const HAZE_RGB = '112, 58, 196';
const SIGNS = ['NOVRA', 'GYM', 'NOVRA', 'AI', 'QR', 'GYM'] as const;
/** Share of windows that are lit. */
const LIT_SHARE = 0.26;

function mix(a: Rgb, b: Rgb, t: number): string {
  return `rgb(${Math.round(lerp(a[0], b[0], t))}, ${Math.round(lerp(a[1], b[1], t))}, ${Math.round(lerp(a[2], b[2], t))})`;
}

function lightTint(k: number): string {
  return LIGHTS[Math.floor(k * LIGHTS.length) % LIGHTS.length] ?? LIME_RGB;
}

interface Tower {
  id: number;
  side: number;
  detail: boolean;
  width: number;
  height: number;
  dz: number;
  /** 0 next to the camera, 1 at the far limit. */
  fog: number;
  /** Pixels per world unit at the front and at the back face. */
  scaleFront: number;
  scaleBack: number;
  xInner: number;
  xOuter: number;
  xInnerBack: number;
  top: number;
  base: number;
  topBack: number;
  baseBack: number;
  sideVisible: boolean;
}

function towerAt(cam: Camera, row: number, laneIndex: number, lane: Lane, side: number): Tower | null {
  const id = row * 16 + laneIndex * 2 + (side > 0 ? 1 : 0);
  if (hash(id, 1) < 0.12) return null;
  const width = 3 + hash(id, 2) * 3;
  const depth = 3 + hash(id, 3) * 3.5;
  const height = lerp(lane.minHeight, lane.maxHeight, hash(id, 4) ** 1.6);
  const centre = side * (lane.x + (hash(id, 5) - 0.5) * 2 * lane.jitter);
  const dz = row * ROW_SPACING + (hash(id, 6) - 0.5) * 2 - depth / 2 - cam.z;
  if (dz < NEAR || dz > FAR) return null;

  const scaleFront = cam.f / dz;
  const scaleBack = cam.f / (dz + depth);
  const inner = centre - (side * width) / 2;
  const outer = centre + (side * width) / 2;
  const xInner = cam.cx + (inner - cam.x) * scaleFront;
  const xOuter = cam.cx + (outer - cam.x) * scaleFront;
  const xInnerBack = cam.cx + (inner - cam.x) * scaleBack;
  if (Math.max(xInner, xOuter, xInnerBack) < -40 || Math.min(xInner, xOuter, xInnerBack) > cam.w + 40) return null;

  return {
    id,
    side,
    detail: lane.detail,
    width,
    height,
    dz,
    fog: clamp(dz / FAR) ** 0.75,
    scaleFront,
    scaleBack,
    xInner,
    xOuter,
    xInnerBack,
    top: cam.hy - (height - cam.y) * scaleFront,
    base: cam.hy + cam.y * scaleFront,
    topBack: cam.hy - (height - cam.y) * scaleBack,
    baseBack: cam.hy + cam.y * scaleBack,
    sideVisible: (inner - cam.x) * side > 0,
  };
}

function paintBody(ctx: CanvasRenderingContext2D, cam: Camera, tower: Tower): void {
  const clear = 1 - tower.fog;
  if (tower.sideVisible) {
    ctx.fillStyle = mix(SIDE, FOG, tower.fog * 0.9);
    ctx.beginPath();
    ctx.moveTo(tower.xInner, tower.top);
    ctx.lineTo(tower.xInnerBack, tower.topBack);
    ctx.lineTo(tower.xInnerBack, tower.baseBack);
    ctx.lineTo(tower.xInner, tower.base);
    ctx.closePath();
    ctx.fill();

    // Lit floors wrapping the side that faces the avenue.
    const bands = 2 + Math.floor(hash(tower.id, 7) * 3);
    ctx.lineWidth = clamp(tower.scaleFront * 0.06, 0.8, 3);
    for (let j = 0; j < bands; j++) {
      const level = tower.height * (0.25 + 0.7 * hash(tower.id, 20 + j)) - cam.y;
      ctx.strokeStyle = rgba(lightTint(hash(tower.id, 30 + j)), clear * 0.75);
      ctx.beginPath();
      ctx.moveTo(tower.xInner, cam.hy - level * tower.scaleFront);
      ctx.lineTo(tower.xInnerBack, cam.hy - level * tower.scaleBack);
      ctx.stroke();
    }
  }

  const x = Math.min(tower.xInner, tower.xOuter);
  const faceWidth = Math.abs(tower.xOuter - tower.xInner);
  ctx.fillStyle = mix(BODY, FOG, tower.fog * 0.9);
  ctx.fillRect(x, tower.top, faceWidth, tower.base - tower.top);
  if (clear > 0.06) {
    ctx.strokeStyle = rgba(LIME_RGB, clear * 0.5);
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(x, tower.top);
    ctx.lineTo(x + faceWidth, tower.top);
    ctx.moveTo(tower.xInner, tower.top);
    ctx.lineTo(tower.xInner, tower.base);
    ctx.stroke();
  }
}

function paintWindows(ctx: CanvasRenderingContext2D, cam: Camera, tower: Tower, t: number): void {
  const cols = Math.max(3, Math.round(tower.width * 2.6));
  const rows = Math.max(4, Math.round(tower.height * 2.2));
  const x0 = Math.min(tower.xInner, tower.xOuter);
  const cellW = Math.abs(tower.xOuter - tower.xInner) / cols;
  const cellH = (tower.base - tower.top) / rows;
  if (cellW < 3.4) return;
  const clear = 1 - tower.fog;
  for (let r = 0; r < rows; r++) {
    const y = tower.top + (r + 0.28) * cellH;
    if (y > cam.h || y + cellH < 0) continue;
    for (let c = 0; c < cols; c++) {
      const k = hash(tower.id, r * 53 + c, 7);
      if (k > LIT_SHARE) continue;
      // A few windows flicker.
      if (k < 0.015 && Math.floor(t * 4 + k * 400) % 3 === 0) continue;
      ctx.fillStyle = rgba(lightTint(k / LIT_SHARE), clear * (0.45 + 0.55 * hash(tower.id, r, c)));
      ctx.fillRect(x0 + (c + 0.25) * cellW, y, cellW * 0.5, cellH * 0.36);
    }
  }
}

/** A vertical neon sign near the inner edge of the front face. */
function paintSign(ctx: CanvasRenderingContext2D, tower: Tower, t: number): void {
  const text = SIGNS[Math.floor(hash(tower.id, 9) * SIGNS.length)] ?? 'NOVRA';
  const unit = tower.scaleFront * 0.95;
  if (unit < 9 || tower.height < text.length * 1.05 + 1.5) return;
  const rgb = hash(tower.id, 12) < 0.6 ? LIME_RGB : MAGENTA_RGB;
  const x = tower.xInner + tower.side * unit * 0.85;
  const top = tower.top + unit * 0.9;
  const flicker = hash(tower.id, Math.floor(t * 9)) < 0.07 ? 0.35 : 1;
  const clear = 1 - tower.fog;
  const plateHeight = unit * (text.length * 1.05 + 0.3);

  ctx.save();
  ctx.fillStyle = 'rgba(4, 5, 10, 0.9)';
  ctx.fillRect(x - unit * 0.6, top - unit * 0.2, unit * 1.2, plateHeight);
  ctx.strokeStyle = rgba(rgb, 0.8 * flicker * clear);
  ctx.lineWidth = Math.max(1, unit * 0.05);
  ctx.strokeRect(x - unit * 0.6, top - unit * 0.2, unit * 1.2, plateHeight);
  ctx.font = `700 ${unit}px ${FONT_DISPLAY}`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = rgba(rgb, flicker * (1 - tower.fog * 0.6));
  ctx.shadowColor = rgba(rgb, 0.9);
  ctx.shadowBlur = Math.min(30, unit * 0.5);
  [...text].forEach((char, i) => ctx.fillText(char, x, top + unit * (i * 1.05 + 0.5)));
  ctx.restore();
}

/** An antenna with a blinking warning light on the roof. */
function paintBeacon(ctx: CanvasRenderingContext2D, cam: Camera, tower: Tower, t: number): void {
  const x = (tower.xInner + tower.xOuter) / 2;
  const tip = cam.hy - (tower.height + 1.5 + hash(tower.id, 11) * 2.5 - cam.y) * tower.scaleFront;
  const clear = 1 - tower.fog;
  ctx.strokeStyle = rgba('150, 160, 190', clear * 0.6);
  ctx.lineWidth = 1;
  ctx.beginPath();
  ctx.moveTo(x, tower.top);
  ctx.lineTo(x, tip);
  ctx.stroke();
  if (Math.sin(t * 2.4 + tower.id) < 0.55) return;
  ctx.save();
  ctx.fillStyle = rgba(MAGENTA_RGB, clear);
  ctx.shadowColor = rgba(MAGENTA_RGB, 0.9);
  ctx.shadowBlur = 10;
  ctx.beginPath();
  ctx.arc(x, tip, clamp(tower.scaleFront * 0.12, 1.2, 5), 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

/** The light of a tower smeared down the wet floor in front of it. */
function paintReflection(ctx: CanvasRenderingContext2D, cam: Camera, tower: Tower): void {
  const length = Math.min((tower.base - tower.top) * 0.55, cam.h - tower.base + 40);
  if (length < 6) return;
  const rgb = lightTint(hash(tower.id, 30));
  const glow = ctx.createLinearGradient(0, tower.base, 0, tower.base + length);
  glow.addColorStop(0, rgba(rgb, 0.2 * (1 - tower.fog)));
  glow.addColorStop(1, rgba(rgb, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(Math.min(tower.xInner, tower.xOuter), tower.base, Math.abs(tower.xOuter - tower.xInner), length);
}

/** Violet haze lying on the horizon; far rows are drawn before it, near rows after. */
function paintHaze(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const top = cam.hy - 210;
  const bottom = cam.hy + 46;
  const haze = ctx.createLinearGradient(0, top, 0, bottom);
  haze.addColorStop(0, rgba(HAZE_RGB, 0));
  haze.addColorStop(0.82, rgba(HAZE_RGB, 0.3));
  haze.addColorStop(1, rgba(HAZE_RGB, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(-120, top, cam.w + 240, bottom - top);
}

function drawTower(ctx: CanvasRenderingContext2D, cam: Camera, t: number, tower: Tower, laneIndex: number): void {
  paintBody(ctx, cam, tower);
  if (!tower.detail) return;
  if (tower.dz < REFLECTION_RANGE) paintReflection(ctx, cam, tower);
  if (tower.dz < WINDOW_RANGE) paintWindows(ctx, cam, tower, t);
  if (laneIndex >= 3 && hash(tower.id, 8) < 0.22) paintSign(ctx, tower, t);
  if (tower.height > 8 && hash(tower.id, 10) < 0.35) paintBeacon(ctx, cam, tower, t);
}

export function drawTowers(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  const firstRow = Math.floor((cam.z + NEAR) / ROW_SPACING) - 1;
  const lastRow = Math.ceil((cam.z + FAR) / ROW_SPACING);
  ctx.save();
  let hazePainted = false;
  // Far rows first: nearer towers paint over farther ones.
  for (let row = lastRow; row >= firstRow; row--) {
    if (!hazePainted && row * ROW_SPACING - cam.z < HAZE_DISTANCE) {
      paintHaze(ctx, cam);
      hazePainted = true;
    }
    LANES.forEach((lane, laneIndex) => {
      for (const side of [-1, 1]) {
        const tower = towerAt(cam, row, laneIndex, lane, side);
        if (tower) drawTower(ctx, cam, t, tower, laneIndex);
      }
    });
  }
  ctx.restore();
}
