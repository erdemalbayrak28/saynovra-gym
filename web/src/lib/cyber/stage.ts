/**
 * The hologram stage: where the active feature is projected, in front of the planet. The
 * hologram is drawn on its own layer so it can be scan-lined, flickered and switched on and off
 * like a tube display.
 */
import type { Timeline } from './config';
import { HOLOGRAMS } from './holograms';
import { STAGE_HEIGHT, STAGE_WIDTH } from './holograms/holo';
import { clamp, easeOutExpo, hash, ramp } from './math';
import { LIME_RGB, rgba } from './palette';
import { context2d, makeCanvas } from './post';

/** Room around the stage for glows that spill past its edges. */
const STAGE_PAD = 40;
const STAGE_TOP = 806;
/** The hologram switches on this long after a scene starts, and off just before the cut. */
const HOLO_ON_AT = 0.55;
const HOLO_ON_SEC = 0.5;
const HOLO_OFF_SEC = 0.3;
const HOLO_OFF_BEFORE_CUT = 0.12;
const SCRIM_RGB = '4, 5, 10';
const PANE_ALPHA = 0.7;

export function makeStageLayer(k: number): HTMLCanvasElement {
  return makeCanvas((STAGE_WIDTH + STAGE_PAD * 2) * k, (STAGE_HEIGHT + STAGE_PAD * 2) * k);
}

/**
 * A soft-edged pane of dark glass behind the hologram, so the road rushing underneath stays
 * visible but never fights the figures. Thin corner marks frame it like a head-up display.
 */
function drawPane(ctx: CanvasRenderingContext2D, centreX: number, centreY: number, power: number): void {
  const width = STAGE_WIDTH + 44;
  const height = STAGE_HEIGHT + 30;
  const x = centreX - width / 2;
  const y = centreY - height / 2;
  ctx.save();
  ctx.shadowColor = rgba(SCRIM_RGB, 0.85 * power);
  ctx.shadowBlur = 60;
  ctx.fillStyle = rgba(SCRIM_RGB, PANE_ALPHA * power);
  ctx.beginPath();
  ctx.roundRect(x, y, width, height, 28);
  ctx.fill();
  ctx.restore();

  const mark = 22;
  ctx.save();
  ctx.strokeStyle = rgba(LIME_RGB, 0.5 * power);
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  for (const [cx, cy, dx, dy] of [
    [x, y, 1, 1],
    [x + width, y, -1, 1],
    [x + width, y + height, -1, -1],
    [x, y + height, 1, -1],
  ] as const) {
    ctx.moveTo(cx + dx * mark, cy);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx, cy + dy * mark);
  }
  ctx.stroke();
  ctx.restore();
}

export function drawHologramStage(
  ctx: CanvasRenderingContext2D,
  layer: HTMLCanvasElement,
  designWidth: number,
  k: number,
  timeline: Timeline,
  t: number,
  drift: { x: number; y: number } = { x: 0, y: 0 },
): void {
  const scene = timeline.scene;
  if (!scene) return;
  const on = easeOutExpo(ramp(timeline.elapsed, HOLO_ON_AT, HOLO_ON_SEC));
  const off = ramp(timeline.untilCut, HOLO_OFF_BEFORE_CUT, HOLO_OFF_SEC);
  const power = Math.min(on, off);
  if (power <= 0.001) return;

  const centreX = designWidth / 2 + drift.x;
  const centreY = STAGE_TOP + STAGE_HEIGHT / 2 + drift.y;
  drawPane(ctx, centreX, centreY, power);

  const holo = context2d(layer);
  holo.setTransform(1, 0, 0, 1, 0, 0);
  holo.globalCompositeOperation = 'source-over';
  holo.globalAlpha = 1;
  holo.clearRect(0, 0, layer.width, layer.height);
  holo.setTransform(k, 0, 0, k, STAGE_PAD * k, STAGE_PAD * k);
  HOLOGRAMS[scene.hologram]({ ctx: holo, e: Math.max(0, timeline.elapsed - HOLO_ON_AT), t });

  // Scan lines are cut out of the hologram itself, so they never darken the scene behind it.
  holo.setTransform(k, 0, 0, k, 0, 0);
  holo.globalCompositeOperation = 'destination-out';
  holo.fillStyle = 'rgba(0, 0, 0, 0.12)';
  for (let y = 0; y < STAGE_HEIGHT + STAGE_PAD * 2; y += 5) holo.fillRect(0, y, STAGE_WIDTH + STAGE_PAD * 2, 1.2);
  holo.globalCompositeOperation = 'source-over';

  // Tube-style power-on: the picture opens vertically from a bright line.
  ctx.save();
  ctx.translate(centreX, centreY);
  ctx.scale(1, Math.max(0.012, power));
  ctx.globalAlpha = clamp(power * 1.6) * (0.93 + 0.07 * hash(Math.floor(t * 30), 5));
  ctx.drawImage(layer, -STAGE_WIDTH / 2 - STAGE_PAD, -STAGE_HEIGHT / 2 - STAGE_PAD, STAGE_WIDTH + STAGE_PAD * 2, STAGE_HEIGHT + STAGE_PAD * 2);
  ctx.restore();

  if (power < 0.97) {
    const width = STAGE_WIDTH * (0.3 + 0.7 * power);
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.shadowColor = rgba(LIME_RGB, 0.9);
    ctx.shadowBlur = 18;
    ctx.fillStyle = rgba('234, 255, 190', 1 - power);
    ctx.fillRect(centreX - width / 2, centreY - 1.5, width, 3);
    ctx.restore();
  }
}
