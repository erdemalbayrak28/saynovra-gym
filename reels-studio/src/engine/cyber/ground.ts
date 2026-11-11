/**
 * The avenue the camera flies over: a wet, dark floor with a perspective grid, two lime rails
 * marking the lane, and pulses of light that run ahead toward the horizon.
 */
import type { Camera } from './camera';
import { NEAR } from './camera';
import { clamp, mod } from './math';
import { LIME_RGB, MAGENTA_RGB, VIOLET_RGB, WHITE_RGB, rgba } from './palette';

const CELL = 2;
const GRID_HALF_COLUMNS = 44;
const GRID_DEPTH = 190;
const ROAD_HALF = 1.6;
const DASH_SPACING = 4;
const DASH_LENGTH = 1.5;
const PULSE_SPEED = 42;
const PULSE_RANGE = 186;

/** Screen position of the floor point (X, 0, cam.z + dz). */
function floorPoint(cam: Camera, X: number, dz: number): { x: number; y: number } {
  const s = cam.f / dz;
  return { x: cam.cx + (X - cam.x) * s, y: cam.hy + cam.y * s };
}

function drawFloorBase(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const { w, h, hy, cx } = cam;
  const floor = ctx.createLinearGradient(0, hy, 0, h);
  floor.addColorStop(0, '#1E1242');
  floor.addColorStop(0.1, '#120D2B');
  floor.addColorStop(0.45, '#090B17');
  floor.addColorStop(1, '#05060B');
  ctx.fillStyle = floor;
  ctx.fillRect(-120, hy, w + 240, h - hy + 120);

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  // The planet's light lying on the wet ground, like a moon glade.
  ctx.save();
  ctx.translate(cx, hy);
  ctx.scale(1, 2.4);
  const glade = ctx.createRadialGradient(0, 0, 0, 0, 0, 190);
  glade.addColorStop(0, rgba('214, 255, 150', 0.2));
  glade.addColorStop(0.5, rgba(VIOLET_RGB, 0.1));
  glade.addColorStop(1, rgba(VIOLET_RGB, 0));
  ctx.fillStyle = glade;
  ctx.fillRect(-190, 0, 380, 190);
  ctx.restore();

  const haze = ctx.createLinearGradient(0, hy, 0, hy + 90);
  haze.addColorStop(0, rgba(MAGENTA_RGB, 0.28));
  haze.addColorStop(1, rgba(MAGENTA_RGB, 0));
  ctx.fillStyle = haze;
  ctx.fillRect(-120, hy, w + 240, 90);
  ctx.restore();
}

/** Lines running away from the camera; they all meet at the vanishing point. */
function drawGridColumns(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const { cx, hy, h, f } = cam;
  const bottom = h + 60;
  const dzBottom = (f * cam.y) / (bottom - hy);
  const fade = ctx.createLinearGradient(0, hy, 0, h);
  fade.addColorStop(0, rgba(VIOLET_RGB, 0));
  fade.addColorStop(0.12, rgba(VIOLET_RGB, 0.34));
  fade.addColorStop(1, rgba(VIOLET_RGB, 0.5));
  ctx.strokeStyle = fade;
  ctx.lineWidth = 1.3;
  ctx.beginPath();
  const first = Math.round(cam.x / CELL) - GRID_HALF_COLUMNS;
  for (let k = first; k <= first + GRID_HALF_COLUMNS * 2; k++) {
    const X = k * CELL;
    if (Math.abs(X) < ROAD_HALF) continue;
    ctx.moveTo(cx, hy);
    ctx.lineTo(cx + (f * (X - cam.x)) / dzBottom, bottom);
  }
  ctx.stroke();
}

/** Lines across the avenue; these are what rushes toward the viewer. */
function drawGridRows(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const first = Math.ceil((cam.z + NEAR) / CELL);
  for (let m = first; m < first + GRID_DEPTH / CELL; m++) {
    const dz = m * CELL - cam.z;
    const y = cam.hy + (cam.f * cam.y) / dz;
    const near = clamp(1 - dz / GRID_DEPTH);
    const major = m % 8 === 0;
    ctx.strokeStyle = rgba(major ? '178, 160, 255' : VIOLET_RGB, near * near * (major ? 0.75 : 0.5));
    ctx.lineWidth = clamp(22 / dz, 0.7, 4.5);
    ctx.beginPath();
    ctx.moveTo(-120, y);
    ctx.lineTo(cam.w + 120, y);
    ctx.stroke();
  }
}

function drawRoad(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const { cx, hy, h, f } = cam;
  const bottom = h + 60;
  const dzBottom = (f * cam.y) / (bottom - hy);
  const left = cx + (f * (-ROAD_HALF - cam.x)) / dzBottom;
  const right = cx + (f * (ROAD_HALF - cam.x)) / dzBottom;

  const lane = ctx.createLinearGradient(0, hy, 0, h);
  lane.addColorStop(0, 'rgba(4, 5, 10, 0)');
  lane.addColorStop(0.3, 'rgba(4, 5, 10, 0.55)');
  lane.addColorStop(1, 'rgba(4, 5, 10, 0.7)');
  ctx.fillStyle = lane;
  ctx.beginPath();
  ctx.moveTo(cx, hy);
  ctx.lineTo(right, bottom);
  ctx.lineTo(left, bottom);
  ctx.closePath();
  ctx.fill();

  const rail = ctx.createLinearGradient(0, hy, 0, h);
  rail.addColorStop(0, rgba(LIME_RGB, 0));
  rail.addColorStop(0.08, rgba(LIME_RGB, 0.95));
  rail.addColorStop(0.35, rgba(LIME_RGB, 0.7));
  rail.addColorStop(1, rgba(LIME_RGB, 0.55));
  ctx.save();
  ctx.strokeStyle = rail;
  ctx.lineWidth = 3;
  ctx.shadowColor = rgba(LIME_RGB, 0.9);
  ctx.shadowBlur = 14;
  ctx.beginPath();
  ctx.moveTo(cx, hy);
  ctx.lineTo(left, bottom);
  ctx.moveTo(cx, hy);
  ctx.lineTo(right, bottom);
  ctx.stroke();
  ctx.restore();

  const first = Math.ceil((cam.z + NEAR) / DASH_SPACING);
  for (let n = first; n < first + 40; n++) {
    const dz = n * DASH_SPACING - cam.z;
    const a = floorPoint(cam, -0.08, dz);
    const b = floorPoint(cam, 0.08, dz);
    const c = floorPoint(cam, 0.08, dz + DASH_LENGTH);
    const d = floorPoint(cam, -0.08, dz + DASH_LENGTH);
    ctx.fillStyle = rgba(WHITE_RGB, clamp(1 - dz / 160) ** 1.5 * clamp(dz / 9, 0.35, 1) * 0.7);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.lineTo(c.x, c.y);
    ctx.lineTo(d.x, d.y);
    ctx.closePath();
    ctx.fill();
  }
}

/** Bars of light that outrun the camera toward the horizon and pull the eye forward. */
function drawPulses(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  ctx.save();
  ctx.shadowColor = rgba(LIME_RGB, 0.9);
  ctx.shadowBlur = 12;
  for (let k = 0; k < 3; k++) {
    const dz = mod(t * PULSE_SPEED + k * (PULSE_RANGE / 3), PULSE_RANGE) + 4;
    const left = floorPoint(cam, -9, dz);
    const right = floorPoint(cam, 9, dz);
    // Fades out toward the horizon, and in as it leaves the camera, so a new pulse never pops.
    const strength = clamp(1 - dz / (PULSE_RANGE + 4)) ** 1.4 * clamp((dz - 4) / 12);
    const g = ctx.createLinearGradient(left.x, 0, right.x, 0);
    g.addColorStop(0, rgba(LIME_RGB, 0));
    g.addColorStop(0.5, rgba(LIME_RGB, strength));
    g.addColorStop(1, rgba(LIME_RGB, 0));
    ctx.strokeStyle = g;
    ctx.lineWidth = clamp(46 / dz, 1, 7);
    ctx.beginPath();
    ctx.moveTo(left.x, left.y);
    ctx.lineTo(right.x, right.y);
    ctx.stroke();
  }
  ctx.restore();
}

export function drawGround(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  ctx.save();
  drawFloorBase(ctx, cam);
  drawGridColumns(ctx, cam);
  drawGridRows(ctx, cam);
  drawRoad(ctx, cam);
  drawPulses(ctx, cam, t);
  ctx.restore();
}
