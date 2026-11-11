/**
 * Everything the viewer reads, drawn crisp on top of the picture in the brand's own type:
 * the SAYNOVRA lockup, the scene headline and sentence, the footer, and the closing card.
 */
import { drawSaynovraLogo } from '../saynovraLogo';
import type { CyberReelConfig, CyberScene, Timeline } from './config';
import { clamp, easeOutCubic, ramp } from './math';
import { CYAN_RGB, FONT_BODY, FONT_DISPLAY, FONT_MONO, INK, INK_RGB, LIME, LIME_RGB, MAGENTA_RGB, WHITE, rgba } from './palette';

const MARGIN = 88;
const FRAME_INSET = 36;
const HEADLINE_SIZE = 82;
const HEADLINE_Y = 206;
const BODY_Y = 352;
const BODY_LINE = 40;
const BODY_WIDTH = 850;
const CAPTION = '#9BA3B8';
const BODY_COLOR = '#C3C9D8';
/** The opening scene starts part-way into its entrance, so the very first frame already reads. */
const OPENING_HEAD_START = 0.3;
/** Text clears out just before a cut. */
const EXIT_FROM = 0.1;
const EXIT_SEC = 0.3;

function wrap(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  const lines: string[] = [];
  let current = '';
  for (const word of text.split(/\s+/)) {
    const candidate = current ? `${current} ${word}` : word;
    if (current && ctx.measureText(candidate).width > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = candidate;
    }
  }
  if (current) lines.push(current);
  return lines;
}

/** At most two lines, split where they come out closest in length. */
function balance(ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] {
  if (ctx.measureText(text).width <= maxWidth) return [text];
  const words = text.split(/\s+/);
  let best = wrap(ctx, text, maxWidth).slice(0, 2);
  let bestWidth = Infinity;
  for (let i = 1; i < words.length; i++) {
    const first = words.slice(0, i).join(' ');
    const second = words.slice(i).join(' ');
    const widest = Math.max(ctx.measureText(first).width, ctx.measureText(second).width);
    if (widest <= maxWidth && widest < bestWidth) {
      bestWidth = widest;
      best = [first, second];
    }
  }
  return best;
}

function drawTopShade(ctx: CanvasRenderingContext2D, W: number): void {
  const shade = ctx.createLinearGradient(0, 0, 0, 450);
  shade.addColorStop(0, 'rgba(3, 4, 9, 0.72)');
  shade.addColorStop(0.7, 'rgba(3, 4, 9, 0.36)');
  shade.addColorStop(1, 'rgba(3, 4, 9, 0)');
  ctx.fillStyle = shade;
  ctx.fillRect(0, 0, W, 450);
}

/** Thin viewfinder brackets in the four corners of the frame. */
function drawFrameMarks(ctx: CanvasRenderingContext2D, W: number, H: number): void {
  const length = 30;
  ctx.save();
  ctx.strokeStyle = rgba(LIME_RGB, 0.6);
  ctx.lineWidth = 2;
  ctx.lineCap = 'square';
  ctx.beginPath();
  for (const [x, y, dx, dy] of [
    [FRAME_INSET, FRAME_INSET, 1, 1],
    [W - FRAME_INSET, FRAME_INSET, -1, 1],
    [W - FRAME_INSET, H - FRAME_INSET, -1, -1],
    [FRAME_INSET, H - FRAME_INSET, 1, -1],
  ] as const) {
    ctx.moveTo(x + dx * length, y);
    ctx.lineTo(x, y);
    ctx.lineTo(x, y + dy * length);
  }
  ctx.stroke();
  ctx.restore();
}

function drawBrandBar(ctx: CanvasRenderingContext2D, W: number, config: CyberReelConfig, timeline: Timeline, scene: CyberScene, t: number): void {
  drawSaynovraLogo(ctx, MARGIN + 20, 74, 52, t * 0.5);
  ctx.save();
  ctx.textAlign = 'left';
  ctx.font = `700 26px ${FONT_DISPLAY}`;
  ctx.letterSpacing = '-0.6px';
  ctx.fillStyle = WHITE;
  ctx.fillText(config.brandName, MARGIN + 56, 71);
  ctx.font = `500 14px ${FONT_MONO}`;
  ctx.letterSpacing = '2.4px';
  ctx.fillStyle = LIME;
  ctx.fillText(config.productTitle, MARGIN + 57, 93);

  const pad = (n: number): string => String(n).padStart(2, '0');
  const exit = ramp(timeline.untilCut, EXIT_FROM, EXIT_SEC);
  ctx.globalAlpha = Math.min(clamp(timeline.elapsed / 0.2 + (timeline.index === 0 ? 1 : 0)), exit);
  ctx.textAlign = 'right';
  ctx.font = `500 20px ${FONT_MONO}`;
  ctx.letterSpacing = '2px';
  ctx.fillStyle = WHITE;
  ctx.fillText(`${pad(timeline.index + 1)} / ${pad(config.scenes.length)}`, W - MARGIN, 70);
  ctx.font = `500 15px ${FONT_MONO}`;
  ctx.letterSpacing = '2.2px';
  ctx.fillStyle = LIME;
  ctx.fillText(scene.badge, W - MARGIN, 94);
  ctx.restore();
}

/** Two centred lines, white then lime; they arrive with a quick channel split and settle. */
function drawHeadline(ctx: CanvasRenderingContext2D, W: number, scene: CyberScene, timeline: Timeline): void {
  const e = timeline.elapsed + (timeline.index === 0 ? OPENING_HEAD_START : 0);
  const alpha = Math.min(clamp(e / 0.16), ramp(timeline.untilCut, EXIT_FROM, EXIT_SEC));
  if (alpha <= 0) return;
  const settle = easeOutCubic(ramp(e, 0, 0.5));
  const split = (1 - settle) * 18;

  ctx.save();
  ctx.textAlign = 'center';
  let size = HEADLINE_SIZE;
  const setFont = (): void => {
    ctx.font = `700 ${size}px ${FONT_DISPLAY}`;
    ctx.letterSpacing = `${-size * 0.034}px`;
  };
  setFont();
  const widest = Math.max(ctx.measureText(scene.headlineTop).width, ctx.measureText(scene.headlineAccent).width);
  if (widest > W - 140) {
    size = Math.floor((size * (W - 140)) / widest);
    setFont();
  }
  const x = W / 2;
  const top = HEADLINE_Y + (1 - settle) * 14;
  const bottom = top + size * 1.05;

  if (split > 0.5) {
    ctx.globalCompositeOperation = 'lighter';
    ctx.globalAlpha = alpha * 0.7;
    for (const [rgb, dx] of [
      [MAGENTA_RGB, -split],
      [CYAN_RGB, split],
    ] as const) {
      ctx.fillStyle = rgba(rgb, 1);
      ctx.fillText(scene.headlineTop, x + dx, top);
      ctx.fillText(scene.headlineAccent, x + dx, bottom);
    }
    ctx.globalCompositeOperation = 'source-over';
  }

  ctx.globalAlpha = alpha;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.85)';
  ctx.shadowBlur = 26;
  ctx.fillStyle = WHITE;
  ctx.fillText(scene.headlineTop, x, top);
  ctx.fillStyle = LIME;
  ctx.fillText(scene.headlineAccent, x, bottom);
  // A second pass gives the lime line its neon glow.
  ctx.shadowColor = rgba(LIME_RGB, 0.55);
  ctx.shadowBlur = 30;
  ctx.fillText(scene.headlineAccent, x, bottom);
  ctx.restore();
}

function drawBody(ctx: CanvasRenderingContext2D, W: number, scene: CyberScene, timeline: Timeline): void {
  const e = timeline.elapsed + (timeline.index === 0 ? OPENING_HEAD_START : 0);
  const enter = easeOutCubic(ramp(e, 0.28, 0.4));
  const alpha = Math.min(enter, ramp(timeline.untilCut, EXIT_FROM, EXIT_SEC));
  if (alpha <= 0) return;
  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.textAlign = 'center';
  ctx.font = `400 29px ${FONT_BODY}`;
  ctx.fillStyle = BODY_COLOR;
  ctx.shadowColor = 'rgba(0, 0, 0, 0.9)';
  ctx.shadowBlur = 14;
  balance(ctx, scene.body, BODY_WIDTH).forEach((line, i) => ctx.fillText(line, W / 2, BODY_Y + i * BODY_LINE + (1 - enter) * 10));
  ctx.restore();
}

function drawFooter(ctx: CanvasRenderingContext2D, W: number, H: number, config: CyberReelConfig): void {
  const scrim = ctx.createLinearGradient(0, H - 200, 0, H);
  scrim.addColorStop(0, rgba(INK_RGB, 0));
  scrim.addColorStop(1, 'rgba(3, 4, 9, 0.88)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H - 200, W, 200);

  ctx.save();
  ctx.font = `500 16px ${FONT_MONO}`;
  ctx.letterSpacing = '2.6px';
  ctx.textAlign = 'left';
  ctx.fillStyle = CAPTION;
  ctx.fillText(config.footerLine, MARGIN, H - 52);

  ctx.font = `700 19px ${FONT_MONO}`;
  ctx.letterSpacing = '0px';
  const pillWidth = ctx.measureText(config.brandWebsite).width + 44;
  ctx.fillStyle = LIME;
  ctx.beginPath();
  ctx.roundRect(W - MARGIN - pillWidth, H - 80, pillWidth, 44, 22);
  ctx.fill();
  ctx.fillStyle = INK;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(config.brandWebsite, W - MARGIN - pillWidth / 2, H - 57);
  ctx.restore();
}

/** Closing card: the mark draws itself, then the name, the product and the line arrive in turn. */
function drawOutro(ctx: CanvasRenderingContext2D, W: number, H: number, config: CyberReelConfig, e: number, t: number): void {
  const x = W / 2;
  const logoY = H * 0.33;
  const rise = (start: number): { alpha: number; dy: number } => {
    const p = easeOutCubic(ramp(e, start, 0.45));
    return { alpha: p, dy: (1 - p) * 16 };
  };

  ctx.save();
  ctx.fillStyle = rgba('3, 4, 9', 0.58 * (0.5 + 0.5 * ramp(e, 0, 0.5)));
  ctx.fillRect(0, 0, W, H);

  const halo = ctx.createRadialGradient(x, logoY, 0, x, logoY, 300);
  halo.addColorStop(0, rgba(LIME_RGB, 0.2 * ramp(e, 0.2, 0.9)));
  halo.addColorStop(1, rgba(LIME_RGB, 0));
  ctx.fillStyle = halo;
  ctx.fillRect(x - 300, logoY - 300, 600, 600);
  drawSaynovraLogo(ctx, x, logoY, 210, t * 0.5, LIME, ramp(e, 0.2, 1.1));

  ctx.textAlign = 'center';
  const name = rise(0.75);
  ctx.globalAlpha = name.alpha;
  ctx.font = `700 88px ${FONT_DISPLAY}`;
  ctx.letterSpacing = '-3px';
  ctx.fillStyle = WHITE;
  ctx.fillText(config.brandName, x, logoY + 205 + name.dy);

  const line = rise(0.9);
  ctx.globalAlpha = line.alpha;
  ctx.font = `500 22px ${FONT_MONO}`;
  ctx.letterSpacing = '3.4px';
  ctx.fillStyle = CAPTION;
  ctx.fillText(config.brandLine, x, logoY + 256 + line.dy);

  const product = rise(1.05);
  ctx.globalAlpha = product.alpha;
  ctx.font = `700 26px ${FONT_DISPLAY}`;
  ctx.letterSpacing = '0px';
  const pillWidth = ctx.measureText(config.productLine).width + 64;
  const pillY = logoY + 290 + product.dy;
  ctx.beginPath();
  ctx.roundRect(x - pillWidth / 2, pillY, pillWidth, 60, 30);
  ctx.fillStyle = rgba(LIME_RGB, 0.14);
  ctx.fill();
  ctx.strokeStyle = rgba(LIME_RGB, 0.6);
  ctx.lineWidth = 2;
  ctx.stroke();
  ctx.fillStyle = LIME;
  ctx.fillText(config.productLine, x, pillY + 39);

  const tagline = rise(1.3);
  ctx.globalAlpha = tagline.alpha;
  ctx.font = `700 46px ${FONT_DISPLAY}`;
  ctx.letterSpacing = '-1.3px';
  ctx.fillStyle = WHITE;
  ctx.fillText(config.brandTagline, x, H * 0.775 + tagline.dy);

  const site = rise(1.5);
  ctx.globalAlpha = site.alpha;
  ctx.font = `700 32px ${FONT_MONO}`;
  ctx.letterSpacing = '0px';
  ctx.fillStyle = LIME;
  ctx.shadowColor = rgba(LIME_RGB, 0.6);
  ctx.shadowBlur = 22;
  ctx.fillText(config.brandWebsite, x, H * 0.775 + 64 + site.dy);
  ctx.restore();
}

export function drawOverlay(ctx: CanvasRenderingContext2D, W: number, H: number, config: CyberReelConfig, timeline: Timeline, t: number): void {
  const scene = timeline.scene;
  if (!scene) {
    drawOutro(ctx, W, H, config, timeline.elapsed, t);
    drawFrameMarks(ctx, W, H);
    return;
  }
  drawTopShade(ctx, W);
  drawFooter(ctx, W, H, config);
  drawFrameMarks(ctx, W, H);
  drawBrandBar(ctx, W, config, timeline, scene, t);
  drawHeadline(ctx, W, scene, timeline);
  drawBody(ctx, W, scene, timeline);
}
