/**
 * Astral gates: tick-marked rings standing on the avenue, built like the astrolabe in the sky.
 * The camera crosses one at every scene change. Lighter ribs between them keep the tunnel going.
 */
import type { Camera } from './camera';
import { GATE_SPACING } from './camera';
import { TAU, clamp } from './math';
import { LIME_RGB, WHITE_RGB, rgba } from './palette';

const GATE_RADIUS = 8;
const GATE_HEIGHT = 2.6;
const GATE_DEPTH = 1.5;
const RIB_RADIUS = 8.7;
const RIBS_PER_GATE = 4;
const GATE_FAR = 230;
/** Closer than this the ring is behind the lens. */
const GATE_NEAR = 0.45;
const RING_RGB = '214, 255, 120';
/** The membrane inside a gate becomes visible from this distance. */
const MEMBRANE_RANGE = 30;
const RIB_RGB = '160, 132, 255';

interface Ring {
  x: number;
  y: number;
  r: number;
  /** Screen height of the floor at the ring's depth: the ring is cut off below it. */
  floorY: number;
}

function ringAt(cam: Camera, dz: number, radius: number): Ring {
  const s = cam.f / dz;
  return {
    x: cam.cx - cam.x * s,
    y: cam.hy - (GATE_HEIGHT - cam.y) * s,
    r: radius * s,
    floorY: cam.hy + cam.y * s,
  };
}

function circle(ctx: CanvasRenderingContext2D, ring: Ring, scale = 1): void {
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r * scale, 0, TAU);
  ctx.stroke();
}

function strokeGate(ctx: CanvasRenderingContext2D, front: Ring, back: Ring, power: number, spin: number, detailed: boolean): void {
  const width = clamp(front.r * 0.016, 1.2, 24);

  ctx.strokeStyle = rgba(LIME_RGB, power * 0.45);
  ctx.lineWidth = Math.max(1, width * 0.5);
  circle(ctx, back);

  if (detailed && front.r > 90) {
    ctx.strokeStyle = rgba(WHITE_RGB, power * 0.35);
    ctx.lineWidth = Math.max(1, width * 0.3);
    ctx.beginPath();
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU + spin * 0.3;
      ctx.moveTo(front.x + Math.cos(a) * front.r, front.y + Math.sin(a) * front.r);
      ctx.lineTo(back.x + Math.cos(a) * back.r, back.y + Math.sin(a) * back.r);
    }
    ctx.stroke();
  }

  ctx.save();
  ctx.shadowColor = rgba(LIME_RGB, power);
  ctx.shadowBlur = clamp(front.r * 0.03, 6, 36);
  ctx.strokeStyle = rgba(RING_RGB, power);
  ctx.lineWidth = width;
  circle(ctx, front);
  ctx.restore();
  if (!detailed || front.r < 110) return;

  ctx.strokeStyle = rgba(WHITE_RGB, power * 0.5);
  ctx.lineWidth = Math.max(1, width * 0.18);
  circle(ctx, front, 0.93);

  ctx.strokeStyle = rgba(LIME_RGB, power * 0.7);
  ctx.lineWidth = Math.max(1, width * 0.22);
  ctx.beginPath();
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU + spin;
    const inner = front.r * (i % 6 === 0 ? 0.86 : 0.9);
    ctx.moveTo(front.x + Math.cos(a) * front.r * 0.93, front.y + Math.sin(a) * front.r * 0.93);
    ctx.lineTo(front.x + Math.cos(a) * inner, front.y + Math.sin(a) * inner);
  }
  ctx.stroke();

  ctx.strokeStyle = rgba(WHITE_RGB, power * 0.9);
  ctx.lineWidth = width * 1.5;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU - spin * 1.7;
    ctx.beginPath();
    ctx.arc(front.x, front.y, front.r * 1.075, a, a + 0.5);
    ctx.stroke();
  }
}

function fillMembrane(ctx: CanvasRenderingContext2D, ring: Ring, dz: number): void {
  const strength = clamp(1 - dz / MEMBRANE_RANGE) ** 2 * 0.42;
  if (strength < 0.01) return;
  const film = ctx.createRadialGradient(ring.x, ring.y, 0, ring.x, ring.y, ring.r);
  film.addColorStop(0, rgba(RING_RGB, strength * 0.55));
  film.addColorStop(0.75, rgba(RING_RGB, strength * 0.8));
  film.addColorStop(1, rgba(RING_RGB, strength));
  ctx.fillStyle = film;
  ctx.beginPath();
  ctx.arc(ring.x, ring.y, ring.r, 0, TAU);
  ctx.fill();
}

function drawGate(ctx: CanvasRenderingContext2D, cam: Camera, dz: number, t: number, index: number): void {
  const front = ringAt(cam, dz, GATE_RADIUS);
  const back = ringAt(cam, dz + GATE_DEPTH, GATE_RADIUS);
  // Far gates stay faint so they do not fight the hologram; they light up as they close in.
  const power = clamp(0.2 + (front.r - 150) / 480, 0.2, 1) * clamp((dz - GATE_NEAR) / 1.2);
  const spin = t * 0.22 * (index % 2 === 0 ? 1 : -1);

  ctx.save();
  ctx.beginPath();
  ctx.rect(-400, -6000, cam.w + 800, front.floorY + 6000);
  ctx.clip();
  fillMembrane(ctx, front, dz);
  strokeGate(ctx, front, back, power, spin, true);
  ctx.restore();

  // Its reflection on the wet floor.
  if (front.floorY >= cam.h) return;
  ctx.save();
  ctx.beginPath();
  ctx.rect(-400, front.floorY, cam.w + 800, cam.h - front.floorY + 400);
  ctx.clip();
  ctx.translate(0, 2 * front.floorY);
  ctx.scale(1, -1);
  strokeGate(ctx, front, back, power * 0.22, spin, false);
  ctx.restore();
}

function drawRib(ctx: CanvasRenderingContext2D, cam: Camera, dz: number): void {
  const ring = ringAt(cam, dz, RIB_RADIUS);
  const power = clamp(0.1 + (ring.r - 160) / 1100, 0.1, 0.5) * clamp((dz - GATE_NEAR) / 1.2);
  ctx.save();
  ctx.beginPath();
  ctx.rect(-400, -6000, cam.w + 800, ring.floorY + 6000);
  ctx.clip();
  ctx.strokeStyle = rgba(RIB_RGB, power);
  ctx.lineWidth = clamp(ring.r * 0.006, 1, 7);
  circle(ctx, ring);

  // Three small lights on the crown.
  ctx.fillStyle = rgba(LIME_RGB, Math.min(1, power * 1.8));
  ctx.shadowColor = rgba(LIME_RGB, 0.9);
  ctx.shadowBlur = 10;
  const dot = clamp(ring.r * 0.012, 1.4, 10);
  for (const a of [-TAU / 4 - 0.5, -TAU / 4, -TAU / 4 + 0.5]) {
    ctx.beginPath();
    ctx.arc(ring.x + Math.cos(a) * ring.r, ring.y + Math.sin(a) * ring.r, dot, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** `gateCount` gates stand at multiples of the gate spacing; ribs fill the gaps and run on past them. */
export function drawGates(ctx: CanvasRenderingContext2D, cam: Camera, t: number, gateCount: number): void {
  const spacing = GATE_SPACING / RIBS_PER_GATE;
  const first = Math.ceil((cam.z + GATE_NEAR) / spacing);
  const last = Math.floor((cam.z + GATE_FAR) / spacing);
  ctx.save();
  for (let j = last; j >= first; j--) {
    if (j <= 0) continue;
    const dz = j * spacing - cam.z;
    const gateIndex = j / RIBS_PER_GATE;
    if (j % RIBS_PER_GATE === 0 && gateIndex <= gateCount) drawGate(ctx, cam, dz, t, gateIndex);
    else drawRib(ctx, cam, dz);
  }
  ctx.restore();
}
