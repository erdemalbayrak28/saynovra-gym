// The page that runs inside the AI Form web view. It only senses: opens the camera, runs Google's
// MediaPipe Pose model on the phone and draws the skeleton. Every frame's landmarks go to the app,
// which counts reps with shared/pose.ts; the app sends back which joints to highlight.
//
// It is loaded as inline HTML with http://localhost as its address: localhost counts as a secure
// context, which the browser requires before it opens the camera. The runtime and the model come
// from the same pinned sources as the web form page (MediaPipe 1.1.1, Google's lite model), so the
// first start needs internet; camera frames never leave the phone.

export const MEDIAPIPE_VERSION = '1.1.1';
export const SENSOR_PAGE_BASE_URL = 'http://localhost/';

export type SensorFacing = 'user' | 'environment';

/** Messages from the page to the app. */
export type SensorMessage =
  | { type: 'status'; state: 'loading' | 'ready' | 'camera'; delegate?: 'GPU' | 'CPU' }
  | { type: 'error'; reason: 'insecure' | 'model' | 'camera_denied' | 'camera'; detail?: string }
  /** points: x, y, visibility for each of the 33 landmarks (empty when nobody is in view). */
  | { type: 'frame'; at: number; aspect: number; points: number[] }
  /** Diagnostics; the app logs them in development builds only. */
  | { type: 'debug'; text: string };

/** Commands from the app to the page. */
export type SensorCommand =
  | { type: 'start'; facing: SensorFacing }
  | { type: 'stop' }
  /** Measured joint chains to draw in lime and the angle to print at the first joint. */
  | { type: 'overlay'; chains: number[][]; angle: number | null };

/** JavaScript that delivers a command to the page (react-native-webview injectJavaScript). */
export function commandScript(command: SensorCommand): string {
  return `window.__novraSensor && window.__novraSensor(${JSON.stringify(command)}); true;`;
}

export function parseSensorMessage(raw: string): SensorMessage | null {
  try {
    const value = JSON.parse(raw) as { type?: unknown };
    if (value.type === 'frame' || value.type === 'status' || value.type === 'error' || value.type === 'debug') return value as SensorMessage;
    return null;
  } catch {
    return null;
  }
}

export const SENSOR_PAGE_HTML = `<!doctype html>
<html lang="tr">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1">
<style>
  html, body { margin: 0; height: 100%; background: #000; overflow: hidden; }
  video, canvas { position: absolute; inset: 0; width: 100%; height: 100%; object-fit: cover; }
  .mirror { transform: scaleX(-1); }
</style>
</head>
<body>
<video id="video" playsinline muted></video>
<canvas id="canvas"></canvas>
<script type="module">
  const BASE = 'https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${MEDIAPIPE_VERSION}';
  const MODEL = 'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';
  const LIME = '#c8f031';
  const BONE = 'rgba(238, 241, 246, 0.6)';
  const MIN_VISIBILITY = 0.5;

  const video = document.getElementById('video');
  const canvas = document.getElementById('canvas');
  const context = canvas.getContext('2d');
  const post = (message) => window.ReactNativeWebView && window.ReactNativeWebView.postMessage(JSON.stringify(message));

  let landmarker = null;
  let connections = [];
  let stream = null;
  let running = false;
  let lastTime = -1;
  let overlay = { chains: [], angle: null };
  let pendingStart = null;

  const round = (value) => Math.round(value * 10000) / 10000;

  function stopCamera() {
    running = false;
    if (stream) stream.getTracks().forEach((track) => track.stop());
    stream = null;
    video.srcObject = null;
    context.clearRect(0, 0, canvas.width, canvas.height);
  }

  async function startCamera(facing) {
    if (!landmarker) { pendingStart = facing; return; }
    stopCamera();
    post({ type: 'debug', text: 'getUserMedia ' + facing });
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 720 }, height: { ideal: 960 } },
        audio: false,
      });
    } catch (error) {
      const denied = error && (error.name === 'NotAllowedError' || error.name === 'SecurityError');
      post({ type: 'error', reason: denied ? 'camera_denied' : 'camera', detail: String(error && error.name) });
      return;
    }
    const mirror = facing === 'user';
    video.classList.toggle('mirror', mirror);
    canvas.classList.toggle('mirror', mirror);
    post({ type: 'debug', text: 'stream ok, tracks ' + stream.getVideoTracks().length });
    video.srcObject = stream;
    await video.play().catch((error) => post({ type: 'debug', text: 'play failed ' + (error && error.name) }));
    running = true;
    lastTime = -1;
    post({ type: 'status', state: 'camera' });
    requestAnimationFrame(loop);
  }

  function draw(points) {
    if (canvas.width !== video.videoWidth || canvas.height !== video.videoHeight) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
    }
    const { width, height } = canvas;
    context.clearRect(0, 0, width, height);
    if (points.length === 0) return;
    const unit = Math.max(1.5, width / 300);
    const at = (i) => [points[i].x * width, points[i].y * height];
    const seen = (i) => points[i] && points[i].visibility >= MIN_VISIBILITY;
    context.lineCap = 'round';
    context.strokeStyle = BONE;
    context.lineWidth = unit * 1.5;
    for (const { start, end } of connections) {
      if (!seen(start) || !seen(end)) continue;
      context.beginPath();
      context.moveTo(...at(start));
      context.lineTo(...at(end));
      context.stroke();
    }
    context.strokeStyle = LIME;
    context.lineWidth = unit * 3;
    for (const chain of overlay.chains) {
      if (!chain.every(seen)) continue;
      context.beginPath();
      context.moveTo(...at(chain[0]));
      context.lineTo(...at(chain[1]));
      context.lineTo(...at(chain[2]));
      context.stroke();
      context.fillStyle = LIME;
      context.beginPath();
      context.arc(...at(chain[1]), unit * 4, 0, Math.PI * 2);
      context.fill();
    }
  }

  function loop() {
    if (!running) return;
    requestAnimationFrame(loop);
    if (video.readyState < 2 || video.videoWidth === 0 || video.currentTime === lastTime) return;
    lastTime = video.currentTime;
    const now = performance.now();
    let points = [];
    try {
      points = landmarker.detectForVideo(video, now).landmarks[0] || [];
    } catch (error) {
      return;
    }
    draw(points);
    const flat = [];
    for (const point of points) flat.push(round(point.x), round(point.y), round(point.visibility ?? 0));
    post({ type: 'frame', at: now, aspect: video.videoWidth / video.videoHeight, points: flat });
  }

  window.__novraSensor = (command) => {
    if (command.type === 'start') startCamera(command.facing);
    else if (command.type === 'stop') { pendingStart = null; stopCamera(); }
    else if (command.type === 'overlay') overlay = { chains: command.chains, angle: command.angle };
  };

  async function boot() {
    if (!window.isSecureContext || !navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      post({ type: 'error', reason: 'insecure' });
      return;
    }
    post({ type: 'status', state: 'loading' });
    try {
      const { FilesetResolver, PoseLandmarker } = await import(BASE + '/vision_bundle.mjs');
      connections = PoseLandmarker.POSE_CONNECTIONS.filter((c) => c.start >= 11 && c.end >= 11);
      const fileset = await FilesetResolver.forVisionTasks(BASE + '/wasm');
      let lastError = null;
      for (const delegate of ['GPU', 'CPU']) {
        try {
          landmarker = await PoseLandmarker.createFromOptions(fileset, {
            baseOptions: { modelAssetPath: MODEL, delegate },
            runningMode: 'VIDEO',
            numPoses: 1,
          });
          post({ type: 'status', state: 'ready', delegate });
          break;
        } catch (error) {
          lastError = error;
        }
      }
      if (!landmarker) throw lastError || new Error('model');
    } catch (error) {
      post({ type: 'error', reason: 'model', detail: String(error && error.message || error) });
      return;
    }
    if (pendingStart) startCamera(pendingStart);
  }

  boot();
</script>
</body>
</html>`;
