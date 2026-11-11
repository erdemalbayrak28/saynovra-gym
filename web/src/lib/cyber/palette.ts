/**
 * Colours and fonts of the cyberpunk reel. The brand set (ink, lime, text, grey and the three
 * typefaces) carries everything the viewer reads; violet, magenta and cyan live only in the
 * atmosphere and the city lights.
 */

export const INK = '#0A0D14';
export const LIME = '#C8F031';
export const WHITE = '#EEF1F6';
export const GRAY = '#7C849B';
/** Hologram warnings only (half rep, speed loss, void screenshot). */
export const ALERT = '#FF3D81';

export const LIME_RGB = '200, 240, 49';
export const WHITE_RGB = '238, 241, 246';
export const INK_RGB = '10, 13, 20';
export const ALERT_RGB = '255, 61, 129';
export const VIOLET_RGB = '124, 77, 255';
export const MAGENTA_RGB = '255, 46, 136';
export const CYAN_RGB = '56, 214, 255';

export const FONT_DISPLAY = '"Space Grotesk", system-ui, sans-serif';
export const FONT_BODY = 'Inter, system-ui, sans-serif';
export const FONT_MONO = '"JetBrains Mono", monospace';

export function rgba(rgb: string, alpha: number): string {
  return `rgba(${rgb}, ${Math.max(0, Math.min(1, alpha))})`;
}
