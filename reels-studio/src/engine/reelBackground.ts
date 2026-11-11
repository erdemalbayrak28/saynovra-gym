/**
 * Cinematic space background for the SAYNOVRA reels: drifting parallax stars, slow nebula light,
 * a lunar horizon seen from orbit, a floating etched astronaut, film grain and a vignette.
 * Everything is seeded, so every render of the same frame is identical.
 */

export const REEL_ASSET_URLS = {
  astronaut: '/reel/astronaut-cutout.png',
} as const;

interface ReelAssets {
  astronaut: CanvasImageSource | null;
  astronautSize: { width: number; height: number } | null;
}

const assets: ReelAssets = { astronaut: null, astronautSize: null };

/** Loads the background images once; frames drawn before it resolves simply skip the astronaut. */
export async function loadReelAssets(baseUrl = ''): Promise<void> {
  if (assets.astronaut || typeof Image === 'undefined') return;
  const img = new Image();
  img.src = baseUrl + REEL_ASSET_URLS.astronaut;
  await img.decode();
  assets.astronaut = img;
  assets.astronautSize = { width: img.naturalWidth, height: img.naturalHeight };
}

interface Star {
  x: number;
  y: number;
  r: number;
  phase: number;
  speed: number;
  warm: boolean;
}

interface StarLayer {
  stars: Star[];
  drift: number;
  alpha: number;
}

/** Mulberry32: tiny deterministic PRNG so the sky never flickers between renders. */
function seeded(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

let layerCache: { key: string; layers: StarLayer[] } | null = null;

function starLayers(w: number, h: number): StarLayer[] {
  const key = `${w}x${h}`;
  if (layerCache?.key === key) return layerCache.layers;
  const rand = seeded(20261111);
  const make = (count: number, rMin: number, rMax: number, drift: number, alpha: number): StarLayer => ({
    drift,
    alpha,
    stars: Array.from({ length: count }, () => ({
      x: rand() * w,
      y: rand() * h,
      r: rMin + Math.pow(rand(), 3) * (rMax - rMin),
      phase: rand() * Math.PI * 2,
      speed: 0.6 + rand() * 1.8,
      warm: rand() < 0.12,
    })),
  });
  const layers = [make(420, 0.45, 1.1, 4, 0.55), make(160, 0.8, 1.8, 11, 0.8), make(34, 1.4, 2.8, 24, 1)];
  layerCache = { key, layers };
  return layers;
}

let grainTile: HTMLCanvasElement | null = null;

function grain(): HTMLCanvasElement | null {
  if (grainTile || typeof document === 'undefined') return grainTile;
  const size = 256;
  const tile = document.createElement('canvas');
  tile.width = size;
  tile.height = size;
  const g = tile.getContext('2d');
  if (!g) return null;
  const data = g.createImageData(size, size);
  const rand = seeded(7);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(rand() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = tile;
  return tile;
}

function drawStars(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  for (const layer of starLayers(w, h)) {
    for (const s of layer.stars) {
      // Slow diagonal drift, wrapped, so nearer layers move faster (parallax).
      const x = (((s.x - t * layer.drift) % w) + w) % w;
      const y = (((s.y + t * layer.drift * 0.35) % h) + h) % h;
      const twinkle = 0.55 + 0.45 * Math.sin(t * s.speed + s.phase);
      const a = layer.alpha * twinkle;
      ctx.fillStyle = s.warm ? `rgba(226, 244, 170, ${a})` : `rgba(236, 242, 255, ${a})`;
      ctx.beginPath();
      ctx.arc(x, y, s.r, 0, Math.PI * 2);
      ctx.fill();
      if (s.r > 2.2) {
        const glow = ctx.createRadialGradient(x, y, 0, x, y, s.r * 7);
        glow.addColorStop(0, `rgba(236, 242, 255, ${a * 0.35})`);
        glow.addColorStop(1, 'rgba(236, 242, 255, 0)');
        ctx.fillStyle = glow;
        ctx.fillRect(x - s.r * 7, y - s.r * 7, s.r * 14, s.r * 14);
      }
    }
  }
}

function drawNebula(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const clouds = [
    { x: 0.22 + 0.03 * Math.sin(t * 0.07), y: 0.3, r: 0.75, color: '74, 92, 140', a: 0.16 },
    { x: 0.82 + 0.03 * Math.cos(t * 0.05), y: 0.18, r: 0.6, color: '46, 58, 98', a: 0.2 },
    { x: 0.6, y: 0.52 + 0.02 * Math.sin(t * 0.09), r: 0.55, color: '200, 240, 49', a: 0.045 },
  ];
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  for (const c of clouds) {
    const cx = c.x * w;
    const cy = c.y * h;
    const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, c.r * w);
    g.addColorStop(0, `rgba(${c.color}, ${c.a})`);
    g.addColorStop(0.5, `rgba(${c.color}, ${c.a * 0.4})`);
    g.addColorStop(1, `rgba(${c.color}, 0)`);
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.restore();
}

/** A huge moon seen from orbit: its curved limb sits low in the frame with a thin lit edge. */
function drawLunarHorizon(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const radius = w * 2.1;
  const cx = w * 0.5 + Math.sin(t * 0.04) * w * 0.02;
  const cy = h * 0.74 + radius;

  ctx.save();
  // Atmosphere-like halo above the limb.
  const halo = ctx.createRadialGradient(cx, cy, radius * 0.985, cx, cy, radius * 1.06);
  halo.addColorStop(0, 'rgba(200, 240, 49, 0.16)');
  halo.addColorStop(0.25, 'rgba(160, 190, 230, 0.07)');
  halo.addColorStop(1, 'rgba(160, 190, 230, 0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, w, h);

  ctx.beginPath();
  ctx.arc(cx, cy, radius, 0, Math.PI * 2);
  const surface = ctx.createLinearGradient(0, cy - radius, 0, h);
  surface.addColorStop(0, '#3A4252');
  surface.addColorStop(0.035, '#1C212C');
  surface.addColorStop(0.18, '#0E121A');
  surface.addColorStop(1, '#07090E');
  ctx.fillStyle = surface;
  ctx.fill();

  // Soft craters, clipped to the moon, sliding slowly as the moon turns.
  ctx.clip();
  const rand = seeded(42);
  for (let i = 0; i < 26; i++) {
    const baseX = rand() * w * 1.4 - w * 0.2;
    const depth = rand();
    const y = cy - radius + 30 + depth * (h - (cy - radius) + 40);
    const x = ((baseX - t * (6 + depth * 10)) % (w * 1.4) + w * 1.4) % (w * 1.4) - w * 0.2;
    const rx = 18 + rand() * 70 * (0.4 + depth);
    const ry = rx * (0.22 + depth * 0.12);
    ctx.beginPath();
    ctx.ellipse(x, y, rx, ry, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.28)';
    ctx.fill();
    ctx.beginPath();
    ctx.ellipse(x, y - ry * 0.18, rx, ry, 0, Math.PI * 1.05, Math.PI * 1.95);
    ctx.strokeStyle = 'rgba(214, 224, 242, 0.08)';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  ctx.restore();

  // Thin lit rim along the limb.
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, radius, Math.PI * 1.2, Math.PI * 1.8);
  ctx.strokeStyle = 'rgba(232, 240, 255, 0.55)';
  ctx.lineWidth = 2;
  ctx.shadowColor = 'rgba(200, 240, 49, 0.8)';
  ctx.shadowBlur = 18;
  ctx.stroke();
  ctx.restore();
}

function drawAstronaut(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  sceneProgress: number,
  side: 'left' | 'right',
): void {
  const img = assets.astronaut;
  const size = assets.astronautSize;
  if (!img || !size) return;

  const isTall = h >= 1700;
  const targetH = isTall ? h * 0.3 : h * 0.37;
  const scale = (targetH / size.height) * (1 + sceneProgress * 0.05);
  const dw = size.width * scale;
  const dh = size.height * scale;
  const cx = (side === 'left' ? w * 0.27 : w * 0.73) + Math.sin(t * 0.45) * 10;
  const cy = (isTall ? h * 0.37 : h * 0.405) + Math.sin(t * 0.7) * 14;
  const angle = (side === 'left' ? -1 : 1) * (0.06 + 0.035 * Math.sin(t * 0.38));

  // Fade in as the scene starts, fade out just before the cut.
  const fadeIn = Math.min(1, sceneProgress * 6);
  const fadeOut = Math.min(1, (1 - sceneProgress) * 14);
  const alpha = Math.max(0, Math.min(fadeIn, fadeOut));
  if (alpha <= 0) return;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(cx, cy);
  ctx.rotate(angle);
  // The artwork reaches to its right; mirror it so it always reaches toward the phone.
  if (side === 'right') ctx.scale(-1, 1);
  ctx.shadowColor = 'rgba(200, 240, 49, 0.28)';
  ctx.shadowBlur = 46;
  ctx.drawImage(img, -dw / 2, -dh / 2, dw, dh);
  ctx.restore();
}

function drawLightSweep(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const phase = (t * 0.05) % 1;
  const x = -w * 0.6 + phase * w * 2.2;
  ctx.save();
  ctx.globalCompositeOperation = 'screen';
  const g = ctx.createLinearGradient(x, 0, x + w * 0.5, h);
  g.addColorStop(0, 'rgba(255, 255, 255, 0)');
  g.addColorStop(0.5, 'rgba(200, 220, 255, 0.035)');
  g.addColorStop(1, 'rgba(255, 255, 255, 0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
}

function drawVignette(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  const vignette = ctx.createRadialGradient(w / 2, h * 0.46, w * 0.25, w / 2, h * 0.5, w * 0.95);
  vignette.addColorStop(0, 'rgba(5, 7, 12, 0)');
  vignette.addColorStop(1, 'rgba(5, 7, 12, 0.7)');
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, w, h);
}

function drawGrain(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  const tile = grain();
  if (!tile) return;
  ctx.save();
  ctx.globalAlpha = 0.045;
  ctx.globalCompositeOperation = 'overlay';
  const frame = Math.floor(t * 24);
  const ox = (frame * 73) % 256;
  const oy = (frame * 151) % 256;
  ctx.translate(-ox, -oy);
  const pattern = ctx.createPattern(tile, 'repeat');
  if (pattern) {
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, w + 256, h + 256);
  }
  ctx.restore();
}

/** Full background pass. The astronaut sits on `astronautSide`, opposite the phone. */
export function drawSpaceBackground(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  t: number,
  sceneProgress: number,
  astronautSide: 'left' | 'right',
): void {
  ctx.save();
  const sky = ctx.createLinearGradient(0, 0, 0, h);
  sky.addColorStop(0, '#04060B');
  sky.addColorStop(0.5, '#0A0D14');
  sky.addColorStop(1, '#06080D');
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, h);

  // Slow camera push on the whole backdrop.
  const push = 1 + 0.025 * Math.sin(t * 0.08);
  ctx.translate(w / 2, h / 2);
  ctx.scale(push, push);
  ctx.translate(-w / 2, -h / 2);

  drawNebula(ctx, w, h, t);
  drawStars(ctx, w, h, t);
  drawLunarHorizon(ctx, w, h, t);
  drawLightSweep(ctx, w, h, t);
  ctx.restore();

  drawVignette(ctx, w, h);
  drawAstronaut(ctx, w, h, t, sceneProgress, astronautSide);
}

/** Grain goes on last, over the UI too, so the whole frame reads as one shot. */
export function drawFilmFinish(ctx: CanvasRenderingContext2D, w: number, h: number, t: number): void {
  drawGrain(ctx, w, h, t);
}
