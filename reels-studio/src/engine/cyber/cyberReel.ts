/**
 * The cyberpunk NOVRA GYM reel. One frame is built in this order:
 * sky -> moving world (motion-blurred) -> gate flash -> hologram -> bloom -> crisp text -> glitch -> grain.
 */
import type { Camera } from './camera';
import { DESIGN_WIDTH, cameraAt } from './camera';
import type { CyberReelConfig, Timeline } from './config';
import { DEFAULT_CYBER_CONFIG, getCyberDuration, timelineAt } from './config';
import { drawGates } from './gates';
import { drawGround } from './ground';
import { clamp, hash } from './math';
import { drawOverlay } from './overlay';
import { INK, rgba } from './palette';
import { drawDust, drawTraffic, drawWarp } from './particles';
import type { PostBuffers } from './post';
import { bloom, context2d, filmGrain, glitch, makeCanvas, makePostBuffers, vignette } from './post';
import { drawSky } from './sky';
import { drawHologramStage, makeStageLayer } from './stage';
import { drawTowers } from './towers';

export interface CyberRenderOptions {
  /** Frame rate of the video being rendered; sets the motion-blur shutter. */
  fps?: number;
  /** World samples blended per frame. 1 is sharp, 3 gives smooth motion blur. */
  motionSamples?: number;
}

/** The world is drawn a touch larger than the frame so the camera roll never shows an edge. */
const ROLL_COVER = 1.03;
const SHUTTER = 0.5;
const FLASH_RGB = '226, 255, 160';
const FLASH_PEAK = 0.38;
const CAMERA_REST_HEIGHT = 1.7;

interface Buffers extends PostBuffers {
  key: string;
  sample: HTMLCanvasElement;
  world: HTMLCanvasElement;
  stage: HTMLCanvasElement;
}

let bufferCache: Buffers | null = null;

function buffersFor(width: number, height: number, k: number): Buffers {
  const key = `${width}x${height}`;
  if (bufferCache?.key === key) return bufferCache;
  bufferCache = {
    key,
    sample: makeCanvas(width, height),
    world: makeCanvas(width, height),
    stage: makeStageLayer(k),
    ...makePostBuffers(width, height),
  };
  return bufferCache;
}

function withRoll(ctx: CanvasRenderingContext2D, cam: Camera, draw: () => void): void {
  ctx.save();
  ctx.translate(cam.cx, cam.hy);
  ctx.rotate(cam.roll);
  ctx.scale(ROLL_COVER, ROLL_COVER);
  ctx.translate(-cam.cx, -cam.hy);
  draw();
  ctx.restore();
}

/** Everything that moves past the camera, drawn on a transparent layer above the horizon. */
function drawWorld(ctx: CanvasRenderingContext2D, cam: Camera, t: number, gateCount: number): void {
  drawGround(ctx, cam, t);
  drawTowers(ctx, cam, t);
  drawTraffic(ctx, cam, t);
  drawGates(ctx, cam, t, gateCount);
  drawDust(ctx, cam);
}

/**
 * Motion blur: the world is drawn at a few instants inside the shutter and the samples are
 * averaged. 'lighter' with 1/n alpha sums premultiplied layers, which averages them exactly.
 */
function accumulateWorld(
  buffers: Buffers,
  config: CyberReelConfig,
  t: number,
  size: { W: number; H: number; k: number },
  options: CyberRenderOptions,
): void {
  const samples = Math.max(1, Math.round(options.motionSamples ?? 1));
  const shutter = SHUTTER / (options.fps ?? 30);
  const world = context2d(buffers.world);
  const sample = context2d(buffers.sample);
  world.setTransform(1, 0, 0, 1, 0, 0);
  world.globalCompositeOperation = 'source-over';
  world.globalAlpha = 1;
  world.clearRect(0, 0, buffers.world.width, buffers.world.height);
  for (let i = 0; i < samples; i++) {
    const ts = t - (i / samples) * shutter;
    sample.setTransform(1, 0, 0, 1, 0, 0);
    sample.clearRect(0, 0, buffers.sample.width, buffers.sample.height);
    sample.setTransform(size.k, 0, 0, size.k, 0, 0);
    drawWorld(sample, cameraAt(config, ts, size.W, size.H), ts, config.scenes.length);
    world.globalCompositeOperation = 'lighter';
    world.globalAlpha = 1 / samples;
    world.drawImage(buffers.sample, 0, 0);
  }
}

/** How strongly the cut effects fire around a scene change. Nothing fires at the very start. */
function cutEnergy(timeline: Timeline): { warp: number; flash: number; glitch: number } {
  const opening = timeline.index === 0;
  const after = opening ? 0 : timeline.elapsed;
  const afterWarp = opening ? 0 : Math.exp(-after / 0.16);
  const approach = clamp(1 - timeline.untilCut / 0.7);
  return {
    warp: Math.max(approach ** 2, afterWarp),
    flash: (opening ? 0 : FLASH_PEAK * Math.exp(-after / 0.1)) + 0.3 * clamp(1 - timeline.untilCut / 0.12),
    glitch: Math.max(opening ? 0 : Math.exp(-after / 0.11), 0.7 * clamp(1 - timeline.untilCut / 0.1)),
  };
}

export function renderCyberFrame(
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  timeSec: number,
  config: CyberReelConfig = DEFAULT_CYBER_CONFIG,
  options: CyberRenderOptions = {},
): void {
  const k = width / DESIGN_WIDTH;
  const W = DESIGN_WIDTH;
  const H = height / k;
  const total = getCyberDuration(config);
  const t = clamp(timeSec, 0, total);
  const timeline = timelineAt(config, t);
  const cam = cameraAt(config, t, W, H);
  const buffers = buffersFor(width, height, k);
  const energy = cutEnergy(timeline);

  ctx.save();
  ctx.setTransform(k, 0, 0, k, 0, 0);
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = 'source-over';
  ctx.fillStyle = INK;
  ctx.fillRect(0, 0, W, H);

  // The picture jolts for a moment as a gate is crossed; the text and hologram on top stay put.
  const frame = Math.floor(t * 30);
  const jolt = energy.flash * 9;
  ctx.save();
  ctx.translate((hash(frame, 61) - 0.5) * 2 * jolt, (hash(frame, 62) - 0.5) * 2 * jolt);
  withRoll(ctx, cam, () => drawSky(ctx, cam, t, total));
  accumulateWorld(buffers, config, t, { W, H, k }, options);
  withRoll(ctx, cam, () => ctx.drawImage(buffers.world, 0, 0, W, H));
  ctx.restore();
  drawWarp(ctx, cam, energy.warp, t);
  if (energy.flash > 0.01) {
    ctx.save();
    ctx.globalCompositeOperation = 'screen';
    ctx.fillStyle = rgba(FLASH_RGB, Math.min(0.85, energy.flash));
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // The hologram drifts a little against the camera's sway, so it hangs in the scene.
  drawHologramStage(ctx, buffers.stage, W, k, timeline, t, { x: -cam.x * 6, y: (cam.y - CAMERA_REST_HEIGHT) * -30 });

  bloom(ctx, buffers, 0.9);
  vignette(ctx);
  ctx.setTransform(k, 0, 0, k, 0, 0);
  drawOverlay(ctx, W, H, config, timeline, t);
  glitch(ctx, buffers, energy.glitch, frame);
  filmGrain(ctx, t);
  ctx.restore();
}
