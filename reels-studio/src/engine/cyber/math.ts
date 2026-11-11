/** Small numeric helpers shared by the cyberpunk reel. Everything here is pure and deterministic. */

export const TAU = Math.PI * 2;
export const DEG = Math.PI / 180;

export function clamp(value: number, min = 0, max = 1): number {
  return Math.max(min, Math.min(max, value));
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** 0 until `start`, then a straight climb to 1 over `duration`. */
export function ramp(x: number, start: number, duration: number): number {
  return clamp((x - start) / duration);
}

/** Always-positive remainder, so wrapped positions never go negative. */
export function mod(value: number, n: number): number {
  return ((value % n) + n) % n;
}

export function easeOutCubic(x: number): number {
  return 1 - (1 - clamp(x)) ** 3;
}

export function easeInOutCubic(x: number): number {
  const t = clamp(x);
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

export function easeOutExpo(x: number): number {
  const t = clamp(x);
  return t >= 1 ? 1 : 1 - 2 ** (-10 * t);
}

/** Overshoots slightly before settling: for things that pop in. */
export function easeOutBack(x: number): number {
  const t = clamp(x);
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

/** Deterministic pseudo-random number in [0, 1) from up to three seeds. */
export function hash(a: number, b = 0, c = 0): number {
  const s = Math.sin(a * 127.1 + b * 311.7 + c * 74.7 + 0.5) * 43758.5453123;
  return s - Math.floor(s);
}
