import type { PoseLandmarker } from '@mediapipe/tasks-vision';
import { Camera, RotateCcw, Square, Upload } from 'lucide-react';
import { useCallback, useEffect, useRef, useState, type ChangeEvent } from 'react';
import {
  EXERCISES,
  NOTABLE_SLOWDOWN,
  analyzeFrame,
  coaching,
  countedReps,
  faultText,
  newAnalysis,
  repFaults,
  slowdown,
  type Counter,
  type ExerciseId,
  type RepPhase,
} from '../../../shared/pose';
import { Card, Label } from '../components/ui';
import { drawPose } from '../lib/pose/draw';
import { loadPoseLandmarker } from '../lib/pose/landmarker';

type Source = 'camera' | 'file';
type ModelState =
  | { kind: 'loading' }
  | { kind: 'ready'; delegate: 'GPU' | 'CPU'; modelSource: 'local' | 'remote' }
  | { kind: 'error'; message: string };

interface View {
  counter: Counter;
  angle: number | null;
  visible: boolean;
  fps: number;
}

/** The numbers on screen refresh at this rate; analysis itself runs on every video frame. */
const UI_INTERVAL_MS = 100;
const FPS_WINDOW_MS = 1000;
const EMPTY_VIEW: View = { counter: newAnalysis().counter, angle: null, visible: false, fps: 0 };
const PHASES: RepPhase[] = ['top', 'down', 'bottom'];

const TONE: Record<ReturnType<typeof coaching>['tone'], string> = {
  idle: 'border-line bg-ink/85 text-text',
  info: 'border-info/40 bg-ink/85 text-info',
  good: 'border-ok/40 bg-ink/85 text-ok',
  warn: 'border-bad/40 bg-ink/85 text-bad',
};

export function FormCoach() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const landmarkerRef = useRef<PoseLandmarker | null>(null);
  const objectUrlRef = useRef<string | null>(null);
  const exerciseRef = useRef<ExerciseId>('squat');
  // Per-frame state lives outside React; the screen gets a snapshot every UI_INTERVAL_MS.
  const engine = useRef({ analysis: newAnalysis(), lastVideoTime: -1, lastUi: 0, frames: 0, fpsFrom: 0, fps: 0 });

  const [model, setModel] = useState<ModelState>({ kind: 'loading' });
  const [exercise, setExercise] = useState<ExerciseId>('squat');
  const [source, setSource] = useState<Source>('camera');
  const [running, setRunning] = useState(false);
  const [sourceError, setSourceError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);
  const [view, setView] = useState<View>(EMPTY_VIEW);
  const spec = EXERCISES[exercise];

  useEffect(() => {
    let disposed = false;
    loadPoseLandmarker().then(
      (loaded) => {
        if (disposed) {
          loaded.landmarker.close();
          return;
        }
        landmarkerRef.current = loaded.landmarker;
        setModel({ kind: 'ready', delegate: loaded.delegate, modelSource: loaded.modelSource });
      },
      () => {
        if (!disposed) {
          setModel({
            kind: 'error',
            message: 'Model yüklenemedi. İnternet bağlantısını kontrol edin ya da modeli web/public/mediapipe klasörüne koyun (README).',
          });
        }
      },
    );
    return () => {
      disposed = true;
      landmarkerRef.current?.close();
      landmarkerRef.current = null;
    };
  }, []);

  const resetCounter = useCallback(() => {
    engine.current = { ...engine.current, analysis: newAnalysis() };
    setView((current) => ({ ...current, counter: engine.current.analysis.counter, angle: null }));
  }, []);

  const releaseSource = useCallback(() => {
    const video = videoRef.current;
    if (video) {
      (video.srcObject as MediaStream | null)?.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
      video.pause();
      video.removeAttribute('src');
      video.load();
    }
    if (objectUrlRef.current) {
      URL.revokeObjectURL(objectUrlRef.current);
      objectUrlRef.current = null;
    }
  }, []);

  useEffect(() => releaseSource, [releaseSource]);

  const stop = () => {
    releaseSource();
    setRunning(false);
    setFileName(null);
    const canvas = canvasRef.current;
    canvas?.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height);
  };

  const startCamera = async () => {
    setSourceError(null);
    if (!navigator.mediaDevices?.getUserMedia) {
      setSourceError('Bu tarayıcıda kamera yok. Sayfayı localhost adresinden açın.');
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: { ideal: 1280 }, height: { ideal: 720 } }, audio: false });
      const video = videoRef.current;
      if (!video) {
        stream.getTracks().forEach((track) => track.stop());
        return;
      }
      releaseSource();
      video.srcObject = stream;
      video.loop = false;
      await video.play();
      resetCounter();
      setRunning(true);
    } catch (err) {
      setSourceError(
        err instanceof DOMException && err.name === 'NotAllowedError'
          ? 'Kamera izni verilmedi. Adres çubuğundaki kamera simgesinden izin verin.'
          : 'Kamera açılamadı. Başka bir uygulama (ör. kapı ekranı) kullanıyorsa kapatın.',
      );
    }
  };

  const openFile = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    if (!file.type.startsWith('video/')) {
      setSourceError('Bu bir video dosyası değil.');
      return;
    }
    const video = videoRef.current;
    if (!video) return;
    setSourceError(null);
    releaseSource();
    const url = URL.createObjectURL(file);
    objectUrlRef.current = url;
    video.src = url;
    video.loop = true;
    try {
      await video.play();
    } catch {
      setSourceError('Video oynatılamadı; tarayıcının desteklediği bir biçim deneyin (MP4, WebM).');
      return;
    }
    setFileName(file.name);
    resetCounter();
    setRunning(true);
  };

  const chooseExercise = (next: ExerciseId) => {
    exerciseRef.current = next;
    setExercise(next);
    resetCounter();
  };

  // Analysis loop: one pose estimate per new video frame, on this machine.
  useEffect(() => {
    if (!running) return;
    let frame = 0;
    const loop = () => {
      frame = requestAnimationFrame(loop);
      const video = videoRef.current;
      const canvas = canvasRef.current;
      const landmarker = landmarkerRef.current;
      const state = engine.current;
      if (!video || !canvas || !landmarker || video.readyState < 2 || video.videoWidth === 0) return;
      if (video.currentTime === state.lastVideoTime) return;
      state.lastVideoTime = video.currentTime;

      const now = performance.now();
      const landmarks = landmarker.detectForVideo(video, now).landmarks[0] ?? [];
      state.analysis = analyzeFrame(state.analysis, EXERCISES[exerciseRef.current], landmarks, video.videoWidth / video.videoHeight, now);
      const { reading, angle, counter } = state.analysis;
      drawPose(canvas, video, landmarks, reading, angle);

      state.frames++;
      if (now - state.fpsFrom >= FPS_WINDOW_MS) {
        state.fps = Math.round((state.frames * 1000) / (now - state.fpsFrom));
        state.frames = 0;
        state.fpsFrom = now;
      }
      if (now - state.lastUi >= UI_INTERVAL_MS) {
        state.lastUi = now;
        setView({ counter, angle, visible: reading !== null, fps: state.fps });
      }
    };
    frame = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(frame);
  }, [running]);

  const ready = model.kind === 'ready';
  const { counter } = view;
  const reps = countedReps(counter);
  const partial = counter.reps.length - reps;
  const lastCounted = [...counter.reps].reverse().find((rep) => rep.counted) ?? null;
  const loss = slowdown(counter.reps);
  const tip = running ? coaching(counter, spec, view.visible) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <Segmented
          label="Hareket"
          value={exercise}
          options={(Object.keys(EXERCISES) as ExerciseId[]).map((id) => ({ value: id, label: EXERCISES[id].name }))}
          onChange={chooseExercise}
        />
        <Segmented
          label="Kaynak"
          value={source}
          options={[
            { value: 'camera', label: 'Kamera' },
            { value: 'file', label: 'Video dosyası' },
          ]}
          onChange={(next) => {
            if (running) stop();
            setSource(next);
          }}
        />
        <div className="flex gap-2">
          {running ? (
            <button type="button" onClick={stop} className="inline-flex items-center gap-1.5 rounded-xl border border-bad/40 bg-bad/10 px-4 py-2 text-sm font-semibold text-bad">
              <Square className="size-4" /> Durdur
            </button>
          ) : source === 'camera' ? (
            <button type="button" disabled={!ready} onClick={startCamera} className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2 text-sm font-bold text-ink disabled:opacity-40">
              <Camera className="size-4" /> Kamerayı başlat
            </button>
          ) : (
            <button type="button" disabled={!ready} onClick={() => fileRef.current?.click()} className="inline-flex items-center gap-1.5 rounded-xl bg-lime px-4 py-2 text-sm font-bold text-ink disabled:opacity-40">
              <Upload className="size-4" /> Video seç
            </button>
          )}
          <button type="button" onClick={resetCounter} className="inline-flex items-center gap-1.5 rounded-xl border border-line px-3 py-2 text-sm text-muted hover:text-text">
            <RotateCcw className="size-4" /> Sıfırla
          </button>
          <input ref={fileRef} type="file" accept="video/*" className="hidden" onChange={openFile} />
        </div>
      </div>

      <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
        <div className="space-y-3">
          <div className="relative overflow-hidden rounded-3xl border border-line bg-black">
            <video ref={videoRef} muted playsInline className={`block h-auto w-full ${running ? '' : 'hidden'}`} />
            <canvas ref={canvasRef} className={`pointer-events-none absolute inset-0 h-full w-full ${running ? '' : 'hidden'}`} />
            {!running && (
              <div className="grid aspect-video place-items-center p-6 text-center">
                <div className="max-w-md">
                  <p className="font-display text-xl font-bold text-text">{spec.name}</p>
                  <p className="mt-2 text-sm text-muted">{spec.setupHint}</p>
                  <p className="mt-4 text-sm text-muted">
                    {model.kind === 'loading' && 'Model yükleniyor (ilk açılışta yaklaşık 6 MB).'}
                    {model.kind === 'ready' && (source === 'camera' ? '"Kamerayı başlat" ile analiz başlar.' : 'Telefonla çektiğiniz bir seti seçin; video bu bilgisayardan çıkmaz.')}
                    {model.kind === 'error' && <span className="text-bad">{model.message}</span>}
                  </p>
                </div>
              </div>
            )}
            {running && (
              <div className="absolute left-3 top-3 flex flex-wrap gap-2">
                <Chip>{model.kind === 'ready' ? `MediaPipe Pose · ${model.delegate}` : 'MediaPipe Pose'}</Chip>
                <Chip>{`${view.fps} fps`}</Chip>
                {fileName && <Chip>{fileName}</Chip>}
              </div>
            )}
            {tip && (
              <div className={`absolute inset-x-3 bottom-3 rounded-2xl border px-4 py-3 text-center font-display text-lg font-bold backdrop-blur sm:text-2xl ${TONE[tip.tone]}`} role="status" aria-live="polite">
                {tip.text}
              </div>
            )}
          </div>
          {sourceError && <p className="rounded-xl border border-bad/30 bg-bad/10 px-3 py-2 text-sm text-bad" role="alert">{sourceError}</p>}
          <p className="text-xs leading-relaxed text-muted">
            İskeleti Google'ın MediaPipe Pose modeli bu bilgisayarda çıkarır; görüntü kaydedilmez ve hiçbir yere gönderilmez. Tekrar, derinlik, kilitleme ve
            yavaşlama, eklem açılarından sabit kurallarla hesaplanır. Yavaşlama kaldırma süresinden ölçülür, aynı hareket açıklığı varsayılır.
          </p>
        </div>

        <div className="space-y-4">
          <Card>
            <Label className="text-muted">Tekrar</Label>
            <div className="mt-1 flex items-baseline gap-3">
              <span className="font-display text-6xl font-bold text-lime">{reps}</span>
              {partial > 0 && <span className="text-sm text-bad">{partial} yarım</span>}
            </div>
            <div className="mt-4 grid grid-cols-3 gap-1 rounded-xl bg-ink p-1">
              {PHASES.map((phase) => (
                <span
                  key={phase}
                  className={`rounded-lg py-1.5 text-center text-xs font-semibold ${running && counter.phase === phase ? 'bg-surface-2 text-lime' : 'text-muted'}`}
                >
                  {spec.phases[phase]}
                </span>
              ))}
            </div>
          </Card>

          <div className="grid grid-cols-2 gap-3">
            <Metric label={spec.angleLabel} value={view.angle === null ? '-' : `${Math.round(view.angle)}°`} hint={`${spec.phases.bottom} ≤ ${spec.bottomAngle}°`} />
            <Metric label={spec.texts.depthLabel} value={lastCounted ? `${Math.round(lastCounted.minAngle)}°` : '-'} hint={spec.lockoutAngle ? `Tam açılma ≥ ${spec.lockoutAngle}°` : 'En dip açı'} />
            <Metric label="Kaldırma" value={lastCounted ? `${(lastCounted.liftMs / 1000).toFixed(1).replace('.', ',')} sn` : '-'} hint={spec.texts.liftLabel} />
            <Metric
              label="Yavaşlama"
              value={loss === null ? '-' : `%${Math.round(loss * 100)}`}
              hint="İlk tekrara göre"
              tone={loss !== null && loss >= NOTABLE_SLOWDOWN ? 'bad' : undefined}
            />
          </div>

          <Card className="p-0">
            <div className="flex items-center justify-between px-5 pt-4">
              <Label className="text-text">Set</Label>
              <Label className="text-muted">{spec.name}</Label>
            </div>
            {counter.reps.length === 0 ? (
              <p className="px-5 pb-5 pt-3 text-sm text-muted">Tekrarlar burada listelenir.</p>
            ) : (
              <ol className="max-h-80 divide-y divide-line overflow-y-auto px-5 pb-2 pt-2">
                {[...counter.reps].reverse().map((rep, index) => {
                  const faults = repFaults(rep, spec);
                  return (
                    <li key={counter.reps.length - index} className="flex items-center gap-3 py-2 text-sm">
                      <span className={`w-6 font-mono ${rep.counted ? 'text-lime' : 'text-muted'}`}>{rep.counted ? rep.number : '-'}</span>
                      <span className="w-12 text-text">{Math.round(rep.minAngle)}°</span>
                      <span className="w-14 text-muted">{(rep.liftMs / 1000).toFixed(1).replace('.', ',')} sn</span>
                      <span className={`min-w-0 flex-1 truncate text-right text-xs ${faults.length ? 'text-bad' : 'text-ok'}`}>
                        {faults.length ? faults.map((fault) => faultText(fault, spec)).join(', ') : 'Temiz'}
                      </span>
                    </li>
                  );
                })}
              </ol>
            )}
          </Card>
        </div>
      </div>
    </div>
  );
}

function Segmented<T extends string>({ label, value, options, onChange }: { label: string; value: T; options: { value: T; label: string }[]; onChange: (value: T) => void }) {
  return (
    <div className="inline-flex rounded-xl border border-line bg-surface p-1" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          role="radio"
          aria-checked={option.value === value}
          onClick={() => onChange(option.value)}
          className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition ${option.value === value ? 'bg-lime text-ink' : 'text-muted hover:text-text'}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'bad' }) {
  return (
    <div className="rounded-2xl border border-line bg-surface p-4">
      <Label className="text-muted">{label}</Label>
      <div className={`mt-1 font-display text-2xl font-bold ${tone === 'bad' ? 'text-bad' : 'text-text'}`}>{value}</div>
      <p className="mt-0.5 text-xs text-muted">{hint}</p>
    </div>
  );
}

function Chip({ children }: { children: string }) {
  return <span className="rounded-full border border-line bg-ink/80 px-2.5 py-1 font-mono text-[11px] uppercase tracking-[0.12em] text-text backdrop-blur">{children}</span>;
}
