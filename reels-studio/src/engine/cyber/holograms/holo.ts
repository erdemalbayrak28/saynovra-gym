/**
 * Shared drawing vocabulary of the holograms. Each hologram draws into a 860x420 stage with its
 * origin at the top-left; the reel places, powers on and scan-lines the stage as a whole.
 */
import { TAU, easeOutCubic, ramp } from '../math';
import { FONT_BODY, FONT_DISPLAY, FONT_MONO, INK, LIME_RGB, WHITE, rgba } from '../palette';

export const STAGE_WIDTH = 860;
export const STAGE_HEIGHT = 420;
/** Mono captions inside a hologram: lighter than the brand grey so they survive on video. */
export const HOLO_LABEL = '#9BA3B8';

export interface Holo {
  ctx: CanvasRenderingContext2D;
  /** Seconds since this hologram switched on. */
  e: number;
  /** Global reel time, for idle motion. */
  t: number;
}

/** Eased 0..1 fade that starts `start` seconds after the hologram switches on. */
export function fade(e: number, start: number, duration = 0.35): number {
  return easeOutCubic(ramp(e, start, duration));
}

export interface TextOptions {
  size?: number;
  color?: string;
  align?: CanvasTextAlign;
  spacing?: number;
  weight?: number;
  alpha?: number;
}

function drawText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, font: string, spacing: number, options: TextOptions, fallbackColor: string): number {
  const alpha = options.alpha ?? 1;
  if (alpha <= 0) return 0;
  ctx.save();
  ctx.globalAlpha *= alpha;
  ctx.font = font;
  ctx.letterSpacing = `${spacing}px`;
  ctx.textAlign = options.align ?? 'left';
  ctx.fillStyle = options.color ?? fallbackColor;
  ctx.fillText(text, x, y);
  const width = ctx.measureText(text).width;
  ctx.restore();
  return width;
}

/** Upper-case mono caption with wide tracking. */
export function label(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options: TextOptions = {}): number {
  const size = options.size ?? 17;
  return drawText(ctx, text, x, y, `${options.weight ?? 500} ${size}px ${FONT_MONO}`, options.spacing ?? 2.2, options, HOLO_LABEL);
}

/** Space Grotesk figure or title. Returns its width so a unit can follow it. */
export function display(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, options: TextOptions = {}): number {
  return drawText(ctx, text, x, y, `700 ${size}px ${FONT_DISPLAY}`, options.spacing ?? -size * 0.03, options, WHITE);
}

/** Inter running text. */
export function copy(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number, options: TextOptions = {}): number {
  return drawText(ctx, text, x, y, `${options.weight ?? 400} ${size}px ${FONT_BODY}`, options.spacing ?? 0, options, HOLO_LABEL);
}

export function setGlow(ctx: CanvasRenderingContext2D, rgb: string, blur: number, alpha = 0.9): void {
  ctx.shadowColor = rgba(rgb, alpha);
  ctx.shadowBlur = blur;
}

export function clearGlow(ctx: CanvasRenderingContext2D): void {
  ctx.shadowColor = 'transparent';
  ctx.shadowBlur = 0;
}

/** Four L-shaped corner marks around a box. */
export function corners(ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, length: number, color: string, lineWidth = 2): void {
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth = lineWidth;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + w, y, -1, 1],
    [x + w, y + h, -1, -1],
    [x, y + h, 1, -1],
  ] as const) {
    ctx.moveTo(cx + dx * length, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * length);
  }
  ctx.stroke();
  ctx.restore();
}

export interface ChipOptions {
  filled?: boolean;
  rgb?: string;
  align?: 'left' | 'center' | 'right';
  size?: number;
  alpha?: number;
}

/** A pill with a mono label; `y` is its vertical centre. Returns the pill's width. */
export function chip(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, options: ChipOptions = {}): number {
  const size = options.size ?? 16;
  const rgb = options.rgb ?? LIME_RGB;
  const alpha = options.alpha ?? 1;
  ctx.save();
  ctx.font = `600 ${size}px ${FONT_MONO}`;
  ctx.letterSpacing = '1.8px';
  const padding = size * 0.85;
  const width = ctx.measureText(text).width + padding * 2;
  const height = size * 2;
  const left = options.align === 'center' ? x - width / 2 : options.align === 'right' ? x - width : x;
  if (alpha > 0) {
    ctx.globalAlpha *= alpha;
    ctx.beginPath();
    ctx.roundRect(left, y - height / 2, width, height, height / 2);
    if (options.filled) {
      ctx.fillStyle = rgba(rgb, 1);
      ctx.fill();
    } else {
      ctx.fillStyle = rgba(rgb, 0.1);
      ctx.fill();
      ctx.strokeStyle = rgba(rgb, 0.85);
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.fillStyle = options.filled ? INK : rgba(rgb, 1);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(text, left + padding + 0.9, y + 1);
  }
  ctx.restore();
  return width;
}

/** A small dot with a breathing halo: "this is live". */
export function liveDot(ctx: CanvasRenderingContext2D, x: number, y: number, t: number, rgb = LIME_RGB): void {
  const beat = 0.5 + 0.5 * Math.sin(t * 5);
  ctx.save();
  ctx.fillStyle = rgba(rgb, 0.25 * beat);
  ctx.beginPath();
  ctx.arc(x, y, 5 + 5 * beat, 0, TAU);
  ctx.fill();
  ctx.fillStyle = rgba(rgb, 1);
  ctx.beginPath();
  ctx.arc(x, y, 4.5, 0, TAU);
  ctx.fill();
  ctx.restore();
}
