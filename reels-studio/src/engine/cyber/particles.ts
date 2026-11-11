/**
 * Things in the air: flying traffic in lanes above the avenue, dust that streaks past the camera
 * (the strongest cue that we are moving), and the warp streaks that fire at a scene change.
 */
import type { Camera } from './camera';
import { TAU, clamp, hash, mod } from './math';
import { LIME_RGB, MAGENTA_RGB, rgba } from './palette';

const TRAFFIC_RANGE = 234;
const TRAFFIC_PER_LANE = 9;
const TRAFFIC_NEAR = 14;
const DUST_COUNT = 240;
const DUST_RANGE = 130;
/** Dust keeps clear of the flight axis, where it would streak across the hologram. */
const DUST_CLEARANCE = 4.5;
const HEADLIGHT_RGB = '255, 244, 214';

interface AirLane {
  x: number;
  y: number;
  /** World speed along the avenue; negative lanes fly toward the camera. */
  speed: number;
  rgb: string;
}

const AIR_LANES: readonly AirLane[] = [
  { x: -5.2, y: 6.2, speed: 13, rgb: MAGENTA_RGB },
  { x: 5.2, y: 6.8, speed: -9, rgb: HEADLIGHT_RGB },
  { x: -6.8, y: 9.6, speed: -12, rgb: LIME_RGB },
  { x: 6.8, y: 10.4, speed: 16, rgb: MAGENTA_RGB },
  { x: -3.6, y: 12.5, speed: 20, rgb: HEADLIGHT_RGB },
  { x: 3.6, y: 13.4, speed: -15, rgb: LIME_RGB },
];

export function drawTraffic(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  ctx.save();
  ctx.lineCap = 'round';
  AIR_LANES.forEach((lane, laneIndex) => {
    for (let i = 0; i < TRAFFIC_PER_LANE; i++) {
      const start = i * 26 + hash(laneIndex, i) * 14;
      const dz = mod(start + lane.speed * t - cam.z, TRAFFIC_RANGE) + 2;
      // Vehicles stay small lights in the distance: they fade out before they get close.
      const fade = clamp(1 - dz / TRAFFIC_RANGE) * clamp((dz - TRAFFIC_NEAR) / 18);
      if (fade <= 0.01) continue;
      const s = cam.f / dz;
      const x = cam.cx + (lane.x - cam.x) * s;
      const y = cam.hy - (lane.y - cam.y) * s;
      // The trail hangs behind the vehicle in its own direction of travel.
      const tail = cam.f / Math.max(1, dz - Math.sign(lane.speed) * 5);
      const tailX = cam.cx + (lane.x - cam.x) * tail;
      const tailY = cam.hy - (lane.y - cam.y) * tail;
      const size = clamp(s * 0.07, 0.7, 2.4);
      const trail = ctx.createLinearGradient(x, y, tailX, tailY);
      trail.addColorStop(0, rgba(lane.rgb, fade * 0.7));
      trail.addColorStop(1, rgba(lane.rgb, 0));
      ctx.strokeStyle = trail;
      ctx.lineWidth = size * 1.1;
      ctx.beginPath();
      ctx.moveTo(x, y);
      ctx.lineTo(tailX, tailY);
      ctx.stroke();
      ctx.fillStyle = rgba(lane.rgb, fade);
      ctx.beginPath();
      ctx.arc(x, y, size, 0, TAU);
      ctx.fill();
    }
  });
  ctx.restore();
}

export function drawDust(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const streak = Math.max(0.25, cam.speed * 0.035);
  ctx.save();
  ctx.lineCap = 'round';
  for (let i = 0; i < DUST_COUNT; i++) {
    const X = (hash(i, 31) - 0.5) * 34;
    if (Math.abs(X) < DUST_CLEARANCE) continue;
    const Y = 0.3 + hash(i, 32) * 11;
    const dz = mod(hash(i, 33) * DUST_RANGE - cam.z, DUST_RANGE) + 0.7;
    const s0 = cam.f / dz;
    const x0 = cam.cx + (X - cam.x) * s0;
    const y0 = cam.hy - (Y - cam.y) * s0;
    if (x0 < -80 || x0 > cam.w + 80 || y0 < -80) continue;
    const s1 = cam.f / (dz + streak);
    const fade = clamp(1 - dz / DUST_RANGE) * clamp(dz / 4);
    ctx.strokeStyle = rgba(i % 4 === 0 ? LIME_RGB : '226, 232, 255', fade * 0.75);
    ctx.lineWidth = clamp(s0 * 0.012, 0.6, 2.6);
    ctx.beginPath();
    ctx.moveTo(x0, y0);
    ctx.lineTo(cam.cx + (X - cam.x) * s1, cam.hy - (Y - cam.y) * s1);
    ctx.stroke();
  }
  ctx.restore();
}

/** Radial light streaks from the vanishing point; `strength` peaks as a gate is crossed. */
export function drawWarp(ctx: CanvasRenderingContext2D, cam: Camera, strength: number, t: number): void {
  if (strength < 0.02) return;
  const frame = Math.floor(t * 30);
  ctx.save();
  ctx.lineCap = 'round';
  ctx.globalCompositeOperation = 'screen';
  for (let i = 0; i < 110; i++) {
    if (hash(i, frame) < 0.35) continue;
    const angle = hash(i, 51) * TAU;
    const from = 260 + hash(i, 52) * 700;
    const to = from + strength * (90 + hash(i, 53) * 340);
    ctx.strokeStyle = rgba(i % 3 === 0 ? LIME_RGB : '232, 238, 255', strength * 0.55 * hash(i, 54));
    ctx.lineWidth = 1 + hash(i, 55) * 2.2;
    ctx.beginPath();
    ctx.moveTo(cam.cx + Math.cos(angle) * from, cam.hy + Math.sin(angle) * from);
    ctx.lineTo(cam.cx + Math.cos(angle) * to, cam.hy + Math.sin(angle) * to);
    ctx.stroke();
  }
  ctx.restore();
}
