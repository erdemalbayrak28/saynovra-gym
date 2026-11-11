/**
 * Whole-frame finishing passes, all in real canvas pixels: neon bloom, the channel-split glitch
 * that fires at a scene change, a vignette and film grain. They work on scratch canvases that
 * are created once per output size.
 */
import { hash } from './math';

export interface PostBuffers {
  quarter: HTMLCanvasElement;
  quarterBlur: HTMLCanvasElement;
  copy: HTMLCanvasElement;
  red: HTMLCanvasElement;
  cyan: HTMLCanvasElement;
}

export function makeCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(width));
  canvas.height = Math.max(1, Math.round(height));
  return canvas;
}

export function context2d(canvas: HTMLCanvasElement): CanvasRenderingContext2D {
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('2D canvas is not available');
  return ctx;
}

export function makePostBuffers(width: number, height: number): PostBuffers {
  const quarterW = Math.ceil(width / 4);
  const quarterH = Math.ceil(height / 4);
  return {
    quarter: makeCanvas(quarterW, quarterH),
    quarterBlur: makeCanvas(quarterW, quarterH),
    copy: makeCanvas(width, height),
    red: makeCanvas(width, height),
    cyan: makeCanvas(width, height),
  };
}

/**
 * Neon glow. The frame is shrunk and multiplied by itself, so only bright areas survive, then
 * blurred at two radii and screened back over the picture.
 */
export function bloom(ctx: CanvasRenderingContext2D, buffers: PostBuffers, strength: number): void {
  const { quarter, quarterBlur } = buffers;
  const q = context2d(quarter);
  const b = context2d(quarterBlur);
  q.filter = 'none';
  q.globalCompositeOperation = 'copy';
  q.drawImage(ctx.canvas, 0, 0, quarter.width, quarter.height);
  b.filter = 'none';
  b.globalCompositeOperation = 'copy';
  b.drawImage(quarter, 0, 0);
  q.globalCompositeOperation = 'multiply';
  q.drawImage(quarterBlur, 0, 0);

  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'screen';
  ctx.imageSmoothingEnabled = true;
  ctx.imageSmoothingQuality = 'high';
  for (const [radius, alpha] of [
    [5, 0.75],
    [16, 0.5],
  ] as const) {
    b.globalCompositeOperation = 'copy';
    b.filter = `blur(${radius}px)`;
    b.drawImage(quarter, 0, 0);
    ctx.globalAlpha = strength * alpha;
    ctx.drawImage(quarterBlur, 0, 0, ctx.canvas.width, ctx.canvas.height);
  }
  b.filter = 'none';
  ctx.restore();
}

/** Splits red from cyan and tears a few horizontal bands sideways. `amount` is 0..1. */
export function glitch(ctx: CanvasRenderingContext2D, buffers: PostBuffers, amount: number, seed: number): void {
  if (amount < 0.02) return;
  const { copy, red, cyan } = buffers;
  const { width, height } = ctx.canvas;
  const unit = width / 1080;

  const c = context2d(copy);
  c.globalCompositeOperation = 'copy';
  c.drawImage(ctx.canvas, 0, 0);
  for (const [layer, tint] of [
    [red, '#FF0000'],
    [cyan, '#00FFFF'],
  ] as const) {
    const l = context2d(layer);
    l.globalCompositeOperation = 'copy';
    l.drawImage(copy, 0, 0);
    l.globalCompositeOperation = 'multiply';
    l.fillStyle = tint;
    l.fillRect(0, 0, width, height);
  }

  const shift = amount * 16 * unit;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(red, -shift, 0);
  ctx.drawImage(cyan, shift, 0);
  ctx.globalCompositeOperation = 'source-over';
  if (amount > 0.3) {
    for (let i = 0; i < 5; i++) {
      const y = Math.floor(hash(seed, i, 1) * height);
      const bandHeight = Math.floor((0.02 + hash(seed, i, 2) * 0.07) * height);
      const dx = (hash(seed, i, 3) - 0.5) * amount * 180 * unit;
      ctx.drawImage(copy, 0, y, width, bandHeight, dx, y, width, bandHeight);
    }
  }
  ctx.restore();
}

let grainTile: HTMLCanvasElement | null = null;

function grain(): HTMLCanvasElement {
  if (grainTile) return grainTile;
  const size = 256;
  const tile = makeCanvas(size, size);
  const g = context2d(tile);
  const data = g.createImageData(size, size);
  for (let i = 0; i < size * size; i++) {
    const v = Math.floor(hash(i, 91) * 255);
    data.data[i * 4] = v;
    data.data[i * 4 + 1] = v;
    data.data[i * 4 + 2] = v;
    data.data[i * 4 + 3] = 255;
  }
  g.putImageData(data, 0, 0);
  grainTile = tile;
  return tile;
}

/** Darkened corners. Drawn under the text layer, so the brand colours on top stay exact. */
export function vignette(ctx: CanvasRenderingContext2D): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const shade = ctx.createRadialGradient(width / 2, height * 0.48, width * 0.42, width / 2, height * 0.5, width * 1.02);
  shade.addColorStop(0, 'rgba(3, 4, 9, 0)');
  shade.addColorStop(1, 'rgba(3, 4, 9, 0.66)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, width, height);
  ctx.restore();
}

/** A fine film grain over everything, so the whole frame reads as one shot. */
export function filmGrain(ctx: CanvasRenderingContext2D, t: number): void {
  const { width, height } = ctx.canvas;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  const frame = Math.floor(t * 30);
  const pattern = ctx.createPattern(grain(), 'repeat');
  if (pattern) {
    ctx.globalAlpha = 0.045;
    ctx.globalCompositeOperation = 'overlay';
    ctx.translate(-((frame * 73) % 256), -((frame * 151) % 256));
    ctx.fillStyle = pattern;
    ctx.fillRect(0, 0, width + 256, height + 256);
  }
  ctx.restore();
}
