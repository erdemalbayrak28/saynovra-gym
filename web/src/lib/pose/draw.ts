import type { NormalizedLandmark } from '@mediapipe/tasks-vision';
import { MIN_VISIBILITY, type FrameReading } from '../../../../shared/pose';
import { BODY_CONNECTIONS } from './landmarker';

const LIME = '#c8f031';
const INK = '#0a0d14';
const BONE = 'rgba(238, 241, 246, 0.55)';

const visible = (point: NormalizedLandmark | undefined): point is NormalizedLandmark => !!point && point.visibility >= MIN_VISIBILITY;

/**
 * Draws the skeleton over the video frame, and the measured joint with its angle in lime. The
 * canvas keeps the video's own resolution and is stretched over the video by CSS.
 */
export function drawPose(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  landmarks: readonly NormalizedLandmark[],
  reading: FrameReading | null,
  angle: number | null,
): void {
  if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
  }
  const context = canvas.getContext('2d');
  if (!context) return;
  const { width, height } = canvas;
  context.clearRect(0, 0, width, height);
  if (landmarks.length === 0) return;

  const unit = Math.max(1.5, width / 400);
  const at = (point: { x: number; y: number }) => [point.x * width, point.y * height] as const;

  context.lineCap = 'round';
  context.strokeStyle = BONE;
  context.lineWidth = unit * 1.5;
  for (const { start, end } of BODY_CONNECTIONS) {
    const a = landmarks[start];
    const b = landmarks[end];
    if (!visible(a) || !visible(b)) continue;
    context.beginPath();
    context.moveTo(...at(a));
    context.lineTo(...at(b));
    context.stroke();
  }
  context.fillStyle = 'rgba(238, 241, 246, 0.8)';
  landmarks.forEach((point, index) => {
    if (index < 11 || !visible(point)) return;
    context.beginPath();
    context.arc(...at(point), unit * 2, 0, Math.PI * 2);
    context.fill();
  });

  if (!reading) return;
  const [a, b, c] = reading.chain.points.map(at) as [readonly [number, number], readonly [number, number], readonly [number, number]];
  context.strokeStyle = LIME;
  context.lineWidth = unit * 3;
  context.beginPath();
  context.moveTo(...a);
  context.lineTo(...b);
  context.lineTo(...c);
  context.stroke();

  // Arc between the two limbs at the joint.
  const radius = unit * 18;
  const from = Math.atan2(a[1] - b[1], a[0] - b[0]);
  const to = Math.atan2(c[1] - b[1], c[0] - b[0]);
  let sweep = to - from;
  while (sweep <= -Math.PI) sweep += Math.PI * 2;
  while (sweep > Math.PI) sweep -= Math.PI * 2;
  context.fillStyle = 'rgba(200, 240, 49, 0.18)';
  context.beginPath();
  context.moveTo(...b);
  context.arc(b[0], b[1], radius, from, from + sweep, sweep < 0);
  context.closePath();
  context.fill();
  context.fillStyle = LIME;
  context.beginPath();
  context.arc(b[0], b[1], unit * 4, 0, Math.PI * 2);
  context.fill();

  if (angle === null) return;
  const label = `${Math.round(angle)}°`;
  const fontSize = Math.round(unit * 13);
  context.font = `700 ${fontSize}px "Space Grotesk", system-ui, sans-serif`;
  const textWidth = context.measureText(label).width;
  const padX = fontSize * 0.45;
  const boxHeight = fontSize * 1.5;
  // Put the label on the outer side of the joint, away from the bend, clamped into the frame.
  const mid = from + sweep / 2;
  const x = Math.min(width - textWidth - padX * 2, Math.max(0, b[0] - Math.cos(mid) * radius * 2.2 - (textWidth + padX * 2) / 2));
  const y = Math.min(height - boxHeight, Math.max(0, b[1] - Math.sin(mid) * radius * 2.2 - boxHeight / 2));
  context.fillStyle = INK;
  context.beginPath();
  context.roundRect(x, y, textWidth + padX * 2, boxHeight, boxHeight / 3);
  context.fill();
  context.fillStyle = LIME;
  context.textBaseline = 'middle';
  context.fillText(label, x + padX, y + boxHeight / 2);
}
