/**
 * The astral sky: star trails wheeling around a colossal planet on the horizon, constellations,
 * searchlights from the far city and an astrolabe of slowly turning rings around the planet.
 */
import type { Camera } from './camera';
import { TAU, clamp, hash, lerp } from './math';
import { LIME_RGB, MAGENTA_RGB, VIOLET_RGB, WHITE_RGB, rgba } from './palette';

/** The whole sky turns around the planet, like a long exposure of the night sky. */
const SKY_SPIN = 0.02;
const STAR_COUNT = 620;
const RIM_RGB = '234, 255, 190';

export interface Planet {
  x: number;
  y: number;
  r: number;
}

export function planetOf(cam: Camera): Planet {
  return { x: cam.cx, y: cam.hy + 135, r: cam.w * 0.352 };
}

interface TrailStar {
  radius: number;
  angle: number;
  span: number;
  alpha: number;
  width: number;
  tint: string;
  twinkle: number;
}

let trailCache: TrailStar[] | null = null;

function trailStars(): TrailStar[] {
  if (trailCache) return trailCache;
  const stars: TrailStar[] = [];
  for (let i = 0; i < STAR_COUNT; i++) {
    const bright = hash(i, 4) > 0.88;
    const tintPick = hash(i, 6);
    stars.push({
      // Even spread over the area between the planet's limb and the far corners of the frame.
      radius: Math.sqrt(lerp(380 ** 2, 1260 ** 2, hash(i, 1))),
      angle: hash(i, 2) * TAU,
      span: 0.035 + hash(i, 3) * 0.075,
      alpha: bright ? 0.95 : 0.22 + hash(i, 5) * 0.4,
      width: bright ? 1.8 : 1,
      tint: tintPick < 0.14 ? LIME_RGB : tintPick < 0.3 ? '190, 170, 255' : '232, 238, 255',
      twinkle: hash(i, 7) * TAU,
    });
  }
  trailCache = stars;
  return stars;
}

function drawBackdrop(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  const { w, hy, cx } = cam;
  const sky = ctx.createLinearGradient(0, 0, 0, hy);
  sky.addColorStop(0, '#02030A');
  sky.addColorStop(0.55, '#070A17');
  sky.addColorStop(1, '#170F33');
  ctx.fillStyle = sky;
  ctx.fillRect(-120, -120, w + 240, hy + 240);

  const clouds = [
    { x: cx - 380 + 30 * Math.sin(t * 0.05), y: hy - 120, r: 520, rgb: MAGENTA_RGB, a: 0.2 },
    { x: cx + 420 + 24 * Math.cos(t * 0.04), y: hy - 260, r: 620, rgb: VIOLET_RGB, a: 0.26 },
    { x: cx - 100, y: 160 + 20 * Math.sin(t * 0.06), r: 560, rgb: '40, 190, 220', a: 0.09 },
    { x: w - 80, y: 240, r: 380, rgb: MAGENTA_RGB, a: 0.09 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const c of clouds) {
    const g = ctx.createRadialGradient(c.x, c.y, 0, c.x, c.y, c.r);
    g.addColorStop(0, rgba(c.rgb, c.a));
    g.addColorStop(0.5, rgba(c.rgb, c.a * 0.4));
    g.addColorStop(1, rgba(c.rgb, 0));
    ctx.fillStyle = g;
    ctx.fillRect(c.x - c.r, c.y - c.r, c.r * 2, c.r * 2);
  }
  ctx.restore();
}

function drawStarTrails(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  const p = planetOf(cam);
  const spin = t * SKY_SPIN;
  ctx.save();
  ctx.lineCap = 'round';
  for (const s of trailStars()) {
    const head = s.angle + spin;
    const hx = p.x + Math.cos(head) * s.radius;
    const hyy = p.y + Math.sin(head) * s.radius;
    if (hyy > cam.hy + 60 || hx < -160 || hx > cam.w + 160) continue;
    const alpha = s.alpha * (0.72 + 0.28 * Math.sin(t * 1.7 + s.twinkle));
    ctx.lineWidth = s.width;
    ctx.strokeStyle = rgba(s.tint, alpha * 0.4);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius, head - s.span, head);
    ctx.stroke();
    ctx.strokeStyle = rgba(s.tint, alpha);
    ctx.beginPath();
    ctx.arc(p.x, p.y, s.radius, head - s.span * 0.28, head);
    ctx.stroke();
    if (s.width > 1) {
      ctx.fillStyle = rgba('255, 255, 255', alpha);
      ctx.beginPath();
      ctx.arc(hx, hyy, 1.9, 0, TAU);
      ctx.fill();
    }
  }
  ctx.restore();
}

interface Constellation {
  radius: number;
  angle: number;
  points: ReadonlyArray<readonly [number, number]>;
  edges: ReadonlyArray<readonly [number, number]>;
}

/** Placed in polar coordinates around the planet, so they rise on the left and set on the right. */
const CONSTELLATIONS: readonly Constellation[] = [
  { radius: 640, angle: -2.6, points: [[0, 0], [52, -34], [110, -20], [150, -70], [206, -52]], edges: [[0, 1], [1, 2], [2, 3], [3, 4]] },
  { radius: 760, angle: -2.0, points: [[0, 0], [44, 40], [100, 26], [78, -40], [20, -52]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
  { radius: 560, angle: -1.2, points: [[0, 0], [60, 10], [96, -44], [150, -30], [96, 52]], edges: [[0, 1], [1, 2], [2, 3], [1, 4]] },
  { radius: 700, angle: -3.3, points: [[0, 0], [38, -48], [90, -62], [130, -16], [84, 20]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0]] },
  { radius: 620, angle: -3.95, points: [[0, 0], [64, -18], [118, 14], [170, -22], [226, 4], [118, 70]], edges: [[0, 1], [1, 2], [2, 3], [3, 4], [2, 5]] },
];

function drawConstellations(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  const p = planetOf(cam);
  const spin = t * SKY_SPIN;
  ctx.save();
  ctx.lineWidth = 1;
  for (const c of CONSTELLATIONS) {
    const a = c.angle + spin;
    const ax = p.x + Math.cos(a) * c.radius;
    const ay = p.y + Math.sin(a) * c.radius;
    if (ay > cam.hy + 120) continue;
    ctx.save();
    ctx.translate(ax, ay);
    ctx.rotate(spin);
    ctx.strokeStyle = rgba(WHITE_RGB, 0.26);
    ctx.beginPath();
    for (const [from, to] of c.edges) {
      const start = c.points[from];
      const end = c.points[to];
      if (!start || !end) continue;
      ctx.moveTo(start[0], start[1]);
      ctx.lineTo(end[0], end[1]);
    }
    ctx.stroke();
    for (const [x, y] of c.points) {
      ctx.fillStyle = rgba(WHITE_RGB, 0.9);
      ctx.beginPath();
      ctx.arc(x, y, 2.3, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = rgba(WHITE_RGB, 0.45);
      ctx.beginPath();
      ctx.moveTo(x - 7, y);
      ctx.lineTo(x + 7, y);
      ctx.moveTo(x, y - 7);
      ctx.lineTo(x, y + 7);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.restore();
}

const BEAMS = [
  { offset: -430, lean: -0.32, rgb: MAGENTA_RGB },
  { offset: -265, lean: -0.1, rgb: LIME_RGB },
  { offset: 150, lean: 0.14, rgb: WHITE_RGB },
  { offset: 330, lean: 0.3, rgb: VIOLET_RGB },
  { offset: 480, lean: 0.42, rgb: LIME_RGB },
] as const;

/** Searchlights of the far city, swaying slowly. */
function drawBeams(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  BEAMS.forEach((beam, i) => {
    const length = 430;
    ctx.save();
    ctx.translate(cam.cx + beam.offset - cam.x * 3, cam.hy);
    ctx.rotate(beam.lean + 0.1 * Math.sin(t * 0.21 + i * 1.7));
    const g = ctx.createLinearGradient(0, 0, 0, -length);
    g.addColorStop(0, rgba(beam.rgb, 0.2));
    g.addColorStop(1, rgba(beam.rgb, 0));
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-3, 0);
    ctx.lineTo(3, 0);
    ctx.lineTo(36, -length);
    ctx.lineTo(-36, -length);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  });
  ctx.restore();
}

/** Wireframe meridians and parallels plus clusters of city lights on the planet's night side. */
function drawPlanetSurface(ctx: CanvasRenderingContext2D, p: Planet, t: number, litX: number, litY: number): void {
  const turn = t * 0.012;
  ctx.lineWidth = 1;
  ctx.strokeStyle = rgba('170, 150, 255', 0.1);
  for (const lat of [0.18, 0.42, 0.68, 0.95, 1.22]) {
    const rx = p.r * Math.cos(lat);
    ctx.beginPath();
    ctx.ellipse(p.x, p.y - p.r * Math.sin(lat), rx, rx * 0.1, 0, Math.PI, TAU);
    ctx.stroke();
  }
  for (let i = 0; i < 8; i++) {
    const lon = ((i / 8) * Math.PI + turn) % Math.PI;
    const side = Math.cos(lon);
    ctx.beginPath();
    // Only the half of each meridian that faces the viewer.
    ctx.ellipse(p.x, p.y, Math.max(0.5, p.r * Math.abs(side)), p.r, 0, side > 0 ? -TAU / 4 : TAU / 4, side > 0 ? TAU / 4 : (TAU * 3) / 4);
    ctx.stroke();
  }

  for (let i = 0; i < 190; i++) {
    const cluster = Math.floor(hash(i, 11) * 10);
    const lon = hash(cluster, 12) * TAU + (hash(i, 14) - 0.5) * 0.5 + turn;
    const lat = 0.04 + hash(cluster, 13) * 1.05 + (hash(i, 15) - 0.5) * 0.26;
    const facing = Math.cos(lat) * Math.cos(lon);
    if (facing <= 0.05) continue;
    const x = p.x + p.r * Math.cos(lat) * Math.sin(lon);
    const y = p.y - p.r * Math.sin(lat);
    // Lights only show where the limb light does not reach.
    const night = clamp((Math.hypot(x - litX, y - litY) / p.r - 0.25) / 0.5);
    const pick = hash(i, 16);
    ctx.fillStyle = rgba(pick < 0.55 ? LIME_RGB : pick < 0.8 ? MAGENTA_RGB : WHITE_RGB, night * 0.6 * Math.sqrt(facing));
    ctx.fillRect(x - 1.1, y - 1.1, 2.2, 2.2);
  }
}

/** A small star-burst where the sun grazes the limb. */
function drawFlare(ctx: CanvasRenderingContext2D, x: number, y: number): void {
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const core = ctx.createRadialGradient(x, y, 0, x, y, 70);
  core.addColorStop(0, rgba('255, 255, 255', 0.85));
  core.addColorStop(0.18, rgba(RIM_RGB, 0.45));
  core.addColorStop(1, rgba(LIME_RGB, 0));
  ctx.fillStyle = core;
  ctx.fillRect(x - 70, y - 70, 140, 140);

  const across = ctx.createLinearGradient(x - 260, y, x + 260, y);
  across.addColorStop(0, rgba(RIM_RGB, 0));
  across.addColorStop(0.5, rgba('255, 255, 255', 0.6));
  across.addColorStop(1, rgba(RIM_RGB, 0));
  ctx.fillStyle = across;
  ctx.fillRect(x - 260, y - 1.2, 520, 2.4);

  const upright = ctx.createLinearGradient(x, y - 70, x, y + 70);
  upright.addColorStop(0, rgba(RIM_RGB, 0));
  upright.addColorStop(0.5, rgba('255, 255, 255', 0.5));
  upright.addColorStop(1, rgba(RIM_RGB, 0));
  ctx.fillStyle = upright;
  ctx.fillRect(x - 0.8, y - 70, 1.6, 140);
  ctx.restore();
}

function drawPlanet(ctx: CanvasRenderingContext2D, cam: Camera, t: number, total: number): void {
  const p = planetOf(cam);
  // The lit limb travels from the left shoulder to the right over the whole reel: ages passing.
  const lit = lerp(-2.45, -0.75, clamp(t / total));
  const litX = p.x + Math.cos(lit) * p.r;
  const litY = p.y + Math.sin(lit) * p.r;

  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const hx = p.x + Math.cos(lit) * 26;
  const hy = p.y + Math.sin(lit) * 26;
  const halo = ctx.createRadialGradient(hx, hy, p.r * 0.92, hx, hy, p.r * 1.32);
  halo.addColorStop(0, rgba(LIME_RGB, 0));
  halo.addColorStop(0.16, rgba('214, 255, 130', 0.24));
  halo.addColorStop(0.42, rgba(VIOLET_RGB, 0.16));
  halo.addColorStop(1, rgba(VIOLET_RGB, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(p.x - p.r * 1.5, p.y - p.r * 1.5, p.r * 3, p.r * 3);
  ctx.restore();

  ctx.save();
  ctx.beginPath();
  ctx.arc(p.x, p.y, p.r, 0, TAU);
  ctx.clip();
  ctx.fillStyle = '#080917';
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  const limb = ctx.createRadialGradient(litX, litY, 0, litX, litY, p.r * 1.15);
  limb.addColorStop(0, rgba('214, 255, 130', 0.5));
  limb.addColorStop(0.1, rgba(LIME_RGB, 0.24));
  limb.addColorStop(0.36, rgba(VIOLET_RGB, 0.13));
  limb.addColorStop(1, rgba(VIOLET_RGB, 0));
  ctx.fillStyle = limb;
  ctx.fillRect(p.x - p.r, p.y - p.r, p.r * 2, p.r * 2);
  drawPlanetSurface(ctx, p, t, litX, litY);
  ctx.restore();

  ctx.save();
  ctx.lineCap = 'round';
  ctx.shadowColor = rgba(LIME_RGB, 0.9);
  ctx.shadowBlur = 22;
  for (const [span, alpha, width] of [
    [1.25, 0.22, 2],
    [0.85, 0.5, 2.6],
    [0.45, 0.95, 3.2],
  ] as const) {
    ctx.strokeStyle = rgba(RIM_RGB, alpha);
    ctx.lineWidth = width;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r, lit - span, lit + span);
    ctx.stroke();
  }
  ctx.restore();
  drawFlare(ctx, litX, litY);
}

function drawGlyph(ctx: CanvasRenderingContext2D, kind: number): void {
  ctx.beginPath();
  if (kind === 0) {
    ctx.moveTo(0, -7);
    ctx.lineTo(6, 0);
    ctx.lineTo(0, 7);
    ctx.lineTo(-6, 0);
    ctx.closePath();
  } else if (kind === 1) {
    ctx.arc(0, 0, 5, 0, TAU);
    ctx.moveTo(1.2, 0);
    ctx.arc(0, 0, 1.2, 0, TAU);
  } else {
    for (const y of [-5, 0, 5]) {
      ctx.moveTo(-6, y);
      ctx.lineTo(6, y);
    }
  }
  ctx.stroke();
}

/** Two tick-marked rings around the planet turning against each other, with glyphs and two moons. */
function drawAstrolabe(ctx: CanvasRenderingContext2D, cam: Camera, t: number): void {
  const p = planetOf(cam);
  const inner = p.r + 30;
  const outer = p.r + 60;
  ctx.save();
  ctx.translate(p.x, p.y);

  ctx.strokeStyle = rgba(LIME_RGB, 0.3);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, 0, inner, Math.PI, TAU);
  ctx.stroke();
  const turnInner = t * 0.03;
  for (let i = 0; i < 120; i++) {
    const a = (i / 120) * TAU + turnInner;
    if (Math.sin(a) > 0.2) continue;
    const long = i % 5 === 0;
    ctx.strokeStyle = rgba(LIME_RGB, long ? 0.55 : 0.28);
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * inner, Math.sin(a) * inner);
    ctx.lineTo(Math.cos(a) * (inner + (long ? 16 : 7)), Math.sin(a) * (inner + (long ? 16 : 7)));
    ctx.stroke();
  }

  const turnOuter = -t * 0.02;
  ctx.save();
  ctx.rotate(turnOuter);
  ctx.setLineDash([2, 12]);
  ctx.strokeStyle = rgba(WHITE_RGB, 0.36);
  ctx.lineWidth = 1.4;
  ctx.beginPath();
  ctx.arc(0, 0, outer, 0, TAU);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.strokeStyle = rgba(LIME_RGB, 0.85);
  ctx.lineWidth = 3;
  ctx.shadowColor = rgba(LIME_RGB, 0.8);
  ctx.shadowBlur = 10;
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    ctx.beginPath();
    ctx.arc(0, 0, outer, a, a + 0.3);
    ctx.stroke();
  }
  ctx.shadowBlur = 0;
  ctx.strokeStyle = rgba(WHITE_RGB, 0.5);
  ctx.lineWidth = 1.3;
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * TAU;
    ctx.save();
    ctx.rotate(a);
    ctx.translate(outer + 18, 0);
    ctx.rotate(TAU / 4);
    drawGlyph(ctx, i % 3);
    ctx.restore();
  }
  ctx.restore();

  const moons = [
    { ring: inner, angle: t * 0.11 - 2.5, r: 7 },
    { ring: outer, angle: -t * 0.07 - 0.7, r: 5 },
  ];
  ctx.fillStyle = '#EEF1F6';
  ctx.shadowColor = rgba(WHITE_RGB, 0.9);
  ctx.shadowBlur = 14;
  for (const moon of moons) {
    ctx.beginPath();
    ctx.arc(Math.cos(moon.angle) * moon.ring, Math.sin(moon.angle) * moon.ring, moon.r, 0, TAU);
    ctx.fill();
  }
  ctx.restore();
}

/** Magenta city glow on the horizon with a thin anamorphic streak through the vanishing point. */
function drawHorizonGlow(ctx: CanvasRenderingContext2D, cam: Camera): void {
  const { cx, hy } = cam;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  ctx.translate(cx, hy);
  ctx.save();
  ctx.scale(1, 0.22);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, 720);
  glow.addColorStop(0, rgba(MAGENTA_RGB, 0.42));
  glow.addColorStop(0.4, rgba(VIOLET_RGB, 0.2));
  glow.addColorStop(1, rgba(VIOLET_RGB, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-720, -720, 1440, 720);
  ctx.restore();

  const streak = ctx.createLinearGradient(-520, 0, 520, 0);
  streak.addColorStop(0, rgba(RIM_RGB, 0));
  streak.addColorStop(0.5, rgba(RIM_RGB, 0.85));
  streak.addColorStop(1, rgba(RIM_RGB, 0));
  ctx.fillStyle = streak;
  ctx.fillRect(-520, -1.5, 1040, 3);
  ctx.globalAlpha = 0.25;
  ctx.fillRect(-520, -8, 1040, 16);
  ctx.restore();
}

export function drawSky(ctx: CanvasRenderingContext2D, cam: Camera, t: number, total: number): void {
  drawBackdrop(ctx, cam, t);
  drawStarTrails(ctx, cam, t);
  drawConstellations(ctx, cam, t);
  drawBeams(ctx, cam, t);
  drawPlanet(ctx, cam, t, total);
  drawAstrolabe(ctx, cam, t);
  drawHorizonGlow(ctx, cam);
}
