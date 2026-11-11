/**
 * The camera flies straight down a neon avenue. It speeds up into every scene change, where it
 * passes through an astral gate, and eases off in the middle of a scene so the hologram can be read.
 * All layout is done in a 1080-wide design space; the renderer scales it to the real canvas.
 */
import type { CyberReelConfig } from './config';
import { TAU } from './math';

export const DESIGN_WIDTH = 1080;
/** World units between two gates; one gate is crossed at every scene change. */
export const GATE_SPACING = 84;
/** Nothing closer than this is drawn. */
export const NEAR = 0.9;

/** How much faster than average the camera moves at a cut (and slower mid-scene). */
const SPEED_SWING = 0.42;
const OUTRO_GLIDE_SEC = 1.3;
const OUTRO_DRIFT = 2.2;
const DEFAULT_SCENE_SEC = 7;

export interface Camera {
  x: number;
  y: number;
  z: number;
  /** Forward speed in world units per second. */
  speed: number;
  roll: number;
  /** Focal length in design pixels. */
  f: number;
  /** Vanishing point. */
  cx: number;
  hy: number;
  w: number;
  h: number;
}

/** Share of a scene's distance covered at progress `p`: fast at both ends, slow in the middle. */
function sceneTravel(p: number): number {
  return p + (SPEED_SWING * Math.sin(TAU * p)) / TAU;
}

/** Distance flown at `t`. Each scene covers exactly one gate spacing. */
export function cameraTravel(config: CyberReelConfig, t: number): number {
  let start = 0;
  let index = 0;
  let lastDuration = DEFAULT_SCENE_SEC;
  for (const scene of config.scenes) {
    if (t < start + scene.durationSec) {
      return (index + sceneTravel((t - start) / scene.durationSec)) * GATE_SPACING;
    }
    start += scene.durationSec;
    index += 1;
    lastDuration = scene.durationSec;
  }
  // Outro: carry the exit speed over, then glide down to a slow drift.
  const u = t - start;
  const exitSpeed = (GATE_SPACING * (1 + SPEED_SWING)) / lastDuration;
  const glide = (exitSpeed - OUTRO_DRIFT) * OUTRO_GLIDE_SEC * (1 - Math.exp(-u / OUTRO_GLIDE_SEC));
  return index * GATE_SPACING + glide + OUTRO_DRIFT * u;
}

export function cameraAt(config: CyberReelConfig, t: number, w: number, h: number): Camera {
  const step = 0.005;
  return {
    x: 1.3 * Math.sin(t * 0.23) + 0.45 * Math.sin(t * 0.61 + 1.3),
    y: 1.7 + 0.12 * Math.sin(t * 0.43),
    z: cameraTravel(config, t),
    speed: (cameraTravel(config, t + step) - cameraTravel(config, t - step)) / (2 * step),
    roll: 0.012 * Math.sin(t * 0.31 + 0.5),
    f: w * 0.7,
    cx: w / 2,
    hy: h * 0.563,
    w,
    h,
  };
}
