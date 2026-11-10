import { FilesetResolver, PoseLandmarker } from '@mediapipe/tasks-vision';

// The WebAssembly runtime is copied into public/ by scripts/copy-mediapipe.mjs.
const WASM_BASE = '/mediapipe/wasm';
/** Put the model file here to work without internet (README, "AI form"). */
const LOCAL_MODEL = '/mediapipe/pose_landmarker_lite.task';
/** Google's published Pose Landmarker (lite) model. */
const REMOTE_MODEL =
  'https://storage.googleapis.com/mediapipe-models/pose_landmarker/pose_landmarker_lite/float16/1/pose_landmarker_lite.task';

export interface LoadedLandmarker {
  landmarker: PoseLandmarker;
  delegate: 'GPU' | 'CPU';
  modelSource: 'local' | 'remote';
}

async function hasLocalModel(): Promise<boolean> {
  try {
    const res = await fetch(LOCAL_MODEL, { method: 'HEAD' });
    // Vite answers unknown paths with index.html, so a 200 alone proves nothing.
    return res.ok && !(res.headers.get('Content-Type') ?? '').includes('text/html');
  } catch {
    return false;
  }
}

/** Loads the pose model on the GPU when the browser allows it, otherwise on the CPU. */
export async function loadPoseLandmarker(): Promise<LoadedLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  const local = await hasLocalModel();
  let lastError: unknown = null;
  for (const delegate of ['GPU', 'CPU'] as const) {
    try {
      const landmarker = await PoseLandmarker.createFromOptions(fileset, {
        baseOptions: { modelAssetPath: local ? LOCAL_MODEL : REMOTE_MODEL, delegate },
        runningMode: 'VIDEO',
        numPoses: 1,
      });
      return { landmarker, delegate, modelSource: local ? 'local' : 'remote' };
    } catch (err) {
      lastError = err;
    }
  }
  throw lastError instanceof Error ? lastError : new Error('Model yüklenemedi');
}

/** Body connections only: the face points (0-10) add clutter and say nothing about form. */
export const BODY_CONNECTIONS = PoseLandmarker.POSE_CONNECTIONS.filter((c) => c.start >= 11 && c.end >= 11);
