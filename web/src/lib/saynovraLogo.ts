/**
 * The SAYNOVRA mark, drawn from the brand SVG (viewBox 400x460): an S-shaped path with two hollow
 * nodes on the middle bar and two lime dots at its ends. `size` is the mark's height.
 *
 * `progress` runs 0..1 for a draw-on animation: the path traces first, then the hollow nodes and
 * the lime dots pop in. 1 (the default) is the finished mark.
 */

const PATH_LENGTH = 252 + 168 + 224 + 168 + 252;
const INK = '#0A0D14';
const TEXT = '#EEF1F6';

/** 0 before `start`, then a quick pop with a slight overshoot that settles at 1. */
function pop(progress: number, start: number): number {
  if (progress >= 1) return 1;
  const t = Math.max(0, Math.min(1, (progress - start) / 0.22));
  if (t <= 0) return 0;
  const c1 = 1.70158;
  const c3 = c1 + 1;
  return 1 + c3 * (t - 1) ** 3 + c1 * (t - 1) ** 2;
}

export function drawSaynovraLogo(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  size: number,
  pulse = 0,
  accentColor = '#C8F031',
  progress = 1,
): void {
  const k = size / 460;
  ctx.save();
  ctx.translate(cx - 200 * k, cy - 230 * k);
  ctx.scale(k, k);

  const traced = Math.max(0, Math.min(1, progress / 0.6));
  if (traced > 0) {
    ctx.strokeStyle = TEXT;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'butt';
    ctx.lineWidth = 46;
    if (traced < 1) ctx.setLineDash([PATH_LENGTH * traced, PATH_LENGTH]);
    ctx.beginPath();
    ctx.moveTo(340, 62);
    ctx.lineTo(88, 62);
    ctx.lineTo(88, 230);
    ctx.lineTo(312, 230);
    ctx.lineTo(312, 398);
    ctx.lineTo(60, 398);
    ctx.stroke();
    ctx.setLineDash([]);
  }

  const hollow = pop(progress, 0.5);
  if (hollow > 0) {
    ctx.strokeStyle = TEXT;
    ctx.lineWidth = 24 * hollow;
    for (const x of [88, 312]) {
      ctx.beginPath();
      ctx.arc(x, 230, 36 * hollow, 0, Math.PI * 2);
      ctx.fillStyle = INK;
      ctx.fill();
      ctx.stroke();
    }
  }

  const dots = pop(progress, 0.72);
  if (dots > 0) {
    const glow = 1 + 0.06 * Math.sin(pulse * Math.PI * 2);
    ctx.fillStyle = accentColor;
    ctx.shadowColor = accentColor;
    ctx.shadowBlur = 60 * glow;
    for (const [x, y] of [
      [340, 62],
      [60, 398],
    ] as const) {
      ctx.beginPath();
      ctx.arc(x, y, 53 * glow * dots, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  ctx.restore();
}
