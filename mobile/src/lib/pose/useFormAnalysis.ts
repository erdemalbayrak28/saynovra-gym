import { useCallback, useRef, useState } from 'react';
import { analyzeFrame, newAnalysis, type Counter, type ExerciseSpec, type PosePoint } from '../../../../shared/pose';

/** The screen refreshes at this rate; analysis itself runs on every camera frame. */
const UI_INTERVAL_MS = 100;
const FPS_WINDOW_MS = 1000;
const LANDMARK_COUNT = 33;

export interface FormView {
  counter: Counter;
  angle: number | null;
  visible: boolean;
  fps: number;
  /** Joint chains being measured, as landmark indices, for the overlay. */
  chains: number[][];
}

const emptyView = (): FormView => ({ counter: newAnalysis().counter, angle: null, visible: false, fps: 0, chains: [] });

/** Unpacks the page's flat [x, y, visibility, ...] list; null when it is not a full body. */
function toPoints(flat: number[]): PosePoint[] | null {
  if (flat.length === 0) return [];
  if (flat.length !== LANDMARK_COUNT * 3 || flat.some((value) => typeof value !== 'number' || !Number.isFinite(value))) return null;
  const points: PosePoint[] = [];
  for (let i = 0; i < flat.length; i += 3) points.push({ x: flat[i] ?? 0, y: flat[i + 1] ?? 0, visibility: flat[i + 2] ?? 0 });
  return points;
}

/**
 * Runs shared/pose.ts on each frame the camera page sends. Per-frame state lives in a ref; React
 * gets a snapshot every UI_INTERVAL_MS so the screen does not re-render 30 times a second.
 */
export function useFormAnalysis(spec: ExerciseSpec) {
  const state = useRef({ analysis: newAnalysis(), lastUi: 0, frames: 0, fpsFrom: 0, fps: 0 });
  const [view, setView] = useState<FormView>(emptyView);

  const reset = useCallback(() => {
    state.current = { ...state.current, analysis: newAnalysis() };
    setView((current) => ({ ...emptyView(), fps: current.fps }));
  }, []);

  /** Returns the new snapshot when the screen was refreshed (the caller then updates the overlay), else null. */
  const onFrame = useCallback(
    (at: number, aspect: number, flat: number[]): FormView | null => {
      const points = toPoints(flat);
      if (!points || !Number.isFinite(at) || !(aspect > 0)) return null;
      const s = state.current;
      s.analysis = analyzeFrame(s.analysis, spec, points, aspect, at);

      s.frames++;
      if (at - s.fpsFrom >= FPS_WINDOW_MS) {
        s.fps = Math.round((s.frames * 1000) / (at - s.fpsFrom));
        s.frames = 0;
        s.fpsFrom = at;
      }
      if (at - s.lastUi < UI_INTERVAL_MS) return null;
      s.lastUi = at;
      const { reading, angle, counter } = s.analysis;
      const next: FormView = {
        counter,
        angle,
        visible: reading !== null,
        fps: s.fps,
        chains: reading ? reading.chains.map((chain) => [...spec.chains[chain.side]]) : [],
      };
      setView(next);
      return next;
    },
    [spec],
  );

  return { view, onFrame, reset };
}
